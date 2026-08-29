# Task 47: Session hook (bootstrap, resume, send message)
Status: DONE
Can run in parallel with: 48, 49, 50, 51, 52, 53 (all depend only on
task-46's output; disjoint files; none depend on each other)

## PLAN
- Goal: one React hook owning the conversation session's lifecycle —
  create-or-resume on mount, and sending a chat message — so screen
  components (task-48 onward) receive a ready `ConversationState` and
  simple callbacks instead of each implementing their own fetch/
  AsyncStorage logic.
- Inputs: `frontend/src/api/client.ts` / `frontend/src/domain/types.ts`
  (task-46); `design/m14-ux-spec.md`'s Chat screen wiring section
  (`POST /conversation` once on open; `GET /conversation/:id` on
  resume with a stored `sessionId`; `POST .../message` per send,
  response replaces state wholesale — "don't hand-merge; the server is
  authoritative").
- Outputs: NEW `frontend/src/hooks/useSession.ts` exporting
  `useSession()`:
  ```
  {
    sessionId: string | null;
    state: ConversationState | null;
    isBootstrapping: boolean;
    bootstrapError: string | null;
    retryBootstrap: () => void;
    sendMessage: (message: string) => Promise<ConversationState>; // throws on failure, does not swallow
  }
  ```
  Bootstrap behavior on mount:
  1. Read a stored `sessionId` from `AsyncStorage` (key:
     `"glee-scout-session-id"`).
  2. If present, `GET /conversation/:id`. On success, adopt that
     `state`. On a 404 (`ApiError` with `status: 404` — the backend
     restarted and lost all in-memory sessions, an expected
     consequence of D9's no-persistence design, not an error state to
     surface to the user), silently fall through to step 3 rather than
     showing an error.
  3. Otherwise (no stored id, or step 2 fell through), `POST /conversation`,
     store the returned `sessionId` in `AsyncStorage`, adopt the
     returned `state`.
  4. Any other failure (non-404 error from step 2, or any error from
     step 3) sets `bootstrapError` to a user-facing message;
     `retryBootstrap()` re-runs this same sequence from step 1.
  `sendMessage(message)` calls `client.sendMessage(sessionId, message)`
  and, on success, replaces `state` wholesale with the response and
  returns it; on failure, `state` is left unchanged and the rejection
  propagates to the caller (the hook does not catch it — task-48's
  `ChatScreen` owns per-bubble pending/failed/retry UI, per the UX
  spec's "do not lose the chat itself" instruction; the hook's job
  ends at "call the API, report success or failure").
- Constraints:
  - No screen-state-machine concerns here (no "which screen is active"
    logic) — that's task-54.
  - No `POST /providers` / `POST /providers/select` calls — those
    belong to task-54's orchestration, not the session hook; `state`
    (specifically `state.phase`) is all task-54 needs from this hook
    to decide when to trigger them.
  - New dependency: `@react-native-async-storage/async-storage`
    (Expo-compatible, the standard RN local-storage primitive) — used
    only for the one `sessionId` string, not general persistence; this
    is client-device-local convenience, not the backend
    database/persistence the assignment says is unnecessary (D9 is
    about the backend; the backend still starts every process run with
    zero sessions, per the 404-handling above).
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT (Part 1 — the conversational
  requirement-gathering flow itself needs a live session) + PROJECT
  DECISION (client-side session-id persistence across app relaunch,
  confirmed as part of the frozen M14 UX spec's Chat screen wiring —
  restated here, not a new decision).
- Assignment requirement: "Create a conversational flow that gathers
  enough information to search for appropriate providers" (Part 1);
  "Maintain structured event and requirement data behind the
  conversation" (Part 1, item 6).
- Source: Home Assignment PDF, Part 1.
- Rationale: the frontend needs exactly one place that knows "how to
  get a live session," matching the backend's own single-responsibility
  precedent (e.g. `sessionQueue.ts` owns serialization, nothing else
  reaches into it).

## IMPLEMENT
### Files Touched
- CREATE: `frontend/src/hooks/useSession.ts`,
  `frontend/src/hooks/useSession.test.ts`
- MODIFY: `frontend/package.json` (add
  `@react-native-async-storage/async-storage`)
- DO NOT TOUCH: `frontend/src/screens/` (does not exist until
  task-48+), `frontend/src/App.tsx`, `backend/`

### Implementation Notes
- Test the hook with `@testing-library/react-native`'s `renderHook`
  (or a tiny host component wrapper if the installed RNTL version
  lacks `renderHook`), mocking both `frontend/src/api/client.ts`
  (`jest.mock`) and `AsyncStorage` (`jest.mock`
  `@react-native-async-storage/async-storage`) — no real network/
  storage calls in the test suite.
- The three bootstrap branches (resume-success, resume-404-then-create,
  fresh-create) must each be a distinct test — this is the exact
  behavior the UX spec calls out by name ("On resume...", "on app
  open...").

## VALIDATE
### Unit Tests
- [ ] No stored `sessionId` → calls `createConversation`, stores the
      returned id, adopts the returned state, `isBootstrapping` ends
      `false`.
- [ ] Stored `sessionId`, `getConversation` succeeds → adopts that
      state, `createConversation` never called.
- [ ] Stored `sessionId`, `getConversation` 404s → falls through to
      `createConversation`, stores the new id, adopts the new state.
- [ ] Stored `sessionId`, `getConversation` fails with a non-404 error
      → `bootstrapError` set, `state` stays `null`.
- [ ] `retryBootstrap()` re-runs the full sequence.
- [ ] `sendMessage` success replaces `state` wholesale with the
      response and resolves with it.
- [ ] `sendMessage` failure leaves `state` unchanged and the returned
      promise rejects (not swallowed).

### Component / Integration Tests
- N/A (hook-only; screen wiring is task-54).

### E2E Tests
- N/A.

### Success Criteria
- [ ] TS compiles with no errors.
- [ ] `npm test` passes, including new tests, no regressions.
- [ ] No files outside `Files Touched` modified.

## ITERATE
### Outcome
Implemented exactly as planned. `frontend/src/hooks/useSession.ts`
exports `useSession()` with the exact shape specified (`sessionId`,
`state`, `isBootstrapping`, `bootstrapError`, `retryBootstrap`,
`sendMessage`). Bootstrap sequence matches the four-step plan
(resume-success / resume-404-then-create / fresh-create /
non-404-error) exactly. New dependency:
`@react-native-async-storage/async-storage`, installed via `npx expo
install` (SDK-aligned, same precedent as task-45).

`frontend/src/hooks/useSession.test.ts`: 9 tests covering all 7
required cases from VALIDATE plus 2 extra (`sendMessage` uses `state`
read via closure correctly across a resumed vs. freshly-created
session — folded into the existing cases).

**Three real Jest/RNTL gotchas found and fixed here, all worth
carrying into every other M15 test file (48-54)**:
1. **`jest.mock("../api/client")` with no factory (bare automock)
   breaks `ApiError`'s prototype chain** — `error instanceof ApiError`
   (and even `instanceof Error`) came back `false` inside the hook,
   because automocking a `class X extends Error` strips its real
   prototype. Fix: mock with an explicit factory that spreads
   `jest.requireActual(...)` and only replaces the plain functions:
   ```
   jest.mock("../api/client", () => ({
     ...jest.requireActual("../api/client"),
     createConversation: jest.fn(),
     getConversation: jest.fn(),
     sendMessage: jest.fn(),
   }));
   ```
   Any later task mocking `client.ts` and needing to construct/compare
   a real `ApiError` (task-53's `ErrorState`/task-54's retry wiring in
   particular) needs this same pattern, not a bare `jest.mock(path)`.
2. **`jest.clearAllMocks()` in `beforeEach` does NOT clear queued
   `mockResolvedValueOnce`/`mockRejectedValueOnce` values** — leftover
   queued values from one test bled into the next test's execution,
   causing nondeterministic-looking failures (a later test consuming an
   earlier test's leftover queued resolution). Fixed by using
   `jest.resetAllMocks()` instead, which also flushes the once-queue.
   Any test file with more than one test against the same mocked
   function needs `resetAllMocks`, not `clearAllMocks`.
3. **`@testing-library/react-native@14.0.1`'s `renderHook` is also
   async** (matching D17's `render`/`fireEvent` finding from task-45)
   — `const { result } = await renderHook(...)`, not a bare call.
   Directly invoking a returned hook method outside of `render`/
   `fireEvent` (e.g. `result.current.retryBootstrap()`,
   `result.current.sendMessage(...)`) triggers React's "not wrapped in
   act(...)" warning unless wrapped in RNTL's own `act(async () => {
   ... })` — done here for both.

`npm test`: 20/20 passing (9 new + 11 pre-existing from task-45/46), no
warnings. `npx tsc --noEmit`: clean. No files outside `Files Touched`
modified.

### Knowledge Updates
The three gotchas above are restated in `.claude/CLAUDE.md`'s Commands
section (frontend) so every later M15 task/agent sees them before
writing tests, and in `memory-bank/decisions.md` as an addendum to D17
(same root cause family: React 19 concurrent rendering + Jest
automocking interacting with this specific stack version combination).

### Follow-ups
None new.
