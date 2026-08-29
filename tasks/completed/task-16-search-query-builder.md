# Task 16: Deterministic provider search query builder
Status: DONE
Can run in parallel with: NONE (M7 tasks are sequential — each later
task consumes an earlier one's output)

## PLAN
- Goal: A pure function that turns known category + location into a
  search query string, with no LLM call and no other attributes
  involved, per the M7 architecture review.
- Inputs: `serviceCategory: string`, `location: string` — narrowed,
  non-null primitives, not the full `ConversationState`. Deliberately
  typed this way so "location/category must already be known" is a
  compile-time precondition of this function, not something it
  runtime-checks or works around — the caller (task-20's
  orchestration) is responsible for only calling this once both are
  known. If the turn-cap readiness fallback (D12) reaches
  `ready_for_search` with `location` still null, that is a documented
  limitation (DESIGN.md Assumptions), not something this function
  guesses around (e.g. via device/IP geolocation — considered and
  explicitly rejected for this project phase; logged as a Production
  Evolution idea instead).
- Outputs: `backend/src/research/searchQuery.ts` exporting
  `buildProviderSearchQuery({ serviceCategory, location }): string`.
- Constraints:
  - No LLM call of any kind.
  - Query built only from `serviceCategory` + `location` — no other
    category attributes (budget, dates, etc.) folded in.
  - No Firecrawl code, no domain schema changes, no orchestration.
  - Do not touch `backend/src/domain/**`, `backend/src/conversation/**`,
    `backend/src/llm/**`, `backend/src/server.ts`.
- Open Questions: none — resolved in the M7 architecture review and
  follow-up Q&A.

## Assignment Alignment
- Requirement type: PROJECT DECISION (mechanism serving an EXPLICIT
  requirement)
- Assignment requirement: Part 2 — "Once enough information has been
  collected, find real service providers... You do not need to build
  a perfect universal search engine. A strong solution should
  demonstrate how the architecture could work across many categories
  of event services."
- Source: `docs/Home Assignment.pdf`, Part 2 (page 2).
- Rationale: The assignment requires *a* search mechanism that
  generalizes across categories, but does not specify how a query
  should be constructed. Deterministic templating from already-known
  structured state (rather than an LLM call) was chosen per the
  project's "prefer deterministic logic when sufficient" principle —
  `serviceCategory` is already LLM-produced free text from M3
  extraction, so it's already natural-language-search-ready.
- Gaps/conflicts found: none.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/research/searchQuery.ts`
- CREATE: `backend/src/research/searchQuery.test.ts`
- DO NOT TOUCH: everything outside `backend/src/research/`.

### Implementation Notes
- Template: `` `${serviceCategory} in ${location}` `` (e.g.
  `"wedding photographer in Tel Aviv"`). No normalization, trimming,
  or case adjustment beyond what upstream extraction already
  guarantees — out of scope for this task.
- **The exact template string is a project design decision, not an
  assignment requirement** — the assignment does not specify query
  construction at all (see Assignment Alignment below). Only the
  broader choice "deterministic over LLM-generated" was explicitly
  discussed and approved; the literal `"X in Y"` phrasing is a
  reasonable default, not something separately deliberated, and can
  be revised later without being a reversal of any settled decision.
- New `backend/src/research/` directory — home for M7's Firecrawl
  boundary and deterministic pipeline pieces, mirroring how `llm/`
  hosts Gemini-calling wrappers and `conversation/` hosts deterministic
  orchestration over `ConversationState`.

## VALIDATE
### Unit Tests
- [x] Given `serviceCategory: "wedding photographer"`,
      `location: "Tel Aviv"`, returns
      `"wedding photographer in Tel Aviv"`.
- [x] Given different inputs, output changes accordingly (not
      hardcoded to one example).
- [x] Input strings are passed through as-is — no hidden
      normalization (e.g. mixed case / extra whitespace is preserved).

### Component / Integration Tests
- N/A — pure function, no consumers yet (task-20 wires it in).

### E2E Tests
- N/A.

### Success Criteria
- [x] All new tests pass; existing suite still passes.
- [x] `npm run build` clean.
- [x] No LLM call, no I/O, pure function only.

## ITERATE
### Outcome
Implemented exactly as scoped: `backend/src/research/searchQuery.ts`
exports `buildProviderSearchQuery({ serviceCategory, location })`
returning the `` `${serviceCategory} in ${location}` `` template, no
LLM call, no I/O, no other files touched. 3 new tests (exact template,
varying inputs, no hidden normalization), 91/91 passing overall
(previously 82/82 — task-15's `provider.ts` landed in between and is
already reflected in the new total). `npm run build` clean.

### Knowledge Updates
New `backend/src/research/` directory now exists (first M7 pipeline
piece), per plan. No architectural decisions changed.

### Follow-ups
- Device/IP-based location inference for the case where a
  conversation reaches `ready_for_search` via the turn-cap fallback
  without `location` ever being answered: considered and explicitly
  rejected for this project phase (no frontend exists to supply a
  device location; IP-based inference adds a new external dependency
  for low accuracy). Log as a DESIGN.md Production Evolution idea
  ("Geographic search") when M7 completion notes are written, not
  implemented here.
