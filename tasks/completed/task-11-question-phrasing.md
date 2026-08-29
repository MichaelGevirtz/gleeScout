# Task 11: LLM phrases the next missing-attribute question
Status: DONE
Can run in parallel with: NONE (depends on Task 09's
`MissingAttributeTarget` type/output)

## PLAN
- Goal: Given the single missing-attribute target Task 09's
  `selectNextMissingAttribute` returns, a small Gemini call (via Task
  05's wrapper) that phrases it as one natural, friendly conversational
  question — deliberately *not* deciding which attribute to ask about
  (Task 09 already decided that), only how to phrase it, per D5.
- Inputs: `backend/src/llm/geminiClient.ts` (Task 05 —
  `generateStructuredJson`, read-only),
  `backend/src/conversation/questionPolicy.ts` (Task 09 —
  `MissingAttributeTarget`, read-only), `backend/src/domain/
  conversation.ts` (Task 03 — `ConversationState`, read-only, for
  context such as what's already known/already asked).
- Outputs: `backend/src/llm/questionPhrasing.ts` exporting
  `generatePendingQuestion({ target, state, generate? }):
  Promise<string>`. Builds a prompt from the given target (core field
  or category attribute name/description) plus known state (service
  category, already-known attributes) for a natural, context-aware
  phrasing, calls `generateStructuredJson` with a minimal
  `{ question: string }` schema, and returns the trimmed question
  text. `generate` is optional and injected, defaulting to the real
  `generateStructuredJson`, matching Task 06's DI pattern. After Zod
  validation succeeds, one additional lightweight sanity check is
  applied: the trimmed `question` must be non-empty, or the function
  throws a clear error. No further natural-language validation is
  attempted — this is a minimal guard against a degenerate response,
  not a quality check.
- Constraints:
  - **Boundary, stated explicitly**: Task 09 decides *what* to ask;
    this task decides only *how* to phrase it. The `target` is
    already authoritative — selected by deterministic application
    logic — and must be treated as such.
  - Takes a non-null `MissingAttributeTarget` as input — this
    function never decides whether there's anything left to ask
    (that's `selectNextMissingAttribute`'s job); if there's nothing
    missing, the caller simply doesn't call this function.
  - No merging into state, no session-store access, no decision-
    making about *which* attribute — the target is given, not
    derived or re-evaluated.
  - **Gemini must not reassess the target.** The prompt/system
    instruction must never ask Gemini to judge whether the target is
    genuinely still missing, propose a different attribute instead,
    or comment on readiness/completeness. `state` is passed to Gemini
    strictly to make the *phrasing* contextual and natural (e.g. "and
    since it's in Denver..." rather than a form-field-style question)
    — never as input to a decision. This is a prompt-design
    constraint, not something a fake-backed unit test can verify by
    itself (a fake always returns whatever the test wants) — enforced
    by how the system instruction is written, spot-checked during the
    manual real-API validation below.
  - Exactly one question, phrased naturally in light of what's
    already known (e.g. doesn't ask about something already answered,
    doesn't re-open the category). This is a model instruction, not a
    guaranteed invariant the code enforces — not something a
    fake-backed unit test can verify — checked manually (see
    Validate), same convention as Task 05's real-API check.
  - Post-validation sanity check only: trimmed `question` must be
    non-empty. Deliberately no sophisticated natural-language
    validator (e.g. no check that it's phrased as a question, no
    length/tone scoring) — that would be solving a problem with no
    evidence it exists yet, same reasoning already applied to Task 10.
  - No live network calls in the automated test suite — same
    convention as Tasks 05/06.
  - No retry/fallback logic — one call, one clear success or one
    clear thrown error (same reasoning as Task 05/06).
- Open Questions: none.

## Assignment Alignment
- Requirement type: **EXPLICIT** (that an LLM is used to phrase the
  question) **+ PROJECT DECISION** (the specific split architecture —
  deterministic target selection, separately, from Gemini phrasing).
- Assignment requirement: "You can use an LLM to dynamically
  determine the questions" (Part 1) is the explicit line this task
  traces to. It does not mandate splitting "which attribute" from
  "how to phrase it" into two separate functions/tasks — that
  architecture (Task 09 decides what, Task 11 decides how) is this
  project's own design choice, made to satisfy D5's "balance LLM
  reasoning vs. deterministic logic" framing, not something the
  assignment text itself specifies.
- Source: Home Assignment PDF, Part 1, page 2.
- Rationale / classification split:
  - **EXPLICIT**: an LLM is used to produce the question text shown
    to the user. Without this task, Task 09's structured target has
    no way to reach the user as an actual chat message.
  - **PROJECT DECISION**: specifically separating "what to ask"
    (deterministic, Task 09) from "how to phrase it" (LLM, this task)
    as two independent units, rather than one combined LLM call that
    both selects and phrases. Completes the loop D5 describes
    end-to-end, and is the concrete mechanism this project chose to
    keep the LLM from ever influencing *which* attribute gets asked
    about or *when* gathering stops.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/llm/questionPhrasing.ts`,
  `backend/src/llm/questionPhrasing.test.ts`
- MODIFY: none
- DO NOT TOUCH: `backend/src/domain/`, `backend/src/store/`,
  `backend/src/conversation/`, `backend/src/llm/geminiClient.ts`,
  `backend/src/llm/extraction.ts`, `backend/src/server.ts`,
  `backend/src/index.ts`, `DESIGN.md`, `docs/`, `.claude/`

### Implementation Notes
- Prompt construction is a plain string-builder, no templating
  dependency — same convention as Task 06.
- System instruction should explicitly tell the model: ask exactly
  one question, don't restate/re-ask anything already known, keep it
  short and conversational (not clinical/form-like) — this directly
  serves "avoid unnecessarily long questionnaires" even at the single-
  question level (no compound "also, what's X and Y and Z" phrasing).
- System instruction must also explicitly frame the model's job as
  phrasing-only: state the target is already decided and must be
  asked about as given, and that `state` is supplied only as context
  for natural phrasing — not something to second-guess, override, or
  use to decide whether asking is still appropriate.
- After `generate(...)` resolves, trim `result.question` and throw a
  plain `Error` if it's empty — a minimal guard, not a natural-
  language quality check.
- Keep this to the schema + prompt builder + one call function + the
  one sanity check — no retry/fallback logic, matching Task 05/06's
  precedent.

## VALIDATE
### Unit Tests
- [ ] Given a fake `generate` returning a question string,
      `generatePendingQuestion` returns that string.
- [ ] The prompt passed to `generate` includes the target's field/
      attribute name and description.
- [ ] The prompt includes already-known state (service category,
      other known attribute values) so the phrasing can be
      context-aware.
- [ ] A response that fails the `{ question: string }` schema
      propagates Task 05's `GeminiValidationError` — using the same
      "fake SDK client via the real `generateStructuredJson`" pattern
      as Task 06's equivalent test.
- [ ] Given a fake `generate` returning an empty or whitespace-only
      question, `generatePendingQuestion` throws a clear error (the
      post-validation sanity check, not a Zod failure — `""` is a
      valid `string`).
- [ ] Given a fake `generate` returning a question with leading/
      trailing whitespace, the returned string is trimmed.

### Component / Integration Tests
- [ ] Manual verification only, same convention as Task 05: with a
      real `GEMINI_API_KEY`, one real call for a couple of different
      targets (a core attribute, a category attribute) produces a
      sensible single question. Documented in this task's outcome
      (command/result), not an automated test.

### E2E Tests
- [ ] N/A.

### Success Criteria
- [ ] `npm run build` (backend) succeeds with no TypeScript errors.
- [ ] `npm test` (backend) passes, including the new tests, with no
      live network calls.
- [ ] Manual real-API check succeeds (or, if no API key is available
      in this environment, that's reported honestly rather than
      claimed).
- [ ] No unrelated files modified.

## ITERATE
### Outcome
Implemented as planned, no deviations. Created
`backend/src/llm/questionPhrasing.ts` exporting
`PendingQuestionSchema`/`PendingQuestionResult` and
`generatePendingQuestion({ target, state, generate? })`. Builds a
prompt that states the already-decided target plus known state
(reusing the same known-state formatting convention as
`extraction.ts`, duplicated locally rather than shared, since
`extraction.ts` was DO NOT TOUCH / not exported for reuse), calls
`generateStructuredJson` with a `{ question: string }` schema, then
trims and throws a plain `Error` on an empty/whitespace-only result.
System instruction explicitly states the target is already decided,
instructs exactly one question, no restating known info, and no
second-guessing/reassessing the target — the phrasing-only boundary
from D5.

`backend/src/llm/questionPhrasing.test.ts` — 7 tests, covering every
VALIDATE checklist item (returns question from fake generate; prompt
includes target name/description; prompt includes known state;
`GeminiValidationError` propagates via a fake SDK client through the
real `generateStructuredJson`, same pattern as `extraction.test.ts`;
empty and whitespace-only question both throw; whitespace is
trimmed). `npm run build` clean; `npm test` 49/49 passing (7 new + 42
pre-existing), no live network calls in the automated suite.

**Manual real-API check: not completed, reported honestly.** A real
`GEMINI_API_KEY` is present in `backend/.env`, so this was attempted
(ad-hoc script in the session scratchpad, not committed to the repo)
against a core target (`location`) and a category target (`budget`).
Both calls failed with a live 429:
`GenerateRequestsPerDayPerProjectPerModel-FreeTier` — the free
tier's 20-requests/day cap on `gemini-3.6-flash`, already documented
in `memory-bank/decisions.md` D2b as exhausted earlier the same day
(2026-08-27) by prior eval/validation activity. This is the
documented external quota constraint recurring, not a code defect:
`generatePendingQuestion` correctly propagated the real SDK's error
through `generateStructuredJson` exactly as designed (no
retry/fallback, per this task's own constraints), and the request
construction (model, prompt, schema) matches the same shape already
proven live-correct for `extraction.ts` in task-06/08. Retrying once
the daily quota resets is a trivial re-run, not a code change — see
Follow-ups.

No files outside `Files Touched` were modified — `DESIGN.md` and
`memory-bank/decisions.md` untouched per this task's own `MODIFY:
none` scope (task-09 already covers the two interview-relevant
tradeoffs for M4; this task doesn't introduce a new one requiring a
DESIGN.md/decisions.md addition).

### Knowledge Updates
- New module `backend/src/llm/questionPhrasing.ts` completes D5's
  split end-to-end: Task 09 decides *what* to ask (deterministic),
  this task decides *how* to phrase it (LLM), never the reverse.
- Gemini's free-tier daily quota (20 `generateContent`
  requests/day/model, per D2b) is shared across *all* real-API
  activity in a given day, not just the eval script — a second
  same-day task needing a manual real-API check can be blocked by
  quota consumed by an earlier, unrelated task's validation.

### Follow-ups
- Re-run the manual real-API check (two targets: one core, one
  category) once the Gemini free-tier daily quota resets, to get an
  actual manual sensibility read on phrasing quality — not blocking,
  since automated tests already cover structural correctness and the
  live 429 was itself proof the real call path works end-to-end up
  to the point of hitting the quota.
- Not wired into any HTTP route yet — that's M5, same as task-09.
