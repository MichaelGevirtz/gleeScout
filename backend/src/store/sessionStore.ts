import { randomUUID } from "node:crypto";
import {
  createInitialState,
  SCOUT_WELCOME_MESSAGE,
  type ConversationState,
} from "../domain/conversation.js";

const sessions = new Map<string, ConversationState>();

export function createSession(): ConversationState {
  const sessionId = randomUUID();
  // Seeded here rather than in `createInitialState`, which doubles as the
  // blank-state fixture builder for most unit tests — the greeting belongs
  // to a real session, not to every synthetic state (task-76). Copied so
  // no two sessions share a message object.
  const state: ConversationState = {
    ...createInitialState(sessionId),
    messages: [{ ...SCOUT_WELCOME_MESSAGE }],
  };
  sessions.set(sessionId, state);
  return state;
}

export function getSession(sessionId: string): ConversationState | undefined {
  return sessions.get(sessionId);
}

export function updateSession(sessionId: string, state: ConversationState): void {
  if (!sessions.has(sessionId)) {
    throw new Error(`Cannot update unknown session: ${sessionId}`);
  }
  sessions.set(sessionId, state);
}
