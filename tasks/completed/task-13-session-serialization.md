# Task 13: Per-session request serialization + concurrency integration test
Status: DONE
Can run in parallel with: NONE (wraps the route Task 12 creates)

## PLAN
- Goal: Implement D11 exactly as already decided — guarantee that two
  requests to the *same* session are processed strictly one at a
  time, so a read→await-LLM→write turn can't have its extracted
  information silently overwritten by a second concurrent message to
  the same session, while requests to *different* sessions keep
  running fully concurrently — and prove *both* halves of that
  claim, not just the "same session is safe" half. Prove it with two
  integration tests: one reproducing the actual bug (without
  serialization, two concurrent same-session requests can both read
  the same starting state, await independently, and have one write
  overwrite the other; with serialization, the second request only
  reads state after the first has fully completed and persisted its
  update), and one proving the route wiring didn't accidentally turn
  the per-session queue into a global one — a session-B request must
  complete without waiting on a still-pending session-A request.
- Inputs: `backend/src/server.ts` (Task 12 — the `POST
  /conversation/:id/message` handler, to be wrapped, read/modify),
  `backend/src/conversation/orchestrateMessage.ts` (Task 12,
  read-only), `backend/src/store/sessionStore.ts` (Task 04,
  read-only).
- Outputs:
  - CREATE `backend/src/conversation/sessionQueue.ts` exporting
    `runSerialized<T>(key: string, fn: () => Promise<T>):
    Promise<T>` — a small per-key promise chain (`Map<string,
    Promise<unknown>>`) so calls sharing a key run strictly in
    submission order, while calls with different keys run
    independently. Lives under `conversation/`, not `store/`: this
    module controls *execution ordering* around a conversation turn,
    not conversation-state storage — `sessionStore` stays a dumb,
    unlocked `Map`, exactly as Task 04/D11 scoped it. Filed alongside
    `orchestrateMessage.ts`, the thing whose invocation it's actually
    ordering.
  - MODIFY `backend/src/server.ts`: wrap the existing
    read-session → orchestrate → update-session sequence in `POST
    /conversation/:id/message` inside `runSerialized(sessionId, async
    () => { ... })`.
  - MODIFY `backend/src/server.test.ts`: add two D11 integration
    tests:
    1. **Same-session serialization**: fire two concurrent `POST
       .../message` requests at the same session, each with a
       distinct, verifiable fake `orchestrate` contribution. The first
       call's `fn` is held open by a manually-controlled (deferred)
       promise, not a real timer, so the test deterministically forces
       the second request's handler to be invoked while the first is
       still in flight; assert the final persisted state (read back
       via `GET /conversation/:id`) contains **both** contributions —
       proving the second write didn't silently discard the first's
       extracted information.
    2. **Cross-session concurrency** (the architectural property the
       first test alone doesn't prove — that the route wiring didn't
       accidentally introduce a global lock instead of a per-session
       one): fire one `POST .../message` at session A whose fake
       `orchestrate` blocks on a deferred promise that the test never
       resolves during the assertion window, and a second `POST
       .../message` at a *different* session B with a fake
       `orchestrate` that resolves immediately. Assert B's response
       arrives (is awaited and returns `200`) while A's request is
       still pending/unresolved — proving a session-B request is not
       queued behind a session-A request that's waiting on Gemini.
       Only then resolve A's deferred promise and confirm it also
       completes correctly.
- Constraints:
  - No general-purpose task queue or job system — a single
    `Map<string, Promise>` chain, in-memory, zero dependencies. Exactly
    D11's already-decided scope, nothing more.
  - No TTL/eviction *subsystem* — but once a chained call settles, its
    entry is removed from the map if (and only if) it's still the
    current entry for that key, i.e. no newer call has been chained
    after it. This is a plain check-then-delete on a dead promise
    reference with no future use, safe under Node's single-threaded
    execution (no other callback can interleave between the check and
    the delete) — not a cleanup subsystem, just not leaving a stale
    reference for every session that will ever exist for the life of
    the process. (Contrast with `sessionStore`, Task 04: a session's
    `ConversationState` must stay alive for that session's whole
    lifetime — deleting it would break `GET`/`POST` for a still-active
    session — so no eviction there is correct, not merely convenient.
    A *settled* queue entry has no such ongoing purpose.)
  - Only the message route is serialized. `GET /conversation/:id` is
    a pure read of already-consistent state and doesn't need queuing —
    per D11's own framing, the race is specifically in the
    read→await→write turn, not in reads alone.
  - Does not modify `orchestrateMessage`, `mergeExtraction`,
    `questionPolicy`, or any Gemini/LLM module — the fix belongs at
    the orchestration/routing layer that owns request sequencing, not
    inside the pure logic or storage it calls (same boundary D11
    already draws, and the reason this module lives in `conversation/`
    rather than `store/` — see Outputs).
- Open Questions: none.

## Assignment Alignment
- Requirement type: **PROJECT DECISION** (the assignment does not
  mention concurrency at all) + **RECOMMENDATION** (closing a real,
  previously-identified correctness bug, given Engineering Quality is
  an explicit evaluation criterion).
- Assignment requirement: none names concurrency by name. Indirectly
  supports Technical Expectations' "Structured in-memory state" (page
  4 — "particularly interested in seeing how you structure") and
  evaluation criterion 3, Engineering Quality, "Is the code
  understandable and reasonably structured?" (page 7), by closing a
  real data-loss bug in that structured state's update path.
- Source: Home Assignment PDF, Technical Expectations (page 4),
  "What We Will Evaluate" §3 (page 7). Also
  `memory-bank/decisions.md` D11, which already scoped this exact
  mechanism and explicitly deferred it to M5.
- Rationale: flagged as PROJECT DECISION, not EXPLICIT, per the
  assignment-review skill's classification rule — the PDF never
  mentions concurrent requests; this task exists because D11 already
  identified a real bug that falls directly out of the async LLM
  architecture (D5), not because the assignment asked for it by name.

## IMPLEMENT
### Files Touched
- CREATE: `backend/src/conversation/sessionQueue.ts`,
  `backend/src/conversation/sessionQueue.test.ts`
- MODIFY: `backend/src/server.ts`, `backend/src/server.test.ts`
- DO NOT TOUCH: `backend/src/domain/`, `backend/src/store/`,
  `backend/src/llm/`, `backend/src/conversation/mergeExtraction.ts`,
  `backend/src/conversation/questionPolicy.ts`,
  `backend/src/conversation/orchestrateMessage.ts`,
  `backend/src/index.ts`, `DESIGN.md`, `docs/`, `.claude/`

### Implementation Notes
- `runSerialized` keeps a module-level `Map<string, Promise<unknown>>`.
  Each call: chain `fn` onto the prior entry for that key (or
  `Promise.resolve()` if none), store a settled version of that chained
  promise back into the map, and once it settles, delete the map entry
  for that key only if the map still points at that exact settled
  promise (i.e. nothing newer was chained after it in the meantime).
  The chain continues even if `fn` rejects, so one failed request
  doesn't permanently wedge the queue for that session; the specific
  caller whose `fn` rejected still sees that rejection.
- Test the queue module directly with an order-tracking array and
  manually-controlled (deferred) promises — not `setTimeout` — same
  deterministic-test style as the rest of the project, and required so
  the concurrency test isn't flaky. The `server.test.ts` concurrency
  test uses the same deferred-promise technique inside its fake
  `orchestrate`, not a real timer.

## VALIDATE
### Unit Tests
- [ ] Two calls to `runSerialized` with the same key run strictly
      sequentially — the second's `fn` doesn't start until the
      first's promise resolves (assert via an order-tracking array).
- [ ] Two calls to `runSerialized` with different keys run
      concurrently — both `fn`s are in-flight simultaneously when
      the first hasn't resolved yet.
- [ ] `runSerialized` returns/rejects with that specific call's own
      `fn` result/error, not another call's.
- [ ] A rejection from one call does not prevent a later call (same
      or different key) from running.
- [ ] After a chain for a key fully settles with no further calls for
      that key, the map no longer holds an entry for it (verified via
      an exported test-only inspection hook, or indirectly by
      confirming a subsequent call for that key behaves as a fresh
      chain rather than depending on stale internal state).

### Component / Integration Tests
- [ ] The D11 same-session scenario in `server.test.ts`: two concurrent
      `POST /conversation/:id/message` requests to the same session
      (fake `orchestrate` calls each contributing distinct, verifiable
      state, the first held open by a deferred promise) both complete,
      and the persisted end-state (via `GET /conversation/:id`)
      contains both contributions.
- [ ] The D11 cross-session scenario in `server.test.ts`: a session-B
      `POST .../message` (immediate fake `orchestrate`) completes with
      `200` while a concurrently-issued session-A `POST .../message`
      (fake `orchestrate` blocked on an unresolved deferred promise)
      is still pending — proving different sessions are not serialized
      behind one another. Resolving A's deferred promise afterward
      still completes A correctly.

### E2E Tests
- [ ] N/A.

### Success Criteria
- [ ] `npm run build` (backend) succeeds with no TypeScript errors.
- [ ] `npm test` (backend) passes, including the new tests — the
      concurrency test must be deterministic (no timing-based
      flakiness).
- [ ] No unrelated files modified.

## ITERATE
### Outcome
Implemented as specified, with one implementation deviation in the
integration tests discovered and corrected during self-verification
(see below). Created `backend/src/conversation/sessionQueue.ts`
exporting `runSerialized<T>(key, fn)` — a `Map<string, Promise>`
per-key chain via `prior.catch(() => undefined).then(fn)`, so a
rejection never wedges the queue for that key. A settled chain entry
is removed from the map via a check-then-delete (`queue.get(key) ===
settled`) that's race-safe under Node's single-threaded execution, per
spec. Added a minimal test-only inspection export
(`__hasEntryForTesting`) to make the cleanup behavior directly
observable, as the task explicitly allowed.
`backend/src/conversation/sessionQueue.test.ts` — 5 tests covering
every VALIDATE unit-test item. `backend/src/server.ts`'s message
route now wraps `getSession` (read fresh **inside** the serialized
closure, not captured beforehand) → `orchestrate` → `updateSession`
in `runSerialized(sessionId, ...)`, with the 404 check moved inside
the closure (returns `null` as a not-found sentinel) so a session
lookup can never race against another request's still-in-flight write
for that same session.

**Self-verification caught two real bugs in my own first draft of the
two `server.test.ts` integration tests, not just theoretical review —
both fixed before considering the task done:**
1. The same-session test originally proved nothing: it used
   `await Promise.resolve()` microtask-flushing to "wait for B to
   attempt to run," but Fastify's `inject()` pipeline (JSON body
   parsing, hooks) advances across actual event-loop iterations, not
   just microtasks. Verified by deliberately reverting the route to
   call `orchestrate` directly (bypassing `runSerialized`) — the test
   **still passed**, meaning it wasn't actually detecting the missing
   serialization. Fixed by adding an explicit "reached" signal
   (a deferred promise the fake `orchestrate` resolves on entry) raced
   against a `setImmediate`-based event-loop flush, giving a
   decisive, non-guessed proof that B's handler had not started.
   Re-verified: fails against the unserialized version, passes against
   the real one.
2. The cross-session test had a second, subtler bug: it resolved
   `deferredA` immediately after awaiting B's response, without first
   confirming A had actually started. Under a simulated "accidentally
   shared queue key" bug (verified by literally hardcoding both
   requests onto the same key), the test still passed roughly half
   the time — because if Fastify happened to schedule B's pipeline
   before A's, B would win the shared lock and finish first regardless
   of the bug, and by the time the test resolved `deferredA`, A hadn't
   even started yet so nothing observable was actually blocked. Fixed
   by adding the same "reached" signal technique to force session A's
   request to deterministically start (and be provably blocked on
   `deferredA`) *before* session B's request is even issued. Re-verified:
   times out against the injected shared-key bug, passes against the
   real per-session implementation.

Both corrected tests were re-run 5x each against the real
implementation with no flakiness, and separately confirmed to fail
(one via assertion failure, one via timeout) against their respective
deliberately-broken implementations before being confirmed against the
real one — i.e., both are proven regression-catching tests, not
tautologies.

`npm run build` clean; `npm test` 74/74 passing (5 queue unit tests +
2 new route integration tests + 67 pre-existing), repeated 5x with no
flakiness. No files outside `Files Touched` were modified — no
DESIGN.md/decisions.md change required per this task's own `MODIFY:
none` scope (D11 already documents the underlying decision; this task
only implements what D11 already specified).

### Knowledge Updates
- New module `backend/src/conversation/sessionQueue.ts` closes the
  D11 gap: `POST /conversation/:id/message` is now safe under
  concurrent same-session requests, and different sessions remain
  fully concurrent. **M5 is now fully complete.**
- Process note for future concurrency-adjacent test writing in this
  project: `await Promise.resolve()`-style microtask flushing is
  **not sufficient** to prove or disprove ordering through Fastify's
  `inject()` pipeline — it involves real event-loop-iteration hops
  (body parsing, hooks), not just microtasks. Use a `setImmediate`-based
  flush (no wall-clock delay, still deterministic) when a test needs
  to wait for "the pipeline has definitely progressed," and prefer an
  explicit "reached this point" deferred-promise signal over any
  fixed flush-count when the assertion is safety-critical — a bounded
  flush proves absence only up to how many iterations you tried, an
  explicit signal proves it structurally, and self-verifying a
  concurrency test against a deliberately-broken implementation
  (proven here to catch two real bugs) is worth doing before trusting
  it, not just after.

### Follow-ups
- None functional. **M5 (Conversation API) is complete** —
  tasks 12 and 13 together deliver `POST /conversation`, `POST
  /conversation/:id/message` (with concurrency-safe per-session
  serialization), and `GET /conversation/:id`. Next roadmap item is
  M6 (evidence/provenance model), gating M7 (Firecrawl provider
  research).
