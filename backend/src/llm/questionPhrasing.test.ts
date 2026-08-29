import { describe, expect, it } from "vitest";
import { generateStructuredJson, GeminiValidationError, type GeminiClient } from "./geminiClient.js";
import { createInitialState, type ConversationState } from "../domain/conversation.js";
import type { MissingAttributeTarget } from "../conversation/questionPolicy.js";
import {
  generatePendingQuestion,
  type GeneratePendingQuestionFn,
  type PendingQuestionResult,
} from "./questionPhrasing.js";

function fakeGenerate(result: PendingQuestionResult): GeneratePendingQuestionFn {
  return async () => result;
}

describe("generatePendingQuestion", () => {
  it("returns the question string from a valid generate response", async () => {
    const target: MissingAttributeTarget = { kind: "core", field: "dateTime" };

    const returned = await generatePendingQuestion({
      target,
      state: createInitialState("s1"),
      generate: fakeGenerate({ question: "When would you like the event to take place?" }),
    });

    expect(returned).toBe("When would you like the event to take place?");
  });

  it("includes the target's field/attribute name and description in the prompt", async () => {
    let capturedPrompt = "";
    const target: MissingAttributeTarget = {
      kind: "category",
      name: "budget",
      description: "the party budget",
      importance: "required",
    };
    const generate: GeneratePendingQuestionFn = async ({ prompt }) => {
      capturedPrompt = prompt;
      return { question: "What's your budget for this?" };
    };

    await generatePendingQuestion({ target, state: createInitialState("s1"), generate });

    expect(capturedPrompt).toContain("budget");
    expect(capturedPrompt).toContain("the party budget");
  });

  it("includes already-known state in the prompt for context-aware phrasing", async () => {
    let capturedPrompt = "";
    const target: MissingAttributeTarget = { kind: "core", field: "location" };
    const state: ConversationState = {
      ...createInitialState("s1"),
      serviceCategory: "bounce house rental",
      categoryAttributes: {
        waterSlide: { description: "whether a water slide is wanted", importance: "optional", value: "yes" },
      },
    };
    const generate: GeneratePendingQuestionFn = async ({ prompt }) => {
      capturedPrompt = prompt;
      return { question: "Where will the event be held?" };
    };

    await generatePendingQuestion({ target, state, generate });

    expect(capturedPrompt).toContain("bounce house rental");
    expect(capturedPrompt).toContain("waterSlide");
  });

  it("propagates Task 05's validation error when the response fails PendingQuestionSchema", async () => {
    const fakeClient: GeminiClient = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({ notQuestion: "oops" }),
        }),
      },
    };
    const generate: GeneratePendingQuestionFn = (params) =>
      generateStructuredJson({ ...params, client: fakeClient });
    const target: MissingAttributeTarget = { kind: "core", field: "dateTime" };

    await expect(
      generatePendingQuestion({ target, state: createInitialState("s1"), generate })
    ).rejects.toBeInstanceOf(GeminiValidationError);
  });

  it("throws a clear error when generate returns an empty question", async () => {
    const target: MissingAttributeTarget = { kind: "core", field: "dateTime" };

    await expect(
      generatePendingQuestion({
        target,
        state: createInitialState("s1"),
        generate: fakeGenerate({ question: "" }),
      })
    ).rejects.toThrow();
  });

  it("throws a clear error when generate returns a whitespace-only question", async () => {
    const target: MissingAttributeTarget = { kind: "core", field: "dateTime" };

    await expect(
      generatePendingQuestion({
        target,
        state: createInitialState("s1"),
        generate: fakeGenerate({ question: "   " }),
      })
    ).rejects.toThrow();
  });

  it("trims leading/trailing whitespace from the returned question", async () => {
    const target: MissingAttributeTarget = { kind: "core", field: "location" };

    const returned = await generatePendingQuestion({
      target,
      state: createInitialState("s1"),
      generate: fakeGenerate({ question: "  Where will the event be held?  " }),
    });

    expect(returned).toBe("Where will the event be held?");
  });
});
