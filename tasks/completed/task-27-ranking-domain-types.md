# Task 27: Ranking domain types (RankingRequirements, ProviderScore)
Status: DONE
Can run in parallel with: NONE (foundation for tasks 28-32)

## PLAN
- Goal: Define the shared types the rest of M9 builds on — a narrow,
  conversation-decoupled requirements type for scoring against, and
  the shape of a single provider's ranking result — plus the pure
  function that derives the former from `ConversationState`.
- Inputs: `backend/src/domain/conversation.ts` (`ConversationState`,
  `CategoryAttributeSlot`), `backend/src/domain/provider.ts`
  (`ProviderCandidate`). Type dependencies only — no state mutation,
  no I/O.
- Outputs: `backend/src/ranking/types.ts` exporting:
  - `RankingRequirements` — `{ location?: string; categoryAttributes:
    Record<string, CategoryAttributeSlot> }`. Deliberately narrower
    than `ConversationState` (no `messages`, `phase`, `sessionId`,
    `serviceCategory`) — ranking only needs the two things it actually
    scores against. `dateTime` is excluded: none of M9's five
    dimensions (requirement match, geo fit, price fit, reputation,
    evidence quality) use it — availability matching is Part 4/M10's
    job, not ranking's.
  - `deriveRankingRequirements(state: ConversationState):
    RankingRequirements` — pure mapping, `location` from
    `state.coreAttributes.location`, `categoryAttributes` passed
    through as-is (includes whatever the LLM proposed for this
    session, budget included, per D6).
  - `RankingDimension` — the literal union `"requirementMatch" |
    "geoFit" | "priceFit" | "reputation" | "evidenceQuality"`.
  - `ProviderScore` — `{ candidate: ProviderCandidate; score: number;
    dimensionScores: Record<RankingDimension, number | null>;
    explanation: string }`. `dimensionScores` uses `null` (not `0`) to
    represent "this dimension was missing/excluded for this
    candidate," per the D13 missing-data rule — `0` remains a real,
    meaningful score (e.g. "no location overlap detected"), so it must
    stay distinguishable from "we couldn't compute this at all."
- Constraints:
  - Types and one pure deriver function only — no scoring logic, no
    weights, no explanation building (tasks 28-31).
  - Do not modify `backend/src/domain/**` — this task only imports
    from it, it does not add fields to `ConversationState` or
    `ProviderCandidate`.
- Open Questions: none — resolved during M9 planning (see D13 in
  `decisions.md`).

## Assignment Alignment
- Requirement type: PROJECT DECISION (mechanism), supporting an
  EXPLICIT requirement.
- Assignment requirement: Part 3 — "rank the providers based on the
  user's specific requirements" (`docs/Home Assignment.pdf`, page 3).
  This task defines what "the user's specific requirements" means as
  a concrete input type for the scorer built in tasks 28-32.
- Source: Part 3, page 3; D8 (`decisions.md`) for the five-dimension
  scorer this type set exists to serve; D13 for the specific shape
  decisions (narrow type over raw `ConversationState`, `dateTime`
  excluded, `null` vs `0` semantics).
- Rationale: Keeping `RankingRequirements` decoupled from
  `ConversationState`'s full shape means ranking can be unit-tested
  with plain fixtures and isn't forced to change every time the
  conversation schema changes for unrelated reasons (M2-era churn risk
  this task avoids by construction).
- Gaps/conflicts found: none.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/ranking/types.ts`
- CREATE: `backend/src/ranking/types.test.ts`
- DO NOT TOUCH: `backend/src/domain/**`, `backend/src/conversation/**`,
  `backend/src/research/**`, `backend/src/llm/**`,
  `backend/src/server.ts`.

### Implementation Notes
- New `backend/src/ranking/` directory — sibling to `research/`,
  `llm/`, `conversation/`, `domain/`, matching the project's existing
  per-concern module layout.
- `deriveRankingRequirements` reads `state.categoryAttributes`
  directly (no filtering, no copying beyond the object reference) —
  it is a `Record`, already the shape `RankingRequirements` needs.

## VALIDATE
### Unit Tests
- [ ] `deriveRankingRequirements` maps `coreAttributes.location` to
      `location` correctly, including when it's `undefined`.
- [ ] `deriveRankingRequirements` passes `categoryAttributes` through
      unchanged (same keys/values, including a `"budget"` entry).
- [ ] `deriveRankingRequirements` does not include `dateTime`,
      `phase`, `sessionId`, `serviceCategory`, or `messages` on its
      return value (type-level guarantee; a runtime check that the
      returned object has exactly the two expected keys is sufficient
      to catch an accidental leak).

### Component / Integration Tests
- N/A — pure types + one trivial mapping function, no consumer yet.

### E2E Tests
- N/A.

### Success Criteria
- [ ] All new tests pass; existing suite still passes.
- [ ] `npm run build` clean.
- [ ] No I/O, no LLM call, no non-determinism.

## ITERATE
### Outcome
Implemented exactly as scoped, no deviations. `backend/src/ranking/types.ts`
(new `backend/src/ranking/` directory) exports `RankingRequirements`,
`deriveRankingRequirements`, `RankingDimension`, and `ProviderScore` as
planned. `deriveRankingRequirements` is a one-line object mapping —
`location` from `state.coreAttributes.location`, `categoryAttributes`
passed through by reference. 4 new tests in `types.test.ts` covering
the location mapping (both defined and `undefined`), pass-through of a
`categoryAttributes` record including a `budget` entry, and an
explicit key-count check confirming no extra fields leak through from
`ConversationState`. `npm test`: 169/169 passing (165 pre-existing + 4
new), no live network calls. `npm run build` clean.

### Knowledge Updates
- `memory-bank/progress.md`: add a Task 27 bullet under Implemented
  (new `backend/src/ranking/` module, M9 underway) and a Validation
  Status line (169/169).
- No `decisions.md` change needed — this task implements decisions
  already recorded there (D13 series) with no deviation.
- `DESIGN.md`: not touched — this task is pure type/plumbing scaffolding
  with no new product-level point to surface beyond what D13 already
  documents; the first M9 task with real product-level content
  (e.g. task-29's reputation gate, task-30's minimum-evidence floor)
  is a better place for a DESIGN.md bullet, if one is added at all.

### Follow-ups
- None new.
