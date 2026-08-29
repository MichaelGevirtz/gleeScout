# Task 05: Gemini structured-output client wrapper
Status: DONE
Can run in parallel with: NONE

## PLAN
- Goal: A small, generic wrapper around the Gemini API that requests
  JSON output and returns it validated against a caller-supplied Zod
  schema — the foundation every LLM-reasoning step (extraction now;
  question phrasing, review analysis, provider questions, simulation
  later) will call through, so those steps never touch the raw SDK
  or handle JSON parsing/validation themselves.
- Inputs: `memory-bank/decisions.md` D2 (Gemini, structured output,
  always re-validated with Zod), D5 (LLM output must be validated
  before entering state).
- Outputs:
  - Gemini SDK added as a backend dependency (verify current official
    package name at implementation time — Google has had more than
    one Node SDK; confirm via the npm registry rather than assuming).
  - `backend/src/llm/geminiClient.ts` exporting a function along the
    lines of `generateStructuredJson<T>({ schema, systemInstruction,
    prompt }): Promise<T>` that:
    - Reads `GEMINI_API_KEY` from env; throws a clear error if
      missing (not a silent undefined-behavior failure).
    - Reads the model name from a `GEMINI_MODEL` env var, defaulting
      to a fast/cheap current model (e.g. `gemini-2.5-flash` — this
      is a conversational, latency-sensitive flow, not a heavy
      reasoning task) — overridable without a code change.
    - Requests JSON output from the model (JSON mode /
      `responseMimeType: "application/json"`).
    - Parses the response text as JSON, then validates it against the
      caller-supplied Zod `schema` via `.parse()` — Zod is the single
      source of truth for both the TypeScript type and the runtime
      guarantee; Gemini's own JSON mode is just a best-effort
      constraint, not relied on alone (per D5).
    - Surfaces clear, distinct errors for: missing API key, a
      non-JSON response, and a response that parses as JSON but fails
      schema validation — callers (task-06+) need to be able to tell
      these apart.
  - The underlying SDK client is injectable (a parameter, not a
    module-level singleton reached into directly), so tests can
    supply a fake instead of hitting the real API.
- Constraints:
  - No extraction-specific logic, prompts, or schemas — this wrapper
    knows nothing about `ConversationState` or requirements. That's
    task-06.
  - No retry logic, rate limiting, or fallback behavior — one call,
    one clear success or one clear thrown error. If retry/fallback
    turns out to be needed, that's a deliberate later addition once
    there's a real failure mode to design around, not speculative now.
  - No live network calls in automated tests — tests exercise the
    wrapper's parse/validate/error-surface logic against an injected
    fake client. A real end-to-end call (with a real `GEMINI_API_KEY`)
    is verified manually via the dev server as part of this task's
    validation, the same way task-01 manually verified `/health`
    alongside its automated test.
- Open Questions: none — model choice is a reversible env-var default,
  not an irreversible architectural commitment.

## Assignment Alignment
- Requirement type: EXPLICIT (support role)
- Assignment requirement: "You can use an LLM to dynamically determine
  the questions," and Part 1 items 1–3 (identify the service,
  determine relevant attributes, identify what's already known) all
  require an LLM call of some kind. This task is the shared plumbing
  those calls run through — it doesn't itself implement any of items
  1–3.
- Source: Home Assignment PDF, Part 1, page 2.
- Rationale: Centralizing the Gemini call + JSON parse + Zod
  validation in one place means every later LLM-reasoning step (M3
  extraction, M4 question phrasing, M8 review analysis, M10 provider
  questions, M11 simulation) gets the "validate before it enters
  state" guarantee (D5) for free, instead of five separate ad-hoc
  implementations of the same parse/validate logic.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/llm/geminiClient.ts`,
  `backend/src/llm/geminiClient.test.ts`
- MODIFY: `backend/package.json` (add the Gemini SDK dependency)
- DO NOT TOUCH: `backend/src/domain/`, `backend/src/store/`,
  `backend/src/server.ts`, `backend/src/index.ts`, `.env.example`
  (already lists `GEMINI_API_KEY`; `GEMINI_MODEL` is optional with a
  code default, doesn't need an entry), `DESIGN.md`, `docs/`,
  `.claude/`

### Implementation Notes
- Keep the function signature generic over the Zod schema type so
  task-06's extraction schema (and later tasks' schemas) can reuse it
  without modification.
- Prefer constructor/parameter injection of the SDK client over
  reaching into a module-level singleton, specifically so tests don't
  need to mock the module system to substitute a fake.
- **SDK types must not leak past this file.** The exported function's
  signature (params and return type) is expressed only in Zod
  schemas, plain TypeScript, and the injected-client parameter's own
  minimal shape — callers (task-06 and beyond) should never need to
  import anything from the Gemini SDK package directly. This is what
  makes the SDK swappable later without touching every call site.
- Before installing, confirm the current official Google Gemini
  Node SDK package name and a suitable current model via the npm
  registry/current docs — do not assume a package or model name from
  training knowledge is still accurate or current.

## VALIDATE
### Unit Tests
- [ ] Missing `GEMINI_API_KEY` produces a clear, specific thrown
      error.
- [ ] Given an injected fake client returning valid JSON matching a
      test Zod schema, the function returns the parsed, typed object.
- [ ] Given an injected fake client returning JSON that fails schema
      validation, the function throws a clear validation error (not a
      generic/opaque one).
- [ ] Given an injected fake client returning non-JSON text, the
      function throws a clear parse error.

### Component / Integration Tests
- [ ] Manual verification only for this task: with a real
      `GEMINI_API_KEY` set, a one-off call against the real API
      returns a valid parsed result. Documented in the task outcome
      (command/result), not an automated test — no live network calls
      in the automated suite.

### E2E Tests
- [ ] N/A.

### Success Criteria
- [ ] `npm run build` (backend) succeeds with no TypeScript errors.
- [ ] `npm test` (backend) passes, including the new wrapper tests,
      with no live network calls.
- [ ] Manual real-API check succeeds (or, if no API key is available
      in this environment, that's reported honestly rather than
      claimed).
- [ ] No unrelated files modified.

## ITERATE
### Outcome
- Confirmed `@google/genai` (currently 2.19.0) is the current official
  Google Gen AI Node SDK via `npm view`; installed as a backend
  dependency.
- Created `backend/src/llm/geminiClient.ts` exporting
  `generateStructuredJson<T>({ schema, prompt, systemInstruction?,
  client? })`. The SDK client is an optional injected parameter — if
  omitted, a real `GoogleGenAI` client is built from `GEMINI_API_KEY`
  (throws `GeminiConfigError` if unset). Model name comes from
  `GEMINI_MODEL`, defaulting to a code constant. Response text is
  `JSON.parse`'d (throws `GeminiParseError` on failure or missing
  text) then validated with the caller's Zod schema (throws
  `GeminiValidationError` on failure). A minimal local `GeminiClient`
  interface (not the SDK's own types) is what callers see — SDK types
  never leak past this file, per the task's constraint.
- Created `backend/src/llm/geminiClient.test.ts`: 5 tests, all against
  an injected fake client (no live network calls) — missing API key,
  happy path, schema-validation failure, non-JSON text, and
  missing/undefined response text.
- `npm run build` (backend): clean, no TypeScript errors.
- `npm test` (backend): 17/17 passing (4 test files), including the 5
  new wrapper tests.
- **Manual real-API check**: ran with the real `GEMINI_API_KEY` present
  in `backend/.env`. First attempt against the planned default model
  `gemini-2.5-flash` failed with a live 404 from the Gemini API: *"This
  model models/gemini-2.5-flash is no longer available to new users.
  Please update your code to use models/gemini-3.6-flash..."* —
  confirms the task's own instruction not to trust a training-data
  model name was warranted. Updated the default model constant to
  `gemini-3.6-flash` and reran: real network call succeeded, JSON mode
  returned valid JSON, Zod validation passed, typed result returned
  (`{"category":"Party Rentals","reasoning":"..."}"` for a bounce-house
  prompt). Verified via a throwaway script outside the repo (not
  committed) that imported and called the real wrapper function
  directly.
- No unrelated files modified. Only
  `backend/src/llm/geminiClient.ts`, `backend/src/llm/geminiClient.test.ts`
  (created) and `backend/package.json`/`package-lock.json` (dependency
  added) changed.

### Knowledge Updates
- `gemini-2.5-flash` is no longer available to new API users as of
  this task's execution (2026-08-27); the Gemini API itself now
  recommends `gemini-3.6-flash`. `backend/src/llm/geminiClient.ts`'s
  `DEFAULT_MODEL` constant now points to `gemini-3.6-flash`. Future
  tasks/reviews should not assume `gemini-2.5-flash` from earlier
  planning docs is still valid — the live API is the source of truth,
  and the model is overridable via `GEMINI_MODEL` regardless.
- `memory-bank/context.md` Commands section already anticipated
  Gemini/Firecrawl env vars; no new env var needed for `GEMINI_MODEL`
  since it has a code default (consistent with the task's own
  DO NOT TOUCH on `.env.example`).

### Follow-ups
- None new. Task-06 (extraction) is the next consumer of this wrapper.
