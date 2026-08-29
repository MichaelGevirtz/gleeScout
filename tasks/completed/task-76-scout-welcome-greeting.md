# Task 76: Seed a deterministic Scout welcome message for new sessions
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: every newly created conversation session starts with exactly one
  deterministic, backend-owned Scout greeting as the first `assistant`
  message in `ConversationState.messages`, so the Chat screen is never
  blank on first open and Scout (task-75) is present immediately —
  without any LLM call, any new state, or any change to the
  extraction/question/readiness architecture.
- Inputs: `createSession()` in `backend/src/store/sessionStore.ts`,
  `createInitialState()` + `Message`/`ConversationStateSchema` in
  `backend/src/domain/conversation.ts`, task-75's `ChatScreen`
  rendering (`findLastAssistantIndex`), D21.
- Outputs: one exported greeting constant, a one-line seed in
  `createSession()`, and focused tests. No frontend change.
- Constraints:
  - The greeting is a **static string constant**. It MUST NOT call
    Gemini or Firecrawl, and MUST NOT be generated, phrased, or
    rewritten by any LLM at any point.
  - It must not affect requirement extraction, missing-attribute /
    question selection, readiness, provider ranking, or the phase
    state machine. It is conversation history for display only.
  - It must never be treated as a user requirement, and must not be
    treated as the assistant's pending question.
  - No new conversation state, no new API endpoint, no new frontend
    state, no new component, no onboarding screen, no animation.
  - `phase` stays `"gathering"`; all other initial fields unchanged.
- Open Questions: none. The seeding location was resolved by the
  investigation below and is no longer a judgment call.

## Assignment Alignment
- Requirement type: RECOMMENDATION
- Assignment requirement: Part 6 — "The UI doesn't need to be
  beautiful, but it should be understandable and thoughtfully
  designed"; evaluation criterion 6, Taste.
- Source: `docs/Home Assignment.pdf`, Part 6 and "What We Will
  Evaluate" §6.
- Rationale: not assignment-required and not a prior project decision.
  It closes the one gap task-75 left open — D21's stated problem
  ("nothing signals that an assistant is present") is still unsolved at
  first paint, which is the first thing a reader of this project sees.
  Deliberately kept to a constant plus one line so it stays a UX fix,
  not an onboarding feature.

## Investigation Findings (completed before this task was written)
1. `ConversationState` is constructed in exactly one place:
   `createInitialState(sessionId)` — `backend/src/domain/conversation.ts:35`.
   The initial `messages: []` is that function's line 42.
2. A *session* is created in exactly one place: `createSession()` —
   `backend/src/store/sessionStore.ts:6`, which calls
   `createInitialState` and stores the result in the in-memory `Map`.
3. `POST /conversation` (`server.ts:60`) returns `createSession()`'s
   state directly. `GET /conversation/:id` (`server.ts:66`) returns the
   stored state verbatim — so anything seeded at creation is
   automatically returned on resume with no route change.
4. Messages are `{ role: "user" | "assistant", content: string }`
   (`MessageSchema`, `conversation.ts:20`). A seeded greeting needs no
   schema change and validates as-is.
5. **`createInitialState` is NOT a safe seeding point.** It is also the
   shared blank-state fixture builder for ~100 call sites across
   `mergeExtraction.test.ts`, `orchestrateMessage.test.ts`,
   `questionPolicy.test.ts`, `extraction.test.ts`, `ranking/`,
   `providerQuestions/`, `recommendation/` and `server.test.ts`.
   Seeding there would break at least
   `orchestrateMessage.test.ts:60` (`expect(capturedState?.messages)
   .toEqual([{ role: "user", ... }])`) and
   `orchestrateMessage.test.ts:136` (`expect(result.messages).toEqual([...])`),
   and would inject UX copy into every unrelated unit fixture.
   → **Seed in `createSession()` instead**, which is the real
   new-session path and leaves every unit fixture untouched.
6. The only existing test asserting an empty initial transcript on the
   real path is `server.test.ts:58` (`messages: []` inside the
   `POST /conversation` `toMatchObject`). That one assertion updates.
7. `mergeExtraction.ts:15` appends the user message to
   `state.messages`, and `orchestrateMessage.ts:52` appends the
   assistant question — both are pure appends, so ordering after the
   first send is greeting → user → assistant with no code change.
8. The LLM layer never reads the transcript: no reference to
   `.messages` anywhere in `backend/src/llm/`. `extractRequirements`
   and `generatePendingQuestion` consume structured state only.
   This is what makes the greeting provably inert with respect to
   extraction and question selection.
9. Frontend needs no change. `findLastAssistantIndex` returns `0`
   instead of `-1`, and task-75's existing rendering attaches Scout to
   it. No frontend file is in scope.

## IMPLEMENT
### Files Touched
- MODIFY: `backend/src/domain/conversation.ts` — add an exported
  `SCOUT_WELCOME_MESSAGE: Message` constant. **Do not change
  `createInitialState`'s `messages: []`.**
- MODIFY: `backend/src/store/sessionStore.ts` — seed the constant in
  `createSession()` only.
- MODIFY: `backend/src/store/sessionStore.test.ts` — new-session
  greeting tests.
- MODIFY: `backend/src/server.test.ts` — update the `POST /conversation`
  assertion; add `GET /conversation/:id` and post-first-message tests.
- MODIFY: `backend/src/conversation/orchestrateMessage.test.ts` — add
  the inertness tests (greeting does not change extraction input or
  question selection).
- DO NOT TOUCH: `frontend/**` (no frontend change is required),
  `backend/src/llm/**`, `backend/src/conversation/mergeExtraction.ts`,
  `backend/src/conversation/questionPolicy.ts`,
  `backend/src/conversation/orchestrateMessage.ts`,
  `backend/src/ranking/**`, `backend/src/recommendation/**`,
  `backend/src/providerQuestions/**`, `backend/src/server.ts` routes,
  `createInitialState`'s body.

### Implementation Notes
- Copy (approved, use verbatim): "Hi, I'm Scout. Tell me about the
  event you're planning and I'll help you find the right providers."
  It is an opener, not a question, and asks for no specific attribute —
  so it cannot be confused with `selectNextMissingAttribute`'s output.
- Define the constant in the domain module (which owns `Message`), seed
  it in the store (which owns session creation). This keeps the copy
  with the type it satisfies while confining the behavioral change to
  the one real path.
- Seed a fresh object per session (e.g. spread the constant) so no two
  sessions share a mutable message reference.
- The greeting is display-only: no `phase` change, no
  `serviceCategory`/attribute writes, nothing added to
  `categoryAttributes`.

## VALIDATE
### Unit Tests
- [x] A newly created session contains exactly one message
- [x] That message has `role: "assistant"` and the exact greeting text
- [x] Creating a session invokes no Gemini/LLM call and performs no
      network I/O (no LLM module is imported on the creation path)
- [x] `createInitialState` still returns `messages: []` (unchanged) —
      guards the fixture builder against future regression
- [x] The seeded state still satisfies `ConversationStateSchema`

### Component / Integration Tests
- [x] `POST /conversation` returns the greeting as the only message
- [x] `GET /conversation/:id` returns the greeting for a resumed session
- [x] After the user sends a first message, the greeting is still
      `messages[0]`, followed by the user message and the assistant's
      question
- [x] The greeting does not change what is passed to extraction —
      extracted requirements are identical with and without it
- [x] The greeting does not change question selection or readiness —
      `selectNextMissingAttribute` / `isReadyForSearch` return the same
      result with and without it

### E2E Tests
- [x] None. No new route or client flow; covered by the integration
      tests above.

### Success Criteria
- [x] `backend`: `npm test` passes, including all pre-existing
      conversation/extraction/ranking suites
- [x] `backend`: `npm run typecheck` clean
- [x] `frontend`: `npm test` still passes with no frontend file changed
- [x] No new dependency, no new endpoint, no new state field
- [x] No LLM or network call added to session creation
- [x] Task scope fully implemented; no unrelated refactors

## ITERATE
### Outcome
Implemented exactly as planned, including the seeding location the
investigation identified. `SCOUT_WELCOME_MESSAGE` is a static exported
`Message` constant in `backend/src/domain/conversation.ts`;
`createSession()` in `backend/src/store/sessionStore.ts` spreads a fresh
copy of it into `messages` at session creation. `createInitialState`
still returns `messages: []` and is now guarded by a test that says so,
so the greeting cannot later drift into the shared fixture builder.

The predicted blast radius held: exactly one pre-existing assertion
needed updating (`server.test.ts`'s `POST /conversation`
`toMatchObject`, `messages: []` → the greeting). No production file
outside the two named ones was touched; no orchestration, extraction,
question-policy, ranking, or route code changed; no frontend file
changed at all.

Tests added (13 new backend cases, all 8 of the task's requirements
covered):
- `sessionStore.test.ts` (4): exactly one message; assistant role +
  exact copy; per-session object identity (no shared reference); and a
  `vi.spyOn(globalThis, "fetch")` assertion proving session creation
  performs no network I/O.
- `domain/conversation.test.ts` (2): the constant is an assistant opener
  containing no "?", and `createInitialState` still yields an empty
  transcript.
- `orchestrateMessage.test.ts` (4): identical structured state with and
  without the greeting; unchanged message handed to extraction;
  unchanged question target and phase; and transcript ordering
  greeting → user → assistant question.
- `server.test.ts` (3): `POST /conversation` returns the greeting as the
  only message without calling orchestrate; `GET /conversation/:id`
  returns it on resume; and it remains `messages[0]` after the first
  user message round-trips through the route.

Validation: `backend npm test` — 38 files / 340 tests passing.
`backend npm run typecheck` clean. `frontend npm test` — 14 suites / 129
tests passing with zero frontend files changed, confirming task-75's
`findLastAssistantIndex` picks the greeting up as `chat-message-0` and
attaches Scout to it with no client work.

One deviation from the declared file list, test-only: the
`createInitialState` guard test went into
`backend/src/domain/conversation.test.ts` (which already tests that
function) rather than `sessionStore.test.ts`, where it would have been
testing the wrong module. No production file outside the plan was
touched.

Not verified: the visual result in a browser. Same gap as task-75 —
Playwright is not installed — so "the chat screen is no longer blank on
first open" is proven at the API and component-contract level, not
observed on screen.

### Knowledge Updates
- `memory-bank/decisions.md`: added **D22** recording the
  seed-in-`createSession`-not-`createInitialState` split, the reason
  (`createInitialState` doubles as the ~100-call-site fixture builder),
  and the deterministic-greeting rationale (no Gemini call means the
  first screen survives an LLM outage or rate limit — which is exactly
  the condition under which the blank screen was originally observed).
- `memory-bank/progress.md`: backend suite count updated to 38 files /
  340 tests, with a note that new sessions now open with the greeting.
- No `DESIGN.md` change: no new assumption, LLM/deterministic split, or
  architecture point beyond what D21/D22 already carry.

### Follow-ups
- The browser pass still outstanding from task-75 now also covers this:
  confirm on screen that a fresh session opens with Scout plus the
  greeting, at all four breakpoints. Unblocked by nothing; just needs a
  browser.
- None of the "do not add" items (onboarding screen, animation,
  greeting component, new state/endpoint/LLM call) were introduced, and
  none are recommended as follow-ups.
