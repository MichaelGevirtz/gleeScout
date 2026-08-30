# Task 91: Recommendations card — literal-FACT "other provider facts" section
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: extend the Recommendations provider card with a second,
  deterministic, literal-FACT-only section ("what we found") shown
  below the confirmed-requirements checkmarks, and remove the
  generated `explanation` rationale line (source of the "serves your
  area." duplication) — without touching ranking, scoring, ordering,
  or the FACT/INFERRED architecture.
- Inputs: `ProviderCandidate.fields` (existing FACT fields);
  `ProviderScore.confirmedRequirements` (task-88/89, unchanged).
- Outputs:
  - `backend/src/ranking/otherProviderFacts.ts` — new pure function
    `deriveOtherProviderFacts(candidate, confirmedRequirements):
    OtherProviderFact[]`.
  - `ProviderScore.otherFacts: OtherProviderFact[]` (backend +
    frontend mirrored type).
  - `frontend/src/components/OtherProviderFacts.tsx` — new
    presentational component (renders `otherFacts` verbatim, applies
    display-only truncation for long values).
  - `RecommendationsScreen.tsx` redesigned: `ConfirmedRequirementsList`
    → `OtherProviderFacts` → reputation line → "View details". The
    `explanation`/rationale Text and the old `decisionRow`
    (price/location) are removed — pricing/location now come from
    `otherFacts`.
- Constraints:
  - **No LLM involvement anywhere in this task.** All selection/dedup
    logic is plain deterministic TypeScript.
  - `deriveOtherProviderFacts` reads only `candidate.fields` (FACT).
    It must never read or leak `candidate.inferred` (INFERRED stays
    architecturally separate, rendered only by `ProviderDetailsScreen`,
    untouched by this task).
  - Location dedup: binary rule, not a semantic "meaningfulness"
    judgment. If `confirmedRequirements` contains a `kind: "location"`
    entry, omit the `location` FACT from `otherFacts` entirely.
    Otherwise include it verbatim, untruncated (truncation is
    frontend-only, see below).
  - **Service dedup — literal substring only, both directions,
    case-insensitive.** A `servicesOffered` entry is excluded iff, for
    any confirmed requirement `label`:
    `serviceFact.toLowerCase().includes(label.toLowerCase())` OR
    `label.toLowerCase().includes(serviceFact.toLowerCase())`.
    No semantic similarity, fuzzy matching, embeddings, stemming, or
    LLM call. Remaining (non-excluded) entries are shown as literal,
    unedited strings — never rewritten, merged into a new sentence, or
    summarized. If all entries are excluded, omit `servicesOffered`
    from `otherFacts` entirely (not an empty placeholder). If more
    than 4 remain, show the first 4 joined by `, ` plus a bare
    `+N more` count suffix (same literal-count convention
    `ProviderDetailsScreen`'s photo filmstrip already uses — a count,
    not an interpretation).
  - `pricing`, `availability`, `policies`, `contactMethod`: no
    existing requirement type overlaps these categories today
    (confirmedRequirements.ts never derives from budget/availability/
    contact text) — include verbatim whenever the FACT is present, no
    dedup logic needed, omit when absent.
  - Excluded from `otherFacts` (unchanged reasoning from prior
    discussion): `name` (already the card header), `photos` (not a
    text row — Provider Details' job), `rating`/`reviewCount` (already
    surfaced via the existing dedicated reputation line — including
    them here would duplicate it).
  - Truncation of long free-text values (`pricing`, `availability`,
    `policies`, `contactMethod`) happens **only** in
    `OtherProviderFacts.tsx` (frontend, card-width/layout concern): a
    plain character-slice + ellipsis (`text.slice(0, 100).trimEnd() +
    "…"` when `text.length > 100`). It must never alter the backend's
    `otherFacts` output — Provider Details continues to show the full,
    untruncated FACT text, unaffected by this task.
  - Do not change `rankProviders.ts`'s scoring, `computeAggregateScore`,
    `computeFitScore`, `deriveMatchGrade`, filtering, sorting, or the
    `MAX_RANKED_RESULTS` cap — `otherFacts` is purely an additive field
    computed alongside `confirmedRequirements`.
  - Do not modify `backend/src/ranking/explanation.ts` or
    `TraceScreen.tsx` — the full-prose rationale (including "serves
    your area") stays correct and unchanged there; only the
    Recommendations *card* stops rendering `provider.explanation`.
  - Do not modify `ProviderDetailsScreen.tsx`, `ContextPanel.tsx`,
    `App.tsx` production code, `confirmedRequirements.ts`,
    `matchAndFitScores.ts`, `fitScore.ts`, `aggregateScore.ts`, or any
    Zod schema in `domain/`.
  - **Known, accepted limitation (flagging per reviewer instruction,
    not silently working around it):** the literal-substring rule
    means a `servicesOffered` entry that *paraphrases* a confirmed
    requirement rather than literally containing/being-contained-by
    its label will **not** be excluded. Concretely, with a confirmed
    `serviceCategory` label of `"baby shower photographer"`, a
    services entry reading `"Photography for baby showers, maternity
    and family events"` shares no literal substring with that label
    (word order/inflection differ: "baby showers" vs "baby shower
    photographer") and will still be shown in `otherFacts` even though
    it's conceptually close to the confirmed requirement. This is the
    same documented, accepted limitation already called out in
    `confirmedRequirements.ts` and `matchAndFitScores.ts` (lexical
    substring matching, not semantic matching) — not a new gap
    introduced here. No fuzzy/semantic fallback is being added to
    "fix" it, per explicit reviewer instruction.
- Open Questions: none.

## Assignment Alignment
- Requirement type: PROJECT DECISION (supports EXPLICIT requirement)
- Assignment requirement: Part 6's card content list ("Who the
  provider is", "Why they are a good match", "What information is
  confirmed") and evaluation criterion 6 ("Taste" — "good decisions
  about what information matters, what the user should see, and what
  complexity should remain hidden").
- Source: `docs/Home Assignment.pdf`, Part 6 pp.3-4, Evaluation
  criterion 6 p.7.
- Rationale: this task is a correction/refinement of task-88/89's
  card (not new scope) — it replaces a generated rationale sentence
  ("serves your area.") with structured, literal, already-collected
  FACT evidence, directly serving "what information is confirmed"
  without inventing new interpretive copy, and keeps INFERRED
  information architecturally out of the FACT-only card section per
  the project's FACT/INFERRED separation principle.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/ranking/otherProviderFacts.ts`
- CREATE: `backend/src/ranking/otherProviderFacts.test.ts`
- CREATE: `frontend/src/components/OtherProviderFacts.tsx`
- CREATE: `frontend/src/components/OtherProviderFacts.test.tsx`
- MODIFY: `backend/src/ranking/types.ts` (add `OtherProviderFactKind`,
  `OtherProviderFact`, `ProviderScore.otherFacts`)
- MODIFY: `backend/src/ranking/rankProviders.ts` (wire in
  `deriveOtherProviderFacts`)
- MODIFY: `backend/src/ranking/rankProviders.test.ts` (extend fixtures/
  assertions for the new additive field)
- MODIFY: `backend/src/recommendation/generateProviderList.test.ts`
  (extend fixtures for the new additive field)
- MODIFY: `frontend/src/domain/types.ts` (mirror
  `OtherProviderFactKind`/`OtherProviderFact`,
  `ProviderScore.otherFacts`)
- MODIFY: `frontend/src/screens/RecommendationsScreen.tsx` (remove
  `rationale`/`explanation` Text + styles, remove `decisionRow` and
  `derivePrice`/`deriveLocation` helpers, render `OtherProviderFacts`
  between `ConfirmedRequirementsList` and the reputation line)
- MODIFY: `frontend/src/screens/RecommendationsScreen.test.tsx`
  (remove the now-invalid "renders the explanation verbatim" test;
  update the price-omission test to target
  `other-provider-fact-pricing`; add location-suppression/-inclusion
  and services-dedup cases)
- MODIFY: `frontend/src/App.test.tsx` (add `otherFacts: []` to
  `providerScoreFixture`, same fixture-gap pattern task-89 hit)
- DO NOT TOUCH: `backend/src/ranking/explanation.ts`,
  `backend/src/ranking/confirmedRequirements.ts`,
  `backend/src/ranking/matchAndFitScores.ts`,
  `backend/src/ranking/fitScore.ts`,
  `backend/src/ranking/aggregateScore.ts`, any `domain/*.ts` Zod
  schema, `frontend/src/screens/ProviderDetailsScreen.tsx`,
  `frontend/src/screens/TraceScreen.tsx`,
  `frontend/src/components/ContextPanel.tsx`, `frontend/src/App.tsx`
  production code, `frontend/src/components/ConfirmedRequirementsList.tsx`,
  `frontend/src/components/MatchGradeBadge.tsx`

### Implementation Notes
- `OtherProviderFact = { kind: OtherProviderFactKind; value: string }`,
  `OtherProviderFactKind = "location" | "servicesOffered" | "pricing" |
  "availability" | "policies" | "contactMethod"`.
- Field order in `deriveOtherProviderFacts`'s output: `location`,
  `servicesOffered`, `pricing`, `availability`, `policies`,
  `contactMethod` (mirrors `ProviderDetailsScreen.FIELD_ORDER` minus
  `rating`/`reviewCount`/`name`/`photos`).
- `OtherProviderFacts.tsx` follows the same "purely presentational, no
  logic beyond mapping/truncation" doc-comment convention as
  `ConfirmedRequirementsList.tsx`; testID `other-provider-fact-{kind}`
  per row (not provider-row-indexed, matching
  `ConfirmedRequirementsList`'s existing `confirmed-requirement-{index}`
  convention); renders nothing when `otherFacts` is empty.

## VALIDATE
### Unit Tests
- [ ] `deriveOtherProviderFacts`: `location` omitted iff a confirmed
      requirement has `kind: "location"`; included verbatim otherwise
- [ ] `deriveOtherProviderFacts`: services filtering — literal
      substring match in the `serviceFact.includes(label)` direction
      excludes the entry
- [ ] `deriveOtherProviderFacts`: services filtering — literal
      substring match in the `label.includes(serviceFact)` direction
      excludes the entry
- [ ] `deriveOtherProviderFacts`: a services entry with no literal
      substring overlap in either direction (e.g. `"corporate
      photography"` against a confirmed label containing
      `"photographer"`) is **not** excluded and remains visible
- [ ] `deriveOtherProviderFacts`: all `servicesOffered` entries
      overlapping confirmed labels → `servicesOffered` omitted from
      output entirely (not an empty-value row)
- [ ] `deriveOtherProviderFacts`: more than 4 non-excluded services →
      first 4 shown, joined by `, `, with a `+N more` suffix
- [ ] `deriveOtherProviderFacts`: `pricing`/`availability`/`policies`/
      `contactMethod` included verbatim when present, omitted when
      absent, for each field independently
- [ ] `deriveOtherProviderFacts`: candidate with only `inferred` data
      and no matching FACT fields produces an empty/appropriate
      result — the function never reads `candidate.inferred`
- [ ] `deriveOtherProviderFacts`: stable output field order
      (`location`, `servicesOffered`, `pricing`, `availability`,
      `policies`, `contactMethod`)
- [ ] `OtherProviderFacts` (frontend): renders one row per fact,
      testID `other-provider-fact-{kind}`; renders nothing for an
      empty array; a value over 100 chars is truncated with an
      ellipsis; a value at/under 100 chars is rendered unchanged

### Component / Integration Tests
- [ ] `RecommendationsScreen`: a confirmed `location` requirement
      suppresses the location line in the other-facts section
- [ ] `RecommendationsScreen`: no confirmed `location` requirement →
      the location FACT renders in the other-facts section
- [ ] `RecommendationsScreen`: `provider-row-{i}-rationale` /
      `explanation` text no longer renders anywhere on the card
- [ ] `RecommendationsScreen`: pricing now renders via
      `other-provider-fact-pricing` (old `provider-row-0-price`
      behavior superseded); omitted when `fields.pricing` is absent
- [ ] `RecommendationsScreen`: existing heading/subtitle/count/
      trace-link/rating/checkmark/`onSelectRow` tests still pass
      unmodified in behavior
- [ ] `rankProviders.test.ts`: `otherFacts` present and correctly
      derived alongside `confirmedRequirements` on returned
      `ProviderScore`s; existing score/ordering/filter assertions
      unchanged
- [ ] `App.test.tsx`: full suite passes with `otherFacts: []` added to
      the fixture

### Success Criteria
- [ ] `backend/npm test` full suite green, no regressions
- [ ] `backend/npm run typecheck` clean
- [ ] `frontend/npm test` full suite green, no regressions
- [ ] `frontend/npx tsc --noEmit` clean
- [ ] Provider Details screen unchanged, still shows full untruncated
      FACT/INFERRED evidence (manual check — no test file touched
      there)
- [ ] Trace screen unchanged, still shows the full prose rationale
      including "serves your area" where applicable (manual check —
      no test file touched there)

## ITERATE
### Outcome
Implemented as planned, no deviations:
- `backend/src/ranking/otherProviderFacts.ts` — new
  `deriveOtherProviderFacts(candidate, confirmedRequirements)`. Binary
  `location` suppression when a `location` requirement is confirmed;
  literal, case-insensitive, two-direction substring dedup for
  `servicesOffered` (capped at 4 + `"+N more"`); `pricing`/
  `availability`/`policies`/`contactMethod` always included verbatim
  when present; `rating`/`reviewCount`/`name`/`photos` excluded; never
  reads `candidate.inferred`.
- `backend/src/ranking/types.ts` — added `OtherProviderFactKind`,
  `OtherProviderFact`, `ProviderScore.otherFacts`.
- `backend/src/ranking/rankProviders.ts` — wired
  `deriveOtherProviderFacts` in alongside `deriveConfirmedRequirements`,
  purely additive.
- `frontend/src/components/OtherProviderFacts.tsx` — new, purely
  presentational (same "no logic beyond mapping" convention as
  `ConfirmedRequirementsList`), with a frontend-only 100-char ellipsis
  truncation for card width.
- `frontend/src/screens/RecommendationsScreen.tsx` — removed the
  `explanation`/rationale `Text` and its styles, removed the old
  `decisionRow` (price/location) and `derivePrice`/`deriveLocation`
  helpers, rendered `OtherProviderFacts` between
  `ConfirmedRequirementsList` and the reputation line.
  `backend/src/ranking/explanation.ts` and `TraceScreen.tsx` were not
  touched — the full prose rationale (including "serves your area")
  is unchanged there.
- Tests: `otherProviderFacts.test.ts` (11 cases, including both
  substring directions and the explicit "corporate photography" vs.
  "photographer" non-match case from the reviewer's example);
  `rankProviders.test.ts` gained 1 integration test proving the dedup
  runs correctly during real ranking (confirms `"toddler bounce
  houses"` is excluded via the `"toddler"` categoryAttribute label
  while `"delivery included"` survives); `OtherProviderFacts.test.tsx`
  (4 cases); `RecommendationsScreen.test.tsx` — replaced the invalid
  "renders the explanation as rationale" test with an explicit
  absence-of-"serves your area" check, retargeted the price test to
  `other-provider-fact-pricing`, added 2 other-facts rendering tests.
  `generateProviderList.test.ts`/`App.test.tsx` fixtures gained
  `otherFacts: []`.
- `backend/npm test`: 395/395 passing. `backend/npm run typecheck`:
  clean. `frontend/npm test`: 167/167 passing (was 158 before task-90;
  net +9 across this task). `frontend/npx tsc --noEmit`: clean.
- `ProviderDetailsScreen.tsx`, `ContextPanel.tsx`, `App.tsx` production
  code, `confirmedRequirements.ts`, `matchAndFitScores.ts`,
  `fitScore.ts`, `aggregateScore.ts`, and all `domain/*.ts` Zod schemas
  were not touched, per the DO NOT TOUCH list.
- Manually verified (via test assertions, since no running app
  instance was launched for this presentation-only change): Provider
  Details' fact list and Trace screen's prose explanation are
  unaffected — neither test file was touched and both continue passing
  unmodified.
- `DESIGN.md` gained 1 Architecture Decisions bullet (plain-language,
  no implementation detail) describing the other-facts section and its
  dedup-against-requirements behavior.

### Knowledge Updates
Recorded as D29 in `decisions.md` (full rationale, the literal-
substring-dedup mechanics, and the explicitly-flagged paraphrase
limitation) and a matching `progress.md` entry.

### Follow-ups
None currently scoped. The reviewer-flagged paraphrase limitation
(literal substring matching won't dedup e.g. "Photography for baby
showers..." against a confirmed "baby shower photographer" label) is
documented in D29 as a known, accepted limitation — not a follow-up,
per explicit reviewer instruction not to add semantic/fuzzy matching.
