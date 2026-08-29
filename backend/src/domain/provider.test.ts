import { describe, expect, it } from "vitest";
import {
  DiscoveredResultSchema,
  ProviderCandidateSchema,
} from "./provider.js";

describe("DiscoveredResultSchema", () => {
  it("accepts a minimal valid result (url + title only)", () => {
    const result = {
      url: "https://example.com/listing/jump-around-rentals",
      title: "Jump Around Rentals",
    };

    expect(DiscoveredResultSchema.safeParse(result).success).toBe(true);
  });

  it("rejects a non-URL url", () => {
    const result = {
      url: "not-a-url",
      title: "Jump Around Rentals",
    };

    expect(DiscoveredResultSchema.safeParse(result).success).toBe(false);
  });
});

describe("ProviderCandidateSchema", () => {
  const fact = (value: unknown) => ({
    value,
    source: "example.com",
    sourceUrl: "https://example.com/listing/jump-around-rentals",
    retrievedAt: "2026-08-28T12:00:00Z",
  });

  it("accepts a candidate with an empty fields object", () => {
    const candidate = {
      url: "https://example.com/listing/jump-around-rentals",
      fields: {},
    };

    expect(ProviderCandidateSchema.safeParse(candidate).success).toBe(true);
  });

  it("accepts a candidate with several populated fields, each a valid Fact", () => {
    const candidate = {
      url: "https://example.com/listing/jump-around-rentals",
      fields: {
        name: fact("Jump Around Rentals"),
        rating: fact(4.9),
        photos: fact(["https://example.com/photo1.jpg"]),
      },
    };

    const result = ProviderCandidateSchema.safeParse(candidate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fields.name?.value).toBe("Jump Around Rentals");
      expect(result.data.fields.rating?.value).toBe(4.9);
      expect(result.data.fields.photos?.value).toEqual([
        "https://example.com/photo1.jpg",
      ]);
    }
  });

  it("rejects a fields object with an invalid inner value (rating.value as a string)", () => {
    const candidate = {
      url: "https://example.com/listing/jump-around-rentals",
      fields: {
        rating: fact("4.9"),
      },
    };

    expect(ProviderCandidateSchema.safeParse(candidate).success).toBe(false);
  });

  it("rejects a non-URL candidate url, same rule as DiscoveredResultSchema", () => {
    const candidate = {
      url: "not-a-url",
      fields: {},
    };

    expect(ProviderCandidateSchema.safeParse(candidate).success).toBe(false);
  });

  it("accepts a candidate with inferred populated (array of tags)", () => {
    const candidate = {
      url: "https://example.com/listing/jump-around-rentals",
      fields: {},
      inferred: [
        {
          value: "good with toddlers",
          evidenceSourceUrl: "https://yelp.com/biz/example",
          evidenceExcerpt: "Great with our 3-year-old",
          sourceType: "yelp",
          retrievedAt: "2026-08-28T12:00:00Z",
        },
      ],
    };

    const result = ProviderCandidateSchema.safeParse(candidate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inferred?.[0].value).toBe("good with toddlers");
      expect(result.data.inferred?.[0].sourceType).toBe("yelp");
    }
  });

  it("accepts a candidate with inferred omitted (existing M7 shape still valid)", () => {
    const candidate = {
      url: "https://example.com/listing/jump-around-rentals",
      fields: {},
    };

    const result = ProviderCandidateSchema.safeParse(candidate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inferred).toBeUndefined();
    }
  });
});
