---
name: ui-ux-design
description: Produce three substantially different UI/UX concepts for the GleeScout conversation + recommendation flow before any frontend code is written, present them, and stop for selection.
---

# UI/UX Design

## Purpose

Prevent frontend implementation from starting before a deliberate UX
direction is chosen. Assignment evaluation criterion "Taste" depends
on this being a real design decision, not a default chat-bubble UI.

## When to use this skill

- Once the backend conversation + recommendation flow (roughly
  through M12 in `memory-bank/roadmap.md`) is stable enough that the
  frontend's data needs are known.
- Before creating any `tasks/current/` task that touches
  `frontend/`.
- Again if the selected direction needs revisiting after review.

## Procedure

1. Re-read Part 1 and Part 6 of `docs/Home Assignment.pdf` plus the
   example provider card, so the concepts are grounded in what the
   assignment actually asks the UI to convey.
2. Produce **exactly three** concepts that differ in interaction
   model, information hierarchy, and user flow — not merely visual
   styling (color/typography differences alone are not a valid third
   concept).
3. For each concept, write:
   1. Name
   2. Core UX concept (one paragraph)
   3. Primary user flow (step list)
   4. Main screens
   5. Information hierarchy (what's primary/secondary/hidden-by-default)
   6. Conversation interaction model (e.g. chat thread vs. guided
      stepper vs. hybrid)
   7. How requirements/state are represented to the user (e.g. a
      progress checklist, an inline summary, nothing visible)
   8. How provider recommendations are presented (list, cards,
      comparison table, swipe deck, etc.)
   9. How FACT / INFERRED / SIMULATED are visually distinguished
   10. How provider-specific questions (Part 4) are presented
   11. Advantages
   12. Disadvantages
   13. Assignment requirements supported (map to Parts 1–6)
   14. UX risks
   15. Implementation complexity (Low/Medium/High, with why)
4. Present all three concepts together for comparison.
5. **STOP.** Do not write any frontend code. Wait for the reviewer to
   select one, request changes, ask for a combination, or request a
   new option.
6. Once a direction is selected (or a hybrid is specified), write a
   detailed spec: screens, components, navigation, interaction/empty/
   loading/error states, and the exact data each screen needs from
   the backend API. Run this spec through `assignment-review` before
   any frontend task is created.
7. Only after the spec exists should `tasks/current/` frontend tasks
   be created, following `piv-task-management`.

## Stop condition

Never generate frontend implementation tasks or code as part of this
skill's own execution — its output is design concepts (step 3–4) or,
after selection, a spec (step 6). Implementation is always a separate,
explicitly approved task.
