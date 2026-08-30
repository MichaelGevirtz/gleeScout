import { buildGoogleEnrichmentQuery, buildYelpEnrichmentQuery } from "./enrichmentQuery.js";
import { searchProviderPages } from "./firecrawlProvider.js";
import type { SearchedPage } from "./firecrawlProvider.js";
import { analyzeReviewText } from "../llm/reviewAnalysis.js";
import type { ReviewAnalysisPage, ReviewAnalysisResult } from "../llm/reviewAnalysis.js";
import { assembleInferredTags } from "./assembleInferredTags.js";
import { applyRatingFact } from "./applyRatingFact.js";
import type { ProviderCandidate } from "../domain/provider.js";
import { mapWithConcurrency } from "../shared/concurrency.js";

/**
 * Confirmed during M8 planning: enriching all 8 M7-discovery candidates
 * would push per-session sequential Gemini calls to ~16, against a
 * free-tier cap already shown empirically (M7 real-API validation) to
 * produce transient failures at half that volume. Running these
 * candidates concurrently (see CONCURRENCY_LIMIT below, task-77) cuts
 * wall-clock time but does not change this total call-volume math, so
 * the cap stays as-is.
 */
export const MAX_ENRICHMENT_CANDIDATES = 5;

/**
 * Bounded, not unlimited, for the same reason as
 * `discoverProviderCandidates.ts`'s `CONCURRENCY_LIMIT`: Gemini's free
 * tier caps `gemini-3.6-flash` at 5 requests/minute (task-08), and
 * parallelizing compresses the same call volume into less wall-clock
 * time rather than reducing it.
 *
 * Since task-98 each candidate issues two Firecrawl searches concurrently
 * (Yelp + Google), so this bounds Firecrawl at 3 x 2 = 6 calls in flight —
 * but still exactly one Gemini call per candidate, which is the limit that
 * actually binds.
 */
export const CONCURRENCY_LIMIT = 3;

export type EnrichmentSearchFn = (params: { query: string; limit: number }) => Promise<SearchedPage[]>;

export type AnalyzeFn = (params: { pages: ReviewAnalysisPage[] }) => Promise<ReviewAnalysisResult>;

export interface EnrichProviderCandidatesParams {
  candidates: ProviderCandidate[];
  /** Injected search call; defaults to Task 17's real searchProviderPages. */
  search?: EnrichmentSearchFn;
  /** Injected analysis call; defaults to Task 23's real analyzeReviewText. */
  analyze?: AnalyzeFn;
}

function queryInputsFor(candidate: ProviderCandidate): { providerName: string; location?: string } {
  return {
    providerName: candidate.fields.name?.value ?? new URL(candidate.url).hostname,
    location: candidate.fields.location?.value,
  };
}

/**
 * Both source-targeted searches run at once, and one failing must not lose the
 * other — hence `allSettled` rather than `all`. Order of the returned pages is
 * Yelp-then-Google, which downstream code relies on for a deterministic
 * "primary" page.
 */
async function gatherPages(
  candidate: ProviderCandidate,
  search: EnrichmentSearchFn
): Promise<ReviewAnalysisPage[]> {
  const inputs = queryInputsFor(candidate);

  const settled = await Promise.allSettled([
    search({ query: buildYelpEnrichmentQuery(inputs), limit: 1 }),
    search({ query: buildGoogleEnrichmentQuery(inputs), limit: 1 }),
  ]);

  const pages: ReviewAnalysisPage[] = [];
  const seen = new Set<string>();

  for (const outcome of settled) {
    if (outcome.status === "rejected") {
      console.error(`Enrichment search failed for candidate ${candidate.url}:`, outcome.reason);
      continue;
    }
    for (const page of outcome.value) {
      if (page.markdown === null) continue;
      // Both searches can land on the same page; analyzing it twice would only
      // pad the prompt.
      if (seen.has(page.result.url)) continue;
      seen.add(page.result.url);
      pages.push({ url: page.result.url, markdown: page.markdown });
    }
  }

  return pages;
}

export async function enrichProviderCandidates({
  candidates,
  search = searchProviderPages,
  analyze = analyzeReviewText,
}: EnrichProviderCandidatesParams): Promise<ProviderCandidate[]> {
  const toEnrich = candidates.slice(0, MAX_ENRICHMENT_CANDIDATES);
  const passthrough = candidates.slice(MAX_ENRICHMENT_CANDIDATES);

  const enriched = await mapWithConcurrency(
    toEnrich,
    CONCURRENCY_LIMIT,
    async (candidate): Promise<ProviderCandidate> => {
      try {
        const pages = await gatherPages(candidate, search);
        if (pages.length === 0) {
          return candidate;
        }

        // One call for both pages — see AnalyzeReviewTextParams.pages on why the
        // Gemini call budget stays at one per candidate.
        const analysis = await analyze({ pages });
        const retrievedAt = new Date().toISOString();

        // `assembleInferredTags` attributes tags to a single page. With two pages
        // analyzed together, the first (Yelp before Google) is used as the
        // primary evidence URL — a known approximation, kept because these are
        // INFERRED signals, never FACTs. See task-98's Implementation Notes.
        const inferred = assembleInferredTags({
          url: pages[0]!.url,
          providerUrl: candidate.url,
          analysis,
          retrievedAt,
        });

        const withRating = applyRatingFact({
          candidate,
          analysis,
          suppliedUrls: pages.map((page) => page.url),
          retrievedAt,
        });

        return { ...withRating, inferred };
      } catch (error) {
        console.error(`Enrichment failed for candidate ${candidate.url}:`, error);
        return candidate;
      }
    }
  );

  return [...enriched, ...passthrough];
}
