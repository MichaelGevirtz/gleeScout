import { describe, expect, it, vi } from "vitest";
import { ConversationStateSchema, SCOUT_WELCOME_MESSAGE } from "../domain/conversation.js";
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

  it("seeds a new session with exactly one message: the Scout greeting", () => {
    const created = createSession();

    expect(created.messages).toHaveLength(1);
    expect(created.messages[0]).toEqual({
      role: "assistant",
      content: SCOUT_WELCOME_MESSAGE.content,
    });
    expect(created.messages[0].role).toBe("assistant");
  });

  it("leaves the rest of the initial state untouched when seeding the greeting", () => {
    const created = createSession();

    expect(created.phase).toBe("gathering");
    expect(created.serviceCategory).toBeNull();
    expect(created.coreAttributes).toEqual({});
    expect(created.categoryAttributes).toEqual({});
  });

  it("gives each session its own greeting object, never a shared reference", () => {
    const first = createSession();
    const second = createSession();

    expect(first.messages[0]).not.toBe(second.messages[0]);
    expect(first.messages[0]).not.toBe(SCOUT_WELCOME_MESSAGE);
    expect(first.messages[0]).toEqual(second.messages[0]);
  });

  it("creates a session without any network I/O — the greeting is static, not generated", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const created = createSession();

    expect(created.messages).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("generates different session ids across calls", () => {
    const first = createSession();
    const second = createSession();

    expect(first.sessionId).not.toBe(second.sessionId);
  });
});
