import type { ProviderCandidate } from "../domain/provider.js";
import { computeAggregateScore } from "./aggregateScore.js";
import { deriveConfirmedRequirements } from "./confirmedRequirements.js";
import { buildRankingExplanation } from "./explanation.js";
import { computeFitScore, deriveMatchGrade } from "./fitScore.js";
import { geoFitScore, priceFitScore, requirementMatchScore } from "./matchAndFitScores.js";
import { deriveOtherProviderFacts } from "./otherProviderFacts.js";
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
    const confirmedRequirements = deriveConfirmedRequirements(candidate, requirements);

    return {
      candidate,
      score: computeAggregateScore(dimensionScores),
      dimensionScores,
      explanation: buildRankingExplanation(candidate, dimensionScores),
      fitScore,
      matchGrade: deriveMatchGrade(fitScore),
      confirmedRequirements,
      otherFacts: deriveOtherProviderFacts(candidate, confirmedRequirements),
    };
  });

  // Filtered before the cap (not after) so a lower-scoring candidate that
  // genuinely confirms a requirement can backfill a slot vacated by a
  // higher-scoring candidate whose score came entirely from
  // reputation/evidenceQuality with zero confirmed requirement matches.
  return scored
    .filter((p) => p.confirmedRequirements.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RANKED_RESULTS);
}
