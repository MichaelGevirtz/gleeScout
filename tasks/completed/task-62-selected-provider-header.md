# Task 62: Add a "Selected provider" header to details/QA screens
Status: DONE
Can run in parallel with: task-61

## PLAN
- Goal: Make the currently-selected provider immediately identifiable
  on both `ProviderDetailsScreen` (M9 details + M10 gap-driven CTA)
  and `SimulatedQAScreen`'s results phase (M11 simulated answers) —
  confirmed root cause: neither screen renders the provider's name as
  a header at all today. `ProviderDetailsScreen` computes
  `providerName` but only uses it inside the "Select {name}" button
  label; `SimulatedQAScreen`'s `ResultsPhase` receives `providerName`
  as a prop but only interpolates it into one sentence of the
  SIMULATED banner. Both screens open straight into flat
  fact-list/inferred-list/dimension-bar or Q&A-card content with no
  distinguishing "you are viewing X" moment — which reads as "one long
  list," per the bug report.
- Inputs: `providerName` is already computed/available in both
  screens today (no new data, no new fetch).
- Outputs: a new small, prop-driven, presentational
  `SelectedProviderHeader` component (`providerName: string`) —
  rendered at the very top of `ProviderDetailsScreen` and at the top
  of `SimulatedQAScreen`'s `ResultsPhase` — giving the provider name a
  visually distinct, stronger title treatment with a "Selected
  provider" label, separated from the content that follows.
- Constraints: **confirmed via direct instruction**: this header
  renders identically on mobile and desktop (both screens are shared,
  unmodified-per-platform components) — this is a deliberate,
  reasoned revision of `design/m14-ux-spec.md`'s "mobile screen 4,
  unchanged" note, not an oversight (see Assignment Alignment). Do not
  duplicate provider data beyond the name already computed in each
  screen. Do not add a new `Screen` state value, new navigation, or
  change M10/M11 request/response shapes. Do not touch the backend or
  API contracts. Do not touch `RecommendationsScreen.tsx`, `App.tsx`,
  or `ContextPanel.tsx` (task-61's file).
- Open Questions: none — resolved (see above).

## Assignment Alignment
- Requirement type: EXPLICIT
- Assignment requirement: Part 6 — "The UI doesn't need to be
  beautiful, but it should be understandable and thoughtfully
  designed." A details/simulated-answers screen that never identifies
  which provider you're looking at is a real understandability gap on
  the assignment's own required mobile delivery surface (M15), not
  merely a desktop cosmetic issue.
- Source: `docs/Home Assignment.pdf` Part 6; `memory-bank/roadmap.md`
  M15.
- Rationale: although this bug report is framed around the desktop
  sidebar, the missing-header defect exists identically on mobile
  (arguably worse there, since mobile has no `ContextPanel` fallback
  at all) — fixing it only on desktop would leave the assignment's
  actual required UI (mobile) with the same readability gap. This
  revises `design/m14-ux-spec.md`'s "unchanged" note for these two
  screens, confirmed by direct first-person instruction (per this
  project's approval-gate convention) as a justified correction, the
  same category of decision as task-41/42's readiness-gate fixes —
  not a new redesign, no new screens/navigation/interaction model.

## IMPLEMENT
### Files Touched
- CREATE: `frontend/src/components/SelectedProviderHeader.tsx`,
  `frontend/src/components/SelectedProviderHeader.test.tsx`
- MODIFY: `frontend/src/screens/ProviderDetailsScreen.tsx` (render the
  new header at the top, using the already-computed `providerName`),
  `frontend/src/screens/ProviderDetailsScreen.test.tsx` (add header
  coverage), `frontend/src/screens/SimulatedQAScreen.tsx` (render the
  new header at the top of `ResultsPhase`, using the existing
  `providerName` prop), `frontend/src/screens/SimulatedQAScreen.test.tsx`
  (add header coverage)
- DO NOT TOUCH: `RecommendationsScreen.tsx`, `App.tsx`,
  `ContextPanel.tsx`, `backend/**`, any M10/M11 source file

### Implementation Notes
- `SelectedProviderHeader` is purely presentational/prop-driven
  (`{ providerName: string }`), matching every other M15
  component's convention (no fetching, no `useSession`) — reuse the
  same neutral chrome palette task-61 uses for `ContextPanel`
  (`#111827` primary text, muted secondary label) so the two visually
  agree, without introducing a new color/typography system.
- Structure: a small eyebrow/label ("Selected provider") above a
  strong, large provider-name title, in its own container with
  padding and a bottom border/background so it reads as a distinct
  block, not another list row — this directly answers the bug
  report's "distinct selected-provider header/container" ask.
- `ProviderDetailsScreen`: render the header first, before the
  existing `explanation` text — no change to the fact/inferred/
  dimension sections below it.
- `SimulatedQAScreen`'s `ResultsPhase`: render the header before the
  existing SIMULATED banner (`qa-banner`) — the banner's own
  provider-name mention in its sentence stays exactly as-is (frozen,
  non-negotiable copy per D15/the UX spec); the header is additive
  context, not a replacement for that sentence.
- New testIDs: `selected-provider-header`,
  `selected-provider-header-label` ("Selected provider"),
  `selected-provider-header-name` (the provider name) — read by both
  screens' updated tests.

## VALIDATE
### Unit Tests
- [ ] N/A — no domain/business logic

### Component / Integration Tests
- [x] `SelectedProviderHeader.test.tsx`: renders the "Selected
      provider" label and the given `providerName`
- [x] `ProviderDetailsScreen.test.tsx`: the header renders at the top
      with the correct derived name (both the FACT `name`-present case
      and the hostname-fallback case, reusing existing fixtures)
- [x] `SimulatedQAScreen.test.tsx`: the header renders in
      `phase: "results"` with the given `providerName`; confirm it is
      NOT rendered during `phase: "loading"` (no provider context yet
      at that point)
- [x] Existing tests in both screens' suites pass unchanged otherwise

### E2E Tests
- [x] `npx tsc --noEmit` (frontend) clean
- [x] `npm test` (frontend) — full suite, no regressions (13 suites /
      99 tests passing)
- [ ] Manual (desktop, ~1280-1440px): selecting a provider shows a
      clearly distinct header in the right pane on both the details
      screen and the simulated-answers screen — **not run this
      session**, see Follow-ups
- [ ] Manual (mobile/narrow width): same header appears identically
      on the full-screen details/QA screens — **not run this
      session**, see Follow-ups

### Success Criteria
- [x] All relevant tests pass
- [x] No regressions
- [x] Follows project conventions
- [x] Task scope is fully implemented

## ITERATE
### Outcome
Implemented exactly as scoped. New
`frontend/src/components/SelectedProviderHeader.tsx` (purely
presentational, `{ providerName: string }`) mounted at the top of
`ProviderDetailsScreen` (before `explanation`) and at the top of
`SimulatedQAScreen`'s `ResultsPhase` (before the frozen `qa-banner`
text, which was left byte-for-byte unchanged). Reused `ContextPanel`'s
chrome palette (`#111827` primary text, `#9ca3af` muted eyebrow
label) per the task's own note. Renders identically on mobile and
desktop (both screens are shared, unmodified-per-platform components),
per the direct instruction recorded in this task's Constraints.
5 new tests: 1 in `SelectedProviderHeader.test.tsx` (label + name
render), 2 in `ProviderDetailsScreen.test.tsx` (FACT-name case,
hostname-fallback case), 2 in `SimulatedQAScreen.test.tsx` (header
present with correct name in `phase: "results"`; absent in
`phase: "loading"`). `frontend npm test`: 13 suites / 99 tests passing
(94 pre-existing + 5 new), no regressions. `npx tsc --noEmit` clean.
Manual desktop/mobile visual re-check (both VALIDATE checklist items)
was not run this session — structural/unit coverage only; flagged as
a non-blocking follow-up below, consistent with several prior M15
tasks' precedent of deferring manual walkthroughs.

One test-authoring wrinkle, not a product defect: the new
`SimulatedQAScreen` "header absent during `phase: 'loading'`" test
initially failed with `ReferenceError: clearInterval is not defined`
— a pre-existing interaction in this file between `jest.useFakeTimers()`
(set in that describe block's `beforeEach`) and
`@testing-library/react-native`'s automatic post-test unmount/cleanup,
which runs after the file's own `afterEach(jest.useRealTimers)` restores
whatever `global.clearInterval` was before fake timers were installed
(apparently undefined in this test environment absent RN's own timer
polyfill). Fixed by explicitly unmounting inside `act()` while fake
timers are still active, matching the existing "clears its internal
timer on unmount" test's already-established pattern in the same
file — no source code change, test-only.

### Knowledge Updates
`memory-bank/progress.md` updated with a new Task 62 entry (in
`## Implemented`, after task-60). `memory-bank/decisions.md`'s D16
(M14 UX direction) gained a post-freeze addendum recording this as a
scoped, reasoned correction to the frozen spec's "unchanged" notes for
screens 4/5-6, confirmed by direct first-person instruction (same
approval-gate convention as task-41/42's readiness-gate corrections).
`design/m14-ux-spec.md`'s screen-by-screen desktop section (screens 4
and 5) updated in place to describe the new header instead of stating
those screens are unchanged. No DESIGN.md change — this is a UI
polish/understandability fix, not a new assumption, deterministic/LLM
split, optimization, or production-evolution point.

### Follow-ups
- Manual desktop (~1280-1440px) and mobile/narrow-width visual
  confirmation of the new header (this task's own VALIDATE E2E manual
  checklist items) has not been run yet — non-blocking, same
  deferred-manual-check precedent as several earlier M15/desktop-
  addendum tasks.
