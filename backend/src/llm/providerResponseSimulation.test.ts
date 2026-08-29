import { describe, expect, it, vi } from "vitest";
import { generateStructuredJson, GeminiValidationError, type GeminiClient } from "./geminiClient.js";
import { createInitialState } from "../domain/conversation.js";
import type { ProviderCandidate } from "../domain/provider.js";
import {
  simulateProviderAnswers,
  type GenerateSimulatedAnswersFn,
  type SimulatedAnswersResult,
} from "./providerResponseSimulation.js";

function fakeGenerate(result: SimulatedAnswersResult): GenerateSimulatedAnswersFn {
  return async () => result;
}

function candidate(): ProviderCandidate {
  return { url: "https://example.com/provider", fields: {} };
}

describe("simulateProviderAnswers", () => {
  it("returns [] without calling generate when questions is empty", async () => {
    const generate = vi.fn(fakeGenerate({ answers: [] }));

    const result = await simulateProviderAnswers({
      candidate: candidate(),
      questions: [],
      state: createInitialState("s1"),
      generate,
    });

    expect(result).toEqual([]);
    expect(generate).not.toHaveBeenCalled();
  });

  it("returns one simulated answer for one question, calling generate once with question and context", async () => {
    const generate = vi.fn(fakeGenerate({ answers: ["Yes, available on that date."] }));

    const result = await simulateProviderAnswers({
      candidate: candidate(),
      questions: ["Are you available Saturday?"],
      state: createInitialState("s1"),
      generate,
    });

    expect(result).toEqual(["Yes, available on that date."]);
    expect(generate).toHaveBeenCalledTimes(1);
    const promptArg = generate.mock.calls[0][0].prompt;
    expect(promptArg).toContain("Are you available Saturday?");
  });

  it("returns the same count of simulated answers, in order, for multiple questions", async () => {
    const questions = ["Are you available Saturday?", "Does the price include setup and teardown?"];

    const result = await simulateProviderAnswers({
      candidate: candidate(),
      questions,
      state: createInitialState("s1"),
      generate: fakeGenerate({
        answers: ["Yes, available on that date.", "Final price: $425, setup included."],
      }),
    });

    expect(result).toEqual(["Yes, available on that date.", "Final price: $425, setup included."]);
  });

  it("throws when a returned answer is blank/whitespace-only", async () => {
    await expect(
      simulateProviderAnswers({
        candidate: candidate(),
        questions: ["What is the price?"],
        state: createInitialState("s1"),
        generate: fakeGenerate({ answers: ["   "] }),
      }),
    ).rejects.toThrow();
  });

  it("throws when the response array length doesn't match the question count", async () => {
    const questions = ["Are you available Saturday?", "What is the price?"];

    await expect(
      simulateProviderAnswers({
        candidate: candidate(),
        questions,
        state: createInitialState("s1"),
        generate: fakeGenerate({ answers: ["Only one answer?"] }),
      }),
    ).rejects.toThrow();
  });

  it("propagates Task 05's validation error when the response fails SimulatedAnswersResultSchema", async () => {
    const fakeClient: GeminiClient = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({ notAnswers: "oops" }),
        }),
      },
    };
    const generate: GenerateSimulatedAnswersFn = (params) =>
      generateStructuredJson({ ...params, client: fakeClient });

    await expect(
      simulateProviderAnswers({
        candidate: candidate(),
        questions: ["What is the price?"],
        state: createInitialState("s1"),
        generate,
      }),
    ).rejects.toBeInstanceOf(GeminiValidationError);
  });
});
