# Task 94: Extraction excludes event-context attributes from categoryAttributes
Status: DONE
Can run in parallel with: task-95

## PLAN
- Goal: Tighten `extractRequirements`'s system prompt so LLM-proposed
  `categoryAttributes` only include attributes a provider's own
  listing would plausibly state as fact (capacity, delivery radius,
  setup included, water slide option, etc.) — never event-context /
  purpose fields (occasion, who the event is for, relationship to
  guest of honor).
- Inputs: `backend/src/llm/extraction.ts`'s `SYSTEM_INSTRUCTION`;
  `backend/scripts/extractionGoldenSet.ts` + `evalExtraction.ts`
  (existing on-demand real-API eval harness, task-08) for regression
  verification.
- Outputs: Updated `SYSTEM_INSTRUCTION` wording. No schema change —
  `ExtractionResultSchema`'s shape (`categoryAttributes: Array<{name,
  description, importance, value}>`) is unchanged; only what the LLM
  is instructed to propose changes.
- Constraints:
  - Do not touch `ExtractionResultSchema`, `mergeExtraction.ts`,
    `questionPolicy.ts`, or any downstream consumer — they operate on
    whatever attributes exist and need no changes.
  - Do not add a second LLM call, a deterministic attribute allowlist,
    or any new abstraction — this is a prompt-wording fix only,
    consistent with D5/D8 (LLM proposes, deterministic code decides
    structure).
  - Do not change how `dateTime`/`location` (coreAttributes) are
    extracted — this task is scoped to `categoryAttributes` only.
- Open Questions: none — this is a self-contained prompt-wording
  change, verified by re-running the existing eval harness.

## Assignment Alignment
- Requirement type: PROJECT DECISION (bug fix within already-approved,
  EXPLICIT-required M3 scope)
- Assignment requirement: Part 1, item 2 — "Determine which attributes
  are important for **selecting** that particular service." The
  assignment's own bounce-house example list (event date/time,
  location, number/ages of children, available space, indoor/outdoor,
  desired size/type, water slide, setup constraints, budget) contains
  zero event-context/occasion-type attributes — every example is a
  provider-selection criterion, not a fact about the customer's event
  purpose.
- Source: `docs/Home Assignment.pdf`, page 1 (Context/Example) and
  page 2 (Part 1, item 2).
- Rationale: Live testing (this session) found the current prompt has
  no constraint preventing the LLM from proposing an event-context
  attribute (e.g. occasion/"son's birthday"), which — per Part 3's
  ranking design (`requirementMatchScore`, D13d) — can structurally
  never be confirmed against any provider's FACT text, since it
  describes the customer's event, not the provider's offering. This
  silently zeroed the `requirementMatch` ranking dimension for every
  candidate on that query. Restricting `categoryAttributes` to
  provider-statable facts realigns the implementation with Part 1 item
  2's own framing and its own example list. No new requirement is
  introduced; no scope beyond already-approved M3/M9 is added.

## IMPLEMENT
### Files Touched
- MODIFY: `backend/src/llm/extraction.ts` (`SYSTEM_INSTRUCTION` only)
- MODIFY: `backend/src/llm/extraction.test.ts` (only if an existing
  test asserts specific prompt substrings that the wording change
  would break — update the assertion, not the intent)
- DO NOT TOUCH: `ExtractionResultSchema`, `mergeExtraction.ts`,
  `questionPolicy.ts`, `backend/scripts/extractionGoldenSet.ts`'s
  existing case list (may add one new case, see Validate)

### Implementation Notes
- Add an explicit exclusion rule to the `categoryAttributes` bullet in
  `SYSTEM_INSTRUCTION`: attributes must be things a provider's own
  website/listing would state about their service — never the
  customer's event context, purpose, occasion, or who the event is
  for. Keep the existing "reuse known-state name/description" and
  "value only if current message states it" rules unchanged.
- Keep the change to prompt wording only — no code branching, no new
  parameters.

## VALIDATE
### Unit Tests
- [ ] `extraction.test.ts` still passes unchanged (injected-fake tests
      shouldn't depend on exact prompt wording; fix any that do)
- [ ] Add one new case to `extractionGoldenSet.ts` whose message
      states an explicit occasion (e.g. "...for my son's birthday...",
      mirroring this session's live query) asserting no
      occasion/context-type `categoryAttribute` name appears in the
      result — a regression guard for the exact defect found live,
      since the existing "bounce house" case didn't catch it originally

### Component / Integration Tests
- N/A (pure prompt change; covered by extraction unit tests + eval
  harness)

### E2E Tests
- N/A

### Success Criteria
- [ ] `npm test` (backend) passes
- [ ] `npm run eval:extraction` (manual, real Gemini API, on-demand
      per CLAUDE.md — never part of `npm test`/`build`) re-run against
      the full golden set including the new case; the existing
      "bounce house" case still finds `expectAttributeKeywords:
      ["water","slide"]`-style attributes when the message states them,
      and the new occasion case produces no event-context attribute
- [ ] No regressions in `mergeExtraction`/`questionPolicy` tests (they
      consume whatever attributes exist; shape unchanged)

## ITERATE
### Outcome
Added one exclusion bullet to `SYSTEM_INSTRUCTION` in
`backend/src/llm/extraction.ts`: `categoryAttributes` must be things a
provider's own listing would state as fact, never the customer's
event context/purpose/occasion. No schema, merge, or question-policy
changes. `extraction.test.ts` needed no edits (its assertions use
injected fakes, not prompt substrings). Added a new
`expectNoAttributeKeywords` field to `GoldenCase`
(`backend/scripts/extractionGoldenSet.ts`) and its check in
`evalExtraction.ts`, plus a new golden case ("event context should not
become an attribute") mirroring the live defect. `backend/npm test`:
43 files / 399 tests passing. `backend/npm run typecheck`: clean.
`npm run eval:extraction` (real Gemini API, on-demand): 10/10 cases
completed, 0 FAIL — the new regression case PASSed (no
occasion/birthday/guest-of-honor attribute proposed); the existing
"bounce house" case still found `expectAttributeKeywords: ["water",
"slide"]`-equivalent attributes, though this run's exact wording
("wetDryOption") only matched "water" and not the literal substring
"slide," yielding a REVIEW (not FAIL) verdict — the same
non-deterministic keyword-matching softness already documented for
this harness (task-08), not a regression caused by this change. 3 of
10 cases landed REVIEW (bounce house, taco truck, face painter), all
pre-existing loose-keyword misses unrelated to categoryAttributes'
event-context content.

### Knowledge Updates
None beyond this outcome — no new architectural decision; this
realigns an already-approved M3 behavior (D5/D8: LLM proposes,
deterministic code decides structure) with the assignment's own
Part 1 item 2 framing. No `decisions.md` or `DESIGN.md` entry
warranted.

### Follow-ups
None.
