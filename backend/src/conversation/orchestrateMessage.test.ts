import { describe, expect, it, vi } from "vitest";
import {
  createInitialState,
  SCOUT_WELCOME_MESSAGE,
  type ConversationState,
} from "../domain/conversation.js";
import type { ExtractionResult } from "../llm/extraction.js";
import type { MissingAttributeTarget } from "./questionPolicy.js";
import { orchestrateMessage, type ExtractFn, type PhraseFn } from "./orchestrateMessage.js";

function emptyExtraction(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    serviceCategory: null,
    coreAttributes: { dateTime: null, location: null },
    categoryAttributes: [],
    ...overrides,
  };
}

function fakeExtract(result: ExtractionResult): ExtractFn {
  return async () => result;
}

function fakePhrase(question: string): PhraseFn {
  return async () => question;
}

describe("orchestrateMessage", () => {
  it("appends the phrased question as an assistant message when the merged state isn't ready", async () => {
    const state = createInitialState("s1");

    const result = await orchestrateMessage({
      state,
      message: "I need a bounce house",
      extract: fakeExtract(emptyExtraction()),
      phrase: fakePhrase("When would you like the event to take place?"),
    });

    expect(result.messages.at(-1)).toEqual({
      role: "assistant",
      content: "When would you like the event to take place?",
    });
    expect(result.phase).toBe("gathering");
  });

  it("calls phrase with the target selectNextMissingAttribute would return, and with the merged state", async () => {
    const state = createInitialState("s1");
    let capturedTarget: MissingAttributeTarget | undefined;
    let capturedState: ConversationState | undefined;
    const phrase: PhraseFn = async ({ target, state: phraseState }) => {
      capturedTarget = target;
      capturedState = phraseState;
      return "When?";
    };

    await orchestrateMessage({
      state,
      message: "I need a bounce house",
      extract: fakeExtract(emptyExtraction()),
      phrase,
    });

    expect(capturedTarget).toEqual({ kind: "core", field: "dateTime" });
    expect(capturedState?.messages).toEqual([{ role: "user", content: "I need a bounce house" }]);
  });

  it("transitions phase to ready_for_search and does not call phrase when the merge produces a complete state", async () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      serviceCategory: "bounce house rental",
      coreAttributes: { dateTime: "next Saturday" },
    };
    const phrase = vi.fn();

    const result = await orchestrateMessage({
      state,
      message: "it's in Austin, TX",
      extract: fakeExtract(emptyExtraction({ coreAttributes: { dateTime: null, location: "Austin, TX" } })),
      phrase,
    });

    expect(result.phase).toBe("ready_for_search");
    expect(phrase).not.toHaveBeenCalled();
  });

  it("transitions phase to ready_for_search via the turn-cap fallback without calling phrase, even with a required attribute still missing", async () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      serviceCategory: "bounce house rental",
      coreAttributes: { dateTime: "next Saturday", location: "Austin, TX" },
      categoryAttributes: {
        budget: { description: "the party budget", importance: "required", value: null },
      },
      messages: Array.from({ length: 7 }, (_, i) => ({ role: "user" as const, content: `msg ${i}` })),
    };
    const phrase = vi.fn();

    const result = await orchestrateMessage({
      state,
      message: "one more message to reach the turn cap",
      extract: fakeExtract(emptyExtraction()),
      phrase,
    });

    expect(result.phase).toBe("ready_for_search");
    expect(phrase).not.toHaveBeenCalled();
  });

  it("runs the same extract-merge-re-evaluate path regardless of the input state's current phase (a correction after readiness)", async () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      phase: "ready_for_search",
      serviceCategory: "bounce house rental",
      coreAttributes: { dateTime: "next Saturday", location: "Austin, TX" },
    };
    const phrase = vi.fn();

    const result = await orchestrateMessage({
      state,
      message: "actually, it's in Tel Aviv",
      extract: fakeExtract(emptyExtraction({ coreAttributes: { dateTime: null, location: "Tel Aviv" } })),
      phrase,
    });

    expect(result.coreAttributes.location).toBe("Tel Aviv");
    expect(result.phase).toBe("ready_for_search");
    expect(phrase).not.toHaveBeenCalled();
  });

  it("preserves the user message mergeExtraction already appended, without double-appending or dropping it", async () => {
    const state = createInitialState("s1");

    const result = await orchestrateMessage({
      state,
      message: "I need a bounce house",
      extract: fakeExtract(emptyExtraction()),
      phrase: fakePhrase("When would you like the event to take place?"),
    });

    expect(result.messages).toEqual([
      { role: "user", content: "I need a bounce house" },
      { role: "assistant", content: "When would you like the event to take place?" },
    ]);
  });

  it("propagates a rejection from extract without swallowing it", async () => {
    const state = createInitialState("s1");
    const extract: ExtractFn = async () => {
      throw new Error("extraction failed");
    };

    await expect(
      orchestrateMessage({ state, message: "hi", extract, phrase: fakePhrase("When?") })
    ).rejects.toThrow("extraction failed");
  });

  it("propagates a rejection from phrase without swallowing it", async () => {
    const state = createInitialState("s1");
    const phrase: PhraseFn = async () => {
      throw new Error("phrasing failed");
    };

    await expect(
      orchestrateMessage({ state, message: "hi", extract: fakeExtract(emptyExtraction()), phrase })
    ).rejects.toThrow("phrasing failed");
  });

  it("does not mutate the input state", async () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      serviceCategory: "bounce house rental",
      coreAttributes: { dateTime: "next Saturday" },
    };
    const snapshot = JSON.parse(JSON.stringify(state));

    await orchestrateMessage({
      state,
      message: "it's in Austin, TX",
      extract: fakeExtract(emptyExtraction({ coreAttributes: { dateTime: null, location: "Austin, TX" } })),
      phrase: fakePhrase("unused"),
    });

    expect(state).toEqual(snapshot);
  });
});

// task-76: the seeded Scout greeting is display-only conversation history.
// These lock in that it cannot leak into the deterministic path — the same
// run with and without it must produce identical structured state, the same
// extraction input, and the same next question.
describe("orchestrateMessage with the seeded Scout greeting", () => {
  const greeted = (): ConversationState => ({
    ...createInitialState("s1"),
    messages: [{ ...SCOUT_WELCOME_MESSAGE }],
  });

  function structuredOnly(state: ConversationState) {
    const { messages: _messages, ...rest } = state;
    return rest;
  }

  it("does not change the structured state extraction produces", async () => {
    const run = (state: ConversationState) =>
      orchestrateMessage({
        state,
        message: "I need a bounce house",
        extract: fakeExtract(emptyExtraction({ serviceCategory: "bounce house rental" })),
        phrase: fakePhrase("When would you like the event to take place?"),
      });

    const withGreeting = await run(greeted());
    const withoutGreeting = await run(createInitialState("s1"));

    expect(structuredOnly(withGreeting)).toEqual(structuredOnly(withoutGreeting));
  });

  it("does not change the message handed to extraction", async () => {
    let capturedMessage: string | undefined;
    const extract: ExtractFn = async ({ message }) => {
      capturedMessage = message;
      return emptyExtraction();
    };

    await orchestrateMessage({
      state: greeted(),
      message: "I need a bounce house",
      extract,
      phrase: fakePhrase("When?"),
    });

    expect(capturedMessage).toBe("I need a bounce house");
  });

  it("does not change question selection or readiness", async () => {
    const targets: (MissingAttributeTarget | undefined)[] = [];
    const phrase: PhraseFn = async ({ target }) => {
      targets.push(target);
      return "When?";
    };
    const run = (state: ConversationState) =>
      orchestrateMessage({
        state,
        message: "I need a bounce house",
        extract: fakeExtract(emptyExtraction()),
        phrase,
      });

    const withGreeting = await run(greeted());
    const withoutGreeting = await run(createInitialState("s1"));

    expect(targets[0]).toEqual(targets[1]);
    expect(withGreeting.phase).toBe(withoutGreeting.phase);
  });

  it("keeps the greeting first, followed by the user message and the assistant question", async () => {
    const result = await orchestrateMessage({
      state: greeted(),
      message: "I need a bounce house",
      extract: fakeExtract(emptyExtraction()),
      phrase: fakePhrase("When would you like the event to take place?"),
    });

    expect(result.messages).toEqual([
      { role: "assistant", content: SCOUT_WELCOME_MESSAGE.content },
      { role: "user", content: "I need a bounce house" },
      { role: "assistant", content: "When would you like the event to take place?" },
    ]);
  });
});
