# Task 08: On-demand extraction evaluation script (real Gemini)
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: A small, manual/on-demand script that runs a fixed set of
  realistic user messages through the real `extractRequirements`
  (and, for one multi-turn case, `mergeExtraction`) against the live
  Gemini API, and reports a loose PASS/REVIEW/FAIL judgment per case
  so a developer can catch extraction regressions (service category,
  attribute selection, value extraction, hallucination) after a
  model, prompt, or schema change — without adding live-network calls
  to the automated test suite.
- Inputs: `backend/src/llm/extraction.ts` (Task 06 —
  `extractRequirements`, `ExtractionResult`, read-only),
  `backend/src/conversation/mergeExtraction.ts` (Task 07 —
  `mergeExtraction`, read-only), `backend/src/domain/conversation.ts`
  (Task 03 — `createInitialState`, read-only), a real
  `GEMINI_API_KEY` in `backend/.env`.
- Outputs:
  - `backend/scripts/extractionGoldenSet.ts` — data only. Exports an
    array of ~9 hand-written cases covering: bounce house, wedding
    photographer, taco truck, bartender, face painter, an
    ambiguous/general party request, a message containing multiple
    requirements at once, a multi-turn correction (2+ messages, state
    carried forward via `mergeExtraction` between turns), and a
    message where important information is intentionally left out.
    Each case carries the message(s) plus loose expectations (e.g.
    acceptable category keywords/synonyms, attribute names expected
    to appear, which values should end up populated vs. still null).
  - `backend/scripts/evalExtraction.ts` — the runner. For each golden
    case: replays its turn(s) through `extractRequirements` (merging
    with `mergeExtraction` between turns for multi-turn cases),
    prints the message(s) and the resulting extraction/state, runs
    the case's loose structural/plausibility checks against the
    final state, and prints a PASS / REVIEW / FAIL verdict with a
    one-line reason. Ends with a summary count. This performs real
    network calls and is invoked manually via
    `npm run eval:extraction` (`tsx scripts/evalExtraction.ts`) — it
    is never run by `npm test` or `npm run build`.
  - `backend/package.json`: add
    `"eval:extraction": "tsx scripts/evalExtraction.ts"`.
- Constraints:
  - `backend/scripts/` stays outside `tsconfig.json`'s
    `include: ["src"]` and outside anything `npm test` would
    otherwise sweep up automatically — deliberate, since this script
    makes real, non-deterministic network calls and must never run
    as part of `npm run build` or `npm test`. Confirmed acceptable
    tradeoff: no `tsc` type-check safety net for this script; `tsx`
    only transpiles, it doesn't type-check.
  - No exact-string matching against LLM output. Checks are loose
    (e.g. "category contains one of these keywords," "attribute name
    exists," "value is non-null/null as expected") — precise enough
    to catch obvious regressions, not so strict that normal LLM
    wording variance produces false failures.
  - No LLM-as-judge, no eval framework/dashboard/database, no
    automatic sophisticated scoring — deliberately out of scope per
    the assignment's own "focused solution over unfinished broad
    one" guidance and this task's own discussion. PASS/REVIEW/FAIL is
    a small set of inline structural checks, not a general-purpose
    scorer.
  - The golden-set data must never be imported by production code
    (`backend/src/**`) — it is an eval-only reference and must not
    become a de facto static per-category attribute table, which
    would contradict D6 (attributes are LLM-proposed per category,
    not hardcoded).
  - This task does not add automated test coverage for the eval
    script itself. Its own correctness is validated by actually
    running it once against the real API as part of this task's
    validation (see below), not by a unit-test suite — consistent
    with keeping this lightweight per the assignment's own guidance
    and this task's explicit scope.
  - Must not modify `extractRequirements` or `mergeExtraction` to
    accommodate the eval script — it calls them exactly as Task
    06/07 shipped them.
- Open Questions: none — location, scope, and golden-case list were
  resolved in chat before this task file was written.

## Assignment Alignment
- Requirement type: RECOMMENDATION
- Assignment requirement: Not itself required by any of Parts 1–6.
  Supported by two places in the assignment: (a) "Production
  Evolution" (page 6) explicitly lists "Evaluation" as something the
  submission should describe in `DESIGN.md`; this task gives that
  discussion a concrete, working seed instead of only an abstract
  paragraph. (b) "What We Will Evaluate" criteria #2 ("Can the system
  reason across several steps without becoming fragile?") and #5
  ("Can the system distinguish facts... This is particularly
  important") are both about exactly the kind of correctness this
  script gives visibility into for the extraction step.
- Source: Home Assignment PDF, "Production Evolution" (page 6) and
  "What We Will Evaluate" #2 and #5 (page 7).
- Rationale: Not necessary to support any required Part — the
  conversational flow (Tasks 03–07) already functions and is
  automated-test-covered against fakes without this script. This is
  a cheap (single script, no infra), deliberately small addition that
  directly answers "how do you know the LLM extracted the service
  category correctly," which the existing automated tests
  structurally cannot answer since they never call the real model.
  No conflicts with `memory-bank/decisions.md` found; does not paper
  over any uncovered required Part.

## IMPLEMENT
### Files Touched
- CREATE: `backend/scripts/extractionGoldenSet.ts`,
  `backend/scripts/evalExtraction.ts`
- MODIFY: `backend/package.json` (add `eval:extraction` script)
- DO NOT TOUCH: `backend/src/`, `backend/tsconfig.json`,
  `backend/src/server.ts`, `backend/src/index.ts`, `DESIGN.md`,
  `docs/`, `.claude/`

### Implementation Notes
- Keep the golden-set data (`extractionGoldenSet.ts`) and the runner
  (`evalExtraction.ts`) in separate files so the data stays readable
  on its own.
- Multi-turn case: drive it by calling `extractRequirements` then
  `mergeExtraction` once per turn, in sequence, starting from
  `createInitialState`, exactly mirroring the loop described in
  `memory-bank/progress.md`'s current-flow summary — this is the
  first place that loop actually gets exercised end-to-end.
- "Hallucination" checks are necessarily approximate without a
  second LLM call (explicitly out of scope): for the
  intentionally-missing-info case, treat a populated value for
  something never mentioned in any turn as a FAIL; otherwise print
  full extracted values plainly so a human can eyeball anything that
  looks fabricated. Don't try to fully automate hallucination
  detection.
- Load `GEMINI_API_KEY` the same way Task 05's manual check did
  (`backend/.env` via `dotenv`); if it's missing, fail fast with a
  clear message rather than a confusing downstream error.

## VALIDATE
### Unit Tests
- N/A — deliberately no automated test coverage for this script, per
  the Constraints above.

### Component / Integration Tests
- [ ] `npm run eval:extraction` runs to completion against the real
      Gemini API for all ~9 golden cases without crashing, printing a
      PASS/REVIEW/FAIL verdict and a summary count.
- [ ] Manually inspect the printed output for at least 3 different
      service categories and confirm the extracted category/
      attributes look sensible; document what was observed in this
      task's outcome (not an automated assertion).

### E2E Tests
- N/A.

### Success Criteria
- [ ] `npm run build` (backend) still succeeds with no new TypeScript
      errors (scripts/ stays outside `src/`, so this should be a
      no-op check).
- [ ] `npm test` (backend) still passes with the same test count as
      before this task (no new files get swept into the suite).
- [ ] `npm run eval:extraction` executes end-to-end against the real
      API and produces readable, per-case output plus a summary.
- [ ] No unrelated files modified.

## ITERATE
### Outcome
- Created `backend/scripts/extractionGoldenSet.ts`: exports 9
  `GoldenCase` entries (bounce house, wedding photographer, taco
  truck, bartender, face painter, ambiguous general request,
  multi-requirement single message, multi-turn date correction,
  missing information), each with loose expectations (category
  keywords, attribute keywords, core-value presence/absence, a
  substring check for the correction case).
- Created `backend/scripts/evalExtraction.ts`: the runner. Drives
  each case through `createInitialState` →
  (`extractRequirements` → `mergeExtraction`)\* per turn against the
  real Gemini API, prints per-turn extraction and final state, scores
  a PASS/REVIEW/FAIL verdict per case via the loose checks, and
  prints a summary. Added `package.json`'s `"eval:extraction"` script
  (`tsx scripts/evalExtraction.ts`).
- **Deviation from the task file, discovered during validation**:
  the first full run hit Gemini's free-tier rate limit (5
  `generateContent` requests/minute for `gemini-3.6-flash`) —
  6 calls succeeded, then 3 cases failed on HTTP 429, not on
  extraction quality. Added a 13-second pacing delay
  (`paceNextCall()`) between sequential calls inside the runner. This
  is call-pacing to respect a known external rate limit, not
  retry/fallback logic on failure (which the task correctly scoped
  out) — no change to `extractRequirements`, `mergeExtraction`, or
  `geminiClient.ts` was needed or made.
- `npm run build` (backend): clean both before and after the pacing
  fix — `scripts/` stays outside `tsconfig.json`'s `include`, exactly
  as scoped.
- `npm test` (backend): unchanged, still 31/31 passing — no new files
  got swept into the automated suite, as intended.
- **Full real-API run** (`npm run eval:extraction`, after the pacing
  fix): all 9 cases completed without crashing — **4 PASS, 5 REVIEW,
  0 FAIL**. Manually inspected all 9 outputs (task only required 3):
  every category was sensible for its request; the missing-information
  case stayed fully null (no hallucination); the multi-requirement
  message collapsed two services into one reasonable category string
  (`"bounce house and face painting"`); the multi-turn correction
  case confirmed the real merge policy end-to-end —
  `coreAttributes.dateTime` moved from "July 5th" to "July 12th"
  while `categoryAttributes.event_type.value` ("baby shower") was
  correctly preserved even though turn 2's extraction returned `null`
  for it. The 5 REVIEW verdicts were all false-negative keyword
  guesses on my part (e.g. I expected `"water"/"slide"` for the
  bounce house case; the LLM instead proposed `theme`/`setupSurface`
  that run) rather than real extraction defects — exactly the
  behavior the loose-check design intends (flag for a human look
  rather than hard-fail on wording variance).
- No unrelated files modified — only `backend/scripts/*.ts` (2 files)
  created and `backend/package.json` modified (one script line
  added).

### Knowledge Updates
- Confirmed empirically: Gemini's free-tier `generateContent` quota
  for `gemini-3.6-flash` is 5 requests/minute. Any future tool that
  makes several sequential real Gemini calls in a short script (not
  just this eval tool) needs to either pace itself or accept it may
  hit 429s on the free tier — worth keeping in mind for later
  milestones (M8 review analysis, M10 provider questions, M11
  simulation) if they're ever exercised manually/in bulk against the
  free tier the way this script is.
- Confirmed empirically (not just by unit test against fakes) that
  the D5 merge policy — sticky category, "latest non-null mention
  wins," attribute definitions refreshed but never dropped — holds up
  through a real multi-turn conversation against the real model, not
  just hand-built fixtures.
- This is a good, concrete artifact for `DESIGN.md`'s "Optimizations"
  and "Production Evolution" sections (worth a one-line bullet at
  DESIGN.md's next incremental-update pass) — not added here since
  this task's DO NOT TOUCH scoped `DESIGN.md` out for this task's own
  implementation phase.

### Follow-ups
- Add a short DESIGN.md bullet (Optimizations or Production
  Evolution) referencing this eval script when DESIGN.md next gets
  its incremental update pass — flagged rather than done inline,
  since this task's own scope explicitly excluded touching
  `DESIGN.md`.
- Not a blocking issue, but worth knowing: `npm run eval:extraction`
  takes roughly 2+ minutes to complete a full run because of the
  13-second inter-call pacing needed to stay under the free-tier
  rate limit — expected and acceptable for an on-demand manual tool,
  not something to optimize further for this assignment's scope.
