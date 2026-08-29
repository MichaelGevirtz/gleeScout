# Task 44: Provider selection route (M12, route 2)
Status: DONE
Can run in parallel with: NONE (shares `server.ts` with task-43 —
sequential, not parallel; no functional dependency on task-43's
output)

## PLAN
- Goal: for one client-selected provider, run M10's gap analysis +
  question phrasing and M11's response simulation, returning the
  result over HTTP — the second of M12's two routes per D14. This is
  where Part 4 and Part 5's LLM work actually gets triggered — M10/M11
  have been standalone, unwired functions since they were built.
- Inputs (all read-only): `backend/src/providerQuestions/prepareProviderQuestions.ts`
  (M10), `backend/src/providerQuestions/simulateProviderResponses.ts`
  (M11), `backend/src/domain/provider.ts` (`ProviderCandidateSchema`),
  `backend/src/domain/evidence.ts` (`Simulated<T>`),
  `backend/src/domain/conversation.ts` (`ConversationState`),
  `backend/src/store/sessionStore.ts` (`getSession`),
  `backend/src/server.ts` (existing Fastify app, to extend).
- Outputs:
  - NEW `backend/src/recommendation/selectProvider.ts` exporting
    `selectProvider({ candidate, state, prepareQuestions?, simulate? }):
    Promise<{ question: string; answer: Simulated<string> }[]>`. Calls
    `prepareQuestions({ candidate, state })` (defaults to the real
    `prepareProviderQuestions`) to get `questions: string[]`, then
    `simulate({ candidate, questions, state, generatedAt })` (defaults
    to the real `simulateProviderResponses`) with
    `generatedAt = new Date().toISOString()` generated internally
    (matching `discoverProviderCandidates`/`enrichProviderCandidates`'s
    own precedent of generating their own timestamps rather than
    requiring the caller to), and returns the paired result unchanged
    — task-39/40 already produced exactly the `{question, answer}[]`
    shape needed, so no further transformation happens here.
  - MODIFY `backend/src/server.ts`: new route
    `POST /conversation/:id/providers/select` — 404 if session
    unknown; request body parsed as `{ candidate: ProviderCandidate }`
    and validated with `ProviderCandidateSchema.safeParse` (400 on
    failure, matching the existing message route's body-validation
    pattern); calls `selectProvider({ candidate, state })`; returns
    `{ answers: [...] }` with 200. Error mapping: known Gemini errors →
    502 (matches M10/M11's uncaught-propagation precedent — a
    simulation/phrasing failure is not silently swallowed, D14/D15);
    generic catch-all → 500. No internal detail leaked.
- Constraints:
  - Does not gate on `state.phase` — D14 does not tie provider
    selection to `phase`; a user can select a provider from an earlier
    list while the conversation continues elsewhere. No phase check
    added, consistent with the existing message route's own "no phase
    gate" precedent (task-12).
  - Does not verify the client-echoed `candidate` against anything the
    server previously returned, and does not check it originated from
    this session's own `generateProviderList` call — this is D14's
    addendum's explicitly accepted trust boundary (structural
    validation only, never authenticity), and this task's own text
    must restate that plainly rather than let the Zod check read as a
    security check.
  - Writes nothing back to session state — no `updateSession` call, no
    "which provider was selected" tracking, per D14.
  - Does not use `runSerialized` — no session write, same reasoning as
    task-43.
  - Does not modify `prepareProviderQuestions`, `simulateProviderResponses`,
    or any M10/M11 file — pure wiring.
- Open Questions: none.

## Assignment Alignment
- Requirement type: **EXPLICIT** (Part 4 — provider-specific gap
  questions; Part 5 — simulated responses, clearly separated from
  fact) **+ PROJECT DECISION** (D14's selection-triggered, on-demand
  invocation model; D14's addendum on trust boundary).
- Assignment requirement: "For each provider, generate the questions
  that should be asked... We want to see the agent reasoning about
  what it knows, what it doesn't know" (Part 4); "Instead of actually
  contacting providers, simulate their responses using an LLM. The
  simulation should be clearly separated from factual information...
  we should always be able to understand which information is
  observed/sourced versus inferred/simulated" (Part 5).
- Source: Home Assignment PDF, Part 4 (page 3–4), Part 5 (page 4).
- Rationale: same as task-43 — this route is the delivery surface
  making M10/M11's already-implemented, already-tested pure functions
  reachable by a real client, per D14's explicit "runs only for the
  single provider the user selects" design (confirmed during M10/M11
  planning, restated here rather than revisited).

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/recommendation/selectProvider.ts`,
  `backend/src/recommendation/selectProvider.test.ts`
- MODIFY: `backend/src/server.ts`, `backend/src/server.test.ts`
- DO NOT TOUCH: everything under `backend/src/providerQuestions/`,
  `backend/src/llm/` (read-only dependencies), `backend/src/research/`,
  `backend/src/ranking/`, `backend/src/conversation/`,
  `backend/src/domain/`, `backend/src/store/`,
  `backend/src/recommendation/generateProviderList.ts` (task-43, if
  already landed — do not touch even if this task is implemented
  first)

### Implementation Notes
- `selectProvider`'s injected params (`prepareQuestions`, `simulate`)
  default to the real M10/M11 functions, same DI pattern as every
  other orchestrator in this codebase. Tests inject fakes — no live
  network/LLM calls in the automated suite.
- Route body shape: `{ candidate: <ProviderCandidate JSON> }`, not the
  bare candidate at the top level — keeps the request body
  self-describing and leaves room for future sibling fields without a
  breaking shape change (a plain naming/shape choice, not a new
  behavior).
- Route test doubles inject a fake `selectProvider`-shaped function via
  a new optional `BuildServerDeps` field (e.g. `selectProvider`), same
  pattern as task-43's `generateList` and the existing `orchestrate`.

## VALIDATE
### Unit Tests
- [ ] `selectProvider` calls `prepareQuestions` with the candidate and
      state, then `simulate` with the candidate, `prepareQuestions`'s
      result as `questions`, the state, and a generated `generatedAt`,
      returning `simulate`'s result unchanged (both faked).
- [ ] A rejection from `prepareQuestions` propagates without being
      swallowed.
- [ ] A rejection from `simulate` propagates without being swallowed.

### Component / Integration Tests
- [ ] `POST /conversation/:id/providers/select` returns 404 for an
      unknown session without calling `selectProvider`.
- [ ] Returns 400 for a body that fails `ProviderCandidateSchema`
      validation, without calling `selectProvider`.
- [ ] Returns 200 with `{ answers: [...] }` from a faked
      `selectProvider` for a valid session + valid candidate body.
- [ ] Returns 502 with a generic body when `selectProvider` rejects
      with a known Gemini error; internal detail not present in the
      response body.
- [ ] Returns 500 with a generic body for an unrelated rejection;
      internal detail not present in the response body.

### E2E Tests
- [ ] N/A — manual real-API check optional/deferred, same convention
      as prior LLM-touching tasks (non-blocking).

### Success Criteria
- [ ] `npm run build` (backend) succeeds with no TypeScript errors.
- [ ] `npm test` (backend) passes, including new tests, with no live
      network calls and no regressions elsewhere.
- [ ] No files outside `Files Touched` modified.

## ITERATE
### Outcome
Implemented exactly as planned, no deviations. Route path is
`POST /conversation/:id/providers/select`, matching the task's own
naming.

`backend/src/recommendation/selectProvider.ts` exports
`selectProvider({ candidate, state, prepareQuestions?, simulate? })`,
with `PrepareQuestionsFn`/`SimulateFn` injection types matching every
prior orchestrator's DI pattern, defaulting to the real
`prepareProviderQuestions` (M10) / `simulateProviderResponses` (M11).
Generates `generatedAt = new Date().toISOString()` internally (not
caller-supplied), matching M7/M8's own precedent for their internal
timestamps. Returns `simulate`'s `{question, answer}[]` result
unchanged — no reshaping needed.

`backend/src/server.ts`: `BuildServerDeps` gained `selectProvider`
(defaults to the real function). New `SelectProviderBodySchema = z.object({
candidate: ProviderCandidateSchema })`. Route reads the session (404
if unknown — checked *before* body parsing, matching the message
route's existing precedent), validates the body (400 on failure), then
calls `select({ candidate, state })` and returns `{ answers: [...] }`.
No `state.phase` check, per the task's explicit constraint. A code
comment above the route restates D14's addendum plainly (structural
validation only, not an authenticity check, no auth boundary in this
prototype) so a future reader doesn't mistake the Zod check for a
security check. Catch block: known Gemini errors → 502, generic
catch-all → 500, same shape as the existing message route (no
`FirecrawlConfigError` case here — M10/M11 never call Firecrawl).

`backend/src/recommendation/selectProvider.test.ts`: 3 tests (wiring
order + argument shapes, including asserting `generatedAt` is a valid
ISO string rather than a fixed value since it's generated internally;
rejection propagation from `prepareQuestions`, confirming `simulate`
is never called in that case; rejection propagation from `simulate`).

`backend/src/server.test.ts`: 5 new tests in a new
`describe("POST /conversation/:id/providers/select")` block (404
unknown session; 400 for a candidate failing `ProviderCandidateSchema`
— used an invalid `url` field to trigger it; 200 with the faked
answers, asserting the route echoes the exact candidate through to
`selectProvider`; 502 for a known Gemini error; 500 for an unrelated
error).

`npm run build`: clean. `npm test`: 301/301 passing (293 pre-existing +
8 new: 3 + 5), no live network calls, no regressions. No files outside
`Files Touched` modified — confirmed `providerQuestions/`, `llm/`,
`research/`, `ranking/`, `conversation/`, `domain/`, `store/`, and
`recommendation/generateProviderList.ts` (task-43) all untouched.

**M12 (Recommendation API) is now fully complete.** Both routes are
live: `POST /conversation/:id/providers` (task-43) and
`POST /conversation/:id/providers/select` (this task).

### Knowledge Updates
- `DESIGN.md`'s Assumptions section gained two bullets, both restating
  already-approved D14 decisions for a reader who hasn't seen
  `decisions.md`: (1) simulated data is deliberately absent from the
  initial provider list, a documented deviation from the assignment's
  example card layout; (2) the selection route trusts a client-echoed
  candidate structurally but doesn't re-verify it against what the
  server originally returned, acceptable given no auth/multi-tenant
  boundary exists in this prototype.
- All seven product decisions the reviewer asked to preserve (3-5
  ranked providers via M9's existing cap; M10/M11 never run for all
  candidates; M10/M11 only after one selection; list response shape;
  selection response shape/pipeline; M12 as thin wiring; no caching/
  persistence) were satisfied by task-43 and this task without needing
  any of them to be revisited — none required a design change during
  implementation.

### Follow-ups
None new. M12 is complete; per the roadmap, M13 (agent trace, bonus,
cut-first) or M14 (UX design, required, gates frontend work) are the
next candidates — not decided here, awaiting direction.
