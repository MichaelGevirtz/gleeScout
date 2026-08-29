import type { Fact } from "../domain/evidence.js";
import type { DiscoveredResult, ProviderCandidate, ProviderCandidateFields } from "../domain/provider.js";
import type { ProviderExtractionResult } from "../llm/providerExtraction.js";

/**
 * Deliberately wider than the final 3-5 recommendation count (M7
 * architecture review). A project tuning decision, not derived from any
 * measurement — chosen as clearly more than 3-5 without straining the
 * Gemini free-tier rate limit (D2b) in one turn.
 */
export const MAX_DISCOVERY_RESULTS = 8;

export function dedupByUrl(results: DiscoveredResult[]): DiscoveredResult[] {
  const seen = new Set<string>();
  const deduped: DiscoveredResult[] = [];
  for (const result of results) {
    if (seen.has(result.url)) continue;
    seen.add(result.url);
    deduped.push(result);
  }
  return deduped;
}

export interface AssembleCandidateParams {
  url: string;
  extraction: ProviderExtractionResult;
  retrievedAt: string;
}

export function assembleCandidate({
  url,
  extraction,
  retrievedAt,
}: AssembleCandidateParams): ProviderCandidate | null {
  const source = new URL(url).hostname;

  function toFact<T>(value: T): Fact<T> {
    return { value, source, sourceUrl: url, retrievedAt };
  }

  const fields: ProviderCandidateFields = {};
  if (extraction.name !== null) fields.name = toFact(extraction.name);
  if (extraction.location !== null) fields.location = toFact(extraction.location);
  if (extraction.servicesOffered !== null) fields.servicesOffered = toFact(extraction.servicesOffered);
  if (extraction.pricing !== null) fields.pricing = toFact(extraction.pricing);
  if (extraction.availability !== null) fields.availability = toFact(extraction.availability);
  if (extraction.rating !== null) fields.rating = toFact(extraction.rating);
  if (extraction.reviewCount !== null) fields.reviewCount = toFact(extraction.reviewCount);
  if (extraction.photos !== null) fields.photos = toFact(extraction.photos);
  if (extraction.policies !== null) fields.policies = toFact(extraction.policies);
  if (extraction.contactMethod !== null) fields.contactMethod = toFact(extraction.contactMethod);

  if (Object.keys(fields).length === 0) return null;

  return { url, fields };
}
