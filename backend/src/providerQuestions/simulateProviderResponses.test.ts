import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createInitialState } from "../domain/conversation.js";
import { SimulatedSchema } from "../domain/evidence.js";
import type { ProviderCandidate } from "../domain/provider.js";
import {
  simulateProviderResponses,
  type AssembleFn,
  type SimulateFn,
} from "./simulateProviderResponses.js";

function candidate(): ProviderCandidate {
  return { url: "https://example.com/provider", fields: {} };
}

const GENERATED_AT = "2026-01-01T00:00:00.000Z";

describe("simulateProviderResponses", () => {
  it("non-empty questions: calls simulate then assemble with the right arguments, returns assemble's result", async () => {
    const c = candidate();
    const state = createInitialState("s1");
    const questions = ["Are you available Saturday?", "What is your pricing?"];
    const answers = ["Yes, we're available.", "$350."];
    const assembled = [
      { question: questions[0], answer: { value: answers[0], generatedAt: GENERATED_AT } },
      { question: questions[1], answer: { value: answers[1], generatedAt: GENERATED_AT } },
    ];

    const simulate: SimulateFn = vi.fn(async () => answers);
    const assemble: AssembleFn = vi.fn(() => assembled);

    const result = await simulateProviderResponses({
      candidate: c,
      questions,
      state,
      generatedAt: GENERATED_AT,
      simulate,
      assemble,
    });

    expect(simulate).toHaveBeenCalledWith({ candidate: c, questions, state });
    expect(assemble).toHaveBeenCalledWith({ questions, answers, generatedAt: GENERATED_AT });
    expect(result).toBe(assembled);
  });

  it("empty questions: simulate still called with [], assemble still called with empty arrays, result is []", async () => {
    const c = candidate();
    const state = createInitialState("s1");

    const simulate: SimulateFn = vi.fn(async () => []);
    const assemble: AssembleFn = vi.fn(() => []);

    const result = await simulateProviderResponses({
      candidate: c,
      questions: [],
      state,
      generatedAt: GENERATED_AT,
      simulate,
      assemble,
    });

    expect(simulate).toHaveBeenCalledWith({ candidate: c, questions: [], state });
    expect(assemble).toHaveBeenCalledWith({ questions: [], answers: [], generatedAt: GENERATED_AT });
    expect(result).toEqual([]);
  });

  it("propagates an error thrown by simulate, without calling assemble", async () => {
    const c = candidate();
    const state = createInitialState("s1");

    const simulate: SimulateFn = () => {
      throw new Error("simulate failed");
    };
    const assemble: AssembleFn = vi.fn(() => []);

    await expect(
      simulateProviderResponses({
        candidate: c,
        questions: ["Q?"],
        state,
        generatedAt: GENERATED_AT,
        simulate,
        assemble,
      }),
    ).rejects.toThrow("simulate failed");
    expect(assemble).not.toHaveBeenCalled();
  });

  it("propagates an error thrown by assemble", async () => {
    const c = candidate();
    const state = createInitialState("s1");

    const simulate: SimulateFn = vi.fn(async () => ["A"]);
    const assemble: AssembleFn = () => {
      throw new Error("assemble failed");
    };

    await expect(
      simulateProviderResponses({
        candidate: c,
        questions: ["Q?"],
        state,
        generatedAt: GENERATED_AT,
        simulate,
        assemble,
      }),
    ).rejects.toThrow("assemble failed");
  });

  it("end-to-end with fake simulate + real assemble: full call sequence, return shape, and Simulated<string> validation", async () => {
    const c = candidate();
    const state = createInitialState("s1");
    const questions = ["Are you available Saturday?", "What is your pricing?"];

    const simulate: SimulateFn = vi.fn(async ({ questions: qs }) =>
      qs.map((q) => `Simulated answer to: ${q}`),
    );

    const result = await simulateProviderResponses({
      candidate: c,
      questions,
      state,
      generatedAt: GENERATED_AT,
      simulate,
    });

    expect(simulate).toHaveBeenCalledWith({ candidate: c, questions, state });
    expect(result).toEqual([
      {
        question: "Are you available Saturday?",
        answer: { value: "Simulated answer to: Are you available Saturday?", generatedAt: GENERATED_AT },
      },
      {
        question: "What is your pricing?",
        answer: { value: "Simulated answer to: What is your pricing?", generatedAt: GENERATED_AT },
      },
    ]);
    for (const { answer } of result) {
      expect(SimulatedSchema(z.string()).safeParse(answer).success).toBe(true);
    }
  });

  it("does not mutate the candidate passed in", async () => {
    const c = candidate();
    const before = JSON.stringify(c);
    const state = createInitialState("s1");

    const simulate: SimulateFn = vi.fn(async () => ["A"]);

    await simulateProviderResponses({
      candidate: c,
      questions: ["Q?"],
      state,
      generatedAt: GENERATED_AT,
      simulate,
    });

    expect(JSON.stringify(c)).toBe(before);
  });
});
