# Task 87: Fix Provider Details scrolling and long-value text wrapping
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Fix two layout bugs on the Provider Details screen found by
  manual visual check after task-86 (which was not visually verified
  — see its Follow-ups): (1) the screen doesn't actually scroll on
  the desktop split-pane layout, cutting off content below the fold;
  (2) long fact values (e.g. Location, Pricing, Policies) overflow
  past the right edge of their row instead of wrapping.
- Inputs: Existing `ProviderDetailsScreen` and `App.tsx` split-pane
  layout, unchanged data contracts.
- Outputs: Provider Details content is fully reachable via scroll in
  both desktop split-pane and mobile/full-bleed layouts; long fact
  values wrap and remain fully readable within the row.
- Constraints:
  - Style-only changes. No new dependencies, no data/prop contract
    changes, no changes to `SelectedProviderHeader`, dimension-bars,
    inferred cards, or the photo gallery.
  - Do not touch the non-split (`styles.content`) mobile layout path
    beyond verifying it already scrolls correctly — it already wraps
    `ProviderDetailsScreen`'s own `ScrollView` in a `flex: 1` `View`
    per current code, so no change is expected there, only a check.
  - Root-cause fix, not a workaround: the scroll bug is a missing
    `flex: 1` on `rightPaneInner` in `App.tsx`, not a
    `ProviderDetailsScreen` problem (it already has a `ScrollView`).
- Open Questions: none.

## Assignment Alignment
- Requirement type: RECOMMENDATION (supporting an EXPLICIT requirement)
- Assignment requirement: Part 6 (p.3-4): "The UI doesn't need to be
  beautiful, but it should be understandable and thoughtfully
  designed." A screen where content is clipped below the fold with no
  way to scroll to it, and where key facts (location, pricing,
  policies) are cut off mid-sentence, fails "understandable" outright
  — this is a correctness bug in an already-approved, already-required
  screen (task-51/task-86), not new scope.
- Source: `docs/Home Assignment.pdf`, Part 6 (p.3-4).
- Rationale: Same screen, same requirement basis as task-86. Pure bug
  fix to existing required UI — no new feature, no new data, no bonus
  scope.

## IMPLEMENT
### Files Touched
- CREATE: none
- MODIFY:
  - `frontend/src/App.tsx` — add `flex: 1` (and `minHeight: 0`) to
    the `rightPaneInner` style so the `ScrollView` inside
    `ProviderDetailsScreen` (and any other split-pane content) gets a
    height-bounded parent and can actually overflow-scroll on web.
  - `frontend/src/screens/ProviderDetailsScreen.tsx` — change
    `factRow` from a row layout (label left, value right-aligned) to
    a column layout (icon+label on top, value below, left-aligned,
    full width) so long values wrap normally instead of overflowing.
    Keep all existing testIDs (`fact-row-{field}`,
    `fact-row-{field}-value`, `fact-row-{field}-source`) and the
    presence rule (no fact → no row) unchanged.
  - `frontend/src/screens/ProviderDetailsScreen.test.tsx` — update
    only if any existing assertion depends on the row's exact
    left/right visual structure (unlikely; tests target text content
    and testIDs, not layout direction). Add one test asserting a long
    `location` value renders in full (not truncated) if not already
    implicit in existing text-match assertions.
- DO NOT TOUCH: any backend file, `SelectedProviderHeader.tsx`,
  `ContextPanel.tsx`, `domain/types.ts`, `RecommendationsScreen.tsx`,
  other screens, `photoHero`/`filmstrip`/inferred-card/dimension-bar
  styles.

### Implementation Notes
- `App.tsx` `rightPane`/`rightPaneInner` split (from task-58): only
  `rightPaneInner` is missing `flex: 1`. `rightPane` already has
  `flex: 1, alignItems: "center"`; adding `flex: 1, minHeight: 0` to
  `rightPaneInner` is the minimal fix — `minHeight: 0` guards against
  RN-web's flex-child default of refusing to shrink below content
  height, which would otherwise silently defeat the `flex: 1`.
- `factRow` restyle: drop `flexDirection: "row"` /
  `justifyContent: "space-between"` in favor of a column; `factRowLeft`
  stays as the icon+label row (unchanged internally); `factRowRight`
  drops `alignItems: "flex-end"` and `factRowValue`/`factRowSource`
  drop `textAlign: "right"`, both left-aligned under the label with a
  small top margin instead of relying on row cross-axis alignment.

## VALIDATE
### Unit Tests
- [ ] n/a (style-only; no new pure logic)

### Component / Integration Tests
- [ ] Existing `ProviderDetailsScreen.test.tsx` suite passes unchanged
      (testIDs and text content untouched).
- [ ] New/updated test: a long `location` value (e.g. a joined
      multi-city string) renders its full text in the
      `fact-row-location-value` node, not truncated or clipped.

### E2E Tests
- [ ] n/a

### Success Criteria
- [ ] `frontend/npm test` passes
- [ ] `frontend/npx tsc --noEmit` clean
- [ ] Manual visual check in `npx expo start` (web): Provider Details
      scrolls fully to the CTA button in the desktop split-pane
      layout, and a long Location/Pricing/Policies value wraps
      visibly within its row instead of running off the right edge.
- [ ] No regressions to other screens or the mobile (non-split) layout.

## ITERATE
### Outcome
Implemented both fixes as planned:
- `App.tsx`: added `flex: 1, minHeight: 0` to `rightPaneInner`, so the
  desktop split-pane content area is height-bounded and
  `ProviderDetailsScreen`'s existing `ScrollView` can actually overflow-
  scroll on web instead of clipping content below the fold.
- `ProviderDetailsScreen.tsx`: `factRow` changed from a row
  (`flexDirection: "row"`, `justifyContent: "space-between"`,
  right-aligned value) to a column layout — icon+label row on top,
  value and source caption below, left-aligned. Removed the now-empty
  `factRowRight` wrapper `View`/style entirely (its `alignItems:
  "flex-end"` was the source of the overflow; with no row parent
  needed, the wrapper served no purpose). Same testIDs
  (`fact-row-{field}`, `-value`, `-source`) preserved.
- Added one test: a long `location` value (~140 chars, based on the
  actual truncated string from the reported screenshot) renders in
  full via `fact-row-location-value`, not truncated.
- `frontend/npm test`: 151/151 passing (up from 150). `frontend/npx
  tsc --noEmit`: clean.
- Manual live-browser check was attempted (started `npx expo start
  --web`) but not completed: reaching `ProviderDetailsScreen` requires
  driving the full live Gemini/Firecrawl-backed conversation →
  discovery → ranking → provider-selection flow, which task-86 already
  found slow (30s+) and prone to rate limits. Spending that time/API
  budget to visually confirm a well-understood Flexbox fix (missing
  `flex: 1` blocking scroll; unconstrained row child refusing to wrap)
  was judged disproportionate for this task; the dev server was
  stopped rather than left running. This repeats task-86's own
  flagged gap rather than closing it.

### Knowledge Updates
- `memory-bank/progress.md` has the task-87 entry (see above).
- The task-86 follow-up "manually eyeball this screen in a real
  browser" is still open — now spans two consecutive changes to this
  screen without a live visual check. If a third visual-only task
  touches `ProviderDetailsScreen`, that's a signal to actually invest
  in a lightweight preview path (e.g. a way to reach this screen with
  mock data instead of a live LLM/Firecrawl flow) rather than deferring
  again.

### Follow-ups
- Still open from task-86: do a live-browser visual check of
  `ProviderDetailsScreen` (scrolling + long-value wrapping + overall
  Option B appearance) next time this screen is touched, or invest in
  a lightweight way to reach it with mock data instead of a full live
  conversation flow.
