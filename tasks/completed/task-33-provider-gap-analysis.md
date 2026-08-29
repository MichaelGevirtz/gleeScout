# Task 33: Provider-question domain types + deterministic gap analysis
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Given one `ProviderCandidate` (M7/M8 FACT + INFERRED data) and the
  current `ConversationState` (user's requirements), deterministically
  identify which "gap topics" still need a provider question — i.e. what
  the agent already knows vs. still doesn't know about this specific
  provider, per Part 4's explicit framing. Per D14, this always runs for
  exactly one provider — the one the user selected in the UI after
  M9's ranked list was shown, never as a batch across all ranked
  candidates — but that's purely a fact about *who calls this function
  and when* (M12's future selection route); this function's own
  single-candidate signature was already correct for that use and needs
  no change.
- Inputs: `ProviderCandidate` (`backend/src/domain/provider.ts`),
  `ConversationState` (`backend/src/domain/conversation.ts`).
- Outputs: `ProviderGap[]` — a small, structured, machine-readable list
  (topic + a deterministic description of what's unknown), not yet
  natural-language questions (that's task-34).
- Constraints: Pure function, no LLM call, no I/O. Does not touch
  `ranking/` or `research/`. Does not decide phrasing.
- Open Questions: none — see Implementation Notes for the design
  rationale (gap-topic set), which is the one real judgment call in this
  task and is presented for review alongside this file, not something
  left ambiguous.

## Assignment Alignment
- Requirement type: EXPLICIT
- Assignment requirement: Part 4 — "For each provider, generate the
  questions that should be asked in order to determine whether they can
  fulfill the request. These should depend on both the user's specific
  requirements and information already available about the provider...
  If we already know from the provider's website that delivery is
  included within 15 miles, there is no reason to ask about delivery
  pricing... We want to see the agent reasoning about what it knows,
  what it doesn't know, and what information it still needs."
- Source: `docs/Home Assignment.pdf`, Part 4.
- Rationale: This task is the deterministic "what does it still need to
  know" half of Part 4, mirroring D5's LLM-extracts/app-decides split
  already used for M4 (task-09) and the lexical-matching precedent
  already used for ranking (D13d/D13g). The LLM is deliberately not
  involved in *deciding* what's missing — only in phrasing it (task-34).
  Per D14, this only ever runs once per session (for the selected
  provider) rather than once per ranked candidate — a cost/latency
  win that has no bearing on this task's own logic.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/providerQuestions/types.ts` — `ProviderGapTopic`
  (`"availability" | "requirementFit" | "pricing"`), `ProviderGap`
  (`{ topic: ProviderGapTopic; description: string }`).
- CREATE: `backend/src/providerQuestions/analyzeGaps.ts` —
  `analyzeProviderGaps({ candidate, state })`.
- CREATE: `backend/src/providerQuestions/analyzeGaps.test.ts`
- DO NOT TOUCH: `backend/src/ranking/**`, `backend/src/research/**`,
  `backend/src/domain/provider.ts`, `backend/src/domain/conversation.ts`.

### Implementation Notes

Three fixed gap topics, each a simple presence/lexical check — same
"documented limitation, not a defect" heuristic level already accepted
project-wide for D13d/D13g, deliberately not semantic/LLM-assisted (that
would put the LLM back in charge of deciding *what* to ask, violating
D5):

1. **`availability`** — fires only if `state.coreAttributes.dateTime` is
   known (nothing to confirm otherwise). Gap unless
   `candidate.fields.availability` exists AND its FACT text lexically
   contains the requested date/time string. In practice this will fire
   almost every time (a general "Mon–Fri 9–5" FACT string essentially
   never contains a specific requested date) — that matches Part 4's own
   worked example, where an availability question is still asked even
   though some provider info is already known.
2. **`requirementFit`** — one gap per **required** (not optional; same
   "important missing questions only" principle as D12) category
   attribute with a known non-null value, excluding the budget attribute
   (same exclusion rule as D13a/D13d's `findBudgetAttribute`, reused
   verbatim — pricing is handled by topic 3, not double-counted here),
   whose value is not a case-insensitive substring of
   `candidate.fields.servicesOffered`/`candidate.fields.policies` FACT
   text. This is what generalizes Part 4's own "delivery" skip example
   and its capacity/safety example ("can this inflatable safely
   accommodate...") — delivery/capacity are just LLM-proposed category
   attributes (D6) under this project's model, not special-cased fields.
3. **`pricing`** — always relevant when the category has some concept of
   price (i.e. whenever a budget category attribute exists on the
   state, mirroring D13a/g's `/budget/i` lookup so this only fires for
   categories where pricing is meaningful). If
   `candidate.fields.pricing` is missing → gap (context: "pricing
   unknown"). If present but its text doesn't mention any of a small
   fixed inclusion-keyword set (`setup`, `teardown`, `cleanup`,
   `insur`, `deliver`, `includ`) → gap (context: "confirm what the
   quoted price includes") — directly the assignment's own third
   example ("Does the quoted price include setup, teardown and
   insurance?").

No `location`-topic is included: Part 4's three worked examples are
availability / capacity-fit / pricing-inclusion only, and geographic fit
is already an established ranking dimension (M9); adding a fourth,
unevidenced topic would be scope the assignment doesn't ask for.

## VALIDATE
### Unit Tests
- [x] `availability`: no gap when `coreAttributes.dateTime` is unset.
- [x] `availability`: gap when `dateTime` known and `fields.availability`
      missing.
- [x] `availability`: gap when `fields.availability` known but text
      doesn't mention the requested date/time.
- [x] `availability`: no gap when `fields.availability` text does
      contain the requested date/time (verbatim match case).
- [x] `requirementFit`: no gap for an optional category attribute that's
      missing from provider text.
- [x] `requirementFit`: no gap for the budget attribute even if its
      value never appears in `servicesOffered`/`policies` text.
- [x] `requirementFit`: gap for a required attribute whose value isn't
      lexically present in `servicesOffered`/`policies`.
- [x] `requirementFit`: no gap for a required attribute whose value is
      lexically present.
- [x] `pricing`: no gap-topic considered at all when no budget category
      attribute exists on the state.
- [x] `pricing`: gap ("pricing unknown") when `fields.pricing` is
      missing and a budget attribute exists.
- [x] `pricing`: gap ("confirm inclusions") when `fields.pricing` exists
      but mentions none of the inclusion keywords.
- [x] `pricing`: no gap when `fields.pricing` text mentions at least one
      inclusion keyword.
- [x] Candidate with every topic already covered by FACTs returns `[]`.

### Component / Integration Tests
- (none — pure function, no external boundary)

### E2E Tests
- (none)

### Success Criteria
- [x] All relevant tests pass
- [x] No regressions (`npm test` full suite still green)
- [x] `npm run build` clean
- [x] Follows project conventions (pure function, no I/O/LLM, `null`/`[]`
      semantics explicit)
- [x] Task scope is fully implemented

## ITERATE
### Outcome
`backend/src/providerQuestions/types.ts` (`ProviderGapTopic`,
`ProviderGap`) and `backend/src/providerQuestions/analyzeGaps.ts`
(`analyzeProviderGaps({ candidate, state })`) implemented exactly per
plan: three fixed topics (`availability`, `requirementFit`, `pricing`),
each a pure presence/lexical check, no LLM/I-O. New
`backend/src/providerQuestions/` directory (first M10 module). 13 new
tests, `npm test` 239/239 passing (226 pre-existing + 13 new), `npm run
build` clean. One test-authoring mistake caught and fixed during
implementation: the "no pricing gap when no budget attribute" test
originally used a required, unmatched `size` category attribute,
which correctly triggered an unrelated `requirementFit` gap and failed
the test's `toEqual([])` assertion — fixed by filtering to the
`pricing` topic only, matching the pattern already used by the other
combined-topic tests, not a defect in `analyzeProviderGaps` itself.

### Knowledge Updates
`memory-bank/progress.md` to record: M10's first task is done, new
`providerQuestions/` module exists, 239/239 tests passing, build clean.

### Follow-ups
None — task-34 (LLM phrasing) is next, consumes `ProviderGap[]`
directly as planned.
