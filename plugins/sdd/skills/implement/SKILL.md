---
name: implement
description: Execute an approved SDD implementation plan with proof per task.
disable-model-invocation: true
---

# SDD — Implement

*You have already been invoked; these instructions are now active context, not a pending action. Do not call the Skill tool to invoke this skill again.*

Execute `docs/specs/<feature>/plan.md` task by task. The plan is the contract; implementation does not redesign it.

## Preconditions and scope

- Require a ready `spec.md`, executable `plan.md`, and current `docs/codebase/context.md`. Refuse a missing plan, `status: draft`, `[ANALYSIS]` marker, invalid selector, or missing multi-repo registry/Batch 0 worktree rather than inventing requirements, tasks, or topology.
- Accept a feature, task, batch, or repository target. In multi-repo work, resolve the plan's REQ-to-repo registry and operate only in its Batch 0 worktree; never create cross-repo topology during execution.
- Read and rewrite `docs/specs/<feature>/state.md` only after a task's atomic commit and green post-gate review. It is the resume cursor; derive completion and dependencies from its git SHA, not a claimed status.

## Task loop

1. Select only dependency-ready tasks in the requested scope. Run serially unless a plan-marked `[P]` batch proves files, requirements, repositories, and hot files independent; parallel work uses isolated task worktrees, sequential rebase/merge, integrated-suite verification, and cleanup.
2. Commission one fresh executor per REQ-bearing task with only its `Steps`, `Files`, `Verification`, and testing convention. It touches only declared files; a missing requirement or needed analysis returns to `$sdd:plan` rather than expanding scope.
3. For every `Verification` criterion: write a discriminating test, observe it fail for the required assertion (repair a setup failure or pre-green test), make the smallest contract-preserving change, observe green, refactor, and re-run. Commit the task atomically in English only after its declared checks and repository gates pass. For HTTP/service contracts, exercise the real running boundary when the required stack is available.
4. Commission a fresh post-gate reviewer. It verifies test count, every mapped REQ assertion at `file:line`, and that each assertion proves the AC outcome; it records searches for absent assertions and rejects scope creep, undocumented `SPEC_DEVIATION`, or map-invariant violations. Do not update state or mark the task complete without its green verdict.

Read [TDD discipline](references/tdd-discipline.md) when briefing an executor. Read [lessons](references/lessons.md) when loading confirmed lessons, recording a durable lesson, or resuming a prior failure.

## Closing gate

After all requested tasks are green, commission a closing check: every REQ has an atomic committed task, named green test, and `file:line` assertion matching its AC; then run the integrated full suite, test-count/coverage checks, and repository gates. Any failed or missing proof remains open; never declare the plan complete. For each P0 REQ, run the proportional mutation sensor in an isolated scratch worktree only after `docs/codebase/conventions/testing.md` documents its exact scoped test command; otherwise record `sensor off`. Read [mutation-sensor.md](references/mutation-sensor.md) for the protocol. A surviving mutant is not green proof and is routed through the fix loop with a grounded lesson.

Report completed and remaining tasks, worktree/repository status, and proof paths. If the plan is fully satisfied, tell the user to invoke `$sdd:review` manually before publishing. Do not auto-invoke another skill, edit unplanned scope, or publish changes.
