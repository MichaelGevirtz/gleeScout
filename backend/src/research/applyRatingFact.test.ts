import { describe, expect, it } from "vitest";
import { applyRatingFact } from "./applyRatingFact.js";
import type { ProviderCandidate } from "../domain/provider.js";
import type { ReviewAnalysisResult } from "../llm/reviewAnalysis.js";

const RETRIEVED_AT = "2026-08-30T12:00:00.000Z";
const PROVIDER_URL = "https://www.bouncepalace.com/rentals";
const YELP_URL = "https://www.yelp.com/biz/bounce-palace";
const GOOGLE_URL = "https://www.google.com/search?q=bounce+palace";

function candidate(fields: ProviderCandidate["fields"] = {}): ProviderCandidate {
  return { url: PROVIDER_URL, fields };
}

function fact<T>(value: T, source: string, sourceUrl: string) {
  return { value, source, sourceUrl, retrievedAt: "2026-08-01T00:00:00.000Z" };
}

function analysis(overrides: Partial<ReviewAnalysisResult> = {}): ReviewAnalysisResult {
  return {
    tags: [],
    rating: 4.8,
    reviewCount: 340,
    ratingSourceUrl: YELP_URL,
    ...overrides,
  };
}

describe("applyRatingFact", () => {
  it("writes rating and reviewCount as Facts sourced from the bare hostname of the supplied page", () => {
    const result = applyRatingFact({
      candidate: candidate(),
      analysis: analysis(),
      suppliedUrls: [YELP_URL],
      retrievedAt: RETRIEVED_AT,
    });

    // `source` must be the bare hostname — reputationScore matches on it, not the URL.
    expect(result.fields.rating).toEqual({
      value: 4.8,
      source: "yelp.com",
      sourceUrl: YELP_URL,
      retrievedAt: RETRIEVED_AT,
    });
    expect(result.fields.reviewCount).toEqual({
      value: 340,
      source: "yelp.com",
      sourceUrl: YELP_URL,
      retrievedAt: RETRIEVED_AT,
    });
  });

  it("returns the candidate unchanged when the analysis found no rating", () => {
    const input = candidate();

    const result = applyRatingFact({
      candidate: input,
      analysis: analysis({ rating: null, reviewCount: null, ratingSourceUrl: null }),
      suppliedUrls: [YELP_URL],
      retrievedAt: RETRIEVED_AT,
    });

    expect(result).toBe(input);
  });

  it("discards a rating whose ratingSourceUrl was not among the supplied pages", () => {
    const input = candidate();

    const result = applyRatingFact({
      candidate: input,
      analysis: analysis({ ratingSourceUrl: "https://www.yelp.com/biz/some-other-place" }),
      suppliedUrls: [YELP_URL, GOOGLE_URL],
      retrievedAt: RETRIEVED_AT,
    });

    expect(result).toBe(input);
  });

  it("discards a rating whose ratingSourceUrl is not a parseable URL", () => {
    const input = candidate();

    const result = applyRatingFact({
      candidate: input,
      analysis: analysis({ ratingSourceUrl: "yelp dot com" }),
      suppliedUrls: ["yelp dot com"],
      retrievedAt: RETRIEVED_AT,
    });

    expect(result).toBe(input);
  });

  it("overwrites a self-reported rating sourced from the provider's own domain", () => {
    const input = candidate({
      rating: fact(5, "bouncepalace.com", "https://www.bouncepalace.com/rentals"),
      reviewCount: fact(2, "bouncepalace.com", "https://www.bouncepalace.com/rentals"),
    });

    const result = applyRatingFact({
      candidate: input,
      analysis: analysis(),
      suppliedUrls: [YELP_URL],
      retrievedAt: RETRIEVED_AT,
    });

    expect(result.fields.rating?.value).toBe(4.8);
    expect(result.fields.rating?.source).toBe("yelp.com");
    expect(result.fields.reviewCount?.value).toBe(340);
  });

  it("treats a www/non-www mismatch as the provider's own domain", () => {
    const input = candidate({
      rating: fact(5, "bouncepalace.com", "https://bouncepalace.com/about"),
    });

    const result = applyRatingFact({
      candidate: input,
      analysis: analysis(),
      suppliedUrls: [YELP_URL],
      retrievedAt: RETRIEVED_AT,
    });

    expect(result.fields.rating?.source).toBe("yelp.com");
  });

  it("never displaces an already independently sourced rating", () => {
    const input = candidate({
      rating: fact(4.2, "google.com", GOOGLE_URL),
      reviewCount: fact(88, "google.com", GOOGLE_URL),
    });

    const result = applyRatingFact({
      candidate: input,
      analysis: analysis(),
      suppliedUrls: [YELP_URL],
      retrievedAt: RETRIEVED_AT,
    });

    expect(result).toBe(input);
    expect(result.fields.rating?.value).toBe(4.2);
  });

  it("drops a stale review count when the overwritten rating comes without one", () => {
    const input = candidate({
      rating: fact(5, "bouncepalace.com", PROVIDER_URL),
      reviewCount: fact(2, "bouncepalace.com", PROVIDER_URL),
    });

    const result = applyRatingFact({
      candidate: input,
      analysis: analysis({ reviewCount: null }),
      suppliedUrls: [YELP_URL],
      retrievedAt: RETRIEVED_AT,
    });

    expect(result.fields.rating?.value).toBe(4.8);
    // A new rating paired with an old page's count is exactly what
    // reputationScore rejects — better to have no count than a mismatched one.
    expect(result.fields.reviewCount).toBeUndefined();
  });

  it("does not mutate the input candidate", () => {
    const input = candidate({ name: fact("Bounce Palace", "bouncepalace.com", PROVIDER_URL) });
    const snapshot = JSON.parse(JSON.stringify(input));

    applyRatingFact({
      candidate: input,
      analysis: analysis(),
      suppliedUrls: [YELP_URL],
      retrievedAt: RETRIEVED_AT,
    });

    expect(input).toEqual(snapshot);
  });

  it("leaves other fields intact", () => {
    const nameFact = fact("Bounce Palace", "bouncepalace.com", PROVIDER_URL);

    const result = applyRatingFact({
      candidate: candidate({ name: nameFact }),
      analysis: analysis(),
      suppliedUrls: [YELP_URL],
      retrievedAt: RETRIEVED_AT,
    });

    expect(result.fields.name).toEqual(nameFact);
  });
});
