import { describe, expect, it } from "vitest";
import { buildProviderSearchQuery, buildProviderSearchQueries } from "./searchQuery.js";
import type { CategoryAttributeSlot } from "../domain/conversation.js";

describe("buildProviderSearchQuery", () => {
  it("builds a query from service category and location", () => {
    expect(
      buildProviderSearchQuery({ serviceCategory: "wedding photographer", location: "Tel Aviv" }),
    ).toBe("wedding photographer in Tel Aviv");
  });

  it("changes output when inputs change", () => {
    expect(
      buildProviderSearchQuery({ serviceCategory: "bounce house rental", location: "Austin, TX" }),
    ).toBe("bounce house rental in Austin, TX");
  });

  it("passes strings through as-is, with no normalization", () => {
    expect(
      buildProviderSearchQuery({ serviceCategory: "  Taco Truck  ", location: "  Denver " }),
    ).toBe("  Taco Truck   in   Denver ");
  });
});

function attr(value: string | null): CategoryAttributeSlot {
  return { description: "d", importance: "optional", value };
}

describe("buildProviderSearchQueries", () => {
  it("returns the three documented queries when a usable category attribute exists", () => {
    const queries = buildProviderSearchQueries({
      serviceCategory: "bounce house rental",
      location: "Austin, TX",
      categoryAttributes: { waterSlide: attr("yes") },
    });

    expect(queries).toEqual([
      "bounce house rental in Austin, TX",
      "bounce house rental Austin, TX reviews",
      "bounce house rental Austin, TX yes",
    ]);
  });

  it("returns exactly two queries when no non-budget category attribute has a value", () => {
    const queries = buildProviderSearchQueries({
      serviceCategory: "bounce house rental",
      location: "Austin, TX",
      categoryAttributes: { waterSlide: attr(null) },
    });

    expect(queries).toEqual([
      "bounce house rental in Austin, TX",
      "bounce house rental Austin, TX reviews",
    ]);
  });

  it("returns exactly two queries when categoryAttributes is empty", () => {
    const queries = buildProviderSearchQueries({
      serviceCategory: "bounce house rental",
      location: "Austin, TX",
      categoryAttributes: {},
    });

    expect(queries).toHaveLength(2);
  });

  it("never uses a budget attribute as the requirement-targeted term", () => {
    const queries = buildProviderSearchQueries({
      serviceCategory: "bounce house rental",
      location: "Austin, TX",
      categoryAttributes: { budget: attr("$500") },
    });

    expect(queries).toEqual([
      "bounce house rental in Austin, TX",
      "bounce house rental Austin, TX reviews",
    ]);
  });

  it("skips a null-valued budget attribute and falls through to the next non-budget attribute", () => {
    const queries = buildProviderSearchQueries({
      serviceCategory: "bounce house rental",
      location: "Austin, TX",
      categoryAttributes: { budget: attr("$500"), waterSlide: attr("yes") },
    });

    expect(queries).toEqual([
      "bounce house rental in Austin, TX",
      "bounce house rental Austin, TX reviews",
      "bounce house rental Austin, TX yes",
    ]);
  });
});
