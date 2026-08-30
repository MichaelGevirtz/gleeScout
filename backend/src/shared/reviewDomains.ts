import { hostnameMatches } from "./hostname.js";

/**
 * Independent event-vendor directories that publish aggregate ratings and
 * review counts for a provider they do not own. Enrichment's source-targeted
 * searches (task-98) frequently land on one of these rather than on Google or
 * Yelp proper, so a rating sourced from them is still independently sourced —
 * it is not the provider talking about itself.
 *
 * Deliberately a short, hand-picked list rather than a heuristic: the property
 * that matters for `reputationScore` is "not the provider's own site and not an
 * arbitrary blog", which only an explicit allowlist can guarantee.
 */
export const REPUTABLE_DIRECTORY_DOMAINS = [
  "gigsalad.com",
  "thebash.com",
  "weddingwire.com",
  "theknot.com",
  "thumbtack.com",
  "eventective.com",
] as const;

export function isReputableDirectory(hostname: string): boolean {
  return REPUTABLE_DIRECTORY_DOMAINS.some((domain) => hostnameMatches(hostname, domain));
}

/**
 * True for any hostname whose ratings can be treated as independently sourced:
 * Google, Yelp, or one of the allowlisted directories above. Callers are still
 * responsible for separately excluding the provider's own domain.
 */
export function isIndependentReviewSource(hostname: string): boolean {
  return (
    hostnameMatches(hostname, "google.com") ||
    hostnameMatches(hostname, "yelp.com") ||
    isReputableDirectory(hostname)
  );
}
