import type { RankingDimension } from "./types.js";

export const DIMENSION_WEIGHTS: Record<RankingDimension, number> = {
  requirementMatch: 0.2,
  geoFit: 0.2,
  priceFit: 0.2,
  reputation: 0.2,
  evidenceQuality: 0.2,
};

export const MIN_MEANINGFUL_DIMENSIONS = 2;

export function computeAggregateScore(dimensionScores: Record<RankingDimension, number | null>): number {
  const nonNullCount = Object.values(dimensionScores).filter((score) => score !== null).length;

  if (nonNullCount < MIN_MEANINGFUL_DIMENSIONS) {
    return 0;
  }

  let totalWeightedScore = 0;
  let totalWeightUsed = 0;

  for (const [dimension, weight] of Object.entries(DIMENSION_WEIGHTS) as [RankingDimension, number][]) {
    const score = dimensionScores[dimension];
    if (score !== null) {
      totalWeightedScore += weight * score;
      totalWeightUsed += weight;
    }
  }

  return totalWeightedScore / totalWeightUsed;
}
