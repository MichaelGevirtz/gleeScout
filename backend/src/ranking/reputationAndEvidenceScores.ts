import { ProviderCandidateFieldsSchema, type ProviderCandidate } from "../domain/provider.js";
import { isIndependentReviewSource } from "../shared/reviewDomains.js";

export const REVIEW_COUNT_CONFIDENCE_CAP = 20;

export function reputationScore(candidate: ProviderCandidate): number | null {
  const { rating, reviewCount } = candidate.fields;
  if (!rating || !reviewCount) return null;

  if (rating.sourceUrl !== reviewCount.sourceUrl) return null;
  // Only ratings this candidate did not publish about itself count. The
  // allowlist covers Google, Yelp, and reputable independent directories
  // (task-98) — deliberately never `candidate.reputationRating`, which is
  // fabricated display-only data attached after ranking.
  if (!isIndependentReviewSource(rating.source)) return null;

  return (rating.value / 5) * Math.min(reviewCount.value / REVIEW_COUNT_CONFIDENCE_CAP, 1);
}

const TOTAL_FIELD_COUNT = Object.keys(ProviderCandidateFieldsSchema.shape).length;

export function evidenceQualityScore(candidate: ProviderCandidate): number {
  const populatedCount = Object.values(candidate.fields).filter((value) => value != null).length;
  return populatedCount / TOTAL_FIELD_COUNT;
}
