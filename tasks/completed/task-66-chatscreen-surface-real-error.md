# Task 66: ChatScreen shows the real send-failure message, not a hardcoded string
Status: DONE
Can run in parallel with: task-65, task-67, task-68 (disjoint files)

## PLAN
- Goal: fix the exact bug shown in the user's screenshot — a failed
  chat send always renders the hardcoded label "Failed to send"
  regardless of *why* it failed, because `ChatScreen.tsx`'s
  `attemptSend` catch block discards the caught error entirely
  (`catch { setPendingBubble({ text, status: "failed" }); }`, no
  reference to the error at all). Once task-65 makes the backend
  return a clear rate-limit message (e.g. "You've hit the rate limit —
  please wait a moment and try again."), that message is currently
  unreachable here — it dies in this catch block. This task makes
  whatever message the backend/API layer produced actually reach the
  UI.
- Inputs: `frontend/src/screens/ChatScreen.tsx` (existing
  `PendingBubble`/`attemptSend`/failed-render block, unchanged
  otherwise); `App.tsx`'s existing `errorMessage(error)` pattern
  (`error instanceof Error ? error.message : "Something went wrong."`)
  as the precedent to reuse, not reinvent.
- Outputs: `PendingBubble`'s `failed` state carries the real error
  message; the failed-bubble UI renders that message instead of the
  literal string `"Failed to send"`.
- Constraints: no new dependency, no new component. Do not change
  `onSend`'s signature, `attemptSend`'s retry mechanism, or any testID
  except where a new one is strictly needed for the message text. Do
  not touch `App.tsx`'s own separate `errorContext` overlay (used for
  the provider-search/selection failures, already correct — see M16
  audit finding, PASS) — this task is scoped to the in-transcript
  failed-send bubble only.
- Open Questions: none.

## Assignment Alignment
- Requirement type: PROJECT DECISION / bug fix.
- Assignment requirement: none directly — Part 6's "understandable...
  thoughtfully designed" UI framing is tangential (a user-visible error
  message that doesn't explain what happened is a minor UX defect, not
  an unmet functional requirement).
- Source: direct user bug report (screenshot) in this session.
- Rationale: This is a straightforward correctness fix to already-
  shipped M15 code (task-48), not new scope — the message-passing path
  was simply never wired up when the failed-bubble UI was first built.

## IMPLEMENT
### Files Touched
- MODIFY: `frontend/src/screens/ChatScreen.tsx` (`PendingBubble` type
  gains a `message: string` field on the `failed` variant; `attemptSend`
  captures the caught error's message the same way `App.tsx` already
  does; render that message instead of the literal `"Failed to send"`
  string)
- MODIFY: `frontend/src/screens/ChatScreen.test.tsx` (update/add tests
  for the new message content)
- DO NOT TOUCH: `App.tsx`, any backend file, any other screen.

### Implementation Notes
- Reuse the exact `error instanceof Error ? error.message : "..."`
  pattern already established in `App.tsx`'s `errorMessage()` — either
  import a shared helper or duplicate the one-liner locally; do not
  invent a different error-formatting convention for this one screen.
- Keep the generic fallback text for a non-`Error` throw (defensive,
  matches the existing `App.tsx` precedent) rather than assuming every
  rejection is an `Error`/`ApiError` instance.

## VALIDATE
### Unit Tests
- N/A (no new pure logic)

### Component / Integration Tests
- [ ] `onSend` rejecting with `new Error("You've hit the rate limit —
      please wait a moment and try again.")` → the failed bubble
      renders that exact text (not "Failed to send").
- [ ] `onSend` rejecting with a non-`Error` throw → the failed bubble
      renders the existing generic fallback text.
- [ ] Existing retry-button behavior (`chat-retry` testID, re-invokes
      `onSend` with the same original text) still passes unchanged.

### Success Criteria
- [ ] `npm test` (frontend) passes, no regressions.
- [ ] `npx tsc --noEmit` clean.

## ITERATE
### Outcome
Implemented exactly as planned. `PendingBubble`'s `failed` variant
gained an optional `failureMessage: string`; a local `errorMessage()`
helper (identical pattern to `App.tsx`'s existing one) populates it in
`attemptSend`'s catch block; the failed-bubble render now shows
`pendingBubble.failureMessage ?? "Failed to send."` under a new
`chat-failed-message` testID instead of the old hardcoded literal.
Updated the one existing test that asserted the literal "Failed to
send" string (now asserts the real rejected-Error message is shown —
using the actual rate-limit copy from task-65 as the example) and
added one new test for the non-`Error`-throw fallback path. `frontend
npx tsc --noEmit` clean; `frontend npm test` 103/103 passing (101
pre-existing + 2 new here; task-68 added one more concurrently, see its
own outcome).

### Knowledge Updates
This is the fix that makes task-65's backend rate-limit message
actually visible to the user for a chat-send failure — recorded
together in `decisions.md` D20 since neither change alone fixed the
reported bug.

### Follow-ups
None.
