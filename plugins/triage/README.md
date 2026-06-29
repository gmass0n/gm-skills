# triage

Automated **Jira → Bitbucket** triage pipeline for small, well-scoped tickets.

It sweeps the boards you name, throws away everything that isn't genuinely small and safe, opens **at most 3 draft WIP PRs** with a plain-language plan, then **stops and waits for your approval** before building anything to completion. Approved tickets are implemented test-first and pass a blind multi-lens review before their draft is flipped to **Ready**.

## Why it exists

Doing real work on a board without a human in the loop is only safe when the work is *provably small*. So the early, cheap phases spend their effort **discarding** tickets, and only what survives gets expensive effort. Ambiguous, large, or cross-repo-coupled tickets are **rejected, never guessed** — guessing is how an autonomous agent ships a confident wrong change.

It reuses the **method** of the `sdd` plugin (plan / implement / review) without reintroducing its human-in-the-loop interview: the Jira ticket *is* the spec, and the codebase map provides the fidelity.

## Design guarantees

- **Flat agent topology.** One orchestrator spawns every subagent; a subagent never spawns another. This protects the context window (only tiny verdicts reach the orchestrator) and curbs hallucination (each subagent has one sharp brief and its own slice).
- **Read the codebase once.** The map is digested in Phase 0 and injected downstream — no phase re-reads it.
- **3 discarding gates + 1 human gate.** Filter, pre-triage, and plan can each drop a ticket; you approve before delivery.
- **Cost-tiered models.** `fast` for mechanical work, `balanced` for code, `deep` only for the review gate.

## Usage

```
/triage:jira CL,DEL          # sweep boards CL and DEL
```

A scheduled routine can call it twice a day with its boards hard-coded; it runs through the checkpoint and notifies you to approve.

**Prerequisites:** Jira (atlassian-rovo) MCP authenticated, Bitbucket MCP connected, and a `docs/codebase/` map in the target repo (run `sdd:codebase` if missing).

## Workflow — step by step

```
            ┌─────────────────────────── ORCHESTRATOR (you, single context) ───────────────────────────┐
            │  spawns every subagent · holds only small verdicts · subagents never spawn subagents       │
            └───────────────────────────────────────────────────────────────────────────────────────────┘

 PHASE 0  Briefing            [fast · 1 subagent]
          read docs/codebase/ + lessons ONCE  ──▶  compact digest  (injected into every later phase)

 PHASE 1  Filter              [fast · 1 subagent, all tickets at once]
          ~10 Jira tickets ──▶ classify by DESCRIPTION ONLY (never opens code)  ──▶  PP|P|M kept, G/ambiguous dropped
                                                                                     │ (sorted smallest-first)
 PHASE 2  Pre-triage          [balanced · sequential, 1 subagent/ticket, STOP at 3 viable]
          enter the code, measure REAL size, write spec.md
          ├─ scope brake: too many files            ──▶ reject
          ├─ multi-repo: isolated ≤3 ok / contract  ──▶ reject coupled
          └─ 3 viable confirmed                      ──▶ stop, carry 3 forward

 PHASE 3  Plan + WIP PR       [balanced · up to 3 subagents in PARALLEL]
          follow sdd:plan method ──▶ plan.md (EN) ──▶ branch type/KEY-desc
          commit docs/specs/KEY/ ──▶ open DRAFT WIP PR on inferred repo (PT-BR description)
          [NEEDS CLARIFICATION] ──▶ PR still opened, marked "needs manual follow-up"

 ══════════ CHECKPOINT (human) ══════════
          show ≤3 WIP PRs: key · size · PT-BR summary · link · flags
          YOU approve which ones go all the way to Ready   ◀── nothing past here runs without approval

 PHASE 4  Deliver             [balanced · 1 subagent/approved ticket]
          follow sdd:implement method ──▶ TDD loop INLINE (RED ▶ GREEN ▶ refactor ▶ commit)
          ponytail code (root cause, stdlib-first, smallest diff) ──▶ gates: test + typecheck + lint

 PHASE 5  Review gate         [deep · orchestrator spawns 1 subagent PER LENS, blind, parallel]
          correctness · security · performance · architecture · spec-alignment
          findings? ──▶ fix subagent ──▶ RE-REVIEW with fresh lenses   (max 2 cycles)
          clean  ──▶ publish draft as READY ✅
          still failing after 2 cycles ──▶ leave draft + post findings + notify human

 REPORT   swept · dropped (with reasons) · WIP PRs · approved · final state per ticket
```

## Files

```
triage/
├── README.md
├── .claude-plugin/plugin.json
└── skills/jira/
    ├── SKILL.md                       # orchestration contract: phases, spawn rules, tiers
    └── references/phase-playbook.md   # subagent briefings, verdict shapes, SDD method paths
```
