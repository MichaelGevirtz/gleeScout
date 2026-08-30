# Task 90: Simplify Provider Details and add sticky Select CTA
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Remove internal scoring UI (Requirement fit / Reputation &
  evidence dimension bars) from Provider Details, add a MatchGradeBadge
  + quietly-disclosed reputation line to the header, and make the
  "Select {ProviderName}" CTA a sticky footer scoped to the
  provider-details pane, so the primary action no longer requires
  scrolling past a long evidence list.
- Inputs: Existing `ProviderDetailsScreen.tsx`, `MatchGradeBadge.tsx`
  (reused, unmodified), `App.tsx`'s `selectedProvider: ProviderScore`
  (already carries `matchGrade` and `candidate.reputationRating` /
  `candidate.reputationReviewCount` — no backend change needed).
- Outputs: Updated `ProviderDetailsScreen.tsx` (new prop contract, new
  header content, sticky-footer layout), updated
  `ProviderDetailsScreen.test.tsx`, updated `App.tsx` call site.
- Constraints:
  - No backend changes. Do not touch `fitScore`/`matchGrade`
    calculation, ranking, provider-selection API, or the FACT/INFERRED
    data model.
  - Do not modify `SelectedProviderHeader.tsx` (shared with
    `SimulatedQAScreen.tsx` — out of scope) or `MatchGradeBadge.tsx`
    (reused as-is).
  - Do not touch `RecommendationsScreen.tsx`'s existing
    `(simulated)`-labeled reputation line — this task changes Provider
    Details' treatment only; the two screens are allowed to phrase the
    same underlying mock number differently (see Implementation Notes).
- Open Questions: none — resolved via AskUserQuestion in chat before
  this file was written. See Implementation Notes for the resolution.

## Assignment Alignment
- Requirement type: PROJECT DECISION / RECOMMENDATION
- Assignment requirement: none directly — no page in
  `docs/Home Assignment.pdf` mandates a specific Provider Details
  layout. This task is a UX refinement of an existing
  project-decision screen (`design/m14-ux-spec.md`), not implementation
  of an explicit assignment requirement.
- Source: N/A (project decision, not PDF-sourced)
- Rationale: Improves the "interview-defensible" quality of the demo
  (clean B2C decision screen, obvious primary action) without touching
  anything the assignment actually scores directly. The one point that
  does intersect assignment scoring — Part 5 "Trust & Grounding" — is
  handled explicitly below (mock-reputation disclosure), preserving
  the intent of `memory-bank/decisions.md` D26 rather than reversing it.

## IMPLEMENT
### Files Touched
- MODIFY: `frontend/src/screens/ProviderDetailsScreen.tsx`
- MODIFY: `frontend/src/screens/ProviderDetailsScreen.test.tsx`
- MODIFY: `frontend/src/App.tsx` (call-site prop change only)
- MODIFY: `frontend/src/App.test.tsx` (the single "tapping a row opens
  Provider Details" test asserts on the now-removed `explanation`
  testID — see note below on coexisting with task-89)
- DO NOT TOUCH: `frontend/src/components/SelectedProviderHeader.tsx`,
  `frontend/src/components/MatchGradeBadge.tsx`,
  `frontend/src/screens/RecommendationsScreen.tsx`, anything under
  `backend/`, `frontend/src/domain/types.ts`,
  `frontend/src/screens/SimulatedQAScreen.tsx`

**Note — coexisting with task-89 (IN PROGRESS)**: task-89 also
modifies `App.test.tsx` (adding `confirmedRequirements` to
`providerScoreFixture`) and `MatchGradeBadge.tsx` (dropping its
per-grade subtitle). Neither is a real conflict: task-90 reuses
`MatchGradeBadge` unmodified regardless of whether it renders a
subtitle or not (label-only after task-89 lands is fine — it
reinforces, not contradicts, this task's "no second generic sentence"
requirement), and task-90's `App.test.tsx` edit is scoped to one
specific test block (the Provider Details navigation test, unrelated
to the `confirmedRequirements` fixture field or any
`RecommendationsScreen` assertion task-89 touches). Kept deliberately
minimal to avoid textual overlap when the two land.

### Implementation Notes

**Prop contract change**: `ProviderDetailsScreenProps` drops
`dimensionScores: Record<RankingDimension, number | null>` and
`explanation: string` (both now unused — the former because its only
consumers, the two dimension-bar sections, are removed; the latter per
the reviewer's explicit call to stop repeating the match grade in a
second generic sentence). Add `matchGrade: MatchGrade`. `App.tsx`'s
call site already has `selectedProvider.matchGrade` sitting next to
`selectedProvider.dimensionScores`/`.explanation` — swap one field for
the other, no new plumbing.

**Removed entirely**: `dimension-bars` container, both
`dimension-group-fit` / `dimension-group-quality` sections, the
`DimensionBar` component, `FIT_DIMENSION_ORDER`,
`QUALITY_DIMENSION_ORDER`, `DIMENSION_LABELS`, the
`"Doesn't affect the match grade..."` caption, and the `explanation`
`<Text>` block. `RankingDimension` import removed. The underlying
domain data (`fitScore`, `matchGrade`, `dimensionScores` on
`ProviderScore`) is untouched — this is presentation-only.

**New header content** (reusing `MatchGradeBadge`, not
reimplementing it): directly below `<SelectedProviderHeader />`, add:
1. `<MatchGradeBadge grade={matchGrade} />`
2. A reputation line, rendered only when
   `candidate.reputationRating != null && candidate.reputationReviewCount != null`:
   - Primary text: `★ {reputationRating} · {reputationReviewCount} reviews`
   - Muted subtext directly below (small, gray — same visual weight as
     the existing `factRowSource` style): `Mock data for demo · based on Google & Yelp`

   **Resolved disclosure decision** (AskUserQuestion, this
   conversation): D26 added `(simulated)` to this same underlying
   value on `RecommendationsScreen.tsx` specifically because the
   number is 100% fabricated (deterministic hash of the URL, no real
   Google/Yelp call — see `backend/src/recommendation/mockReputationSignals.ts`)
   and leaving it undisclosed conflicts with the assignment's Part 5
   "Trust & Grounding" criterion. The reviewer's distinction — Google/Yelp
   mocks stand in for a future real integration, unlike M11's
   simulated-provider-contact flow, which stands in for a live
   conversation a user could mistake for real — justifies a **quieter
   visual treatment** than M11's SIMULATED/NOT CONFIRMED badge, but not
   dropping disclosure altogether. Resolution: keep a small, honest,
   non-alarming disclosure line ("Mock data for demo") instead of the
   loud M11 badge style, and instead of no disclosure at all. This
   preserves D26's Trust & Grounding rationale while satisfying the
   reviewer's request for a calmer, more consumer-facing presentation.
   `RecommendationsScreen.tsx`'s existing `(simulated)` phrasing is
   left as-is (out of scope for this task) — the two screens will
   phrase the same mock number differently on purpose; this is an
   accepted, intentional inconsistency, not an oversight, and should
   be revisited together if it ever reads as sloppy rather than
   deliberate.

**Layout — sticky-footer-in-pane**: root element changes from a bare
`<ScrollView testID="provider-details-screen">` to
`<View testID="provider-details-screen" style={{flex: 1}}>` containing:
1. `<ScrollView style={{flex: 1}} contentContainerStyle={{padding: 16, paddingBottom: <footer height + margin>}}>` —
   holds `SelectedProviderHeader`, `MatchGradeBadge`, reputation line,
   photo gallery, "Sourced facts", "Inferred from reviews" — all
   otherwise unchanged.
2. A fixed footer `<View>` (white/opaque background, top border,
   padding) containing the existing CTA `<Pressable testID="select-cta">`
   with its existing `"Select {providerName}"` label and style,
   unchanged behavior (`onPress={() => onSelectProvider(candidate)}`).

This works unmodified inside both existing parents: `App.tsx`'s
split-pane `rightPaneInner` (`flex: 1, minHeight: 0`) and the
mobile/non-split `content`/`chatDesktopCard` branches (`flex: 1`) —
neither parent needs to change. Header block (name + badge +
reputation) is simply first in scroll order, not pinned above the
scroll area — it's short enough to sit above the fold at initial
render without a second sticky region, which would be unnecessary
complexity for what "Select provider" alone actually needs to stay
visible.

**CTA copy**: unchanged — keep `"Select {providerName}"` (falls back to
hostname), not generic "Select provider". No change to the two
existing tests asserting exact button text.

## VALIDATE
### Unit Tests
- [ ] `dimension-bars`, `dimension-group-fit`, `dimension-group-quality`
      and all `dimension-bar-*` testIDs are not rendered.
- [ ] The `"Doesn't affect the match grade..."` caption is not rendered.
- [ ] The old free-text `explanation` prop/text is not rendered (prop
      removed from the interface entirely).
- [ ] `MatchGradeBadge` renders with the passed `matchGrade`
      (`match-grade-badge`/`match-grade-label` testIDs present, correct
      label per grade).
- [ ] Reputation line renders `★ {rating} · {count} reviews` plus the
      "Mock data for demo · based on Google & Yelp" subtext when both
      `reputationRating`/`reputationReviewCount` are present.
- [ ] Reputation line renders nothing when either value is `undefined`.
- [ ] Reputation line never contains "SIMULATED" or "NOT CONFIRMED" text.
- [ ] Sourced facts (`fact-list`, `fact-row-*`) still render unchanged.
- [ ] Inferred section (`inferred-list`, `inferred-card-*`, fixed
      caption) still renders unchanged, still structurally separate
      from `fact-list` (existing FACT/INFERRED separation test).
- [ ] Photo gallery behavior unchanged (existing tests pass as-is).
- [ ] `select-cta` still calls `onSelectProvider` with the exact
      candidate object reference; CTA label still falls back to
      hostname when `fields.name` is absent.
- [ ] Sticky footer container renders even when scrolled (structural
      test: footer is a sibling of the ScrollView, not inside its
      scrollable content).

### Component / Integration Tests
- [ ] `App.tsx` call site compiles against the new
      `ProviderDetailsScreenProps` (passes `matchGrade` instead of
      `dimensionScores`/`explanation`); `npx tsc --noEmit` clean.

### E2E Tests
- [ ] None available for this stack (no Playwright/browser test harness
      in this repo) — manual verification via `npx expo start` (web)
      substitutes: confirm the CTA stays visible while scrolling the
      provider-details pane on a desktop-width viewport, and that
      scroll content has enough bottom padding to clear the footer.

### Success Criteria
- [ ] `frontend npm test` green, including updated
      `ProviderDetailsScreen.test.tsx`.
- [ ] `frontend npx tsc --noEmit` clean.
- [ ] `backend npm test` unchanged/still green (no backend files
      touched).
- [ ] No regressions in `RecommendationsScreen`, `SimulatedQAScreen`,
      or other consumers of `SelectedProviderHeader`/`MatchGradeBadge`.
- [ ] Manual check in `npx expo start` (web, desktop width): CTA
      visible without scrolling on load, stays visible while scrolling
      evidence, content not obscured behind it.

## ITERATE
### Outcome
Implemented as planned. `ProviderDetailsScreen.tsx`: removed both
dimension-bar sections (`dimension-bars`, `dimension-group-fit`,
`dimension-group-quality`, `DimensionBar`, `FIT_DIMENSION_ORDER`,
`QUALITY_DIMENSION_ORDER`, `DIMENSION_LABELS`) and the free-text
`explanation` block; replaced `dimensionScores`/`explanation` props
with `matchGrade: MatchGrade`; added `MatchGradeBadge` (reused
unmodified) and a new `formatReputationLine` helper rendering
`"★ {rating} · {count} reviews"` plus a muted
`"Mock data for demo · based on Google & Yelp"` disclosure line, shown
only when `reputationRating`/`reputationReviewCount` are present.
Root layout changed from a single `ScrollView` to
`View(flex:1) > [ScrollView(flex:1), fixed footer View]`, moving the
CTA into a `sticky-footer` testID'd footer as a sibling of the
scrollable content — required no parent-layout changes in `App.tsx`
(both the split-pane `rightPaneInner` and the mobile `content` branch
were already `flex: 1`). `App.tsx`'s call site updated to pass
`matchGrade` instead of `dimensionScores`/`explanation`.
`App.test.tsx`'s one affected test (asserting the now-removed
`explanation` testID) updated to assert the header name and
`match-grade-badge` instead — kept as the only touch to that file, to
stay minimal against task-89's concurrent, unrelated edits to the same
file (both landed cleanly; full suite green with both sets of changes
together).

Encountered task-89 actively in progress in the same working tree
partway through implementation (its `App.test.tsx` /
`MatchGradeBadge.tsx` / `domain/types.ts` diffs appeared mid-session,
and an Expo dev server was already holding port 8081) — confirmed via
each file's own `DO NOT TOUCH`/`Files Touched` lists that there was no
real overlap before proceeding, and re-read `App.test.tsx` immediately
before editing it to avoid clobbering. Task-89 completed and moved to
`tasks/completed/` before this task finished; final full-suite run
(160/160) includes both tasks' changes together with no regressions.

Also flagged and resolved, via `AskUserQuestion`, a direct conflict
between the reviewer's original ask (no reputation-mock disclosure at
all) and `memory-bank/decisions.md` D26's Part 5 Trust & Grounding
rationale for the existing `(simulated)` label on
`RecommendationsScreen.tsx`. Resolved as "quiet disclosure" — see D26
addendum below.

`frontend/npm test`: 160/160 green (17 in
`ProviderDetailsScreen.test.tsx`, including new match-grade,
reputation-disclosure, and sticky-footer-structure coverage; 1 rewritten
in `App.test.tsx`). `frontend/npx tsc --noEmit`: clean. No backend
files touched; `backend` suite unaffected. Manual `npx expo start`
(web) visual check was not performed live in this session — port 8081
was already occupied by another session's dev server, so it was not
disturbed. Structural RNTL tests substitute (no Playwright/E2E harness
exists in this repo, matching the task's own VALIDATE section
acknowledgment).

### Knowledge Updates
- `memory-bank/decisions.md` D26 gained a 2026-08-30 addendum
  documenting the Provider Details quiet-disclosure resolution and why
  `RecommendationsScreen.tsx`'s `(simulated)` phrasing was left
  unchanged (intentional, not an oversight).
- `DESIGN.md` Assumptions section: added one sentence to the existing
  mock-reputation bullet noting Provider Details' quieter disclosure
  treatment of the same number.

### Follow-ups
- None scoped. If a future task ever adds a real Google/Yelp
  integration, D26 already flags that this whole mock path (both
  screens' treatments) should be removed rather than kept alongside
  real data.
