import { describe, expect, it } from "vitest";
import { TraceEventSchema } from "./trace.js";

describe("TraceEventSchema", () => {
  const base = {
    step: "discover",
    summary: "Searched for providers",
    timestamp: "2026-08-29T12:00:00.000Z",
  };

  it("accepts a valid event without detail", () => {
    expect(TraceEventSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a valid event with detail", () => {
    const withDetail = { ...base, detail: { query: "bounce house in Austin", count: 12 } };
    expect(TraceEventSchema.safeParse(withDetail).success).toBe(true);
  });

  it("accepts a valid event with durationMs", () => {
    const withDuration = { ...base, durationMs: 1234 };
    expect(TraceEventSchema.safeParse(withDuration).success).toBe(true);
  });

  it("accepts a valid event without durationMs", () => {
    expect(TraceEventSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a negative durationMs", () => {
    const invalid = { ...base, durationMs: -1 };
    expect(TraceEventSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects a missing step", () => {
    const { step: _step, ...rest } = base;
    expect(TraceEventSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a missing summary", () => {
    const { summary: _summary, ...rest } = base;
    expect(TraceEventSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a missing timestamp", () => {
    const { timestamp: _timestamp, ...rest } = base;
    expect(TraceEventSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a non-ISO timestamp", () => {
    const invalid = { ...base, timestamp: "not-a-date" };
    expect(TraceEventSchema.safeParse(invalid).success).toBe(false);
  });
});
