# Task 37: Simulated<T> schema (SIMULATED evidence primitive)
Status: DONE
Can run in parallel with: task-38 (disjoint files — evidence.ts/
evidence.test.ts vs. providerResponseSimulation.ts — neither consumes
the other's output)

## PLAN
- Goal: Add the third and final evidence-provenance bucket —
  `SimulatedSchema<T>` / `Simulated<T>` — to
  `backend/src/domain/evidence.ts`, completing D7's FACT/INFERRED/
  SIMULATED trio. No consumer wired in yet (task-38/39/40 are next).
- Inputs: existing `backend/src/domain/evidence.ts` (`FactSchema`/
  `Fact<T>`, `InferredSchema`/`Inferred<T>` already implemented).
- Outputs: `SimulatedSchema<T extends z.ZodTypeAny>(valueSchema: T)`
  returning a Zod object `{ value: T, generatedAt: string (ISO 8601
  datetime) }`, and the matching `Simulated<T>` TypeScript type.
- Constraints: Per D15, deliberately **no** `source`/`sourceUrl`
  (nothing was retrieved from anywhere) and **no**
  `evidenceExcerpt`/`sourceType` (nothing to excerpt or classify by
  domain) — do not copy Fact/Inferred's shape wholesale. Do **not**
  add a `simulated` field to `ProviderCandidateSchema` in
  `backend/src/domain/provider.ts` (per D15, SIMULATED data is never
  attached to the candidate object — task-40's orchestration output
  is consumed directly by a future M12 route, not stored on the
  candidate).
- Open Questions: none — shape and scope confirmed via D15.

## Assignment Alignment
- Requirement type: EXPLICIT
- Assignment requirement: Part 5 — "The simulation should be clearly
  separated from factual information collected from the web. ... This
  distinction is important. We should always be able to understand
  which information is observed / sourced versus inferred /
  simulated." Also evaluation criterion 5, "Trust & Grounding": "Can
  the system distinguish facts found online, inferred information and
  simulated provider responses? This is particularly important."
- Source: `docs/Home Assignment.pdf`, Part 5 and "What We Will
  Evaluate" §5.
- Rationale: This schema is the structural mechanism that makes the
  FACT/INFERRED/SIMULATED distinction enforceable in code rather than
  a documentation convention — exactly what D7 committed to and what
  Part 5 asks for by name.

## IMPLEMENT
### Files Touched
- MODIFY: `backend/src/domain/evidence.ts` — add `SimulatedSchema`/
  `Simulated<T>` below the existing `Inferred<T>` definitions, same
  file-organization pattern as the Fact→Inferred addition in task-21.
- MODIFY: `backend/src/domain/evidence.test.ts` — new tests for the
  added schema, same file/pattern as existing Fact/Inferred tests.
- DO NOT TOUCH: `backend/src/domain/provider.ts` (no `simulated` field
  added — see Constraints), any file under `backend/src/llm/`,
  `backend/src/providerQuestions/`, `backend/src/server.ts`.

### Implementation Notes
- Mirror `InferredSchema`'s factory-function pattern exactly (generic
  `<T extends z.ZodTypeAny>`, returns `z.object({...})`), just with
  the narrower field set from PLAN's Outputs.
- `generatedAt` validated the same way `retrievedAt`/`retrievedAt` are
  elsewhere: `z.string().datetime()` (ISO 8601), caller-supplied, no
  internal `Date.now()` in the schema itself (schemas never generate
  values).

## VALIDATE
### Unit Tests
- [ ] `SimulatedSchema(z.string())` accepts a valid `{ value,
      generatedAt }` object.
- [ ] `SimulatedSchema` rejects a missing `value`.
- [ ] `SimulatedSchema` rejects a non-ISO-8601 `generatedAt`.
- [ ] `SimulatedSchema` rejects an object carrying a `source`/
      `sourceUrl`/`evidenceExcerpt`/`sourceType` field but missing
      `value`/`generatedAt` (confirms the schema wasn't accidentally
      copy-pasted from `InferredSchema` without trimming fields) —
      or, if Zod's default `.object()` strips/ignores extra keys
      rather than rejecting them, a positive-shape test asserting the
      *parsed* output only ever contains `value`/`generatedAt` keys.

### Component / Integration Tests
- (none — pure schema addition, no consumer yet)

### E2E Tests
- (none)

### Success Criteria
- [ ] All relevant tests pass
- [ ] No regressions (`npm test` full suite still green)
- [ ] `npm run build` clean
- [ ] `ProviderCandidateSchema` in `provider.ts` confirmed unchanged
- [ ] Task scope is fully implemented

## ITERATE
### Outcome
Implemented exactly as planned. `backend/src/domain/evidence.ts` gained
`SimulatedSchema<T extends z.ZodTypeAny>(valueSchema: T)` (returns
`z.object({ value: T, generatedAt: z.string().datetime() })`) and the
matching `Simulated<T>` type, placed directly below `Inferred<T>`. No
`source`/`sourceUrl`/`evidenceExcerpt`/`sourceType` fields — narrower
than Fact/Inferred per D15. `backend/src/domain/evidence.test.ts` got 5
new tests (valid parse, missing `value` rejected, non-ISO `generatedAt`
rejected, a Fact/Inferred-shaped object missing `value`/`generatedAt`
rejected, and a positive-shape test confirming Zod's default key
stripping means the parsed output only ever contains `value`/
`generatedAt` even when extra Fact/Inferred fields are present in the
input). `provider.ts` confirmed untouched (`grep -i simulated` — no
match). `npm test`: 260/260 passing (255 pre-existing + 5 new). `npm
run build`: clean. D7's FACT/INFERRED/SIMULATED trio is now complete
in the schema layer; no consumer wired in yet, per scope (task-38/39/40
next).

### Knowledge Updates
- `memory-bank/progress.md` updated with a Task 37 entry.
- No `decisions.md` change — this task implemented an already-settled
  decision (D7/D15), it didn't make a new one.

### Follow-ups
- None beyond the already-planned task-38 (`providerResponseSimulation.ts`)
  and task-39/40 (consumer wiring), which this task explicitly deferred.
