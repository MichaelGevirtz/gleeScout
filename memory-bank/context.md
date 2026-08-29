# Project Context

## Overview

GleeScout is a small AI event-planning assistant. A user describes a
service they need for an event (e.g. "I need a bounce house for my
daughter's birthday"), the system holds a conversation to gather the
right requirements for that specific service, researches real
providers on the web, enriches and ranks them, prepares the questions
that would need to be asked before booking, simulates provider
responses to those questions, and presents ranked recommendation
cards.

This is a Software Engineering Lead take-home assignment. The source
of truth for requirements is `docs/Home Assignment.pdf`.

## Assignment Summary (docs/Home Assignment.pdf)

Six functional parts:

1. **Understand the User** — conversational flow that dynamically
   determines which questions matter for the requested service,
   avoids asking what's already known, avoids long static forms,
   maintains structured state behind the conversation.
2. **Find Relevant Providers** — once enough info is gathered, find
   ~3-5 real providers using any research method (search APIs,
   scraping, directories, etc.), extracting structured info (name,
   website, service area, pricing, availability, ratings, reviews,
   photos, policies, contact, etc.).
3. **Enrich and Rank** — go beyond star rating; use additional
   sources/signals to judge fit for *this* event; rank with
   explainable reasoning, not a generic sort.
4. **Prepare the Provider Conversation** — per-provider questions
   that depend on both user requirements and what's already known
   about that provider (don't ask what's already answered).
5. **Simulate Provider Responses** — LLM-simulated responses to those
   questions, clearly and structurally separated from real,
   web-sourced facts.
6. **Present the Recommendation** — provider cards showing who they
   are, why they match, price, rating, confirmed vs. simulated info,
   concerns, and ranking rationale.

## Explicit Assignment Constraints

- No database, no auth, no user accounts, no persistence, no
  production deployment infra. Everything in-memory; state may
  disappear on restart.
- Submit as a GitHub repo, runnable locally, with README +
  DESIGN.md.
- Heavy use of AI coding tools is expected and encouraged.
- Evaluated on: product judgment, AI/agent architecture, engineering
  quality, data & search thinking, trust & grounding (fact vs.
  inferred vs. simulated), taste, ownership. Bonuses are optional —
  a focused solution beats an unfinished broad one.

## Selected Stack (project decisions, not assignment requirements)

- **Backend**: Node.js, TypeScript, Fastify, Zod, npm.
- **LLM**: Google Gemini API, structured output where supported.
- **Web research**: Firecrawl API (isolated behind a research
  provider boundary so it could be swapped).
- **Frontend**: React Native + Expo + TypeScript, mobile-targeted.
- **State**: in-memory only, keyed by session id.

These were chosen for velocity and clean separation of concerns, not
mandated by the assignment. The assignment explicitly permits any
stack and any research source.

## Architecture Principles

- Deterministic application logic owns: structured state, merge
  logic, the "do we have enough info to search" gate, tool
  orchestration/sequencing, dedup, ranking scoring, provenance
  tracking, error handling.
- The LLM owns: understanding user intent, identifying the service
  category, proposing which attributes matter for that category,
  phrasing questions, analyzing unstructured content (reviews),
  generating provider-specific questions, simulating provider
  responses.
- LLM outputs are always validated/coerced into Zod schemas before
  entering application state — the LLM is never the source of truth
  for state, only a contributor to it.
- FACT (observed from a source) / INFERRED (derived from evidence,
  e.g. review analysis) / SIMULATED (LLM hypothetical) are kept as
  distinct, never-merged categories, each carrying provenance where
  applicable.

## Development Process

Strict PIV (Plan → Implement → Validate) loop, see
`.claude/skills/piv-task-management/SKILL.md`. No application code is
written without an approved task file in `tasks/current/`.

## Conventions

- Task files follow the template in the piv-task-management skill.
- Roadmap lives at `memory-bank/roadmap.md`.
- Assignment alignment must be checked for every task via the
  `assignment-review` skill before approval.
