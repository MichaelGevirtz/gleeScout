import { buildProviderSearchQueries } from "./searchQuery.js";
import { searchProviderPages } from "./firecrawlProvider.js";
import type { SearchedPage } from "./firecrawlProvider.js";
import { assembleCandidate, dedupByUrl, MAX_DISCOVERY_RESULTS } from "./assembleCandidates.js";
import { extractProviderFacts } from "../llm/providerExtraction.js";
import type { ProviderExtractionResult } from "../llm/providerExtraction.js";
import type { ProviderCandidate } from "../domain/provider.js";
import type { CategoryAttributeSlot } from "../domain/conversation.js";
import { mapWithConcurrency } from "../shared/concurrency.js";

export type SearchFn = (params: { query: string; limit: number }) => Promise<SearchedPage[]>;

export type ExtractFn = (params: {
  url: string;
  markdown: string;
}) => Promise<ProviderExtractionResult>;

/**
 * Bounded, not unlimited: Gemini's free tier caps `gemini-3.6-flash`
 * at 5 requests/minute (found empirically during task-08's eval run).
 * Parallelizing extraction cuts wall-clock time but does not reduce
 * total call volume, so this stays conservative rather than running
 * all `MAX_DISCOVERY_RESULTS` extractions at once.
 */
export const CONCURRENCY_LIMIT = 3;

/**
 * Results requested per query, decoupled from `MAX_DISCOVERY_RESULTS`
 * (the extraction budget). 3 queries x 3 = up to 9 raw results -> dedupe
 * -> round-robin interleave -> capped to MAX_DISCOVERY_RESULTS (8) ->
 * at most 8 extractions, same ceiling a single query already produced
 * (task-99). Only the diversity of the 8 pages improves.
 */
export const PER_QUERY_SEARCH_LIMIT = 3;

export interface DiscoverProviderCandidatesParams {
  serviceCategory: string;
  location: string;
  categoryAttributes?: Record<string, CategoryAttributeSlot>;
  /** Injected search call; defaults to Task 17's real searchProviderPages. */
  search?: SearchFn;
  /** Injected extraction call; defaults to Task 18's real extractProviderFacts. */
  extract?: ExtractFn;
}

function interleave<T>(lists: T[][]): T[] {
  const result: T[] = [];
  const maxLength = Math.max(0, ...lists.map((list) => list.length));
  for (let i = 0; i < maxLength; i++) {
    for (const list of lists) {
      if (i < list.length) result.push(list[i]!);
    }
  }
  return result;
}

export async function discoverProviderCandidates({
  serviceCategory,
  location,
  categoryAttributes = {},
  search = searchProviderPages,
  extract = extractProviderFacts,
}: DiscoverProviderCandidatesParams): Promise<ProviderCandidate[]> {
  const queries = buildProviderSearchQueries({ serviceCategory, location, categoryAttributes });

  const settled = await Promise.allSettled(
    queries.map((query) => search({ query, limit: PER_QUERY_SEARCH_LIMIT }))
  );
  const perQueryPages: SearchedPage[][] = settled.map((outcome, index) => {
    if (outcome.status === "fulfilled") return outcome.value;
    console.error(`Discovery search failed for query "${queries[index]}":`, outcome.reason);
    return [];
  });
  const pages = interleave(perQueryPages);

  const markdownByUrl = new Map<string, string | null>();
  for (const page of pages) {
    if (!markdownByUrl.has(page.result.url)) {
      markdownByUrl.set(page.result.url, page.markdown);
    }
  }
  const dedupedResults = dedupByUrl(pages.map((page) => page.result)).slice(0, MAX_DISCOVERY_RESULTS);
  const scrapedResults = dedupedResults.filter(
    (result) => (markdownByUrl.get(result.url) ?? null) !== null
  );

  const assembled = await mapWithConcurrency(
    scrapedResults,
    CONCURRENCY_LIMIT,
    async (result): Promise<ProviderCandidate | null> => {
      const markdown = markdownByUrl.get(result.url)!;
      try {
        const extraction = await extract({ url: result.url, markdown });
        const retrievedAt = new Date().toISOString();
        return assembleCandidate({ url: result.url, extraction, retrievedAt });
      } catch (error) {
        console.error(`Extraction failed for candidate ${result.url}:`, error);
        return null;
      }
    }
  );

  return assembled.filter((candidate): candidate is ProviderCandidate => candidate !== null);
}
