import { describe, expect, it, vi } from "vitest";
import {
  discoverProviderCandidates,
  type ExtractFn,
  type SearchFn,
} from "./discoverProviderCandidates.js";
import type { SearchedPage } from "./firecrawlProvider.js";
import { MAX_DISCOVERY_RESULTS } from "./assembleCandidates.js";
import { ProviderCandidateSchema } from "../domain/provider.js";
import type { ProviderExtractionResult } from "../llm/providerExtraction.js";

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

describe("discoverProviderCandidates", () => {
  it("calls extract sequentially, not concurrently, once per distinct URL", async () => {
    const order: string[] = [];
    const pages: SearchedPage[] = [
      { result: { url: "https://a.com", title: "A" }, markdown: "md-a" },
      { result: { url: "https://b.com", title: "B" }, markdown: "md-b" },
      { result: { url: "https://c.com", title: "C" }, markdown: "md-c" },
    ];
    const search: SearchFn = async () => pages;
    const extract: ExtractFn = async ({ url }) => {
      order.push(`${url}-start`);
      await new Promise((resolve) => setTimeout(resolve, 0));
      order.push(`${url}-end`);
      return { ...ALL_NULL_EXTRACTION, pricing: "$1" };
    };

    const result = await discoverProviderCandidates({
      serviceCategory: "bounce house",
      location: "Austin",
      search,
      extract,
    });

    expect(order).toEqual([
      "https://a.com-start",
      "https://a.com-end",
      "https://b.com-start",
      "https://b.com-end",
      "https://c.com-start",
      "https://c.com-end",
    ]);
    expect(result).toHaveLength(3);
  });

  it("skips a result with markdown: null without calling extract, and it doesn't appear in output", async () => {
    const pages: SearchedPage[] = [
      { result: { url: "https://a.com", title: "A" }, markdown: null },
      { result: { url: "https://b.com", title: "B" }, markdown: "md-b" },
    ];
    const search: SearchFn = async () => pages;
    const calledUrls: string[] = [];
    const extract: ExtractFn = async ({ url }) => {
      calledUrls.push(url);
      return { ...ALL_NULL_EXTRACTION, pricing: "$100" };
    };

    const result = await discoverProviderCandidates({
      serviceCategory: "x",
      location: "y",
      search,
      extract,
    });

    expect(calledUrls).toEqual(["https://b.com"]);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://b.com");
  });

  it("skips a candidate whose extract call throws, keeps the rest, and does not reject overall", async () => {
    const pages: SearchedPage[] = [
      { result: { url: "https://a.com", title: "A" }, markdown: "md-a" },
      { result: { url: "https://b.com", title: "B" }, markdown: "md-b" },
    ];
    const search: SearchFn = async () => pages;
    const extract: ExtractFn = async ({ url }) => {
      if (url === "https://a.com") throw new Error("extraction failed");
      return { ...ALL_NULL_EXTRACTION, pricing: "$50" };
    };

    const result = await discoverProviderCandidates({
      serviceCategory: "x",
      location: "y",
      search,
      extract,
    });

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://b.com");
  });

  it("logs and skips a candidate whose extract call throws, without rejecting or dropping the rest", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const pages: SearchedPage[] = [
      { result: { url: "https://a.com", title: "A" }, markdown: "md-a" },
      { result: { url: "https://b.com", title: "B" }, markdown: "md-b" },
    ];
    const search: SearchFn = async () => pages;
    const extract: ExtractFn = async ({ url }) => {
      if (url === "https://a.com") throw new Error("gemini failed");
      return { ...ALL_NULL_EXTRACTION, pricing: "$50" };
    };

    const result = await discoverProviderCandidates({
      serviceCategory: "x",
      location: "y",
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
      search,
      extract,
    });

    expect(result).toEqual([]);
  });

  it("keeps a candidate when name is null but another field is populated; other candidates unaffected", async () => {
    const pages: SearchedPage[] = [
      { result: { url: "https://a.com", title: "A" }, markdown: "md-a" },
      { result: { url: "https://b.com", title: "B" }, markdown: "md-b" },
    ];
    const search: SearchFn = async () => pages;
    const extract: ExtractFn = async ({ url }) => {
      if (url === "https://a.com") return { ...ALL_NULL_EXTRACTION, pricing: "$75/day" };
      return { ...ALL_NULL_EXTRACTION, name: "B Provider" };
    };

    const result = await discoverProviderCandidates({
      serviceCategory: "x",
      location: "y",
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
    const pages: SearchedPage[] = [
      { result: { url: "https://a.com", title: "A" }, markdown: "md-a" },
      { result: { url: "https://b.com", title: "B" }, markdown: "md-b" },
    ];
    const search: SearchFn = async () => pages;
    const extract: ExtractFn = async ({ url }) => {
      if (url === "https://a.com") return { ...ALL_NULL_EXTRACTION };
      return { ...ALL_NULL_EXTRACTION, pricing: "$20" };
    };

    const result = await discoverProviderCandidates({
      serviceCategory: "x",
      location: "y",
      search,
      extract,
    });

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://b.com");
  });

  it("propagates a whole-request search failure unchanged, without catching it", async () => {
    const searchError = new Error("firecrawl down");
    const search: SearchFn = async () => {
      throw searchError;
    };
    const extract: ExtractFn = async () => ALL_NULL_EXTRACTION;

    await expect(
      discoverProviderCandidates({ serviceCategory: "x", location: "y", search, extract })
    ).rejects.toThrow(searchError);
  });

  it("dedups duplicate URLs from search before extraction, calling extract once per URL", async () => {
    const pages: SearchedPage[] = [
      { result: { url: "https://a.com", title: "A" }, markdown: "md-a-1" },
      { result: { url: "https://a.com", title: "A dup" }, markdown: "md-a-2" },
      { result: { url: "https://b.com", title: "B" }, markdown: "md-b" },
    ];
    const search: SearchFn = async () => pages;
    const calledUrls: string[] = [];
    const extract: ExtractFn = async ({ url, markdown }) => {
      calledUrls.push(url);
      expect(markdown).toBe(url === "https://a.com" ? "md-a-1" : "md-b");
      return { ...ALL_NULL_EXTRACTION, pricing: "$10" };
    };

    const result = await discoverProviderCandidates({
      serviceCategory: "x",
      location: "y",
      search,
      extract,
    });

    expect(calledUrls).toEqual(["https://a.com", "https://b.com"]);
    expect(result).toHaveLength(2);
  });
});

describe("discoverProviderCandidates integration (fakes only, no network)", () => {
  it("produces schema-valid ProviderCandidate[] end-to-end given category+location", async () => {
    const search: SearchFn = async ({ query, limit }) => {
      expect(query).toBe("bounce house rental in Austin, TX");
      expect(limit).toBe(MAX_DISCOVERY_RESULTS);
      return [
        { result: { url: "https://bouncepalace.com", title: "Bounce Palace" }, markdown: "md" },
        { result: { url: "https://partyfun.com", title: "Party Fun" }, markdown: "md2" },
      ];
    };
    const extract: ExtractFn = async ({ url }) => ({
      ...ALL_NULL_EXTRACTION,
      name: url === "https://bouncepalace.com" ? "Bounce Palace" : "Party Fun",
      pricing: "$200/day",
    });

    const result = await discoverProviderCandidates({
      serviceCategory: "bounce house rental",
      location: "Austin, TX",
      search,
      extract,
    });

    expect(result).toHaveLength(2);
    for (const candidate of result) {
      expect(() => ProviderCandidateSchema.parse(candidate)).not.toThrow();
    }
  });
});
