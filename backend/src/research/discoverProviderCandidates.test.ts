import { describe, expect, it, vi } from "vitest";
import {
  discoverProviderCandidates,
  CONCURRENCY_LIMIT,
  PER_QUERY_SEARCH_LIMIT,
  type ExtractFn,
  type SearchFn,
} from "./discoverProviderCandidates.js";
import type { SearchedPage } from "./firecrawlProvider.js";
import { MAX_DISCOVERY_RESULTS } from "./assembleCandidates.js";
import { ProviderCandidateSchema } from "../domain/provider.js";
import type { ProviderExtractionResult } from "../llm/providerExtraction.js";
import type { CategoryAttributeSlot } from "../domain/conversation.js";

const ALL_NULL_EXTRACTION: ProviderExtractionResult = {
  name: null,
  location: null,
  servicesOffered: null,
  pricing: null,
  availability: null,
  rating: null,
  reviewCount: null,
  photos: null,
  policies: null,
  contactMethod: null,
};

const NO_CATEGORY_ATTRIBUTES: Record<string, CategoryAttributeSlot> = {};

function page(url: string, markdown: string | null = "md"): SearchedPage {
  return { result: { url, title: url }, markdown };
}

describe("discoverProviderCandidates", () => {
  it("calls extract for each distinct URL, bounded by CONCURRENCY_LIMIT concurrent calls, starting calls in input order", async () => {
    const pages: SearchedPage[] = [page("https://a.com"), page("https://b.com"), page("https://c.com"), page("https://d.com")];
    const search: SearchFn = async () => pages;
    const calledUrls: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const extract: ExtractFn = async ({ url }) => {
      calledUrls.push(url);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return { ...ALL_NULL_EXTRACTION, pricing: "$1" };
    };

    const result = await discoverProviderCandidates({
      serviceCategory: "bounce house",
      location: "Austin",
      categoryAttributes: NO_CATEGORY_ATTRIBUTES,
      search,
      extract,
    });

    expect(calledUrls).toEqual([
      "https://a.com",
      "https://b.com",
      "https://c.com",
      "https://d.com",
    ]);
    expect(maxInFlight).toBe(CONCURRENCY_LIMIT);
    expect(result).toHaveLength(4);
  });

  it("skips a result with markdown: null without calling extract, and it doesn't appear in output", async () => {
    const pages: SearchedPage[] = [page("https://a.com", null), page("https://b.com")];
    const search: SearchFn = async () => pages;
    const calledUrls: string[] = [];
    const extract: ExtractFn = async ({ url }) => {
      calledUrls.push(url);
      return { ...ALL_NULL_EXTRACTION, pricing: "$100" };
    };

    const result = await discoverProviderCandidates({
      serviceCategory: "x",
      location: "y",
      categoryAttributes: NO_CATEGORY_ATTRIBUTES,
      search,
      extract,
    });

    expect(calledUrls).toEqual(["https://b.com"]);
    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe("https://b.com");
  });

  it("skips a candidate whose extract call throws, keeps the rest, and does not reject overall", async () => {
    const pages: SearchedPage[] = [page("https://a.com"), page("https://b.com")];
    const search: SearchFn = async () => pages;
    const extract: ExtractFn = async ({ url }) => {
      if (url === "https://a.com") throw new Error("extraction failed");
      return { ...ALL_NULL_EXTRACTION, pricing: "$50" };
    };

    const result = await discoverProviderCandidates({
      serviceCategory: "x",
      location: "y",
      categoryAttributes: NO_CATEGORY_ATTRIBUTES,
      search,
      extract,
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe("https://b.com");
  });

  it("logs and skips a candidate whose extract call throws, without rejecting or dropping the rest", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const pages: SearchedPage[] = [page("https://a.com"), page("https://b.com")];
    const search: SearchFn = async () => pages;
    const extract: ExtractFn = async ({ url }) => {
      if (url === "https://a.com") throw new Error("gemini failed");
      return { ...ALL_NULL_EXTRACTION, pricing: "$50" };
    };

    const result = await discoverProviderCandidates({
      serviceCategory: "x",
      location: "y",
      categoryAttributes: NO_CATEGORY_ATTRIBUTES,
      search,
      extract,
    });

    expect(result).toHaveLength(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://a.com"),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it("returns an empty array without error when search resolves with zero results", async () => {
    const search: SearchFn = async () => [];
    const extract: ExtractFn = async () => ALL_NULL_EXTRACTION;

    const result = await discoverProviderCandidates({
      serviceCategory: "underwater basket weaving",
      location: "nowhere",
      categoryAttributes: NO_CATEGORY_ATTRIBUTES,
      search,
      extract,
    });

    expect(result).toEqual([]);
  });

  it("keeps a candidate when name is null but another field is populated; other candidates unaffected", async () => {
    const pages: SearchedPage[] = [page("https://a.com"), page("https://b.com")];
    const search: SearchFn = async () => pages;
    const extract: ExtractFn = async ({ url }) => {
      if (url === "https://a.com") return { ...ALL_NULL_EXTRACTION, pricing: "$75/day" };
      return { ...ALL_NULL_EXTRACTION, name: "B Provider" };
    };

    const result = await discoverProviderCandidates({
      serviceCategory: "x",
      location: "y",
      categoryAttributes: NO_CATEGORY_ATTRIBUTES,
      search,
      extract,
    });

    expect(result).toHaveLength(2);
    const a = result.find((c) => c.url === "https://a.com")!;
    expect(a.fields.name).toBeUndefined();
    expect(a.fields.pricing?.value).toBe("$75/day");
    const b = result.find((c) => c.url === "https://b.com")!;
    expect(b.fields.name?.value).toBe("B Provider");
  });

  it("drops a candidate when extract returns every field null, keeping the rest", async () => {
    const pages: SearchedPage[] = [page("https://a.com"), page("https://b.com")];
    const search: SearchFn = async () => pages;
    const extract: ExtractFn = async ({ url }) => {
      if (url === "https://a.com") return { ...ALL_NULL_EXTRACTION };
      return { ...ALL_NULL_EXTRACTION, pricing: "$20" };
    };

    const result = await discoverProviderCandidates({
      serviceCategory: "x",
      location: "y",
      categoryAttributes: NO_CATEGORY_ATTRIBUTES,
      search,
      extract,
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe("https://b.com");
  });

  it("dedups duplicate URLs from search before extraction, calling extract once per URL", async () => {
    const pages: SearchedPage[] = [
      page("https://a.com", "md-a-1"),
      { result: { url: "https://a.com", title: "A dup" }, markdown: "md-a-2" },
      page("https://b.com", "md-b"),
    ];
    const search: SearchFn = async () => pages;
    const calledUrls: string[] = [];
    const extract: ExtractFn = async ({ url, markdown }) => {
      calledUrls.push(url);
      if (url === "https://a.com") expect(markdown).toBe("md-a-1");
      return { ...ALL_NULL_EXTRACTION, pricing: "$10" };
    };

    const result = await discoverProviderCandidates({
      serviceCategory: "x",
      location: "y",
      categoryAttributes: NO_CATEGORY_ATTRIBUTES,
      search,
      extract,
    });

    expect(new Set(calledUrls)).toEqual(new Set(["https://a.com", "https://b.com"]));
    expect(calledUrls).toHaveLength(2);
    expect(result).toHaveLength(2);
  });

  it("dedups a URL returned by two different queries, calling extract once", async () => {
    const search: SearchFn = async ({ query }) => {
      if (query.includes("reviews")) return [page("https://shared.com", "md-reviews")];
      return [page("https://shared.com", "md-broad")];
    };
    const calledUrls: string[] = [];
    const extract: ExtractFn = async ({ url }) => {
      calledUrls.push(url);
      return { ...ALL_NULL_EXTRACTION, pricing: "$10" };
    };

    const result = await discoverProviderCandidates({
      serviceCategory: "x",
      location: "y",
      categoryAttributes: NO_CATEGORY_ATTRIBUTES,
      search,
      extract,
    });

    expect(calledUrls).toEqual(["https://shared.com"]);
    expect(result).toHaveLength(1);
  });

  it("issues every query and they overlap in time (true concurrency, not sequential)", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const issuedQueries: string[] = [];
    const search: SearchFn = async ({ query }) => {
      issuedQueries.push(query);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight--;
      return [];
    };
    const extract: ExtractFn = async () => ALL_NULL_EXTRACTION;

    await discoverProviderCandidates({
      serviceCategory: "bounce house",
      location: "Austin",
      categoryAttributes: NO_CATEGORY_ATTRIBUTES,
      search,
      extract,
    });

    expect(issuedQueries).toEqual([
      "bounce house in Austin",
      "bounce house Austin reviews",
    ]);
    expect(maxInFlight).toBe(2);
  });

  it("interleaves results round-robin across queries rather than concatenating", async () => {
    const search: SearchFn = async ({ query }) => {
      if (query.includes("reviews")) return [page("https://r1.com"), page("https://r2.com")];
      return [page("https://b1.com"), page("https://b2.com")];
    };
    const calledUrls: string[] = [];
    const extract: ExtractFn = async ({ url }) => {
      calledUrls.push(url);
      return { ...ALL_NULL_EXTRACTION, pricing: "$10" };
    };

    await discoverProviderCandidates({
      serviceCategory: "x",
      location: "y",
      categoryAttributes: NO_CATEGORY_ATTRIBUTES,
      search,
      extract,
    });

    expect(calledUrls).toEqual(["https://b1.com", "https://r1.com", "https://b2.com", "https://r2.com"]);
  });

  it("caps the merged, deduped list to MAX_DISCOVERY_RESULTS before extraction, even with more raw results", async () => {
    const categoryAttributes: Record<string, CategoryAttributeSlot> = {
      waterSlide: { description: "d", importance: "optional", value: "yes" },
    };
    const search: SearchFn = async ({ query, limit }) => {
      expect(limit).toBe(PER_QUERY_SEARCH_LIMIT);
      const prefix = query.includes("reviews") ? "r" : query.includes("yes") ? "t" : "b";
      return [1, 2, 3].map((n) => page(`https://${prefix}${n}.com`));
    };
    const calledUrls: string[] = [];
    const extract: ExtractFn = async ({ url }) => {
      calledUrls.push(url);
      return { ...ALL_NULL_EXTRACTION, pricing: "$10" };
    };

    const result = await discoverProviderCandidates({
      serviceCategory: "x",
      location: "y",
      categoryAttributes,
      search,
      extract,
    });

    expect(calledUrls).toHaveLength(MAX_DISCOVERY_RESULTS);
    expect(result).toHaveLength(MAX_DISCOVERY_RESULTS);
  });

  it("one query rejecting still yields candidates from the others, and logs", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const search: SearchFn = async ({ query }) => {
      if (query.includes("reviews")) throw new Error("firecrawl down for reviews query");
      return [page("https://b1.com")];
    };
    const extract: ExtractFn = async () => ({ ...ALL_NULL_EXTRACTION, pricing: "$10" });

    const result = await discoverProviderCandidates({
      serviceCategory: "x",
      location: "y",
      categoryAttributes: NO_CATEGORY_ATTRIBUTES,
      search,
      extract,
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.url).toBe("https://b1.com");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("reviews"),
      expect.any(Error)
    );
    consoleSpy.mockRestore();
  });

  it("returns an empty array, without throwing, when every query rejects", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const search: SearchFn = async () => {
      throw new Error("firecrawl down");
    };
    const extract: ExtractFn = async () => ALL_NULL_EXTRACTION;

    const result = await discoverProviderCandidates({
      serviceCategory: "x",
      location: "y",
      categoryAttributes: NO_CATEGORY_ATTRIBUTES,
      search,
      extract,
    });

    expect(result).toEqual([]);
    consoleSpy.mockRestore();
  });
});

describe("discoverProviderCandidates integration (fakes only, no network)", () => {
  it("produces schema-valid ProviderCandidate[] end-to-end given category+location", async () => {
    const search: SearchFn = async ({ query, limit }) => {
      expect(limit).toBe(PER_QUERY_SEARCH_LIMIT);
      if (query === "bounce house rental in Austin, TX") {
        return [{ result: { url: "https://bouncepalace.com", title: "Bounce Palace" }, markdown: "md" }];
      }
      if (query === "bounce house rental Austin, TX reviews") {
        return [{ result: { url: "https://partyfun.com", title: "Party Fun" }, markdown: "md2" }];
      }
      throw new Error(`unexpected query: ${query}`);
    };
    const extract: ExtractFn = async ({ url }) => ({
      ...ALL_NULL_EXTRACTION,
      name: url === "https://bouncepalace.com" ? "Bounce Palace" : "Party Fun",
      pricing: "$200/day",
    });

    const result = await discoverProviderCandidates({
      serviceCategory: "bounce house rental",
      location: "Austin, TX",
      categoryAttributes: NO_CATEGORY_ATTRIBUTES,
      search,
      extract,
    });

    expect(result).toHaveLength(2);
    for (const candidate of result) {
      expect(() => ProviderCandidateSchema.parse(candidate)).not.toThrow();
    }
  });
});
