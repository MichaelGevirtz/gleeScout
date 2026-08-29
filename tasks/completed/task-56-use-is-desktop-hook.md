# Task 56: `useIsDesktop` viewport-width hook
Status: DONE
Can run in parallel with: task-55, task-57

## PLAN
- Goal: A single, named, testable source of truth for "is the
  viewport wide enough for the desktop split-pane layout," per the
  single-binary-breakpoint decision in `design/m14-ux-spec.md`'s
  Desktop addendum.
- Inputs: React Native's built-in `useWindowDimensions`.
- Outputs: `frontend/src/hooks/useIsDesktop.ts` exporting
  `DESKTOP_BREAKPOINT = 1024` (named constant) and
  `useIsDesktop(): boolean` (`width >= DESKTOP_BREAKPOINT`).
- Constraints: no new application state — this is a derived,
  stateless read of the live viewport width every render, not a
  stored flag. No tablet tier, no second breakpoint.
- Open Questions: none.

## Assignment Alignment
- Requirement type: PROJECT DECISION (non-assignment scope extension)
- Assignment requirement: none — see task-55's Assignment Alignment
  and `memory-bank/decisions.md` D19 for the full non-assignment
  rationale; not repeated per-task beyond this pointer.
- Source: N/A
- Rationale: Supporting infrastructure for the approved desktop
  addendum only.

## IMPLEMENT
### Files Touched
- CREATE: `frontend/src/hooks/useIsDesktop.ts`,
  `frontend/src/hooks/useIsDesktop.test.ts`
- MODIFY: none
- DO NOT TOUCH: `frontend/src/App.tsx` (wiring is task-58's job, not
  this task's)

### Implementation Notes
- `useWindowDimensions` from `react-native` (works identically on
  native and web via react-native-web — no platform branching
  needed).
- Keep it a one-line derivation: `const { width } =
  useWindowDimensions(); return width >= DESKTOP_BREAKPOINT;` — no
  memoization needed for a single comparison.

## VALIDATE
### Unit Tests
- [x] returns `false` for a width below 1024
- [x] returns `true` for a width at or above 1024
- [x] re-renders with the new value when the mocked width changes
      (mock `useWindowDimensions` from `react-native` with an
      explicit factory per this project's RNTL/Jest mocking
      convention — CLAUDE.md's documented gotcha #3/#5)

### Component / Integration Tests
- [x] N/A — pure hook, no rendered UI

### E2E Tests
- [x] N/A

### Success Criteria
- [x] All relevant tests pass
- [x] No regressions
- [x] Follows project conventions
- [x] Task scope is fully implemented

## ITERATE
### Outcome
Implemented exactly as planned: `useIsDesktop.ts` exports
`DESKTOP_BREAKPOINT = 1024` and a one-line `useIsDesktop()` derived
from `useWindowDimensions()`. `npm test` (10 suites / 76 tests) and
`npx tsc --noEmit` both clean.

### Knowledge Updates
**New Jest/RNTL mocking gotcha, not previously documented** — mocking
`react-native`'s top-level module object (even with
`...jest.requireActual("react-native")` spread) crashes jest-expo's
native-module virtualization (`TurboModuleRegistry.getEnforcing:
'DevMenu' could not be found`), because it forces a real, un-mocked
`require("react-native")` that hits actual native module lookups.
`useWindowDimensions` specifically is exposed via a lazy getter in
`react-native/index.js`
(`get useWindowDimensions() { return
require('./Libraries/Utilities/useWindowDimensions').default; }`), so
the correct, non-crashing mock target is that **submodule path**, not
the top-level `"react-native"` import — and the mock factory must
include `__esModule: true` alongside `default: jest.fn()`, or a
TS/Babel default-import in the test file double-wraps `.default` and
`mockReturnValue` is undefined. Since TypeScript has no type
declarations for that internal path, pull the mock function via
`jest.requireMock(path).default` (untyped) rather than a static
`import` (which fails `tsc --noEmit` with TS7016). This should be
added to `.claude/CLAUDE.md`'s RNTL gotcha list as gotcha #6 the next
time a task touches that file, or now if the project owner wants it
folded in immediately — flagged here rather than done automatically
since it's outside this task's `Files Touched` list.

### Follow-ups
- Consider adding the new `useWindowDimensions`-mocking gotcha to
  `.claude/CLAUDE.md`'s RNTL/Jest gotcha list (currently #1-5) so
  future tasks don't have to re-derive it. Not done as part of this
  task since `.claude/CLAUDE.md` isn't in this task's `Files Touched`.
