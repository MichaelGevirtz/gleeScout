import { z } from "zod";
import { describe, expect, it } from "vitest";
import { FactSchema, InferredSchema, SimulatedSchema } from "./evidence.js";

describe("FactSchema", () => {
  it("accepts a valid Fact with a string value", () => {
    const fact = {
      value: "$350",
      source: "provider website",
      sourceUrl: "https://example.com/pricing",
      retrievedAt: "2026-08-28T12:00:00Z",
    };

    expect(FactSchema(z.string()).safeParse(fact).success).toBe(true);
  });

  it("accepts a valid Fact with a different inner value schema (number)", () => {
    const fact = {
      value: 4.8,
      source: "Google reviews",
      sourceUrl: "https://google.com/maps/place/example",
      retrievedAt: "2026-08-28T12:00:00Z",
    };

    expect(FactSchema(z.number()).safeParse(fact).success).toBe(true);
  });

  it("rejects a Fact missing value", () => {
    const fact = {
      source: "provider website",
      sourceUrl: "https://example.com/pricing",
      retrievedAt: "2026-08-28T12:00:00Z",
    };

    expect(FactSchema(z.string()).safeParse(fact).success).toBe(false);
  });

  it("rejects a Fact missing source", () => {
    const fact = {
      value: "$350",
      sourceUrl: "https://example.com/pricing",
      retrievedAt: "2026-08-28T12:00:00Z",
    };

    expect(FactSchema(z.string()).safeParse(fact).success).toBe(false);
  });

  it("rejects a Fact missing sourceUrl", () => {
    const fact = {
      value: "$350",
      source: "provider website",
      retrievedAt: "2026-08-28T12:00:00Z",
    };

    expect(FactSchema(z.string()).safeParse(fact).success).toBe(false);
  });

  it("rejects a Fact missing retrievedAt", () => {
    const fact = {
      value: "$350",
      source: "provider website",
      sourceUrl: "https://example.com/pricing",
    };

    expect(FactSchema(z.string()).safeParse(fact).success).toBe(false);
  });

  it("rejects a Fact with a non-URL sourceUrl", () => {
    const fact = {
      value: "$350",
      source: "provider website",
      sourceUrl: "not-a-url",
      retrievedAt: "2026-08-28T12:00:00Z",
    };

    expect(FactSchema(z.string()).safeParse(fact).success).toBe(false);
  });

  it("rejects a Fact with a non-ISO-8601 retrievedAt", () => {
    const fact = {
      value: "$350",
      source: "provider website",
      sourceUrl: "https://example.com/pricing",
      retrievedAt: "yesterday",
    };

    expect(FactSchema(z.string()).safeParse(fact).success).toBe(false);
  });
});

describe("InferredSchema", () => {
  const inferred = (overrides: Partial<Record<string, unknown>> = {}) => ({
    value: "good with toddlers",
    evidenceSourceUrl: "https://yelp.com/biz/example",
    evidenceExcerpt: "The staff was so patient with our 3-year-old!",
    sourceType: "yelp",
    retrievedAt: "2026-08-28T12:00:00Z",
    ...overrides,
  });

  it("accepts a value with all fields populated", () => {
    expect(InferredSchema(z.string()).safeParse(inferred()).success).toBe(true);
  });

  it("accepts a value with evidenceExcerpt omitted", () => {
    const value = inferred();
    delete (value as Partial<typeof value>).evidenceExcerpt;

    expect(InferredSchema(z.string()).safeParse(value).success).toBe(true);
  });

  it("rejects a non-URL evidenceSourceUrl", () => {
    const value = inferred({ evidenceSourceUrl: "not-a-url" });

    expect(InferredSchema(z.string()).safeParse(value).success).toBe(false);
  });

  it("rejects a non-ISO retrievedAt", () => {
    const value = inferred({ retrievedAt: "yesterday" });

    expect(InferredSchema(z.string()).safeParse(value).success).toBe(false);
  });

  it.each(["google", "yelp", "provider_website", "directory", "other"])(
    "accepts sourceType %s",
    (sourceType) => {
      const value = inferred({ sourceType });

      expect(InferredSchema(z.string()).safeParse(value).success).toBe(true);
    }
  );

  it("rejects a sourceType outside the enum", () => {
    const value = inferred({ sourceType: "facebook" });

    expect(InferredSchema(z.string()).safeParse(value).success).toBe(false);
  });
});

describe("SimulatedSchema", () => {
  it("accepts a valid Simulated with a string value", () => {
    const simulated = {
      value: "Yes, we can accommodate 50 guests that weekend.",
      generatedAt: "2026-08-28T12:00:00Z",
    };

    expect(SimulatedSchema(z.string()).safeParse(simulated).success).toBe(true);
  });

  it("rejects a Simulated missing value", () => {
    const simulated = {
      generatedAt: "2026-08-28T12:00:00Z",
    };

    expect(SimulatedSchema(z.string()).safeParse(simulated).success).toBe(false);
  });

  it("rejects a Simulated with a non-ISO-8601 generatedAt", () => {
    const simulated = {
      value: "Yes, we can accommodate 50 guests that weekend.",
      generatedAt: "yesterday",
    };

    expect(SimulatedSchema(z.string()).safeParse(simulated).success).toBe(false);
  });

  it("rejects a Simulated carrying Fact/Inferred-shaped fields but missing value/generatedAt", () => {
    const simulated = {
      source: "provider website",
      sourceUrl: "https://example.com/pricing",
      evidenceExcerpt: "some excerpt",
      sourceType: "yelp",
      retrievedAt: "2026-08-28T12:00:00Z",
    };

    expect(SimulatedSchema(z.string()).safeParse(simulated).success).toBe(false);
  });

  it("parses only value/generatedAt even when Fact/Inferred-shaped fields are also present", () => {
    const simulated = {
      value: "Yes, we can accommodate 50 guests that weekend.",
      generatedAt: "2026-08-28T12:00:00Z",
      source: "provider website",
      sourceUrl: "https://example.com/pricing",
      evidenceExcerpt: "some excerpt",
      sourceType: "yelp",
      retrievedAt: "2026-08-28T11:00:00Z",
    };

    const result = SimulatedSchema(z.string()).safeParse(simulated);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data).sort()).toEqual(["generatedAt", "value"]);
    }
  });
});
