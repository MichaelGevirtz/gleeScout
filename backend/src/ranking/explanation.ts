import type { ProviderCandidate } from "../domain/provider.js";
import type { RankingDimension } from "./types.js";

const FALLBACK_EXPLANATION = "Limited information available for this provider.";

function requirementMatchClause(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 0.7) return "strong match for your requirements";
  if (score > 0) return "partial match for your requirements";
  return "limited match for your requirements";
}

function geoFitClause(score: number | null): string | null {
  if (score === 1) return "serves your area";
  return null;
}

function priceFitClause(score: number | null, candidate: ProviderCandidate): string | null {
  if (score === null) return null;
  const pricing = candidate.fields.pricing;
  if (!pricing) return null;
  return score === 1
    ? `within your stated budget (${pricing.value})`
    : `above your stated budget (${pricing.value})`;
}

function reputationClause(score: number | null, candidate: ProviderCandidate): string | null {
  if (score === null) return null;
  const { rating, reviewCount } = candidate.fields;
  if (!rating || !reviewCount) return null;
  return `${rating.value}★ from ${reviewCount.value} independently-sourced reviews`;
}

export function buildRankingExplanation(
  candidate: ProviderCandidate,
  dimensionScores: Record<RankingDimension, number | null>,
): string {
  const clauses = [
    requirementMatchClause(dimensionScores.requirementMatch),
    geoFitClause(dimensionScores.geoFit),
    priceFitClause(dimensionScores.priceFit, candidate),
    reputationClause(dimensionScores.reputation, candidate),
  ].filter((clause): clause is string => clause !== null);

  if (clauses.length === 0) {
    return FALLBACK_EXPLANATION;
  }

  return clauses.join("; ") + ".";
}
