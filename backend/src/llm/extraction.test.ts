import { describe, expect, it } from "vitest";
import { generateStructuredJson, GeminiValidationError, type GeminiClient } from "./geminiClient.js";
import { createInitialState, type ConversationState } from "../domain/conversation.js";
import { extractRequirements, type ExtractionResult, type GenerateExtractionFn } from "./extraction.js";

function fakeGenerate(result: ExtractionResult): GenerateExtractionFn {
  return async () => result;
}

describe("extractRequirements", () => {
  it("returns the parsed extraction result from a valid generate response", async () => {
    const result: ExtractionResult = {
      serviceCategory: "bounce house rental",
      coreAttributes: { dateTime: "next Saturday", location: null },
      categoryAttributes: [
        { name: "size", description: "how big a bounce house is wanted", importance: "required", value: "large" },
        { name: "waterSlide", description: "whether a water slide is wanted", importance: "optional", value: null },
      ],
    };

    const returned = await extractRequirements({
      message: "I need a large bounce house for next Saturday",
      state: createInitialState("s1"),
      generate: fakeGenerate(result),
    });

    expect(returned).toEqual(result);
  });

  it("propagates Task 05's validation error when the response fails ExtractionResultSchema", async () => {
    const fakeClient: GeminiClient = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            serviceCategory: "bounce house rental",
            coreAttributes: { dateTime: null, location: null },
            categoryAttributes: [{ name: "size", description: "how big" }], // missing importance & value
          }),
        }),
      },
    };
    const generate: GenerateExtractionFn = (params) =>
      generateStructuredJson({ ...params, client: fakeClient });

    await expect(
      extractRequirements({ message: "hi", state: createInitialState("s1"), generate })
    ).rejects.toBeInstanceOf(GeminiValidationError);
  });

  it("includes the current known state in the prompt passed to generate", async () => {
    let capturedPrompt = "";
    const generate: GenerateExtractionFn = async ({ prompt }) => {
      capturedPrompt = prompt;
      return {
        serviceCategory: "bounce house rental",
        coreAttributes: { dateTime: null, location: null },
        categoryAttributes: [],
      };
    };

    const state: ConversationState = {
      ...createInitialState("s1"),
      serviceCategory: "bounce house rental",
      coreAttributes: { location: "Austin, TX" },
      categoryAttributes: {
        waterSlide: {
          description: "whether a water slide is wanted",
          importance: "optional",
          value: "yes",
        },
      },
    };

    await extractRequirements({ message: "what about pricing?", state, generate });

    expect(capturedPrompt).toContain("bounce house rental");
    expect(capturedPrompt).toContain("Austin, TX");
    expect(capturedPrompt).toContain("waterSlide");
  });

  it("returns a null value as-is instead of backfilling from known state", async () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      serviceCategory: "bounce house rental",
      categoryAttributes: {
        waterSlide: {
          description: "whether a water slide is wanted",
          importance: "optional",
          value: "yes",
        },
      },
    };

    const result: ExtractionResult = {
      serviceCategory: "bounce house rental",
      coreAttributes: { dateTime: null, location: null },
      categoryAttributes: [
        { name: "waterSlide", description: "whether a water slide is wanted", importance: "optional", value: null },
      ],
    };

    const returned = await extractRequirements({
      message: "what's the price?",
      state,
      generate: fakeGenerate(result),
    });

    expect(returned.categoryAttributes[0].value).toBeNull();
  });
});
