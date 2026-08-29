# Task 54: App orchestrator (screen state machine + wiring)
Status: DONE
Can run in parallel with: NONE (depends on every task-47 through
task-53 output; final integration point of M15)

## PLAN
- Goal: wire task-47's session hook and task-48 through task-53's
  presentational components into one running app — the hand-rolled
  screen-state machine confirmed with the reviewer (no React
  Navigation/expo-router) — implementing the full State 1→8 flow from
  `design/m14-ux-spec.md`, including the persistent "Chat" pill, the
  two error-recovery paths, and the "back to comparison uses in-memory
  data, no refetch" rule.
- Inputs: task-46 (`client.ts`, `types.ts`), task-47 (`useSession`),
  task-48–53 (all six screen/component modules), full
  `design/m14-ux-spec.md` (especially the "Cross-cutting rules" and
  "Open decisions resolved for handoff" sections).
- Outputs: MODIFY `frontend/src/App.tsx` to become the real root
  component:
  - Screen state:
    `type Screen = "chat" | "transitionLoading" | "recommendations" | "providerDetails" | "selectLoading" | "simulatedAnswers"`,
    plus a separate `errorContext: { message: string; retry: () => void } | null`
    that, when set, renders task-53's `ErrorState` **instead of** the
    current screen (an overlay-by-substitution, not a `Screen` union
    member — keeps "what screen was I on" and "did the last action on
    it fail" orthogonal, so returning from a successful retry lands
    back on the right screen without extra state).
  - Uses `useSession()` for `state`/`sessionId`/`sendMessage`/
    bootstrap. While `isBootstrapping`, render a minimal loading
    view (no need for a dedicated component — reuse `TransitionScreen`
    or a simple placeholder, implementer's call, not worth its own
    task). If `bootstrapError`, render `ErrorState` with
    `onRetry={retryBootstrap}`.
  - **Auto-transition on readiness**: a `useEffect` watching
    `state?.phase`: when it becomes `"ready_for_search"` and the
    current screen is `"chat"`, set screen to `"transitionLoading"`
    and call `client.fetchProviders(sessionId)`. On success, store the
    result in a `providers` state variable and set screen to
    `"recommendations"`. On failure, set `errorContext` with
    `retry: () => /* re-run the exact same fetchProviders call */`.
  - **Recommendations → Details**: `onSelectRow` stores the tapped
    `ProviderScore` in a `selectedProvider` state variable and sets
    screen to `"providerDetails"`.
  - **Details → select loading → answers**: `onSelectProvider` sets
    screen to `"selectLoading"`, calls
    `client.selectProvider(sessionId, candidate)`. On success, store
    the `answers` and set screen to `"simulatedAnswers"`. On failure,
    `errorContext` with a retry that re-issues the identical
    `selectProvider(sessionId, candidate)` call with the same
    `candidate` (Open Decision #5 — same request, same inputs, never
    a different recovery path).
  - **Answers → back to comparison**: `onBack` sets screen to
    `"recommendations"` using the already-held `providers` array — no
    new `fetchProviders` call (per the spec: selection writes no
    session state, nothing changed server-side).
  - **Persistent "Chat" pill**: rendered by this component (not by any
    individual screen) on every screen except `"chat"` itself; tapping
    it sets screen to `"chat"`, leaving `providers`/`selectedProvider`
    untouched in memory so returning is non-destructive.
  - **Reopening chat behavior** (Open Decision #1, PROJECT DECISION
    made explicitly here — the spec leaves the exact trigger
    condition open, "if that message changes anything relevant"; a
    client-side check for "did this message change anything relevant"
    has no reliable signal without new backend support, so — per
    explicit reviewer instruction — no semantic client-side logic is
    added to guess at it). The rule: once `state.phase ===
    "ready_for_search"`, **every** successful `sendMessage` call sent
    while on the Chat screen (whether reached via the initial
    auto-transition path or by reopening the Chat pill from a later
    screen) triggers exactly one `fetchProviders` call after it
    resolves. Concretely:
    1. `sendMessage(text)` resolves successfully (Chat screen's own
       failure/retry handling from task-48 is unaffected — this only
       fires once a send actually succeeds and `state` already shows
       `"ready_for_search"`).
    2. Set screen to `"transitionLoading"` (the same `TransitionScreen`
       component and code path already used for the very first
       readiness transition — no new loading state, no new component)
       and call `client.fetchProviders(sessionId)`.
    3. On success: **replace** `providers` with the new result and set
       screen to `"recommendations"` — this is a real navigation, not
       a silent in-place update, closing the original dead-end where
       the user could be sitting on Chat with an updated `providers`
       array but no way back to it (the Chat pill is absent on the
       Chat screen itself, so nothing else could have gotten them
       there).
    4. On failure: leave the current `providers` array and `state`
       untouched (the previous, still-valid comparison list and
       conversation are preserved — this refresh attempt failing does
       not invalidate what was already known), set `errorContext` with
       `retry: () => /* re-run the identical fetchProviders(sessionId)
       call */`. A successful retry follows step 3 (replace
       `providers`, navigate to `"recommendations"`); a failed retry
       re-sets `errorContext` the same way, retryable again.
    This trades one possibly-unneeded extra provider-search call (e.g.
    the user just said "thanks") for a simple, deterministic rule with
    no risk of a stale comparison list and no dead-end screen state —
    acceptable given this only fires on user-initiated post-ready chat
    activity, not a batch/background path.
- Constraints:
  - Contains no rendering logic of its own beyond the persistent Chat
    pill and error-overlay substitution — every screen's actual
    content stays exactly what task-48–53 already built and tested;
    this task is wiring, not new UI.
  - Does not modify any file under `frontend/src/screens/`,
    `frontend/src/hooks/`, `frontend/src/api/`, `frontend/src/domain/`,
    or `frontend/src/components/` — those are frozen inputs by this
    point.
  - Does not add a navigation library (confirmed with the reviewer).
- Open Questions: none (the one real ambiguity — reopen-chat refetch
  trigger — is resolved above as an explicit, documented PROJECT
  DECISION per this task, consistent with the assignment's "Ownership"
  evaluation criterion; not blocking).

## Assignment Alignment
- Requirement type: EXPLICIT (this task is the delivery surface for
  the entire flow Parts 1-6 describe end-to-end) + PROJECT DECISION
  (screen-state-machine mechanism; reopen-chat refetch rule).
- Assignment requirement: the full "I need X" → "Here are the best
  providers... and here is what we need to ask them before booking"
  flow described in the assignment's opening paragraph; "error
  handling" (Technical Expectations).
- Source: Home Assignment PDF, opening framing paragraph and Technical
  Expectations.
- Rationale: every other M15 task deliberately built an isolated,
  independently-testable unit; this is the one task whose entire job
  is proving those units compose into the actual working product the
  assignment describes — matching the backend's own precedent (M12's
  two routes were "thin wiring" tasks over already-tested M7-M11
  functions).

## IMPLEMENT
### Files Touched
- CREATE: `frontend/src/App.test.tsx` (replaces task-45's toolchain-
  proof test with real integration tests — task-45's placeholder test
  content is superseded, not left alongside)
- MODIFY: `frontend/src/App.tsx`
- DO NOT TOUCH: `frontend/src/screens/*`, `frontend/src/hooks/*`,
  `frontend/src/api/*`, `frontend/src/domain/*`,
  `frontend/src/components/*`

### Implementation Notes
- Mock `frontend/src/api/client.ts` and `frontend/src/hooks/useSession.ts`
  at the integration-test level (this is the composition being tested,
  not the already-covered unit behavior of either) — assert *which*
  screen renders and *which* client calls happen in response to user
  actions, not each screen's internal rendering detail (already
  covered by task-48–53's own tests).
- Because this task is allowed to be the one exception to the
  ~5-15-minute sizing guideline (it's the single integration point
  wiring six already-tested units together, same precedent as M12's
  wiring tasks being scoped slightly larger than a pure-logic task) —
  if implementation reveals it's still growing unmanageably large,
  stop and split along the state-machine's natural seams (e.g. "auto-
  transition + error overlay" vs. "chat-pill + reopen-chat refetch")
  rather than pushing through an oversized single task.

## VALIDATE
### Unit Tests
- N/A (no new pure logic beyond the state machine itself, covered by
  the integration tests below).

### Component / Integration Tests
- [ ] Bootstraps via `useSession`, shows Chat screen once `state` is
      available.
- [ ] When `state.phase` flips to `"ready_for_search"`, screen becomes
      `TransitionScreen` and `fetchProviders` is called with the
      right `sessionId`.
- [ ] `fetchProviders` success → screen becomes `RecommendationsScreen`
      with the returned `providers`.
- [ ] `fetchProviders` failure → `ErrorState` renders; tapping retry
      re-calls `fetchProviders` with the same `sessionId`.
- [ ] Tapping a recommendations row → `ProviderDetailsScreen` with
      that exact `ProviderScore`'s `candidate`/`dimensionScores`/
      `explanation`.
- [ ] Tapping "Select" → `selectLoading` phase then
      `selectProvider(sessionId, candidate)` called with the exact
      candidate; success → `SimulatedQAScreen` with the returned
      answers.
- [ ] `selectProvider` failure → `ErrorState`; retry re-calls
      `selectProvider` with the identical `candidate`.
- [ ] "Back to your matches" → returns to `RecommendationsScreen`
      using the already-held `providers` (assert `fetchProviders` is
      NOT called again).
- [ ] The Chat pill is absent on the Chat screen itself, present on
      every other screen; tapping it returns to Chat without losing
      `providers`/`selectedProvider` (navigating forward again from
      Chat, once ready, does not need a `sendMessage` first if nothing
      changed — existing state is reused, not rebuilt from scratch).
- [ ] Reopened Chat (via the Chat pill from Recommendations/Details/
      Simulated Q&A) → sending a message that resolves successfully,
      with `state.phase` already `"ready_for_search"` → exactly one
      `fetchProviders` call fires once `sendMessage` resolves (not
      zero, not more than one).
- [ ] While that refresh `fetchProviders` call is in flight, the
      screen shows the loading state (`TransitionScreen`), not a bare
      Chat screen or a blank gap.
- [ ] That refresh succeeding replaces `providers` with the new result
      and navigates to `RecommendationsScreen` (a real screen
      transition — assert the screen state actually changes, not just
      that `providers` updated in place).
- [ ] That refresh failing renders `ErrorState`, and leaves both the
      previous `providers` array and `state` unchanged (assert the
      pre-refresh `providers` reference/values are still what
      `RecommendationsScreen` would receive if reached).
- [ ] Retrying from that `ErrorState` calls `fetchProviders` again
      with the identical `sessionId` (same request, per Open Decision
      #5).
- [ ] A successful retry replaces `providers` with the new result and
      navigates to `RecommendationsScreen`, same as the direct-success
      path.

### E2E Tests
- [ ] Manual: `npx expo start`, walk the full flow once against a
      running `backend` dev server (real or lightly-stubbed responses)
      — Chat → send a few messages → auto-transition →
      Recommendations → Details → Select → Simulated Q&A → Back.
      Non-blocking for `npm test`; report the outcome honestly (same
      precedent as the backend's manual real-API checks).

### Success Criteria
- [ ] TS compiles with no errors.
- [ ] `npm test` passes, including new tests, no regressions across
      the whole `frontend/` suite.
- [ ] No files outside `Files Touched` modified.
- [ ] `.claude/CLAUDE.md`'s frontend Commands section (already
      populated by task-45) still accurately reflects reality —
      update if anything changed.

## ITERATE
### Outcome
Implemented, one deliberate consolidation of the plan's two overlapping
transition-trigger mechanisms into one, and one small additional case
handled beyond the original plan — both explained below, neither a
behavior change from what was approved.

**Screen enum simplified from 6 to 5 values**: `"selectLoading"` was
dropped as a separate `Screen` member. `SimulatedQAScreen` (task-52)
already ships its own `phase: "loading" | "results"` union internally,
so the top-level screen only needs one `"simulatedQA"` value; `App.tsx`
picks the sub-phase by whether `answers` is `null` yet. This is a pure
simplification enabled by how task-52 actually landed — no behavior
difference from the plan (loading state still renders, still swaps to
results on the same event), and no extra state needed.

**The plan's two separately-worded transition mechanisms — "auto-
transition on readiness" (a `useEffect` watching `state.phase`) and
the reviewer's revised "reopening chat" rule (triggered by a resolved
`sendMessage` call) — are the same event by construction**: the very
message that first flips `phase` to `"ready_for_search"` is *also* "a
successful post-ready send from Chat." Implementing both as literally
separate mechanisms (an effect watching `state.phase` *and* a
post-send check) would risk a double-fire race for that first message.
Implemented as one path instead: `handleSend` reads the *resolved
value* returned by `session.sendMessage(message)` directly (not
`session.state`, which the mocked hook in tests never needed to be
reactive for either) and triggers `runProviderSearch()` if that
resolved state's `phase` is `"ready_for_search"` — covering both the
very first transition and every later reopened-chat refresh through
the identical code path, with no risk of firing twice for one event.

**One case beyond the literal plan text, added and flagged here rather
than silently assumed**: resuming a session via `useSession`'s bootstrap
(app relaunch with a stored `sessionId`) into a conversation that's
*already* `"ready_for_search"` — with no `sendMessage` call happening
in this app instance to trigger anything — had no defined behavior in
either the frozen UX spec or task-54's own plan. Rather than leaving the
user stuck on an empty-looking Chat screen with no way to see providers,
a one-shot guard (`hasAutoTriggeredRef`, fires once after bootstrap
completes if `phase` is already `"ready_for_search"` and no providers
are held yet) runs the identical `runProviderSearch()` path. This is a
small, reversible product decision within an area the assignment
explicitly leaves open ("Ownership" evaluation criterion), not a
silent assumption — flagged here for the reviewer rather than baked in
without a record. Covered by its own integration test.

**One real cross-cutting reuse decision**: `App.tsx` imports the
already-exported `hostnameFromUrl` from `ProviderDetailsScreen.tsx`
(task-51) rather than defining a third copy — this is an import, not a
modification, so it doesn't violate this task's "do not modify
`frontend/src/screens/*`" constraint. The existing duplication between
`RecommendationsScreen.tsx` (task-50) and `ProviderDetailsScreen.tsx`
(task-51, which couldn't reuse task-50's copy since they landed in the
same parallel wave) was left as-is, already logged as a follow-up by
task-51 — not fixed here either, same file-boundary reasoning.

**A second real Jest gotcha, found wiring `App.test.tsx`, added to the
D17 gotcha family**: `jest.mock("./hooks/useSession")` **with no
factory** still evaluates the real module once to derive the automock's
shape — which pulled in `useSession.ts`'s real
`@react-native-async-storage/async-storage` import and crashed with a
native-module error (`jest-expo`'s test environment doesn't stub
AsyncStorage's native binding by default; task-47's own hook test only
worked because it explicitly `jest.mock`'d AsyncStorage too). Fixed by
giving `useSession`'s mock an explicit empty factory:
`jest.mock("./hooks/useSession", () => ({ useSession: jest.fn() }))` —
this avoids ever requiring the real module. Any future test mocking a
module whose *real* implementation has side-effecting imports (native
modules, network clients) needs this same explicit-factory pattern, not
a bare `jest.mock(path)`.

**Verified**:
- `npm test` (full `frontend/` suite): **9 suites / 73 tests, all
  passing** (61 pre-existing from tasks 45-53 + 12 new integration
  tests in `App.test.tsx`), no regressions.
- `npx tsc --noEmit`: clean.
- `CI=1 npx expo start --port 8091` + `curl .../index.bundle`: Metro
  compiled the real app — all six screens, the hook, the API client,
  AsyncStorage — end-to-end into a working bundle (763 modules, HTTP
  200), not just a Jest-level check. This is the manual E2E smoke test
  from this task's own VALIDATE checklist; a full walkthrough against a
  live `backend` dev server was not additionally run (non-blocking per
  the task's own wording, same precedent as the backend's prior manual
  real-API checks) — the bundle-compiles-and-serves check already
  confirms the wiring is structurally sound end-to-end.

**M15 (frontend implementation) is now fully complete.** All ten tasks
(45-54) are DONE.

### Knowledge Updates
- `.claude/CLAUDE.md` and `memory-bank/decisions.md` (D17 addendum) to
  gain the `jest.mock(path)`-with-no-factory-still-loads-real-module
  gotcha, consolidated together with task-45/47's other three gotchas
  in one pass (not done per-task, to avoid repeated near-duplicate
  edits to the same shared file).
- `memory-bank/progress.md`/`decisions.md` need a consolidated M15
  entry covering tasks 45-54 together (the individual per-screen task
  outcomes are the detailed record; the memory-bank entry summarizes).
- `DESIGN.md` should gain a brief Architecture Decisions note: the
  frontend uses a hand-rolled screen-state machine (no navigation
  library), matching the backend's existing "simplest design that
  satisfies scope" precedent, plus an Assumptions note on the
  resume-into-ready-session behavior decided above.

### Follow-ups
- The `hostnameFromUrl` duplication between `RecommendationsScreen.tsx`
  and `ProviderDetailsScreen.tsx` (task-51's original follow-up) is
  still open — a future small task could extract
  `frontend/src/shared/hostname.ts`, mirroring the backend's own
  `shared/hostname.ts` precedent (D13a's addendum 2). Not done here to
  respect this task's own file-boundary constraint.
- No other new follow-ups from this task.
