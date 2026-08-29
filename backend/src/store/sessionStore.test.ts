import { describe, expect, it } from "vitest";
import { ConversationStateSchema } from "../domain/conversation.js";
import { createSession, getSession, updateSession } from "./sessionStore.js";

describe("sessionStore", () => {
  it("creates a session that is retrievable and schema-valid", () => {
    const created = createSession();

    expect(ConversationStateSchema.safeParse(created).success).toBe(true);

    const fetched = getSession(created.sessionId);
    expect(fetched).toEqual(created);
  });

  it("returns undefined for an unknown session id", () => {
    expect(getSession("does-not-exist")).toBeUndefined();
  });

  it("returns the updated state after updateSession", () => {
    const created = createSession();

    const updated = { ...created, serviceCategory: "bounce house" };
    updateSession(created.sessionId, updated);

    expect(getSession(created.sessionId)).toEqual(updated);
  });

  it("throws when updating an unknown session id", () => {
    const created = createSession();
    const bogusState = { ...created, sessionId: "does-not-exist" };

    expect(() => updateSession("does-not-exist", bogusState)).toThrow();
  });

  it("generates different session ids across calls", () => {
    const first = createSession();
    const second = createSession();

    expect(first.sessionId).not.toBe(second.sessionId);
  });
});
