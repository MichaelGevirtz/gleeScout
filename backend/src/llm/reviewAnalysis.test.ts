import { describe, expect, it } from "vitest";
import { generateStructuredJson, GeminiValidationError, type GeminiClient } from "./geminiClient.js";
import {
  analyzeReviewText,
  ReviewAnalysisResultSchema,
  type ReviewAnalysisResult,
  type GenerateReviewAnalysisFn,
} from "./reviewAnalysis.js";

function fakeGenerate(result: ReviewAnalysisResult): GenerateReviewAnalysisFn {
  return async () => result;
}

const NO_RATING = { rating: null, reviewCount: null, ratingSourceUrl: null } as const;

const ONE_PAGE = [
  { url: "https://example.com/reviews/bounce-palace", markdown: "Reviews for Bounce Palace..." },
];

describe("analyzeReviewText", () => {
  it("returns the parsed result (one or more tags with excerpts) from a valid generate response", async () => {
    const result: ReviewAnalysisResult = {
      tags: [
        { tag: "good with toddlers", excerpt: "My 2-year-old loved every minute" },
        { tag: "frequently arrives late", excerpt: "showed up 45 minutes past the booked time" },
      ],
      ...NO_RATING,
    };

    const returned = await analyzeReviewText({ pages: ONE_PAGE, generate: fakeGenerate(result) });

    expect(returned).toEqual(result);
  });

  it("accepts an empty tags array as valid (no signal found)", async () => {
    const result: ReviewAnalysisResult = { tags: [], ...NO_RATING };

    const returned = await analyzeReviewText({ pages: ONE_PAGE, generate: fakeGenerate(result) });

    expect(returned).toEqual(result);
  });

  it("accepts a tag with excerpt: null", async () => {
    const result: ReviewAnalysisResult = {
      tags: [{ tag: "specializes in large parties", excerpt: null }],
      ...NO_RATING,
    };

    const returned = await analyzeReviewText({ pages: ONE_PAGE, generate: fakeGenerate(result) });

    expect(returned).toEqual(result);
  });

  it("returns a rating, review count, and the source url they came from", async () => {
    const result: ReviewAnalysisResult = {
      tags: [],
      rating: 4.8,
      reviewCount: 340,
      ratingSourceUrl: "https://www.yelp.com/biz/bounce-palace",
    };

    const returned = await analyzeReviewText({ pages: ONE_PAGE, generate: fakeGenerate(result) });

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

    await expect(analyzeReviewText({ pages: ONE_PAGE, generate })).rejects.toBeInstanceOf(
      GeminiValidationError
    );
  });

  it("includes every supplied page's url and markdown content in the single prompt passed to generate", async () => {
    let capturedPrompt = "";
    let callCount = 0;
    const generate: GenerateReviewAnalysisFn = async ({ prompt }) => {
      callCount++;
      capturedPrompt = prompt;
      return { tags: [], ...NO_RATING };
    };

    await analyzeReviewText({
      pages: [
        {
          url: "https://www.yelp.com/biz/bounce-palace",
          markdown: "# Bounce Palace reviews\nGreat with toddlers, always on time.",
        },
        {
          url: "https://www.google.com/search?q=bounce+palace",
          markdown: "4.8 stars from 340 reviews",
        },
      ],
      generate,
    });

    // The whole point of concatenating pages: two sources, one Gemini call.
    expect(callCount).toBe(1);
    expect(capturedPrompt).toContain("https://www.yelp.com/biz/bounce-palace");
    expect(capturedPrompt).toContain("Great with toddlers, always on time.");
    expect(capturedPrompt).toContain("https://www.google.com/search?q=bounce+palace");
    expect(capturedPrompt).toContain("4.8 stars from 340 reviews");
  });
});

describe("ReviewAnalysisResultSchema", () => {
  it("rejects a rating outside the 1-5 range", () => {
    const parsed = ReviewAnalysisResultSchema.safeParse({
      tags: [],
      rating: 9,
      reviewCount: 10,
      ratingSourceUrl: "https://www.yelp.com/biz/x",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects a fractional review count", () => {
    const parsed = ReviewAnalysisResultSchema.safeParse({
      tags: [],
      rating: 4.5,
      reviewCount: 10.5,
      ratingSourceUrl: "https://www.yelp.com/biz/x",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts nulls for all three rating fields", () => {
    const parsed = ReviewAnalysisResultSchema.safeParse({
      tags: [],
      rating: null,
      reviewCount: null,
      ratingSourceUrl: null,
    });

    expect(parsed.success).toBe(true);
  });
});
