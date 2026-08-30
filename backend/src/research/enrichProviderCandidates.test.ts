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

const NO_RATING = { rating: null, reviewCount: null, ratingSourceUrl: null } as const;
const NO_TAGS: ReviewAnalysisResult = { tags: [], ...NO_RATING };

function page(url: string, markdown = "md") {
  return { result: { url, title: "r" }, markdown };
}

/** Returns a search fn that answers each query with its own distinct page. */
function searchByQuery(pages: { yelp?: string; google?: string }): EnrichmentSearchFn {
  return async ({ query }) => {
    if (query.includes("site:yelp.com")) return pages.yelp ? [page(pages.yelp)] : [];
    if (query.includes("google reviews")) return pages.google ? [page(pages.google)] : [];
    return [];
  };
}

describe("enrichProviderCandidates", () => {
  it("enriches at most MAX_ENRICHMENT_CANDIDATES, in input order; the rest pass through unchanged", async () => {
    const candidates = Array.from({ length: MAX_ENRICHMENT_CANDIDATES + 2 }, (_, i) =>
      makeCandidate(`https://provider${i}.com`, { name: `Provider ${i}`, location: "Austin" })
    );
    const searchedQueries: string[] = [];
    const search: EnrichmentSearchFn = async ({ query }) => {
      searchedQueries.push(query);
      return [page("https://review-site.com/x")];
    };
    const analyze: AnalyzeFn = async () => NO_TAGS;

    const result = await enrichProviderCandidates({ candidates, search, analyze });

    // Two source-targeted searches per enriched candidate.
    expect(searchedQueries).toHaveLength(MAX_ENRICHMENT_CANDIDATES * 2);
    for (let i = 0; i < MAX_ENRICHMENT_CANDIDATES; i++) {
      expect(result[i]!.inferred).toBeDefined();
    }
    for (let i = MAX_ENRICHMENT_CANDIDATES; i < candidates.length; i++) {
      expect(result[i]!.inferred).toBeUndefined();
      expect(result[i]).toBe(candidates[i]);
    }
  });

  it("issues one yelp-targeted and one google-targeted query per candidate", async () => {
    const candidate = makeCandidate("https://a.com", { name: "Bounce Palace", location: "Austin" });
    const queries: string[] = [];
    const search: EnrichmentSearchFn = async ({ query }) => {
      queries.push(query);
      return [];
    };

    await enrichProviderCandidates({ candidates: [candidate], search, analyze: async () => NO_TAGS });

    expect(queries).toEqual([
      "Bounce Palace Austin site:yelp.com",
      "Bounce Palace Austin google reviews",
    ]);
  });

  it("falls back to hostname when a candidate has no fields.name, and omits an unknown location", async () => {
    const candidate = makeCandidate("https://www.bouncepalace.com/rentals");
    const queries: string[] = [];
    const search: EnrichmentSearchFn = async ({ query }) => {
      queries.push(query);
      return [];
    };

    await enrichProviderCandidates({ candidates: [candidate], search, analyze: async () => NO_TAGS });

    expect(queries).toEqual([
      "www.bouncepalace.com site:yelp.com",
      "www.bouncepalace.com google reviews",
    ]);
  });

  it("fires the yelp and google searches concurrently, not one after the other", async () => {
    const candidate = makeCandidate("https://a.com", { name: "A", location: "X" });
    let resolveYelp: (pages: ReturnType<typeof page>[]) => void = () => {};
    let googleStarted = false;
    const yelpPending = new Promise<ReturnType<typeof page>[]>((resolve) => {
      resolveYelp = resolve;
    });

    const search: EnrichmentSearchFn = async ({ query }) => {
      if (query.includes("site:yelp.com")) return yelpPending;
      googleStarted = true;
      // Google only gets here while Yelp is still unresolved — proof the two
      // overlap in time rather than running in sequence.
      expect(googleStarted).toBe(true);
      resolveYelp([page("https://www.yelp.com/biz/a")]);
      return [page("https://www.google.com/search?q=a")];
    };

    const analyze: AnalyzeFn = async () => NO_TAGS;
    const result = await enrichProviderCandidates({ candidates: [candidate], search, analyze });

    expect(googleStarted).toBe(true);
    expect(result[0]!.inferred).toBeDefined();
  });

  it("makes exactly ONE analyze call per candidate, receiving both pages", async () => {
    const candidate = makeCandidate("https://a.com", { name: "A", location: "X" });
    const search = searchByQuery({
      yelp: "https://www.yelp.com/biz/a",
      google: "https://www.google.com/search?q=a",
    });
    const analyzeCalls: { url: string }[][] = [];
    const analyze: AnalyzeFn = async ({ pages }) => {
      analyzeCalls.push(pages.map(({ url }) => ({ url })));
      return NO_TAGS;
    };

    await enrichProviderCandidates({ candidates: [candidate], search, analyze });

    expect(analyzeCalls).toHaveLength(1);
    expect(analyzeCalls[0]).toEqual([
      { url: "https://www.yelp.com/biz/a" },
      { url: "https://www.google.com/search?q=a" },
    ]);
  });

  it("analyzes a page once when both searches land on the same url", async () => {
    const candidate = makeCandidate("https://a.com", { name: "A", location: "X" });
    const search: EnrichmentSearchFn = async () => [page("https://www.yelp.com/biz/a")];
    let receivedPages = 0;
    const analyze: AnalyzeFn = async ({ pages }) => {
      receivedPages = pages.length;
      return NO_TAGS;
    };

    await enrichProviderCandidates({ candidates: [candidate], search, analyze });

    expect(receivedPages).toBe(1);
  });

  it("still lands the google rating as a FACT when the yelp search rejects", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const candidate = makeCandidate("https://a.com", { name: "A", location: "X" });
    const search: EnrichmentSearchFn = async ({ query }) => {
      if (query.includes("site:yelp.com")) throw new Error("yelp search failed");
      return [page("https://www.google.com/search?q=a")];
    };
    const analyze: AnalyzeFn = async () => ({
      tags: [],
      rating: 4.4,
      reviewCount: 120,
      ratingSourceUrl: "https://www.google.com/search?q=a",
    });

    const result = await enrichProviderCandidates({ candidates: [candidate], search, analyze });

    expect(result[0]!.fields.rating).toEqual({
      value: 4.4,
      source: "google.com",
      sourceUrl: "https://www.google.com/search?q=a",
      retrievedAt: expect.any(String),
    });
    expect(result[0]!.fields.reviewCount?.value).toBe(120);
    consoleSpy.mockRestore();
  });

  it("passes the candidate through unchanged when both searches reject", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const candidate = makeCandidate("https://a.com", { name: "A", location: "X" });
    const search: EnrichmentSearchFn = async () => {
      throw new Error("firecrawl down");
    };
    let analyzeCalls = 0;
    const analyze: AnalyzeFn = async () => {
      analyzeCalls++;
      return NO_TAGS;
    };

    const result = await enrichProviderCandidates({ candidates: [candidate], search, analyze });

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(candidate);
    expect(result[0]!.fields.rating).toBeUndefined();
    expect(analyzeCalls).toBe(0);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("passes the candidate through unchanged when both searches return no usable markdown", async () => {
    const candidate = makeCandidate("https://a.com", { name: "A", location: "X" });
    const search: EnrichmentSearchFn = async () => [
      { result: { url: "https://review-site.com/x", title: "r" }, markdown: null },
    ];
    let analyzeCalls = 0;
    const analyze: AnalyzeFn = async () => {
      analyzeCalls++;
      return NO_TAGS;
    };

    const result = await enrichProviderCandidates({ candidates: [candidate], search, analyze });

    expect(result[0]).toBe(candidate);
    expect(analyzeCalls).toBe(0);
  });

  it("overwrites a self-reported rating with the independently sourced one", async () => {
    const candidate: ProviderCandidate = {
      url: "https://www.bouncepalace.com/rentals",
      fields: {
        name: {
          value: "Bounce Palace",
          source: "bouncepalace.com",
          sourceUrl: "https://www.bouncepalace.com/rentals",
          retrievedAt: RETRIEVED_AT,
        },
        rating: {
          value: 5,
          source: "bouncepalace.com",
          sourceUrl: "https://www.bouncepalace.com/rentals",
          retrievedAt: RETRIEVED_AT,
        },
      },
    };
    const search = searchByQuery({ yelp: "https://www.yelp.com/biz/bounce-palace" });
    const analyze: AnalyzeFn = async () => ({
      tags: [],
      rating: 4.1,
      reviewCount: 210,
      ratingSourceUrl: "https://www.yelp.com/biz/bounce-palace",
    });

    const result = await enrichProviderCandidates({ candidates: [candidate], search, analyze });

    expect(result[0]!.fields.rating?.value).toBe(4.1);
    expect(result[0]!.fields.rating?.source).toBe("yelp.com");
  });

  it("does not overwrite an already independently sourced rating", async () => {
    const candidate: ProviderCandidate = {
      url: "https://www.bouncepalace.com/rentals",
      fields: {
        rating: {
          value: 4.6,
          source: "google.com",
          sourceUrl: "https://www.google.com/search?q=bounce",
          retrievedAt: RETRIEVED_AT,
        },
      },
    };
    const search = searchByQuery({ yelp: "https://www.yelp.com/biz/bounce-palace" });
    const analyze: AnalyzeFn = async () => ({
      tags: [],
      rating: 4.1,
      reviewCount: 210,
      ratingSourceUrl: "https://www.yelp.com/biz/bounce-palace",
    });

    const result = await enrichProviderCandidates({ candidates: [candidate], search, analyze });

    expect(result[0]!.fields.rating?.value).toBe(4.6);
    expect(result[0]!.fields.rating?.source).toBe("google.com");
  });

  it("processes candidates concurrently, bounded by CONCURRENCY_LIMIT", async () => {
    const candidates = Array.from({ length: 5 }, (_, i) =>
      makeCandidate(`https://p${i}.com`, { name: `P${i}`, location: "X" })
    );
    let inFlight = 0;
    let maxInFlight = 0;
    const search: EnrichmentSearchFn = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return [page("https://review-site.com/x")];
    };
    const analyze: AnalyzeFn = async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return NO_TAGS;
    };

    const result = await enrichProviderCandidates({ candidates, search, analyze });

    expect(maxInFlight).toBeLessThanOrEqual(CONCURRENCY_LIMIT);
    expect(result).toHaveLength(5);
    for (const candidate of result) {
      expect(candidate.inferred).toBeDefined();
    }
  });

  it("preserves input order even when candidates finish out of order", async () => {
    const candidates = Array.from({ length: 4 }, (_, i) =>
      makeCandidate(`https://p${i}.com`, { name: `P${i}`, location: "X" })
    );
    const search: EnrichmentSearchFn = async ({ query }) => {
      // Later candidates resolve first.
      const index = Number(query.match(/^P(\d)/)?.[1] ?? 0);
      await new Promise((resolve) => setTimeout(resolve, (4 - index) * 2));
      return [page("https://review-site.com/x")];
    };
    const analyze: AnalyzeFn = async () => NO_TAGS;

    const result = await enrichProviderCandidates({ candidates, search, analyze });

    expect(result.map((c) => c.url)).toEqual(candidates.map((c) => c.url));
  });

  it("logs and skips a candidate whose analyze call throws, without rejecting or dropping the candidate", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const candidate = makeCandidate("https://a.com", { name: "A", location: "X" });
    const search: EnrichmentSearchFn = async () => [page("https://review-site.com/x")];
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
    const search = searchByQuery({ yelp: "https://www.yelp.com/biz/bounce-palace" });
    const analyze: AnalyzeFn = async () => ({
      tags: [{ tag: "good with toddlers", excerpt: "kids loved it" }],
      ...NO_RATING,
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
    const search = searchByQuery({ yelp: "https://www.yelp.com/biz/a" });
    const analyze: AnalyzeFn = async () => ({
      tags: [{ tag: "good with toddlers", excerpt: null }],
      rating: 4.9,
      reviewCount: 12,
      ratingSourceUrl: "https://www.yelp.com/biz/a",
    });

    await enrichProviderCandidates({ candidates, search, analyze });

    expect(candidates).toEqual(snapshot);
    expect(candidate.inferred).toBeUndefined();
    expect(candidate.fields.rating).toBeUndefined();
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
    const search = searchByQuery({ yelp: "https://www.yelp.com/biz/x" });
    const analyze: AnalyzeFn = async () => ({
      tags: [{ tag: "great with large groups", excerpt: "handled our 50-person party well" }],
      rating: 4.7,
      reviewCount: 88,
      ratingSourceUrl: "https://www.yelp.com/biz/x",
    });

    const result = await enrichProviderCandidates({ candidates: discovered, search, analyze });

    expect(result).toHaveLength(2);
    for (const candidate of result) {
      expect(() => ProviderCandidateSchema.parse(candidate)).not.toThrow();
      expect(candidate.inferred).toHaveLength(1);
      expect(candidate.inferred![0]!.sourceType).toBe("yelp");
      expect(candidate.fields.rating?.value).toBe(4.7);
      expect(candidate.fields.rating?.source).toBe("yelp.com");
    }
  });
});
