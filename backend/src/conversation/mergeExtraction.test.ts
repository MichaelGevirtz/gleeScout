import { describe, expect, it } from "vitest";
import { createInitialState, type ConversationState } from "../domain/conversation.js";
import type { ExtractionResult } from "../llm/extraction.js";
import { mergeExtraction } from "./mergeExtraction.js";

function emptyExtraction(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    serviceCategory: null,
    coreAttributes: { dateTime: null, location: null },
    categoryAttributes: [],
    ...overrides,
  };
}

describe("mergeExtraction", () => {
  it("adopts category attribute definitions when categoryAttributes starts empty", () => {
    const state = createInitialState("s1");
    const extraction = emptyExtraction({
      categoryAttributes: [
        { name: "waterSlide", description: "whether a water slide is wanted", importance: "optional", value: null },
      ],
    });

    const result = mergeExtraction({ state, extraction, userMessage: "hi" });

    expect(result.categoryAttributes.waterSlide).toEqual({
      description: "whether a water slide is wanted",
      importance: "optional",
      value: null,
    });
  });

  it("preserves an already-set core attribute when the extraction returns null for it", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      coreAttributes: { location: "Austin, TX" },
    };
    const extraction = emptyExtraction();

    const result = mergeExtraction({ state, extraction, userMessage: "what's the price?" });

    expect(result.coreAttributes.location).toBe("Austin, TX");
  });

  it("overwrites an already-set core attribute when the extraction returns a new non-null value", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      coreAttributes: { dateTime: "next Saturday" },
    };
    const extraction = emptyExtraction({ coreAttributes: { dateTime: "next Sunday", location: null } });

    const result = mergeExtraction({ state, extraction, userMessage: "actually make it Sunday" });

    expect(result.coreAttributes.dateTime).toBe("next Sunday");
  });

  it("moves a category attribute's value from null to a value supplied by the extraction", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      categoryAttributes: {
        waterSlide: { description: "whether a water slide is wanted", importance: "optional", value: null },
      },
    };
    const extraction = emptyExtraction({
      categoryAttributes: [
        { name: "waterSlide", description: "whether a water slide is wanted", importance: "optional", value: "yes" },
      ],
    });

    const result = mergeExtraction({ state, extraction, userMessage: "yes to the water slide" });

    expect(result.categoryAttributes.waterSlide.value).toBe("yes");
  });

  it("updates a category attribute's importance when a later extraction revises it", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      categoryAttributes: {
        style: { description: "the party's theme/style", importance: "optional", value: null },
      },
    };
    const extraction = emptyExtraction({
      categoryAttributes: [
        { name: "style", description: "the party's theme/style", importance: "required", value: null },
      ],
    });

    const result = mergeExtraction({ state, extraction, userMessage: "it needs to match our theme exactly" });

    expect(result.categoryAttributes.style.importance).toBe("required");
  });

  it("leaves a category attribute unchanged when a later extraction's list omits it", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      categoryAttributes: {
        waterSlide: { description: "whether a water slide is wanted", importance: "optional", value: "yes" },
      },
    };
    const extraction = emptyExtraction({ categoryAttributes: [] });

    const result = mergeExtraction({ state, extraction, userMessage: "what's the price?" });

    expect(result.categoryAttributes.waterSlide).toEqual({
      description: "whether a water slide is wanted",
      importance: "optional",
      value: "yes",
    });
  });

  it("does not change serviceCategory once set, even when a later extraction proposes a different one", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      serviceCategory: "bounce house rental",
    };
    const extraction = emptyExtraction({ serviceCategory: "clown" });

    const result = mergeExtraction({ state, extraction, userMessage: "actually forget the bounce house, find me a clown" });

    expect(result.serviceCategory).toBe("bounce house rental");
  });

  it("appends the user message to messages", () => {
    const state = createInitialState("s1");
    const extraction = emptyExtraction();

    const result = mergeExtraction({ state, extraction, userMessage: "hello there" });

    expect(result.messages).toEqual([{ role: "user", content: "hello there" }]);
  });

  it("leaves phase unchanged", () => {
    const state = createInitialState("s1");
    const extraction = emptyExtraction();

    const result = mergeExtraction({ state, extraction, userMessage: "hi" });

    expect(result.phase).toBe(state.phase);
  });

  it("does not mutate the input state", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      serviceCategory: "bounce house rental",
      coreAttributes: { location: "Austin, TX" },
      categoryAttributes: {
        waterSlide: { description: "whether a water slide is wanted", importance: "optional", value: null },
      },
    };
    const snapshot = JSON.parse(JSON.stringify(state));
    const extraction = emptyExtraction({
      coreAttributes: { dateTime: "next Saturday", location: null },
      categoryAttributes: [
        { name: "waterSlide", description: "whether a water slide is wanted", importance: "optional", value: "yes" },
      ],
    });

    const result = mergeExtraction({ state, extraction, userMessage: "yes to the water slide, next Saturday" });

    expect(result).not.toBe(state);
    expect(state).toEqual(snapshot);
  });
});
