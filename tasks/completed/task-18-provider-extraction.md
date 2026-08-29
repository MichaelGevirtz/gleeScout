# Task 18: Gemini per-page provider-fact extraction
Status: DONE
Can run in parallel with: task-17 (touches different files, neither
depends on the other's output — both are consumed by task-20)

## PLAN
- Goal: Given one already-scraped page's markdown content, ask Gemini
  to extract whatever Part 2 fields are actually stated on that page,
  returning bare (non-`Fact`-wrapped) nullable values — reusing
  task-05's `generateStructuredJson` exactly as task-06's requirement
  extraction does, applied to page content instead of a chat message.
- Inputs: `url: string`, `markdown: string` (one candidate page's
  scraped content, from task-17's output).
- Outputs: `backend/src/llm/providerExtraction.ts` exporting:
  - `ProviderExtractionResultSchema` / `ProviderExtractionResult` — the
    same field set as task-15's `ProviderCandidateFieldsSchema`
    (`name`, `location`, `servicesOffered`, `pricing`, `availability`,
    `rating`, `reviewCount`, `photos`, `policies`, `contactMethod`),
    each nullable and **not** wrapped in `Fact<T>` — this call reports
    values only; the application wraps them into `Fact<T>`
    deterministically afterward (task-19), stamping `sourceUrl`/
    `retrievedAt`/`source` itself. The LLM never produces provenance.
  - `extractProviderFacts({ url, markdown, generate? }):
    Promise<ProviderExtractionResult>` — `generate` injectable,
    defaults to the real `generateStructuredJson`.
- Constraints:
  - No Fact-wrapping, no dedup/cap, no Firecrawl call — pure
    extraction over already-fetched content.
  - System instruction must explicitly forbid guessing: fields not
    clearly stated on the page must be `null`. Presence in the schema
    means "useful if found," never "must be produced" — an explicit
    requirement from the M7 architecture review's Q&A, not implicit.
  - Do not touch `backend/src/domain/**`, `backend/src/llm/geminiClient.ts`,
    `backend/src/llm/extraction.ts`, `backend/src/conversation/**`,
    `backend/src/research/**`, `backend/src/server.ts`.
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT
- Assignment requirement: Part 2's field list — "Extract useful
  structured information when possible, such as: Provider name,
  Website, Location / service area, Services offered, Approximate
  pricing, Availability information, if available, Ratings, Number of
  reviews, Relevant photos, Important policies, Contact method,
  Anything else useful for making the decision." Also DESIGN.md's
  required "How do you keep extracted facts grounded?" — answered
  here by the explicit no-guessing instruction.
- Source: `docs/Home Assignment.pdf`, Part 2 (page 2) and DESIGN.md
  (page 5, Architecture Decisions).
- Rationale: This is the one point in M7 where an LLM call is the
  right tool — turning noisy, category-agnostic page markdown into
  structured fields deterministically would be brittle and wouldn't
  generalize across service categories, which Part 2 explicitly cares
  about. Reusing `generateStructuredJson` keeps this consistent with
  M3's already-proven extraction architecture rather than building new
  LLM-calling machinery.
- Gaps/conflicts found: none.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/llm/providerExtraction.ts`
- CREATE: `backend/src/llm/providerExtraction.test.ts`
- DO NOT TOUCH: `backend/src/llm/geminiClient.ts`,
  `backend/src/llm/extraction.ts`, `backend/src/domain/**`,
  `backend/src/conversation/**`, `backend/src/research/**`.

### Implementation Notes
- Follow `extraction.ts`'s exact shape: a Zod result schema, a
  `buildPrompt`-style helper, a `SYSTEM_INSTRUCTION` constant, an
  injectable `generate` param defaulting to the real
  `generateStructuredJson`.
- Prompt = the page's URL (for the LLM's own context) + its markdown
  content. System instruction states the field list, that every field
  is independently optional, and — the key rule from the M7 review's
  Q&A — "only report a field if this page clearly states it; use null
  for anything not present, unclear, or inferred. Do not guess,
  estimate, or use general knowledge about this business."
- `rating`/`reviewCount` as `z.number().nullable()`; `servicesOffered`/
  `photos` as `z.array(...).nullable()`; everything else
  `z.string().nullable()`, matching task-15's per-field inner types
  (minus the `Fact` wrapper).

## VALIDATE
### Unit Tests
- [ ] A fake `generate` returning a fully-populated result parses and
      is returned as-is.
- [ ] A fake `generate` returning all-null fields (page had nothing
      useful) is accepted — an empty-ish result is valid, not an
      error.
- [ ] The real `generateStructuredJson`'s validation path is exercised
      via a fake SDK client returning malformed JSON, confirming
      `GeminiValidationError`/`GeminiParseError` propagate unchanged
      (same technique task-06 used to avoid reimplementing
      task-05's validation in this test).
- [ ] The built prompt includes both the given `url` and `markdown`
      content (a basic prompt-construction sanity check, not an
      LLM-output check).

### Component / Integration Tests
- N/A — no consumers yet (task-20 wires it in).

### E2E Tests
- N/A. Manual real-API sensibility check recommended at completion
  (non-blocking), same pattern as task-11.

### Success Criteria
- [ ] All new tests pass; existing suite still passes.
- [ ] `npm run build` clean.
- [ ] No live network calls in `npm test`.
- [ ] No `Fact`/provenance logic present in this file — bare values
      only.

## ITERATE
### Outcome
Implemented exactly as planned. `backend/src/llm/providerExtraction.ts`
exports `ProviderExtractionResultSchema`/`ProviderExtractionResult`
(bare nullable fields, no `Fact` wrapper, matching task-15's field set
minus the wrapper) and `extractProviderFacts({ url, markdown,
generate? })`, which builds a prompt from the page URL + markdown and
calls Task 05's `generateStructuredJson` (injectable, defaults to the
real wrapper). System instruction explicitly forbids guessing —
fields not clearly stated on the page must be null — per the M7
review's Q&A. 5 new unit tests in
`backend/src/llm/providerExtraction.test.ts`, all against injected
fakes/a fake SDK client (no live network calls): full population,
all-null acceptance, Task 05's `GeminiValidationError` propagation via
a fake client, Task 05's parse-error propagation, and a prompt-content
sanity check. `npm test`: 14 files / 96 tests passing (91 prior + 5
new). `npm run build` clean. No manual real-API check run (task marks
this non-blocking; deferred like task-11/12).

### Knowledge Updates
- `memory-bank/progress.md` updated with this task's outcome.
- `DESIGN.md` Architecture Decisions gained one bullet on the
  no-guessing grounding rule for per-page provider extraction.
- No `decisions.md` change — no new architectural decision, this is a
  direct application of task-05/06's already-established pattern to a
  new field set.

### Follow-ups
- None anticipated. Task-20 will wire this into the M7 pipeline and
  wrap its output into `Fact<T>` per task-19.
