# Task 69: Trace domain schema + in-memory per-session trace store
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: define the `TraceEvent` shape and a per-session, in-memory,
  append-only trace store — the foundation M13's later tasks
  (instrumenting the two recommendation-producing orchestrators, and
  the debug endpoint) will build on. This task adds no instrumentation
  and no route — it is pure schema + storage, mirroring how task-04
  (session store) and task-14 (evidence schema) each landed ahead of
  their consumers.
- Inputs: none (new, standalone module) — pattern-matches
  `backend/src/store/sessionStore.ts` (Map-based, no TTL/eviction) and
  `backend/src/domain/evidence.ts` (Zod schema + inferred type).
- Outputs:
  - `backend/src/domain/trace.ts` — `TraceEventSchema` / `TraceEvent`:
    `{ step: string, summary: string, detail?: Record<string, unknown>, timestamp: string }`.
    `step` is a short machine-readable label (e.g. `"discover"`,
    `"rank"`, `"analyzeGaps"`); `summary` is the human-readable
    one-line description meant for the debug view; `detail` is a
    small structured payload (counts, scores, the query string used —
    never a full `ProviderCandidate` object, to keep entries light and
    avoid ever duplicating FACT/INFERRED data into a third place);
    `timestamp` is ISO 8601 (`z.string().datetime()`, same convention
    as `Fact`/`Inferred`/`Simulated`).
  - `backend/src/store/traceStore.ts` — `appendTraceEvents(sessionId: string, events: TraceEvent[]): void`
    (no-ops safely if `events` is empty; does **not** require the
    session to already exist in `sessionStore` — trace is a separate,
    unrelated Map, so no cross-module coupling) and
    `getTrace(sessionId: string): TraceEvent[]` (returns `[]`, not
    `undefined`, for an unknown/empty session — "no trace yet" is a
    valid, representable state, not an error).
  - Trace **accumulates** across multiple calls for the same session
    (e.g. the user re-triggers a search) rather than being overwritten
    each time — "per-session trace," per the roadmap's own wording.
- Constraints:
  - No wiring into `generateProviderList.ts`, `selectProvider.ts`, or
    `server.ts` in this task — those are separate follow-on tasks
    (planned as task-70/71/72, not yet written; see Follow-ups).
  - No new HTTP route in this task.
  - Do not touch `sessionStore.ts` — trace storage is intentionally a
    separate Map/module, not a field added onto `ConversationState`
    (keeps `ConversationState` — the thing extraction/merge/readiness
    logic reasons about — unchanged; trace is purely an observability
    side-channel).
- Open Questions: none — this task's shape is fully determined by the
  scope narrowing agreed in chat (see Assignment Alignment) and the
  existing `sessionStore.ts`/`evidence.ts` precedents it mirrors.

## Assignment Alignment
- Requirement type: BONUS (explicitly optional, "cut first" per
  `memory-bank/roadmap.md`'s Scope Discipline section)
- Assignment requirement: "An agent trace/debug view showing how the
  recommendation was produced" — Bonus section, page 8 of
  `docs/Home Assignment.pdf` (re-read directly for this task, not from
  memory).
- Source: `docs/Home Assignment.pdf`, Bonus section (final page).
- Rationale / scope-narrowing finding: the assignment's own wording is
  "how **the recommendation** was produced," not "how the whole
  conversation was conducted." The roadmap's original M13 row
  ("per-session trace of orchestrator steps," depending on M5, M7, M9,
  M11) was broader than that literal wording. Narrowed scope for M13,
  confirmed before this task was written: trace covers exactly the two
  functions that produce a recommendation —
  `generateProviderList` (M7 discovery → M8 enrichment → M9 ranking,
  `backend/src/recommendation/generateProviderList.ts`) and
  `selectProvider` (M10 gap analysis → M11 simulation,
  `backend/src/recommendation/selectProvider.ts`) — not M3/M4/M5's
  requirement-gathering conversation turns. This task itself is
  scope-neutral (a schema and a Map have no orchestration-step
  opinions baked in) but is written against that narrowed target so
  the fields it defines (`step`, `summary`, `detail`) fit what
  task-70/71 will actually record.
- Also narrowed: no frontend "view" is planned in this pass — a JSON
  debug endpoint (task-72) satisfies the roadmap's own prior framing
  ("debug endpoint") and is a defensible, bounded interpretation of
  the bonus given "don't try to implement every bonus" (same page).
  A frontend trace screen remains a possible follow-up, not committed
  scope.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/domain/trace.ts`
- CREATE: `backend/src/store/traceStore.ts`
- CREATE: `backend/src/domain/trace.test.ts`
- CREATE: `backend/src/store/traceStore.test.ts`
- DO NOT TOUCH: `backend/src/store/sessionStore.ts`,
  `backend/src/recommendation/generateProviderList.ts`,
  `backend/src/recommendation/selectProvider.ts`, `backend/src/server.ts`

### Implementation Notes
- `TraceEventSchema` follows the same Zod-schema-plus-inferred-type
  pattern as `FactSchema`/`InferredSchema`/`SimulatedSchema` in
  `backend/src/domain/evidence.ts`, but is a plain (non-generic)
  schema — there's no `value: T` to parameterize, so no factory
  function is needed here.
- `traceStore.ts` mirrors `sessionStore.ts`'s shape
  (module-level `Map`, no TTL/eviction, consistent with the project's
  established in-memory-only constraint) but is deliberately a
  separate Map in a separate module rather than a new field on
  `ConversationState`/`sessionStore` — see Constraints above.

## VALIDATE
### Unit Tests
- [ ] `TraceEventSchema` accepts a valid event (with and without
      `detail`) and rejects a missing `step`/`summary`/`timestamp` or a
      non-ISO `timestamp`.
- [ ] `getTrace` returns `[]` for a session id that was never appended to.
- [ ] `appendTraceEvents` followed by `getTrace` returns exactly the
      appended events, in order.
- [ ] Two calls to `appendTraceEvents` for the same session id
      accumulate (both batches present in `getTrace`), not overwrite.
- [ ] `appendTraceEvents` with an empty array is a safe no-op (doesn't
      throw, doesn't create a spurious empty-but-present entry
      distinguishable from "never called" — both read back as `[]`).
- [ ] Two different session ids stay independent (events for one never
      appear in `getTrace` for the other).

### Success Criteria
- [ ] `npm run build` clean
- [ ] `npm test` passes, no regressions
- [ ] No route, no wiring into existing orchestrators — standalone
      module only, per Constraints

## ITERATE
### Outcome
Implemented exactly as scoped. `backend/src/domain/trace.ts`
(`TraceEventSchema`/`TraceEvent` — `step`, `summary`, optional
`detail: Record<string, unknown>`, ISO `timestamp`) and
`backend/src/store/traceStore.ts` (`appendTraceEvents`/`getTrace`,
module-level `Map<string, TraceEvent[]>`, no TTL/eviction, mirrors
`sessionStore.ts`). 11 new tests (6 schema, 5 store), `npm test`
321/321 passing (310 pre-existing + 11 new), `npm run typecheck` and
`npm run build` both clean. No wiring, no route, `ConversationState`/
`sessionStore.ts`/`generateProviderList.ts`/`selectProvider.ts`/
`server.ts` untouched, per Constraints.

### Knowledge Updates
- M13's scope was extended in the same session this task was approved
  in: the eventual result must include a human-readable frontend view,
  not just a JSON debug endpoint (direct user instruction — see
  Follow-ups' task-73, and the design reported back in chat).
  `memory-bank/decisions.md` should get a dated entry recording this
  once the full M13 task set is written, so the "JSON-endpoint-only"
  framing in this task's own Assignment Alignment section above isn't
  read as still-current in isolation.

### Follow-ups
Revised M13 plan (4 tasks remain; task-69 is the only one done):

- task-70 (planned, not yet written): instrument
  `generateProviderList.ts` to also produce `TraceEvent[]` (search
  query used, discovery/dedup/enrichment counts, per-candidate ranking
  dimension scores + explanation) and have the
  `POST /conversation/:id/providers` route call
  `appendTraceEvents(sessionId, trace)` after a successful call.
- task-71 (planned, not yet written): the same for `selectProvider.ts`
  (gaps found by topic, questions phrased, simulated-answer count) and
  the `POST /conversation/:id/providers/select` route.
- task-72 (planned, not yet written): new
  `GET /conversation/:id/trace` route — 404 unknown session, 200
  `{ events: TraceEvent[] }` otherwise (empty array, not 404, for a
  known session with no recommendation run yet). Now explicitly the
  frontend's data source, not just a standalone debug affordance.
- task-73 (planned, not yet written, **new** — added per direct user
  instruction to extend M13 beyond an API-only trace): a
  presentational `TraceScreen` (frontend, prop-driven, no fetching —
  same M15 screen convention) rendered from
  `GET /conversation/:id/trace`, reachable from the Recommendations
  screen via a "How was this produced?" affordance, per the flow:
  `Recommendations → "How was this recommendation produced?" → Trace/Debug view`.
  Full design proposed and reported to the user in chat (grouped
  numbered sections mirroring discovery → dedup → enrichment → ranking
  → selection, per-provider dimension scores, clearly labeled as a
  debug/transparency view, structurally separate from the
  FACT/INFERRED/SIMULATED sections elsewhere in the app) — not yet
  approved for implementation.
- Open design question for task-70/71 (to resolve when those tasks are
  written, not blocking this one): whether a mid-pipeline failure
  should still write a partial trace. Current lean: no — trace is only
  written on success, since it's returned as an ordinary pure value
  from `generateProviderList`/`selectProvider` rather than
  incrementally side-effected, and failure visibility is already
  covered separately by the existing 429/502/500 error responses and
  server-side `app.log.error`.
