---
name: plan
description: Turn a ready SDD specification into an executable implementation plan.
disable-model-invocation: true
---

# SDD — Plan

Convert a ready `docs/specs/<feature>/spec.md` into the implementation contract at `docs/specs/<feature>/plan.md`.

## Preconditions

- Require `status: ready`, zero clarification markers, testable REQ-IDs and acceptance criteria. Require `docs/codebase/context.md`; load only its linked documents relevant to each requirement.
- For a multi-repo spec, take the topology, chain, base branches, and REQ tags verbatim from `## Repos involved`. Do not rediscover or alter them.
- Confirm every marked `[UNVERIFIED]` external contract against its official source before code can depend on it. Stop and return to the user if a material ambiguity remains.

## Design from evidence

1. Orchestrate focused investigation through subagents; the orchestrator synthesizes their findings and does not read raw source itself.
2. Design the smallest change consistent with map invariants, existing patterns, the specification, and real callers. State each decision, its REQ IDs, and `file:line` evidence.
3. For multi-repo work, freeze only verified cross-repo interfaces: producer, transformer, consumer, route/event, request/response shape, ownership, compatibility, and validation boundary.

## Write executable tasks

1. Use [the plan template](templates/plan.template.md). Give every task a stable ID, repository, dependencies, mapped REQs, exact files/patterns, and TDD steps sufficient for a fresh executor.
2. Keep implementation order separate from dependency order. Pre-compute batches only where no task shares requirements, files, contracts, or repository state.
3. Include a complete REQ → task → test coverage matrix. A REQ without a discriminating verification path is uncovered; resolve it before finishing.
4. Run the plan's consistency analysis: validate every REQ is covered, every task has a test and gate, all dependencies are acyclic, cross-repo contracts agree, and no map invariant is contradicted.

## Hand off

Write `plan.md` only after the analysis is clean. Report the task graph, batches, coverage matrix, unresolved external facts, and exact repo/worktree implications. Then tell the user to invoke `$sdd:implement <feature>` manually.

Do not code, silently remediate unrelated concerns, or manufacture requirements beyond the ready spec.
