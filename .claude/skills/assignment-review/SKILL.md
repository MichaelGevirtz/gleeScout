---
name: assignment-review
description: Validate roadmap items and task files against the actual Home Assignment PDF before approval — use before creating/approving any roadmap milestone or task, and whenever scope might drift from the assignment.
---

# Assignment Review

## Purpose

Keep every piece of planned or implemented work traceable to
`docs/Home Assignment.pdf`, and catch scope drift (missing required
work, or unnecessary work) before it's built.

## When to use this skill

- Before creating the high-level roadmap, and whenever the roadmap is
  materially changed.
- Before creating any task file in `tasks/current/`.
- Before marking a task approved for implementation.
- Whenever a new architectural or product decision is proposed that
  wasn't explicitly discussed against the assignment yet.
- Periodically (e.g. once per milestone) to check for uncovered
  requirements.

## Inputs

- `docs/Home Assignment.pdf` (authoritative — re-read the relevant
  section, don't rely on memory or a prior summary of it).
- The roadmap (`memory-bank/roadmap.md`) or the task file being
  reviewed.

## Procedure

1. **Read the relevant section(s) of the PDF directly.** Do not
   reconstruct assignment text from memory or from a prior summary —
   go back to the source document.
2. **Extract the explicit requirement(s)** the roadmap item / task
   claims to support. Quote or closely paraphrase the assignment
   language and note the Part/section (Part 1–6, Technical
   Expectations, DESIGN.md, Bonus).
3. **Classify** every claim in the roadmap item / task as one of:
   - `EXPLICIT` — directly stated in the assignment.
   - `PROJECT DECISION` — a choice the team made where the assignment
     left the approach open (e.g. stack, Firecrawl, React Native).
   - `RECOMMENDATION` — an inference/best-practice not stated in the
     assignment, included because it materially supports an explicit
     requirement.
   Anything that is none of these is scope creep — flag it.
4. **Check for uncovered requirements**: walk Parts 1–6 and Technical
   Expectations and confirm each has at least one roadmap item. If
   not, surface the gap before continuing.
5. **Check for unnecessary scope**: flag any roadmap item / task that
   exists only because it "would be expected in production" when the
   assignment explicitly says that infrastructure is unnecessary (no
   DB, no auth, no persistence, no deployment).
6. **Check for ambiguity impact**: if the task touches an area the
   assignment leaves open (e.g. "how do you interpret location?"),
   confirm the assumption is written down (task file or
   `DESIGN.md`/`memory-bank/decisions.md`), not silently assumed.
7. **Check for conflicts**: if a `memory-bank/decisions.md` entry
   contradicts the assignment text, surface the conflict explicitly
   rather than proceeding.

## Output

A short alignment note (used to fill the task template's
"## Assignment Alignment" section, or reported inline for roadmap
review):

- Requirement type: EXPLICIT | PROJECT DECISION | RECOMMENDATION
- Assignment requirement quoted/paraphrased
- Source: Part / page
- Rationale
- Any gaps or conflicts found, called out separately

## Stop condition

If a task cannot be traced to an explicit requirement, a necessary
support role for one, or a justified project decision, stop and
raise it rather than approving the task.
