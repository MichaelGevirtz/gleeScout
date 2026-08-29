# Task 82: Add "How we score providers" affordance to ContextPanel
Status: DONE
Can run in parallel with: task-79, task-80, task-81 (disjoint files, no dependency)

## PLAN
- Goal: give the sidebar a low-emphasis explanatory affordance for how
  match grades work, matching the approved page-level UX direction
  (sidebar supports the recommendation, doesn't compete with it).
- Inputs: existing `ContextPanel.tsx` (task-57/58/61/62 — brand,
  requirement rows, match count, back-to-chat button).
- Outputs: one additional low-emphasis text line/link in
  `ContextPanel`, e.g. "How we score providers", rendered below the
  match count, above the back-to-chat button.
- Constraints:
  - Text-only affordance, same visual weight class as the existing
    trace link (`TraceLink` in `RecommendationsScreen.tsx`) — not a
    button, not competing with `onOpenChat`/`onBackToMatches` for
    primary-action styling.
  - No new screen/modal required for this task — a callback prop
    (`onExplainScoring?: () => void`) is sufficient; wiring it to an
    actual explanation surface (if the reviewer wants one) is a
    follow-up, not in this task's scope. If no handler is supplied,
    render nothing (optional prop, no dead affordance).
- Open Questions: none.

## Assignment Alignment
- Requirement type: PROJECT DECISION
- Assignment requirement: Evaluation criterion 6, "Taste" — the
  sidebar/page-level redesign approved in prior discussion asked for
  a "How was this recommendation produced?" / scoring-explanation
  affordance that supports, not competes with, the provider list.
- Source: `docs/Home Assignment.pdf`, Evaluation criterion 6, p.7 (no
  literal PDF text mandates this specific affordance — it is a design
  choice supporting the Taste criterion and the already-approved page
  hierarchy from this feature's planning discussion).
- Rationale: low-risk, small, isolated addition; keeps the sidebar's
  existing scope (task-57/58) intact while completing the approved
  page-level hierarchy.

## IMPLEMENT
### Files Touched
- MODIFY: `frontend/src/components/ContextPanel.tsx`
- MODIFY: `frontend/src/components/ContextPanel.test.tsx`
- DO NOT TOUCH: `RecommendationsScreen.tsx`, `ProviderDetailsScreen.tsx`,
  `App.tsx`, any backend file

## VALIDATE
### Unit Tests
### Component / Integration Tests
- [ ] Affordance renders and calls `onExplainScoring` when pressed, if
      the prop is supplied
- [ ] Renders nothing extra when `onExplainScoring` is omitted
- [ ] All existing `ContextPanel` tests still pass unchanged

### Success Criteria
- [ ] `npm test` (frontend) passes, no regressions
- [ ] `npx tsc --noEmit` clean

## ITERATE
### Outcome
Implemented as planned. `ContextPanel` gained an optional
`onExplainScoring?: () => void` prop; when supplied, renders a
low-emphasis "How we score providers" text affordance (same visual
weight as `RecommendationsScreen`'s existing trace link) below the
match count; renders nothing extra when omitted. Not wired to
`App.tsx` in this task (no explanation surface exists yet — out of
scope per the task file, follow-up below). 2 new tests. `npm test`
(frontend): 142/142 passing. `npx tsc --noEmit`: clean.

### Knowledge Updates
Folded into the combined decisions.md/progress.md update below.

### Follow-ups
- `onExplainScoring` is not wired to any real explanation
  surface/screen yet — `App.tsx` doesn't pass the prop, so the
  affordance is currently dormant (renders nothing). A future task
  should decide what "How we score providers" opens (a small modal, a
  screen, or a static text panel) and wire it in `App.tsx`. Not
  scoped into this feature per the original task's explicit
  boundary.
