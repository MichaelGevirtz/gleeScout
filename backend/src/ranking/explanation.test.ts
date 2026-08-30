import { describe, expect, it } from "vitest";
import { buildRankingExplanation } from "./explanation.js";
import type { ProviderCandidate } from "../domain/provider.js";
import type { RankingDimension } from "./types.js";

const RETRIEVED_AT = "2026-08-28T12:00:00.000Z";
const GOOGLE_URL = "https://www.google.com/search?q=bounce+palace";

function fact<T>(value: T, source: string, sourceUrl: string) {
  return { value, source, sourceUrl, retrievedAt: RETRIEVED_AT };
}

function candidateWith(fields: Partial<ProviderCandidate["fields"]>): ProviderCandidate {
  return {
    url: "https://www.bouncepalace.com",
    fields,
  };
}

const ALL_NULL_SCORES: Record<RankingDimension, number | null> = {
  requirementMatch: null,
  geoFit: null,
  priceFit: null,
  reputation: null,
  evidenceQuality: null,
};

describe("buildRankingExplanation", () => {
  it("mentions geo fit, price fit, and reputation when populated, never a requirement-match clause", () => {
    const candidate = candidateWith({
      pricing: fact("$250", "bouncepalace.com", "https://www.bouncepalace.com"),
      rating: fact(4.8, "google.com", GOOGLE_URL),
      reviewCount: fact(230, "google.com", GOOGLE_URL),
    });

    const explanation = buildRankingExplanation(candidate, {
      requirementMatch: 0.8,
      geoFit: 1,
      priceFit: 1,
      reputation: 0.9,
      evidenceQuality: 0.7,
    });

    expect(explanation).not.toContain("match for your requirements");
    expect(explanation).toContain("serves your area");
    expect(explanation).toContain("within your stated budget");
    expect(explanation).toContain("4.8★ from 230 independently-sourced reviews");
    expect(explanation.toLowerCase()).not.toContain("evidence quality");
  });

  it("never mentions a requirement-match clause, regardless of that dimension's score", () => {
    const candidate = candidateWith({
      pricing: fact("$250", "bouncepalace.com", "https://www.bouncepalace.com"),
      rating: fact(4.8, "google.com", GOOGLE_URL),
      reviewCount: fact(230, "google.com", GOOGLE_URL),
    });

    for (const requirementMatch of [0.8, 0, null]) {
      const explanation = buildRankingExplanation(candidate, {
        requirementMatch,
        geoFit: 1,
        priceFit: 1,
        reputation: 0.9,
        evidenceQuality: 0.7,
      });

      expect(explanation).not.toContain("match for your requirements");
      expect(explanation).toContain("serves your area");
      expect(explanation).toContain("within your stated budget");
      expect(explanation).toContain("4.8★ from 230 independently-sourced reviews");
    }
  });

  it("omits any clause when geoFit is 0, never asserting a negative", () => {
    const candidate = candidateWith({});

    const explanation = buildRankingExplanation(candidate, {
      requirementMatch: 0.5,
      geoFit: 0,
      priceFit: null,
      reputation: null,
      evidenceQuality: 0.4,
    });

    expect(explanation.toLowerCase()).not.toContain("does not serve");
    expect(explanation.toLowerCase()).not.toContain("area");
  });

  it("omits the reputation clause when reputation is null, even if rating is populated", () => {
    const candidate = candidateWith({
      rating: fact(4.8, "bouncepalace.com", "https://www.bouncepalace.com"),
    });

    const explanation = buildRankingExplanation(candidate, {
      requirementMatch: 0.5,
      geoFit: 1,
      priceFit: null,
      reputation: null,
      evidenceQuality: 0.4,
    });

    expect(explanation).not.toContain("★");
    expect(explanation).not.toContain("reviews");
  });

  it("returns the fixed fallback string, not an empty string, when all five dimensions are null", () => {
    const candidate = candidateWith({});

    const explanation = buildRankingExplanation(candidate, ALL_NULL_SCORES);

    expect(explanation).toBe("Limited information available for this provider.");
    expect(explanation.length).toBeGreaterThan(0);
  });

  it("never mentions evidence quality literally, regardless of that dimension's score", () => {
    const candidate = candidateWith({
      pricing: fact("$250", "bouncepalace.com", "https://www.bouncepalace.com"),
      rating: fact(4.8, "google.com", GOOGLE_URL),
      reviewCount: fact(230, "google.com", GOOGLE_URL),
    });

    const explanation = buildRankingExplanation(candidate, {
      requirementMatch: 0.8,
      geoFit: 1,
      priceFit: 1,
      reputation: 0.9,
      evidenceQuality: 1,
    });

    expect(explanation.toLowerCase()).not.toContain("evidence");
    expect(explanation.toLowerCase()).not.toContain("evidencequality");
  });
});
