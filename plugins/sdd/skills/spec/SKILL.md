---
name: spec
description: "Use to turn a feature idea into a complete, unambiguous specification — Phase 1 (SPECIFY) of the SDD workflow, before any planning or code. Run a relentless one-question-at-a-time interview (grounded in docs/codebase/context.md), then write docs/specs/<feature>/spec.md with user stories, EARS requirements carrying stable REQ-IDs, acceptance criteria, out-of-scope, the interview's decisions, and any open clarifications. Trigger whenever the user wants to spec a feature, write requirements, capture what to build, or says \"spec out X\", \"let's define this feature\", \"what should this do\" — and always before sdd:plan. The interview will not finish while any ambiguity is unresolved, so the resulting spec is safe to plan against."
---

# SDD — Specify (Phase 1)

## What this phase produces

One file: `docs/specs/<feature>/spec.md`. It is the **contract of WHAT to build and WHY** — observable behavior, not implementation. A good spec survives a complete rewrite of the code: if a requirement can only be written by knowing which class exists, it is design (Phase 2), not spec.

The spec is the root of the SDD proof chain. Every requirement gets a stable **REQ-ID**, and later phases prove that each REQ-ID maps to a task, a test, and a passing run. So the single most important property here is: **no requirement is vague, missing, or silently assumed.** That is what the clarification loop below guarantees mechanically.

This phase reads the codebase map but never writes to it. It only writes under `docs/specs/<feature>/`.

## Before the interview — ground yourself

Read `docs/codebase/context.md` first. It gives you the stack, the enforced invariants, and per-task loading pointers — so your questions are about *this* project, not a generic one, and so you never propose behavior the project's patterns forbid.

- If `docs/codebase/context.md` does not exist → tell the user the map is missing and recommend running `sdd:codebase` first. You can still proceed, but say the spec is ungrounded.
- If it exists but a doc relevant to this feature looks stale (its `sources` paths changed since its `generated:` date) → recommend `sdd:codebase diff` before specifying, so you're not building on a false premise.

**Detect and lock the conversation language now.** Detect the language of the user's initiating prompt and save it. The effect splits: the entire interview, every question, and ALL live narration to the user use the detected language (Portuguese or English) — never mix languages or switch on the user who started the conversation. But **`spec.md` itself is always written in English**, regardless of the detected language. Record the choice in the spec's frontmatter (`lang: pt` or `lang: en`); `lang:` records the conversation/narration language only, not the file's language. `sdd:plan` reads it and never re-detects.

## The interview — relentless, one question at a time

Interview the user relentlessly about every aspect of the feature until you reach a shared, unambiguous understanding. Walk down each branch of the design tree, resolving dependencies between decisions one by one.

**Core rules of the interview:**
- **One question at a time.** Asking several at once is bewildering and produces shallow answers. Wait for the answer before the next question.
- **Always carry your recommendation.** For every question, you already did the thinking — present the option you'd choose first, marked as recommended, with the reasoning. The user is reacting to a proposal, not generating an answer from scratch.
- **Explore the code instead of asking, whenever you can — via a subagent, never in your own context.** If a question is answerable by reading the repo (how does the existing auth guard work? what shape does the SERU client return?), dispatch an `Explore` subagent to find it and return just the answer. You stay the orchestrator: the interview and `spec.md` are yours (they need the user), but code reading is delegated so the raw file bytes never accumulate in your context. Only ask the user what the code cannot tell you — product intent, priorities, trade-offs, things not yet decided.
- **Ask via the native question UI.** Use the `AskUserQuestion` tool so the user gets selectable options, can add notes, and can step away — the same feel as a brainstorming session. Free-text prose questions invite you to fill the silence with an assumption; structured options make the user's choice explicit. Put the recommended option first and label it in the detected language ("(recomendado)" for a PT-BR session, "(recommended)" for an English one).
- **Challenge the prompt's premises against the code.** The user's initiating prompt states assumptions about the system as fact ("the company has no address", "the upstream doesn't return X", "there's no geocoding anywhere"). Treat each one as a claim to verify, not a given — dispatch an `Explore` subagent to confirm it before building on it. A wrong premise silently rewrites the whole scope: the most valuable moves in an interview often come from discovering the prompt was wrong (an upstream field that *does* exist, a service that already owns this responsibility). When the code contradicts the prompt, surface it with the evidence and let the user re-decide.

The interview ends only when the spec has **zero** open clarifications (see the loop below) and the user confirms the picture is complete.

## Interview depth — exhaust the tree, don't sample it

The spec is where correctness is *bought* for the whole SDD chain. Every question you fail to ask here becomes an assumption the plan inherits, a test nobody writes, and a behavior nobody validates. `sdd:plan` and `sdd:implement` can only prove what the spec made explicit — they cannot recover a requirement the interview never surfaced. So the bias is unambiguous: **ask the maximum number of useful questions and offer the maximum number of grounded suggestions.** A longer interview that closes every branch is cheaper than a short one that ships a silent gap into code. Err toward over-asking; the user can always say "that's obvious, skip it", but they cannot retroactively fill a hole you assumed away.

Concretely, walk every branch to its leaves: happy path **and** every edge (empty, failure, timeout, pagination boundary, the historical/legacy record, the "other type" of entity). For each behavior, ask not just "what" but "what when it goes wrong", "what at the limit", "what for the pre-existing data". Surface options the user hasn't thought of — that's what "suggestion" means here, not just picking among what they named.

Four interview behaviors that protect the chain:

- **Resolve scope/framing before product detail.** First settle the boundary questions — which repos/layers this touches, what's frontend vs backend, what's explicitly out — *before* drilling product behavior. A product answer decided under the wrong frame is wasted. **When the feature touches more than one repo, resolving the repo topology is not advice — it is the mandatory FIRST step, before any product detail.** Run the boundary question per repo: does this repo **PRODUCE**, **TRANSFORM**, or **CONSUME** the new data/contract? Producer mints it, transformer reshapes/forwards it, consumer reads it. Those roles order the repos into a chain (produce → transform → consume), and that chain — not prose — is what you write into `## Repos involved` (see "Multi-repo topology" below). Single-repo features skip this entirely. (Here: the `operational-map` chain locations-api → customer-api → BFF → portal had to be settled before anything else made sense — geocoding *produced* in locations-api, *transformed*/forwarded through customer-api and the BFF, *consumed* in the portal.)
- **When a new fact invalidates a settled decision, recompute the cascade.** Decisions depend on each other. When exploration or a user answer overturns an earlier one, do not leave the spec contradictory — reopen every decision and REQ that depended on it and rewrite them, leaving a "supersedes the previous decision" trace so the history is legible. A spec that contradicts itself is worse than one with open markers. (Here: geocoding moved repos three times — BFF → customer-api → locations-api — each move rewrote the affected D-items and REQs.)
- **When the user delegates the decision back to you, deliver a verdict — don't bounce it.** If the user answers "which is best?" / "you decide" instead of choosing, that is not permission to skip the decision; it is a request for your reasoned recommendation. Give a grounded verdict with the trade-off, and for a technical choice of real consequence (a library, a provider, an architecture), back it with a quick market/community check (`WebSearch`) rather than training-memory alone. Then record it as a decision. (Here: the map library and the geocoder were both delegated and resolved with a researched verdict.)
- **Check each answer against the decision log before persisting it.** Before writing a user's answer into the spec, scan whether it contradicts a decision already recorded. If it does, surface the tension *before* persisting and let the user reconcile — they may have misclicked, or the new answer may be the one that forces a cascade. Never silently write a contradiction. (Here: a multi-company answer collided with the already-settled "line connects order to its store" decision; raising it caught a misselection.)

## Multi-repo topology — a first-class artifact, not prose

**Condition: only when the feature touches more than one repo.** Single-repo features omit the `## Repos involved` block entirely and tag no REQs — the spec is byte-identical to the single-repo shape. Everything in this section is conditional on that gate.

The old failure was treating the repo chain as narrative: the interview settled "this crosses 4 repos" in prose, then `sdd:plan` re-discovered each repo's local root, slug, base branch, and clone path from scratch. The fix: **the multi-repo analysis is born here, in the spec, as a parseable record the plan reads directly.** The plan inherits the topology; it never re-derives it.

Two artifacts come out of the boundary question above:

1. **`## Repos involved`** — a parseable table the plan reads verbatim. One row per repo, ordered along the chain, plus a one-line `Chain:`. Columns:
   - `tag` — short handle (`LOC`, `CUS`, `BFF`, `POR`) used to tag REQs and, later, tasks.
   - `repo (slug)` — the real repo slug (`pos-facil-api`, etc.), not a friendly name.
   - `role` — `produces` / `transforms` / `consumes` (from the boundary question).
   - `base branch` — `master` / `develop` (where this repo's feature branch forks from).
   - `cloned?` — `yes` / `no` / `<where>` (is the repo cloned locally, and where — so the plan doesn't re-discover it).

   Settle each cell during the interview (dispatch an `Explore` subagent for slug/base-branch/clone facts the code or filesystem can answer; ask the user only product-intent gaps). Any cell you can't pin down is an ambiguity → `[NEEDS CLARIFICATION]`, same loop as everything else.

2. **REQ→repo map.** Every requirement names which repo satisfies it by appending its tag: `… SHALL … (repo: BFF)`. This is the seam the plan reads to derive each task's `Repo:` field — **say it plainly so the plan-side skill can rely on it: the plan does not guess a task's repo, it carries up the tag from the REQ that task implements.** A REQ spanning two repos splits into two REQs (one per repo) rather than carrying two tags — keeps the map one-to-one and the chain legible.

See `templates/spec.template.md` for the materialized block and a tagged-REQ example.

## External contract — confirm it, never assume it

**Condition: only when the feature integrates with or depends on an external API** (a payment gateway, an upstream service, a third-party SDK). Features with no external contract skip this entirely.

An unconfirmed external contract that leaks forward as fact is one of the most expensive spec failures: the plan inherits a premise it can't verify cheaply and only discovers the lie when code fails. So before you close the spec, confirm the real endpoints, payload fields, and events against the official doc — dispatch a `WebFetch` (or `WebSearch`) so the raw doc bytes never pile into your context, and keep only the confirmed shape.

`[UNVERIFIED]` is the standard mark for **any external contract detail you have not confirmed against a source** — a field, a route, a webhook event — not just SERU DTO fields. A REQ resting on an `[UNVERIFIED]` contract is valid in the spec, but the marker rides down to `sdd:plan`, which must confirm it before any code depends on it. The rule that protects the whole chain: **never state an external field/route/event as fact without a source.** If the doc doesn't confirm it, it's `[UNVERIFIED]` — a silent premise, not a verified contract.

## The clarification loop — the heart of this phase

The danger with "always give a recommendation" is that an unanswered recommendation becomes a **silent decision**. The clarification loop is the guard against that: where the spec is underspecified, you **mark it, you do not guess.**

```
loop:
  ├─ ask the next question (with recommendation, via AskUserQuestion)
  ├─ new ambiguity surfaced and NOT resolved this turn?
  │     → write a [NEEDS CLARIFICATION: <specific question>] marker into spec.md NOW
  ├─ ambiguity resolved?
  │     → update spec.md, remove its marker, record the decision in "Interview decisions & constraints"
  └─ exit condition: spec.md has ZERO [NEEDS CLARIFICATION] markers AND user confirms complete
        ↑ only here may the interview finish
```

**Persist incrementally — this is non-negotiable.** The moment you detect an ambiguity, write its `[NEEDS CLARIFICATION]` marker into `spec.md` on disk. Do not hold markers in your head to write at the end. Why: if the session dies mid-interview (crash, `/clear`, the user steps away), the spec on disk reflects the true state — which questions are still open. When the user comes back and re-invokes `sdd:spec`, you read the pending markers and **resume the loop only on what's open**, without reopening settled decisions or losing them.

So `spec.md` is the source of truth for clarification progress, not the conversation. This gives you resumability for free, and it's why the spec is always safe to leave half-finished.

**Marker convention.** Use `[NEEDS CLARIFICATION: question]`. For unconfirmed external-contract details (any field/route/event not yet confirmed against a source — see "External contract" above) use `[UNVERIFIED]`, so the markers read consistently with code the team already writes and the plan knows to confirm before coding.

## Writing spec.md

Follow `templates/spec.template.md`. The required shape:

```markdown
---
title: <feature>
lang: pt | en          # conversation/narration language detected from the prompt; spec.md content is always English. sdd:plan inherits this
status: draft | ready  # "ready" only when zero [NEEDS CLARIFICATION] remain
generated: <data>
---

# Spec: <feature>

## Context & goal
<why this exists, what user problem it solves. 2-3 sentences. No code.>

## Repos involved
<ONLY multi-repo; in single-repo OMIT this whole section. Parseable table the plan reads directly.>
| tag | repo (slug) | role | base branch | cloned? |
|-----|-------------|------|-------------|---------|
| LOC | locations-api | produces | master | yes |
| CUS | pos-facil-api | transforms | master | yes |
| BFF | seru-delivery-api | transforms | develop | yes (this repo) |
| POR | seru-delivery-portal | consumes | develop | no |

Chain: LOC → CUS → BFF → POR

## User stories
- US-1: As a <persona>, I want <capability> so that <benefit>.

## Requirements (EARS, with REQ-IDs)
<each requirement is testable and observable. EARS: WHEN/WHILE/IF ... THE system SHALL ...
 Multi-repo: each REQ ends with (repo: <tag>) — the plan derives the task's Repo: from here.
 Single-repo: no tag.>
- REQ-1: WHEN <event>, THE system SHALL <observable behavior>. (repo: BFF)
- REQ-2: WHILE <state>, THE system SHALL <behavior>. (repo: LOC)

## Acceptance criteria (per requirement)
- REQ-1: given <context>, when <action>, then <verifiable result>.

## Out of scope
- <what explicitly does NOT belong — closes the door to scope creep>

## Interview decisions & constraints
<decision log: the conditioning-HOW settled in the grill that the plan must inherit
 but is not a requirement. Each line: the decision + why + affected REQ.>
- D-1: <decision> — because <reason>. Affects REQ-x.

## Open clarifications
<the [NEEDS CLARIFICATION] still open. When empty, status becomes "ready".>
```

**Why both "Interview decisions & constraints" and "Open clarifications" exist:** they are opposite halves of the handoff. "Open clarifications" is what's still *open* (the plan must not start until it's empty). "Interview decisions & constraints" is what was *closed during the interview* — choices like "SSE passthrough, not polling" or "Finished maps to 'closed'" that are technical-conditioning but not requirements. Without the decision log, those choices evaporate and `sdd:plan` re-derives or contradicts them. The spec stays "WHAT", but it carries forward the constraints the conversation settled.

## Requirement quality — a cheap check inside the loop

A requirement that passes the coverage matrix but is untestable is a false green. As you write each REQ, sanity-check it: does it have a measurable, observable criterion? "low latency" is not testable; "p95 < 200ms" is. If a REQ has no measurable threshold, that's an ambiguity — mark it `[NEEDS CLARIFICATION: what is the number?]` rather than letting it through. This is the "unit test for English" applied per requirement, folded into the loop you already run — not a separate step.

**When the spec has multiple composing time windows** (retry, grace period, expiry, timeout, TTL), sum them explicitly and validate the total against the user's intent before closing — sequential vs parallel changes the answer. Ask it plainly: "retry 7d + grace 5d — parallel or sequential? is the ceiling until suspension 8 or 15 days?". The act of adding them up is what catches a window silently stacked in series when the user meant it in parallel.

## Validation diagram — draw it to find the gaps

A diagram is a discovery tool, not decoration: the act of drawing the flow exposes missing transitions, orphan states, and badly composed time windows that prose hides (the 15-day timing bug above surfaced exactly this way). Draw an ASCII (or mermaid) diagram **whenever it helps validate the shared understanding**, walk it through *with the user* to close the picture before marking `ready`, and include it in `spec.md` as a reference the plan inherits.

Pick the type by what the spec *is*:
- **state diagram** — a lifecycle/status that transitions (subscription active → grace → suspended → cancelled).
- **sequence diagram** — components/repos/services interacting over time (multi-repo chain, request → webhook → callback).
- **flowchart** — a process with decisions and branches.

Skip it for trivial specs (linear CRUD, no state) — YAGNI.

## Finishing — the handoff

When the loop exits (zero clarifications, user confirms):
1. Set `status: ready` in the frontmatter.
2. Confirm `spec.md` has REQ-IDs, acceptance criteria, the decision log, and an empty "Open clarifications". **Multi-repo: also confirm the `## Repos involved` table is complete (no unresolved cells), the `Chain:` line is present, and every REQ carries a `(repo: <tag>)`.**
3. Hand off explicitly: tell the user the spec is ready at `docs/specs/<feature>/spec.md` and the next step is `sdd:plan <feature>`. There is no orchestrator that chains automatically — the handoff line is how the user knows where they are. **In multi-repo, what descends to the plan is DATA, not just a command: the `## Repos involved` record, the `Chain:` chain, and the REQ→repo map. The plan reads the topology from these — it does not re-discover root/slug/branch/clone per repo. State this in the handoff line so the user knows the topology is already settled.**

## What this skill must not do

- **No code, no design.** No class names, no file layout, no "we'll use an Observable". That is `sdd:plan`. If you catch yourself writing HOW, move it to the decision log as a constraint or drop it.
- **No writing outside `docs/specs/<feature>/`.** The codebase map is read-only input.
- **No reading repo source in your own context.** Delegate code exploration to an `Explore` subagent and keep only its answer. The main agent orchestrates the interview; it doesn't fill itself with file bytes.
- **No finishing with open ambiguity.** The loop exists precisely so the spec can never be "done but vague".
- **No language drift in the conversation.** Interview and live narration stay in the detected language; never switch on the user. (The `spec.md` file is always English regardless.)

## Common mistakes

| Mistake | Fix |
|---|---|
| Asking five questions in one message | One at a time, each with your recommendation, via AskUserQuestion. The user reacts; they don't author. |
| Letting an unanswered recommendation become the decision | Unresolved → `[NEEDS CLARIFICATION]` marker, persisted now. Silence is not consent. |
| Writing requirements that mention classes/files | That's design. Spec is observable behavior that survives a rewrite. |
| Holding clarifications to write at the end | Persist each marker the moment it surfaces — the spec on disk must always be resumable. |
| Vague requirement with no measurable criterion | Mark it for clarification. "Fast" needs a number to be testable. |
| Mixing PT and EN, or switching the conversation language mid-interview | Lock the conversation language from the initiating prompt; record it in `lang:`; never switch on the user. `spec.md` content stays English regardless. |
| Asking what the code already answers | Read the repo. Reserve questions for product intent and trade-offs. |
| Taking the prompt's claims about the system as fact | Verify each premise via an `Explore` subagent. A wrong premise rewrites the scope — surface the contradiction with evidence. |
| Sampling a few questions and declaring "enough" | Exhaust every branch (edges, failures, limits, legacy data). Over-ask; an unasked question is an untested behavior downstream. |
| Bouncing "you decide" back to the user | Deliver a reasoned verdict; research it (`WebSearch`) for consequential technical choices; record it as a decision. |
| Leaving the spec contradictory after a new fact | Recompute the cascade — rewrite every dependent decision/REQ with a "supersedes the previous decision" trace. |
| Persisting an answer that contradicts a settled decision | Check each answer against the decision log first; surface the tension before writing it. |
| Leaving the repo chain as prose in a multi-repo feature | Topology is the FIRST step: fill `## Repos involved` (tag/slug/role/branch/cloned + `Chain:`) and tag every REQ `(repo: <tag>)`, so the plan inherits it instead of re-deriving. |
| Treating an unconfirmed external API contract as fact | Confirm it via official doc/`WebFetch`; whatever you can't confirm becomes `[UNVERIFIED]` and rides down to the plan — not a silent premise. |
| Composing time windows without validating the total | Sum them and ask the user: do they compose in parallel or in series? Confirm the aggregate SLA (8 days vs 15 days is the difference). |
| A state-machine spec with no diagram | Draw the states/transitions; it's where timing and transition gaps show up. Pick the type (state/sequence/flowchart) by what the spec is. |
