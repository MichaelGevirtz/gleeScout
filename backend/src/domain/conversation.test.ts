import { describe, expect, it } from "vitest";
import { ConversationStateSchema, createInitialState } from "./conversation.js";

describe("ConversationState schema", () => {
  it("accepts the output of createInitialState", () => {
    const state = createInitialState("session-1");

    expect(ConversationStateSchema.safeParse(state).success).toBe(true);
  });

  it("accepts a minimal valid ConversationState", () => {
    const state = {
      sessionId: "session-1",
      phase: "gathering",
      serviceCategory: null,
      coreAttributes: {},
      categoryAttributes: {},
      messages: [],
    };

    expect(ConversationStateSchema.safeParse(state).success).toBe(true);
  });

  it("accepts a required category attribute with an unanswered (null) value", () => {
    const state = {
      sessionId: "session-1",
      phase: "gathering",
      serviceCategory: "bounce house",
      coreAttributes: { location: "Austin, TX" },
      categoryAttributes: {
        waterSlide: {
          description: "whether a water slide is wanted",
          importance: "required",
          value: null,
        },
      },
      messages: [],
    };

    expect(ConversationStateSchema.safeParse(state).success).toBe(true);
  });

  it("rejects an invalid phase value", () => {
    const state = {
      sessionId: "session-1",
      phase: "not-a-real-phase",
      serviceCategory: null,
      coreAttributes: {},
      categoryAttributes: {},
      messages: [],
    };

    expect(ConversationStateSchema.safeParse(state).success).toBe(false);
  });

  it("rejects a state missing sessionId", () => {
    const state = {
      phase: "gathering",
      serviceCategory: null,
      coreAttributes: {},
      categoryAttributes: {},
      messages: [],
    };

    expect(ConversationStateSchema.safeParse(state).success).toBe(false);
  });

  it("rejects a category attribute missing description and importance", () => {
    const state = {
      sessionId: "session-1",
      phase: "gathering",
      serviceCategory: "bounce house",
      coreAttributes: {},
      categoryAttributes: {
        waterSlide: { value: null },
      },
      messages: [],
    };

    expect(ConversationStateSchema.safeParse(state).success).toBe(false);
  });
});
