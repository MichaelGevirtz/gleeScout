import { describe, expect, it } from "vitest";
import { createInitialState, type ConversationState } from "../domain/conversation.js";
import type { ProviderCandidate } from "../domain/provider.js";
import type { Simulated } from "../domain/evidence.js";
import { selectProvider, type PrepareQuestionsFn, type SimulateFn } from "./selectProvider.js";

const candidate: ProviderCandidate = { url: "https://a.example", fields: {} };

function state(): ConversationState {
  return {
    ...createInitialState("s1"),
    serviceCategory: "bounce house rental",
    coreAttributes: { dateTime: "next Saturday", location: "Austin, TX" },
  };
}

describe("selectProvider", () => {
  it("calls prepareQuestions with the candidate and state, then simulate with the candidate, prepareQuestions's result as questions, the state, and a generated generatedAt, returning simulate's result unchanged", async () => {
    const questions = ["Are you available Saturday?", "Does the price include setup?"];
    const answers: { question: string; answer: Simulated<string> }[] = [
      { question: questions[0]!, answer: { value: "Yes", generatedAt: "2026-08-28T00:00:00.000Z" } },
      { question: questions[1]!, answer: { value: "Yes, setup is included", generatedAt: "2026-08-28T00:00:00.000Z" } },
    ];

    let capturedPrepareParams: { candidate: ProviderCandidate; state: ConversationState } | undefined;
    let capturedSimulateParams:
      | { candidate: ProviderCandidate; questions: string[]; state: ConversationState; generatedAt: string }
      | undefined;

    const prepareQuestions: PrepareQuestionsFn = async (params) => {
      capturedPrepareParams = params;
      return questions;
    };
    const simulate: SimulateFn = async (params) => {
      capturedSimulateParams = params;
      return answers;
    };

    const s = state();
    const result = await selectProvider({ candidate, state: s, prepareQuestions, simulate });

    expect(capturedPrepareParams).toEqual({ candidate, state: s });
    expect(capturedSimulateParams?.candidate).toBe(candidate);
    expect(capturedSimulateParams?.questions).toBe(questions);
    expect(capturedSimulateParams?.state).toBe(s);
    expect(typeof capturedSimulateParams?.generatedAt).toBe("string");
    expect(() => new Date(capturedSimulateParams!.generatedAt).toISOString()).not.toThrow();
    expect(result).toBe(answers);
  });

  it("propagates a rejection from prepareQuestions without swallowing it, and never calls simulate", async () => {
    const prepareQuestions: PrepareQuestionsFn = async () => {
      throw new Error("gap analysis / phrasing failed");
    };
    let simulateCalled = false;
    const simulate: SimulateFn = async () => {
      simulateCalled = true;
      return [];
    };

    await expect(
      selectProvider({ candidate, state: state(), prepareQuestions, simulate })
    ).rejects.toThrow("gap analysis / phrasing failed");
    expect(simulateCalled).toBe(false);
  });

  it("propagates a rejection from simulate without swallowing it", async () => {
    const prepareQuestions: PrepareQuestionsFn = async () => ["Are you available Saturday?"];
    const simulate: SimulateFn = async () => {
      throw new Error("simulation failed");
    };

    await expect(
      selectProvider({ candidate, state: state(), prepareQuestions, simulate })
    ).rejects.toThrow("simulation failed");
  });
});
