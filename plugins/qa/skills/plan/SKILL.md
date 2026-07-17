---
name: plan
description: Create a self-contained end-to-end QA plan.
disable-model-invocation: true
---

# QA Plan

*You have already been invoked; these instructions are now active context, not a pending action. Do not call the Skill tool to invoke this skill again.*

Create `docs/qa/<target>/plan.md`: the complete execution contract for a later, explicit `$qa:test` invocation. Write the interview, narration, and plan in the user's language; set `lang: pt|en` in its frontmatter. Only write below `docs/qa/<target>/`; do not run tests or fix code.

## Contract

- Make the plan self-sufficient: environment recipe, smoke-check, scope, scenario checklist, credential mode, data strategy, cleanup, expected results, and evidence.
- Resolve uncertainty with one recommended, enumerated question at a time. Never guess a path, port, credential, provider, or scope boundary.
- Keep frontend scenarios sequential: Playwright's browser (web) and the Maestro device/simulator (React Native) are each a shared singleton. Mark backend work parallel-safe only after accounting for every shared resource, including ports, files, data, and credentials.
- Use isolated worktrees, never a user's main checkout. Choose and record dynamically free ports and every inter-service URL derived from them.
- For every repo, record the main checkout, absolute isolated worktree, branch/ref/expected HEAD, creation or existing-worktree validation, and clean-status check; stop if they do not match.
- Before real data, include an executable preflight that proves the non-production host/profile and account immediately before mutation; record its expected evidence and mark the scenario blocked if it cannot prove them. Never create, update, or delete pre-existing data; cleanup only ids created under the recorded prefix, otherwise mark the scenario blocked.
- Keep secrets out of `plan.md` unless the user explicitly authorizes cleartext, flags the commit risk, and uses a gitignored reference. Never put raw secrets in discovery digests.
- Delegate large discovery reads to focused subagents and synthesize their digests; do not accumulate raw `.env`, schema, or log contents.

## Workflow

1. Read `docs/codebase/context.md` when it exists through one focused subagent. Capture only stack, boot, and invariant details. If absent, disclose that the plan is less grounded.
2. Explore every target repo before interviewing; treat prompt claims as hypotheses. Record runtime/package manager, start command and bind host/port, environment source/precedence/schema, mock-versus-real provider/base URL/prefix, auth flow, and existing test. For a React Native app, also record the Metro start command, the build variant/scheme and its command, the target device/simulator identifier, and how the app reaches the backend (device host alias, tunnel, or LAN IP). If platform-specific startup hazards may apply, read [stack-discovery.md](references/stack-discovery.md) before writing the recipe; unknowns become questions, never assumptions.
3. Ask only material unknowns surfaced by exploration: real-data access, usable port range, scope/stop criteria, and login or live-verification access. For each protected scenario, record `unattended`, `assisted`, or `blocked` plus reason, owner, exact resume trigger, timeout, and expected verdict class.
4. Build a scope inventory from changed/exposed flows: each gets scenario ids or an evidence-backed out-of-scope reason. Cover happy path, boundaries/failures, misuse/permissions when applicable, and discovered variants. Give every scenario an id, type (`frontend` via Playwright, `mobile` via Maestro, or `backend` via curl), credential mode, ordered steps, expected result, and evidence. Mark browser and Maestro device work `sequential`; mark backend work `parallel-safe` only with isolated browser/device, data, credential, file, and port resources.
5. Create the plan from [qa-plan.template.md](../test/templates/qa-plan.template.md). Include executable worktree setup, tunnel and boot checks, exact environment changes, selected ports, smoke-check, data prefix and cleanup, and all scenarios.

## Completion

Finish only when a new session can stand up the stated stack and run every executable scenario from `plan.md` alone, without rediscovering the environment. A human-dependent scenario is self-contained only when its pause and resume instruction is recorded. Tell the user to invoke `$qa:test` when they want execution.
