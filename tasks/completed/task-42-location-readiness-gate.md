# Task 42: location is a mandatory readiness condition
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: `isReadyForSearch` (`backend/src/conversation/questionPolicy.ts`)
  must never return `true` while `state.coreAttributes.location` is
  unset — neither via the complete path (already true today, since
  `location` is a core attribute `selectNextMissingAttribute` checks)
  nor via the `MAX_GATHERING_TURNS` fallback path, which currently can
  bypass a still-missing `location` exactly the way it could bypass a
  missing `serviceCategory` before task-41.
- Inputs: `backend/src/conversation/questionPolicy.ts` (being fixed,
  already carries task-41's `serviceCategory` guard), read-only:
  `backend/src/domain/conversation.ts` (`CoreAttributesSchema.location:
  z.string().optional()` — absent means `undefined`, not `null`, unlike
  `serviceCategory`).
- Outputs: `isReadyForSearch` gains a second guard —
  `if (state.coreAttributes.location === undefined) return false;` —
  alongside the existing `serviceCategory === null` guard, both ahead
  of the complete-path/fallback-path logic.
- Constraints:
  - Do not modify `orchestrateMessage.ts`, `mergeExtraction.ts`,
    `extraction.ts`, `questionPhrasing.ts`, `server.ts`,
    `domain/conversation.ts`, or anything under M7–M11
    (`research/`, `ranking/`, `providerQuestions/`,
    `llm/providerResponseSimulation.ts`, `llm/providerExtraction.ts`,
    `llm/reviewAnalysis.ts`).
  - Do not add a new `MissingAttributeTarget` kind or any new
    conversational behavior — readiness-gate correction only, same
    shape as task-41.
  - Preserve `MAX_GATHERING_TURNS = 8` and the existing structure
    exactly, except for the new guard.
  - `dateTime` is deliberately NOT given the same treatment —
    `buildProviderSearchQuery({ serviceCategory, location })`
    (`backend/src/research/searchQuery.ts`) does not use `dateTime` at
    all, so a search is not structurally blocked by a missing
    `dateTime` the way it is by a missing `serviceCategory`/`location`.
    This asymmetry is intentional, not an oversight, and should be
    stated in the outcome notes.
- Open Questions: none. Unlike task-41, no existing test in
  `questionPolicy.test.ts` or `orchestrateMessage.test.ts` needs a
  fixture change — every existing fixture that currently asserts
  `isReadyForSearch(...) === true` (or a downstream `ready_for_search`
  phase transition) already sets `coreAttributes.location`, either
  directly or via the fake `extract` result it merges. Verified by
  inspection of all "true"-asserting fixtures in both files before
  writing this task.

## Assignment Alignment
- Requirement type: **EXPLICIT** (same requirement family as task-41,
  applied to a different structurally-required field).
- Assignment requirement: Part 2 gates provider search on "enough
  information" having been collected; `buildProviderSearchQuery`
  already requires a non-null/non-undefined `location: string` exactly
  as it requires `serviceCategory: string`. There is no principled
  reason to gate readiness on one structurally-required search input
  and not the other.
- Source: Home Assignment PDF, Part 2 (page 2–3, opening line);
  Part 1's implicit assumption that "Location" is core information the
  conversation must gather (listed as a useful bounce-house question
  in the assignment's own worked example, and already deterministic
  core per D6).
- Rationale: D12's readiness gate never discussed `location`
  specifically as a mandatory precondition versus an ordinary missing
  core attribute; task-41 closed the `serviceCategory` half of this
  gap, this task closes the symmetric `location` half using the exact
  same mechanism, for the exact same reason (search cannot run without
  it). This is a direct continuation of task-41, not a new decision.

## IMPLEMENT
### Files Touched
- MODIFY: `backend/src/conversation/questionPolicy.ts`
- MODIFY: `backend/src/conversation/questionPolicy.test.ts` (2 new
  focused tests only — no existing test needs a fixture change, per
  Open Questions above)
- DO NOT TOUCH: `backend/src/conversation/orchestrateMessage.ts`,
  `backend/src/conversation/orchestrateMessage.test.ts` (no fixture
  changes needed — verified above), `backend/src/conversation/mergeExtraction.ts`,
  `backend/src/llm/extraction.ts`, `backend/src/llm/questionPhrasing.ts`,
  `backend/src/server.ts`, `backend/src/domain/conversation.ts`, all of
  `backend/src/research/`, `backend/src/ranking/`,
  `backend/src/providerQuestions/`

### Implementation Notes
- Guard order: `serviceCategory` check, then `location` check, then
  existing complete-path/fallback-path logic — order between the two
  new guards doesn't matter functionally (both short-circuit to
  `false`), kept in this order only because it matches
  `selectNextMissingAttribute`'s own `dateTime → location` documented
  precedent of checking core attributes before category ones... note
  `serviceCategory` isn't part of that check order at all (it's not a
  `MissingAttributeTarget`), so this is purely a readability choice,
  not a behavioral one.
- Use `=== undefined` for `location` (matches its `.optional()` schema
  type: `string | undefined`), not `=== null` (that's `serviceCategory`'s
  type: `string | null`) — the two fields have different absent-value
  representations in `domain/conversation.ts` and the guards must match
  each precisely.

## VALIDATE
### Unit Tests
- [ ] `serviceCategory` set, `dateTime` known, no required category
      attribute missing, `location` still `undefined` →
      `isReadyForSearch` returns `false`.
- [ ] Turn-cap fallback does NOT bypass a missing `location` — turn
      cap reached, `serviceCategory` set, `location: undefined` →
      `isReadyForSearch` returns `false`.

### Component / Integration Tests
- [ ] N/A — pure function, same as task-09/task-41's scope.

### E2E Tests
- [ ] N/A.

### Success Criteria
- [ ] `npm run build` (backend) succeeds with no TypeScript errors.
- [ ] `npm test` (backend) passes, including the 2 new tests, with
      zero changes to existing test outcomes (no fixture edits
      required — if any existing test breaks, that contradicts this
      task's own Open Questions verification and must be reported,
      not silently patched).
- [ ] No files outside `Files Touched` modified.

## ITERATE
### Outcome
Implemented exactly as planned, no deviations. `isReadyForSearch`
(`backend/src/conversation/questionPolicy.ts`) gained a second guard —
`if (state.coreAttributes.location === undefined) return false;` —
placed immediately after task-41's `serviceCategory === null` guard,
both ahead of the complete-path/fallback-path logic.

`questionPolicy.test.ts`: 2 new tests added (false when `location` is
`undefined` with everything else satisfied; turn-count fallback does
not bypass a missing `location`). As predicted during planning, zero
existing tests needed fixture changes in either `questionPolicy.test.ts`
or `orchestrateMessage.test.ts` — confirmed by the full suite passing
with no edits to either file beyond the two new tests.

`npm run build` (backend): clean, no TypeScript errors.
`npm test` (backend): 281/281 passing (279 pre-existing + 2 new), no
regressions, no live network calls. No files outside `Files Touched`
were modified — `orchestrateMessage.ts`/`.test.ts` and `server.ts`
confirmed untouched.

### Knowledge Updates
- D12 (`memory-bank/decisions.md`) gained a second addendum (alongside
  task-41's) documenting the `location` half of the readiness-gate fix
  and the intentional `dateTime` asymmetry.
- Combined with task-41, `isReadyForSearch` now guarantees: whenever it
  returns `true`, both `state.serviceCategory` and
  `state.coreAttributes.location` are safe to read as non-null/
  non-undefined — the exact precondition task-43 (M12's list route)
  depends on for calling `discoverProviderCandidates({ serviceCategory,
  location })`.

### Follow-ups
None new. `orchestrateMessage.ts`'s existing invariant-throw path
(documented in task-41's Follow-ups) now also covers a
never-resolved-location scenario the same way it already covers a
never-resolved-category one — no new behavior, same accepted tradeoff.
