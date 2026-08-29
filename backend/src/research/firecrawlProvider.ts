import Firecrawl from "@mendable/firecrawl-js";
import type { Document as FirecrawlDocument, SearchResultWeb } from "@mendable/firecrawl-js";
import type { DiscoveredResult } from "../domain/provider.js";

export interface SearchedPage {
  result: DiscoveredResult;
  markdown: string | null;
}

export class FirecrawlConfigError extends Error {}

/**
 * Minimal shape this module needs from the Firecrawl SDK, kept separate
 * from the SDK's own types so callers of `searchProviderPages` never
 * need to import from `@mendable/firecrawl-js`. Named `FirecrawlSearchClient`
 * rather than `FirecrawlClient` (the task's original working name) because
 * the real SDK already exports its own class called `FirecrawlClient` —
 * verified live via the installed package's type declarations, per D2a's
 * precedent of confirming SDK shapes rather than assuming them.
 */
export interface FirecrawlSearchResultItem {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
}

export interface FirecrawlSearchClient {
  search(params: { query: string; limit: number }): Promise<{
    results: FirecrawlSearchResultItem[];
  }>;
}

/**
 * Firecrawl's `search()` returns `web` items typed as `SearchResultWeb |
 * Document` — a plain `SearchResultWeb` (url/title/description at the top
 * level) when no `scrapeOptions` are requested, or a `Document` (content
 * fields at the top level, url/title/description under `metadata`) when
 * `scrapeOptions.formats` includes `"markdown"`, as this module always
 * requests. Handles both shapes so this mapping stays correct even if a
 * future response includes un-scraped items.
 */
function mapFirecrawlItem(
  item: SearchResultWeb | FirecrawlDocument
): FirecrawlSearchResultItem {
  if ("markdown" in item || "metadata" in item) {
    const doc = item as FirecrawlDocument;
    return {
      url: doc.metadata?.url ?? doc.metadata?.sourceURL ?? "",
      title: doc.metadata?.title,
      description: doc.metadata?.description,
      markdown: doc.markdown,
    };
  }
  const web = item as SearchResultWeb;
  return {
    url: web.url,
    title: web.title,
    description: web.description,
  };
}

function createDefaultClient(): FirecrawlSearchClient {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new FirecrawlConfigError(
      "FIRECRAWL_API_KEY is not set. Set it in the environment before calling the Firecrawl client."
    );
  }
  const app = new Firecrawl({ apiKey });

  return {
    async search({ query, limit }) {
      const response = await app.search(query, {
        limit,
        scrapeOptions: { formats: ["markdown"] },
      });
      const items = response.web ?? [];
      return { results: items.map(mapFirecrawlItem) };
    },
  };
}

export interface SearchProviderPagesParams {
  query: string;
  limit: number;
  /** Injected client; defaults to a real client built from FIRECRAWL_API_KEY. */
  client?: FirecrawlSearchClient;
}

export async function searchProviderPages({
  query,
  limit,
  client,
}: SearchProviderPagesParams): Promise<SearchedPage[]> {
  const activeClient = client ?? createDefaultClient();
  const { results } = await activeClient.search({ query, limit });

  return results.map((item) => ({
    result: {
      url: item.url,
      title: item.title ?? "",
      description: item.description,
    },
    markdown: item.markdown ?? null,
  }));
}
