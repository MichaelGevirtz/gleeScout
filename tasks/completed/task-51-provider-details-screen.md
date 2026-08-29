# Task 51: Provider details screen component
Status: DONE
Can run in parallel with: 47, 48, 49, 50, 52, 53

## PLAN
- Goal: build State 4 — FACT vs INFERRED clearly and structurally
  distinguished for one provider — per `design/m14-ux-spec.md` screen
  4, the direct implementation of Part 5's "this distinction is
  important" requirement (for the FACT/INFERRED half of it; SIMULATED
  is task-52).
- Inputs: task-46's types (`ProviderCandidate`, `RankingDimension`);
  `design/m14-ux-spec.md` screen 4 section in full.
- Outputs: NEW `frontend/src/screens/ProviderDetailsScreen.tsx`:
  ```
  Props: {
    candidate: ProviderCandidate;
    dimensionScores: Record<RankingDimension, number | null>;
    explanation: string;
    onSelectProvider: (candidate: ProviderCandidate) => void;
  }
  ```
  Renders:
  - **Sourced facts** section: one row per non-null `fields.*` entry —
    `value` as display text, `source` (already a hostname string) as
    caption.
  - **Inferred from reviews** section: one card per `inferred[]`
    entry — `value` as headline, `evidenceExcerpt` as a quoted line
    **only when present** (omit the line entirely when absent — never
    an empty-quote placeholder), `sourceType` mapped to a friendly
    label (`provider_website` → "provider website review", etc.). The
    fixed caption **"Inferred from review patterns — not confirmed by
    the provider."** is static copy shown once, always, regardless of
    content.
  - **Dimension bars**: the five `dimensionScores` keys in the fixed
    order `requirementMatch, geoFit, priceFit, reputation,
    evidenceQuality`; `null` renders a dashed "not enough data" state,
    never a 0-width bar.
  - CTA **"Select [name]"** (name via the same fallback rule as
    task-50's row: `fields.name?.value` else hostname) — calls
    `onSelectProvider(candidate)` with the exact object received,
    unmodified.
- Constraints:
  - FACT and INFERRED sections must never share a badge/color
    treatment or be merged into one list — this is a cross-cutting
    system rule (UX spec), test it explicitly, not just visually.
  - No `fetch` calls — per the spec, "no separate detail endpoint
    exists," this screen only renders data it's already been given.
  - Does not touch SIMULATED data — this screen only ever shows FACT/
    INFERRED; simulated answers live entirely in task-52's screen.
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT.
- Assignment requirement: "This distinction is important. We should
  always be able to understand which information is observed/sourced
  versus inferred/simulated" (Part 5); "Trust & Grounding... Can the
  system distinguish facts found online, inferred information and
  simulated provider responses? This is particularly important" (What
  We Will Evaluate, item 5).
- Source: Home Assignment PDF, Part 5 and the Trust & Grounding
  evaluation criterion.
- Rationale: this is the screen where a user actually inspects the
  evidence behind a ranking, so it carries the heaviest weight for the
  Trust & Grounding criterion the assignment calls "particularly
  important" — structurally separate sections (not just labeled rows
  in one list) directly matches D7's "never merged" provider-model
  decision at the UI layer.

## IMPLEMENT
### Files Touched
- CREATE: `frontend/src/screens/ProviderDetailsScreen.tsx`,
  `frontend/src/screens/ProviderDetailsScreen.test.tsx`
- MODIFY: none
- DO NOT TOUCH: any other file under `frontend/src/`

### Implementation Notes
- Reuse task-50's `hostnameFromUrl` helper rather than duplicating it
  — if task-50 has not landed yet when this task starts, define it
  locally here and note the duplication as a follow-up (do not block
  on task-50; both are in the same parallel wave).
- `testID`s: `testID="fact-row-{fieldName}"`,
  `testID="inferred-card-{index}"`, `testID="dimension-bar-{dimension}"`,
  `testID="select-cta"`.

## VALIDATE
### Unit Tests
- N/A.

### Component / Integration Tests
- [x] Renders one fact row per non-null `fields.*` entry, with value +
      source caption.
- [x] Renders one inferred card per `inferred[]` entry; a card with
      `evidenceExcerpt` shows the quote, a card without omits the
      quote line entirely (not an empty string).
- [x] The "Inferred from review patterns — not confirmed by the
      provider" caption renders exactly once, even with an empty
      `inferred` array.
- [x] Dimension bars render in the fixed five-key order; a `null`
      dimension renders the dashed state, not a 0-width bar.
- [x] FACT and INFERRED sections render with visually/structurally
      distinct markers (e.g. different `testID` prefixes/labels
      confirmed present on each) — assert they are never rendered
      inside the same list container.
- [x] Tapping "Select [name]" calls `onSelectProvider` with the exact
      `candidate` object (deep-equality check).
- [x] Name fallback to hostname works when `fields.name` is absent.

### E2E Tests
- N/A (covered by task-54's integration wiring).

### Success Criteria
- [x] TS compiles with no errors.
- [x] `npm test` passes, including new tests, no regressions.
- [x] No files outside `Files Touched` modified.

## ITERATE
### Outcome
Implemented exactly as planned, no deviations from the approved PLAN's
`Renders:` bullets or Constraints.

- Created `frontend/src/screens/ProviderDetailsScreen.tsx`: default-exports
  `ProviderDetailsScreen` (props exactly as specified:
  `candidate`/`dimensionScores`/`explanation`/`onSelectProvider`), plus a
  named `hostnameFromUrl` export.
- At the time this task started, `frontend/src/screens/` did not exist yet
  (task-50 had not landed) — `hostnameFromUrl` was defined locally, per the
  task's own Implementation Notes fallback. By the time this task finished,
  task-50 had landed in parallel with its own identically-named,
  identically-implemented `hostnameFromUrl` in `RecommendationsScreen.tsx` —
  confirmed duplication, logged below as a Follow-up rather than resolved
  here (resolving it would mean touching a file outside this task's `Files
  Touched` list).
- Sourced-facts rows iterate a fixed local `FIELD_ORDER` (declaration order
  of `ProviderCandidateFields`) rather than object-key order, so row order
  is deterministic and testable — the spec only requires "one row per
  non-null entry," not a specific order, so this is an implementation
  choice, not a spec requirement.
- `explanation` is rendered (a plain `Text` at the top, only when
  non-empty) even though the PLAN's `Renders:` bullet list for this screen
  doesn't explicitly call it out (only Screen 3/Recommendations explicitly
  says to render it). Since `explanation` is a required prop with no other
  consumer on this screen and rendering it costs nothing and violates no
  constraint, it's rendered as brief rationale context. Not covered by any
  VALIDATE checklist item, so no test asserts its exact placement — flagged
  here as a judgment call, not hidden.
- `sourceType` friendly-label map extends the spec's one given example
  (`provider_website` → "provider website review") with labels for the
  other four `SourceType` values (`google`, `yelp`, `directory`, `other`)
  using the same pattern, since the type allows all five and the UI needs
  a label for each.
- Dimension bars: `null` renders a dashed "Not enough data" box
  (`testID="dimension-bar-{dim}-empty"`) with no width tied to the score at
  all; a non-null score renders a separate fill element
  (`testID="dimension-bar-{dim}-fill"`) whose width is `score*100%`. The
  two are mutually exclusive per dimension, so a 0-width fill can never
  occur for a null score — verified by a test that asserts the `-fill`
  testID is entirely absent (not present-with-width-0) when the score is
  null.
- FACT vs INFERRED structural separation implemented via two sibling
  containers (`testID="fact-list"`, `testID="inferred-list"`) under two
  sibling sections (`testID="fact-section"`, `testID="inferred-section"`)
  — never a shared list. Tested directly with RNTL's `within(...)` against
  both containers in both directions, plus a reference-inequality check on
  the two container nodes.

**Test/tsc results** (from `frontend/`):
- `npm test -- src/screens/ProviderDetailsScreen.test.tsx` → 10/10 passed
  (1 test suite), covering every VALIDATE checklist item verbatim.
- `npm test` (full suite) → 9 suites / 63 tests, all passed, no
  regressions (includes task-50's `RecommendationsScreen.test.tsx`, which
  had landed by the time this run happened).
- `npx tsc --noEmit` → no output, no errors, project-wide.
- No files outside this task's `Files Touched` (`CREATE:
  ProviderDetailsScreen.tsx`, `ProviderDetailsScreen.test.tsx`) were
  modified — `frontend/src/domain/types.ts` and
  `frontend/src/api/client.ts` were read-only inputs, untouched.

### Knowledge Updates
None — no new stack-level gotcha or architectural finding surfaced beyond
what D17 (and its addendum) already documents; this task's async
`render`/`fireEvent` usage and regex-`testID` queries worked exactly as
those entries predict.

### Follow-ups
- **`hostnameFromUrl` duplication (expected, per this task's own
  instructions)**: identical helper now exists in both
  `frontend/src/screens/RecommendationsScreen.tsx` (task-50) and
  `frontend/src/screens/ProviderDetailsScreen.tsx` (this task). A future
  small cleanup task could extract it to a shared module (e.g.
  `frontend/src/shared/hostname.ts`, mirroring the backend's D13a
  Addendum 2 precedent for `hostnameMatches`/`stripWww`) — not done here
  since it would require modifying `RecommendationsScreen.tsx`, outside
  this task's `Files Touched` list, and both parallel tasks were
  explicitly told not to block on each other.
- The `explanation` rendering judgment call (see Outcome) is worth a
  one-line confirmation from a reviewer that this matches intended M15
  scope for Screen 4, since the frozen UX spec doesn't explicitly call it
  out for this screen the way it does for Screen 3.
