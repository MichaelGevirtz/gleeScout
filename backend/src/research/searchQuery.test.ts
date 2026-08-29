import { describe, expect, it } from "vitest";
import { buildProviderSearchQuery } from "./searchQuery.js";

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
