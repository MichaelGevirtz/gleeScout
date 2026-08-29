export function buildEnrichmentQuery({
  providerName,
  location,
}: {
  providerName: string;
  location: string;
}): string {
  return `${providerName} reviews ${location}`;
}
