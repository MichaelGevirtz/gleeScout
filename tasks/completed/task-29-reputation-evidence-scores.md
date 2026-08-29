# Task 29: Reputation and evidence-quality dimension scores
Status: DONE
Can run in parallel with: task-28 (both depend only on task-27's
types; neither depends on the other's output)

## PLAN
- Goal: The remaining two of D8's five dimensions — reputation
  (rating + review-count, gated to independently-sourced,
  mutually-consistent ratings per D13a) and evidence quality
  (FACT-field coverage only, per D13b).
- Inputs: task-27's types; `ProviderCandidate`/`ProviderCandidateFieldsSchema`
  from `backend/src/domain/provider.ts`; `hostnameMatches`/`stripWww`,
  relocated by this task into a new shared utility module (D13a
  Addendum 2 — see Files Touched) so `ranking/` never imports from
  `research/`.
- Outputs:
  - `backend/src/shared/hostname.ts` (CREATE) — `hostnameMatches` and
    `stripWww`, moved verbatim (no logic change) out of
    `backend/src/research/assembleInferredTags.ts`, which previously
    defined them privately. A new, minimal `backend/src/shared/`
    directory for domain-agnostic utilities with no dependency on
    `domain/`, `research/`, `llm/`, or `conversation/`.
  - `backend/src/research/assembleInferredTags.ts` (MODIFY): remove
    the local `hostnameMatches`/`stripWww` definitions, import both
    from `../shared/hostname.js` instead. `classifySourceType` and
    `assembleInferredTags`'s exported behavior/signatures are
    completely unchanged — this is a pure relocation.
  - `backend/src/ranking/reputationAndEvidenceScores.ts` (CREATE)
    exporting:
    - `REVIEW_COUNT_CONFIDENCE_CAP = 20` (named, tunable constant —
      project tuning decision, not derived from data; same category as
      `MAX_DISCOVERY_RESULTS`/`MAX_GATHERING_TURNS`).
    - `reputationScore(candidate): number | null` — `null` if
      `candidate.fields.rating` or `candidate.fields.reviewCount` is
      absent. `null` unless **both**: (a) `rating.sourceUrl ===
      reviewCount.sourceUrl` (D13a Addendum 1 — rating and review
      count must come from the literal same scraped page, not merely
      from independently-trustworthy-looking hostnames each — a
      Google rating paired with a Yelp review count would not be one
      coherent piece of evidence); and (b) that shared source's
      hostname (`rating.source`) is an independently-operated ratings
      platform, checked via `hostnameMatches(source, "google.com") ||
      hostnameMatches(source, "yelp.com")` (imported from
      `../shared/hostname.js`). Otherwise (both conditions met):
      `(rating.value / 5) * min(reviewCount.value /
      REVIEW_COUNT_CONFIDENCE_CAP, 1)`.
    - `evidenceQualityScore(candidate): number` — never `null` (a
      `ProviderCandidate` always has at least one FACT field, per
      task-19's "all-null → null candidate" rule upstream). Computed
      as `(# non-null keys in candidate.fields) /
      (total possible field count)`, where the denominator is derived
      from `Object.keys(ProviderCandidateFieldsSchema.shape).length`
      (currently 10) rather than a hardcoded literal, so it can't
      silently drift if the schema gains/loses a field. Deliberately
      excludes `candidate.inferred` (D13b) — this dimension measures
      what M7's primary discovery learned about the provider, not
      whether M8's capped, order-dependent enrichment happened to run
      on it.
- Constraints:
  - Pure functions only — no I/O, no LLM call, no non-determinism.
  - The `assembleInferredTags.ts` change is a relocation only — do not
    touch `classifySourceType`, `assembleInferredTags`, or their
    existing exported behavior/signatures; `assembleInferredTags.test.ts`
    must keep passing unmodified.
  - Do not implement `requirementMatchScore`/`geoFitScore`/
    `priceFitScore` (task-28), the weighted aggregate (task-30), or
    the explanation builder (task-31).
- Open Questions: none — resolved during M9 planning (D13a incl. both
  addenda, D13b in `decisions.md`).

## Assignment Alignment
- Requirement type: PROJECT DECISION (mechanism), supporting an
  EXPLICIT requirement.
- Assignment requirement: Part 3 — "a generic sort by star rating is
  not enough" (`docs/Home Assignment.pdf`, page 3); Trust & Grounding
  evaluation criterion (page 7).
- Source: Part 3, page 3; D8 (reputation as a "confidence-weighted
  signal," evidence completeness as its own dimension); D13a
  (reputation's independent-source gate, resolving the M7 real-API
  Finding 2 self-reported-rating observation, plus its two addenda —
  same-source consistency, and the `research/`→`ranking/` layering
  fix); D13b (evidence quality redefined to avoid rewarding M8's
  enrichment-cap position rather than provider quality).
- Rationale: `reputationScore` directly implements "star rating alone
  isn't enough" three ways at once — confidence-weighting by review
  count, refusing to count a rating that isn't independently sourced,
  and refusing to blend a rating and review count that don't actually
  describe the same evidence. `evidenceQualityScore` uses only
  uniformly-available M7 data so it can't be gamed by enrichment batch
  position.
- Gaps/conflicts found: none. Not addressing the broader
  "detect-suspicious-numbers" idea from Finding 2 is a deliberate,
  documented exclusion (D13a), not a gap.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/shared/hostname.ts`
- CREATE: `backend/src/shared/hostname.test.ts`
- CREATE: `backend/src/ranking/reputationAndEvidenceScores.ts`
- CREATE: `backend/src/ranking/reputationAndEvidenceScores.test.ts`
- MODIFY: `backend/src/research/assembleInferredTags.ts` (remove local
  `hostnameMatches`/`stripWww`, import from `../shared/hostname.js`)
- DO NOT TOUCH: `backend/src/research/assembleInferredTags.test.ts`
  (must keep passing unmodified — it tests `classifySourceType`'s
  behavior, which does not change), `backend/src/ranking/types.ts`
  (import only), `backend/src/domain/**`, `backend/src/llm/**`,
  `backend/src/conversation/**`, `backend/src/server.ts`,
  `backend/src/research/enrichProviderCandidates.ts`.

### Implementation Notes
- `backend/src/shared/hostname.ts` has zero imports of its own — it's
  pure string/URL-parsing logic, the same two functions currently in
  `assembleInferredTags.ts` lines 4-10, moved as-is.
- `reputationAndEvidenceScores.ts` imports `hostnameMatches` from
  `"../shared/hostname.js"` — never from `"../research/*"`.
- `evidenceQualityScore`'s denominator: `import {
  ProviderCandidateFieldsSchema } from "../domain/provider.js"` and
  use `Object.keys(ProviderCandidateFieldsSchema.shape).length`.

## VALIDATE
### Unit Tests
- [ ] `hostname.ts`: `hostnameMatches`/`stripWww` behave identically to
      their pre-move behavior (can reuse/adapt the relevant existing
      assertions from `assembleInferredTags.test.ts`'s indirect
      coverage as direct unit tests here).
- [ ] `assembleInferredTags.test.ts` (existing, unmodified) still
      passes — confirms the relocation didn't change
      `classifySourceType`'s behavior.
- [ ] `reputationScore`: `rating`/`reviewCount` both present, same
      `sourceUrl`, hostname is `google.com` → non-null score reflecting
      both values.
- [ ] `reputationScore`: same as above but hostname is a provider's own
      domain (unrelated to google/yelp) → `null`.
- [ ] `reputationScore`: `rating` and `reviewCount` present with
      **different** `sourceUrl` values (e.g. one from a Google page,
      one from a Yelp page — each individually "independent," but not
      the same evidence) → `null`. This is the direct regression test
      for D13a Addendum 1.
- [ ] `reputationScore`: `rating` present but `reviewCount` absent (or
      vice versa) → `null`.
- [ ] `reputationScore`: high review count caps confidence at `1`
      (e.g. `reviewCount = 500` scores the same confidence factor as
      `reviewCount = REVIEW_COUNT_CONFIDENCE_CAP`).
- [ ] `reputationScore`: low review count (e.g. `2`) scores lower than
      an otherwise-identical candidate with `reviewCount = 200`, same
      `rating`.
- [ ] `evidenceQualityScore`: all 10 fields populated → `1`.
- [ ] `evidenceQualityScore`: only 1 field populated → `0.1`.
- [ ] `evidenceQualityScore`: unaffected by `candidate.inferred` being
      present vs. absent (same `fields`, different `inferred` →
      identical score) — the direct regression test for D13b.

### Component / Integration Tests
- N/A — no consumer yet (task-30/32 wire these in).

### E2E Tests
- N/A.

### Success Criteria
- [ ] All new tests pass; existing suite still passes (no regression
      in `assembleInferredTags.test.ts`).
- [ ] `npm run build` clean.
- [ ] No I/O, no LLM call, no non-determinism.
- [ ] `backend/src/ranking/**` contains no import from
      `backend/src/research/**`.

## ITERATE
### Outcome
Implemented as planned. `backend/src/shared/hostname.ts` (CREATE) —
`hostnameMatches`/`stripWww` moved verbatim out of
`assembleInferredTags.ts`; `assembleInferredTags.ts` now imports both
from `../shared/hostname.js` with zero behavior change (its own test
file untouched and still green). `backend/src/ranking/reputationAndEvidenceScores.ts`
(CREATE) exports `REVIEW_COUNT_CONFIDENCE_CAP = 20`, `reputationScore`,
and `evidenceQualityScore`, matching the plan's formulas and gating
exactly (same-`sourceUrl` + google.com/yelp.com hostname gate for
reputation; FACT-field-only, schema-derived denominator for evidence
quality). All pure functions, no I/O. 17 new tests across
`hostname.test.ts` (7) and `reputationAndEvidenceScores.test.ts` (10),
covering every VALIDATE checklist item including both D13a-addendum
regression cases and the D13b `inferred`-independence case.
`npm test`: 208/208 passing (191 pre-existing + 17 new). `npm run
build`: clean. Confirmed no `backend/src/ranking/**` file imports from
`backend/src/research/**`.

### Knowledge Updates
None beyond what D13a/D13b already captured during M9 planning — no
new architectural decision was made during implementation, no
deviation from the approved plan.

### Follow-ups
None new. Task-30 (weighted aggregate + minimum-evidence floor) and
task-31 (explanation builder) remain the next consumers of this and
task-28's dimension scores.
