# Task 63: Web platform always starts a fresh conversation
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Opening `localhost:8081` (or any web build of the app) always
  starts a brand-new conversation from the chat screen — no session
  resume — so an interviewer/reviewer testing the app gets a clean,
  predictable starting point every time, without needing to know about
  or manually clear browser storage.
- Inputs: `frontend/src/hooks/useSession.ts`'s `bootstrap()` — currently
  reads a `sessionId` from `AsyncStorage` (backed by `localStorage` on
  web) and, if present, tries to resume that conversation via
  `getConversation` before falling back to `createConversation`.
- Outputs: on web specifically, `bootstrap()` skips the stored-session
  read entirely and always calls `createConversation()`, landing on the
  chat screen (or, if a truly fresh session can somehow already be
  `ready_for_search` — it can't, since it's brand new — the existing
  auto-transition logic would still apply, but that's moot here). No
  change to native (iOS/Android/Expo Go) behavior, which keeps
  resuming exactly as it does today.
- Constraints: **web-only fix** — the resume-on-relaunch behavior for
  native platforms is existing, tested, spec-mandated behavior
  (`design/m14-ux-spec.md` calls out "on app relaunch" resume by name;
  see `tasks/completed/task-47-session-hook.md`), not something this
  task removes or weakens. Do not touch `App.tsx`, any screen, the
  backend, or API contracts. Do not add a "start new conversation"
  button/affordance — that's a separate, unrequested feature; this
  task only changes what happens automatically on web bootstrap.
- Open Questions: none.

## Assignment Alignment
- Requirement type: PROJECT DECISION
- Assignment requirement: none directly — the assignment doesn't
  mention session-resume behavior or interviewer ergonomics. This is a
  portfolio/demo-usability decision, confirmed first-person by the
  reviewer ("whenever a user opens localhost:8081 he should start from
  scratch... I want that the interviewer will easily test the app").
- Source: N/A — direct instruction, 2026-08-29.
- Rationale: distinct from D9 (which governs *backend* in-memory
  session state, already fully satisfied regardless of client
  behavior) — this only concerns the *client-side* convenience cache
  added in task-47 for native app relaunch. Scoping the fix to web
  preserves that already-approved, spec-mandated native behavior while
  fixing a real demo/testing friction point on the platform this
  project's D19 desktop extension specifically targets (an interviewer
  most likely evaluating via a desktop browser).

## IMPLEMENT
### Files Touched
- CREATE: none
- MODIFY: `frontend/src/hooks/useSession.ts` (gate the
  `AsyncStorage.getItem`/`setItem` calls behind a platform check),
  `frontend/src/hooks/useSession.test.ts` (add web-platform coverage)
- DO NOT TOUCH: `App.tsx`, any `frontend/src/screens/**` or
  `frontend/src/components/**` file, `backend/**`

### Implementation Notes
- Use React Native's `Platform.OS` from the `react-native` package
  (`Platform.OS === "web"`) — confirmed via a throwaway test that
  jest-expo's default test platform is `"ios"`, so existing
  `useSession.test.ts` bootstrap tests are unaffected by this change
  without modification.
- In `bootstrap()`: when `Platform.OS === "web"`, skip the
  `AsyncStorage.getItem(SESSION_ID_KEY)` read entirely (treat it as
  "nothing stored") and skip the `AsyncStorage.setItem(...)` write
  after creating a new session too, since it would never be read back
  on web anyway — avoids leaving dead storage. Native platforms keep
  both calls exactly as today.
- No change to `sendMessage`, `retryBootstrap`, or any other exported
  behavior.

## VALIDATE
### Unit Tests
- [ ] N/A — no domain/business logic

### Component / Integration Tests
- [x] New test: on web (`Platform.OS = "web"`), `bootstrap()` never
      calls `AsyncStorage.getItem`, always calls `createConversation`,
      even when a stored session id would otherwise be present
- [x] New test: on web, `bootstrap()` never calls
      `AsyncStorage.setItem` after creating a session
- [x] Existing 5 `useSession bootstrap` tests (native/default platform)
      pass unchanged — confirms native resume behavior is untouched
- [x] Existing `useSession.sendMessage` tests pass unchanged

### E2E Tests
- [x] `npx tsc --noEmit` (frontend) clean
- [x] `npm test` (frontend) — 13/13 suites, 101/101 tests, no
      regressions
- [ ] ~~Manual browser reload check~~ — not performed by Claude in this
      session (no browser automation available); confirmed instead via
      the new unit tests, which directly assert the exact behavior
      (no storage read/write, always `createConversation`) — left for
      the user's own reload check

### Success Criteria
- [x] All relevant tests pass
- [x] No regressions
- [x] Follows project conventions
- [x] Task scope is fully implemented

## ITERATE
### Outcome
`frontend/src/hooks/useSession.ts`'s `bootstrap()` now short-circuits
the stored-session lookup to `null` when `Platform.OS === "web"`
(skipping `AsyncStorage.getItem` entirely) and skips
`AsyncStorage.setItem` after creating a session on web too — native
platforms keep both calls exactly as before. Confirmed via a
throwaway test before implementing that jest-expo's default test
platform is `"ios"`, so none of the 5 existing bootstrap tests needed
changes. Added 2 new tests under a `describe("on web")` block that
temporarily overrides `Platform.OS` (restored in `afterEach`) —
direct reassignment worked without needing a full `react-native`
module mock. `npx tsc --noEmit` clean; `npm test`: 13/13 suites,
101/101 tests passing (99 pre-existing + 2 new), no regressions.

### Knowledge Updates
No new architectural decision beyond what's already recorded in this
task's own Assignment Alignment — a scoped, platform-gated reversal of
task-47's client-side session cache for web only, motivated by
demo/interviewer-testing ergonomics, not an assignment requirement.
Worth noting for future frontend tests: `Platform.OS` can be directly
reassigned and restored in a test (no `jest.mock` needed) — simpler
than the submodule-mocking gotchas already documented in
`.claude/CLAUDE.md` for other `react-native` internals.

### Follow-ups
Manual browser verification (reload with a `ready_for_search` session
already stored, confirm landing on chat) is left to the user — no
browser automation available in this session.
