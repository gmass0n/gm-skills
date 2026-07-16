---
name: plan
description: Turn a ready SDD specification into an executable implementation plan.
disable-model-invocation: true
---

# SDD — Plan

*You have already been invoked; these instructions are now active context, not a pending action. Do not call the Skill tool to invoke this skill again.*

Convert a ready `docs/specs/<feature>/spec.md` into the implementation contract at `docs/specs/<feature>/plan.md`.

You are a pure orchestrator: you decide, direct, and gate — subagents read, write, and fix. Data between phases travels through files under `docs/specs/<feature>/.plan-work/`; your context carries pointers and structured summaries, never file bodies. Every subagent returns in one shape: structured findings/decisions with `file:line`, the path of any artifact it persisted, and one count line for checks that passed clean.

## Preconditions

- Require `status: ready`, zero clarification markers, testable REQ-IDs and acceptance criteria. Require `docs/codebase/context.md`; direct subagents to the linked documents relevant to each requirement.
- For a multi-repo spec, take the topology, chain, base branches, and REQ tags verbatim from `## Repos involved`. Do not rediscover or alter them.
- Confirm every marked `[UNVERIFIED]` external contract against its official source before code can depend on it. Stop and return to the user if a material ambiguity remains.

## Design from evidence

1. Orchestrate focused investigation through subagents; the orchestrator synthesizes their findings and does not read raw source itself. Each investigator persists its full evidence to `.plan-work/<topic>.md` and returns only its summary in the shape above.
2. Design the smallest change consistent with map invariants, existing patterns, the specification, and real callers. State each decision, its REQ IDs, and `file:line` evidence.
3. For multi-repo work, freeze only verified cross-repo interfaces: producer, transformer, consumer, route/event, request/response shape, ownership, compatibility, and validation boundary.

## Write executable tasks

1. Delegate writing `plan.md` to one writer subagent: it reads [the plan template](templates/plan.template.md), the spec, and `.plan-work/`, receives your design decisions in its prompt, writes `plan.md` as `draft` conforming fully to the template, and returns the task IDs with repos and batches plus any coverage gaps. The template is the writer's contract; the orchestrator directs by the summary it returns.
2. Give every task a stable ID, repository, dependencies, mapped REQs, exact files/patterns, and TDD steps sufficient for a fresh executor. Keep implementation order separate from dependency order. For multi-repo work, make `L-0` explicit: one executable `T-0-<repo>` per registry repo that validates clone, base, worktree, and branch; includes Steps and Verification; and is a prerequisite of `L-1`. Pre-compute later batches only where no task shares requirements, files, contracts, or repository state.
3. Include a complete REQ → task → test coverage matrix. A REQ without a discriminating verification path is uncovered; resolve it before finishing.
4. Run the plan's consistency analysis through an analyst subagent: it validates every REQ is covered, every task has a test and gate, all dependencies are acyclic, cross-repo contracts agree, and no map invariant is contradicted; it persists every `[ANALYSIS: ...]` finding in `Pending analysis`, keeps `status: draft`, and returns the findings list. Delegate corrections — analysis findings and user-requested adjustments alike — to a fixer subagent that reads `plan.md` plus the findings, applies the edits, and returns one line per finding resolved. Rerun the analysis until it returns zero findings and the section reads `None.`.

## Hand off

Set `status: ready` only after the analysis is clean, then delete `.plan-work/`. Report the task graph, batches, coverage matrix, unresolved external facts, and exact repo/worktree implications. Then tell the user to invoke `$sdd:implement <feature>` manually.

Do not code, manufacture requirements beyond the ready spec, or add debt/remediation unless it references an already-declared task (or is a full task), its `file:line` anchor is inside that task's `Files` list, and it records `Accepted by: <user decision/date or decision ID>`.
