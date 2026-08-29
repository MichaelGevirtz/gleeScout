# Task 36: M10 post-review fixes (INFERRED gap-check + realistic combined test)
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: Address the two findings from the post-M10 review (PASS WITH
  ISSUES) that the reviewer chose to fix now, out of the six findings
  raised: (1) `requirementFit` gap analysis ignored `candidate.inferred`
  entirely; (2) no test covered the realistic "provider already knows
  most things, exactly one gap remains" scenario end-to-end.
- Inputs: post-M10 review findings (this conversation).
- Outputs: `analyzeRequirementFitGaps` also searches INFERRED tag text;
  new tests for both findings.
- Constraints: Exactly these two changes — reviewer explicitly deferred
  the other four findings (duplicated budget-lookup helper, no
  per-provider gap cap, exposing `ProviderGap.topic` to M11, and general
  follow-up scope) as non-blocking design considerations, not to be
  acted on now. No M8 redesign, no confidence model.
- Open Questions: none.

## Assignment Alignment
- Requirement type: RECOMMENDATION (engineering-quality fix identified
  during independent review; not a new assignment requirement, tightens
  M10's existing EXPLICIT Part 4 implementation).
- Source: post-M10 review (this conversation).
- Rationale: Part 4's "information already available about the
  provider" doesn't textually limit itself to FACT; M8's INFERRED
  pipeline is exactly "information available about the provider" that
  M10 was silently ignoring.

## IMPLEMENT
### Files Touched
- MODIFY: `backend/src/providerQuestions/analyzeGaps.ts` —
  `analyzeRequirementFitGaps` now folds `candidate.inferred`'s
  `value`/`evidenceExcerpt` text into the same lexical `combinedText`
  already used for `servicesOffered`/`policies`.
- MODIFY: `backend/src/providerQuestions/analyzeGaps.test.ts` — 4 new
  tests (INFERRED tag value closes a gap; INFERRED excerpt-only match
  closes a gap; unrelated INFERRED tags don't suppress an unrelated
  gap; using INFERRED to close a gap doesn't add/alter any FACT field).
- MODIFY: `backend/src/providerQuestions/prepareProviderQuestions.test.ts`
  — 1 new end-to-end test: real `analyzeProviderGaps` + a fake `phrase`
  that echoes gap topic/description, across a candidate with
  availability/pricing/two-of-three required attributes already known
  and exactly one (`ageRange`) missing; asserts `phrase` was called
  with exactly one gap and the final result has exactly one question.
- DO NOT TOUCH: everything else in M10 (task-33/34/35's core logic and
  the six deferred findings).

### Implementation Notes
- Only `inferred[].value` and `inferred[].evidenceExcerpt` are read —
  never `sourceType`/`evidenceSourceUrl`/`retrievedAt` — and only to
  decide whether to *ask a question*, never to populate or alter any
  `Fact`-shaped field. `analyzeProviderGaps` still returns only
  `ProviderGap[]`; it never touches `candidate.fields` or
  `candidate.inferred` by reference/mutation. This is what keeps the
  FACT/INFERRED distinction intact: INFERRED is consulted as read-only
  lexical signal for a gap/no-gap decision, never promoted, copied, or
  relabeled as FACT anywhere in the pipeline.
- `requirementFit` is the only gap topic changed — `availability` and
  `pricing` still check FACT fields only, matching the reviewer's
  narrow instruction (extend "the requirement-fit gap check", not every
  topic).

## VALIDATE
### Unit Tests
- [x] INFERRED tag `value` lexically covering a required attribute
      suppresses that gap.
- [x] INFERRED tag `evidenceExcerpt` (not `value`) lexically covering a
      required attribute suppresses that gap.
- [x] Unrelated INFERRED tags present do not suppress an unrelated
      required attribute's gap.
- [x] Using an INFERRED signal to close a gap leaves `candidate.fields`
      and `candidate.inferred` unchanged (no promotion to FACT).

### Component / Integration Tests
- [x] Realistic combined scenario (`prepareProviderQuestions`, real
      `analyzeProviderGaps` + fake `phrase`): provider with
      availability, pricing, and 2 of 3 required attributes already
      known → exactly one `ProviderGap` reaches `phrase`, exactly one
      question in the final result, and it's about the one missing
      attribute (`ageRange`).

### E2E Tests
- (none)

### Success Criteria
- [x] All M10 tests pass: 29/29 (`src/providerQuestions/**`,
      `src/llm/providerQuestionPhrasing.test.ts`)
- [x] Full suite: 255/255 passing (250 pre-existing + 5 new)
- [x] `npm run build` clean
- [x] No regressions
- [x] Scope limited to exactly the two approved fixes — the other four
      review findings untouched

## ITERATE
### Outcome
Both fixes implemented exactly as scoped. `npm test` (targeted):
`src/providerQuestions/analyzeGaps.test.ts` 17 tests,
`src/llm/providerQuestionPhrasing.test.ts` 6 tests,
`src/providerQuestions/prepareProviderQuestions.test.ts` 6 tests — 29/29
passing. Full suite: 255/255 passing (250 pre-existing + 5 new: 4 in
`analyzeGaps.test.ts`, 1 in `prepareProviderQuestions.test.ts`).
`npm run build` clean.

### Knowledge Updates
`memory-bank/progress.md`: note M10 amended post-review (INFERRED now
consulted in `requirementFit`; realistic combined test added); test
count now 255/255. No `decisions.md` entry needed — this is a bug-fix/
coverage tightening of an already-recorded design (D5's FACT/INFERRED/
SIMULATED separation, D14's M10 scope), not a new decision.

### Follow-ups
Deferred, not acted on (per reviewer instruction — only if M11's
implementation demonstrates they're actually needed):
- Duplicated budget-lookup helper (`analyzeGaps.ts`'s `findBudgetValue`
  vs. `ranking/matchAndFitScores.ts`'s `findBudgetAttribute`) — move to
  `shared/` if/when touched again.
- No per-provider gap cap.
- `ProviderGap.topic` not currently exposed past `prepareProviderQuestions`'s
  internals — revisit during M11 planning if M11 needs per-topic
  context.
