import { describe, expect, it } from "vitest";
import { createInitialState, type ConversationState } from "../domain/conversation.js";
import { isReadyForSearch, selectNextMissingAttribute } from "./questionPolicy.js";

describe("selectNextMissingAttribute", () => {
  it("returns the core dateTime target when both core attributes are unset and no category attributes exist yet", () => {
    const state = createInitialState("s1");

    expect(selectNextMissingAttribute(state)).toEqual({ kind: "core", field: "dateTime" });
  });

  it("returns the core location target once dateTime is known but location isn't", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      coreAttributes: { dateTime: "next Saturday" },
    };

    expect(selectNextMissingAttribute(state)).toEqual({ kind: "core", field: "location" });
  });

  it("returns a missing required category attribute once both core attributes are known", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      coreAttributes: { dateTime: "next Saturday", location: "Austin, TX" },
      categoryAttributes: {
        budget: { description: "the party budget", importance: "required", value: null },
      },
    };

    expect(selectNextMissingAttribute(state)).toEqual({
      kind: "category",
      name: "budget",
      description: "the party budget",
      importance: "required",
    });
  });

  it("never returns a missing optional category attribute, even when it's the only thing missing", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      coreAttributes: { dateTime: "next Saturday", location: "Austin, TX" },
      categoryAttributes: {
        waterSlide: { description: "whether a water slide is wanted", importance: "optional", value: null },
      },
    };

    expect(selectNextMissingAttribute(state)).toBeNull();
  });

  it("returns null once core attributes and all required category attributes are known, regardless of missing optional ones", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      coreAttributes: { dateTime: "next Saturday", location: "Austin, TX" },
      categoryAttributes: {
        budget: { description: "the party budget", importance: "required", value: "$500" },
        waterSlide: { description: "whether a water slide is wanted", importance: "optional", value: null },
      },
    };

    expect(selectNextMissingAttribute(state)).toBeNull();
  });

  it("does not mutate the input state", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      coreAttributes: { dateTime: "next Saturday" },
      categoryAttributes: {
        budget: { description: "the party budget", importance: "required", value: null },
      },
    };
    const snapshot = JSON.parse(JSON.stringify(state));

    selectNextMissingAttribute(state);

    expect(state).toEqual(snapshot);
  });
});

describe("isReadyForSearch", () => {
  it("returns false while a core attribute is still missing and the turn count is under the cap", () => {
    const state = createInitialState("s1");

    expect(isReadyForSearch(state)).toBe(false);
  });

  it("returns false while a required category attribute is still missing and the turn count is under the cap", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      coreAttributes: { dateTime: "next Saturday", location: "Austin, TX" },
      categoryAttributes: {
        budget: { description: "the party budget", importance: "required", value: null },
      },
    };

    expect(isReadyForSearch(state)).toBe(false);
  });

  it("returns true (complete path) once core attributes and all required category attributes are known", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      serviceCategory: "bounce house rental",
      coreAttributes: { dateTime: "next Saturday", location: "Austin, TX" },
      categoryAttributes: {
        budget: { description: "the party budget", importance: "required", value: "$500" },
      },
    };

    expect(isReadyForSearch(state)).toBe(true);
  });

  it("returns true (fallback path) once the turn-count cap is reached, even with a required attribute still missing, without contradicting selectNextMissingAttribute", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      serviceCategory: "bounce house rental",
      coreAttributes: { dateTime: "next Saturday", location: "Austin, TX" },
      categoryAttributes: {
        budget: { description: "the party budget", importance: "required", value: null },
      },
      messages: Array.from({ length: 8 }, (_, i) => ({ role: "user" as const, content: `msg ${i}` })),
    };

    expect(isReadyForSearch(state)).toBe(true);
    expect(selectNextMissingAttribute(state)).not.toBeNull();
  });

  it("returns false when dateTime/location are known and no required category attribute is missing, but serviceCategory is still null", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      coreAttributes: { dateTime: "next Saturday", location: "Austin, TX" },
    };

    expect(isReadyForSearch(state)).toBe(false);
  });

  it("returns true once serviceCategory is set and dateTime/location/existing required category attributes are all satisfied", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      serviceCategory: "bounce house rental",
      coreAttributes: { dateTime: "next Saturday", location: "Austin, TX" },
      categoryAttributes: {
        budget: { description: "the party budget", importance: "required", value: "$500" },
      },
    };

    expect(isReadyForSearch(state)).toBe(true);
  });

  it("does not bypass a missing serviceCategory via the turn-count fallback", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      coreAttributes: { dateTime: "next Saturday", location: "Austin, TX" },
      messages: Array.from({ length: 8 }, (_, i) => ({ role: "user" as const, content: `msg ${i}` })),
    };

    expect(isReadyForSearch(state)).toBe(false);
  });

  it("returns false when serviceCategory/dateTime are known and no required category attribute is missing, but location is still undefined", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      serviceCategory: "bounce house rental",
      coreAttributes: { dateTime: "next Saturday" },
    };

    expect(isReadyForSearch(state)).toBe(false);
  });

  it("does not bypass a missing location via the turn-count fallback", () => {
    const state: ConversationState = {
      ...createInitialState("s1"),
      serviceCategory: "bounce house rental",
      coreAttributes: { dateTime: "next Saturday" },
      messages: Array.from({ length: 8 }, (_, i) => ({ role: "user" as const, content: `msg ${i}` })),
    };

    expect(isReadyForSearch(state)).toBe(false);
  });

  it("does not mutate the input state", () => {
    const state = createInitialState("s1");
    const snapshot = JSON.parse(JSON.stringify(state));

    isReadyForSearch(state);

    expect(state).toEqual(snapshot);
  });
});
