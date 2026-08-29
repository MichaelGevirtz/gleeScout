# Task 09: Deterministic missing-attribute selection + readiness gate
Status: DONE
Can run in parallel with: Task 10 (zero file overlap — Task 10 touches
`store/categoryAttributeCache.ts` + `llm/extraction.ts`; neither task
depends on the other's output)

## PLAN
- Goal: A pure, deterministic function pair that reads
  `ConversationState` and decides (a) which single missing attribute
  is worth asking about next, if any, and (b) whether the
  conversation now has enough information to move `phase` from
  `"gathering"` to `"ready_for_search"`. No LLM call, no I/O — same
  testable-from-fixtures pattern as `mergeExtraction` (Task 07). This
  is the deterministic half of M4 ("Dynamic question policy") — the
  concrete mechanism that enforces "ask only the important missing
  questions" and "avoid unnecessarily long questionnaires."
- Inputs: `backend/src/domain/conversation.ts` (Task 03 —
  `ConversationState`, `CategoryAttributeSlot`, read-only). Reads the
  shape of state that Task 07's `mergeExtraction` produces, but does
  not import or call `mergeExtraction` itself.
- Outputs: `backend/src/conversation/questionPolicy.ts` exporting:
  - `selectNextMissingAttribute(state): MissingAttributeTarget | null`
    — a discriminated union identifying either a missing core
    attribute (`{ kind: "core", field: "dateTime" | "location" }`) or
    a missing required category attribute (`{ kind: "category", name,
    description, importance }`), or `null` if nothing important is
    missing.
  - `isReadyForSearch(state): boolean` — answers **"should the
    application stop gathering and proceed to research,"** not "is
    all required information known." These are different questions.
    Returns `true` via either of two independent paths:
    (a) **complete**: core attributes and all *required* category
    attributes are known; or
    (b) **fallback**: a fixed turn-count cap has been reached, and the
    application deliberately proceeds with a best-effort search on
    incomplete information rather than gathering forever.
    Path (b) is not a claim of completeness — a caller that needs to
    know which path fired should inspect `selectNextMissingAttribute`
    itself (non-null return means something is still genuinely
    missing even though `isReadyForSearch` said to proceed), not infer
    it from `isReadyForSearch`'s boolean alone. No new
    `ConversationPhase` value is introduced for this distinction —
    `phase` stays the existing binary `"gathering"` /
    `"ready_for_search"` from Task 03; this function only decides
    *when* to make that existing transition, on two independent
    grounds, not what value `phase` takes.
  - A `DESIGN.md` bullet (Architecture Decisions section) and a new
    `memory-bank/decisions.md` entry documenting **two** tradeoffs
    explicitly for interview articulation:
    1. **Fixed selection ordering**: why deterministic ordering was
       chosen over an LLM- or signal-informed priority
       (explainability/reproducibility — a fixed rule is trivially
       inspectable and testable, and keeps the LLM out of
       conversation-flow control per D5, at zero extra LLM cost),
       what flexibility is sacrificed (no context-sensitive
       reprioritization — e.g. can't bump budget ahead of location
       just because the user emphasized cost; no adaptive read of
       user hesitation/reluctance on a specific question;
       insertion-order tie-break among same-importance attributes
       isn't necessarily "most valuable to ask first"), and how this
       could evolve in production (an LLM- or analytics-informed
       priority *score* per missing attribute feeding a still-
       deterministic ranking function — preserving D5's split rather
       than handing ordering to the LLM outright; or drop-off-informed
       reordering once there's real usage data on which questions
       cause users to abandon the conversation).
    2. **The readiness-gate's two-path definition and turn-cap
       fallback**: why "ready to proceed" is deliberately *not*
       synonymous with "complete," and why a fallback exists at all —
       specifically to prevent an endless conversation when a
       required attribute can never be obtained from the user (they
       don't know it, won't answer it, etc.). Without this fallback, a
       single stuck required attribute could trap a session in
       `"gathering"` indefinitely. Document this as a deliberate
       best-effort tradeoff (proceed with a gap rather than never
       proceed), not an oversight.

  Selection policy (this is the substantive design of this task, not
  incidental detail):
  - Check order: `dateTime` → `location` → category attributes in
    the order they appear in `categoryAttributes`, required-importance
    attributes only. First missing one found is returned.
  - **Optional category attributes are never proactively selected**
    by this function, even if they're the only thing missing. They
    can still end up filled if the user volunteers the info
    unprompted (extraction/merge already handles that) — this
    function just never asks about them. This is the concrete answer
    to the assignment's own DESIGN.md prompt "How do you decide which
    questions are required versus optional?" (page 5) and directly
    implements "avoid unnecessarily long questionnaires" (Part 1,
    item 5).
  - `isReadyForSearch`'s two-path definition directly answers the
    assignment's own DESIGN.md prompt "What constitutes enough
    information to begin searching?" (page 5): the honest answer is
    "either genuinely enough, or a deliberate decision to proceed with
    what we have rather than gather forever." The turn-cap path exists
    specifically to prevent an endless conversation when a required
    attribute can never be obtained — without it, one stuck required
    attribute could trap a session in `"gathering"` indefinitely.
- Constraints:
  - No LLM call — purely deterministic, per D5 (the app, not the
    LLM, decides which attributes are asked about and when the
    conversation is ready).
  - Does not mutate the input `state` (read-only; trivially true
    since nothing is written, but verified by a test anyway for
    consistency with Task 07's convention).
  - Does not merge, phrase questions, or call `mergeExtraction` —
    this function only decides *what's* missing and *whether* to
    stop gathering, never *how to ask* (that's a later task) or *how
    state got here* (Task 07's job).
  - No process-level category-attribute cache — considered and
    deferred (see D6), not part of this task.
  - Not wired into any HTTP route — that's M5.
  - Does not add a new `ConversationPhase` value or otherwise modify
    `backend/src/domain/conversation.ts` — `isReadyForSearch`'s
    two-path (complete / fallback) definition is entirely internal to
    this function's own logic and return semantics, not a new state
    field. The existing binary phase enum from Task 03 is untouched.
- Open Questions: none. The turn-count cap value and the
  required-only selection policy are reversible implementation
  constants, not architecture-changing — documented as assumptions
  above and in Implementation Notes below rather than blocking on
  pre-approval.

## Assignment Alignment
- Requirement type: **EXPLICIT** (the general behavior this task must
  produce) **+ PROJECT DECISION** (the specific mechanism it uses to
  produce it) — both apply, to different parts of this task, and that
  split is deliberate and documented rather than glossed over.
- Assignment requirement: Part 1, items 4–5 — "Ask only the important
  missing questions" and "Avoid unnecessarily long questionnaires" —
  plus the readiness half is implied by Part 2's opening line, "Once
  enough information has been collected, find real service
  providers..." These require *that* the system behave this way; they
  do not prescribe *how*. The assignment's own DESIGN.md section
  explicitly leaves the "how" open, asking it to be documented as an
  assumption instead (page 5): "How do you decide which questions are
  required versus optional?" and "What constitutes enough information
  to begin searching?"
- Source: Home Assignment PDF, Part 1 (page 2), Part 2 opening (page
  2), DESIGN.md prompts (page 5).
- Rationale / classification split:
  - **EXPLICIT**: that the system asks only important missing
    questions, avoids long questionnaires, and eventually proceeds to
    research once enough is gathered. Tasks 06/07 produce and merge
    the raw material, but both explicitly deferred "what's missing"
    and "are we done" to "a later task" (task-06's Constraints,
    task-07's `phase` note) — this is that task, the first place
    anything in the system actually enforces these two explicit
    behavioral requirements.
  - **PROJECT DECISION**: the specific fixed check order (`dateTime`
    → `location` → required category attributes in insertion order)
    and the specific turn-count-cap fallback mechanism behind
    `isReadyForSearch`. The assignment leaves both open; this task
    picks concrete, simple, explainable defaults over a more adaptive
    (LLM- or signal-informed) mechanism — that tradeoff is documented
    in `DESIGN.md`/`decisions.md` per the Outputs section above.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/conversation/questionPolicy.ts`,
  `backend/src/conversation/questionPolicy.test.ts`
- MODIFY: `DESIGN.md`, `memory-bank/decisions.md` (see Outputs above
  — a documented, not-optional deliverable of this task, not a
  discretionary completion-step judgment call)
- DO NOT TOUCH: `backend/src/domain/`, `backend/src/llm/`,
  `backend/src/store/`, `backend/src/conversation/mergeExtraction.ts`,
  `backend/src/server.ts`, `backend/src/index.ts`, `docs/`, `.claude/`

### Implementation Notes
- Category-attribute iteration order follows `Object.entries` /
  `Object.keys` insertion order on `state.categoryAttributes` — a
  fixed, simple, deterministic tie-break, not something requiring
  further configuration.
- Turn count = number of `messages` entries with `role: "user"`.
  Turn-count cap is a single named constant in this file (e.g.
  `MAX_GATHERING_TURNS`) — not an env var; this is a behavioral
  policy default, not deployment config.
- Keep this to the two functions plus the `MissingAttributeTarget`
  type — no generic "policy engine" abstraction; the rule set is
  small and specific enough that a configurable framework would add
  more complexity than it removes.

## VALIDATE
### Unit Tests
- [ ] `selectNextMissingAttribute` returns the core `dateTime` target
      when both core attributes are unset and no category attributes
      exist yet.
- [ ] Returns the core `location` target once `dateTime` is known but
      `location` isn't.
- [ ] Once both core attributes are known, returns a missing
      *required* category attribute.
- [ ] A missing *optional* category attribute is never returned, even
      when it's the only thing missing.
- [ ] Returns `null` once core attributes and all required category
      attributes are known (regardless of missing optional ones).
- [ ] `isReadyForSearch` returns `false` while a core attribute or a
      required category attribute is still missing and the turn
      count is under the cap.
- [ ] `isReadyForSearch` returns `true` (complete path) once core
      attributes and all required category attributes are known.
- [ ] `isReadyForSearch` returns `true` (fallback path) once the
      turn-count cap is reached, even with a required attribute still
      missing — and `selectNextMissingAttribute` on that same state
      still correctly returns non-null, confirming the two functions
      don't contradict each other (ready-to-proceed ≠ nothing missing).
- [ ] Neither function mutates the input `state`.

### Component / Integration Tests
- [ ] N/A — pure functions, fully covered by unit tests (same
      reasoning as Task 07).

### E2E Tests
- [ ] N/A.

### Success Criteria
- [ ] `npm run build` (backend) succeeds with no TypeScript errors.
- [ ] `npm test` (backend) passes, including the new tests.
- [ ] No unrelated files modified.

## ITERATE
### Outcome
Implemented exactly as planned, no deviations. Created
`backend/src/conversation/questionPolicy.ts` exporting
`MissingAttributeTarget`, `selectNextMissingAttribute`, and
`isReadyForSearch` (with `MAX_GATHERING_TURNS = 8` as a named
constant). Both functions are pure, read-only, no LLM call. Added
`backend/src/conversation/questionPolicy.test.ts` with 11 tests
covering every VALIDATE checklist item (core `dateTime`/`location`
selection, required-category selection, optional-never-selected,
null-when-complete, both `isReadyForSearch` false cases, both true
paths (complete + fallback) with the non-contradiction check against
`selectNextMissingAttribute`, and non-mutation for both functions).
Added the required `DESIGN.md` Architecture Decisions bullets and a
new `memory-bank/decisions.md` D12 entry covering both documented
tradeoffs (fixed selection ordering; two-path readiness gate +
turn-cap fallback). `npm run build` clean; `npm test` 42/42 passing
(11 new + 31 pre-existing). No files outside `Files Touched` were
modified.

### Knowledge Updates
- New module `backend/src/conversation/questionPolicy.ts` is the
  deterministic half of M4 — reads `ConversationState`, no LLM call,
  no I/O, same fixture-testable pattern as `mergeExtraction`.
- `MAX_GATHERING_TURNS = 8` is the turn-count fallback cap, defined
  as a local constant in `questionPolicy.ts` (not an env var).
- D12 added to `memory-bank/decisions.md` documenting the fixed
  selection-order tradeoff and the two-path readiness-gate tradeoff.

### Follow-ups
- M4's other half — actually wiring this into an HTTP route/
  orchestrator and having the LLM phrase the selected question — is
  out of scope here (task-11 covers question phrasing; route wiring
  is M5).
- Per D6/D12, a future production evolution could layer an LLM- or
  analytics-informed priority score on top of the fixed selection
  order without handing ordering to the LLM outright — not needed
  now, no evidence of a concrete problem yet.
