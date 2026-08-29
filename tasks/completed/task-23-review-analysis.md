# Task 23: Gemini review-text analysis (raw tag+excerpt extraction)
Status: DONE
Can run in parallel with: task-21, task-22

## PLAN
- Goal: Given one already-scraped review/reputation page's markdown,
  have Gemini identify short, specific qualitative signals about the
  provider (the "good with toddlers" / "frequently late" / "clean
  equipment" kind of signal Part 3 illustrates) with a supporting
  excerpt — the M8 analog of task-18's `extractProviderFacts`, but for
  soft/qualitative signals instead of the 10 structured FACT fields.
- Inputs: page URL + scraped markdown (already fetched by
  `searchProviderPages`, reused unchanged from M7).
- Outputs: `ReviewAnalysisResultSchema`/`ReviewAnalysisResult` and
  `analyzeReviewText({ url, markdown, generate? })` in a new
  `backend/src/llm/reviewAnalysis.ts`, reusing task-05's
  `generateStructuredJson` exactly as `providerExtraction.ts` does.
- Constraints: Raw extraction only — no `Inferred<T>` wrapping (that's
  task-24's job, matching the existing FACT-side split between
  task-18/task-19). No Fact/Inferred import here at all, mirroring
  `providerExtraction.ts`'s independence from `evidence.ts`.
  **`ReviewAnalysisResultSchema` must have no `sourceType`/`source`-like
  field, and the system instruction must not ask Gemini to identify or
  guess where the page came from** — confirmed during M8 design review
  (2026-08-28): `sourceType` (task-21) is always computed by
  deterministic app code from the URL (task-24), never proposed or
  decided by the LLM. This task's schema staying tag/excerpt-only is
  what makes that boundary structurally true, not just documented.
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT (supports), PROJECT DECISION (mechanism)
- Assignment requirement: Part 3's worked example is literally this
  step — "a provider might have a 4.9 rating overall, but reviews
  might reveal that they are especially good with toddlers, frequently
  arrive late, have particularly clean equipment, or specialize in
  very large parties." Eval criterion 5 (Trust & Grounding).
- Source: `docs/Home Assignment.pdf`, Part 3 (page 2).
- Rationale: Directly implements the assignment's own illustrative
  example of enrichment value. Reuses task-05's generic structured-JSON
  wrapper rather than a new LLM integration path.
- Gaps/conflicts found: none.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/llm/reviewAnalysis.ts`
- CREATE: `backend/src/llm/reviewAnalysis.test.ts`
- DO NOT TOUCH: `backend/src/domain/**`, `backend/src/research/**`,
  `backend/src/llm/providerExtraction.ts`,
  `backend/src/llm/geminiClient.ts`, `backend/src/conversation/**`,
  `backend/src/server.ts`.

### Implementation Notes
- `ReviewAnalysisResultSchema = z.object({ tags: z.array(z.object({
  tag: z.string(), excerpt: z.string().nullable() })) })` — an array,
  possibly empty; each tag independently carries its own supporting
  excerpt or `null` if no specific quotable snippet supports it.
- System instruction (following task-18's precedent of an explicit
  no-guessing rule) must:
  - Forbid fabricating a tag not supported by the page text.
  - Forbid restating information the structured FACT extraction
    already captures (price, address, phone, services list) — this
    step is for qualitative/reputation signal only, to keep INFERRED
    from becoming a duplicate of FACT.
  - Ask for concrete, specific signals (not generic praise like
    "great service") and a short supporting excerpt per tag.
  - Return an empty `tags` array rather than inventing signal when the
    page has nothing useful (mirrors task-18's "empty extraction is
    valid" precedent).
- No hint given to Gemini about *how many* tags to return — task-25
  (or `assembleInferredTags` in task-24) does not enforce a cap on tag
  count; if this proves noisy in real use, that's a follow-up, not
  solved speculatively here.

## VALIDATE
### Unit Tests
- [x] Returns the parsed result (one or more tags with excerpts) from a valid `generate` response.
- [x] Accepts an empty `tags: []` response as valid (no signal found).
- [x] Accepts a tag with `excerpt: null`.
- [x] Propagates task-05's `GeminiValidationError` when the response fails `ReviewAnalysisResultSchema` (via a fake client, not reimplemented validation).
- [x] Includes the given url and markdown content in the prompt passed to `generate`.

### Component / Integration Tests
- N/A — no consumer yet (task-24/25 wire it in).

### E2E Tests
- N/A. Manual real-API check optional at completion (non-blocking, same pattern as task-18) — skipped; matches the already-proven-live task-05/task-18 call pattern exactly.

### Success Criteria
- [x] All new tests pass; existing suite still passes.
- [x] `npm run build` clean.
- [x] No live network calls in `npm test`.

## ITERATE
### Outcome
Implemented as planned, no deviations. `backend/src/llm/reviewAnalysis.ts`
exports `ReviewAnalysisResultSchema`/`ReviewAnalysisResult` (`{ tags: {
tag: string, excerpt: string | null }[] }`) and `analyzeReviewText({
url, markdown, generate? })`, mirroring `providerExtraction.ts`'s shape
exactly (same `generate` injection pattern, same prompt-building
helper, defaults to task-05's real `generateStructuredJson`). System
instruction forbids fabricated tags, forbids restating FACT-side
fields (price/address/phone/services), forbids generic praise, and
allows/prefers an empty `tags: []` when the page has nothing useful.
No `sourceType`/source field anywhere in the schema or prompt — the
LLM is never asked to identify or guess page provenance, keeping that
boundary structural per the M8 design-review note this task's PLAN
already captured. No `Inferred<T>`/`Fact` import — raw extraction
only, matching task-18/19's FACT-side split precedent.

5 new unit tests in `backend/src/llm/reviewAnalysis.test.ts`, adapted
1:1 from `providerExtraction.test.ts`'s pattern for the array-shaped
schema (fake-generate happy path, empty-array happy path, null-excerpt
happy path, real `GeminiValidationError` propagation via a fake SDK
client, prompt-content check). `npm test`: 19 test files / 136 tests
passing (was 18/131 before this task — 5 new tests, no regressions).
`npm run build`: clean. No live network calls in the automated suite.

### Knowledge Updates
None beyond what's already in `decisions.md`'s M8 open/deferred note
about `sourceType` always being deterministic (task-21) — this task
is the concrete implementation that makes that boundary true for the
review-analysis path specifically, not a new decision.

### Follow-ups
None new. Task-24 (`assembleInferredTags`) and task-25 (enrichment
query builder / wiring) remain the next consumers, as already scoped.
