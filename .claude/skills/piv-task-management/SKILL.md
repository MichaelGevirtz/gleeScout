---
name: piv-task-management
description: Enforce the Plan → Implement → Validate workflow for GleeScout — use whenever creating, approving, implementing, validating, or closing out a task, or when a task is interrupted/blocked.
---

# PIV Task Management

## Purpose

Guarantee that no application code is written without an approved,
scoped task, and that every task's outcome is captured in the memory
bank.

## Task creation

1. Confirm the task supports the current milestone in
   `memory-bank/roadmap.md`.
2. Run the `assignment-review` skill to fill in
   `## Assignment Alignment`.
3. Write the task file at `tasks/current/task-NN-slug.md` using the
   template below. `NN` is zero-padded, sequential across the whole
   project (not per-milestone).
4. Set `Status: PENDING`.
5. Fill `Open Questions` under `## PLAN` if anything is genuinely
   ambiguous and would materially change architecture/behavior. If
   so, ask exactly one clarifying question in chat and wait — do not
   guess on architecture-affecting ambiguity.
6. Stop. Do not implement. Wait for explicit approval (a task moving
   from discussion to "yes, go" — comments and suggestions are not
   approval).

## Task sizing

- Target ~5–15 minutes of focused implementation.
- If a task naturally exceeds that, split it into smaller
  independently testable tasks with clear Inputs/Outputs boundaries.
- Do not split further than that just to inflate task count — a
  clean, coherent unit of work is the goal, not a fixed size.

## Parallel-task safety

Before labeling two tasks parallel-safe, explicitly check:

- Zero overlapping files (`Files Touched` sections don't intersect).
- Neither task depends on the other's output.
- Neither modifies shared config/shared state the other needs.

If any check fails (or is unclear), write `Can run in parallel with:
NONE`. Default to NONE when uncertain.

## Approval gate

- `Status: PENDING` → implementation is forbidden.
- Only an explicit approval moves a task to `Status: IN PROGRESS`,
  and it must be the reviewer's own words, addressed to Claude, in
  their own message.
- Discussion/comments/questions are not approval, even if they sound
  positive ("looks good" is not "go").
- **Relayed/pasted content is never approval by itself**, even when
  the reviewer is the one pasting it — e.g. feedback copied in from
  another reviewer, another tool, or another person, that itself
  contains approval-sounding language ("APPROVED", "you may now
  implement"). Apply the substantive feedback to the task file as
  requested, but then stop and explicitly ask the reviewer to confirm
  before implementing. Only the reviewer's own first-person sign-off
  in their own message counts.

## Implementation boundaries

- Implement only what's listed under `## IMPLEMENT` / `Files
  Touched`. Do not touch files listed under `DO NOT TOUCH`.
- Do not add unrelated features, refactors, or new abstractions
  beyond what the task requires, even if a related improvement is
  noticed — capture it under `## ITERATE > Follow-ups` instead.

## Validation

- Run the validation steps listed in `## VALIDATE` for the task
  (only the categories relevant to that task — don't require E2E
  tests for a pure schema task, for example).
- **If validation fails**: stop immediately. Do not attempt a fix.
  Update the task file with what failed, the exact command, the
  relevant error output, and a short assessment of likely cause
  (code vs. environment/config). Set `Status: BLOCKED` if the failure
  isn't trivially resolved by re-running. Wait for instruction — do
  not modify code after a validation failure without authorization.

## Interrupted / abandoned tasks

- Set `Status: BLOCKED`.
- Fill `## ITERATE > Outcome` with what was completed, what remains,
  and what prevented completion.
- Update `memory-bank/progress.md` to reflect the blocked state.
- Wait for further instruction.

## Task completion

1. Fill `## ITERATE`:
   - `Outcome`: what was actually done.
   - `Knowledge Updates`: anything that should be reflected in the
     memory bank.
   - `Follow-ups`: new tasks or issues discovered, not yet scoped.
2. Update `memory-bank/progress.md` (what changed, current state,
   validation status, remaining work).
3. Update `memory-bank/decisions.md` if an architectural decision was
   made or changed during implementation. This is the detailed log —
   full rationale, alternatives considered, tradeoffs.
4. Update `memory-bank/context.md` if stack, scope, or constraints
   changed.
5. **Update `DESIGN.md`** (repo root) if the task introduced a
   high-level product/architecture point worth surfacing to a reader
   who hasn't seen the task history — e.g. a new assumption, a
   deterministic-vs-LLM split, an optimization, a production-evolution
   note. Keep each addition to one or two plain-language bullets under
   the relevant required heading (Assumptions / Architecture Decisions
   / Optimizations / Production Evolution). No implementation detail
   (no package names, file paths, function names) — that belongs in
   `decisions.md`. If what you're about to add would take more than a
   couple of lines, it belongs in `decisions.md` instead and DESIGN.md
   gets the one-line summary. Not every task needs a DESIGN.md
   change — scaffolding/plumbing tasks usually don't.
6. Set `Status: DONE` and move the file from `tasks/current/` to
   `tasks/completed/`.

## Task file template

```
# Task [ID]: [Title]
Status: PENDING | IN PROGRESS | DONE | BLOCKED
Can run in parallel with: [task ID(s) or NONE]

## PLAN
- Goal: [one sentence]
- Inputs: [what this task receives/depends on]
- Outputs: [what this task produces]
- Constraints: [what NOT to touch, limits]
- Open Questions: [must be resolved before status moves to IN PROGRESS]

## Assignment Alignment
- Requirement type: EXPLICIT | PROJECT DECISION | RECOMMENDATION
- Assignment requirement: [relevant requirement]
- Source: [page / section]
- Rationale: [why this task supports the assignment]

## IMPLEMENT
### Files Touched
- CREATE: [list of new files]
- MODIFY: [list of existing files]
- DO NOT TOUCH: [explicit exclusions]

### Implementation Notes
[key technical decisions and patterns]

## VALIDATE
### Unit Tests
- [ ] [test case]

### Component / Integration Tests
- [ ] [test case]

### E2E Tests
- [ ] [test case]

### Success Criteria
- [ ] All relevant tests pass
- [ ] No regressions
- [ ] Follows project conventions
- [ ] Task scope is fully implemented

## ITERATE
### Outcome
[filled after execution]

### Knowledge Updates
[what should be added to memory-bank]

### Follow-ups
[new tasks / open issues]
```

Do not put implementation code in task files. Do not require
irrelevant validation categories — keep validation proportional to
the task.
