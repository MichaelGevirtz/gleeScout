# Task 04: In-memory session store
Status: DONE
Can run in parallel with: NONE

> Approved 2026-08-27 ("k 04 approved. Implement exactly as
> specified.").

## PLAN
- Goal: Provide a way to create, retrieve, and update a
  `ConversationState` by session id, held in memory for the life of
  the backend process — the piece that lets state persist across
  separate HTTP requests within one conversation once the API (M5)
  exists.
- Inputs: `backend/src/domain/conversation.ts` (Task 03) — uses
  `ConversationState` and `createInitialState` as-is, no schema
  changes.
- Outputs:
  - `backend/src/store/sessionStore.ts` exporting:
    - `createSession(): ConversationState` — generates a new session
      id, creates an initial state via `createInitialState`, stores
      it, returns it.
    - `getSession(sessionId: string): ConversationState | undefined`
      — returns the current state, or `undefined` if the id is
      unknown.
    - `updateSession(sessionId: string, state: ConversationState):
      void` — replaces the stored state for that id. Throws if the
      id doesn't exist (can't update a session that was never
      created — that's a caller bug, not a normal "not found" case).
  - Backed by a single module-level `Map<string, ConversationState>`.
- Constraints:
  - No Fastify routes — that's M5.
  - No merge/extraction logic — that's M3. `updateSession` just
    stores whatever valid `ConversationState` it's given; it doesn't
    interpret or transform it.
  - No expiry, eviction, size limits, or persistence — out of scope
    per the assignment's "no persistence, fresh per run" constraint.
    A `Map` that lives until the process exits is sufficient.
  - Session ids: use Node's built-in `crypto.randomUUID()` — no new
    dependency.
- Open Questions: none.

## Assignment Alignment
- Requirement type: EXPLICIT (support role)
- Assignment requirement: "Maintain structured event and requirement
  data behind the conversation" (Part 1, item 6). Fastify handles one
  HTTP request at a time with no memory of previous ones, so
  something has to hold each conversation's state between the
  separate `/message` calls that make up one multi-turn conversation
  — that's this store. Also directly satisfies the Technical
  Expectations constraint that everything be in-memory, with no
  database.
- Source: Home Assignment PDF, Part 1, page 2; Technical Expectations,
  page 4.
- Rationale: This is infrastructure the conversation API (M5) and
  extraction logic (M3) both need in order to operate across more
  than one message — without it, every request would need to
  resend the entire conversation state, which isn't how the API is
  planned to work.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/store/sessionStore.ts`,
  `backend/src/store/sessionStore.test.ts`
- MODIFY: none
- DO NOT TOUCH: `backend/src/domain/conversation.ts`,
  `backend/src/server.ts`, `backend/src/index.ts`, `DESIGN.md`,
  `docs/`, `.claude/`

### Implementation Notes
- Keep this to the three functions above plus the `Map` — no
  generic "store" abstraction, no interfaces for swapping storage
  backends later. If a real persistent store is ever needed, that's
  a production-evolution concern (already noted in `DESIGN.md`), not
  something to design for now.
- `updateSession` throwing on an unknown id (rather than silently
  creating one) keeps bugs in later tasks loud instead of silently
  masking a caller passing the wrong session id.

## VALIDATE
### Unit Tests
- [ ] `createSession()` returns a state that passes
      `ConversationStateSchema` and is retrievable via `getSession`
      with the returned `sessionId`.
- [ ] `getSession` returns `undefined` for an unknown id.
- [ ] `updateSession` followed by `getSession` returns the updated
      state, not the original.
- [ ] `updateSession` on an unknown id throws.
- [ ] Two calls to `createSession()` produce different session ids.

### Component / Integration Tests
- [ ] N/A — no API wiring yet.

### E2E Tests
- [ ] N/A.

### Success Criteria
- [ ] `npm run build` (backend) succeeds with no TypeScript errors.
- [ ] `npm test` (backend) passes, including the new store tests.
- [ ] No unrelated files modified.

## ITERATE
### Outcome
Implemented exactly as specified, no scope expansion. Created
`backend/src/store/sessionStore.ts`: a module-level
`Map<string, ConversationState>` plus `createSession` (uses
`crypto.randomUUID()` + `createInitialState`), `getSession` (returns
`undefined` for unknown ids), and `updateSession` (throws on unknown
ids). No repository interface, no persistence abstraction, no TTL/
eviction, no validation logic beyond what Task 03's schemas already
provide, no API routes. Created
`backend/src/store/sessionStore.test.ts` with 5 tests covering
create+retrieve, unknown-id lookup, update+retrieve, unknown-id
update throwing, and distinct ids across calls.

Validation, all passed:
- `npm run build` — no TypeScript errors.
- `npm test` — 12/12 passing (5 new store tests + 7 existing,
  unaffected).
- No files outside the task's declared scope were touched.

### Knowledge Updates
- `memory-bank/progress.md`: session store implemented and
  validated; M2 (domain models & conversation state) is now
  complete.
- `memory-bank/decisions.md`: no new architectural decision — this
  followed D5/D9 (in-memory state, no persistence) as already
  recorded.
- `DESIGN.md`: no change needed — this is infrastructure implementing
  an assumption/decision already summarized there (in-memory-only
  state), not a new product/architecture point.

### Follow-ups
- M2 is complete. M3 (Gemini requirement extraction) is next per
  `memory-bank/roadmap.md` — not started, awaiting task creation +
  approval.
