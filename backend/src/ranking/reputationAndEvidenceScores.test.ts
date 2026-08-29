import { describe, expect, it } from "vitest";
import {
  evidenceQualityScore,
  reputationScore,
  REVIEW_COUNT_CONFIDENCE_CAP,
} from "./reputationAndEvidenceScores.js";
import type { ProviderCandidate } from "../domain/provider.js";

const RETRIEVED_AT = "2026-08-28T12:00:00.000Z";
const GOOGLE_URL = "https://www.google.com/search?q=bounce+palace";
const YELP_URL = "https://www.yelp.com/biz/bounce-palace";
const PROVIDER_SITE_URL = "https://www.bouncepalace.com/reviews";

function fact<T>(value: T, source: string, sourceUrl: string) {
  return { value, source, sourceUrl, retrievedAt: RETRIEVED_AT };
}

function candidateWith(fields: Partial<ProviderCandidate["fields"]>): ProviderCandidate {
  return {
    url: "https://www.bouncepalace.com",
    fields,
  };
}

describe("reputationScore", () => {
  it("scores a rating and review count both sourced from the same google.com page", () => {
    const candidate = candidateWith({
      rating: fact(4.5, "google.com", GOOGLE_URL),
      reviewCount: fact(50, "google.com", GOOGLE_URL),
    });

    expect(reputationScore(candidate)).toBe((4.5 / 5) * 1);
  });

  it("returns null when the shared source is the provider's own domain", () => {
    const candidate = candidateWith({
      rating: fact(4.5, "bouncepalace.com", PROVIDER_SITE_URL),
      reviewCount: fact(50, "bouncepalace.com", PROVIDER_SITE_URL),
    });

    expect(reputationScore(candidate)).toBeNull();
  });

  it("returns null when rating and reviewCount come from different sourceUrls, even if each hostname is independently trustworthy", () => {
    const candidate = candidateWith({
      rating: fact(4.5, "google.com", GOOGLE_URL),
      reviewCount: fact(50, "yelp.com", YELP_URL),
    });

    expect(reputationScore(candidate)).toBeNull();
  });

  it("returns null when rating is absent", () => {
    const candidate = candidateWith({
      reviewCount: fact(50, "google.com", GOOGLE_URL),
    });

    expect(reputationScore(candidate)).toBeNull();
  });

  it("returns null when reviewCount is absent", () => {
    const candidate = candidateWith({
      rating: fact(4.5, "google.com", GOOGLE_URL),
    });

    expect(reputationScore(candidate)).toBeNull();
  });

  it("caps confidence at 1 for a review count at or above the cap", () => {
    const atCap = candidateWith({
      rating: fact(4.0, "google.com", GOOGLE_URL),
      reviewCount: fact(REVIEW_COUNT_CONFIDENCE_CAP, "google.com", GOOGLE_URL),
    });
    const wellAboveCap = candidateWith({
      rating: fact(4.0, "google.com", GOOGLE_URL),
      reviewCount: fact(500, "google.com", GOOGLE_URL),
    });

    expect(reputationScore(atCap)).toBe(reputationScore(wellAboveCap));
  });

  it("scores a low review count lower than a high review count at the same rating", () => {
    const low = candidateWith({
      rating: fact(4.0, "google.com", GOOGLE_URL),
      reviewCount: fact(2, "google.com", GOOGLE_URL),
    });
    const high = candidateWith({
      rating: fact(4.0, "google.com", GOOGLE_URL),
      reviewCount: fact(200, "google.com", GOOGLE_URL),
    });

    expect(reputationScore(low)!).toBeLessThan(reputationScore(high)!);
  });
});

describe("evidenceQualityScore", () => {
  it("returns 1 when all 10 fields are populated", () => {
    const candidate = candidateWith({
      name: fact("Bounce Palace", "bouncepalace.com", PROVIDER_SITE_URL),
      location: fact("Austin, TX", "bouncepalace.com", PROVIDER_SITE_URL),
      servicesOffered: fact(["bounce house"], "bouncepalace.com", PROVIDER_SITE_URL),
      pricing: fact("$200/day", "bouncepalace.com", PROVIDER_SITE_URL),
      availability: fact("weekends", "bouncepalace.com", PROVIDER_SITE_URL),
      rating: fact(4.5, "google.com", GOOGLE_URL),
      reviewCount: fact(50, "google.com", GOOGLE_URL),
      photos: fact(["https://example.com/photo.jpg"], "bouncepalace.com", PROVIDER_SITE_URL),
      policies: fact("no refunds", "bouncepalace.com", PROVIDER_SITE_URL),
      contactMethod: fact("email", "bouncepalace.com", PROVIDER_SITE_URL),
    });

    expect(evidenceQualityScore(candidate)).toBe(1);
  });

  it("returns 0.1 when only 1 of 10 fields is populated", () => {
    const candidate = candidateWith({
      name: fact("Bounce Palace", "bouncepalace.com", PROVIDER_SITE_URL),
    });

    expect(evidenceQualityScore(candidate)).toBeCloseTo(0.1);
  });

  it("is unaffected by candidate.inferred being present vs. absent", () => {
    const fields = {
      name: fact("Bounce Palace", "bouncepalace.com", PROVIDER_SITE_URL),
    };
    const withoutInferred: ProviderCandidate = { url: "https://www.bouncepalace.com", fields };
    const withInferred: ProviderCandidate = {
      url: "https://www.bouncepalace.com",
      fields,
      inferred: [
        {
          value: "good with toddlers",
          evidenceSourceUrl: YELP_URL,
          sourceType: "yelp",
          retrievedAt: RETRIEVED_AT,
        },
      ],
    };

    expect(evidenceQualityScore(withInferred)).toBe(evidenceQualityScore(withoutInferred));
  });
});
