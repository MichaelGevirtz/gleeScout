import type { TraceEvent } from "../domain/trace.js";

const traces = new Map<string, TraceEvent[]>();

export function appendTraceEvents(sessionId: string, events: TraceEvent[]): void {
  if (events.length === 0) {
    return;
  }
  const existing = traces.get(sessionId) ?? [];
  traces.set(sessionId, [...existing, ...events]);
}

export function getTrace(sessionId: string): TraceEvent[] {
  return traces.get(sessionId) ?? [];
}
