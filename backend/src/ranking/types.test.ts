import { describe, expect, it } from "vitest";
import { createInitialState } from "../domain/conversation.js";
import type { ConversationState } from "../domain/conversation.js";
import { deriveRankingRequirements } from "./types.js";

function buildState(overrides: Partial<ConversationState> = {}): ConversationState {
  return { ...createInitialState("session-1"), ...overrides };
}

describe("deriveRankingRequirements", () => {
  it("maps coreAttributes.location to location", () => {
    const state = buildState({ coreAttributes: { location: "Austin, TX" } });
    expect(deriveRankingRequirements(state).location).toBe("Austin, TX");
  });

  it("leaves location undefined when coreAttributes.location is undefined", () => {
    const state = buildState({ coreAttributes: {} });
    expect(deriveRankingRequirements(state).location).toBeUndefined();
  });

  it("passes categoryAttributes through unchanged, including a budget entry", () => {
    const categoryAttributes = {
      size: { description: "desired size", importance: "required" as const, value: "large" },
      budget: { description: "the party budget", importance: "required" as const, value: "$500" },
    };
    const state = buildState({ categoryAttributes });
    expect(deriveRankingRequirements(state).categoryAttributes).toEqual(categoryAttributes);
  });

  it("returns an object with exactly the two expected keys", () => {
    const state = buildState({ coreAttributes: { location: "Denver, CO" } });
    expect(Object.keys(deriveRankingRequirements(state)).sort()).toEqual([
      "categoryAttributes",
      "location",
    ]);
  });
});
