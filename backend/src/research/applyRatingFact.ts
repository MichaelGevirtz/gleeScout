import type { Fact } from "../domain/evidence.js";
import type { ProviderCandidate } from "../domain/provider.js";
import type { ReviewAnalysisResult } from "../llm/reviewAnalysis.js";
import { stripWww } from "../shared/hostname.js";

export interface ApplyRatingFactParams {
  candidate: ProviderCandidate;
  analysis: ReviewAnalysisResult;
  /** Exactly the page URLs that were supplied to the analysis prompt. */
  suppliedUrls: string[];
  retrievedAt: string;
}

function hostnameOf(url: string): string | null {
  try {
    return stripWww(new URL(url).hostname);
  } catch {
    return null;
  }
}

/**
 * True when the candidate's existing rating came from the provider's own site,
 * i.e. it is self-reported and may be displaced by an independently sourced one.
 */
function isSelfReported(candidate: ProviderCandidate, rating: Fact<number>): boolean {
  const ratingHostname = hostnameOf(rating.sourceUrl);
  const providerHostname = hostnameOf(candidate.url);
  return ratingHostname !== null && ratingHostname === providerHostname;
}

/**
 * Writes an independently sourced rating onto the candidate as a FACT, subject
 * to two deterministic gates the LLM cannot bypass:
 *
 * 1. Grounding — `ratingSourceUrl` must be exactly one of the URLs that were
 *    supplied in the prompt. A URL the model invented or reconstructed is
 *    rejected outright rather than trusted.
 * 2. Precedence — an existing rating is only overwritten when it was
 *    self-reported (sourced from the provider's own domain). An already
 *    independently sourced rating is never displaced.
 *
 * Returns the candidate unchanged when either gate fails.
 */
export function applyRatingFact({
  candidate,
  analysis,
  suppliedUrls,
  retrievedAt,
}: ApplyRatingFactParams): ProviderCandidate {
  const { rating, reviewCount, ratingSourceUrl } = analysis;
  if (rating === null || ratingSourceUrl === null) return candidate;
  if (!suppliedUrls.includes(ratingSourceUrl)) return candidate;

  const source = hostnameOf(ratingSourceUrl);
  if (source === null) return candidate;

  const existing = candidate.fields.rating;
  if (existing !== undefined && !isSelfReported(candidate, existing)) return candidate;

  const fields = { ...candidate.fields };
  fields.rating = { value: rating, source, sourceUrl: ratingSourceUrl, retrievedAt };

  if (reviewCount !== null) {
    fields.reviewCount = { value: reviewCount, source, sourceUrl: ratingSourceUrl, retrievedAt };
  } else {
    // The previous review count belonged to the rating we just replaced.
    // Leaving it would pair a new rating with a count from another page, which
    // `reputationScore` rejects anyway — dropping it keeps the FACTs coherent
    // rather than silently mismatched.
    delete fields.reviewCount;
  }

  return { ...candidate, fields };
}
