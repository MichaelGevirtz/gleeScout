import { describe, expect, it } from "vitest";
import type { TraceEvent } from "../domain/trace.js";
import { appendTraceEvents, getTrace } from "./traceStore.js";

function event(step: string): TraceEvent {
  return { step, summary: `did ${step}`, timestamp: "2026-08-29T12:00:00.000Z" };
}

describe("traceStore", () => {
  it("returns [] for a session id that was never appended to", () => {
    expect(getTrace("never-appended")).toEqual([]);
  });

  it("returns exactly the appended events, in order", () => {
    const sessionId = "session-a";
    const events = [event("discover"), event("enrich")];

    appendTraceEvents(sessionId, events);

    expect(getTrace(sessionId)).toEqual(events);
  });

  it("accumulates across multiple calls rather than overwriting", () => {
    const sessionId = "session-b";

    appendTraceEvents(sessionId, [event("discover")]);
    appendTraceEvents(sessionId, [event("rank")]);

    expect(getTrace(sessionId)).toEqual([event("discover"), event("rank")]);
  });

  it("is a safe no-op for an empty array", () => {
    const sessionId = "session-c";

    appendTraceEvents(sessionId, []);

    expect(getTrace(sessionId)).toEqual([]);
  });

  it("keeps different session ids independent", () => {
    const sessionX = "session-x";
    const sessionY = "session-y";

    appendTraceEvents(sessionX, [event("discover")]);

    expect(getTrace(sessionX)).toEqual([event("discover")]);
    expect(getTrace(sessionY)).toEqual([]);
  });
});
