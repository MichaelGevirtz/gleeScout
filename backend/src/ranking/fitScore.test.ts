import { describe, expect, it } from "vitest";
import { computeFitScore, deriveMatchGrade, GRADE_THRESHOLDS, MIN_MEANINGFUL_FIT_DIMENSIONS } from "./fitScore.js";
import type { RankingDimension } from "./types.js";

function dims(
  overrides: Partial<Record<RankingDimension, number | null>>,
): Record<RankingDimension, number | null> {
  return {
    requirementMatch: null,
    geoFit: null,
    priceFit: null,
    reputation: null,
    evidenceQuality: null,
    ...overrides,
  };
}

describe("computeFitScore", () => {
  it("returns null when 0 of the 3 fit dimensions are known", () => {
    expect(computeFitScore(dims({}))).toBeNull();
  });

  it("returns null when only 1 of the 3 fit dimensions is known (below the floor)", () => {
    expect(computeFitScore(dims({ geoFit: 1 }))).toBeNull();
    expect(computeFitScore(dims({ requirementMatch: 1 }))).toBeNull();
  });

  it("computes the mean when exactly 2 of the 3 fit dimensions are known", () => {
    expect(computeFitScore(dims({ requirementMatch: 1, geoFit: 0 }))).toBeCloseTo(0.5);
  });

  it("computes the mean when all 3 fit dimensions are known", () => {
    expect(computeFitScore(dims({ requirementMatch: 0, geoFit: 1, priceFit: 0.333333333 }))).toBeCloseTo(
      0.4444444,
      5,
    );
  });

  it("ignores reputation and evidenceQuality entirely, even when present", () => {
    const withQuality = computeFitScore(
      dims({ requirementMatch: 1, geoFit: 1, reputation: 0, evidenceQuality: 0 }),
    );
    const withoutQuality = computeFitScore(dims({ requirementMatch: 1, geoFit: 1 }));
    expect(withQuality).toBe(withoutQuality);
  });

  it("MIN_MEANINGFUL_FIT_DIMENSIONS is 2", () => {
    expect(MIN_MEANINGFUL_FIT_DIMENSIONS).toBe(2);
  });
});

describe("deriveMatchGrade", () => {
  it("maps null to insufficient_data, never poor", () => {
    expect(deriveMatchGrade(null)).toBe("insufficient_data");
  });

  it("maps >= wonderful threshold to wonderful", () => {
    expect(deriveMatchGrade(GRADE_THRESHOLDS.wonderful)).toBe("wonderful");
    expect(deriveMatchGrade(1)).toBe("wonderful");
  });

  it("maps >= good threshold (and below wonderful) to good", () => {
    expect(deriveMatchGrade(GRADE_THRESHOLDS.good)).toBe("good");
    expect(deriveMatchGrade(0.6)).toBe("good");
  });

  it("maps >= average threshold (and below good) to average", () => {
    expect(deriveMatchGrade(GRADE_THRESHOLDS.average)).toBe("average");
    expect(deriveMatchGrade(0.3)).toBe("average");
  });

  it("maps below average threshold to poor", () => {
    expect(deriveMatchGrade(0)).toBe("poor");
    expect(deriveMatchGrade(0.1)).toBe("poor");
  });
});
