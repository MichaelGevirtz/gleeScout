import { describe, expect, it, vi } from "vitest";
import { generateStructuredJson, GeminiValidationError, type GeminiClient } from "./geminiClient.js";
import { createInitialState } from "../domain/conversation.js";
import type { ProviderCandidate } from "../domain/provider.js";
import type { ProviderGap } from "../providerQuestions/types.js";
import {
  generateProviderQuestions,
  type GenerateProviderQuestionsFn,
  type ProviderQuestionsResult,
} from "./providerQuestionPhrasing.js";

function fakeGenerate(result: ProviderQuestionsResult): GenerateProviderQuestionsFn {
  return async () => result;
}

function candidate(): ProviderCandidate {
  return { url: "https://example.com/provider", fields: {} };
}

describe("generateProviderQuestions", () => {
  it("returns [] without calling generate when gaps is empty", async () => {
    const generate = vi.fn(fakeGenerate({ questions: [] }));

    const result = await generateProviderQuestions({
      candidate: candidate(),
      gaps: [],
      state: createInitialState("s1"),
      generate,
    });

    expect(result).toEqual([]);
    expect(generate).not.toHaveBeenCalled();
  });

  it("returns one phrased question for one gap", async () => {
    const gaps: ProviderGap[] = [{ topic: "availability", description: "Confirm availability for Saturday." }];

    const result = await generateProviderQuestions({
      candidate: candidate(),
      gaps,
      state: createInitialState("s1"),
      generate: fakeGenerate({ questions: ["Are you available Saturday?"] }),
    });

    expect(result).toEqual(["Are you available Saturday?"]);
  });

  it("returns the same count of phrased questions, in order, for multiple gaps", async () => {
    const gaps: ProviderGap[] = [
      { topic: "availability", description: "Confirm availability for Saturday." },
      { topic: "pricing", description: "Confirm what the price includes." },
    ];

    const result = await generateProviderQuestions({
      candidate: candidate(),
      gaps,
      state: createInitialState("s1"),
      generate: fakeGenerate({
        questions: ["Are you available Saturday?", "Does the price include setup and teardown?"],
      }),
    });

    expect(result).toEqual(["Are you available Saturday?", "Does the price include setup and teardown?"]);
  });

  it("throws when a returned question is blank/whitespace-only", async () => {
    const gaps: ProviderGap[] = [{ topic: "pricing", description: "Confirm pricing." }];

    await expect(
      generateProviderQuestions({
        candidate: candidate(),
        gaps,
        state: createInitialState("s1"),
        generate: fakeGenerate({ questions: ["   "] }),
      }),
    ).rejects.toThrow();
  });

  it("throws when the response array length doesn't match the gap count", async () => {
    const gaps: ProviderGap[] = [
      { topic: "availability", description: "Confirm availability." },
      { topic: "pricing", description: "Confirm pricing." },
    ];

    await expect(
      generateProviderQuestions({
        candidate: candidate(),
        gaps,
        state: createInitialState("s1"),
        generate: fakeGenerate({ questions: ["Only one question?"] }),
      }),
    ).rejects.toThrow();
  });

  it("propagates Task 05's validation error when the response fails ProviderQuestionsResultSchema", async () => {
    const fakeClient: GeminiClient = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({ notQuestions: "oops" }),
        }),
      },
    };
    const generate: GenerateProviderQuestionsFn = (params) =>
      generateStructuredJson({ ...params, client: fakeClient });
    const gaps: ProviderGap[] = [{ topic: "pricing", description: "Confirm pricing." }];

    await expect(
      generateProviderQuestions({ candidate: candidate(), gaps, state: createInitialState("s1"), generate }),
    ).rejects.toBeInstanceOf(GeminiValidationError);
  });
});
