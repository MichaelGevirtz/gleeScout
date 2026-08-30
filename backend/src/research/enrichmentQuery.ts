export function buildEnrichmentQuery({
  providerName,
  location,
}: {
  providerName: string;
  location: string;
}): string {
  return `${providerName} reviews ${location}`;
}

/**
 * Source-targeted variants (task-98). Enrichment fires both concurrently per
 * candidate so a real rating can be sourced from whichever of the two actually
 * has one, instead of relying on a single untargeted "reviews" search.
 *
 * `location` is optional here (unlike `buildEnrichmentQuery`) because a
 * discovered candidate may have no extracted location fact — the term is simply
 * dropped rather than the search being skipped.
 */
export function buildYelpEnrichmentQuery({
  providerName,
  location,
}: {
  providerName: string;
  location?: string;
}): string {
  return [providerName, location, "site:yelp.com"].filter(Boolean).join(" ");
}

export function buildGoogleEnrichmentQuery({
  providerName,
  location,
}: {
  providerName: string;
  location?: string;
}): string {
  return [providerName, location, "google reviews"].filter(Boolean).join(" ");
}
