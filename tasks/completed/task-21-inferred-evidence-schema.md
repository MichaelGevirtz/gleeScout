# Task 21: Inferred evidence schema (Inferred<T> primitive + ProviderCandidate.inferred field)
Status: DONE
Can run in parallel with: task-22, task-23

## PLAN
- Goal: Add the `Inferred<T>` primitive (value derived from evidence,
  not directly observed, carrying a pointer to the evidence it came
  from) and attach it to `ProviderCandidate` as a new, separate
  `inferred` bucket — the second of the three FACT/INFERRED/SIMULATED
  buckets D7 committed to, deferred since task-14 to land with its
  first real consumer (this milestone).
- Inputs: `backend/src/domain/evidence.ts` (existing `FactSchema`
  pattern to mirror), `backend/src/domain/provider.ts` (existing
  `ProviderCandidateSchema`).
- Outputs: `InferredSchema<T>` / `Inferred<T>` exported from
  `evidence.ts`, now carrying a deterministic `sourceType` alongside
  the evidence pointer (revised during M8 design review, 2026-08-28 —
  see below); `ProviderCandidateSchema` gains an optional `inferred:
  Inferred<string>[]` field, a sibling of `fields` (not nested inside
  it) — `fields` stays the FACT bucket exactly as-is, `inferred` is
  the new INFERRED bucket, matching D7's "three distinct, never-merged
  categories" framing at the top level of a candidate.
- Constraints: Schema/type only — no LLM call, no Firecrawl call, no
  orchestration logic, no wiring into `discoverProviderCandidates.ts`
  or any route. Do not modify `ProviderCandidateFieldsSchema`'s
  existing 10 FACT fields.
- Open Questions: none — shape confirmed against D7's existing
  addendum ("inferred... derived from evidence... with a pointer to
  the evidence it came from") during M8 planning, and `sourceType`'s
  value set confirmed during a second review round (2026-08-28,
  directory-detection question — see Implementation Notes).

## Assignment Alignment
- Requirement type: EXPLICIT (supports), PROJECT DECISION (exact shape)
- Assignment requirement: Part 3 ("reviews might reveal they are
  especially good with toddlers... "); eval criterion 5, Trust &
  Grounding — "Can the system distinguish facts found online, inferred
  information and simulated provider responses? This is particularly
  important."
- Source: `docs/Home Assignment.pdf`, Part 3 (page 2-3); "What We Will
  Evaluate" #5 (page 7).
- Rationale: The system cannot structurally distinguish INFERRED from
  FACT until an INFERRED type exists. This task creates that type,
  reusing `FactSchema`'s established pattern (factory function over a
  caller-supplied Zod value schema) for consistency, per D7's addendum
  from task-14.
- Gaps/conflicts found: none.

## IMPLEMENT
### Files Touched
- MODIFY: `backend/src/domain/evidence.ts` (add `InferredSchema`/`Inferred`)
- MODIFY: `backend/src/domain/evidence.test.ts`
- MODIFY: `backend/src/domain/provider.ts` (add `inferred` field to `ProviderCandidateSchema`)
- MODIFY: `backend/src/domain/provider.test.ts`
- DO NOT TOUCH: `backend/src/research/**`, `backend/src/llm/**`,
  `backend/src/conversation/**`, `backend/src/server.ts`,
  `ProviderCandidateFieldsSchema`'s existing 10 fields.

### Implementation Notes
- `InferredSchema<T>(valueSchema)` returns `z.object({ value:
  valueSchema, evidenceSourceUrl: z.string().url(), evidenceExcerpt:
  z.string().optional(), sourceType:
  z.enum(["google", "yelp", "provider_website", "directory", "other"]),
  retrievedAt: z.string().datetime() })`. Deliberately not identical to
  `FactSchema` — `source` (a short provenance label) doesn't apply the
  same way to a derived signal, and `evidenceExcerpt` is new: an
  optional short quote/snippet from the evidence text supporting the
  inferred value, giving a reviewer something concrete to check the
  inference against (the "pointer to the evidence" D7 calls for).
- **`sourceType`** (added during M8 design review, 2026-08-28):
  identifies *where* the evidence came from (google / yelp / a page on
  the same host as the provider's own M7-discovered candidate page /
  a known directory site / anything else), so provenance survives even
  though M8's enrichment search is generic and may surface any kind of
  page. **Not a trust or quality score** — `"google"` means "this
  evidence came from a google.* host," nothing more; whether one
  `sourceType` should be weighted more than another in ranking is
  explicitly out of scope here, deferred to M9/M10. **Always
  app-computed, never LLM-produced** — task-23's Gemini schema has no
  `sourceType` field and is never asked to classify a source; task-24
  is the only place `sourceType` gets a value, from the URL alone.
  `z.enum` (closed set) chosen over a free-form string so a typo in
  the classifier's own code (e.g. `"directroy"`) fails loudly via Zod
  rather than silently producing an unrecognized value — consistent
  with this project's "validate everything" default. Enum keeps
  `"directory"` as a valid future value even though M8's classifier
  (task-24) never actually produces it yet (see task-24's Implementation
  Notes) — confirmed during a second review round rather than assumed,
  since accurately detecting real directory sites needs a maintained
  hostname list, which is more classification machinery than M8
  currently needs.
- `Inferred<T>` type mirrors `Fact<T>`'s hand-written type export, plus
  the new `sourceType` field.
- `ProviderCandidateSchema.inferred` is `z.array(InferredSchema(z.string())).optional()`
  — an array because a candidate can have multiple independent
  inferred tags (e.g. "good with toddlers", "frequently late"), each
  with its own evidence pointer, not one inferred blob for the whole
  candidate. `.optional()` (not defaulted to `[]`) matches how
  `fields` on `ProviderCandidateFieldsSchema` already treats each
  attribute as optional-until-populated.

## VALIDATE
### Unit Tests
- [ ] `InferredSchema(z.string())` accepts a value with all fields
      populated (`value`, `evidenceSourceUrl`, `evidenceExcerpt`, `sourceType`, `retrievedAt`).
- [ ] `InferredSchema(z.string())` accepts a value with `evidenceExcerpt` omitted.
- [ ] `InferredSchema(z.string())` rejects a non-URL `evidenceSourceUrl`.
- [ ] `InferredSchema(z.string())` rejects a non-ISO `retrievedAt`.
- [ ] `InferredSchema(z.string())` accepts each of the 5 `sourceType` enum values.
- [ ] `InferredSchema(z.string())` rejects a `sourceType` outside the enum (e.g. `"facebook"`).
- [ ] `ProviderCandidateSchema` accepts a candidate with `inferred` populated (array of tags).
- [ ] `ProviderCandidateSchema` accepts a candidate with `inferred` omitted (existing M7 shape still valid, no regression).

### Component / Integration Tests
- N/A — schema only, no consumer yet (task-24/25 wire it in).

### E2E Tests
- N/A.

### Success Criteria
- [ ] All new tests pass; existing suite still passes.
- [ ] `npm run build` clean.
- [ ] No existing `ProviderCandidate` consumer (none exist yet) needs
      to change — `inferred` is additive and optional.

## ITERATE
### Outcome
Implemented as scoped, no deviations. `backend/src/domain/evidence.ts`
now exports `SourceTypeSchema`/`SourceType` (`z.enum(["google", "yelp",
"provider_website", "directory", "other"])`), `InferredSchema<T>`
(`{ value, evidenceSourceUrl, evidenceExcerpt?, sourceType,
retrievedAt }`), and the `Inferred<T>` type. `backend/src/domain/provider.ts`'s
`ProviderCandidateSchema` gained `inferred:
z.array(InferredSchema(z.string())).optional()`, a sibling of `fields`
(not nested inside it). `ProviderCandidateFieldsSchema`'s existing 10
FACT fields untouched. 12 new tests (10 in `evidence.test.ts`,
including an `it.each` over all 5 `sourceType` enum values; 2 in
`provider.test.ts` covering `inferred` populated and omitted). Full
suite: `npm test` 131/131 passing (116 pre-existing + 12 new here + 3
from task-22, which was implemented concurrently by another session
during this task — disjoint files, no conflict, confirmed by the
parallel-safety check at task-creation time). `npm run build` clean.

### Knowledge Updates
- `Inferred<T>`/`InferredSchema` now exist in
  `backend/src/domain/evidence.ts`, alongside `Fact<T>`/`FactSchema`
  from task-14. This is the first real implementation of D7's
  previously-deferred INFERRED bucket.
- `ProviderCandidateSchema.inferred` is the attachment point task-24/25
  will populate.

### Follow-ups
- None new. task-22, task-23, task-24, task-25 remain PENDING/IN
  PROGRESS as already scoped.
