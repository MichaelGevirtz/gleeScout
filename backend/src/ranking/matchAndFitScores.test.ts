import { describe, expect, it } from "vitest";
import type { CategoryAttributeSlot } from "../domain/conversation.js";
import type { Fact } from "../domain/evidence.js";
import type { ProviderCandidate } from "../domain/provider.js";
import {
  geoFitScore,
  parseDollarAmount,
  priceFitScore,
  requirementMatchScore,
} from "./matchAndFitScores.js";
import type { RankingRequirements } from "./types.js";

function fact<T>(value: T): Fact<T> {
  return {
    value,
    source: "test",
    sourceUrl: "https://example.com/source",
    retrievedAt: "2026-01-01T00:00:00.000Z",
  };
}

function candidate(fields: ProviderCandidate["fields"]): ProviderCandidate {
  return { url: "https://example.com/provider", fields };
}

function slot(value: string | null, importance: "required" | "optional" = "required"): CategoryAttributeSlot {
  return { description: "test attribute", importance, value };
}

function requirements(categoryAttributes: Record<string, CategoryAttributeSlot>, location?: string): RankingRequirements {
  return { location, categoryAttributes };
}

describe("requirementMatchScore", () => {
  it("returns 1 when all requirement values are found in servicesOffered", () => {
    const c = candidate({ servicesOffered: fact(["large tents", "outdoor catering"]) });
    const r = requirements({ size: slot("large"), theme: slot("outdoor") });
    expect(requirementMatchScore(c, r)).toBe(1);
  });

  it("returns 0.5 when half the requirement values are found", () => {
    const c = candidate({ servicesOffered: fact(["large tents"]) });
    const r = requirements({ size: slot("large"), theme: slot("outdoor") });
    expect(requirementMatchScore(c, r)).toBe(0.5);
  });

  it("returns null when neither servicesOffered nor policies FACT exists", () => {
    const c = candidate({});
    const r = requirements({ size: slot("large") });
    expect(requirementMatchScore(c, r)).toBeNull();
  });

  it("returns null when there are no non-null category-attribute values to check", () => {
    const c = candidate({ servicesOffered: fact(["large tents"]) });
    const r = requirements({ size: slot(null) });
    expect(requirementMatchScore(c, r)).toBeNull();
  });

  it("excludes the budget entry from the match set (does not affect the score)", () => {
    const c = candidate({ servicesOffered: fact(["large tents", "outdoor catering"]) });
    const withBudget = requirements({
      size: slot("large"),
      theme: slot("outdoor"),
      budget: slot("$500"),
    });
    const withoutBudget = requirements({
      size: slot("large"),
      theme: slot("outdoor"),
    });
    expect(requirementMatchScore(c, withBudget)).toBe(requirementMatchScore(c, withoutBudget));
  });

  it("returns null when only a budget entry is present", () => {
    const c = candidate({ servicesOffered: fact(["large tents"]) });
    const r = requirements({ budget: slot("$500") });
    expect(requirementMatchScore(c, r)).toBeNull();
  });

  it("checks policies when servicesOffered is absent", () => {
    const c = candidate({ policies: fact("no outdoor pets allowed") });
    const r = requirements({ theme: slot("outdoor") });
    expect(requirementMatchScore(c, r)).toBe(1);
  });
});

describe("geoFitScore", () => {
  it("returns 1 when the user location is a substring of the provider location", () => {
    const c = candidate({ location: fact("Austin, TX") });
    const r = requirements({}, "Austin");
    expect(geoFitScore(c, r)).toBe(1);
  });

  it("returns 0 when there is no overlap", () => {
    const c = candidate({ location: fact("Denver, CO") });
    const r = requirements({}, "Austin");
    expect(geoFitScore(c, r)).toBe(0);
  });

  it("returns null when the user location is missing", () => {
    const c = candidate({ location: fact("Austin, TX") });
    const r = requirements({});
    expect(geoFitScore(c, r)).toBeNull();
  });

  it("returns null when the provider location is missing", () => {
    const c = candidate({});
    const r = requirements({}, "Austin");
    expect(geoFitScore(c, r)).toBeNull();
  });
});

describe("parseDollarAmount", () => {
  it.each([
    ["$200", 200],
    ["$1,095", 1095],
    ["Starting at $150", 150],
    ["$200-$300", null],
    ["$175... to $365-$1,095", null],
    ["Contact for pricing", null],
  ])("parseDollarAmount(%j) -> %j", (input, expected) => {
    expect(parseDollarAmount(input)).toBe(expected);
  });
});

describe("priceFitScore", () => {
  it("returns 1 when the provider price is at or under budget", () => {
    const c = candidate({ pricing: fact("$400") });
    const r = requirements({ budget: slot("$500") });
    expect(priceFitScore(c, r)).toBe(1);
  });

  it("returns a value strictly between 0 and 1 when the provider price exceeds budget", () => {
    const c = candidate({ pricing: fact("$600") });
    const r = requirements({ budget: slot("$500") });
    const score = priceFitScore(c, r);
    expect(score).not.toBeNull();
    expect(score as number).toBeGreaterThan(0);
    expect(score as number).toBeLessThan(1);
    expect(score).toBeCloseTo(1 - 100 / 500);
  });

  it("returns null when no categoryAttributes key matches /budget/i", () => {
    const c = candidate({ pricing: fact("$400") });
    const r = requirements({ size: slot("large") });
    expect(priceFitScore(c, r)).toBeNull();
  });

  it("returns null when budget is present but candidate.fields.pricing is absent", () => {
    const c = candidate({});
    const r = requirements({ budget: slot("$500") });
    expect(priceFitScore(c, r)).toBeNull();
  });

  it("returns null when the budget value itself is unparseable", () => {
    const c = candidate({ pricing: fact("$400") });
    const r = requirements({ budget: slot("$200-$300") });
    expect(priceFitScore(c, r)).toBeNull();
  });
});
