# Task 02: DESIGN.md scaffold and backfill
Status: DONE
Can run in parallel with: NONE

> Approved 2026-08-27 ("exe task-02").

## PLAN
- Goal: Create `DESIGN.md` at the repo root with the assignment's
  required structure, and backfill it with short, high-level bullets
  drawn from the decisions already made (Task 01 + D1–D10 in
  `memory-bank/decisions.md`), establishing the format that every
  future task will append to.
- Inputs: `memory-bank/decisions.md` (D1–D10), `tasks/completed/
  task-01-backend-scaffold.md`, the assignment's DESIGN.md section
  (`docs/Home Assignment.pdf`).
- Outputs: `DESIGN.md` at repo root with four sections — Assumptions,
  Architecture Decisions, Optimizations, Production Evolution — each
  containing short bullets (one line each, no implementation detail).
- Constraints:
  - No new architectural decisions are made in this task — it only
    surfaces decisions that already exist in `decisions.md`/task
    history at a higher level of abstraction.
  - Keep every bullet to roughly one line. If a point needs more than
    that to make sense, it's a sign it should stay in `decisions.md`
    and get a shorter summary here instead.
  - Do not include package names, file paths, or function names.
  - This task does not write README.md — that's separate scope.
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT
- Assignment requirement: "A separate DESIGN.md document covering
  your assumptions, tradeoffs, optimizations and how you would evolve
  the system for production... Please include a separate document
  describing the thinking behind your implementation. We consider
  this an important part of the assignment," with required
  subsections Assumptions / Architecture Decisions / Optimizations /
  Production Evolution.
- Source: Home Assignment PDF, "What We'd Like You to Submit" and
  "DESIGN.md" sections (pages 5–7).
- Rationale: Scaffolding it now (rather than waiting until the end,
  per the user's explicit request) means it grows incrementally and
  accurately alongside the implementation, instead of being
  reconstructed from memory at submission time — directly serving the
  "important part of the assignment" instruction.

## IMPLEMENT
### Files Touched
- CREATE: `DESIGN.md` (repo root)
- MODIFY: none
- DO NOT TOUCH: `memory-bank/decisions.md` (source material, read-only
  for this task), `docs/`, `backend/`, `.claude/`

### Implementation Notes
- Structure: four `##` headings exactly as the assignment names them
  — Assumptions, Architecture Decisions, Optimizations, Production
  Evolution.
- Backfilled content, condensed from what already exists:
  - Assumptions: date/time + location are the only universally
    required attributes; everything else (including budget) is
    determined per-category by the LLM, not hardcoded (from D6).
  - Architecture Decisions: LLM vs. deterministic split (D5), FACT/
    INFERRED/SIMULATED separation (D7), in-memory-only state (D9),
    research provider kept behind a swappable boundary (D3).
  - Optimizations: category-attribute caching per session (D6);
    explicit note that persistence/caching across runs is
    intentionally not implemented, per the assignment's own
    constraints.
  - Production Evolution: left as a short placeholder list for now
    (real content lands once more of the system exists) — not
    fabricated ahead of the actual build.
- Each bullet cites nothing (no D-numbers, no task IDs) — DESIGN.md
  reads as a standalone document for an external reviewer, not as an
  index into our internal process files.

## VALIDATE
### Unit Tests
- [ ] N/A — documentation only.

### Component / Integration Tests
- [ ] N/A.

### E2E Tests
- [ ] N/A.

### Success Criteria
- [ ] `DESIGN.md` exists at repo root with all four required headings.
- [ ] Every bullet is high-level (no package/file/function names).
- [ ] Content accurately reflects decisions already recorded in
      `memory-bank/decisions.md` — nothing new invented.
- [ ] No other files modified.

## ITERATE
### Outcome
Created `DESIGN.md` at repo root with the four required headings
(Assumptions, Architecture Decisions, Optimizations, Production
Evolution), each with short, high-level bullets condensed from
`memory-bank/decisions.md` (D3, D5, D6, D7, D9) and the Task 01
outcome. No new decisions were made — this task only re-expressed
existing ones at a higher level for an external reader. Production
Evolution is a short forward-looking placeholder, as planned, since
most of the system doesn't exist yet.

Also updated `.claude/skills/piv-task-management/SKILL.md` (done in
the prior turn, before this task's approval) to make "update
DESIGN.md with a short high-level bullet, if relevant" a standing
step in every future task's completion checklist, alongside
`progress.md`/`decisions.md`. That's now the mechanism for keeping
DESIGN.md current going forward — no separate DESIGN.md task should
be needed again.

### Knowledge Updates
- `memory-bank/progress.md`: DESIGN.md scaffolded and current as of
  Task 02.
- No changes needed to `decisions.md` or `context.md` — nothing new
  was decided.

### Follow-ups
- Every future task's completion step now includes a DESIGN.md check
  per the updated skill — no dedicated follow-up task needed.
- Production Evolution section will need real content once provider
  research/ranking/simulation exist (naturally covered by future
  tasks' completion steps, not a standalone task).
