import "dotenv/config";
import { buildProviderSearchQuery } from "../src/research/searchQuery.js";
import { searchProviderPages } from "../src/research/firecrawlProvider.js";
import { enrichProviderCandidates } from "../src/research/enrichProviderCandidates.js";
import type { ProviderCandidate } from "../src/domain/provider.js";

const CATEGORY = "bounce house rental";
const LOCATION = "Austin, TX";
const DISCOVERY_LIMIT = 3;

async function main() {
  const query = buildProviderSearchQuery({ serviceCategory: CATEGORY, location: LOCATION });
  console.log(`discovery query: "${query}"`);

  const pages = await searchProviderPages({ query, limit: DISCOVERY_LIMIT });
  console.log(`discovery search results: ${pages.length}`);

  const retrievedAt = new Date().toISOString();
  const candidates: ProviderCandidate[] = pages.map((p) => ({
    url: p.result.url,
    fields: {
      name: {
        value: p.result.title,
        source: new URL(p.result.url).hostname,
        sourceUrl: p.result.url,
        retrievedAt,
      },
      location: {
        value: LOCATION,
        source: new URL(p.result.url).hostname,
        sourceUrl: p.result.url,
        retrievedAt,
      },
    },
  }));

  console.log(`\nseed candidates (name from search result title, no per-page extraction call):`);
  for (const c of candidates) console.log(`  - ${c.url} :: ${c.fields.name?.value}`);

  console.log(`\n=== running enrichProviderCandidates against real Firecrawl + Gemini ===`);
  const enriched = await enrichProviderCandidates({ candidates });

  let withInferred = 0;
  let withoutInferred = 0;
  let totalTags = 0;
  for (const c of enriched) {
    if (c.inferred && c.inferred.length > 0) {
      withInferred++;
      totalTags += c.inferred.length;
      console.log(`\n[enriched] ${c.url}`);
      for (const tag of c.inferred) {
        console.log(`  tag: "${tag.value}"`);
        console.log(`    sourceType: ${tag.sourceType}`);
        console.log(`    evidenceSourceUrl: ${tag.evidenceSourceUrl}`);
        console.log(`    evidenceExcerpt: ${tag.evidenceExcerpt ?? "(none)"}`);
        console.log(`    retrievedAt: ${tag.retrievedAt}`);
      }
    } else if (c.inferred && c.inferred.length === 0) {
      withInferred++;
      console.log(`\n[enriched, zero tags] ${c.url}`);
    } else {
      withoutInferred++;
      console.log(`\n[not enriched / no inferred field] ${c.url}`);
    }
  }

  console.log(`\n=== summary ===`);
  console.log(`candidates fed to enrichment: ${candidates.length}`);
  console.log(`candidates with 'inferred' field present (search+analyze succeeded): ${withInferred}`);
  console.log(`candidates without 'inferred' field (search failed, no scrapable page, or analyze failed): ${withoutInferred}`);
  console.log(`total inferred tags across all candidates: ${totalTags}`);
}

main().catch((err) => {
  console.log(`WHOLE-REQUEST FAILURE: ${(err as Error).constructor.name}: ${(err as Error).message}`);
});
