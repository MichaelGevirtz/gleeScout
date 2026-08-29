import { describe, expect, it } from "vitest";
import { generateStructuredJson, GeminiValidationError, type GeminiClient } from "./geminiClient.js";
import {
  extractProviderFacts,
  type ProviderExtractionResult,
  type GenerateProviderExtractionFn,
} from "./providerExtraction.js";

function fakeGenerate(result: ProviderExtractionResult): GenerateProviderExtractionFn {
  return async () => result;
}

describe("extractProviderFacts", () => {
  it("returns the parsed result as-is from a fully-populated generate response", async () => {
    const result: ProviderExtractionResult = {
      name: "Bounce Palace",
      location: "Austin, TX",
      servicesOffered: ["bounce house rental", "water slides"],
      pricing: "$200/day",
      availability: "weekends only",
      rating: 4.8,
      reviewCount: 120,
      photos: ["https://example.com/photo1.jpg"],
      policies: "50% deposit required",
      contactMethod: "phone: 555-1234",
    };

    const returned = await extractProviderFacts({
      url: "https://example.com",
      markdown: "# Bounce Palace\nAustin, TX\n$200/day",
      generate: fakeGenerate(result),
    });

    expect(returned).toEqual(result);
  });

  it("accepts an all-null result when the page had nothing useful", async () => {
    const result: ProviderExtractionResult = {
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

    const returned = await extractProviderFacts({
      url: "https://example.com",
      markdown: "This page has nothing relevant.",
      generate: fakeGenerate(result),
    });

    expect(returned).toEqual(result);
  });

  it("propagates Task 05's validation error when the response fails ProviderExtractionResultSchema", async () => {
    const fakeClient: GeminiClient = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            name: "Bounce Palace",
            // missing every other required (nullable-but-present) field
          }),
        }),
      },
    };
    const generate: GenerateProviderExtractionFn = (params) =>
      generateStructuredJson({ ...params, client: fakeClient });

    await expect(
      extractProviderFacts({ url: "https://example.com", markdown: "hi", generate })
    ).rejects.toBeInstanceOf(GeminiValidationError);
  });

  it("propagates Task 05's parse error when the response is not valid JSON", async () => {
    const fakeClient: GeminiClient = {
      models: {
        generateContent: async () => ({ text: "not json" }),
      },
    };
    const generate: GenerateProviderExtractionFn = (params) =>
      generateStructuredJson({ ...params, client: fakeClient });

    await expect(
      extractProviderFacts({ url: "https://example.com", markdown: "hi", generate })
    ).rejects.toThrow();
  });

  it("includes the given url and markdown content in the prompt passed to generate", async () => {
    let capturedPrompt = "";
    const generate: GenerateProviderExtractionFn = async ({ prompt }) => {
      capturedPrompt = prompt;
      return {
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
    };

    await extractProviderFacts({
      url: "https://example.com/providers/bounce-palace",
      markdown: "# Bounce Palace\nServing Austin, TX since 2010.",
      generate,
    });

    expect(capturedPrompt).toContain("https://example.com/providers/bounce-palace");
    expect(capturedPrompt).toContain("Serving Austin, TX since 2010.");
  });
});
