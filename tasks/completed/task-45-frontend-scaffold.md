# Task 45: Frontend project scaffold (Expo + TS + Jest + RNTL)
Status: DONE

**Revised after a blocked Vitest attempt — see `## ITERATE` below for
the full history.** Reviewer decision (explicit, in chat): switch to
Jest (`jest-expo` preset) + RNTL, the standard, actively-maintained
combination every Expo/RN project uses, instead of continuing to fight
Vitest's ESM-first SSR module runner against React Native's
Metro-authored (CJS + Flow) package sources. The PLAN/IMPLEMENT/VALIDATE
sections below are rewritten for Jest; everywhere else in the M15 task
set that said "Vitest"/`vi.*` now means Jest/`jest.*` — the actual
mocking API differs (`vi.fn`/`vi.mock` → `jest.fn`/`jest.mock`), the
behavior/intent described in each task is unchanged.
Can run in parallel with: NONE (first frontend task; nothing exists in `frontend/` yet)

## PLAN
- Goal: stand up a runnable Expo/TypeScript app skeleton with a working
  Jest + React Native Testing Library test pipeline, proven with one
  real render+interaction test — not just a trivial assertion — so
  every later M15 task can write component tests with confidence the
  toolchain actually works.
- Inputs: none (greenfield); `.claude/CLAUDE.md`'s stated technical
  constraints (React Native, Expo, TypeScript, RNTL — Jest per the
  reviewer's revised decision above); D4 (`memory-bank/decisions.md`)
  confirming Expo-managed RN as the project's frontend stack.
- Outputs:
  - NEW `frontend/` Expo TypeScript app (`expo` + `react`
    + `react-native` + `typescript`), created via the standard Expo TS
    template, trimmed to a blank placeholder screen (no starter-kit
    boilerplate, no example nav/tabs left in).
  - NEW `frontend/jest.config.js` (or a `"jest"` block in
    `package.json`) using the `jest-expo` preset — Expo's own
    maintained preset, which already handles Flow-syntax stripping and
    native-module mocking for React Native's source, the exact problem
    that blocked the Vitest attempt.
  - NEW `frontend/babel.config.js` (`presets: ["babel-preset-expo"]`)
    — required by `jest-expo`'s babel-jest transform.
  - NEW `frontend/src/App.tsx` — trivial placeholder (e.g. a `Text`
    reading "GleeScout") — real screens land in later tasks.
  - NEW `frontend/src/App.test.tsx` — one real RNTL test: render
    `<App />`, query by text/testID, and (to prove interaction, not
    just static render) a second minimal component in the same file
    with a button that updates on press, asserting the rendered output
    updates after a `fireEvent.press`. This is the toolchain-proof
    test, not meaningful app behavior — it can be deleted/replaced once
    task-54 lands a real `App.tsx`.
  - MODIFY `.claude/CLAUDE.md` — replace the placeholder "Expected once
    M15 lands" frontend command block with the real, verified commands
    (`npm install`, `npx expo start`, `npm test`), per CLAUDE.md's own
    "must be kept up to date" instruction.
- Constraints:
  - No navigation library (React Navigation / expo-router) —
    confirmed with the reviewer: a hand-rolled screen-state machine in
    the root component is the chosen approach (task-54), so nothing
    here should scaffold routing.
  - No AsyncStorage, no API client, no domain types yet — those are
    task-46/47's job.
- Open Questions: none (both original architecture questions —
  navigation approach, test-tooling fallback behavior — were resolved
  with the reviewer before this task was first written; the Jest pivot
  itself was a third, later reviewer decision made after the Vitest
  attempt genuinely blocked, recorded in `## ITERATE` below).

## Assignment Alignment
- Requirement type: PROJECT DECISION (stack/tooling; the assignment
  leaves stack choice open) + SUPPORT (necessary scaffolding for the
  EXPLICIT requirement that the solution be "a small chat-based
  application").
- Assignment requirement: Technical Expectations — "submit the
  solution as a GitHub repository that we can clone and run locally,"
  with "clear instructions in the README for running it locally."
  Part 1's "chat-based application" framing is the eventual consumer
  of this scaffold.
- Source: Home Assignment PDF, "Technical Expectations" and "The
  Assignment" sections.
- Rationale: no frontend code can exist without a runnable project
  skeleton and a working test pipeline; this is pure enabling
  infrastructure for M15, not itself a feature.

## IMPLEMENT
### Files Touched
- CREATE: `frontend/` (full Expo TS app scaffold — `package.json`,
  `tsconfig.json`, `app.json`, `babel.config.js`, `jest.config.js`,
  `src/App.tsx`, `src/App.test.tsx`, plus whatever config files the
  Expo TS template and jest-expo/RNTL setup require)
- MODIFY: `.claude/CLAUDE.md` (Commands section only)
- DO NOT TOUCH: `backend/`, `memory-bank/`, `design/`, `docs/`

### Implementation Notes
- Use the current official Expo TypeScript template
  (`npx create-expo-app frontend --template`, TS variant) rather than
  hand-assembling `package.json` from scratch — matches this project's
  existing precedent (D2a) of using real, verified tooling rather than
  a guessed-from-memory config.
- `package.json` scripts: `"start": "expo start"`, `"test": "jest"`
  (matching backend's `npm test` convention).
- Keep `App.tsx` and its test intentionally minimal — this task proves
  the pipeline works, it does not build product UI.

## VALIDATE
### Unit Tests
- N/A (no business logic yet).

### Component / Integration Tests
- [ ] `App.test.tsx`'s two RNTL tests pass: a static render/query
      assertion, and a `fireEvent.press` interaction assertion proving
      Jest can drive real user interaction through RNTL against a real
      React Native component tree.

### E2E Tests
- [ ] `npx expo start` boots without error (manual check, not part of
      `npm test`) and shows the placeholder screen in Expo Go /
      web preview.

### Success Criteria
- [ ] `cd frontend && npm install` succeeds.
- [ ] `npm test` runs and passes (both RNTL tests).
- [ ] `npx expo start` boots cleanly.
- [ ] `.claude/CLAUDE.md`'s frontend Commands section reflects the
      real, verified commands.
- [ ] No files outside `Files Touched` modified.

## ITERATE
### Outcome
**BLOCKED.** Per this task's own stop condition ("stop and set
`Status: BLOCKED`... rather than silently substituting Jest"),
confirmed by the reviewer up front.

**Completed successfully:**
- `frontend/` created via `npx create-expo-app frontend --template
  blank-typescript` (Expo ~57, React 19.2.3, React Native 0.86.3).
- A real, separate machine-level blocker was found and fixed first:
  this environment has a Windows Application Control policy that
  blocks `dlopen`-loaded native Node addons (`.node` files) — it
  killed Rollup's native binary (`@rollup/rollup-win32-x64-msvc`)
  outright (`ERR_DLOPEN_FAILED: An Application Control policy has
  blocked this file`), independent of React Native entirely (esbuild's
  binary loads fine because it's spawned as a subprocess, not
  `dlopen`'d). Fixed via `"overrides": { "rollup": "npm:@rollup/wasm-node@^4"
  }` in `frontend/package.json` — the officially published WASM build
  of Rollup, no native addon involved. This fix is real, general, and
  should be kept regardless of how the RNTL question resolves — any
  future Vite/Rollup-based tool on this machine would hit the same
  wall otherwise.
- `react-test-renderer` had to be pinned to the exact React version
  (`19.2.3`, not `^19.2.3`) — its own dependency range otherwise
  resolves to a newer `react-test-renderer` wanting a newer `react`
  than Expo's template installs.

**Blocked on, after genuine multi-angle effort:** getting Vitest to
actually import `react-native` at all (before even reaching RNTL's own
rendering/query behavior). Root cause: React Native's package source
is authored for Metro specifically — CommonJS (`require`/
`module.exports`, including many *dynamic* lazy `require()` calls
inside getters, not just static top-level ones) written with Flow type
syntax, some of it (`expr as Type` casts) newer than what
`@babel/parser`'s bundled Flow support handles. Vite/Vitest's SSR
module runner is ESM-first: once a file is pulled into its own
transform pipeline it no longer gets a `require` global (that only
exists for dependencies Vite hands off untouched to Node's real
loader) — but Node's real loader can't parse Flow syntax either, so
neither path works unmodified. Four escalating fixes were attempted,
each solving the specific error it targeted and surfacing the next:
1. `react-native` → `react-native-web` alias + jsdom: abandoned before
   implementation once it became clear `@testing-library/react-native`
   renders via `react-test-renderer` (a fake native tree), not a DOM —
   this combination doesn't apply to RNTL at all, only to
   `@testing-library/react` (the web library), which is not what was
   asked for.
2. `vite-plugin-babel` running the full `babel-preset-expo` on
   matching files → produced correct CommonJS (verified standalone),
   but Vite's SSR runner can't execute raw `require()` in an inlined
   module → `ReferenceError: require is not defined`.
3. Switched to only stripping Flow types (leaving module
   syntax/`require()` untouched, so as not to reintroduce the CJS
   problem) via `@babel/plugin-transform-flow-strip-types` → hit a
   real parser gap: `@babel/parser`'s Flow support doesn't parse
   `expr as Type` casts, which React Native's current source uses.
   Fixed by adding `babel-plugin-syntax-hermes-parser` (Meta's own
   parser, already present transitively, kept in sync with Flow's
   actual syntax) ahead of the strip-types plugin — confirmed via a
   standalone repro that this specific parse error is fully resolved.
   This landed back on the exact same `require is not defined` error
   from (2), since flow-stripping alone doesn't touch `require()`.
4. Attempted Vite's SSR dependency pre-bundling (`ssr.optimizeDeps` +
   `ssr.noExternal` + a custom esbuild `onLoad` plugin running the same
   hermes-parser + flow-strip transform) — this is the architecturally
   correct lever (esbuild's bundler inlines `require()` calls at
   bundle time, producing a require-free chunk, which is exactly what's
   needed) but it did not engage under Vitest as configured — the
   original raw Flow parse error from step (1) reappeared, meaning
   Vitest's own SSR module resolution bypassed the optimizeDeps step
   entirely rather than routing through it. Diagnosing exactly why
   would mean digging into Vitest's internal (not raw Vite's) SSR
   dependency-resolution path, which is where this task stopped.

**Assessment**: environment/config, not a code defect in this
project — and not a shallow "wrong flag" issue either. This is a real,
structural mismatch between Metro's CJS+Flow module model (what React
Native's own package is authored for) and Vite/Vitest's ESM-first SSR
module runner. Four independent, correctly-diagnosed fixes each solved
the error in front of them and surfaced a new one underneath — this
looks like the kind of gap a dedicated community package (if one
exists and is current) or direct engagement with Vitest's own
SSR-deps-resolution internals would be needed to close, not a
configuration mistake on this project's part.

**Not attempted** (stopped here per the pre-agreed fallback,
respecting the "reasonable effort" bound rather than open-endedly
continuing): digging into Vitest 4's own dependency-optimization
internals to find why `ssr.optimizeDeps` didn't engage; searching for
a maintained third-party Vitest+RNTL integration package that might
already solve this; a from-scratch custom Vite SSR resolve/load plugin
that fully replaces Node's module resolution for these packages
(effectively hand-rolling the missing piece of Metro).

### Knowledge Updates
None yet — no memory-bank update until the reviewer decides how to
proceed (see Follow-ups). The Rollup native-binding fix (`overrides`
pointing `rollup` at `@rollup/wasm-node`) is worth keeping and noting
in `decisions.md` regardless of the RNTL outcome, since it's a
real, general fix for this machine, not scoped to this specific test
question.

### Follow-ups
Resolved — see the addendum below. No longer blocks task-46 onward.

---

### Addendum — resolved via reviewer decision (Jest pivot), same session

Reviewer chose "Switch to Jest" after the BLOCKED report above.
Implemented immediately:

- `frontend/` scaffold finalized: `src/App.tsx` (moved from root
  `App.tsx`, per this task's own file-layout spec — `index.ts` updated
  to import from `./src/App`), `src/App.test.tsx` (the toolchain-proof
  test), `babel.config.js` (`presets: ["babel-preset-expo"]`),
  `package.json`'s `"jest": { "preset": "jest-expo" }` block,
  `"scripts.test": "jest"`.
- Installed via `npx expo install jest-expo jest` (Expo's own
  SDK-version-aligned installer, same precedent as D2a — real, verified
  tooling, not a guessed config) plus `@testing-library/react-native`,
  `react-test-renderer` (pinned to the exact React version, `19.2.3`
  not `^19.2.3` — its peer range otherwise resolves to a newer
  `react-test-renderer` wanting a newer React than Expo's template
  installs), `@types/jest` (pinned to `29.5.14` per `expo install
  --check`, matching the installed `jest@29.7` runtime).
- Removed the abandoned Vitest artifacts entirely: uninstalled
  `vitest`/`vite`/`vite-plugin-babel`, deleted `vitest.config.ts` and
  the standalone `src/proof.test.tsx`, removed the now-unused
  `@rollup/wasm-node` `overrides` entry from `package.json` (that fix
  was real and worth keeping in principle, but nothing in the project
  depends on Rollup anymore once Vite is gone — recorded here and in
  `decisions.md` in case a future tool reintroduces a Rollup-based
  dependency and hits the same Windows Application Control block).
  Also removed `frontend/AGENTS.md` and `frontend/CLAUDE.md`, two
  template-generated stub files (a one-line pointer to versioned Expo
  docs, and a redirect to the former) that would otherwise sit as a
  confusing, nested, near-empty second `CLAUDE.md` alongside the
  project's real one at `.claude/CLAUDE.md`.
- **`jest-expo` solved the Metro/Flow/CJS problem completely and
  immediately** — no custom babel/esbuild plugin, no `hermes-parser`
  bridging, no dep-pre-bundling configuration needed; this is exactly
  the "well-trodden path" tradeoff the reviewer was weighing.
- **One real, non-obvious API discovery, not a config issue**: this
  stack's `@testing-library/react-native@14.0.1` (paired with React
  19.2's concurrent rendering) has an **async** `render()` and
  `fireEvent.*()` — omitting `await` on either produces confusing
  failures (`render` not throwing but `screen` queries reporting
  "render function has not been called"; `fireEvent.press` firing but
  the assertion racing the state update and seeing stale output).
  Confirmed by reproducing both failure modes before fixing them.
  Recorded in `.claude/CLAUDE.md` and `decisions.md` since every
  subsequent M15 task's tests depend on getting this right.
- Verified: `npm test` — both `App.test.tsx` tests pass (static
  render + a real `fireEvent.press` interaction updating rendered
  output, proving Jest can drive real user interaction through RNTL
  against actual React Native components, not a DOM approximation).
  `npx tsc --noEmit` — clean (required adding `"types": ["jest",
  "node"]` to `tsconfig.json`'s `compilerOptions`, since Expo's base
  tsconfig doesn't include Jest's ambient globals by default).
  `CI=1 npx expo start` — Metro boots cleanly ("Waiting on
  http://localhost:8081"), confirmed via a bounded background run.
  `npx expo install --check` — dependencies aligned, no warnings.
- `.claude/CLAUDE.md`'s Commands section updated with the real,
  verified frontend commands, the Jest-not-Vitest note, and the
  async-render/fireEvent note.

**Status: DONE.**

### Knowledge Updates (final)
- `memory-bank/decisions.md`: new entry (D17) recording the
  Vitest→Jest pivot, the Windows Application Control / native-addon
  finding, and the RNTL async-API finding — added as part of this
  task's completion step.
- `memory-bank/progress.md`: M15/task-45 entry added.
