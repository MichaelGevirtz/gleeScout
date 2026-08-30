import { describe, expect, it } from "vitest";
import { deriveConfirmedRequirements, deriveRequirementCatalog } from "./confirmedRequirements.js";
import type { ProviderCandidate } from "../domain/provider.js";
import type { RankingRequirements } from "./types.js";

const RETRIEVED_AT = "2026-08-28T12:00:00.000Z";

function fact<T>(value: T) {
  return { value, source: "example.com", sourceUrl: "https://example.com", retrievedAt: RETRIEVED_AT };
}

function candidateWith(fields: Partial<ProviderCandidate["fields"]>): ProviderCandidate {
  return { url: "https://example.com", fields };
}

describe("deriveConfirmedRequirements", () => {
  it("confirms serviceCategory when the phrase appears in name/servicesOffered/policies text", () => {
    const candidate = candidateWith({ name: fact("Best baby shower photographer in Austin") });
    const requirements: RankingRequirements = {
      serviceCategory: "baby shower photographer",
      categoryAttributes: {},
    };

    const result = deriveConfirmedRequirements(candidate, requirements);

    expect(result).toEqual([{ label: "baby shower photographer", kind: "serviceCategory" }]);
  });

  it("confirms serviceCategory with a generic suffix stripped (e.g. 'rental') against pluralized FACT text", () => {
    const candidate = candidateWith({ servicesOffered: fact(["Bounce Houses & Jumps"]) });
    const requirements: RankingRequirements = {
      serviceCategory: "bounce house rental",
      categoryAttributes: {},
    };

    const result = deriveConfirmedRequirements(candidate, requirements);

    expect(result).toEqual([{ label: "bounce house rental", kind: "serviceCategory" }]);
  });

  it("still does not confirm a genuine mismatch after suffix stripping (accepted lexical gap)", () => {
    const candidate = candidateWith({ servicesOffered: fact(["inflatables for backyard parties"]) });
    const requirements: RankingRequirements = {
      serviceCategory: "bounce house rental",
      categoryAttributes: {},
    };

    expect(deriveConfirmedRequirements(candidate, requirements)).toEqual([]);
  });

  it("does not confirm serviceCategory when it's absent from FACT text", () => {
    const candidate = candidateWith({
      name: fact("Bounce Palace Rentals"),
      servicesOffered: fact(["party rentals"]),
    });
    const requirements: RankingRequirements = {
      serviceCategory: "baby shower photographer",
      categoryAttributes: {},
    };

    expect(deriveConfirmedRequirements(candidate, requirements)).toEqual([]);
  });

  it("confirms location iff geoFitScore would be 1, reusing that exact check (not a duplicate implementation)", () => {
    const matching = candidateWith({ location: fact("Austin, TX") });
    const nonMatching = candidateWith({ location: fact("Denver, CO") });
    const requirements: RankingRequirements = { location: "Austin, TX", categoryAttributes: {} };

    expect(deriveConfirmedRequirements(matching, requirements)).toEqual([
      { label: "Austin, TX", kind: "location" },
    ]);
    expect(deriveConfirmedRequirements(nonMatching, requirements)).toEqual([]);
  });

  it("checks each non-budget category attribute independently (partial confirmation)", () => {
    const candidate = candidateWith({ servicesOffered: fact(["baby shower photography", "toddler sessions"]) });
    const requirements: RankingRequirements = {
      categoryAttributes: {
        eventType: { description: "Event type", importance: "required", value: "baby shower" },
        style: { description: "Photography style", importance: "optional", value: "candid" },
      },
    };

    const result = deriveConfirmedRequirements(candidate, requirements);

    expect(result).toEqual([{ label: "baby shower", kind: "categoryAttribute" }]);
  });

  it("never includes the budget-named attribute even when its value happens to appear in FACT text", () => {
    const candidate = candidateWith({ policies: fact("all packages under $500 including setup") });
    const requirements: RankingRequirements = {
      categoryAttributes: {
        budget: { description: "Budget", importance: "required", value: "$500" },
      },
    };

    expect(deriveConfirmedRequirements(candidate, requirements)).toEqual([]);
  });

  it("returns an empty array for a candidate with no FACT text anywhere", () => {
    const candidate = candidateWith({});
    const requirements: RankingRequirements = {
      serviceCategory: "bounce house rental",
      location: "Austin, TX",
      categoryAttributes: {
        ageRange: { description: "Age range", importance: "required", value: "toddler" },
      },
    };

    expect(deriveConfirmedRequirements(candidate, requirements)).toEqual([]);
  });

  it("returns all three kinds together when everything is confirmed", () => {
    const candidate = candidateWith({
      name: fact("Austin Baby Shower Photographer"),
      location: fact("Austin, TX"),
      servicesOffered: fact(["baby shower photography"]),
    });
    const requirements: RankingRequirements = {
      serviceCategory: "baby shower photographer",
      location: "Austin, TX",
      categoryAttributes: {
        eventType: { description: "Event type", importance: "required", value: "baby shower" },
      },
    };

    const result = deriveConfirmedRequirements(candidate, requirements);

    expect(result).toEqual([
      { label: "baby shower photographer", kind: "serviceCategory" },
      { label: "Austin, TX", kind: "location" },
      { label: "baby shower", kind: "categoryAttribute" },
    ]);
  });
});

describe("deriveRequirementCatalog", () => {
  it("lists serviceCategory, location, and each non-null non-budget category attribute regardless of any candidate", () => {
    const requirements: RankingRequirements = {
      serviceCategory: "bounce house rental",
      location: "Austin, TX",
      categoryAttributes: {
        ageRange: { description: "Age range", importance: "required", value: "toddler" },
        budget: { description: "Budget", importance: "required", value: "$300" },
        waterSlide: { description: "Water slide wanted", importance: "optional", value: null },
      },
    };

    expect(deriveRequirementCatalog(requirements)).toEqual([
      { label: "bounce house rental", kind: "serviceCategory" },
      { label: "Austin, TX", kind: "location" },
      { label: "toddler", kind: "categoryAttribute" },
    ]);
  });

  it("returns an empty array when the requirements have no serviceCategory, location, or category attribute values", () => {
    const requirements: RankingRequirements = { categoryAttributes: {} };

    expect(deriveRequirementCatalog(requirements)).toEqual([]);
  });

  it("matches deriveConfirmedRequirements's full-confirmation labels/order for a candidate that confirms everything", () => {
    const requirements: RankingRequirements = {
      serviceCategory: "baby shower photographer",
      location: "Austin, TX",
      categoryAttributes: {
        eventType: { description: "Event type", importance: "required", value: "baby shower" },
      },
    };
    const candidate = candidateWith({
      name: fact("Austin Baby Shower Photographer"),
      location: fact("Austin, TX"),
      servicesOffered: fact(["baby shower photography"]),
    });

    expect(deriveRequirementCatalog(requirements)).toEqual(
      deriveConfirmedRequirements(candidate, requirements),
    );
  });
});
