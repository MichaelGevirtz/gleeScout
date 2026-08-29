import { randomUUID } from "node:crypto";
import { createInitialState, type ConversationState } from "../domain/conversation.js";

const sessions = new Map<string, ConversationState>();

export function createSession(): ConversationState {
  const sessionId = randomUUID();
  const state = createInitialState(sessionId);
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
