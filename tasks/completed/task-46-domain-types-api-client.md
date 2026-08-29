# Task 46: Domain types + typed API client
Status: DONE
Can run in parallel with: NONE (foundation for every subsequent M15
task — task-47 through task-53 all depend on this task's output)

## PLAN
- Goal: give the frontend a hand-written TypeScript mirror of the
  backend's Zod-inferred shapes, and one thin, typed fetch wrapper for
  all five M12/M5 endpoints the UX spec wires against — so every later
  screen/hook task works against real types and a single, testable
  network boundary instead of ad-hoc `fetch` calls scattered across
  components.
- Inputs (read-only reference, not imported — frontend and backend are
  separate apps/dependency boundaries, per D4/CLAUDE.md's "keep
  frontend independent of backend implementation details"):
  `backend/src/domain/conversation.ts`, `backend/src/domain/provider.ts`,
  `backend/src/domain/evidence.ts`, `backend/src/ranking/types.ts`,
  `backend/src/server.ts` (route/response shapes),
  `design/m14-ux-spec.md` (confirms exact shapes each screen consumes,
  including the `{ answers: [...] }` selection-route shape).
- Outputs:
  - NEW `frontend/src/domain/types.ts` — hand-written TS types
    (interfaces, not Zod — the frontend does not re-validate what the
    backend already validated) mirroring: `ConversationPhase`,
    `CoreAttributes`, `CategoryAttributeSlot`, `Message`,
    `ConversationState`; `Fact<T>`, `Inferred<T>`, `SourceType`,
    `Simulated<T>`; `ProviderCandidateFields`, `ProviderCandidate`;
    `RankingDimension`, `ProviderScore`; `SimulatedAnswer` (`{
    question: string; answer: Simulated<string> }`).
  - NEW `frontend/src/api/client.ts` exporting:
    - `ApiError` class (`status: number`, `message: string`) — thrown
      on any non-2xx response, parsed from the backend's uniform
      `{ error: string }` error body (falls back to a generic message
      if the body doesn't parse).
    - `createConversation(): Promise<{ sessionId: string; state: ConversationState }>` — `POST /conversation`.
    - `getConversation(sessionId: string): Promise<{ state: ConversationState }>` — `GET /conversation/:id`.
    - `sendMessage(sessionId: string, message: string): Promise<{ state: ConversationState }>` — `POST /conversation/:id/message`.
    - `fetchProviders(sessionId: string): Promise<{ providers: ProviderScore[] }>` — `POST /conversation/:id/providers`.
    - `selectProvider(sessionId: string, candidate: ProviderCandidate): Promise<{ answers: SimulatedAnswer[] }>` — `POST /conversation/:id/providers/select`.
    - Base URL read from `process.env.EXPO_PUBLIC_API_URL`, defaulting
      to `http://localhost:3000` when unset (Expo's documented
      convention for client-exposed env vars — `EXPO_PUBLIC_` prefix).
  - NEW `frontend/src/api/client.test.ts` — one test per function
    (success path decodes the expected shape; failure path throws
    `ApiError` with the right status), all against a mocked global
    `fetch` (no real network calls).
- Constraints:
  - No Zod on the frontend — deliberately not re-validating
    already-server-validated JSON; matches "keep frontend independent
    of backend implementation details" (D4) without adding a
    duplicate validation layer the assignment doesn't ask for.
  - No React/RNTL code in this task — plain TS modules only.
  - Does not implement session bootstrap, AsyncStorage, or the
    404-then-recreate resume logic — that's task-47.
- Open Questions: none.

## Assignment Alignment
- Requirement type: SUPPORT (necessary plumbing for every EXPLICIT
  Part 1/2/3/4/5/6 requirement the frontend will render) + PROJECT
  DECISION (typed client over raw `fetch` calls per screen — an
  engineering-quality choice the assignment leaves open).
- Assignment requirement: "Can new tools, provider categories and data
  sources be added without rewriting everything?" (Engineering
  Quality evaluation criterion) is directly served by isolating all
  network calls behind one typed boundary.
- Source: Home Assignment PDF, "What We Will Evaluate" → "3.
  Engineering Quality".
- Rationale: matches this project's own precedent on the backend side
  (D3's Firecrawl boundary, D5's LLM-call injection pattern) of
  isolating external-call surfaces behind small, typed, testable
  modules rather than inlining them at call sites.

## IMPLEMENT
### Files Touched
- CREATE: `frontend/src/domain/types.ts`, `frontend/src/api/client.ts`,
  `frontend/src/api/client.test.ts`
- MODIFY: none
- DO NOT TOUCH: `frontend/src/App.tsx` (task-45's placeholder — left
  as-is until task-54), `backend/`

### Implementation Notes
- Mirror field-for-field, including optionality (`?`) exactly matching
  the Zod schemas' `.optional()`/`.nullable()` — e.g.
  `CategoryAttributeSlot.value: string | null` (nullable, not
  optional, per `backend/src/domain/conversation.ts`), `CoreAttributes`
  fields optional (not nullable).
- `fetchProviders`'s 409 (`phase !== "ready_for_search"`) is a real,
  distinct backend response — surfaced as a normal `ApiError` with
  `status: 409`; callers (task-54) decide what to do with it, this
  task does not special-case it.

## VALIDATE
### Unit Tests
- [ ] Each of the five client functions: success path parses/returns
      the expected shape from a mocked `fetch` 2xx response.
- [ ] Each of the five client functions: a mocked non-2xx `fetch`
      response (with an `{ error: "..." }` body) causes the function
      to reject with an `ApiError` carrying the right `status` and
      `message`.
- [ ] `ApiError` thrown when the error body doesn't parse as JSON
      still carries a sensible fallback message (no unhandled parse
      exception).

### Component / Integration Tests
- N/A (no components in this task).

### E2E Tests
- N/A.

### Success Criteria
- [ ] `npm run build`-equivalent (TS compiles with no errors — Expo
      TS template's `tsc --noEmit` or equivalent) succeeds.
- [ ] `npm test` passes, including new tests, no regressions.
- [ ] No files outside `Files Touched` modified.

## ITERATE
### Outcome
Implemented exactly as planned, no deviations.

`frontend/src/domain/types.ts` mirrors every backend shape field-for-
field (optionality/nullability matched exactly, e.g.
`CategoryAttributeSlot.value: string | null`, `CoreAttributes` fields
optional not nullable).

`frontend/src/api/client.ts` exports `ApiError` and the five typed
functions (`createConversation`, `getConversation`, `sendMessage`,
`fetchProviders`, `selectProvider`), all going through one private
`request<T>()` helper. Base URL from `EXPO_PUBLIC_API_URL`, defaulting
to `http://localhost:3000`. Non-2xx responses throw `ApiError` with the
real HTTP status and the backend's `{error}` message; a body that
isn't valid JSON falls back to a generic `Request failed with status
N` message rather than throwing an unhandled parse error.

`frontend/src/api/client.test.ts`: 13 tests — one success + one
failure case per function (asserting the specific status code each
route can realistically return: 404 for `getConversation`, 409 for
`fetchProviders`, 502 for `sendMessage`, 400 for `selectProvider`),
plus one test confirming the malformed-error-body fallback. All against
a mocked `global.fetch` — no real network calls.

`npm test`: 13/13 new (15/15 total with task-45's 2). `npx tsc
--noEmit`: clean. No files outside `Files Touched` modified.

### Knowledge Updates
None beyond what task-45/D17 already recorded — this task introduced
no new architectural decisions, just implemented the already-approved
plan.

### Follow-ups
None.
