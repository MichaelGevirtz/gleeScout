import type { ProviderCandidate } from "../domain/provider.js";
import { computeAggregateScore } from "./aggregateScore.js";
import { buildRankingExplanation } from "./explanation.js";
import { computeFitScore, deriveMatchGrade } from "./fitScore.js";
import { geoFitScore, priceFitScore, requirementMatchScore } from "./matchAndFitScores.js";
import { evidenceQualityScore, reputationScore } from "./reputationAndEvidenceScores.js";
import type { ProviderScore, RankingDimension, RankingRequirements } from "./types.js";

export const MAX_RANKED_RESULTS = 5;

export function rankProviders({
  candidates,
  requirements,
}: {
  candidates: ProviderCandidate[];
  requirements: RankingRequirements;
}): ProviderScore[] {
  const scored = candidates.map((candidate) => {
    const dimensionScores: Record<RankingDimension, number | null> = {
      requirementMatch: requirementMatchScore(candidate, requirements),
      geoFit: geoFitScore(candidate, requirements),
      priceFit: priceFitScore(candidate, requirements),
      reputation: reputationScore(candidate),
      evidenceQuality: evidenceQualityScore(candidate),
    };

    const fitScore = computeFitScore(dimensionScores);

    return {
      candidate,
      score: computeAggregateScore(dimensionScores),
      dimensionScores,
      explanation: buildRankingExplanation(candidate, dimensionScores),
      fitScore,
      matchGrade: deriveMatchGrade(fitScore),
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, MAX_RANKED_RESULTS);
}
