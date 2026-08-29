import { describe, expect, it } from "vitest";
import { assembleCandidate, dedupByUrl, MAX_DISCOVERY_RESULTS } from "./assembleCandidates.js";
import type { DiscoveredResult } from "../domain/provider.js";
import type { ProviderExtractionResult } from "../llm/providerExtraction.js";

const ALL_NULL_EXTRACTION: ProviderExtractionResult = {
  name: null,
  location: null,
  servicesOffered: null,
  pricing: null,
  availability: null,
  rating: null,
  reviewCount: null,
  photos: null,
  policies: null,
  contactMethod: null,
};

describe("dedupByUrl", () => {
  it("removes an exact duplicate URL, keeping the first occurrence", () => {
    const first: DiscoveredResult = { url: "https://example.com/a", title: "First" };
    const duplicate: DiscoveredResult = { url: "https://example.com/a", title: "Second" };

    const result = dedupByUrl([first, duplicate]);

    expect(result).toEqual([first]);
  });

  it("leaves distinct URLs untouched, including differing query strings", () => {
    const a: DiscoveredResult = { url: "https://example.com/a", title: "A" };
    const aWithQuery: DiscoveredResult = { url: "https://example.com/a?ref=x", title: "A ref" };
    const b: DiscoveredResult = { url: "https://example.com/b", title: "B" };

    const result = dedupByUrl([a, aWithQuery, b]);

    expect(result).toEqual([a, aWithQuery, b]);
  });
});

describe("assembleCandidate", () => {
  it("produces a ProviderCandidate with every populated field as a valid Fact, given url/retrievedAt/domain source", () => {
    const extraction: ProviderExtractionResult = {
      name: "Bounce Palace",
      location: "Austin, TX",
      servicesOffered: ["bounce house rental"],
      pricing: "$200/day",
      availability: "weekends only",
      rating: 4.8,
      reviewCount: 120,
      photos: ["https://example.com/photo1.jpg"],
      policies: "50% deposit required",
      contactMethod: "phone: 555-1234",
    };

    const candidate = assembleCandidate({
      url: "https://www.bouncepalace.com/rentals",
      extraction,
      retrievedAt: "2026-08-28T12:00:00.000Z",
    });

    expect(candidate).not.toBeNull();
    expect(candidate!.url).toBe("https://www.bouncepalace.com/rentals");
    for (const [key, value] of Object.entries(extraction)) {
      const fact = (candidate!.fields as Record<string, unknown>)[key] as {
        value: unknown;
        source: string;
        sourceUrl: string;
        retrievedAt: string;
      };
      expect(fact.value).toEqual(value);
      expect(fact.source).toBe("www.bouncepalace.com");
      expect(fact.sourceUrl).toBe("https://www.bouncepalace.com/rentals");
      expect(fact.retrievedAt).toBe("2026-08-28T12:00:00.000Z");
    }
  });

  it("returns null when every field is null (true empty)", () => {
    const candidate = assembleCandidate({
      url: "https://example.com",
      extraction: ALL_NULL_EXTRACTION,
      retrievedAt: "2026-08-28T12:00:00.000Z",
    });

    expect(candidate).toBeNull();
  });

  it("keeps the candidate when name is null but another field is populated", () => {
    const extraction: ProviderExtractionResult = {
      ...ALL_NULL_EXTRACTION,
      pricing: "$150/day",
      rating: 4.2,
    };

    const candidate = assembleCandidate({
      url: "https://example.com/provider",
      extraction,
      retrievedAt: "2026-08-28T12:00:00.000Z",
    });

    expect(candidate).not.toBeNull();
    expect(candidate!.fields.name).toBeUndefined();
    expect(candidate!.fields.pricing?.value).toBe("$150/day");
    expect(candidate!.fields.rating?.value).toBe(4.2);
  });

  it("keeps the candidate when only name is populated", () => {
    const extraction: ProviderExtractionResult = {
      ...ALL_NULL_EXTRACTION,
      name: "Bounce Palace",
    };

    const candidate = assembleCandidate({
      url: "https://example.com/provider",
      extraction,
      retrievedAt: "2026-08-28T12:00:00.000Z",
    });

    expect(candidate).not.toBeNull();
    expect(candidate!.fields.name?.value).toBe("Bounce Palace");
    expect(Object.keys(candidate!.fields)).toEqual(["name"]);
  });
});

describe("MAX_DISCOVERY_RESULTS", () => {
  it("is exported and equals 8", () => {
    expect(MAX_DISCOVERY_RESULTS).toBe(8);
  });
});
