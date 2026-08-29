# Task 41: serviceCategory is a mandatory readiness condition
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: `isReadyForSearch` (Task 09, `backend/src/conversation/questionPolicy.ts`)
  must never return `true` while `state.serviceCategory` is `null` —
  neither via the complete path nor via the `MAX_GATHERING_TURNS`
  fallback path.
- Inputs: `backend/src/conversation/questionPolicy.ts` (Task 09,
  being fixed), `backend/src/domain/conversation.ts` (read-only,
  `ConversationState.serviceCategory: string | null`).
- Outputs: `isReadyForSearch` gains a `serviceCategory === null` guard
  that short-circuits to `false` before either existing path runs.
  `selectNextMissingAttribute` is unchanged — it does not gain a new
  "ask about service category" target (see Open Questions: this is
  deliberately out of scope per the requester's instruction not to
  redesign the conversation system).
- Constraints:
  - Do not modify `orchestrateMessage.ts`, `mergeExtraction.ts`,
    `extraction.ts`, `questionPhrasing.ts`, `server.ts`,
    `domain/conversation.ts`, or anything under `M11`
    (`providerQuestions/`, `llm/providerResponseSimulation.ts`).
  - Do not add a new `MissingAttributeTarget` kind or any new
    conversational behavior — this is a readiness-gate correction
    only.
  - Preserve `MAX_GATHERING_TURNS = 8` and the existing complete-path/
    fallback-path structure exactly, except for the new guard.
- Open Questions: none — resolved before approval (2026-08-28).
  Fixing only `questionPolicy.ts` causes `selectNextMissingAttribute`
  to still return `null` when `dateTime`/`location` are known and no
  required category attribute is missing, even though
  `serviceCategory` is `null`. `isReadyForSearch` now correctly
  returns `false` for that state, which trips
  `orchestrateMessage.ts`'s own existing invariant check
  (`"isReadyForSearch was false but selectNextMissingAttribute
  returned null"`) and throws — surfaced to the client as a 500 via
  `server.ts`'s generic catch-all. **Decision: accept this as-is.**
  `orchestrateMessage.ts` itself is not modified. This matches the
  project's existing "no retry/fallback, fail loud" precedent
  (Tasks 05/06/11) and is preferable to the current behavior (silently
  proceeding to search with `serviceCategory: null`). The 4 affected
  `orchestrateMessage.test.ts` fixtures get `serviceCategory` added so
  they keep testing what they originally intended (turn-cap fallback,
  phase-independence, non-mutation) rather than incidentally hitting
  this new throw path. A graceful (non-500) resolution for the
  "conversation can't identify a service category" case is logged as
  a Follow-up, not built in this task.

## Assignment Alignment
- Requirement type: **EXPLICIT**.
- Assignment requirement: Part 1 lists, as the first of six things
  the system must do, "Identify the type of service being requested."
  Part 2 gates provider search on "enough information" having been
  collected ("Once enough information has been collected, find real
  service providers that could potentially fulfill the request") — a
  request with no identified service type is not "enough information"
  to search on, and `buildProviderSearchQuery({ serviceCategory,
  location })` (`backend/src/research/searchQuery.ts`) already requires
  a non-null `serviceCategory: string`.
- Source: Home Assignment PDF, Part 1 (page 2, item 1 + opening
  framing), Part 2 (page 2–3, opening line).
- Rationale: `isReadyForSearch` is precisely the function that decides
  when the system has "enough information" to leave Part 1 and enter
  Part 2. It already computes and could already see
  `state.serviceCategory`, but never checked it — a gap, not a design
  choice; nothing in D12 (which defined the two-path readiness gate)
  discusses `serviceCategory`, so this is a refinement of D12, not a
  reversal of it.

## IMPLEMENT
### Files Touched
- MODIFY: `backend/src/conversation/questionPolicy.ts`
- MODIFY: `backend/src/conversation/questionPolicy.test.ts` (two
  existing tests — "returns true (complete path)..." and "returns
  true (fallback path)..." — construct states without
  `serviceCategory` set and must be updated to set it, since they're
  not testing the category gate itself; plus the two new focused
  tests below)
- MODIFY: `backend/src/conversation/orchestrateMessage.test.ts`
  (test-fixture-only — add `serviceCategory` to the 4 existing
  fixtures listed in Implementation Notes below; no assertion logic
  changes, no new test cases)
- DO NOT TOUCH: `backend/src/conversation/orchestrateMessage.ts`,
  `backend/src/conversation/mergeExtraction.ts`,
  `backend/src/llm/extraction.ts`, `backend/src/llm/questionPhrasing.ts`,
  `backend/src/server.ts`, `backend/src/domain/conversation.ts`, all
  of `backend/src/providerQuestions/` and
  `backend/src/llm/providerResponseSimulation.ts` (M11)

### Implementation Notes
- Single guard clause at the top of `isReadyForSearch`:
  `if (state.serviceCategory === null) return false;` before either
  the complete-path check or the turn-count fallback — this
  necessarily covers both paths with one condition, satisfying "never
  search without a service category" for the fallback too.
- No change to `selectNextMissingAttribute` — it keeps deciding only
  among `dateTime` / `location` / required category attributes, per
  its existing, already-approved scope (D12).
- The 4 `orchestrateMessage.test.ts` fixtures needing `serviceCategory`
  added (each currently omits it, so `serviceCategory` stays `null`
  through the merge and would otherwise hit the new throw path or
  assert the wrong outcome):
  1. "transitions phase to ready_for_search and does not call phrase
     when the merge produces a complete state" — add
     `serviceCategory: "bounce house rental"` (or similar) to `state`;
     currently hits the new throw path.
  2. "transitions phase to ready_for_search via the turn-cap fallback
     without calling phrase, even with a required attribute still
     missing" — same fix; this test is about a missing *required
     category attribute* not blocking the fallback, not about the
     category gate itself. Without the fix it would now assert
     `phase: "gathering"` incorrectly.
  3. "runs the same extract-merge-re-evaluate path regardless of the
     input state's current phase (a correction after readiness)" —
     same fix; this test is about phase-independence, not the category
     gate. Currently hits the new throw path.
  4. "does not mutate the input state" — same fix; this test is about
     non-mutation, not the category gate. Currently hits the new throw
     path.

## VALIDATE
### Unit Tests
- [ ] dateTime + location known, no required category attributes
      missing, `serviceCategory: null` → `isReadyForSearch` returns
      `false`.
- [ ] `serviceCategory` set + dateTime + location known + all
      existing required category attributes satisfied →
      `isReadyForSearch` returns `true` (existing behavior preserved).
- [ ] (existing, updated) turn-cap fallback test: with
      `serviceCategory` set, a required attribute still missing, and
      the turn cap reached → still returns `true` (fallback behavior
      preserved when a category IS known).
- [ ] New: turn-cap fallback does NOT bypass a missing
      `serviceCategory` — turn cap reached, `serviceCategory: null` →
      `isReadyForSearch` returns `false`.

### Component / Integration Tests
- [ ] N/A — pure function, same as Task 09's original scope.

### E2E Tests
- [ ] N/A.

### Success Criteria
- [ ] `npm run build` (backend) succeeds with no TypeScript errors.
- [ ] `npm test` (backend) passes, including updated/new tests, with
      no regressions in unrelated files.
- [ ] No files outside `Files Touched` modified.

## ITERATE
### Outcome
Implemented exactly as planned, no deviations. `isReadyForSearch`
(`backend/src/conversation/questionPolicy.ts`) gained a single guard
clause — `if (state.serviceCategory === null) return false;` — ahead
of both the complete-path and turn-count-fallback checks, so neither
path can declare readiness without a known service category.
`selectNextMissingAttribute` untouched.

`questionPolicy.test.ts`: 2 existing tests ("returns true (complete
path)...", "returns true (fallback path)...") updated to set
`serviceCategory` on their fixtures, since neither was testing the
category gate itself; 3 new tests added (false when category is null
with nothing else missing; true once category is set and everything
else is satisfied; turn-count fallback does not bypass a missing
category) — one more than the 2 the requester asked for, covering the
fallback-specific case from requirement 3 explicitly.

`orchestrateMessage.test.ts`: the 4 fixtures identified during
planning (complete-state transition, turn-cap fallback, phase-
independence/correction-after-readiness, non-mutation) each had
`serviceCategory` added — all 4 previously omitted it and would
otherwise have hit the newly-correct `false` result, either via the
documented `orchestrateMessage.ts` invariant throw or a wrong
assertion. `orchestrateMessage.ts` itself was not modified, per the
approved decision.

`npm run build` (backend): clean, no TypeScript errors.
`npm test` (backend): 279/279 passing (276 pre-existing + 3 net new),
no regressions, no live network calls. No files outside `Files
Touched` were modified.

### Knowledge Updates
- D12 (`memory-bank/decisions.md`) gained an addendum documenting the
  gap, the fix, and the accepted `orchestrateMessage.ts` throw
  consequence.
- `DESIGN.md`'s existing "Ready to search... not the same claim as
  complete" bullet extended with one clause: a known service category
  is a hard precondition the turn-count cap can never excuse.
- `memory-bank/progress.md` updated with this task's outcome.

### Follow-ups
- Already recorded above at task-creation time and carried through
  unchanged: a conversation whose service category the LLM can never
  identify, once `dateTime`/`location` are known and no required
  category attribute is outstanding, now surfaces as a 500 from
  `POST /conversation/:id/message` (via `orchestrateMessage.ts`'s
  existing invariant check) rather than silently proceeding to search
  with `serviceCategory: null`. A graceful, non-500 resolution (e.g. a
  targeted clarifying question) is a candidate future task, not
  scoped or committed here.
- Pre-recorded at task creation (2026-08-28), per the reviewer's
  explicit decision: once this task ships, a conversation that
  supplies `dateTime` + `location` but whose service category the
  LLM genuinely can never identify (and which has no required
  category attributes to ask about instead) will make
  `POST /conversation/:id/message` return a 500 — `orchestrateMessage`'s
  existing invariant check throws because `isReadyForSearch` is now
  correctly `false` but `selectNextMissingAttribute` still returns
  `null`. This is an accepted, documented tradeoff (fail loud rather
  than silently search with no category), not an oversight. A future
  task could give the user a graceful way out of this state (e.g. a
  targeted "what type of service is this?" question) if this proves
  to matter in practice — not scoped or committed here.
