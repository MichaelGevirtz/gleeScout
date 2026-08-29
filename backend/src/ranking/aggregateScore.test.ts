import { describe, expect, it } from "vitest";
import { computeAggregateScore, DIMENSION_WEIGHTS, MIN_MEANINGFUL_DIMENSIONS } from "./aggregateScore.js";
import type { RankingDimension } from "./types.js";

describe("DIMENSION_WEIGHTS", () => {
  it("has exactly the five expected keys, each equal to 0.2, summing to 1", () => {
    const expectedKeys: RankingDimension[] = [
      "requirementMatch",
      "geoFit",
      "priceFit",
      "reputation",
      "evidenceQuality",
    ];
    expect(Object.keys(DIMENSION_WEIGHTS).sort()).toEqual([...expectedKeys].sort());
    for (const key of expectedKeys) {
      expect(DIMENSION_WEIGHTS[key]).toBe(0.2);
    }
    const sum = Object.values(DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe("MIN_MEANINGFUL_DIMENSIONS", () => {
  it("is exported and equals 2", () => {
    expect(MIN_MEANINGFUL_DIMENSIONS).toBe(2);
  });
});

describe("computeAggregateScore", () => {
  it("returns the same value when all five dimensions are non-null and equal", () => {
    const result = computeAggregateScore({
      requirementMatch: 0.8,
      geoFit: 0.8,
      priceFit: 0.8,
      reputation: 0.8,
      evidenceQuality: 0.8,
    });
    expect(result).toBeCloseTo(0.8, 10);
  });

  it("returns the plain average when all five dimensions are non-null with mixed scores", () => {
    const result = computeAggregateScore({
      requirementMatch: 1,
      geoFit: 0.5,
      priceFit: 0,
      reputation: 0.75,
      evidenceQuality: 0.25,
    });
    const expected = (1 + 0.5 + 0 + 0.75 + 0.25) / 5;
    expect(result).toBeCloseTo(expected, 10);
  });

  it("renormalizes correctly when one dimension is null and four are non-null", () => {
    const result = computeAggregateScore({
      requirementMatch: 1,
      geoFit: 0.5,
      priceFit: null,
      reputation: 0.75,
      evidenceQuality: 0.25,
    });
    // Equal weights (0.2 each) -> renormalized average of the four non-null scores.
    const expected = (1 + 0.5 + 0.75 + 0.25) / 4;
    expect(result).toBeCloseTo(expected, 10);
  });

  it("runs the normal renormalized computation when exactly two dimensions are non-null (floor is < not <=)", () => {
    const result = computeAggregateScore({
      requirementMatch: 1,
      geoFit: null,
      priceFit: null,
      reputation: null,
      evidenceQuality: 0.5,
    });
    const expected = (1 + 0.5) / 2;
    expect(result).toBeCloseTo(expected, 10);
  });

  it("returns 0 when only evidenceQuality is non-null, regardless of its score", () => {
    const result = computeAggregateScore({
      requirementMatch: null,
      geoFit: null,
      priceFit: null,
      reputation: null,
      evidenceQuality: 1,
    });
    expect(result).toBe(0);
  });

  it("returns 0 without throwing when all five dimensions are null", () => {
    const result = computeAggregateScore({
      requirementMatch: null,
      geoFit: null,
      priceFit: null,
      reputation: null,
      evidenceQuality: null,
    });
    expect(result).toBe(0);
  });
});
