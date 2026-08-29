# Task 57: `ContextPanel` component (desktop left pane)
Status: DONE
Can run in parallel with: task-55, task-56

## PLAN
- Goal: A purely presentational component rendering the desktop
  left-pane "event/context" summary, per
  `design/m14-ux-spec.md`'s Desktop addendum and the
  `design/m14-desktop/` canvas — mirroring this project's existing
  M15 convention (tasks 48–53) of prop-driven screens/components with
  no network calls and no navigation knowledge.
- Inputs: `ConversationState` (already defined in
  `frontend/src/domain/types.ts`), a match count, an optional
  "currently viewing" label, an `isChatOpen` flag, and two callbacks.
- Outputs: `frontend/src/components/ContextPanel.tsx`.
- Constraints: read-only display only — no chip/attribute editing
  (matches the mobile spec's existing Open Decision #3). No fetching,
  no `useSession`/`api/client` import. No hardcoded provider/category
  copy — every value comes from props.
- Open Questions: none.

## Assignment Alignment
- Requirement type: PROJECT DECISION (non-assignment scope extension)
- Assignment requirement: none — see `memory-bank/decisions.md` D19.
- Source: N/A
- Rationale: Supporting UI for the approved desktop addendum only.

## IMPLEMENT
### Files Touched
- CREATE: `frontend/src/components/ContextPanel.tsx`,
  `frontend/src/components/ContextPanel.test.tsx`
- MODIFY: none
- DO NOT TOUCH: `frontend/src/App.tsx` (mounting/gating it is
  task-58's job)

### Implementation Notes
- Props (exact shape, no more): `{ state: ConversationState;
  matchCount: number; currentlyViewing?: string; isChatOpen: boolean;
  onOpenChat: () => void; onBackToMatches: () => void; }`.
- Render, in order: brand row (static "GleeScout" label — no logo
  asset pipeline exists in this project, a plain text/row is
  sufficient, matching this project's "UI doesn't need to be
  beautiful" framing); a "Your event" list built from
  `state.serviceCategory`, `state.coreAttributes.dateTime`,
  `state.coreAttributes.location`, and `state.categoryAttributes`
  (only entries with a non-null `value`, same inclusion rule as the
  mobile "what I know so far" chips) — one row per known field, label
  + value; a "`{matchCount}` matches found" line; when
  `currentlyViewing` is provided, a small highlighted "Currently
  viewing: `{currentlyViewing}`" block; a single button rendering
  "Chat" (calls `onOpenChat`) when `!isChatOpen`, or "Back to matches"
  (calls `onBackToMatches`) when `isChatOpen`.
- No inline editing of any field (read-only, matches mobile's Open
  Decision #3).

## VALIDATE
### Unit Tests
- [ ] N/A (covered by component tests below)

### Component / Integration Tests
- [x] renders `serviceCategory`/`dateTime`/`location` from a given
      `ConversationState`
- [x] renders one row per non-null `categoryAttributes` entry; omits
      entries with a `null` value
- [x] renders `"{matchCount} matches found"` for the given count
- [x] omits the "currently viewing" block when the prop is undefined;
      renders it with the given label when provided
- [x] renders "Chat" and calls `onOpenChat` on press when
      `isChatOpen=false`; renders "Back to matches" and calls
      `onBackToMatches` on press when `isChatOpen=true`
- [x] (per this project's RNTL/React 19 convention) `await render(...)`
      / `await fireEvent.press(...)` throughout

### E2E Tests
- [x] N/A

### Success Criteria
- [x] All relevant tests pass
- [x] No regressions
- [x] Follows project conventions
- [x] Task scope is fully implemented

## ITERATE
### Outcome
Implemented as planned. `ContextPanel.tsx` takes the exact prop shape
specified (`state`, `matchCount`, `currentlyViewing?`, `isChatOpen`,
`onOpenChat`, `onBackToMatches`); the requirement list reuses
`ChatScreen`'s known-field inclusion rule (serviceCategory → dateTime
→ location → categoryAttributes in insertion order, skipping null
values), rendered as label+value rows rather than chips. Core fields
get fixed human-readable labels ("Service"/"Date/time"/"Location");
category attributes use the attribute's object key as its own label,
since no fixed label set exists for LLM-proposed per-category
attributes anywhere else in the frontend (avoids hardcoding
per-category copy, per this task's own Constraint). 7 new tests, all
passing first run; `npm test` 11 suites / 83 tests, `npx tsc --noEmit`
clean. Purely presentational — no `useSession`/`api/client` import,
no editing, not mounted anywhere yet (task-58's job).

### Knowledge Updates
None beyond what's already captured in task-56's outcome (RNTL/Jest
gotchas) — this component needed no new mocking pattern since it takes
all data via props and does no native-module-backed hook calls.

### Follow-ups
None identified.
