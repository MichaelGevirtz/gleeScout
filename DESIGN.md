# DESIGN.md — GleeScout Architecture & Product Rationale

One sentence sums up the whole system: **the LLM interprets, and
deterministic code decides.** Every LLM answer is checked before it's
trusted — either it passes a strict schema check, or it's clearly
labeled as simulated and never allowed to look like a fact. Everything
below follows from that one rule, including a few times where holding
to it caught a real bug before it shipped.

---

## Assumptions

- **We use Gemini's free tier, which limits how many calls we can make
  per minute and per day, and is also just slow.** This one constraint
  shapes a lot of the decisions in this document — batching calls
  together, capping how many providers we research deeply, keeping
  concurrency low on purpose. The tradeoff: the app is slower and more
  limited than it would be on a paid plan. We accepted that instead of
  adding billing, since speed and cost weren't the point of this
  assignment — architecture was.
- **Only the service and the location are required before we
  search.** Everything else — even the date — can be missing. If the
  user can't answer a question, we don't get stuck waiting forever:
  after a few turns, we search anyway with what we have. But we always
  need to know what service they want and where, since there's nothing
  to search for, or search in, without those two.
- **The LLM decides which questions are required and which are
  optional, for each service — we don't hardcode this.** A
  photographer and a bounce house company need different questions.
  This is the actual mechanism that stops the app from turning into
  one generic form for every service.
- **We keep two different research bars low on purpose, for the same
  reason: get the user to results fast, and don't waste real data we
  already paid for.**
  - In the conversation, we stop asking questions the moment we have
    enough to search — we don't chase a perfect, complete picture
    first.
  - In provider research, a page counts as a usable candidate the
    moment it gives us one real fact — a price, a rating, anything —
    not only once we have a full profile. Throwing away a page over
    one missing field would waste a scrape and an extraction call we
    already paid for.

  Both are the same instinct: move to the next useful step, rather
  than gathering everything first. Right now, once the user picks one
  provider from the list, we reason over what we already know about it
  — we don't go fetch new data for it. Going back to research that one
  provider more deeply is a natural next step, not something built yet.
- **Location is just plain text, matched by simple word overlap — no
  maps, no distance math.** Simple and easy to test. The downside:
  "downtown Austin" might not match a listing that only says "Austin,
  TX." That's the first thing we'd fix if this went to production.
- **We only trust a price when we can read exactly one dollar amount
  from it.** A range like "$200–$300" is treated as unknown, not
  averaged into $250 — a guessed number pretending to be a real price
  would be worse than no number at all.
- **When sources disagree, we don't average them — we pick the one we
  trust more.** A rating from an independent site (Google, Yelp)
  always beats a rating the provider claims about itself. Once we have
  an independent rating, a self-reported one can never replace it.
  This came from a real bounce house listing that claimed "5 stars,
  1,000 customers" on its own homepage, right next to a real 4.76 from
  an actual review site.

---

## Architecture Decisions

*This is where the real judgment calls live. Roughly ordered from the
core idea outward, to how that idea held up under real use and real
bugs.*

- **The app owns state and every decision. The LLM only interprets
  language.** Every turn works the same way: the LLM reads what the
  user said and reports what changed — nothing more. Our own code
  decides what that means: what's still missing, whether we're ready
  to move on, what happens next. We never ask the LLM "what should
  happen now" — only "what did the user just say." Every answer the
  LLM gives us is also checked against a strict format before our code
  will act on it — a malformed or unexpected answer gets rejected
  right there, instead of quietly corrupting the conversation. This
  one rule is the backbone of the whole system, and it's what keeps a
  pipeline with many LLM steps from becoming unpredictable.
- **The score shown on a provider card is not the same as the full
  ranking score.** Our ranking score has 5 parts, including things
  like reputation and how much data we have. While building the card,
  we realized that number can't honestly answer "does this provider
  fit what I asked for" — a provider with great reviews but the wrong
  location could still score well. So the card's grade (Wonderful /
  Good / Average / Poor) only comes from 3 of those parts: does it
  match what you asked for, is it in the right place, is it in
  budget. When we don't have enough data on those three, we say so
  honestly instead of guessing "Poor."
- **A simulated answer can never be attached to a real provider's
  data — by design, not just by rule.** Facts and inferred signals
  both live directly on a provider's record. Simulated answers never
  do — they come back as a separate object entirely, so there's no
  code path where a made-up answer could accidentally attach to a real
  fact. This isn't a rule we hope people follow — the code makes it
  impossible to break. It directly answers the thing the assignment
  says matters most: telling real information apart from guessed
  information.
- **A rating only counts if the rating and the review count come from
  the same real source.** We don't mix "a rating from one place" with
  "a review count from somewhere else" and call that one signal — even
  if both look real alone, nothing proves they describe the same
  reviewers. A high rating backed by few reviews scores lower than the
  same rating backed by many. We added this rule after watching a real
  provider's self-reported numbers try to sneak into the score.
- **A provider that matches none of what the user asked for is dropped
  from the list completely — and we check that before picking the
  final top 5, not after.** Checking after would mean a genuinely good
  match ranked 6th could never take the place of a bad match that only
  ranked higher because of unrelated things like reviews. We do the
  harder version on purpose, because the easier one has a real, silent
  problem: a well-reviewed provider in the wrong city pushing out one
  that actually fits.
- **Text shown on a provider card is always a real fact, never a
  sentence the LLM wrote.** We once had the LLM write a line like
  "serves your area" right under a checkmark that already said the
  same thing. The fix wasn't a smarter LLM — it was removing the LLM
  from card-writing entirely. The card only shows real, already-known
  facts now, and never repeats one already covered by a checkmark. A
  small example of the LLM/code boundary actually holding up when it's
  inconvenient, not just when it's easy.
- **We decide what's still missing about a provider with three fixed
  checks, not a guess — run the moment the user selects them from the
  comparison list, before any question gets generated.** For every
  requirement the user said was required, we check if the provider's
  own services, policies, or reviews already say it — if they do, we
  skip it; if not, it becomes a question. If the user gave a budget,
  we check if the provider's known price already mentions things like
  setup, teardown, or insurance, and ask what it includes if it
  doesn't. If the user gave a date or time, we check if the provider's
  known availability text says that exact date or time — this almost
  never matches, since providers usually list general hours, not one
  specific date, so this one almost always turns into a question. We
  never actually contact the provider to find out; the question just
  gets a simulated, AI-guessed answer instead, shown to the user
  clearly marked as not real. If nothing is left to ask, we skip the
  whole question step — no LLM call happens for a provider that
  already answered everything we needed.
- **We only prepare questions and simulate answers for the one
  provider the user actually picks — never for all five up front.**
  Doing it for all five would mean four wasted LLM calls and a slower
  first screen, for data most users would never look at. The tradeoff:
  the app picks from a list built by re-sending us the same provider
  data we already gave it, and we trust that data without
  double-checking it — fine for a prototype with no accounts. We've
  already written down the fix (a private ID instead of trusting the
  resend) for when that stops being true.
- **The app deliberately works in two different modes: chat to
  gather information, then a full list to compare and decide.**
  Gathering information works best step by step. Comparing providers
  works best when you can see them all side by side at once. We tried
  building this as one single mode all the way through — either all
  chat, or a one-card-at-a-time swipe deck — and rejected both, since
  hiding the other candidates while comparing one at a time makes it
  harder to actually weigh them against each other.

---

## Optimizations

*Every one of these comes back to the same thing: Gemini calls are the
limited, slow resource. We either cut how many calls we make, or we
spend something cheap — an extra web search, a little extra wait time
— specifically to avoid making more of them.*

- **Two review-site searches, still only one Gemini call.** We search
  Yelp and Google for a provider's reviews at the same time —
  searching is cheap and safe to run in parallel — but we send both
  pages to the LLM together, in one call, instead of two. Twice the
  evidence per provider, for the same LLM cost.
- **Every LLM call costs us twice.** Gemini's free tier caps how many
  calls we can make per minute and per day. And even on a paid tier,
  every call still takes real time — more calls means a slower app.
  So when we wanted to search more broadly, we couldn't just run more
  searches and send everything we found to the LLM. Instead, we fire
  2-3 searches at once — a broad one, a review-focused one, and (once
  we know more) one aimed at exactly what the user asked for.
  Searching is cheap and fast to run in parallel, so this costs
  nothing extra. We mix all the results together fairly, remove
  duplicates, then cut the list down to the same fixed number of pages
  we'd use with just one search. If one of the 2-3 searches fails,
  it's not a problem — the others still count, and we just end up with
  a smaller pool that time, not an error.
- **We limit how many providers we research at the same time, on
  purpose — not as many as possible.** Running things in parallel
  makes one request finish faster, but it doesn't reduce how many
  total calls we make, and Gemini's free tier has a hard cap on calls
  per minute. Going faster the wrong way would just turn today's
  occasional rate-limit error into a routine one.
- **We figure out "what matters for this service" once per
  conversation, and reuse it for the rest of that conversation — free,
  since it's already saved.** We also thought about going further:
  caching this across everyone's conversations, not just one. Two
  different people both looking for a clown need the same answer to
  "what matters for a clown" — so the first person to ask would still
  wait on a real LLM call, but everyone after them could get an
  instant answer straight from a cache instead of waiting on a new
  one. We're keeping this out of scope for now.
- **Our debug trace now records how long each step actually took —
  not one shared timestamp for everything.** The trace exists to
  answer "how did we get this result," but for a while it couldn't
  actually answer "which step was slow," because every step was
  stamped with the same time, taken after everything had already
  finished. We fixed it the same day we noticed — a debugging tool
  that quietly can't do its own job is worse than not having one.
  Today it tracks four real steps — searching, enriching, ranking, and
  picking the final list — each with its own timestamp and duration.
  The ranking step shows the most: every provider's full score
  breakdown, and every provider that got left out, with the exact
  reason why.
- **We checked real API details ourselves, instead of assuming
  them.** The model we originally planned to use turned out to be
  discontinued — we only found out by actually calling it. Separately,
  we discovered the free tier's daily limit, not just its per-minute
  limit, mid-testing. Both are the kind of fast-changing detail that's
  cheap to get wrong and easy to check by just calling the real thing.

---

## Production Evolution

*Not just "add a database." Each point below names a real shortcut
this version takes, and what would actually replace it at real
scale.*

- **Our one-off testing script becomes always-on testing.** Right now
  we run a small, hand-picked set of test cases against the real API
  when we choose to. At real scale, we'd run a constantly growing set
  of real examples automatically, catching a broken prompt before a
  real user ever sees it.
- **Provider profiles would be saved and refreshed over time, instead
  of researching everyone from scratch on every single
  conversation.** In practice, real usage would likely repeat: the
  same kind of provider, in the same kind of place. If we watch which
  category-and-location combinations our users actually search for —
  say, the top 100, like "clowns in Miami" or "bounce houses in
  Austin" — a nightly job could refresh just those ahead of time, so
  the next person asking the same thing gets an instant answer from
  what we already know, instead of waiting on a live search. This only
  works because real usage clusters around a limited set of
  combinations. If our users were spread across many, many different
  locations instead, we couldn't pre-refresh our way to instant
  answers for all of them — we'd still need live, on-demand search for
  anything we hadn't already seen.
- **We'd need a real way to tell "is this the same provider" across
  different searches and different users.** Right now we only skip an
  exact duplicate URL, and only within one conversation. At real
  scale, the same business found two different ways should become one
  saved record, not two.
- **A real confidence score, not just fact / inferred / simulated.**
  Those three labels say what *kind* of information something is, but
  not how much to trust it — a fact from five minutes ago and one from
  six months ago currently look the same. A real score would factor in
  how trustworthy the source is, how recent it is, and whether other
  sources agree.
- **Simulated answers get replaced by real messages to real
  providers — and the honesty rule has to survive that change.** Once
  we can actually email or text a provider, a real reply becomes a
  real fact with its own source and timestamp. It should never
  quietly overwrite the simulated guess that stood in for it before —
  the user should see a card visibly change from "estimated" to
  "confirmed."
- **Cost and rate limits become something we actively manage, not a
  fixed number we picked once.** Right now our limits are hand-tuned
  around one free-tier ceiling, and every LLM call — extracting a fact
  from a page, phrasing a question, simulating an answer — uses the
  exact same model. At real scale, we'd want a budget per user,
  automatic slow-down and retry per provider, and a graceful fallback
  — research fewer providers under heavy load, instead of failing the
  whole request. We'd also match the model to the task: a fast, cheap
  model for simple, high-volume work like reading one page for facts,
  and a stronger model reserved only for the calls that actually need
  deeper reasoning. That alone would cut cost and spread our calls
  across separate limits, instead of every single call competing for
  the same one.
- **Privacy and security become real requirements, not
  assumptions.** Once we're storing real contact details and sending
  real messages on someone's behalf, we need a clear policy for how
  long we keep that data, and a record of who or what triggered every
  outgoing message.
- **Right now, matching what a provider is known for against what the
  user asked for is just literal word matching — not real
  understanding.** A photographer whose listed services mention "bar
  mitzvah photography" won't be recognized as a match for someone
  asking about a bat mitzvah, even though they're clearly doing the
  same kind of work — this only checks the provider's own listed
  services and policies, word for word. At real scale, this would need
  real language understanding instead of plain text matching, so
  closely related terms and event types get recognized as the same
  kind of request, instead of being treated as unrelated just because
  the exact wording differs.
- **Right now every product decision is really a guess about how
  people actually use the app.** There's no real data on where users
  get stuck, which questions they skip, or which screens they never
  reach. At real scale, we'd add real monitoring: session recording
  and analytics to see the actual user journey instead of the one we
  assumed, smart A/B tests to check that a change genuinely helps
  instead of just feeling right, and alerts — both technical (a spike
  in errors or rate-limit failures) and business (a sudden drop in
  conversations that actually reach a recommendation) — so a real
  problem gets caught in minutes, not discovered by accident.
- **Constraining LLM generated service requirements.** The prototype
  uses the LLM to dynamically identify which attributes matter for
  each service and classify their importance. This keeps the system
  flexible across many event service categories without maintaining a
  hardcoded questionnaire. The application still owns workflow
  transitions and search readiness; an LLM classification does not
  directly trigger a state transition.

  In production, I would introduce a small domain-knowledge layer
  containing baseline requirements and importance rules for common
  service categories. The LLM would remain responsible for identifying
  requirements specific to the user's request, especially unusual or
  previously unseen requirements. The application would combine the
  baseline knowledge with the LLM output, validate it, and apply
  deterministic rules for workflow decisions. This would reduce the
  risk of the model incorrectly treating an important requirement as
  optional while preserving the flexibility needed to support new
  service categories.
