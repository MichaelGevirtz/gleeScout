import { describe, expect, it } from "vitest";
import { computeMockReputation, generateMockReputation } from "./mockReputationSignals.js";

const SEEDS = [
  "https://a.example",
  "https://b.example",
  "https://c.example:google",
  "https://c.example:yelp",
  "some-other-seed",
];

describe("generateMockReputation", () => {
  it("returns rating in [1, 5] and integer reviewCount in [10, 1000] for several seeds", () => {
    for (const seed of SEEDS) {
      const { rating, reviewCount } = generateMockReputation(seed);
      expect(rating).toBeGreaterThanOrEqual(1);
      expect(rating).toBeLessThanOrEqual(5);
      expect(reviewCount).toBeGreaterThanOrEqual(10);
      expect(reviewCount).toBeLessThanOrEqual(1000);
      expect(Number.isInteger(reviewCount)).toBe(true);
    }
  });

  it("is deterministic for the same seed", () => {
    for (const seed of SEEDS) {
      expect(generateMockReputation(seed)).toEqual(generateMockReputation(seed));
    }
  });

  it("returns different values for different seeds", () => {
    const results = SEEDS.map((seed) => generateMockReputation(seed));
    const unique = new Set(results.map((r) => `${r.rating}:${r.reviewCount}`));
    expect(unique.size).toBeGreaterThan(1);
  });
});

describe("computeMockReputation", () => {
  it("returns the average of the google-seeded and yelp-seeded results, correctly rounded", () => {
    for (const url of ["https://a.example", "https://b.example"]) {
      const google = generateMockReputation(`${url}:google`);
      const yelp = generateMockReputation(`${url}:yelp`);
      const expectedRating = Math.round(((google.rating + yelp.rating) / 2) * 10) / 10;
      const expectedReviewCount = Math.round((google.reviewCount + yelp.reviewCount) / 2);

      const result = computeMockReputation(url);

      expect(result.reputationRating).toBeCloseTo(expectedRating, 5);
      expect(result.reputationReviewCount).toBe(expectedReviewCount);
    }
  });

  it("uses independent seeds for the two sources (not the same value doubled)", () => {
    const urls = ["https://a.example", "https://b.example", "https://c.example"];
    for (const url of urls) {
      const google = generateMockReputation(`${url}:google`);
      const yelp = generateMockReputation(`${url}:yelp`);
      expect(google).not.toEqual(yelp);
    }
  });

  it("is deterministic for the same url", () => {
    const url = "https://a.example";
    expect(computeMockReputation(url)).toEqual(computeMockReputation(url));
  });
});
