import {
  deriveReputationDisplay,
  formatReputationLine,
  formatSourceLabel,
} from "./reputationDisplay";
import type { Fact, ProviderCandidate } from "../domain/types";

function fact<T>(value: T, source = "yelp.com"): Fact<T> {
  return {
    value,
    source,
    sourceUrl: `https://www.${source}/biz/x`,
    retrievedAt: "2026-08-30T00:00:00.000Z",
  };
}

function candidate(overrides: Partial<ProviderCandidate> = {}): ProviderCandidate {
  return { url: "https://acme.com", fields: {}, ...overrides };
}

describe("formatSourceLabel", () => {
  it("maps known review sources to friendly names", () => {
    expect(formatSourceLabel("yelp.com")).toBe("Yelp");
    expect(formatSourceLabel("google.com")).toBe("Google");
    expect(formatSourceLabel("weddingwire.com")).toBe("WeddingWire");
  });

  it("strips a www prefix before looking the source up", () => {
    expect(formatSourceLabel("www.yelp.com")).toBe("Yelp");
  });

  it("falls back to the bare hostname for an unmapped source", () => {
    expect(formatSourceLabel("some-directory.co.uk")).toBe("some-directory.co.uk");
  });
});

describe("deriveReputationDisplay", () => {
  it("returns null when neither a real rating nor mock fields are present", () => {
    expect(deriveReputationDisplay(candidate())).toBeNull();
  });

  it("returns the real rating with its review count and source label", () => {
    const display = deriveReputationDisplay(
      candidate({ fields: { rating: fact(4.8), reviewCount: fact(340) } })
    );

    expect(display).toEqual({
      kind: "real",
      text: "★ 4.8 · 340 reviews",
      sourceLabel: "Yelp",
    });
  });

  it("omits the review count from a real rating that has none", () => {
    const display = deriveReputationDisplay(candidate({ fields: { rating: fact(4.8) } }));

    expect(display?.text).toBe("★ 4.8");
  });

  it("returns the mock line when there is no real rating", () => {
    const display = deriveReputationDisplay(
      candidate({ reputationRating: 4.3, reputationReviewCount: 217 })
    );

    expect(display).toEqual({ kind: "mock", text: "★ 4.3 · 217 reviews" });
  });

  it("prefers the real rating when both a real rating and mock fields are present", () => {
    const display = deriveReputationDisplay(
      candidate({
        fields: { rating: fact(4.8, "google.com"), reviewCount: fact(340, "google.com") },
        reputationRating: 4.3,
        reputationReviewCount: 217,
      })
    );

    expect(display?.kind).toBe("real");
    expect(display?.text).toBe("★ 4.8 · 340 reviews");
    expect(display?.sourceLabel).toBe("Google");
  });
});

describe("formatReputationLine", () => {
  it("appends the source to a real rating and never labels it simulated", () => {
    const line = formatReputationLine({
      kind: "real",
      text: "★ 4.8 · 340 reviews",
      sourceLabel: "Yelp",
    });

    expect(line).toBe("★ 4.8 · 340 reviews · Yelp");
    expect(line).not.toContain("simulated");
  });

  it("always labels a mock rating as simulated", () => {
    expect(formatReputationLine({ kind: "mock", text: "★ 4.3 · 217 reviews" })).toBe(
      "★ 4.3 · 217 reviews (simulated)"
    );
  });
});
