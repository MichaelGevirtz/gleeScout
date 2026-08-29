import { describe, expect, it, vi } from "vitest";
import {
  buildServer,
  type GenerateProviderListFn,
  type OrchestrateMessageFn,
  type SelectProviderFn,
} from "./server.js";
import { GeminiValidationError } from "./llm/geminiClient.js";
import { FirecrawlConfigError } from "./research/firecrawlProvider.js";
import { createInitialState, type ConversationState } from "./domain/conversation.js";
import type { ProviderCandidate } from "./domain/provider.js";
import type { Simulated } from "./domain/evidence.js";
import type { ProviderScore } from "./ranking/types.js";

function createDeferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// Fastify's inject() pipeline (body parsing, hooks) advances across event-loop
// iterations, not just microtasks — draining only microtasks isn't enough to
// observe whether a route handler has actually started. setImmediate has no
// wall-clock delay (unlike setTimeout), so this stays deterministic, not a
// timing-based race.
async function flushEventLoop(times = 20): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

describe("GET /health", () => {
  it("returns 200 and { status: 'ok' }", async () => {
    const app = buildServer();

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});

describe("POST /conversation", () => {
  it("creates a session and returns 201 with a sessionId and an initial state", async () => {
    const app = buildServer();

    const response = await app.inject({ method: "POST", url: "/conversation" });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.sessionId).toEqual(expect.any(String));
    expect(body.state).toMatchObject({
      sessionId: body.sessionId,
      phase: "gathering",
      messages: [],
    });
  });
});

describe("GET /conversation/:id", () => {
  it("returns 404 for an unknown session id", async () => {
    const app = buildServer();

    const response = await app.inject({ method: "GET", url: "/conversation/does-not-exist" });

    expect(response.statusCode).toBe(404);
  });

  it("returns the current state for a known session id", async () => {
    const app = buildServer();
    const created = await app.inject({ method: "POST", url: "/conversation" });
    const { sessionId } = created.json();

    const response = await app.inject({ method: "GET", url: `/conversation/${sessionId}` });

    expect(response.statusCode).toBe(200);
    expect(response.json().state.sessionId).toBe(sessionId);
  });
});

describe("POST /conversation/:id/message", () => {
  it("returns 404 for an unknown session id without calling orchestrate", async () => {
    const orchestrate = vi.fn();
    const app = buildServer({ orchestrate });

    const response = await app.inject({
      method: "POST",
      url: "/conversation/does-not-exist/message",
      payload: { message: "hi" },
    });

    expect(response.statusCode).toBe(404);
    expect(orchestrate).not.toHaveBeenCalled();
  });

  it("returns 400 for a missing or empty message without calling orchestrate", async () => {
    const orchestrate = vi.fn();
    const app = buildServer({ orchestrate });
    const created = await app.inject({ method: "POST", url: "/conversation" });
    const { sessionId } = created.json();

    const response = await app.inject({
      method: "POST",
      url: `/conversation/${sessionId}/message`,
      payload: { message: "" },
    });

    expect(response.statusCode).toBe(400);
    expect(orchestrate).not.toHaveBeenCalled();
  });

  it("calls orchestrate with the session's current state and message, persists the result, and returns 200", async () => {
    let capturedMessage = "";
    let capturedStateSessionId = "";
    const fakeNextState = (sessionId: string): ConversationState => ({
      sessionId,
      phase: "gathering",
      serviceCategory: "bounce house rental",
      coreAttributes: {},
      categoryAttributes: {},
      messages: [{ role: "user", content: "I need a bounce house" }],
    });
    const orchestrate: OrchestrateMessageFn = async ({ state, message }) => {
      capturedMessage = message;
      capturedStateSessionId = state.sessionId;
      return fakeNextState(state.sessionId);
    };
    const app = buildServer({ orchestrate });
    const created = await app.inject({ method: "POST", url: "/conversation" });
    const { sessionId } = created.json();

    const response = await app.inject({
      method: "POST",
      url: `/conversation/${sessionId}/message`,
      payload: { message: "I need a bounce house" },
    });

    expect(response.statusCode).toBe(200);
    expect(capturedMessage).toBe("I need a bounce house");
    expect(capturedStateSessionId).toBe(sessionId);
    expect(response.json().state).toEqual(fakeNextState(sessionId));

    const readBack = await app.inject({ method: "GET", url: `/conversation/${sessionId}` });
    expect(readBack.json().state).toEqual(fakeNextState(sessionId));
  });

  it("processes a message normally (200) even when the session's stored phase is already ready_for_search", async () => {
    const orchestrate: OrchestrateMessageFn = async ({ state }) => ({
      ...state,
      phase: "ready_for_search",
    });
    const app = buildServer({ orchestrate });
    const created = await app.inject({ method: "POST", url: "/conversation" });
    const { sessionId } = created.json();
    await app.inject({
      method: "POST",
      url: `/conversation/${sessionId}/message`,
      payload: { message: "first message reaches ready_for_search" },
    });

    const response = await app.inject({
      method: "POST",
      url: `/conversation/${sessionId}/message`,
      payload: { message: "actually, it's in Tel Aviv" },
    });

    expect(response.statusCode).toBe(200);
  });

  it("returns 502 with a generic body when orchestrate rejects with a GeminiValidationError", async () => {
    const orchestrate: OrchestrateMessageFn = async () => {
      throw new GeminiValidationError("schema validation failed: some internal detail");
    };
    const app = buildServer({ orchestrate });
    const created = await app.inject({ method: "POST", url: "/conversation" });
    const { sessionId } = created.json();

    const response = await app.inject({
      method: "POST",
      url: `/conversation/${sessionId}/message`,
      payload: { message: "hi" },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).not.toContain("some internal detail");
  });

  it("returns 500 with a generic body when orchestrate rejects with an unrelated error", async () => {
    const orchestrate: OrchestrateMessageFn = async () => {
      throw new Error("unexpected internal failure detail");
    };
    const app = buildServer({ orchestrate });
    const created = await app.inject({ method: "POST", url: "/conversation" });
    const { sessionId } = created.json();

    const response = await app.inject({
      method: "POST",
      url: `/conversation/${sessionId}/message`,
      payload: { message: "hi" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json().error).not.toContain("unexpected internal failure detail");
  });

  it("D11 same-session scenario: two concurrent messages to the same session don't lose either contribution", async () => {
    const deferredA = createDeferred<void>();
    const reachedB = createDeferred<void>();
    const orchestrate: OrchestrateMessageFn = async ({ state, message }) => {
      if (message === "message A") {
        await deferredA.promise;
      } else if (message === "message B") {
        reachedB.resolve();
      }
      return { ...state, messages: [...state.messages, { role: "user", content: message }] };
    };
    const app = buildServer({ orchestrate });
    const created = await app.inject({ method: "POST", url: "/conversation" });
    const { sessionId } = created.json();

    const responseAPromise = app.inject({
      method: "POST",
      url: `/conversation/${sessionId}/message`,
      payload: { message: "message A" },
    });
    const responseBPromise = app.inject({
      method: "POST",
      url: `/conversation/${sessionId}/message`,
      payload: { message: "message B" },
    });

    // With correct per-session serialization, B's orchestrate call cannot
    // even start (let alone signal `reachedB`) until A's turn — still
    // blocked on `deferredA` — fully completes and persists. Race
    // `reachedB` against a generous microtask flush to prove that B has
    // definitively not started yet, rather than assuming it from timing.
    const raceResult = await Promise.race([
      reachedB.promise.then(() => "B started" as const),
      flushEventLoop().then(() => "still waiting" as const),
    ]);
    expect(raceResult).toBe("still waiting");

    deferredA.resolve();
    await reachedB.promise; // B must now be free to proceed

    const [responseA, responseB] = await Promise.all([responseAPromise, responseBPromise]);
    expect(responseA.statusCode).toBe(200);
    expect(responseB.statusCode).toBe(200);

    const readBack = await app.inject({ method: "GET", url: `/conversation/${sessionId}` });
    const contents = (readBack.json().state as ConversationState).messages.map((m) => m.content);
    expect(contents).toContain("message A");
    expect(contents).toContain("message B");
  });

  it("D11 cross-session scenario: a session-B message completes without waiting on a still-pending session-A message", async () => {
    const deferredA = createDeferred<void>();
    const reachedA = createDeferred<void>();
    const orchestrate: OrchestrateMessageFn = async ({ state, message }) => {
      if (message === "blocked on A") {
        reachedA.resolve();
        await deferredA.promise;
      }
      return { ...state, messages: [...state.messages, { role: "user", content: message }] };
    };
    const app = buildServer({ orchestrate });
    const createdA = await app.inject({ method: "POST", url: "/conversation" });
    const sessionA = createdA.json().sessionId;
    const createdB = await app.inject({ method: "POST", url: "/conversation" });
    const sessionB = createdB.json().sessionId;

    const responseAPromise = app.inject({
      method: "POST",
      url: `/conversation/${sessionA}/message`,
      payload: { message: "blocked on A" },
    });

    // Deterministically wait until A has actually started — and is now
    // blocked on deferredA — before firing B. This guarantees B's request
    // starts *after* A already holds its own per-session queue slot,
    // instead of leaving it to chance which of the two Fastify pipelines
    // happens to run first.
    await reachedA.promise;

    // If the route accidentally serialized all sessions behind one global
    // lock instead of a per-session one, B would now be queued behind
    // A — which is definitely still blocked on deferredA — and this
    // await would hang/timeout.
    const responseB = await app.inject({
      method: "POST",
      url: `/conversation/${sessionB}/message`,
      payload: { message: "immediate B" },
    });
    expect(responseB.statusCode).toBe(200);

    deferredA.resolve();
    const responseA = await responseAPromise;
    expect(responseA.statusCode).toBe(200);
  });
});

describe("POST /conversation/:id/providers", () => {
  function readyState(sessionId: string): ConversationState {
    return {
      ...createInitialState(sessionId),
      phase: "ready_for_search",
      serviceCategory: "bounce house rental",
      coreAttributes: { dateTime: "next Saturday", location: "Austin, TX" },
    };
  }

  const fakeProviders: ProviderScore[] = [
    {
      candidate: { url: "https://a.example", fields: {} },
      score: 0.8,
      dimensionScores: {
        requirementMatch: null,
        geoFit: null,
        priceFit: null,
        reputation: null,
        evidenceQuality: 0,
      },
      explanation: "test explanation",
    },
  ];

  it("returns 404 for an unknown session id without calling generateList", async () => {
    const generateList = vi.fn();
    const app = buildServer({ generateList });

    const response = await app.inject({ method: "POST", url: "/conversation/does-not-exist/providers" });

    expect(response.statusCode).toBe(404);
    expect(generateList).not.toHaveBeenCalled();
  });

  it("returns 409 when the session's phase is not ready_for_search, without calling generateList", async () => {
    const generateList = vi.fn();
    const app = buildServer({ generateList });
    const created = await app.inject({ method: "POST", url: "/conversation" });
    const { sessionId } = created.json();

    const response = await app.inject({ method: "POST", url: `/conversation/${sessionId}/providers` });

    expect(response.statusCode).toBe(409);
    expect(generateList).not.toHaveBeenCalled();
  });

  it("returns 200 with { providers } from generateList when the session is ready_for_search", async () => {
    // No route creates a ready_for_search session directly, so drive one
    // there through the message route with a faked orchestrate that
    // returns a ready state, same technique server.test.ts's existing
    // "processes a message normally... when phase is already
    // ready_for_search" test already uses.
    let capturedState: ConversationState | undefined;
    const orchestrate = async ({ state }: { state: ConversationState }) => readyState(state.sessionId);
    const generateList: GenerateProviderListFn = async ({ state }) => {
      capturedState = state;
      return fakeProviders;
    };
    const app = buildServer({ orchestrate, generateList });
    const created = await app.inject({ method: "POST", url: "/conversation" });
    const sessionId = created.json().sessionId;
    await app.inject({
      method: "POST",
      url: `/conversation/${sessionId}/message`,
      payload: { message: "anything" },
    });

    const response = await app.inject({ method: "POST", url: `/conversation/${sessionId}/providers` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ providers: fakeProviders });
    expect(capturedState?.sessionId).toBe(sessionId);
  });

  it("returns 502 with a generic body when generateList rejects with a known Gemini error", async () => {
    const orchestrate = async ({ state }: { state: ConversationState }) => readyState(state.sessionId);
    const generateList: GenerateProviderListFn = async () => {
      throw new GeminiValidationError("schema validation failed: some internal detail");
    };
    const app = buildServer({ orchestrate, generateList });
    const created = await app.inject({ method: "POST", url: "/conversation" });
    const sessionId = created.json().sessionId;
    await app.inject({
      method: "POST",
      url: `/conversation/${sessionId}/message`,
      payload: { message: "anything" },
    });

    const response = await app.inject({ method: "POST", url: `/conversation/${sessionId}/providers` });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).not.toContain("some internal detail");
  });

  it("returns 502 with a generic body when generateList rejects with a FirecrawlConfigError", async () => {
    const orchestrate = async ({ state }: { state: ConversationState }) => readyState(state.sessionId);
    const generateList: GenerateProviderListFn = async () => {
      throw new FirecrawlConfigError("FIRECRAWL_API_KEY is not set");
    };
    const app = buildServer({ orchestrate, generateList });
    const created = await app.inject({ method: "POST", url: "/conversation" });
    const sessionId = created.json().sessionId;
    await app.inject({
      method: "POST",
      url: `/conversation/${sessionId}/message`,
      payload: { message: "anything" },
    });

    const response = await app.inject({ method: "POST", url: `/conversation/${sessionId}/providers` });

    expect(response.statusCode).toBe(502);
  });

  it("returns 500 with a generic body when generateList rejects with an unrelated error", async () => {
    const orchestrate = async ({ state }: { state: ConversationState }) => readyState(state.sessionId);
    const generateList: GenerateProviderListFn = async () => {
      throw new Error("unexpected internal failure detail");
    };
    const app = buildServer({ orchestrate, generateList });
    const created = await app.inject({ method: "POST", url: "/conversation" });
    const sessionId = created.json().sessionId;
    await app.inject({
      method: "POST",
      url: `/conversation/${sessionId}/message`,
      payload: { message: "anything" },
    });

    const response = await app.inject({ method: "POST", url: `/conversation/${sessionId}/providers` });

    expect(response.statusCode).toBe(500);
    expect(response.json().error).not.toContain("unexpected internal failure detail");
  });
});

describe("POST /conversation/:id/providers/select", () => {
  const validCandidate: ProviderCandidate = { url: "https://a.example", fields: {} };
  const fakeAnswers: { question: string; answer: Simulated<string> }[] = [
    {
      question: "Are you available Saturday?",
      answer: { value: "Yes", generatedAt: "2026-08-28T00:00:00.000Z" },
    },
  ];

  it("returns 404 for an unknown session id without calling selectProvider", async () => {
    const selectProviderFn = vi.fn();
    const app = buildServer({ selectProvider: selectProviderFn });

    const response = await app.inject({
      method: "POST",
      url: "/conversation/does-not-exist/providers/select",
      payload: { candidate: validCandidate },
    });

    expect(response.statusCode).toBe(404);
    expect(selectProviderFn).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that fails ProviderCandidateSchema validation, without calling selectProvider", async () => {
    const selectProviderFn = vi.fn();
    const app = buildServer({ selectProvider: selectProviderFn });
    const created = await app.inject({ method: "POST", url: "/conversation" });
    const { sessionId } = created.json();

    const response = await app.inject({
      method: "POST",
      url: `/conversation/${sessionId}/providers/select`,
      payload: { candidate: { url: "not-a-valid-url", fields: {} } },
    });

    expect(response.statusCode).toBe(400);
    expect(selectProviderFn).not.toHaveBeenCalled();
  });

  it("returns 200 with { answers } from a faked selectProvider for a valid session + valid candidate body", async () => {
    let capturedCandidate: ProviderCandidate | undefined;
    let capturedStateSessionId: string | undefined;
    const selectProviderFn: SelectProviderFn = async ({ candidate, state }) => {
      capturedCandidate = candidate;
      capturedStateSessionId = state.sessionId;
      return fakeAnswers;
    };
    const app = buildServer({ selectProvider: selectProviderFn });
    const created = await app.inject({ method: "POST", url: "/conversation" });
    const { sessionId } = created.json();

    const response = await app.inject({
      method: "POST",
      url: `/conversation/${sessionId}/providers/select`,
      payload: { candidate: validCandidate },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ answers: fakeAnswers });
    expect(capturedCandidate).toEqual(validCandidate);
    expect(capturedStateSessionId).toBe(sessionId);
  });

  it("returns 502 with a generic body when selectProvider rejects with a known Gemini error", async () => {
    const selectProviderFn: SelectProviderFn = async () => {
      throw new GeminiValidationError("schema validation failed: some internal detail");
    };
    const app = buildServer({ selectProvider: selectProviderFn });
    const created = await app.inject({ method: "POST", url: "/conversation" });
    const { sessionId } = created.json();

    const response = await app.inject({
      method: "POST",
      url: `/conversation/${sessionId}/providers/select`,
      payload: { candidate: validCandidate },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error).not.toContain("some internal detail");
  });

  it("returns 500 with a generic body when selectProvider rejects with an unrelated error", async () => {
    const selectProviderFn: SelectProviderFn = async () => {
      throw new Error("unexpected internal failure detail");
    };
    const app = buildServer({ selectProvider: selectProviderFn });
    const created = await app.inject({ method: "POST", url: "/conversation" });
    const { sessionId } = created.json();

    const response = await app.inject({
      method: "POST",
      url: `/conversation/${sessionId}/providers/select`,
      payload: { candidate: validCandidate },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json().error).not.toContain("unexpected internal failure detail");
  });
});
