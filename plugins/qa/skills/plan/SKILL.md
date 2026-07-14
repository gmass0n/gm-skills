---
name: plan
description: Create a self-contained end-to-end QA plan.
disable-model-invocation: true
---

# QA Plan

Create `docs/qa/<target>/plan.md`: the complete execution contract for a later, explicit `$qa:test` invocation. Write the interview, narration, and plan in the user's language; set `lang: pt|en` in its frontmatter. Only write below `docs/qa/<target>/`; do not run tests or fix code.

## Contract

- Make the plan self-sufficient: environment recipe, smoke-check, scope, scenario checklist, credential mode, data strategy, cleanup, expected results, and evidence.
- Resolve uncertainty with one recommended, enumerated question at a time. Never guess a path, port, credential, provider, or scope boundary.
- Keep frontend scenarios sequential: Playwright's browser is shared. Mark backend work parallel-safe only after accounting for every shared resource, including ports, files, data, and credentials.
- Use isolated worktrees, never a user's main checkout. Choose and record dynamically free ports and every inter-service URL derived from them.
- Keep secrets out of `plan.md` unless the user explicitly authorizes cleartext. Prefer a gitignored secret-file reference.
- Delegate large discovery reads to focused subagents and synthesize their digests; do not accumulate raw `.env`, schema, or log contents.

## Workflow

1. Read `docs/codebase/context.md` when it exists through one focused subagent. Capture only stack, boot, and invariant details. If absent, disclose that the plan is less grounded.
2. Explore every target repo before interviewing. For each repo, determine its start command and port, environment source and required variables, mock-versus-real wiring, and existing login flow. If platform-specific startup hazards may apply, read [stack-discovery.md](references/stack-discovery.md) before writing the recipe.
3. Ask only material unknowns surfaced by exploration: real-data access, usable port range, scope/stop criteria, and login or live-verification access. For each protected scenario, record one mode: `unattended`, `assisted`, or `blocked`.
4. Cover the scenario tree: happy path, boundaries and failures, misuse, and relevant entity variants. Give every scenario an id, type, credential mode, ordered steps, expected result, and evidence. Mark browser work `sequential`; mark browserless work `parallel-safe` only when independent.
5. Create the plan from [qa-plan.template.md](../test/templates/qa-plan.template.md). Include executable worktree setup, tunnel and boot checks, exact environment changes, selected ports, smoke-check, data prefix and cleanup, and all scenarios.

## Completion

Finish only when a new session can stand up the stated stack and run every executable scenario from `plan.md` alone, without rediscovering the environment. Tell the user to invoke `$qa:test` when they want execution.
