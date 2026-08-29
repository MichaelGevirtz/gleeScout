import { describe, expect, it } from "vitest";
import type { CategoryAttributeSlot, ConversationState } from "../domain/conversation.js";
import { createInitialState } from "../domain/conversation.js";
import type { Fact, Inferred } from "../domain/evidence.js";
import type { ProviderCandidate } from "../domain/provider.js";
import { analyzeProviderGaps } from "./analyzeGaps.js";

function fact<T>(value: T): Fact<T> {
  return {
    value,
    source: "test",
    sourceUrl: "https://example.com/source",
    retrievedAt: "2026-01-01T00:00:00.000Z",
  };
}

function inferredTag(value: string, evidenceExcerpt?: string): Inferred<string> {
  return {
    value,
    evidenceSourceUrl: "https://reviews.example.com/provider",
    evidenceExcerpt,
    sourceType: "yelp",
    retrievedAt: "2026-01-01T00:00:00.000Z",
  };
}

function candidate(
  fields: ProviderCandidate["fields"],
  inferred?: ProviderCandidate["inferred"],
): ProviderCandidate {
  return { url: "https://example.com/provider", fields, inferred };
}

function slot(value: string | null, importance: "required" | "optional" = "required"): CategoryAttributeSlot {
  return { description: "test attribute", importance, value };
}

function state(overrides: {
  dateTime?: string;
  categoryAttributes?: Record<string, CategoryAttributeSlot>;
}): ConversationState {
  const base = createInitialState("test-session");
  return {
    ...base,
    coreAttributes: { ...base.coreAttributes, dateTime: overrides.dateTime },
    categoryAttributes: overrides.categoryAttributes ?? {},
  };
}

describe("analyzeProviderGaps — availability", () => {
  it("no gap when dateTime is unset", () => {
    const c = candidate({});
    const s = state({});
    expect(analyzeProviderGaps({ candidate: c, state: s })).toEqual([]);
  });

  it("gap when dateTime known and availability FACT missing", () => {
    const c = candidate({});
    const s = state({ dateTime: "Saturday, October 17 from 1-5 PM" });
    const gaps = analyzeProviderGaps({ candidate: c, state: s });
    expect(gaps).toContainEqual(
      expect.objectContaining({ topic: "availability" }),
    );
  });

  it("gap when availability FACT known but doesn't mention the requested date/time", () => {
    const c = candidate({ availability: fact("Mon-Fri 9am-5pm") });
    const s = state({ dateTime: "Saturday, October 17 from 1-5 PM" });
    const gaps = analyzeProviderGaps({ candidate: c, state: s });
    expect(gaps).toContainEqual(
      expect.objectContaining({ topic: "availability" }),
    );
  });

  it("no gap when availability FACT text does contain the requested date/time", () => {
    const c = candidate({ availability: fact("Available Saturday, October 17 from 1-5 PM") });
    const s = state({ dateTime: "Saturday, October 17 from 1-5 PM" });
    const gaps = analyzeProviderGaps({ candidate: c, state: s });
    expect(gaps.filter((g) => g.topic === "availability")).toEqual([]);
  });
});

describe("analyzeProviderGaps — requirementFit", () => {
  it("no gap for an optional category attribute missing from provider text", () => {
    const c = candidate({ servicesOffered: fact(["bounce houses"]) });
    const s = state({ categoryAttributes: { waterSlide: slot("yes", "optional") } });
    expect(analyzeProviderGaps({ candidate: c, state: s })).toEqual([]);
  });

  it("no gap for the budget attribute even if its value never appears in provider text", () => {
    const c = candidate({ servicesOffered: fact(["bounce houses"]) });
    const s = state({ categoryAttributes: { budget: slot("$500") } });
    const gaps = analyzeProviderGaps({ candidate: c, state: s });
    expect(gaps.filter((g) => g.topic === "requirementFit")).toEqual([]);
  });

  it("gap for a required attribute whose value isn't lexically present", () => {
    const c = candidate({ servicesOffered: fact(["bounce houses"]) });
    const s = state({ categoryAttributes: { waterSlide: slot("water slide required") } });
    const gaps = analyzeProviderGaps({ candidate: c, state: s });
    expect(gaps).toContainEqual(
      expect.objectContaining({ topic: "requirementFit" }),
    );
  });

  it("no gap for a required attribute whose value is lexically present", () => {
    const c = candidate({ servicesOffered: fact(["bounce houses with water slide"]) });
    const s = state({ categoryAttributes: { waterSlide: slot("water slide") } });
    const gaps = analyzeProviderGaps({ candidate: c, state: s });
    expect(gaps.filter((g) => g.topic === "requirementFit")).toEqual([]);
  });

  it("no gap when a relevant INFERRED tag (not FACT) already covers the requirement", () => {
    const c = candidate({}, [inferredTag("great with toddlers ages 2-4")]);
    const s = state({ categoryAttributes: { ages: slot("ages 2-4") } });
    const gaps = analyzeProviderGaps({ candidate: c, state: s });
    expect(gaps.filter((g) => g.topic === "requirementFit")).toEqual([]);
  });

  it("no gap when the match is only in an INFERRED tag's evidenceExcerpt, not its value", () => {
    const c = candidate({}, [
      inferredTag("good reputation", "one reviewer said the staff was fantastic with our 3 kids aged 2-4"),
    ]);
    const s = state({ categoryAttributes: { ages: slot("aged 2-4") } });
    const gaps = analyzeProviderGaps({ candidate: c, state: s });
    expect(gaps.filter((g) => g.topic === "requirementFit")).toEqual([]);
  });

  it("still gaps a required attribute when INFERRED tags exist but don't mention it", () => {
    const c = candidate({}, [inferredTag("clean equipment, arrives on time")]);
    const s = state({ categoryAttributes: { ages: slot("ages 2-4") } });
    const gaps = analyzeProviderGaps({ candidate: c, state: s });
    expect(gaps).toContainEqual(expect.objectContaining({ topic: "requirementFit" }));
  });

  it("using an INFERRED signal to close a gap does not add or alter any FACT field", () => {
    const c = candidate({}, [inferredTag("great with toddlers ages 2-4")]);
    const s = state({ categoryAttributes: { ages: slot("ages 2-4") } });
    analyzeProviderGaps({ candidate: c, state: s });
    expect(c.fields).toEqual({});
    expect(c.inferred).toEqual([inferredTag("great with toddlers ages 2-4")]);
  });
});

describe("analyzeProviderGaps — pricing", () => {
  it("no pricing gap considered when no budget category attribute exists", () => {
    const c = candidate({ servicesOffered: fact(["large tents"]) });
    const s = state({ categoryAttributes: { size: slot("large") } });
    const gaps = analyzeProviderGaps({ candidate: c, state: s });
    expect(gaps.filter((g) => g.topic === "pricing")).toEqual([]);
  });

  it("gap when pricing FACT is missing and a budget attribute exists", () => {
    const c = candidate({});
    const s = state({ categoryAttributes: { budget: slot("$500") } });
    const gaps = analyzeProviderGaps({ candidate: c, state: s });
    expect(gaps).toContainEqual(
      expect.objectContaining({ topic: "pricing", description: expect.stringContaining("not yet known") }),
    );
  });

  it("gap when pricing FACT exists but mentions none of the inclusion keywords", () => {
    const c = candidate({ pricing: fact("$350 starting price") });
    const s = state({ categoryAttributes: { budget: slot("$500") } });
    const gaps = analyzeProviderGaps({ candidate: c, state: s });
    expect(gaps).toContainEqual(
      expect.objectContaining({ topic: "pricing", description: expect.stringContaining("includes") }),
    );
  });

  it("no gap when pricing FACT text mentions at least one inclusion keyword", () => {
    const c = candidate({ pricing: fact("$350, includes setup and teardown") });
    const s = state({ categoryAttributes: { budget: slot("$500") } });
    const gaps = analyzeProviderGaps({ candidate: c, state: s });
    expect(gaps.filter((g) => g.topic === "pricing")).toEqual([]);
  });
});

describe("analyzeProviderGaps — combined", () => {
  it("returns [] when every topic is already covered by FACTs", () => {
    const c = candidate({
      availability: fact("Available Saturday, October 17 from 1-5 PM"),
      servicesOffered: fact(["water slide included"]),
      pricing: fact("$350, includes setup and teardown"),
    });
    const s = state({
      dateTime: "Saturday, October 17 from 1-5 PM",
      categoryAttributes: {
        waterSlide: slot("water slide"),
        budget: slot("$500"),
      },
    });
    expect(analyzeProviderGaps({ candidate: c, state: s })).toEqual([]);
  });
});
