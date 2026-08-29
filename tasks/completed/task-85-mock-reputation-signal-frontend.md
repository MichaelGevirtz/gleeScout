# Task 85: Mock reputation signal display (frontend)
Status: DONE
Can run in parallel with: NONE (depends on task-84's field shape on
`ProviderCandidate`)

## PLAN
- Goal: Render the new blended mock `reputationRating`/
  `reputationReviewCount` on each provider card, clearly labeled as
  simulated, without duplicating the existing (unlabeled) FACT rating
  line on the same card.
- Inputs: `ProviderCandidate.reputationRating` /
  `.reputationReviewCount` (from task-84 — the average of two mocked
  sources, not either platform's real data), already flowing through
  `POST /conversation/:id/providers`'s existing response shape — no
  API client change needed.
- Outputs: `RecommendationsScreen.tsx` shows
  "★ {reputationRating} · {reputationReviewCount} reviews (simulated)"
  when both values are present, replacing (not appending to) the
  existing `deriveRating()` line for that card.
- Constraints:
  - Do not touch `ProviderDetailsScreen.tsx`, `ContextPanel.tsx`, or
    any other screen — scoped to the Recommendations card only, per
    the reviewer's original ask.
  - Do not touch `MatchGradeBadge.tsx` or anything about how the match
    grade is computed/displayed — this is a separate, secondary line,
    never merged visually with the match grade (reviewer's explicit
    instruction).
  - The copy must not attribute the number to "Google" or "Yelp"
    specifically — it's a blend of two mocked sources now, so any
    single-platform attribution would misrepresent it. "(simulated)"
    is sufficient and required.
- Open Questions: none — copy and labeling were confirmed with the
  reviewer before task-84 was revised.

## Assignment Alignment
- Requirement type: PROJECT DECISION (same classification and
  rationale as task-84 — see that task file's Assignment Alignment
  section; not repeated in full here to avoid drift between the two).
- Source: `docs/Home Assignment.pdf` Part 6 p.3-4 (card must show
  "Rating / reputation" — already satisfied by the existing line; this
  task adds a second, clearly-separate, clearly-labeled reputation
  signal alongside it, not a replacement of an assignment-required
  element).

## IMPLEMENT
### Files Touched
- MODIFY: `frontend/src/domain/types.ts` — add
  `reputationRating?: number; reputationReviewCount?: number;` to the
  `ProviderCandidate` interface, siblings of `fields`/`inferred`
  (mirrors the backend Zod schema from task-84 exactly).
- MODIFY: `frontend/src/screens/RecommendationsScreen.tsx` — add a
  small derivation (e.g. `deriveMockReputation(candidate)`) returning a
  display string only when both fields are present; when present,
  render it in place of the existing `deriveRating()` output for that
  row; when absent, today's behavior (existing FACT rating line,
  unlabeled) is completely unchanged.
- DO NOT TOUCH: `MatchGradeBadge.tsx`, `ProviderDetailsScreen.tsx`,
  `ContextPanel.tsx`, `TraceScreen.tsx`, `App.tsx`, any backend file.

### Implementation Notes
- Keep the existing `deriveRating()` function and its FACT-based
  fallback path exactly as-is for candidates without mock reputation
  values — this task only adds a higher-priority alternative line, it
  does not remove or refactor the existing one.
- No new component needed — this is one derived string in an existing
  screen, same weight as `derivePrice`/`deriveLocation` already there.

## VALIDATE
### Unit Tests
- [ ] Not applicable beyond component tests below (this is a pure
      presentational change).

### Component / Integration Tests
- [ ] A provider row with `reputationRating`/`reputationReviewCount`
      set renders the new labeled line (asserting the literal
      "(simulated)" text is present) and does NOT render the old
      `deriveRating()` output for that row.
- [ ] A provider row without those fields renders exactly as today
      (existing `RecommendationsScreen.test.tsx` fixtures pass
      unmodified).
- [ ] The new line renders visually below/separate from
      `MatchGradeBadge` (structural check — e.g. testID ordering or
      distinct testID, not a pixel/snapshot test).

### E2E Tests
- [ ] None required.

### Success Criteria
- [ ] `frontend/npm test` full suite green, no regressions.
- [ ] `frontend/npx tsc --noEmit` clean.
- [ ] Follows project conventions (presentational, prop-driven, no new
      network/hook usage).
- [ ] Task scope fully implemented.

## ITERATE
### Outcome
Implemented exactly as planned, no deviations:
- `frontend/src/domain/types.ts`: added optional
  `reputationRating?: number; reputationReviewCount?: number;` to
  `ProviderCandidate`, mirroring the backend schema.
- `frontend/src/screens/RecommendationsScreen.tsx`: added
  `deriveMockReputation(candidate)` returning
  `` `${reputationRating} · ${reputationReviewCount} reviews
  (simulated)` `` only when both fields are present. Wired via
  `deriveMockReputation(candidate) ?? deriveRating(candidate)`, so the
  mock line takes priority and reuses the exact same render block/
  testID (`provider-row-{index}-rating`) as the existing FACT rating
  line — a true replacement, not an addition. `deriveRating()` itself
  is untouched.
- Tests added: 3 new `RecommendationsScreen.test.tsx` cases (mock line
  replaces fact line with correct values and without the old numbers;
  falls back to the fact line unchanged when mock fields are absent;
  renders after `match-grade-label` in output order, never merged with
  it). Hit one iteration snag: `toHaveTextContent` in this RNTL version
  defaults to exact full-string equality, not substring — the first
  draft's partial-string assertions failed until rewritten as either
  full exact strings or explicit `{ exact: false }` calls.
- `frontend/npm test`: 147/147 passing (144 pre-existing + 3 new).
  `frontend/npx tsc --noEmit`: clean.
- `MatchGradeBadge.tsx`, `ProviderDetailsScreen.tsx`, `ContextPanel.tsx`,
  `TraceScreen.tsx`, `App.tsx`, and all backend files were not touched,
  per the task's DO NOT TOUCH list.

### Knowledge Updates
- Recorded a DESIGN.md Assumptions bullet (the mock reputation feature
  is now reader-visible) and a `memory-bank/progress.md` entry. D26 in
  `decisions.md` already covered both task-84 and this task's
  rationale, so no new decision entry was needed.
- Noted for future frontend test authors: RNTL's `toHaveTextContent`
  matcher is exact-match by default in this version (not substring) —
  pass `{ exact: false }` explicitly for a substring check.

### Follow-ups
- None currently scoped. This closes the mock-reputation feature pair
  (task-84 backend + task-85 frontend).
