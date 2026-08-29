# Task 31: Deterministic ranking-explanation builder
Status: DONE
Can run in parallel with: task-30 (both depend only on tasks 27-29's
outputs; neither depends on the other's output)

## PLAN
- Goal: Turn a candidate's per-dimension score breakdown into a short,
  human-readable "ranking explanation" string (per the reviewer's
  chosen terminology — not "rationale string") via plain deterministic
  templates, with no LLM call.
- Inputs: `RankingDimension` type (task-27); `ProviderCandidate` (for
  the raw underlying values — rating, reviewCount, location, pricing —
  referenced in the explanation text, not just the 0-1 scores).
- Outputs: `backend/src/ranking/explanation.ts` exporting
  `buildRankingExplanation(candidate: ProviderCandidate,
  dimensionScores: Record<RankingDimension, number | null>): string`.
  Builds a short sentence/clause per computable dimension, joined into
  one string; a dimension with a `null` score contributes nothing (no
  claim is made about something we don't know) rather than a
  "unknown"/"N/A" filler clause. If every relevant dimension is
  `null`, returns a single fixed fallback string (e.g. "Limited
  information available for this provider.") rather than an empty
  string.
  - `requirementMatch` (non-null): a clause reflecting the match
    strength (e.g. `>= 0.7` → "strong match for your requirements";
    `> 0` → "partial match for your requirements"; `0` → "limited
    match for your requirements").
  - `geoFit` (non-null): `1` → "serves your area"; `0` → omit rather
    than assert a negative (a `0` here means no textual overlap was
    detected, not a confirmed non-match — asserting "does not serve
    your area" would overclaim what a lexical heuristic can support).
  - `priceFit` (non-null): a clause using the actual parsed price
    where available (e.g. "within your stated budget" for `1`,
    "above your stated budget" otherwise) — pull the human-readable
    `candidate.fields.pricing.value` string into the sentence rather
    than a raw score.
  - `reputation` (non-null): cite the real numbers — e.g. `"4.8★ from
    230 independently-sourced reviews"` — using
    `candidate.fields.rating.value`/`reviewCount.value` directly.
  - `evidenceQuality`: deliberately NOT phrased into the explanation
    text — it's a background completeness signal for scoring, not a
    naturally user-facing sentence (nothing meaningful to say to a
    user like "we know 70% of possible fields about this business").
    This is a project decision for this task, not a missing-data case.
- Constraints:
  - Pure function, string templates only — no LLM call (this is the
    deterministic-explanation branch selected during M9 planning, not
    the LLM-phrased alternative).
  - Do not implement any of tasks 27-30's scoring/aggregation logic
    here — this task only consumes their already-computed output.
  - Do not reference `evidenceQuality` in the returned string (see
    above) — it exists in `dimensionScores` but is not one of this
    task's phraseable clauses.
- Open Questions: none.

## Assignment Alignment
- Requirement type: PROJECT DECISION (mechanism, incl. the
  "explanation" terminology choice), supporting an EXPLICIT
  requirement.
- Assignment requirement: Part 3 — "We care about your reasoning
  here" (`docs/Home Assignment.pdf`, page 3); Part 6's example
  provider card includes rationale-style bullets ("Great reviews for
  kids ages 4-7," "Within their normal delivery area") and "Why this
  provider ranks where it does" (page 3-4).
- Source: Part 3 (page 3), Part 6 (pages 3-4); D8 (rationale/
  explanation as part of the scorer's output); M9 planning
  conversation (deterministic-template approach chosen over an
  LLM-phrased alternative, to keep ranking fully deterministic and
  avoid an extra LLM call per candidate per ranking pass).
- Rationale: A template-built explanation is trivially testable
  (exact-string or substring assertions) and costs nothing extra at
  ranking time, versus an LLM-phrasing call that would add latency,
  cost, and a phrasing-only boundary to enforce for no clear benefit
  at this stage.
- Gaps/conflicts found: none.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/ranking/explanation.ts`
- CREATE: `backend/src/ranking/explanation.test.ts`
- DO NOT TOUCH: `backend/src/ranking/types.ts`,
  `backend/src/ranking/matchAndFitScores.ts`,
  `backend/src/ranking/reputationAndEvidenceScores.ts`,
  `backend/src/ranking/aggregateScore.ts` (import types only, do not
  modify), `backend/src/domain/**`, `backend/src/research/**`,
  `backend/src/llm/**`, `backend/src/conversation/**`,
  `backend/src/server.ts`.

### Implementation Notes
- Join individual clauses with `"; "` or `". "` into one sentence-ish
  string — exact punctuation is an implementation detail, not
  something to over-design; keep it readable, not clever.

## VALIDATE
### Unit Tests
- [ ] All five dimensions non-null (typical case) → explanation
      mentions requirement match, geo fit, price fit, and reputation
      content; does not mention "evidence quality" literally.
- [ ] `requirementMatch = null` → no requirement-match clause present,
      remaining clauses still present.
- [ ] `geoFit = 0` → no "does not serve" (or similarly negative)
      clause present — confirms the "omit, don't assert a negative"
      rule.
- [ ] `reputation = null` (e.g. self-reported rating, per D13a) → no
      star-rating clause present, even though `candidate.fields.rating`
      itself may still be populated.
- [ ] All five dimensions `null` → returns the fixed fallback string,
      not an empty string.
- [ ] Returned string never contains "evidence" or "evidenceQuality"
      literally, regardless of that dimension's score.

### Component / Integration Tests
- N/A — no consumer yet (task-32 wires this in).

### E2E Tests
- N/A.

### Success Criteria
- [ ] All new tests pass; existing suite still passes.
- [ ] `npm run build` clean.
- [ ] No I/O, no LLM call, no non-determinism.

## ITERATE
### Outcome
Implemented as planned, one minor addition beyond the literal spec:
the price-fit clause includes the parsed pricing string in parens
(e.g. "within your stated budget ($250)") rather than the budget
clause alone — this fulfills the task's own instruction to "pull the
human-readable `candidate.fields.pricing.value` string into the
sentence rather than a raw score," which the bare "within/above your
stated budget" phrasing didn't yet do on its own. Created
`backend/src/ranking/explanation.ts` exporting
`buildRankingExplanation(candidate, dimensionScores)`: four private
per-dimension clause builders (requirementMatch/geoFit/priceFit/
reputation), `evidenceQuality` never referenced, `null`-score
dimensions contribute nothing, `geoFit = 0` omitted (never asserts a
negative), all-null falls back to the fixed string. Created
`backend/src/ranking/explanation.test.ts` covering all 6 VALIDATE
checklist cases. All 6 new tests pass; full suite 222/222 passing
(216 pre-existing + 6 new); `npm run build` clean. Pure function only
— no I/O, no LLM call. Did not touch `types.ts`,
`matchAndFitScores.ts`, `reputationAndEvidenceScores.ts`,
`aggregateScore.ts`, or any excluded directory.

### Knowledge Updates
None beyond what D8/the M9 planning conversation already recorded —
deterministic-template explanations (not LLM-phrased) was an
already-made decision, not a new one.

### Follow-ups
None. Task-32 (`rankProviders` orchestrator) is the next consumer,
wiring this together with task-30's `computeAggregateScore` and the
five dimension-scoring functions.
