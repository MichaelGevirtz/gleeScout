# Task 06: Requirement extraction (LLM call)
Status: DONE
Can run in parallel with: NONE (depends on Task 05)

## PLAN
- Goal: Given a user message and the conversation's current known
  state, call Gemini (via task-05's wrapper) to identify the service
  category, propose the category-specific attributes that matter for
  it, and extract whatever attribute values the message actually
  contains — returned as one validated, structured result. This task
  produces that result; it does not merge it into `ConversationState`
  (that's Task 07).
- Inputs: `backend/src/llm/geminiClient.ts` (Task 05's
  `generateStructuredJson`), `backend/src/domain/conversation.ts`
  (Task 03's `ConversationState`, read-only — used to build prompt
  context, not modified).
- Outputs:
  - `ExtractionResultSchema` (Zod) and its inferred type, shaped as:
    ```
    {
      serviceCategory: string | null;   // LLM's identified category,
                                          // or null if genuinely unclear
      coreAttributes: {
        dateTime: string | null;         // null = not mentioned this turn
        location: string | null;
      };
      categoryAttributes: Array<{
        name: string;                    // short slug, e.g. "waterSlide"
        description: string;             // e.g. "whether a water slide is wanted"
        importance: "required" | "optional";
        value: string | null;            // null = relevant, not mentioned this turn
      }>;
    }
    ```
    An array (not a record) for `categoryAttributes` — more reliable
    for LLM structured generation than a dynamic-key object; Task 07
    converts it into the `Record<string, CategoryAttributeSlot>` shape
    `ConversationState` uses.
  - `extractRequirements({ message, state, generate? }):
    Promise<ExtractionResult>` — builds a prompt from the user's
    message plus the current state (known category, known core
    attributes, known category attributes and which are still
    unanswered), calls `generateStructuredJson` with
    `ExtractionResultSchema`, and returns the validated result.
    `generate` is an optional injected function (defaulting to a real
    wired-up call), matching Task 05's dependency-injection pattern,
    so tests don't need to mock modules or hit the network.
- Constraints:
  - No merging into `ConversationState` — this task only produces the
    candidate `ExtractionResult`. Task 07 owns applying it to state.
  - No process-level category-attribute cache (deferred per D6's
    refinement to a later task) — every call that doesn't yet know the
    category's attributes asks the LLM fresh. This doesn't change
    correctness, only cost, and is explicitly out of scope here.
  - **This function never decides what's missing or what to ask
    next — that responsibility belongs entirely to Task 07 (merge)
    and the future M4 (readiness gate / question selection), by
    comparing this function's output against existing
    `ConversationState`.** Passing the current state into the prompt
    here is only for *extraction coherence* across turns (e.g.
    correctly interpreting a short reply like "yes" or "the 15th" in
    context, and not re-deriving a wildly different attribute list
    each turn) — it is not how "don't ask what's already known" gets
    enforced. That guarantee is deterministic, lives in Task 07/M4,
    and must hold even if this prompt were stripped of all state
    context. Worth a test asserting the returned `value` reflects
    only what's in the current message, not a state-derived guess.
  - No live network calls in the automated test suite — same
    convention as Task 05.
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT
- Assignment requirement: Part 1, items 1–3 — "Identify the type of
  service being requested," "Determine which attributes are important
  for selecting that particular service," "Identify what information
  is already known from the conversation." This task is the LLM call
  that does exactly those three things in one pass.
- Source: Home Assignment PDF, Part 1 ("The system should..."), page
  2.
- Rationale: The assignment explicitly permits using an LLM for this
  ("You can use an LLM to dynamically determine the questions") and
  explicitly requires the attribute set to be determined dynamically
  per service rather than from a static form — this task is where
  that dynamic reasoning happens, on top of Task 05's validated-call
  plumbing.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/llm/extraction.ts`,
  `backend/src/llm/extraction.test.ts`
- MODIFY: none
- DO NOT TOUCH: `backend/src/domain/`, `backend/src/store/`,
  `backend/src/llm/geminiClient.ts`, `backend/src/server.ts`,
  `backend/src/index.ts`, `DESIGN.md`, `docs/`, `.claude/`

### Implementation Notes
- Prompt construction is a plain string-builder function, not a
  templating dependency — no new library for this.
- Keep this to the schema + prompt builder + one call function — no
  retry/fallback logic (same reasoning as Task 05: nothing to design
  around yet).

## VALIDATE
### Unit Tests
- [ ] Given a fake `generate` returning a valid extraction (category
      identified, some attributes with values, some `null`),
      `extractRequirements` returns the parsed, validated result.
- [ ] Given a fake `generate` returning JSON that fails
      `ExtractionResultSchema` (e.g. an attribute missing
      `importance`), the error from Task 05's wrapper propagates
      clearly.
- [ ] The prompt passed to `generate` includes the current state's
      already-known category/attributes when the state has them (i.e.
      the extraction call is demonstrably state-aware, not just the
      raw user message in isolation) — this is for extraction
      coherence, not missing-attribute logic (see Constraints).
- [ ] Given a fake `generate` whose response omits a value for an
      attribute (returns `null`) despite that attribute already
      having a known value in the supplied state, `extractRequirements`
      returns that `null` as-is rather than backfilling from state —
      confirms this function reports only what's in the current
      message and leaves reconciliation with existing state to
      Task 07.

### Component / Integration Tests
- [ ] N/A — covered by Task 05's manual real-API check; this task
      reuses that wrapper rather than re-verifying it.

### E2E Tests
- [ ] N/A.

### Success Criteria
- [ ] `npm run build` (backend) succeeds with no TypeScript errors.
- [ ] `npm test` (backend) passes, including the new extraction
      tests, with no live network calls.
- [ ] No unrelated files modified.

## ITERATE
### Outcome
- Created `backend/src/llm/extraction.ts` exporting
  `ExtractionResultSchema`/`ExtractionResult` (array-shaped
  `categoryAttributes`, as specified) and
  `extractRequirements({ message, state, generate? }): Promise<ExtractionResult>`.
  `generate` is typed as a narrow, schema-specific function shape
  (`GenerateExtractionFn`) rather than the fully generic
  `typeof generateStructuredJson`, so test fakes can be simple
  concrete functions; it defaults to the real
  `generateStructuredJson` from Task 05, satisfying the DI
  requirement without needing `as` casts at the default-value site.
- `buildPrompt`/`formatKnownState` are plain string builders (no
  templating dependency) that describe the current known service
  category, core attributes, and category attributes (with which are
  answered vs. not) for extraction coherence, plus the latest user
  message. The system instruction explicitly tells the model to
  return `null` for any value not stated in the *current* message,
  even if state already has a value — no backfill-from-state
  instruction leakage into the model's output.
- Created `backend/src/llm/extraction.test.ts`, 4 tests, all against
  injected fakes (no live network calls):
  - valid response passes through as the typed result;
  - a response that fails `ExtractionResultSchema` (missing
    `importance`/`value` on an attribute) propagates
    `GeminiValidationError` — done by injecting a fake Gemini SDK
    `client` into the *real* `generateStructuredJson` and using that
    as `generate`, so this genuinely exercises Task 05's real
    validation path rather than reimplementing it in the test;
  - the prompt passed to `generate` is asserted to contain known
    state (category, location, existing category attribute name) —
    confirms state-awareness for coherence;
  - a fake response with `value: null` for an attribute that already
    has a known value in the supplied state is returned as `null`
    unchanged — confirms no state-derived backfill happens inside
    this function, per the task's explicit constraint that
    missing-attribute reconciliation belongs entirely to Task 07/M4.
- `npm run build` (backend): clean, no TypeScript errors.
- `npm test` (backend): 21/21 passing (5 test files) — no live
  network calls. Component/integration: N/A per task scope, reusing
  Task 05's manual real-API check rather than re-verifying the
  wrapper.
- No unrelated files modified — only
  `backend/src/llm/extraction.ts` and
  `backend/src/llm/extraction.test.ts` created;
  `backend/src/domain/`, `backend/src/store/`,
  `backend/src/llm/geminiClient.ts`, and server/index files untouched.

### Knowledge Updates
- No architectural decisions changed; this task implements exactly
  what D5/D6 already specified (LLM proposes, deterministic code
  reconciles — reconciliation is explicitly deferred to Task 07).
- Confirmed a practical pattern for future LLM-reasoning tasks that
  reuse Task 05's wrapper: give the injected `generate` parameter a
  schema-specific function type (not the fully generic
  `typeof generateStructuredJson`) so test doubles stay simple, while
  still defaulting to the real generic function (which is assignable
  to the narrower type). Worth reusing for M4/M8/M10/M11's LLM calls.

### Follow-ups
- None new. Task-07 (merge extraction into `ConversationState`) is
  the next consumer of `extractRequirements`.
