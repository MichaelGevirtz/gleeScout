import { buildEnrichmentQuery } from "./enrichmentQuery.js";
import { searchProviderPages } from "./firecrawlProvider.js";
import type { SearchedPage } from "./firecrawlProvider.js";
import { analyzeReviewText } from "../llm/reviewAnalysis.js";
import type { ReviewAnalysisResult } from "../llm/reviewAnalysis.js";
import { assembleInferredTags } from "./assembleInferredTags.js";
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
 */
export const CONCURRENCY_LIMIT = 3;

export type EnrichmentSearchFn = (params: { query: string; limit: number }) => Promise<SearchedPage[]>;

export type AnalyzeFn = (params: {
  url: string;
  markdown: string;
}) => Promise<ReviewAnalysisResult>;

export interface EnrichProviderCandidatesParams {
  candidates: ProviderCandidate[];
  /** Injected search call; defaults to Task 17's real searchProviderPages. */
  search?: EnrichmentSearchFn;
  /** Injected analysis call; defaults to Task 23's real analyzeReviewText. */
  analyze?: AnalyzeFn;
}

function buildQueryFor(candidate: ProviderCandidate): string {
  const providerName = candidate.fields.name?.value ?? new URL(candidate.url).hostname;
  const location = candidate.fields.location?.value;
  return location !== undefined
    ? buildEnrichmentQuery({ providerName, location })
    : `${providerName} reviews`;
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
        const query = buildQueryFor(candidate);
        const pages = await search({ query, limit: 1 });
        const page = pages[0];

        if (!page || page.markdown === null) {
          return candidate;
        }

        const analysis = await analyze({ url: page.result.url, markdown: page.markdown });
        const retrievedAt = new Date().toISOString();
        const inferred = assembleInferredTags({
          url: page.result.url,
          providerUrl: candidate.url,
          analysis,
          retrievedAt,
        });

        return { ...candidate, inferred };
      } catch (error) {
        console.error(`Enrichment failed for candidate ${candidate.url}:`, error);
        return candidate;
      }
    }
  );

  return [...enriched, ...passthrough];
}
