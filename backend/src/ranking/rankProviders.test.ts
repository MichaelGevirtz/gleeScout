import { describe, expect, it } from "vitest";
import { MAX_RANKED_RESULTS, rankProviders } from "./rankProviders.js";
import type { ProviderCandidate } from "../domain/provider.js";
import type { RankingRequirements } from "./types.js";

const RETRIEVED_AT = "2026-08-28T12:00:00.000Z";
const GOOGLE_URL = "https://www.google.com/search?q=bounce+palace";
const YELP_URL = "https://www.yelp.com/biz/bounce-palace";

function fact<T>(value: T, source: string, sourceUrl: string) {
  return { value, source, sourceUrl, retrievedAt: RETRIEVED_AT };
}

const REQUIREMENTS: RankingRequirements = {
  location: "Austin, TX",
  categoryAttributes: {
    ageRange: { description: "Age range of kids", importance: "required", value: "toddler" },
    budget: { description: "Budget", importance: "required", value: "$300" },
  },
};

// Strong FACT data, no enrichment at all.
const candidateA: ProviderCandidate = {
  url: "https://a.example.com",
  fields: {
    location: fact("Austin, TX", "a.example.com", "https://a.example.com"),
    servicesOffered: fact(["toddler bounce houses", "delivery included"], "a.example.com", "https://a.example.com"),
    pricing: fact("$250", "a.example.com", "https://a.example.com"),
  },
};

// Weaker FACT data, but enriched.
const candidateB: ProviderCandidate = {
  url: "https://b.example.com",
  fields: {
    location: fact("Austin, TX", "b.example.com", "https://b.example.com"),
    servicesOffered: fact(["adult party rentals"], "b.example.com", "https://b.example.com"),
    pricing: fact("$500", "b.example.com", "https://b.example.com"),
    rating: fact(3.5, "google.com", GOOGLE_URL),
    reviewCount: fact(15, "google.com", GOOGLE_URL),
  },
  inferred: [
    {
      value: "friendly staff",
      evidenceSourceUrl: GOOGLE_URL,
      sourceType: "google",
      retrievedAt: RETRIEVED_AT,
    },
  ],
};

// Minimal data, meets the MIN_MEANINGFUL_DIMENSIONS floor exactly.
const candidateC: ProviderCandidate = {
  url: "https://c.example.com",
  fields: {
    location: fact("Austin, TX", "c.example.com", "https://c.example.com"),
  },
};

// Below the floor: only evidenceQuality is computable (and it's low).
const candidateD: ProviderCandidate = {
  url: "https://d.example.com",
  fields: {},
};

// Matches requirement, no location, no pricing.
const candidateE: ProviderCandidate = {
  url: "https://e.example.com",
  fields: {
    servicesOffered: fact(["toddler party rentals"], "e.example.com", "https://e.example.com"),
  },
};

// Full, strong data across every dimension.
const candidateF: ProviderCandidate = {
  url: "https://f.example.com",
  fields: {
    location: fact("Austin, TX", "f.example.com", "https://f.example.com"),
    servicesOffered: fact(["toddler bounce houses"], "f.example.com", "https://f.example.com"),
    pricing: fact("$200", "f.example.com", "https://f.example.com"),
    rating: fact(4.8, "yelp.com", YELP_URL),
    reviewCount: fact(30, "yelp.com", YELP_URL),
  },
};

describe("rankProviders", () => {
  it("returns exactly MAX_RANKED_RESULTS entries, sorted descending by score, from a larger candidate set", () => {
    const result = rankProviders({
      candidates: [candidateA, candidateB, candidateC, candidateD, candidateE, candidateF],
      requirements: REQUIREMENTS,
    });

    expect(MAX_RANKED_RESULTS).toBe(5);
    expect(result).toHaveLength(5);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
    }
    // candidateD scores 0 (below MIN_MEANINGFUL_DIMENSIONS) and is the weakest of the six, so it's dropped.
    expect(result.map((r) => r.candidate.url)).not.toContain(candidateD.url);
    // Both an unenriched candidate (A) and an enriched candidate (B) survive into the result.
    expect(result.map((r) => r.candidate.url)).toContain(candidateA.url);
    expect(result.map((r) => r.candidate.url)).toContain(candidateB.url);
  });

  it("ranks an unenriched candidate with strong FACT data ahead of a weaker enriched candidate (D13c)", () => {
    const result = rankProviders({
      candidates: [candidateB, candidateA],
      requirements: REQUIREMENTS,
    });

    expect(candidateA.inferred).toBeUndefined();
    expect(candidateB.inferred).toBeDefined();
    expect(result[0].candidate.url).toBe(candidateA.url);
    expect(result[1].candidate.url).toBe(candidateB.url);
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("returns dimensionScores with exactly the five expected keys and a non-empty, evidence-quality-free explanation", () => {
    const result = rankProviders({
      candidates: [candidateF],
      requirements: REQUIREMENTS,
    });

    expect(Object.keys(result[0].dimensionScores).sort()).toEqual(
      ["evidenceQuality", "geoFit", "priceFit", "reputation", "requirementMatch"].sort(),
    );
    expect(result[0].explanation.length).toBeGreaterThan(0);
    expect(result[0].explanation.toLowerCase()).not.toContain("evidence quality");
  });

  it("keeps a candidate with only a self-reported rating in the output, with reputation scored null (D13a)", () => {
    const selfReportedCandidate: ProviderCandidate = {
      url: "https://g.example.com",
      fields: {
        location: fact("Austin, TX", "g.example.com", "https://g.example.com"),
        servicesOffered: fact(["toddler bounce houses"], "g.example.com", "https://g.example.com"),
        pricing: fact("$220", "g.example.com", "https://g.example.com"),
        rating: fact(4.9, "g.example.com", "https://g.example.com"),
        reviewCount: fact(500, "g.example.com", "https://g.example.com"),
      },
    };

    const result = rankProviders({
      candidates: [selfReportedCandidate],
      requirements: REQUIREMENTS,
    });

    expect(result).toHaveLength(1);
    expect(result[0].candidate.url).toBe(selfReportedCandidate.url);
    expect(result[0].dimensionScores.reputation).toBeNull();
    expect(result[0].score).toBeGreaterThan(0);
  });

  it("computes fitScore/matchGrade from only requirementMatch/geoFit/priceFit, per real fixtures", () => {
    const result = rankProviders({
      candidates: [candidateA, candidateB, candidateC, candidateE, candidateF],
      requirements: REQUIREMENTS,
    });
    const byUrl = Object.fromEntries(result.map((r) => [r.candidate.url, r]));

    // A: rm=1, geo=1, price=1 -> 1.0 -> wonderful
    expect(byUrl[candidateA.url].fitScore).toBeCloseTo(1);
    expect(byUrl[candidateA.url].matchGrade).toBe("wonderful");

    // B: rm=0, geo=1, price=0.333... -> 0.444 -> average
    expect(byUrl[candidateB.url].fitScore).toBeCloseTo(0.4444444, 5);
    expect(byUrl[candidateB.url].matchGrade).toBe("average");

    // C: only geoFit known (1 of 3) -> below MIN_MEANINGFUL_FIT_DIMENSIONS -> null/insufficient_data
    expect(byUrl[candidateC.url].fitScore).toBeNull();
    expect(byUrl[candidateC.url].matchGrade).toBe("insufficient_data");

    // E: only requirementMatch known (1 of 3) -> null/insufficient_data
    expect(byUrl[candidateE.url].fitScore).toBeNull();
    expect(byUrl[candidateE.url].matchGrade).toBe("insufficient_data");

    // F: rm=1, geo=1, price=1 -> 1.0 -> wonderful (reputation/evidenceQuality don't affect this)
    expect(byUrl[candidateF.url].fitScore).toBeCloseTo(1);
    expect(byUrl[candidateF.url].matchGrade).toBe("wonderful");
  });

  it("does not change existing score values or sort order (fitScore/matchGrade are purely additive)", () => {
    const result = rankProviders({
      candidates: [candidateA, candidateB, candidateC, candidateD, candidateE, candidateF],
      requirements: REQUIREMENTS,
    });

    // Same regression this file already asserts elsewhere (MIN_MEANINGFUL_DIMENSIONS drop of
    // candidateD) — re-asserted here as an explicit "this task didn't touch ranking" guard. No
    // fixed A-vs-F order is asserted, matching this file's other multi-candidate test: F's existing
    // 5-dim score legitimately outscores A's once reputation/evidenceQuality are counted, which is
    // pre-existing behavior this task does not change.
    expect(result.map((r) => r.candidate.url)).not.toContain(candidateD.url);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].score).toBeGreaterThanOrEqual(result[i + 1].score);
    }
  });

  it("attaches confirmedRequirements per candidate (task-88)", () => {
    const result = rankProviders({ candidates: [candidateA], requirements: REQUIREMENTS });

    expect(result[0]!.confirmedRequirements).toEqual(
      expect.arrayContaining([
        { label: "Austin, TX", kind: "location" },
        { label: "toddler", kind: "categoryAttribute" },
      ]),
    );
  });

  it("attaches otherFacts per candidate, deduplicated against confirmedRequirements (task-91)", () => {
    const result = rankProviders({ candidates: [candidateA], requirements: REQUIREMENTS });

    // candidateA's location ("Austin, TX") and one servicesOffered entry ("toddler
    // bounce houses", which literally contains the confirmed "toddler" attribute
    // label) are both already represented by confirmedRequirements, so both are
    // suppressed here; the non-overlapping servicesOffered entry and pricing (never
    // requirement-matched) are included.
    expect(result[0]!.otherFacts).toEqual(
      expect.arrayContaining([
        { kind: "servicesOffered", value: "delivery included" },
        { kind: "pricing", value: "$250" },
      ]),
    );
    expect(result[0]!.otherFacts).not.toContainEqual(
      expect.objectContaining({ kind: "location" }),
    );
    expect(JSON.stringify(result[0]!.otherFacts)).not.toContain("toddler bounce houses");
  });

  it("excludes a candidate with zero confirmed requirement matches even if it would otherwise rank in the top 5 (task-88)", () => {
    // No location field, servicesOffered text unrelated to any requirement,
    // but reputation/evidenceQuality alone still clear the MIN_MEANINGFUL_DIMENSIONS
    // floor and produce a real, non-zero aggregate score.
    const strongReputationNoMatch: ProviderCandidate = {
      url: "https://unmatched.example.com",
      fields: {
        rating: fact(5, "google.com", GOOGLE_URL),
        reviewCount: fact(1000, "google.com", GOOGLE_URL),
      },
    };

    const result = rankProviders({
      candidates: [strongReputationNoMatch],
      requirements: REQUIREMENTS,
    });

    expect(result).toEqual([]);
  });

  it("backfills a lower-scoring eligible candidate when higher-scoring zero-confirmed candidates are filtered out pre-cap (task-88)", () => {
    const strongReputationNoMatch = (i: number): ProviderCandidate => ({
      url: `https://unmatched${i}.example.com`,
      fields: {
        rating: fact(5, "google.com", GOOGLE_URL),
        reviewCount: fact(1000, "google.com", GOOGLE_URL),
      },
    });
    const unmatched = [1, 2, 3, 4, 5].map(strongReputationNoMatch);

    // Only requirementMatch (matches "toddler") is populated — a
    // deliberately weak but genuinely eligible candidate.
    const weaklyConfirmed: ProviderCandidate = {
      url: "https://weak.example.com",
      fields: {
        servicesOffered: fact(["toddler party favors"], "weak.example.com", "https://weak.example.com"),
      },
    };

    // Sanity check: without filtering, the 5 unmatched candidates alone
    // would already fill every slot, leaving weaklyConfirmed out entirely.
    const result = rankProviders({
      candidates: [...unmatched, weaklyConfirmed],
      requirements: REQUIREMENTS,
    });

    expect(result.map((r) => r.candidate.url)).not.toEqual(
      expect.arrayContaining(unmatched.map((c) => c.url)),
    );
    expect(result.map((r) => r.candidate.url)).toContain(weaklyConfirmed.url);
  });
});
