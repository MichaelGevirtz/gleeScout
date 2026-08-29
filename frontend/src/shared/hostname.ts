/**
 * Pure helper backing the provider name-fallback rule (m14-ux-spec.md §3):
 * use `candidate.fields.name?.value`, else the hostname parsed from
 * `candidate.url`. Kept as a plain function so it is unit-testable without
 * rendering a component.
 */
export function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
