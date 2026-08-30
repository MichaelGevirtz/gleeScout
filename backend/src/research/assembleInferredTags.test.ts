import { describe, expect, it } from "vitest";
import { assembleInferredTags, classifySourceType } from "./assembleInferredTags.js";
import type { ReviewAnalysisResult } from "../llm/reviewAnalysis.js";

const PROVIDER_URL = "https://www.bouncepalace.com/rentals";

/**
 * Rating fields are irrelevant to tag assembly (they take the separate FACT
 * path via applyRatingFact) — always null here so these cases stay focused on
 * the INFERRED mapping.
 */
function analysisOf(tags: ReviewAnalysisResult["tags"]): ReviewAnalysisResult {
  return { tags, rating: null, reviewCount: null, ratingSourceUrl: null };
}
const RETRIEVED_AT = "2026-08-28T12:00:00.000Z";

describe("assembleInferredTags", () => {
  it("maps a single { tag, excerpt } entry to one Inferred<string>", () => {
    const analysis = analysisOf([{ tag: "good with toddlers", excerpt: "kids loved it" }]);

    const result = assembleInferredTags({
      url: "https://www.yelp.com/biz/bounce-palace",
      providerUrl: PROVIDER_URL,
      analysis,
      retrievedAt: RETRIEVED_AT,
    });

    expect(result).toEqual([
      {
        value: "good with toddlers",
        evidenceSourceUrl: "https://www.yelp.com/biz/bounce-palace",
        evidenceExcerpt: "kids loved it",
        sourceType: "yelp",
        retrievedAt: RETRIEVED_AT,
      },
    ]);
  });

  it("maps excerpt: null to evidenceExcerpt: undefined, not null", () => {
    const analysis = analysisOf([{ tag: "frequently arrives late", excerpt: null }]);

    const result = assembleInferredTags({
      url: "https://www.yelp.com/biz/bounce-palace",
      providerUrl: PROVIDER_URL,
      analysis,
      retrievedAt: RETRIEVED_AT,
    });

    expect(result[0]!.evidenceExcerpt).toBeUndefined();
    expect("evidenceExcerpt" in result[0]! ? result[0]!.evidenceExcerpt : "absent-ok").toBeUndefined();
  });

  it("maps multiple tags to independent entries sharing url/retrievedAt/sourceType", () => {
    const analysis = analysisOf([
        { tag: "good with toddlers", excerpt: "kids loved it" },
        { tag: "equipment is very clean", excerpt: null },
      ]);

    const result = assembleInferredTags({
      url: "https://www.google.com/search?q=bounce+palace",
      providerUrl: PROVIDER_URL,
      analysis,
      retrievedAt: RETRIEVED_AT,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      value: "good with toddlers",
      evidenceSourceUrl: "https://www.google.com/search?q=bounce+palace",
      evidenceExcerpt: "kids loved it",
      sourceType: "google",
      retrievedAt: RETRIEVED_AT,
    });
    expect(result[1]).toEqual({
      value: "equipment is very clean",
      evidenceSourceUrl: "https://www.google.com/search?q=bounce+palace",
      evidenceExcerpt: undefined,
      sourceType: "google",
      retrievedAt: RETRIEVED_AT,
    });
  });

  it("maps an empty tags array to an empty array, not null", () => {
    const analysis = analysisOf([]);

    const result = assembleInferredTags({
      url: "https://www.yelp.com/biz/bounce-palace",
      providerUrl: PROVIDER_URL,
      analysis,
      retrievedAt: RETRIEVED_AT,
    });

    expect(result).toEqual([]);
  });

  it("never mutates the input analysis object", () => {
    const analysis = analysisOf([{ tag: "good with toddlers", excerpt: "kids loved it" }]);
    const snapshot = JSON.parse(JSON.stringify(analysis));

    assembleInferredTags({
      url: "https://www.yelp.com/biz/bounce-palace",
      providerUrl: PROVIDER_URL,
      analysis,
      retrievedAt: RETRIEVED_AT,
    });

    expect(analysis).toEqual(snapshot);
  });
});

describe("classifySourceType", () => {
  it("returns provider_website when the url's hostname matches providerUrl's hostname", () => {
    expect(classifySourceType("https://www.bouncepalace.com/reviews", PROVIDER_URL)).toBe(
      "provider_website"
    );
  });

  it("returns google for a google.* hostname distinct from the provider's own site", () => {
    expect(classifySourceType("https://www.google.com/search?q=bounce+palace", PROVIDER_URL)).toBe(
      "google"
    );
  });

  it("gives provider_website precedence over google when the provider's own site is a google-owned domain", () => {
    const providerOnGoogle = "https://sites.google.com/view/bounce-palace";
    expect(classifySourceType(providerOnGoogle, providerOnGoogle)).toBe("provider_website");
  });

  it("returns yelp for a yelp.* hostname", () => {
    expect(classifySourceType("https://www.yelp.com/biz/bounce-palace", PROVIDER_URL)).toBe("yelp");
  });

  it("returns directory for an allowlisted independent event-vendor directory", () => {
    expect(classifySourceType("https://www.weddingwire.com/biz/bounce-palace", PROVIDER_URL)).toBe(
      "directory"
    );
    expect(classifySourceType("https://www.gigsalad.com/bounce-palace", PROVIDER_URL)).toBe(
      "directory"
    );
  });

  it("returns other for an unrelated hostname that is not an allowlisted directory", () => {
    expect(classifySourceType("https://www.someblog.com/biz/bounce-palace", PROVIDER_URL)).toBe(
      "other"
    );
  });

  it("returns google for a bare google.com hostname", () => {
    expect(classifySourceType("https://google.com/search?q=x", PROVIDER_URL)).toBe("google");
  });

  it("returns google for a google.com subdomain like maps.google.com", () => {
    expect(classifySourceType("https://maps.google.com/place/x", PROVIDER_URL)).toBe("google");
  });

  it("does NOT classify a lookalike hostname like notgoogle.com as google", () => {
    expect(classifySourceType("https://notgoogle.com/search?q=x", PROVIDER_URL)).toBe("other");
  });

  it("does NOT classify a lookalike hostname like mygoogle.com as google", () => {
    expect(classifySourceType("https://mygoogle.com/search?q=x", PROVIDER_URL)).toBe("other");
  });

  it("returns yelp for a bare yelp.com hostname", () => {
    expect(classifySourceType("https://yelp.com/biz/bounce-palace", PROVIDER_URL)).toBe("yelp");
  });

  it("returns yelp for www.yelp.com", () => {
    expect(classifySourceType("https://www.yelp.com/biz/bounce-palace", PROVIDER_URL)).toBe("yelp");
  });

  it("does NOT classify a lookalike hostname like notyelp.com as yelp", () => {
    expect(classifySourceType("https://notyelp.com/biz/bounce-palace", PROVIDER_URL)).toBe("other");
  });

  it("returns provider_website when the evidence url has a www. prefix the providerUrl lacks", () => {
    expect(
      classifySourceType("https://www.bouncepalace.com/reviews", "https://bouncepalace.com/rentals")
    ).toBe("provider_website");
  });

  it("returns provider_website when the providerUrl has a www. prefix the evidence url lacks", () => {
    expect(
      classifySourceType("https://bouncepalace.com/reviews", "https://www.bouncepalace.com/rentals")
    ).toBe("provider_website");
  });

  it("still returns provider_website when both hostnames already match exactly (no regression)", () => {
    expect(classifySourceType("https://www.bouncepalace.com/reviews", PROVIDER_URL)).toBe(
      "provider_website"
    );
    expect(
      classifySourceType("https://bouncepalace.com/reviews", "https://bouncepalace.com/rentals")
    ).toBe("provider_website");
  });
});
