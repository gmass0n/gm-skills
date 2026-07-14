---
name: implement
description: Execute an approved SDD implementation plan with proof per task.
disable-model-invocation: true
---

# SDD — Implement

Execute `docs/specs/<feature>/plan.md` task by task. The plan is the contract; implementation does not redesign it.

## Preconditions and scope

- Require a ready `spec.md`, executable `plan.md`, and current `docs/codebase/context.md`. Refuse rather than invent missing requirements, tasks, or topology.
- Accept a feature, task, batch, or repository target. In multi-repo work, use the plan's REQ-to-repo mapping and registry; create one isolated worktree per affected repository from its declared base branch.
- Read and rewrite `docs/specs/<feature>/state.md` after every task. It is the resume cursor and must name completed, current, blocked, and pending work.

## Task loop

1. Select only dependency-ready tasks in the requested scope. Run serially unless the plan's batches prove files, requirements, and repositories independent.
2. Commission one fresh executor per REQ-bearing task. It follows the task's TDD steps: write a discriminating test, observe it fail, make it pass with the smallest contract-preserving change, then refactor.
3. Run the task's declared checks and the repository gates. For HTTP/service contracts, exercise the real running boundary when the required stack is available.
4. Commission a fresh post-gate reviewer. It verifies every mapped REQ assertion at `file:line`, that tests did not regress, and that the task did not violate map invariants. Do not mark the task complete without its green verdict.

Read [TDD discipline](references/tdd-discipline.md) when briefing an executor. Read [lessons](references/lessons.md) when loading confirmed lessons, recording a durable lesson, or resuming a prior failure.

## Closing gate

After all requested tasks are green, commission a closing check that walks the plan's REQ → task → test matrix. For P0/risk-bearing behavior, run the proportional mutation sensor in an isolated scratch worktree; read [mutation-sensor.md](references/mutation-sensor.md) only when the plan documents a scoped test command. A surviving mutant is not green proof.

Report completed and remaining tasks, worktree/repository status, and proof paths. If the plan is fully satisfied, tell the user to invoke `$sdd:review` manually before publishing. Do not auto-invoke another skill, edit unplanned scope, or publish changes.
