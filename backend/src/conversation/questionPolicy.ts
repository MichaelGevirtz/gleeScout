import type { ConversationState } from "../domain/conversation.js";

export type MissingAttributeTarget =
  | { kind: "core"; field: "dateTime" | "location" }
  | { kind: "category"; name: string; description: string; importance: "required" };

const MAX_GATHERING_TURNS = 8;

export function selectNextMissingAttribute(state: ConversationState): MissingAttributeTarget | null {
  if (!state.coreAttributes.dateTime) {
    return { kind: "core", field: "dateTime" };
  }
  if (!state.coreAttributes.location) {
    return { kind: "core", field: "location" };
  }

  for (const [name, slot] of Object.entries(state.categoryAttributes)) {
    if (slot.importance === "required" && slot.value === null) {
      return { kind: "category", name, description: slot.description, importance: "required" };
    }
  }

  return null;
}

export function isReadyForSearch(state: ConversationState): boolean {
  if (state.serviceCategory === null) {
    return false;
  }

  if (state.coreAttributes.location === undefined) {
    return false;
  }

  if (selectNextMissingAttribute(state) === null) {
    return true;
  }

  const turnCount = state.messages.filter((m) => m.role === "user").length;
  return turnCount >= MAX_GATHERING_TURNS;
}
