import type { ProviderCandidate } from "../domain/types";

/**
 * Display names for the review sources the backend allowlists as
 * independently sourced (see `backend/src/shared/reviewDomains.ts`). Purely
 * cosmetic — an unknown source falls back to its bare hostname rather than
 * being hidden, so the user always sees where a rating came from.
 */
const SOURCE_LABELS: Record<string, string> = {
  "google.com": "Google",
  "yelp.com": "Yelp",
  "gigsalad.com": "GigSalad",
  "thebash.com": "The Bash",
  "weddingwire.com": "WeddingWire",
  "theknot.com": "The Knot",
  "thumbtack.com": "Thumbtack",
  "eventective.com": "Eventective",
};

export function formatSourceLabel(source: string): string {
  const hostname = source.startsWith("www.") ? source.slice(4) : source;
  return SOURCE_LABELS[hostname] ?? hostname;
}

export interface ReputationDisplay {
  /** "real" whenever a sourced FACT rating exists; "mock" for the fabricated fallback. */
  kind: "real" | "mock";
  /** e.g. "★ 4.8 · 340 reviews" — never carries the "(simulated)" label itself. */
  text: string;
  /** Present only for a real rating: where it was observed, e.g. "Yelp". */
  sourceLabel?: string;
}

/**
 * Single source of truth for which reputation number a screen shows.
 *
 * A real, independently sourced FACT rating always wins over the fabricated
 * mock — the mock exists only as a per-provider fallback (task-98). Callers
 * are responsible for rendering the mandatory "(simulated)" label whenever
 * `kind` is "mock"; it is never optional on any screen.
 */
export function deriveReputationDisplay(candidate: ProviderCandidate): ReputationDisplay | null {
  const ratingFact = candidate.fields.rating;
  if (ratingFact != null) {
    const reviewCount = candidate.fields.reviewCount?.value;
    return {
      kind: "real",
      text:
        reviewCount != null
          ? `★ ${ratingFact.value} · ${reviewCount} reviews`
          : `★ ${ratingFact.value}`,
      sourceLabel: formatSourceLabel(ratingFact.source),
    };
  }

  const { reputationRating, reputationReviewCount } = candidate;
  if (reputationRating == null || reputationReviewCount == null) {
    return null;
  }
  return {
    kind: "mock",
    text: `★ ${reputationRating} · ${reputationReviewCount} reviews`,
  };
}

/** The one-line form used on provider cards, with the label already applied. */
export function formatReputationLine(display: ReputationDisplay): string {
  return display.kind === "real"
    ? `${display.text}${display.sourceLabel ? ` · ${display.sourceLabel}` : ""}`
    : `${display.text} (simulated)`;
}
