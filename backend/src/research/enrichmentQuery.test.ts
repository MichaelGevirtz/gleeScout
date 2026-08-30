import { describe, expect, it } from "vitest";
import {
  buildEnrichmentQuery,
  buildGoogleEnrichmentQuery,
  buildYelpEnrichmentQuery,
} from "./enrichmentQuery.js";

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

describe("buildYelpEnrichmentQuery", () => {
  it("targets yelp.com with name and location", () => {
    expect(buildYelpEnrichmentQuery({ providerName: "Bounce City", location: "Austin, TX" })).toBe(
      "Bounce City Austin, TX site:yelp.com"
    );
  });

  it("omits the location term when the candidate has no known location", () => {
    expect(buildYelpEnrichmentQuery({ providerName: "Bounce City" })).toBe(
      "Bounce City site:yelp.com"
    );
  });
});

describe("buildGoogleEnrichmentQuery", () => {
  it("targets google reviews with name and location", () => {
    expect(buildGoogleEnrichmentQuery({ providerName: "Bounce City", location: "Austin, TX" })).toBe(
      "Bounce City Austin, TX google reviews"
    );
  });

  it("omits the location term when the candidate has no known location", () => {
    expect(buildGoogleEnrichmentQuery({ providerName: "Bounce City" })).toBe(
      "Bounce City google reviews"
    );
  });

  it("produces a different query than the yelp builder for the same inputs", () => {
    const inputs = { providerName: "Bounce City", location: "Austin" };
    expect(buildGoogleEnrichmentQuery(inputs)).not.toBe(buildYelpEnrichmentQuery(inputs));
  });
});
