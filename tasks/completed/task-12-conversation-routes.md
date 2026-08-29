# Task 12: Conversation API routes + single-turn orchestration
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Wire the already-built pieces — Task 06 (extraction), Task 07
  (merge), Task 09 (missing-attribute selection + readiness), Task 11
  (question phrasing), Task 04 (session store) — into a working
  request/response loop: three Fastify routes that let a client start
  a conversation, post a message, and read current state. This is the
  first real HTTP delivery surface for Part 1's "chat-based
  application," and the first task with an actual client-facing
  request/response cycle, so minimal route-level error handling is
  added here too — deliberately minimal (no retry/fallback, no new
  subsystem), just correct status codes instead of an unhandled crash
  or a leaked internal error message, matching Technical Expectations'
  explicit "Error handling" line:
  - unknown session → `404`
  - malformed/empty body → `400`
  - a known Gemini failure (`GeminiConfigError` / `GeminiParseError` /
    `GeminiValidationError`, from Task 05, surfaced through
    `extract`/`phrase`) → `502`
  - anything else unexpected → `500` with a generic body (no internal
    message/stack leaked to the client)
- Inputs (all read-only): `backend/src/store/sessionStore.ts` (Task
  04), `backend/src/llm/extraction.ts` (Task 06),
  `backend/src/conversation/mergeExtraction.ts` (Task 07),
  `backend/src/conversation/questionPolicy.ts` (Task 09),
  `backend/src/llm/questionPhrasing.ts` (Task 11),
  `backend/src/domain/conversation.ts` (Task 03),
  `backend/src/llm/geminiClient.ts` (Task 05 — for its exported error
  classes, to map into HTTP status codes).
- Outputs:
  - CREATE `backend/src/conversation/orchestrateMessage.ts` exporting
    `orchestrateMessage({ state, message, extract?, phrase? }):
    Promise<ConversationState>` — single-turn orchestration: extract
    → merge → if `isReadyForSearch` on the merged state, transition
    `phase` to `"ready_for_search"` and stop (no question asked);
    otherwise call `selectNextMissingAttribute` (guaranteed non-null
    here) → `phrase` it → append the result as an `"assistant"`
    message. `extract`/`phrase` are the only injection points
    (defaulting to the real `extractRequirements`/
    `generatePendingQuestion`) — `mergeExtraction`,
    `selectNextMissingAttribute`, and `isReadyForSearch` are called
    directly since they're already pure/deterministic and don't need
    faking to test orchestration wiring. This function runs the exact
    same way regardless of the state's *current* `phase` when called —
    it never reads `phase` to decide whether to proceed, only to
    decide what to write.
  - MODIFY `backend/src/server.ts`: `buildServer(deps?: { orchestrate?:
    OrchestrateMessageFn })` (defaults to the real
    `orchestrateMessage`, so `index.ts` and the existing `/health`
    test are unaffected), adding:
    - `POST /conversation` → creates a session via the store, `201 {
      sessionId, state }`.
    - `POST /conversation/:id/message` → body `{ message: string }`
      (validated inline with the existing `zod` dependency — no new
      type-provider package). `400` on invalid/empty body, `404` on
      unknown session id, otherwise runs `orchestrate`, persists the
      result via `updateSession`, returns `200 { state }` — run
      unconditionally on the current `phase`, including
      `"ready_for_search"` (see Constraints). A thrown Gemini error is
      mapped to `502`; any other thrown error is mapped to `500` with
      a generic message.
    - `GET /conversation/:id` → `404` on unknown id, else `200 {
      state }` — the actual `ConversationState`, not an agent-trace
      view (that's the assignment's own Bonus list item, page 8, out
      of scope here and for all of M5).
  - MODIFY `backend/src/server.test.ts`: route tests using an injected
    fake `orchestrate` — no live network calls.
- Constraints:
  - **No phase-based gating on `POST /conversation/:id/message`.**
    `phase === "ready_for_search"` means the system has enough
    information to *begin* provider research — it does not mean the
    conversation is closed. Do not return `409` or any other
    special-cased response once a session reaches
    `"ready_for_search"`; a message posted at that point (e.g. "Actually,
    the event is in Tel Aviv") must flow through the exact same
    extract → merge → re-evaluate path as any other message, with no
    special-casing in the route for the state's current phase. The
    frontend disabling its send button while a request is in flight is
    a UX safeguard for the *normal* duplicate-submission case, not a
    backend correctness guarantee — Task 13's per-session
    serialization is what actually guarantees correctness under
    concurrent requests. The exact product behavior of corrections
    *after* provider research has actually started is explicitly
    out of scope here, deferred to the later research/conversation
    milestone (M7+) — do not make the state machine more rigid than
    Task 09 already defined it to be.
  - Does **not** add per-session request serialization — two
    concurrent requests to the same session can still race after this
    task. This is a known, deliberately deferred gap per D11 — Task 13
    is the very next task and wraps this exact read → await
    `orchestrate` → write sequence with serialization immediately
    after. It is not left silently unresolved; it's sequenced, not
    skipped.
  - No new npm dependencies.
  - No agent-trace/debug endpoint.
  - `orchestrateMessage` does not touch the session store itself — the
    route handler owns the read/write around it, keeping the function
    pure and unit-testable, and keeping the read→orchestrate→write
    sequence Task 13 will wrap in exactly one place.
  - Does not modify `ConversationPhase` or any other Task 03 schema.
  - No generic error-handling framework — a bounded set of `instanceof`
    checks (Gemini errors → 502) plus one final catch-all (→ 500,
    generic body), nothing more abstracted.
- Open Questions: none.

## Assignment Alignment
- Requirement type: **SUPPORT** (HTTP routes are necessary to expose
  the chat application at all, but the exact endpoints and response
  shapes are this project's design decisions, not something the
  assignment specifies) + **RECOMMENDATION** (the route-level error
  handling specifically, since Technical Expectations explicitly lists
  "Error handling" as something they want to see structured, without
  mandating how).
- Assignment requirement: "Build a small chat-based application where
  the user describes a service they need for an event" (page 1) and
  the 6-point system requirements under Part 1 (page 2) require an
  actual conversational loop reachable by a client; without an HTTP
  surface, Tasks 06/07/09/11 are unreachable. Technical Expectations
  (page 4-5) lists "Error handling" among what they're "particularly
  interested in seeing how you structure."
- Source: Home Assignment PDF, "The Assignment" (page 1), Part 1 (page
  2), Technical Expectations (page 4-5).
- Rationale: the assignment doesn't specify REST endpoints or their
  shape — that's this project's implementation choice — but some
  request/response mechanism is unavoidable to satisfy "chat-based
  application." Minimal error handling at the first real request
  boundary directly serves an explicitly named evaluation input, at
  low cost (a handful of `instanceof` checks and status codes, no new
  subsystem, no retry logic).

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/conversation/orchestrateMessage.ts`,
  `backend/src/conversation/orchestrateMessage.test.ts`
- MODIFY: `backend/src/server.ts`, `backend/src/server.test.ts`
- DO NOT TOUCH: `backend/src/domain/`, `backend/src/store/`,
  `backend/src/llm/`, `backend/src/conversation/mergeExtraction.ts`,
  `backend/src/conversation/questionPolicy.ts`, `backend/src/index.ts`,
  `DESIGN.md`, `docs/`, `.claude/`

### Implementation Notes
- `orchestrateMessage` signature: `{ state, message, extract =
  extractRequirements, phrase = generatePendingQuestion }`.
- Body schema: `z.object({ message: z.string().min(1) })`, defined
  inline in `server.ts` — no separate schema file, no
  `fastify-type-provider-zod` dependency, per "no unnecessary
  abstraction."
- Error mapping in the message route, in order: unknown session id
  checked before calling `orchestrate` → `404` directly, no wasted LLM
  call; a `ZodError` from the inline body parse → `400`; `instanceof`
  checks against `GeminiConfigError | GeminiParseError |
  GeminiValidationError` (imported from `geminiClient.ts`) → `502`;
  any other caught error → `500` with a generic `{ error: "..." }`
  body (log the real error server-side via Fastify's existing logger,
  never in the response).

## VALIDATE
### Unit Tests
- [ ] `orchestrateMessage` appends the phrased question as an
      `"assistant"` message when the merged state isn't ready (fake
      `extract` contributes nothing new, fake `phrase` returns a fixed
      string).
- [ ] Calls `phrase` with the same target `selectNextMissingAttribute`
      would return, and with the merged state.
- [ ] Transitions `phase` to `"ready_for_search"` and does **not**
      call `phrase` when the merge produces a complete state.
- [ ] Transitions `phase` to `"ready_for_search"` via Task 09's own
      turn-cap fallback (without calling `phrase`) when required
      attributes are still missing but the turn cap is reached —
      reuses Task 09's behavior, no reimplementation.
- [ ] Runs the same extract → merge → re-evaluate path regardless of
      the *input* state's current `phase` — e.g. given an input state
      already at `"ready_for_search"` and an extraction that changes a
      known value (a correction), the merge and re-evaluation still
      happen normally (no phase-based short-circuit).
- [ ] Preserves the user message `mergeExtraction` already appended
      (no double-append, no drop).
- [ ] Propagates a rejection from `extract` without swallowing it.
- [ ] Propagates a rejection from `phrase` without swallowing it.
- [ ] Does not mutate the input `state`.

### Component / Integration Tests
(via `app.inject` against `buildServer({ orchestrate: fake })` — no
live network calls)
- [ ] `POST /conversation` returns `201` with a `sessionId` and an
      initial (`"gathering"`, empty `messages`) state.
- [ ] `GET /conversation/:id` for an unknown id returns `404`.
- [ ] `GET /conversation/:id` for a known id returns its current
      state.
- [ ] `POST /conversation/:id/message` for an unknown id returns `404`
      (`orchestrate` not called).
- [ ] `POST /conversation/:id/message` with a missing/empty `message`
      returns `400` (`orchestrate` not called).
- [ ] `POST /conversation/:id/message` with a valid body calls
      `orchestrate` with the session's current state and the message,
      persists the returned state via the session store, and returns
      `200` with that state.
- [ ] `POST /conversation/:id/message` on a session whose stored
      `phase` is already `"ready_for_search"` still returns `200` and
      is processed normally — no `409`, no special status code.
- [ ] `POST /conversation/:id/message` returns `502` (with a generic
      body, not the raw error) when `orchestrate` rejects with a
      `GeminiValidationError` (or `Config`/`ParseError`).
- [ ] `POST /conversation/:id/message` returns `500` (with a generic
      body, not the raw error message/stack) when `orchestrate`
      rejects with an unrelated/unexpected error.

### E2E Tests
- [ ] N/A — no frontend yet.

### Success Criteria
- [ ] `npm run build` (backend) succeeds with no TypeScript errors.
- [ ] `npm test` (backend) passes, including the new tests, with no
      live network calls.
- [ ] Manual smoke test against the real Gemini API: `npm run dev`,
      then `POST /conversation` → `POST .../message` → `GET
      /conversation/:id`, confirmed end-to-end and documented in this
      task's outcome (same manual-check convention as Tasks 05/06/11).
- [ ] No unrelated files modified.

## ITERATE
### Outcome
Implemented as revised, no deviations. Created
`backend/src/conversation/orchestrateMessage.ts` exporting
`orchestrateMessage({ state, message, extract?, phrase? })` — single-
turn orchestration exactly as specified: extract → merge → if
`isReadyForSearch`, transition `phase` and stop; otherwise
`selectNextMissingAttribute` → `phrase` → append as an `"assistant"`
message. Never reads the *input* state's `phase` to gate behavior,
per the no-409/no-gating constraint. `backend/src/conversation/orchestrateMessage.test.ts`
— 9 tests covering every VALIDATE unit-test item, including the
correction-after-`ready_for_search` case and both non-call assertions
for `phrase` (complete path, turn-cap fallback path).

`backend/src/server.ts` rewritten with `buildServer(deps?: {
orchestrate? })`, adding `POST /conversation`, `POST
/conversation/:id/message`, `GET /conversation/:id`. Error mapping
implemented exactly as specified: 404 unknown session (checked before
calling `orchestrate`) → 400 invalid body (Zod) → 502 known Gemini
errors → 500 generic catch-all, real error always logged server-side
via Fastify's logger, never in the response body. `backend/src/server.test.ts`
extended with 9 new route tests (10 total incl. the pre-existing
`/health` test) via injected fake `orchestrate`, including the
explicit "still 200, no 409" test for a session already at
`ready_for_search`, and both the 502 and 500 paths asserting the
response body never contains the real error's internal text.

`npm run build` clean; `npm test` 67/67 passing (9 + 9 new, 49
pre-existing), no live network calls in the automated suite.

**Manual real-API smoke test: attempted, partially blocked by the
same known daily quota (D2b), reported honestly.** `POST
/conversation` and `GET /conversation/:id` were confirmed working
end-to-end against the real dev server. `POST .../message` reached
the real Gemini API (confirmed via server log) but hit the same
`GenerateRequestsPerDayPerProjectPerModel-FreeTier` 429 already
recorded in D2b/task-11 as exhausted earlier the same day
(2026-08-27) — not a code defect. This run still validates something
task-11's blocked check couldn't: the *full* route→orchestration→
Gemini wiring is live-correct up to the point of hitting the quota,
and the generic 500 catch-all correctly handled a real unforeseen
error class (the SDK's raw `ApiError`, not one of the three
`Gemini*Error` types the route explicitly checks for) — the client
response was the generic `{"error":"Unexpected server error."}`
with zero internal detail leaked, exactly as designed. (Also cleaned
up one leftover `tsx` dev-server process from an earlier failed
attempt in this same check — confirmed it was this session's own
process, not pre-existing user work, before stopping it.)

No files outside `Files Touched` were modified.

### Knowledge Updates
- New module `backend/src/conversation/orchestrateMessage.ts` is the
  single-turn glue between Tasks 06/07/09/11 — the first place all
  four are actually called together.
- `backend/src/server.ts` now has a real conversation API surface:
  `POST /conversation`, `POST /conversation/:id/message`, `GET
  /conversation/:id`, all still lacking per-session concurrency
  protection (deliberately deferred to task-13, next).
- Confirmed (again) that Gemini's free-tier daily quota is shared
  across *all* real-API activity for the day, including manual route
  smoke tests, not just eval scripts — a second same-day task needing
  a live check can be blocked by quota an earlier, unrelated task's
  validation already consumed.

### Follow-ups
- Re-run the `POST .../message` manual smoke test once the Gemini
  free-tier daily quota resets, to see an actual phrased question
  end-to-end (non-blocking — the code path and its failure handling
  are already proven correct by this run).
- Task 13 (per-session request serialization) is next — required
  before this route is safe under concurrent same-session requests.
