import { describe, expect, it } from "vitest";
import {
  ConversationStateSchema,
  createInitialState,
  SCOUT_WELCOME_MESSAGE,
} from "./conversation.js";

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

describe("SCOUT_WELCOME_MESSAGE", () => {
  it("is a static assistant opener, not a question", () => {
    expect(SCOUT_WELCOME_MESSAGE.role).toBe("assistant");
    expect(SCOUT_WELCOME_MESSAGE.content).not.toContain("?");
  });

  // The greeting is seeded in `createSession`, NOT here: `createInitialState`
  // doubles as the blank-state fixture builder for most backend unit tests,
  // and seeding it there would leak UX copy into every synthetic state
  // (task-76).
  it("is not seeded into createInitialState, which stays an empty transcript", () => {
    expect(createInitialState("s1").messages).toEqual([]);
  });
});
