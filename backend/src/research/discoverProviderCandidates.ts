import { buildProviderSearchQuery } from "./searchQuery.js";
import { searchProviderPages } from "./firecrawlProvider.js";
import type { SearchedPage } from "./firecrawlProvider.js";
import { assembleCandidate, dedupByUrl, MAX_DISCOVERY_RESULTS } from "./assembleCandidates.js";
import { extractProviderFacts } from "../llm/providerExtraction.js";
import type { ProviderExtractionResult } from "../llm/providerExtraction.js";
import type { ProviderCandidate } from "../domain/provider.js";

export type SearchFn = (params: { query: string; limit: number }) => Promise<SearchedPage[]>;

export type ExtractFn = (params: {
  url: string;
  markdown: string;
}) => Promise<ProviderExtractionResult>;

export interface DiscoverProviderCandidatesParams {
  serviceCategory: string;
  location: string;
  /** Injected search call; defaults to Task 17's real searchProviderPages. */
  search?: SearchFn;
  /** Injected extraction call; defaults to Task 18's real extractProviderFacts. */
  extract?: ExtractFn;
}

export async function discoverProviderCandidates({
  serviceCategory,
  location,
  search = searchProviderPages,
  extract = extractProviderFacts,
}: DiscoverProviderCandidatesParams): Promise<ProviderCandidate[]> {
  const query = buildProviderSearchQuery({ serviceCategory, location });
  const pages = await search({ query, limit: MAX_DISCOVERY_RESULTS });

  const markdownByUrl = new Map<string, string | null>();
  for (const page of pages) {
    if (!markdownByUrl.has(page.result.url)) {
      markdownByUrl.set(page.result.url, page.markdown);
    }
  }
  const dedupedResults = dedupByUrl(pages.map((page) => page.result));

  const candidates: ProviderCandidate[] = [];
  for (const result of dedupedResults) {
    const markdown = markdownByUrl.get(result.url) ?? null;
    if (markdown === null) continue;

    try {
      const extraction = await extract({ url: result.url, markdown });
      const retrievedAt = new Date().toISOString();
      const candidate = assembleCandidate({ url: result.url, extraction, retrievedAt });
      if (candidate !== null) candidates.push(candidate);
    } catch {
      continue;
    }
  }

  return candidates;
}
