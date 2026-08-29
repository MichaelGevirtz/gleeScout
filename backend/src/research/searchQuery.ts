export function buildProviderSearchQuery({
  serviceCategory,
  location,
}: {
  serviceCategory: string;
  location: string;
}): string {
  return `${serviceCategory} in ${location}`;
}
