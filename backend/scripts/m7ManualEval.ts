import "dotenv/config";
import { buildProviderSearchQuery } from "../src/research/searchQuery.js";
import { searchProviderPages } from "../src/research/firecrawlProvider.js";
import { extractProviderFacts } from "../src/llm/providerExtraction.js";
import { assembleCandidate, dedupByUrl, MAX_DISCOVERY_RESULTS } from "../src/research/assembleCandidates.js";

const CASES = [
  { serviceCategory: "bounce house rental", location: "Austin, TX" },
  { serviceCategory: "wedding photographer", location: "Tel Aviv" },
  { serviceCategory: "taco truck catering", location: "Denver, CO" },
];

async function runCase(serviceCategory: string, location: string) {
  const query = buildProviderSearchQuery({ serviceCategory, location });
  console.log(`\n=== ${serviceCategory} / ${location} ===`);
  console.log(`query: "${query}"`);

  const pages = await searchProviderPages({ query, limit: MAX_DISCOVERY_RESULTS });
  console.log(`search results: ${pages.length}`);
  const scraped = pages.filter((p) => p.markdown !== null);
  console.log(`scraped successfully (markdown non-null): ${scraped.length}`);

  const markdownByUrl = new Map<string, string | null>();
  for (const page of pages) {
    if (!markdownByUrl.has(page.result.url)) markdownByUrl.set(page.result.url, page.markdown);
  }
  const dedupedResults = dedupByUrl(pages.map((p) => p.result));
  console.log(`distinct URLs after dedup: ${dedupedResults.length}`);

  let extractSuccess = 0;
  let extractFailure = 0;
  const candidates = [];
  for (const result of dedupedResults) {
    const markdown = markdownByUrl.get(result.url) ?? null;
    if (markdown === null) continue;
    try {
      const extraction = await extractProviderFacts({ url: result.url, markdown });
      extractSuccess++;
      const retrievedAt = new Date().toISOString();
      const candidate = assembleCandidate({ url: result.url, extraction, retrievedAt });
      if (candidate !== null) candidates.push(candidate);
      console.log(`  [ok] ${result.url}`);
      console.log(`       ${JSON.stringify(extraction)}`);
    } catch (err) {
      extractFailure++;
      console.log(`  [FAIL] ${result.url} :: ${(err as Error).constructor.name}: ${(err as Error).message}`);
    }
  }

  console.log(`extraction: ${extractSuccess} success / ${extractFailure} failure`);
  console.log(`final ProviderCandidates: ${candidates.length}`);
}

async function main() {
  for (const c of CASES) {
    try {
      await runCase(c.serviceCategory, c.location);
    } catch (err) {
      console.log(`\n=== ${c.serviceCategory} / ${c.location} ===`);
      console.log(`WHOLE-REQUEST FAILURE: ${(err as Error).constructor.name}: ${(err as Error).message}`);
    }
  }
}

main();
