import type { MatchGrade, RankingDimension } from "./types.js";

// fitScore answers "how well does this provider fit the user's stated
// requirements" — deliberately excludes reputation (provider quality,
// not a stated requirement) and evidenceQuality (FACT-coverage, not a
// fit signal). Those two stay part of the existing 5-dimension
// aggregate `score` that drives ranking order, unaffected by this file.
export const FIT_DIMENSIONS: RankingDimension[] = ["requirementMatch", "geoFit", "priceFit"];

// Below this many known fit dimensions, a single known value would
// otherwise stand in for the whole score (e.g. only geoFit known ->
// fitScore = 1.0, a misleadingly "Wonderful" result from one lucky
// dimension). Confirmed against real fixture evidence during planning.
export const MIN_MEANINGFUL_FIT_DIMENSIONS = 2;

// Fixed cutoffs on the 0-1 fitScore. Existing test fixtures only
// produce two post-floor values (1.0, 0.44), which validates that the
// floor is necessary and that a full match lands in the top bucket,
// but does not empirically validate the 0.5/0.25 boundaries
// specifically — those are an explicit, documented heuristic/product
// decision, not a data-calibrated threshold (same status as this
// project's equal ranking-dimension weights, D13f in decisions.md).
export const GRADE_THRESHOLDS = {
  wonderful: 0.75,
  good: 0.5,
  average: 0.25,
} as const;

export function computeFitScore(dimensionScores: Record<RankingDimension, number | null>): number | null {
  const known = FIT_DIMENSIONS.map((dimension) => dimensionScores[dimension]).filter(
    (score): score is number => score !== null,
  );

  if (known.length < MIN_MEANINGFUL_FIT_DIMENSIONS) {
    return null;
  }

  return known.reduce((sum, score) => sum + score, 0) / known.length;
}

export function deriveMatchGrade(fitScore: number | null): MatchGrade {
  if (fitScore === null) {
    return "insufficient_data";
  }
  if (fitScore >= GRADE_THRESHOLDS.wonderful) {
    return "wonderful";
  }
  if (fitScore >= GRADE_THRESHOLDS.good) {
    return "good";
  }
  if (fitScore >= GRADE_THRESHOLDS.average) {
    return "average";
  }
  return "poor";
}
