# Task 58: Wire the desktop split-pane layout into App.tsx
Status: DONE
Can run in parallel with: NONE (depends on task-56's `useIsDesktop` and task-57's `ContextPanel` outputs)

## PLAN
- Goal: Make `App.tsx` render the desktop split-pane layout (left
  `ContextPanel` + right main content) exactly when the layout gate
  from `design/m14-ux-spec.md`'s Desktop addendum is open, with zero
  new `Screen` values and zero new stored state — reusing the
  existing `screen`/`providers`/`selectedProvider` variables already
  in `App.tsx` today.
- Inputs: task-56's `useIsDesktop`, task-57's `ContextPanel`, the
  existing `App.tsx` (read via this session — see below).
- Outputs: `App.tsx` renders single-pane (today's exact behavior,
  including the existing mobile "💬 Chat" pill) whenever
  `!(isDesktop && providers !== null)`; renders the two-pane layout
  (`ContextPanel` + the same `content` value in a right-pane wrapper,
  mobile chat pill hidden) whenever `isDesktop && providers !== null`.
- Constraints: do not add a new `Screen` union member or a new
  `isSplitOpen`-style boolean state — `isDesktop` (derived every
  render) and the existing `providers !== null` check are the entire
  gate. Do not modify any screen component
  (`ChatScreen`/`TransitionScreen`/`RecommendationsScreen`/
  `ProviderDetailsScreen`/`SimulatedQAScreen`/`ErrorState`) — they
  render inside the right-pane wrapper unchanged, per D18's
  presentational-screens precedent. Do not turn
  `RecommendationsScreen` into a grid (it already isn't — nothing
  here should require touching it at all). Do not add React
  Navigation.
- Open Questions: none — the addendum's one flagged "open decision"
  (what the right pane shows during a chat-triggered mid-session
  refresh) turns out to be resolved for free by this exact gate: a
  refresh calls `runProviderSearch()` again while the *previous*
  `providers` array is still non-null (it isn't cleared until the new
  fetch resolves), so `isDesktop && providers !== null` stays `true`
  throughout the refresh, and `content` (which is `<TransitionScreen
  />` while `screen === "transitionLoading"`) automatically renders
  inside the already-open right pane with no extra code. Confirm this
  behavior in Component/Integration Tests below rather than adding a
  new code path for it.

## Assignment Alignment
- Requirement type: PROJECT DECISION (non-assignment scope extension)
- Assignment requirement: none — see `memory-bank/decisions.md` D19.
- Source: N/A
- Rationale: Layout wiring for the approved desktop addendum only.

## IMPLEMENT
### Files Touched
- CREATE: none
- MODIFY: `frontend/src/App.tsx`, `frontend/src/App.test.tsx`
- DO NOT TOUCH: any file under `frontend/src/screens/`,
  `frontend/src/components/ErrorState.tsx`, `backend/`

### Implementation Notes
- `const isDesktop = useIsDesktop();`
  `const showSplitPane = isDesktop && providers !== null;`
- `currentlyViewing` for `ContextPanel`: derive only when
  `selectedProvider` exists **and** `screen` is `"providerDetails"`
  or `"simulatedQA"` — `selectedProvider.candidate.fields.name?.value
  ?? hostnameFromUrl(selectedProvider.candidate.url)` (reuse the
  existing `hostnameFromUrl` import already used for
  `SimulatedQAScreen`'s `providerName`, don't reimplement it).
  Otherwise `undefined` (no "currently viewing" block on
  Recommendations or Chat, per the addendum).
- Render structure: when `showSplitPane`, wrap `content` as
  `<View style={styles.desktopRow}><ContextPanel state={session.state}
  matchCount={providers.length} currentlyViewing={...}
  isChatOpen={screen === "chat"} onOpenChat={handleOpenChat}
  onBackToMatches={handleBackToMatches} /><View
  style={styles.rightPane}>{content}</View></View>` and skip
  rendering the existing standalone `chatPill` `Pressable` (its job is
  now `ContextPanel`'s button); otherwise render exactly today's
  markup unchanged, `chatPill` included.
- `handleOpenChat`/`handleBackToMatches` are the exact same callbacks
  already defined in `App.tsx` today — pass them straight through,
  do not duplicate or wrap them.
- `styles.rightPane` should cap content width (~900px, centered) per
  the addendum's "Right pane" section, e.g.
  `{ flex: 1, alignItems: "center" }` on the outer and a
  `{ width: "100%", maxWidth: 900 }` inner, OR a single style with
  `maxWidth`/`alignSelf: "center"` if that renders correctly under
  react-native-web — verify visually (see VALIDATE) and adjust if the
  simpler form doesn't center as expected.

## VALIDATE
### Unit Tests
- [ ] N/A (covered by component/integration tests below)

### Component / Integration Tests
(mock `useIsDesktop` with an explicit factory, per this project's
Jest/RNTL convention, to control width deterministically rather than
relying on real `useWindowDimensions` under the Jest/jsdom-less RN
test environment)
- [x] narrow viewport (`useIsDesktop` → `false`) with `providers` set:
      split pane does NOT render; existing single-pane + `chatPill`
      behavior is unchanged (regression check against task-54's
      existing tests)
- [x] wide viewport, `providers === null` (initial chat, before any
      search): split pane does NOT render — single-pane chat, no
      `ContextPanel`
- [x] wide viewport, `providers` set, `screen === "recommendations"`:
      `ContextPanel` renders alongside `RecommendationsScreen`;
      `chatPill` does NOT also render
- [x] pressing `ContextPanel`'s "Chat" button while on
      `recommendations` moves to the chat screen (right pane now shows
      `ChatScreen`); pressing "Back to matches" from there returns to
      `recommendations` — providers/selectedProvider are unchanged
      across both transitions (assert the same array/object
      references, not just equal values, to prove nothing was
      re-fetched or discarded)
- [x] `currentlyViewing` is present on `providerDetails`/`simulatedQA`
      and absent on `recommendations`/`chat`
- [x] simulate a chat-triggered refresh (send a message from the
      reopened chat that resolves to `ready_for_search` again while
      `providers` is already non-null): the right pane shows
      `TransitionScreen` while `ContextPanel` stays mounted throughout
      — confirms the "resolved for free" reasoning above without new
      code

### E2E Tests
- [x] manual: `CI=1 npx expo start --web`, resize the browser across
      1024px with a session already at `ready_for_search`, confirm
      the layout switches live with no console error

### Success Criteria
- [x] All relevant tests pass
- [x] No regressions (existing `App.test.tsx` suite from task-54
      still passes unchanged)
- [x] Follows project conventions
- [x] Task scope is fully implemented

## ITERATE
### Outcome
Implemented exactly per the Implementation Notes: `isDesktop =
useIsDesktop()`, `showSplitPane = isDesktop && providers !== null`,
`currentlyViewing` derived only on `providerDetails`/`simulatedQA` via
the existing `hostnameFromUrl` import, and a `showSplitPane` early
return rendering `<ContextPanel>` + a width-capped (`maxWidth: 900`,
centered) right pane, versus the untouched original markup otherwise.
No new `Screen` value, no new boolean state, no navigation library, no
`RecommendationsScreen` change.

All 12 pre-existing `App.test.tsx` tests pass **completely unchanged**
(not even a new mock needed for them) — confirmed by first running the
full pre-existing suite before touching the test file at all, then
adding 6 new tests. This works because `useIsDesktop` was added as a
new `jest.mock("./hooks/useIsDesktop", ...)` in this same file, and
its default (unset) mock return value is `undefined`, which is falsy
— behaviorally identical to what the *real* hook already returned in
every pre-existing test (a spike check found the jest-expo test
environment's default `Dimensions.get("window")` width is 750px, well
below the 1024px breakpoint), so no pre-existing test needed to change
at all. 6 new tests cover every VALIDATE checklist item; `npm test`
(11 suites / 89 tests) and `npx tsc --noEmit` both clean.

**Real-browser E2E check performed** (not skipped as "manual/out of
scope"): started `npx expo start --web` (after discovering and killing
a stale pre-task-55 native-mode dev server still bound to port 8081
that was returning the native Expo-Go JSON manifest instead of the web
HTML page — a leftover process, not a code defect), then drove it with
a one-off Playwright script (installed on demand into the session
scratchpad; not added to the repo) that intercepts `POST /conversation`
and `POST /conversation/:sessionId/providers` with canned responses
(no real backend/Gemini/Firecrawl calls needed) to reach the
recommendations screen deterministically, then resized the real
browser viewport three times. Result: at 375px wide, `chat-pill`
present / `context-panel` absent; at 1280px wide, `chat-pill` absent /
`context-panel` present (screenshot confirms the two panes rendering
genuinely side-by-side, not just present in the DOM); back down to
700px, `context-panel` disappears again — proving the switch is live
in both directions, not a one-time mount decision. Zero browser
console errors or `pageerror` events throughout. Screenshots retained
only in the session scratchpad, not committed.

**Open-decision resolution confirmed by test, not built**: per this
task's own instruction, no new mid-session-refresh loading component
was written. The "a chat-triggered refresh shows TransitionScreen in
the right pane while ContextPanel stays mounted throughout" test
proves the addendum's flagged open decision resolves for free from the
existing gate (`providers` stays non-null through a refresh, so
`showSplitPane` never flips false mid-refresh) — no special-cased code
needed, confirming the reasoning already written into this task's own
`Open Questions` section above.

### Knowledge Updates
`design/m14-ux-spec.md`'s Desktop addendum "New desktop-only open
decision" section should be updated to record that the mid-session
refresh loading state was **confirmed resolved for free** by this
task's test (not built as new code) — flagged as a follow-up below
since `design/m14-ux-spec.md` isn't in this task's own `Files Touched`
list, and per this session's scope-discipline instructions, tasks only
touch what they explicitly list.

### Follow-ups
- Update `design/m14-ux-spec.md`'s "New desktop-only open decision"
  section to mark it resolved (confirmed-for-free, not built) per the
  above — small doc-only edit, deliberately not done inline here.
- Carry over task-56's flagged follow-up: fold the new
  `useWindowDimensions`-submodule Jest/RNTL mocking gotcha into
  `.claude/CLAUDE.md`'s gotcha list (still not done, same reasoning —
  outside every one of these four tasks' `Files Touched`).
