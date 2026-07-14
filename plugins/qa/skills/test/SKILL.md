---
name: test
description: Run a QA plan and write an evidence-based verdict.
disable-model-invocation: true
---

# QA Test

Read `docs/qa/<target>/plan.md` as the sole execution contract. If it is missing, stop and ask the user to invoke `$qa:plan`; do not rediscover the environment or invent scenarios. Write the verdict in the plan's `lang`.

## Contract

- Test and report only. Do not fix code; record observed versus expected behavior, evidence, and likely layer/repo.
- Execute the plan exactly: isolated worktrees, specified environment, tunnel, ports, and startup commands. Before startup, verify every absolute worktree is distinct from its recorded main checkout and at its expected ref/HEAD; stop on mismatch. Never start or mutate the user's main checkout. Re-check every planned port before startup; if one is taken, stop with a recommended replacement rather than improvising.
- Run the smoke-check before scenarios. Abort subsequent testing if the stack or required real login fails.
- Keep frontend work strictly sequential in one fresh browser profile. Run browserless backend work concurrently only when the plan marks it independent.
- Follow each credential mode: use the referenced secret for `unattended`; on auth failure stop and report, never substitute a credential. Pause and resume `assisted` scenarios at the recorded human step, never in parallel; skip `blocked` scenarios as warnings.
- Capture the plan's evidence. Delegate large-log extraction to focused subagents; start long-lived servers directly so they survive the run.
- Track every server, tunnel, browser profile, and synthetic-data handle created by this execution. On every exit path, clean up only tracked resources, leave externally owned/shared/in-app browser processes untouched, and report the cleanup state.

## Workflow

1. Stand up the stack from the plan, verify the stated ports remain free, then confirm every service booted. Before any real-data mutation, execute the plan's non-production host/profile/account preflight; block the scenario when it cannot prove the recorded target.
2. Run the mandatory smoke-check. Produce a failed verdict immediately if it does not pass.
3. Execute scenarios in plan order and concurrency class. Before frontend QA, terminate only orphan browser processes or profile locks proven to be from prior QA runs; never terminate a shared or in-app browser, and take no action when ownership is uncertain. Then start with a clean browser profile, collect required UI/network/log evidence, and close it at the end.
4. In a finally-style cleanup on every exit, remove only synthetic data under the plan's prefix, ask if ownership is ambiguous, and stop only servers or tunnels tracked as started by this execution.
5. Write `docs/qa/<target>/verdict.md` from [qa-verdict.template.md](templates/qa-verdict.template.md): blockers, warnings, covered/passed/failed/unvalidated scenarios, and cleanup state. Summarize the same result inline.

## Completion

Finish with an honest `pass`, `fail`, or `partial` verdict and evidence for every executed scenario. A blocked credential, environment ambiguity, or failed smoke-check remains visible as a warning or blocker; never manufacture a green result.
