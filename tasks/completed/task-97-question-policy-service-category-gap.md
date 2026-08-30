# Task 97: selectNextMissingAttribute recognizes a missing serviceCategory
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Close a real, live-reproduced gap where `isReadyForSearch`
  requires `serviceCategory` to be known (task-41), but
  `selectNextMissingAttribute` — the function that picks what question
  to ask next — never checks `serviceCategory` at all. When date and
  location are both known but the service was never identified, this
  produces an unresolvable state: `isReadyForSearch` says "not ready"
  but there is nothing left to ask about, and `orchestrateMessage.ts`'s
  existing invariant guard throws, surfacing as a raw 500 to the user
  (reproduced live this session: "Can you help me plan something for
  my event on Saturday?" → "texas" → 500 "Unexpected server error").
- Inputs: `backend/src/conversation/questionPolicy.ts`
  (`selectNextMissingAttribute`, `MissingAttributeTarget`);
  `backend/src/llm/questionPhrasing.ts` (`describeTarget`).
- Outputs: `selectNextMissingAttribute` also treats a null
  `serviceCategory` as a missing core attribute — checked **first**,
  ahead of `dateTime`/`location` — reusing the exact same
  `{kind: "core", field: ...}` shape and the existing LLM
  question-phrasing pipeline (no new response type, no hardcoded
  fallback string).
- Constraints:
  - No new message/response shape, no new endpoint, no hardcoded
    canned string — this must go through the same
    `generatePendingQuestion` pipeline every other question already
    uses, for consistent tone and behavior.
  - Do not touch `isReadyForSearch` — it already correctly gates on
    `serviceCategory` (task-41); this task only fixes the
    question-*selection* function it was never kept in sync with.
  - Do not touch `orchestrateMessage.ts` — its invariant-guard throw
    stays as defensive belt-and-suspenders code; this fix makes it
    provably unreachable rather than removing it.
  - Do not touch the frontend — `MissingAttributeTarget` is an
    internal backend type; the client only ever sees the resulting
    phrased question string and updated state, both already handled
    generically.
- Open Questions: none — priority order (`serviceCategory` checked
  before `dateTime`/`location`) was discussed and agreed: it matches
  Part 1's own step order ("1. Identify the type of service... 4. Ask
  only the important missing questions") and independently prevents
  today's live-reproduced crash, since a conversation missing both
  service and date/location will now ask about service first rather
  than asking "where"/"when" before it's even known what's needed.

## Assignment Alignment
- Requirement type: PROJECT DECISION (bug fix within already-approved,
  EXPLICIT-required M4 scope)
- Assignment requirement: Part 1, items 1 and 4 — "Identify the type
  of service being requested" and "Ask only the important missing
  questions."
- Source: `docs/Home Assignment.pdf`, page 2, Part 1.
- Rationale: The readiness gate (`isReadyForSearch`) and the
  question-picker (`selectNextMissingAttribute`) fell out of sync
  after task-41 added a `serviceCategory` requirement to the former
  without updating the latter — live-reproduced this session as an
  unhandled 500. Fixing it directly serves item 1 (the service is now
  always the thing asked about when unknown, not skipped past) and
  item 4 (the "important missing question" the user is asked is now
  always the actual gating gap, never a stale/wrong one). No new
  scope, no LLM call added — reuses the existing deterministic
  target-selection + LLM-phrasing split exactly as already designed.

## IMPLEMENT
### Files Touched
- MODIFY: `backend/src/conversation/questionPolicy.ts` —
  `MissingAttributeTarget`'s core `field` union gains
  `"serviceCategory"`; `selectNextMissingAttribute` checks
  `state.serviceCategory === null` first, ahead of the existing
  `dateTime`/`location` checks
- MODIFY: `backend/src/llm/questionPhrasing.ts` — `describeTarget`
  gains a case describing the service-category target for the LLM
  phrasing prompt
- MODIFY: `backend/src/conversation/questionPolicy.test.ts` — existing
  fixtures that relied on `serviceCategory` being irrelevant to
  `selectNextMissingAttribute` need `serviceCategory` set explicitly
  now that it's checked first; add new cases for the
  serviceCategory-missing and priority-ordering behavior
- MODIFY: `backend/src/llm/questionPhrasing.test.ts` — add a case for
  the new `serviceCategory` target
- MODIFY: `backend/src/conversation/orchestrateMessage.test.ts` — the
  one existing test asserting the exact target passed to `phrase`
  needs its extraction fixture to set `serviceCategory` (its intent is
  testing the target-forwarding contract, not priority order, which
  gets dedicated coverage in `questionPolicy.test.ts`); add a
  regression test reproducing this session's exact crash scenario
  (date+location known, service unknown) and asserting a question is
  asked instead of a throw
- DO NOT TOUCH: `isReadyForSearch`, `orchestrateMessage.ts`'s
  implementation, any frontend file, `extraction.ts`,
  `mergeExtraction.ts`

### Implementation Notes
- Keep the new check a single `if (state.serviceCategory === null)`
  guard at the top of `selectNextMissingAttribute`, mirroring the
  existing `dateTime`/`location` checks' style exactly.
- `describeTarget`'s new branch: something in the spirit of "The type
  of service being requested is not yet known," consistent with the
  existing two core-field descriptions' tone.

## VALIDATE
### Unit Tests
- [ ] `questionPolicy.test.ts`: `selectNextMissingAttribute` returns
      the `serviceCategory` target when `state.serviceCategory` is
      null, even when `dateTime`/`location`/all required category
      attributes are already known (the exact crash scenario)
- [ ] `questionPolicy.test.ts`: `serviceCategory` takes priority over
      `dateTime` when both are unknown
- [ ] `questionPolicy.test.ts`: existing dateTime/location/category-
      attribute priority tests still pass with `serviceCategory` set
      in their fixtures
- [ ] `questionPhrasing.test.ts`: prompt built for a `serviceCategory`
      target describes the service, not date or location
- [ ] `orchestrateMessage.test.ts`: reproduces this session's exact
      sequence (service unknown, date+location known) and asserts a
      question is appended to messages instead of throwing

### Component / Integration Tests
- N/A (no route/schema change; `server.test.ts` unaffected)

### E2E Tests
- N/A

### Success Criteria
- [ ] `npm test` (backend) passes
- [ ] `npm run typecheck` clean
- [ ] Re-sending this session's exact two messages ("Can you help me
      plan something for my event on Saturday?" then "texas") against
      the live dev server produces a follow-up question about the
      service, not a 500

## ITERATE
### Outcome
Added `"serviceCategory"` to `MissingAttributeTarget`'s core `field`
union in `questionPolicy.ts`; `selectNextMissingAttribute` now checks
`state.serviceCategory === null` first, ahead of `dateTime`/`location`.
`questionPhrasing.ts`'s `describeTarget` gained one matching branch.
`isReadyForSearch` and `orchestrateMessage.ts` were not touched, per
scope — the fix makes `orchestrateMessage.ts`'s existing invariant
throw provably unreachable rather than removing it, since every path
where `isReadyForSearch` returns `false` now has a corresponding
non-null `selectNextMissingAttribute` result.

Updated fixtures in `questionPolicy.test.ts` and one in
`orchestrateMessage.test.ts` that previously left `serviceCategory`
unset while asserting a different target — now set it explicitly where
that was incidental to what the test was actually checking. Added 5
new tests total: 3 in `questionPolicy.test.ts` (serviceCategory
returned when nothing is known; prioritized over dateTime when both
are missing; returned even when dateTime/location are already known —
the exact gap), 1 in `questionPhrasing.test.ts` (prompt content for
the new target), 1 in `orchestrateMessage.test.ts` (full regression of
the live crash sequence, asserting a question instead of a throw).

`npm test`: 43 files / 409 tests passing (up from 404). `npm run
typecheck`: clean. Live-validated against the running dev server by
replaying the exact session that crashed
(`03b94b6a-...`-adjacent session `9d9daf87-...`'s sequence): turn 1
("Can you help me plan something for my event on Saturday?") now asks
"What type of service are you looking for this Saturday?" instead of
asking about location first; turn 2 ("texas") — the exact input that
previously produced a 500 — now asks "What type of service are you
looking to book for this Saturday in Texas?" instead of crashing.

### Knowledge Updates
`decisions.md`'s D5 task-41 addendum explicitly flagged this exact gap
as an "accepted, open follow-up, not committed" — added a short
closure note there pointing at this task, so a future reader doesn't
mistake that addendum for still-current status.

### Follow-ups
None identified during implementation.
