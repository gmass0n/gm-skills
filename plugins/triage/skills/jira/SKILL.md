---
name: jira
description: "Automated Jira triage pipeline that turns small, well-scoped tickets into review-ready Bitbucket PRs without a human writing code. Pull tasks from the boards you name, filter them by size in three discarding gates (description-only filter → in-code pre-triage → plan), open at most 3 draft WIP PRs with a plain-language summary, pause for your approval, then deliver the approved ones through the SDD TDD loop and a blind multi-lens review before flipping each draft to Ready. Use this whenever the user wants to batch-triage Jira tickets, sweep a board for quick wins, auto-open draft PRs for small bugs/chores, run a twice-a-day triage routine, or says 'triage jira', 'pega as tasks simples do board', 'abre os WIP PRs', or invokes /triage:jira — even if they don't spell out every phase. Do NOT use it to implement one specific ticket you already picked (use sdd:spec/plan/implement directly) or to review an existing remote PR (use prs-review)."
---

# Triage — Jira → WIP PR → checkpoint → Ready

## What this skill does and why it is shaped this way

This skill sweeps a Jira board, keeps only the genuinely small and safe tickets, opens a **draft WIP PR per surviving ticket with a plain-language plan**, then **stops and waits for your approval** before any ticket is implemented to completion. Approved tickets are built test-first and reviewed before their draft is flipped to Ready.

The whole design exists to solve one problem: **doing real work on a board without a human in the loop is dangerous unless the work is provably small.** So the pipeline spends its early, cheap phases *throwing tickets away* and only spends expensive effort on what survived. A ticket that is ambiguous, large, or cross-cutting is **rejected, never guessed** — guessing is exactly how an autonomous agent ships a confident wrong change.

You are the **orchestrator, and only the orchestrator.** You never read source code, never write a diff, never run a review in your own context. You dispatch a fresh subagent for each unit of work, read its small structured verdict, and move on. This is not ceremony — it is the single most important mechanism in the skill:

- **It protects the context window.** Raw file bytes, diffs, and SDD skill text stay inside the subagents and die with them. You accumulate only a few lines of verdict per ticket, so you never approach the window limit no matter how many tickets you touch.
- **It prevents hallucination.** A fresh subagent with one sharp brief and only its slice of the work is far less likely to drift than one long-lived context that has absorbed every file it ever read.

Because of this, **two rules are absolute and govern everything below:**

1. **The orchestrator spawns every subagent. A subagent never spawns another subagent.** This is a flat topology, one level deep. Whenever a phase needs parallelism (the lenses, the plan tasks), *you* spawn the units directly — the subagent itself only ever does its own work and returns.
2. **Heavy artifacts go to the filesystem and the PR, never into your context.** Subagents return small JSON-shaped verdicts; the `spec.md`, `plan.md`, diffs, and code live on disk and in the PR.

## Hard limits — what keeps this skill light

These are not suggestions. They are the budget that lets the skill run twice a day without burning tokens or stalling on a giant ticket:

- **At most 3 WIP PRs per run.** The cap is reached in Phase 2 (pre-triage), which runs **sequentially and stops the moment 3 viable tickets are confirmed** — it does not pre-triage all ten. The three carried forward are the smallest/safest, not the first three.
- **Small tickets only.** Phase 1 keeps `PP | P | M`; it rejects `G`, anything it judges complex, and anything ambiguous. Phase 2 re-measures against the real code and drops anything that grew.
- **Cheap before expensive.** Phase 1 never opens a file. The codebase map is read **once** per run (Phase 0) and its digest is injected into later phases so no phase re-reads it.
- **Reject early, reject often.** Three phases can each discard a ticket. Discarding costs almost nothing; building the wrong thing costs everything.

## Model tiers — declare competence, not model names

Each phase declares the *competence* it needs, mapped to a tier in one place so the mapping is trivial to change when models change. Pass the tier to each subagent via the `model` option.

| Tier       | Competence                                          | `model` |
| ---------- | --------------------------------------------------- | ------- |
| `fast`     | mechanical classification, parsing, digest assembly | `haiku` |
| `balanced` | code investigation, planning, implementation        | `sonnet`|
| `deep`     | adversarial judgment, security, review              | `opus`  |

> To re-tier when a new model ships, edit **only this table**. Phases reference tiers (`fast`/`balanced`/`deep`), never model names.

Per-phase tier (cost-optimized — only the review gate pays for `deep`):

| Phase | 0 Briefing | 1 Filter | 2 Pre-triage | 3 Plan | 4 Deliver | 5 Review |
| ----- | ---------- | -------- | ------------ | ------ | --------- | -------- |
| Tier  | `fast`     | `fast`   | `balanced`   | `balanced` | `balanced` | `deep` |

## Inputs

`/triage:jira <boards> [--status=<status>]`

- `<boards>` — comma-separated Jira board/project keys (e.g. `SUS`, `CL,DEL`). A scheduled routine hard-codes its boards. No boards given and none configured → ask once which boards to sweep, then proceed.
- `--status=<status>` — optional. The Jira status to sweep. **Defaults to `Priorizado`** when omitted — that is the intended entry queue: tickets a human already prioritized, so they're the safe pool to triage. Pass a different status only to override for a one-off run. The scheduled routine hard-codes both boards and status.

## Preconditions — refuse rather than guess

- **Jira (atlassian-rovo) not authenticated** → stop and tell the user to authenticate the Jira MCP first; do not fabricate a ticket list.
- **Bitbucket MCP unavailable** → stop; the skill cannot open PRs.
- **No `docs/codebase/` map in a target repo** → fidelity is weaker for that repo (the digest carries less). Note it in the ticket's verdict and proceed; don't hard-stop the whole run. The map is a backend-repo convention and may legitimately be absent in a client repo like `pdv-app`.

## Language

Everything is **English** — your narration, branches, commits, PR titles, `spec.md`, and the technical body of `plan.md` — **except** two human-facing pieces that are **Brazilian Portuguese**: the `plan.md` summary block and the **PR description**. This keeps `sdd:implement`/`sdd:review` (which require English plans) working while the human reads the summary in their language.

---

# The pipeline

Run the phases in order. After each phase, you hold only small verdicts. Read `references/phase-playbook.md` for the exact subagent briefing template, the verdict JSON shapes, and the SDD skill paths each phase must point its subagents at.

## Phase 0 — Briefing (read the codebase once)

Spawn **one** `fast` subagent to read `docs/codebase/context.md` (selectively — only the entries relevant to a backend ticket) plus the project's confirmed lessons (`docs/codebase/lessons/`, if present), and return a **compact digest**: the layer rules, the enforced invariants, the naming/test conventions, and the top recurring lessons. Hold this digest and inject it into every later subagent so no one re-reads the map. This single read is the biggest token saving in the skill.

## Phase 1 — Filter (description only, never opens code)

Fetch the candidate tickets from the named boards, filtered to the requested status (default `Priorizado`). Spawn **one** `fast` subagent that receives **all** the tickets at once and classifies each **from its description alone** — it must not read code. For each ticket it returns a size (`PP|P|M|G`), a one-line reason, and a guessed target repo.

Drop `G`, anything flagged complex, and anything **ambiguous** — a ticket with no identified root cause (an open-ended "investigar/analisar"), one that asks a human to "define which rule applies", an empty description, or an operational data fix that isn't a code change. Ambiguity, not just size, is a rejection reason: an autonomous agent must not guess a fix that the ticket itself hasn't pinned down. Keep `PP|P|M` that are unambiguous, **ordered smallest first**. One subagent handles all tickets at once because classification is trivial text work — spawning one per ticket would waste tokens for no isolation benefit.

The subagent also tags each ticket's **`nature`** (`backend` | `pdv-app` | `unknown`) — where the change lives. This is **signal only; it does not filter.** The size filter is the sole gate here. `nature` is carried forward so Phase 2 knows which repo family to clone (a `pdv-app` ticket lives in the POS client repo, not this backend), and so you can see the mix at the checkpoint. A small, well-scoped `pdv-app` fix is a valid candidate — it is not dropped for being a client-app change.

## Phase 2 — Pre-triage (enter the code, stop at 3)

Walk the kept tickets **sequentially, smallest first**. For each, spawn **one** `balanced` subagent that identifies the target repo, clones it, investigates the real code, measures the **real** size, and writes a lean `spec.md` derived from the ticket (its description and acceptance criteria stand in for the human interview the SDD spec phase normally runs).

**The target repo is often NOT the local working directory.** A ticket may belong to any repo the team owns (this backend, a sibling backend like customer-api/BFF/portal, or the `pdv-app` client). The subagent has full Bitbucket access, so it must **find and clone the right repo on demand** rather than assume the local one:

- **Discover the repo.** List the workspace repos via the Bitbucket MCP and match the ticket's `nature` + description to the most likely slug (`pdv-app`, `seru-customer-api`, …). If the local repo already is the target, use it.
- **Clone on demand.** Clone the target repo into a temporary worktree/dir and investigate the real code there. Phase 3/4 work in that clone. **Never reject a ticket just because its code isn't in the local directory** — that's an access detail, not a size signal.

Each pre-triage subagent then applies two safety filters and returns `viable: false` if either fails:

- **Scope brake.** Size is measured by the *change*: if the fix would touch more than a handful of files, or understanding it needs opening many files, it is not small — reject it. This is measured against the cloned target repo, never against "is the code local?". This brake is also what guarantees no subagent ever fills its window: small-by-construction tickets are the only ones that survive.
- **Multi-repo coupling.** Number of repos is *not* the measure of size — a one-line change across three repos is still small. The real risk is **coupling**: if the change is *isolated per repo* (the same edit applied independently, e.g. a shared constant or config), allow it up to a ceiling of **3 repos**. If the change crosses a *contract* between repos (an API change in one that a consumer in another must track), reject it to the human bucket regardless of line count — coordinating an interface across repos is exactly where an autonomous agent breaks runtime behavior no unit test catches.

**Stop the instant 3 tickets are confirmed viable.** Do not pre-triage the rest; they wait for the next run.

## Phase 3 — Plan + open the WIP PR

For the (≤3) viable tickets, spawn that many `balanced` subagents **in parallel** (you spawn them; they do not spawn anyone). Each subagent:

1. Reads `sdd:plan/SKILL.md` and **follows its method** to turn the `spec.md` into a `plan.md` (English body) — design anchored to the digest, REQ-IDs, atomic tasks with TDD steps, a coverage matrix. It executes the method itself; it does not invoke the skill (a subagent cannot spawn the sub-subagents `sdd:plan` would).
2. If the ticket cannot be planned without an open `[NEEDS CLARIFICATION]`, it still proceeds but marks the PR **"needs manual follow-up"** — the PR is created, but it will not be auto-delivered in Phase 4.
3. Creates the branch (`type/JIRA-KEY-short-desc`), commits the `docs/specs/<JIRA-KEY>/` artifacts, and opens a **draft WIP PR** on the inferred repo with title `[TYPE] #JIRA-KEY - Description` and a **Portuguese** description carrying a short plain-language summary of what the ticket is and how it will be implemented.

Returns only `{ key, pr_url, size, summary_ptbr, needs_clarification }`.

## Checkpoint — hand back to the human

**Stop here.** Present the (≤3) WIP PRs: ticket key, size, the Portuguese summary, the PR link, and any "needs manual follow-up" flag. Ask which ones to take all the way to Ready. The state lives in the open PRs and committed artifacts, so if the session ends, a later run resumes from the PRs. **Nothing past this point runs without the human's explicit approval.**

## Phase 4 — Deliver (only approved tickets)

For each approved ticket, spawn **one** `balanced` subagent that reads `sdd:implement/SKILL.md` and **runs its TDD loop inline** in its own context — write the failing test, watch it fail, make it pass, refactor, commit — then runs the repo gates. It executes the loop itself rather than invoking the skill, because the skill is an orchestrator that would need to spawn sub-subagents, which rule 1 forbids; small tickets are exactly the inline ramp-down the skill itself permits.

**Gates are stack-agnostic — detect, don't assume.** The target repos span stacks (Node backends, an Android PDV client, others). The subagent detects the stack from the cloned repo and runs that stack's real gates: Node (`package.json`) → the project's `test`/`typecheck`/`lint` scripts (jest, etc.); Android (`build.gradle`) → `./gradlew test`/`lint` (JUnit); and so on. The Phase 2 verdict already recorded the stack — pass it in the briefing. Never run `npm test` against a Gradle project; a wrong gate is a false green. If a repo genuinely has no test harness, say so in the verdict rather than faking a pass.

The implementation code follows **ponytail** discipline: fix the root cause (grep the callers, not just the path the ticket names), reach for stdlib/existing helpers before new code, and ship the smallest diff that works — no scaffolding that the review will only have to flag and tear out.

The subagent **re-anchors on the live branch** before editing (line numbers from Phase 2/3 may be stale) and, after committing, **refreshes the PR description** so it reflects the delivered fix + tests instead of the plan-only text Phase 3 wrote.

Returns `{ key, status, tests, commits }`.

## Phase 5 — Review gate (blind, before Ready)

This is the quality gate; a draft becomes Ready **only** after it passes clean. To preserve the blind, independent lenses that make `sdd:review` rigorous **without** any subagent spawning another, **you** spawn the lenses directly, one subagent per lens, in parallel, each blind to the others:

- correctness/edge-cases, security, performance, architecture/DRY, and spec-alignment (only when the ticket's `spec.md` exists).
- Each lens subagent reads `sdd:review/SKILL.md` + `references/review-lenses.md` for its dimension's checklist **and its "what NOT to flag" blocklist** (the single biggest false-positive reducer), judges only its slice, and returns grounded `file:Lline` findings.

Collect the findings. If any blocker/warning/nit survives:

1. Spawn **one** `balanced` fix subagent to resolve them (ponytail discipline).
2. **Re-review by spawning a fresh set of lens subagents** — a new attempt is always fresh context, never a reused one.
3. **At most 2 review→fix cycles.** Clean within budget → **publish the draft as Ready**. Still failing after 2 cycles → leave it draft, write the open findings into the PR, and tell the human. Don't loop forever on a stubborn ticket — that defeats the lightweight goal.

Returns `{ key, verdict, ready, open_findings }`.

---

## Final report

After the run, give the human a compact summary: which tickets were swept, which were dropped and why (size, ambiguity, coupling), the ≤3 WIP PRs opened, which were approved, and for each approved one its final state — Ready, or still-draft with open findings. That report is the proof of what the run did.

## Anti-patterns — do not do these

- **Don't let a subagent spawn a subagent.** If a phase needs parallel units, you spawn them.
- **Don't pull source, diffs, or full plans into your context.** Verdicts only; artifacts to disk/PR.
- **Don't re-read the codebase map per phase.** Read once in Phase 0, inject the digest.
- **Don't pre-triage all ten tickets.** Stop at 3 viable.
- **Don't auto-deliver a ticket with an open `[NEEDS CLARIFICATION]`** or a cross-repo contract change — those are the human's call.
- **Don't flip a PR to Ready before the review passes clean.**
- **Don't guess an ambiguous ticket into a plan.** Ambiguous = rejected. That refusal is the safety feature, not a failure.
- **Don't trust a line number from an earlier phase.** Branches move; a `file:123` from Phase 2 may be `file:456` by Phase 4. Every phase re-anchors on the symbol/pattern in the *current* branch before editing or citing.
- **Don't leave a Ready PR describing work that's already done as "not yet implemented."** Phase 3 opens the PR with a plan-only description; Phase 4 must refresh it to state what was actually changed, tested, and gated — otherwise the human reviewer is misled.
