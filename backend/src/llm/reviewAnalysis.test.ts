import { describe, expect, it } from "vitest";
import { generateStructuredJson, GeminiValidationError, type GeminiClient } from "./geminiClient.js";
import {
  analyzeReviewText,
  type ReviewAnalysisResult,
  type GenerateReviewAnalysisFn,
} from "./reviewAnalysis.js";

function fakeGenerate(result: ReviewAnalysisResult): GenerateReviewAnalysisFn {
  return async () => result;
}

describe("analyzeReviewText", () => {
  it("returns the parsed result (one or more tags with excerpts) from a valid generate response", async () => {
    const result: ReviewAnalysisResult = {
      tags: [
        { tag: "good with toddlers", excerpt: "My 2-year-old loved every minute" },
        { tag: "frequently arrives late", excerpt: "showed up 45 minutes past the booked time" },
      ],
    };

    const returned = await analyzeReviewText({
      url: "https://example.com/reviews/bounce-palace",
      markdown: "Reviews for Bounce Palace...",
      generate: fakeGenerate(result),
    });

    expect(returned).toEqual(result);
  });

  it("accepts an empty tags array as valid (no signal found)", async () => {
    const result: ReviewAnalysisResult = { tags: [] };

    const returned = await analyzeReviewText({
      url: "https://example.com/reviews/bounce-palace",
      markdown: "This page has nothing relevant.",
      generate: fakeGenerate(result),
    });

    expect(returned).toEqual(result);
  });

  it("accepts a tag with excerpt: null", async () => {
    const result: ReviewAnalysisResult = {
      tags: [{ tag: "specializes in large parties", excerpt: null }],
    };

    const returned = await analyzeReviewText({
      url: "https://example.com/reviews/bounce-palace",
      markdown: "Reviews mention large parties a lot, no single quotable line.",
      generate: fakeGenerate(result),
    });

    expect(returned).toEqual(result);
  });

  it("propagates Task 05's validation error when the response fails ReviewAnalysisResultSchema", async () => {
    const fakeClient: GeminiClient = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            tags: [{ tag: "good with toddlers" }],
          }),
        }),
      },
    };
    const generate: GenerateReviewAnalysisFn = (params) =>
      generateStructuredJson({ ...params, client: fakeClient });

    await expect(
      analyzeReviewText({ url: "https://example.com", markdown: "hi", generate })
    ).rejects.toBeInstanceOf(GeminiValidationError);
  });

  it("includes the given url and markdown content in the prompt passed to generate", async () => {
    let capturedPrompt = "";
    const generate: GenerateReviewAnalysisFn = async ({ prompt }) => {
      capturedPrompt = prompt;
      return { tags: [] };
    };

    await analyzeReviewText({
      url: "https://example.com/reviews/bounce-palace",
      markdown: "# Bounce Palace reviews\nGreat with toddlers, always on time.",
      generate,
    });

    expect(capturedPrompt).toContain("https://example.com/reviews/bounce-palace");
    expect(capturedPrompt).toContain("Great with toddlers, always on time.");
  });
});
