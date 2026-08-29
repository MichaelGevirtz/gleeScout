import { describe, expect, it } from "vitest";
import { buildEnrichmentQuery } from "./enrichmentQuery.js";

describe("buildEnrichmentQuery", () => {
  it("builds a query from provider name and location", () => {
    expect(
      buildEnrichmentQuery({ providerName: "Acme Photography", location: "Tel Aviv" }),
    ).toBe("Acme Photography reviews Tel Aviv");
  });

  it("changes output when inputs change", () => {
    expect(
      buildEnrichmentQuery({ providerName: "Bounce City", location: "Austin, TX" }),
    ).toBe("Bounce City reviews Austin, TX");
  });

  it("passes strings through as-is, with no normalization", () => {
    expect(
      buildEnrichmentQuery({ providerName: "  Taco Truck  ", location: "  Denver " }),
    ).toBe("  Taco Truck   reviews   Denver ");
  });
});
