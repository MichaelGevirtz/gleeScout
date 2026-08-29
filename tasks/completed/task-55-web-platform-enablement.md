# Task 55: Enable the Expo web target (react-native-web)
Status: DONE
Can run in parallel with: task-56, task-57

## PLAN
- Goal: Make `frontend/` runnable as a web app (via Expo's Metro web
  target) with no application-code changes, so later tasks have a
  real desktop browser to render into.
- Inputs: existing `frontend/` Expo/TypeScript scaffold (task-45).
- Outputs: `react-native-web` + `react-dom` installed at
  Expo-compatible versions; `npx expo start --web` (or
  `npx expo export -p web`) boots the existing mobile app unmodified
  in a browser tab, proving the toolchain works before any desktop-
  specific UI is built.
- Constraints: no `src/**` changes — this task is dependency/tooling
  only. Do not add a bundler config beyond what `expo install` wires
  automatically. Do not add React Navigation.
- Open Questions: none.

## Assignment Alignment
- Requirement type: PROJECT DECISION (non-assignment scope extension)
- Assignment requirement: none — `docs/Home Assignment.pdf` never
  mentions desktop/web support; `assignment-review` confirmed this
  is out of graded scope.
- Source: N/A — see `memory-bank/decisions.md` D19.
- Rationale: Pursued as the reviewer's deliberate personal/portfolio
  decision (confirmed first-person, 2026-08-29), reasoning that an
  interviewer will likely run the app in a desktop browser. Must
  never be cited as satisfying a Part 1–6 requirement or Bonus item.

## IMPLEMENT
### Files Touched
- CREATE: none
- MODIFY: `frontend/package.json` (add `react-native-web`,
  `react-dom` via `npx expo install react-native-web react-dom`),
  `frontend/app.json` only if `expo install` reports a required web
  config field missing
- DO NOT TOUCH: any file under `frontend/src/`, `backend/`

### Implementation Notes
- Use `npx expo install react-native-web react-dom` (not plain
  `npm install`) so versions match this project's Expo SDK exactly,
  consistent with task-45's existing `expo install --check` precedent.
- No code change is expected to be needed for the existing mobile
  screens to render on web at all (that's the point of
  react-native-web) — this task only proves the toolchain, it does
  not yet add any desktop-specific layout.

## VALIDATE
### Unit Tests
- [ ] N/A — no application code changed

### Component / Integration Tests
- [ ] N/A

### E2E Tests
- [x] `npx expo install --check` reports no mismatches
- [x] `CI=1 npx expo start --web` (or `npx expo export -p web`) boots/
      exports without error
- [x] `npm test` (existing Jest suite) still passes, unchanged —
      proves this task introduced no regression
- [x] `npx tsc --noEmit` still clean

### Success Criteria
- [x] All relevant tests pass
- [x] No regressions
- [x] Follows project conventions
- [x] Task scope is fully implemented

## ITERATE
### Outcome
Installed `react-native-web` and `react-dom` via `npx expo install`
(no manual version pinning needed — resolved automatically for SDK
57). No `src/**` or `app.json` changes were required. `npx expo
install --check` reports no mismatches, `npx tsc --noEmit` is clean,
the existing Jest suite passes unchanged (9 suites / 73 tests), and
`CI=1 npx expo export -p web` bundles and exports successfully
(207 modules, 393KB JS bundle) to `dist/` (already gitignored).

### Knowledge Updates
None — this was dependency/tooling only, no new architectural point
beyond what D19 already records. `frontend/package.json` now lists
`react-native-web` + `react-dom` as dependencies; no CLAUDE.md command
changes needed since `npx expo start`/`npm test` already documented
there cover the web target too.

### Follow-ups
None identified.
