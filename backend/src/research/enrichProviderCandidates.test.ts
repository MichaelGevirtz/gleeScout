import { describe, expect, it, vi } from "vitest";
import {
  enrichProviderCandidates,
  MAX_ENRICHMENT_CANDIDATES,
  CONCURRENCY_LIMIT,
  type AnalyzeFn,
  type EnrichmentSearchFn,
} from "./enrichProviderCandidates.js";
import type { ProviderCandidate } from "../domain/provider.js";
import type { ReviewAnalysisResult } from "../llm/reviewAnalysis.js";
import { ProviderCandidateSchema } from "../domain/provider.js";

const RETRIEVED_AT = "2026-08-28T12:00:00.000Z";

function makeCandidate(
  url: string,
  overrides: { name?: string; location?: string } = {}
): ProviderCandidate {
  return {
    url,
    fields: {
      ...(overrides.name !== undefined
        ? { name: { value: overrides.name, source: "x", sourceUrl: url, retrievedAt: RETRIEVED_AT } }
        : {}),
      ...(overrides.location !== undefined
        ? {
            location: {
              value: overrides.location,
              source: "x",
              sourceUrl: url,
              retrievedAt: RETRIEVED_AT,
            },
          }
        : {}),
    },
  };
}

const NO_TAGS: ReviewAnalysisResult = { tags: [] };

describe("enrichProviderCandidates", () => {
  it("enriches at most MAX_ENRICHMENT_CANDIDATES, in input order; the rest pass through unchanged", async () => {
    const candidates = Array.from({ length: MAX_ENRICHMENT_CANDIDATES + 2 }, (_, i) =>
      makeCandidate(`https://provider${i}.com`, { name: `Provider ${i}`, location: "Austin" })
    );
    const searchedQueries: string[] = [];
    const search: EnrichmentSearchFn = async ({ query }) => {
      searchedQueries.push(query);
      return [{ result: { url: "https://review-site.com/x", title: "r" }, markdown: "md" }];
    };
    const analyze: AnalyzeFn = async () => NO_TAGS;

    const result = await enrichProviderCandidates({ candidates, search, analyze });

    expect(searchedQueries).toHaveLength(MAX_ENRICHMENT_CANDIDATES);
    for (let i = 0; i < MAX_ENRICHMENT_CANDIDATES; i++) {
      expect(result[i]!.inferred).toBeDefined();
    }
    for (let i = MAX_ENRICHMENT_CANDIDATES; i < candidates.length; i++) {
      expect(result[i]!.inferred).toBeUndefined();
      expect(result[i]).toBe(candidates[i]);
    }
  });

  it("falls back to hostname when a candidate has no fields.name", async () => {
    const candidate = makeCandidate("https://www.bouncepalace.com/rentals", { location: "Austin" });
    let capturedQuery = "";
    const search: EnrichmentSearchFn = async ({ query }) => {
      capturedQuery = query;
      return [{ result: { url: "https://review-site.com/x", title: "r" }, markdown: "md" }];
    };
    const analyze: AnalyzeFn = async () => NO_TAGS;

    await enrichProviderCandidates({ candidates: [candidate], search, analyze });

    expect(capturedQuery).toBe("www.bouncepalace.com reviews Austin");
  });

  it("omits the location term when a candidate has no fields.location", async () => {
    const candidate = makeCandidate("https://www.bouncepalace.com/rentals", { name: "Bounce Palace" });
    let capturedQuery = "";
    const search: EnrichmentSearchFn = async ({ query }) => {
      capturedQuery = query;
      return [{ result: { url: "https://review-site.com/x", title: "r" }, markdown: "md" }];
    };
    const analyze: AnalyzeFn = async () => NO_TAGS;

    await enrichProviderCandidates({ candidates: [candidate], search, analyze });

    expect(capturedQuery).toBe("Bounce Palace reviews");
  });

  it("calls search before analyze within a single candidate's own pipeline", async () => {
    const candidate = makeCandidate("https://a.com", { name: "A", location: "X" });
    const order: string[] = [];
    const search: EnrichmentSearchFn = async ({ query }) => {
      order.push(`search-start:${query}`);
      await new Promise((resolve) => setTimeout(resolve, 0));
      order.push(`search-end:${query}`);
      return [{ result: { url: "https://review-site.com/x", title: "r" }, markdown: "md" }];
    };
    const analyze: AnalyzeFn = async ({ url }) => {
      order.push(`analyze-start:${url}`);
      await new Promise((resolve) => setTimeout(resolve, 0));
      order.push(`analyze-end:${url}`);
      return NO_TAGS;
    };

    await enrichProviderCandidates({ candidates: [candidate], search, analyze });

    expect(order).toEqual([
      "search-start:A reviews X",
      "search-end:A reviews X",
      "analyze-start:https://review-site.com/x",
      "analyze-end:https://review-site.com/x",
    ]);
  });

  it("processes candidates concurrently, bounded by CONCURRENCY_LIMIT", async () => {
    const candidates = Array.from({ length: 5 }, (_, i) =>
      makeCandidate(`https://p${i}.com`, { name: `P${i}`, location: "X" })
    );
    let inFlight = 0;
    let maxInFlight = 0;
    const search: EnrichmentSearchFn = async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      return [{ result: { url: "https://review-site.com/x", title: "r" }, markdown: "md" }];
    };
    const analyze: AnalyzeFn = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return NO_TAGS;
    };

    const result = await enrichProviderCandidates({ candidates, search, analyze });

    expect(maxInFlight).toBe(CONCURRENCY_LIMIT);
    expect(result).toHaveLength(5);
    for (const candidate of result) {
      expect(candidate.inferred).toBeDefined();
    }
  });

  it("logs and skips a candidate whose search call throws, without rejecting or dropping the candidate", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const candidates = [
      makeCandidate("https://a.com", { name: "A", location: "X" }),
      makeCandidate("https://b.com", { name: "B", location: "X" }),
    ];
    const search: EnrichmentSearchFn = async ({ query }) => {
      if (query.startsWith("A")) throw new Error("firecrawl down");
      return [{ result: { url: "https://review-site.com/x", title: "r" }, markdown: "md" }];
    };
    const analyze: AnalyzeFn = async () => NO_TAGS;

    const result = await enrichProviderCandidates({ candidates, search, analyze });

    expect(result).toHaveLength(2);
    expect(result[0]!.url).toBe("https://a.com");
    expect(result[0]!.inferred).toBeUndefined();
    expect(result[1]!.inferred).toBeDefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://a.com"),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it("logs and skips a candidate whose analyze call throws, without rejecting or dropping the candidate", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const candidate = makeCandidate("https://a.com", { name: "A", location: "X" });
    const search: EnrichmentSearchFn = async () => [
      { result: { url: "https://review-site.com/x", title: "r" }, markdown: "md" },
    ];
    const analyze: AnalyzeFn = async () => {
      throw new Error("gemini failed");
    };

    const result = await enrichProviderCandidates({ candidates: [candidate], search, analyze });

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe("https://a.com");
    expect(result[0]!.inferred).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://a.com"),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it("builds inferred via assembleInferredTags with providerUrl set to the candidate's own url", async () => {
    const candidate = makeCandidate("https://www.bouncepalace.com/rentals", {
      name: "Bounce Palace",
      location: "Austin",
    });
    const search: EnrichmentSearchFn = async () => [
      { result: { url: "https://www.yelp.com/biz/bounce-palace", title: "r" }, markdown: "md" },
    ];
    const analyze: AnalyzeFn = async () => ({
      tags: [{ tag: "good with toddlers", excerpt: "kids loved it" }],
    });

    const result = await enrichProviderCandidates({ candidates: [candidate], search, analyze });

    expect(result[0]!.inferred).toEqual([
      expect.objectContaining({
        value: "good with toddlers",
        evidenceSourceUrl: "https://www.yelp.com/biz/bounce-palace",
        evidenceExcerpt: "kids loved it",
        sourceType: "yelp",
      }),
    ]);
  });

  it("does not mutate the input candidates array or its objects", async () => {
    const candidate = makeCandidate("https://a.com", { name: "A", location: "X" });
    const candidates = [candidate];
    const snapshot = JSON.parse(JSON.stringify(candidates));
    const search: EnrichmentSearchFn = async () => [
      { result: { url: "https://review-site.com/x", title: "r" }, markdown: "md" },
    ];
    const analyze: AnalyzeFn = async () => ({
      tags: [{ tag: "good with toddlers", excerpt: null }],
    });

    await enrichProviderCandidates({ candidates, search, analyze });

    expect(candidates).toEqual(snapshot);
    expect(candidate.inferred).toBeUndefined();
  });
});

describe("enrichProviderCandidates integration (fakes only, no network)", () => {
  it("enriches a discoverProviderCandidates-shaped input end-to-end, producing schema-valid output", async () => {
    const discovered: ProviderCandidate[] = [
      makeCandidate("https://www.bouncepalace.com/rentals", {
        name: "Bounce Palace",
        location: "Austin, TX",
      }),
      makeCandidate("https://partyfun.com", { name: "Party Fun" }),
    ];
    const search: EnrichmentSearchFn = async () => [
      { result: { url: "https://www.yelp.com/biz/x", title: "r" }, markdown: "review markdown" },
    ];
    const analyze: AnalyzeFn = async () => ({
      tags: [{ tag: "great with large groups", excerpt: "handled our 50-person party well" }],
    });

    const result = await enrichProviderCandidates({ candidates: discovered, search, analyze });

    expect(result).toHaveLength(2);
    for (const candidate of result) {
      expect(() => ProviderCandidateSchema.parse(candidate)).not.toThrow();
      expect(candidate.inferred).toHaveLength(1);
      expect(candidate.inferred![0]!.sourceType).toBe("yelp");
    }
  });
});
