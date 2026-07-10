---
name: test
description: "Execute an approved QA plan and return a verdict — the phase after qa:plan. Use when the user says 'executar plano de QA', 'rodar os testes do plano', 'run the QA', 'valida o plano de qa', 'run qa', or invokes qa:test. Reads docs/qa/<target>/plan.md as its ONLY source of context: stands up the stack exactly as the plan says (isolated worktree per repo, dynamically-free ports it re-confirms, .env, background servers), runs the mandatory smoke-check first, then runs the scenario checklist — frontend via Playwright MCP strictly sequential in a fresh clean browser (the browser is a singleton; parallel frontend caused ~2.8M tokens of contention in a real session), backend via curl parallelized when independent. Respects the per-scenario credential mode the plan set (unattended / assisted-pause-and-resume / blocked). Returns a structured verdict — blockers, warnings, brief summary — and NEVER fixes code (that's sdd:debug / sdd:implement). If the plan is missing, it refuses and points at qa:plan."
---

# QA — Test

## Preconditions — the plan is the contract

Read `docs/qa/<target>/plan.md`. If it doesn't exist, **refuse** and recommend running `qa:plan` first.

**The plan is the only source of context.** Do not re-discover the environment, do not infer scenarios, do not add scope. Read `lang:` from the plan's frontmatter and produce the verdict in that language — do not re-detect.

## Non-negotiable principles

- **Only test and report.** Never fix code — that's `sdd:debug` / `sdd:implement`. Report blockers with observed-vs-expected and the likely layer/repo; don't patch.
- **Stop and ask, never guess.** If anything stalls (port taken, login fails, plan ambiguous), pause and report to the human with a recommended fix. Never improvise a path/port/credential.
- **Frontend is sequential, backend can parallelize.** The browser is a singleton.
- **Protect the parent's context via subagents.** Delegate heavy reads (large server logs) to a subagent that returns only the relevant lines. But long-lived processes (dev servers) are started from Bash directly, **not inside subagents** — they don't survive between agent calls.

## Step 1 — Stand up the stack from the plan

Execute the plan's preconditions block **exactly as written** — isolated worktree per repo, `.env`, tunnel, background servers on the plan's free ports, boot confirmation. Never stand up in the main checkout.

**Re-confirm the plan's ports are still free** at execution time (`lsof -ti:<port>`). If one got taken since planning, **stop and report** with a suggested free port — don't improvise.

## Step 2 — Mandatory smoke-check before any scenario

Prove the stack is alive: each service responds + one real end-to-end login. If it fails, **abort with a clear verdict** — don't test a half-dead stack.

## Step 3 — Respect the per-scenario credential mode

Before each auth/verification scenario, read the mode the plan set:

- **Unattended** — use the referenced credential and proceed without pausing. If login fails on an invalid/expired credential, **stop and report** — don't guess a new one.
- **Assisted** — at the point that needs the credential/verification (login, OTP, email/phone confirmation), **pause and ask the human** via `AskUserQuestion` to type/confirm in real time, then **resume from exactly where you stopped**. This is a pause, not a failure — don't abort the scenario. Assisted scenarios are excluded from any parallelization.
- **Blocked** — skip the scenario and record it as a *warning* in the verdict.

## Step 4 — Run scenarios (concurrency discipline)

- **Frontend (Playwright MCP): strictly sequential, one browser session at a time.** Parallel frontend causes contention — a real session burned ~2.8M tokens on it. **Start a fresh, clean browser profile** at the beginning (no leftover session state; kill any orphan Chrome MCP holding the profile), and close it at the end. This kills both the locked-profile and stale-mock-cookie problems.
- **Backend (curl / request-response) and browserless scenarios: parallelize when independent.** These fit well in subagents that return only the result, keeping the parent's context lean.
- **Evidence per scenario** as the plan requires: steps, screenshot, network (`browser_network_requests`), and **server logs** — a validation error can surface only in a service log, not the UI. Scan large logs via a **subagent** that returns only the relevant lines, never the whole log.

## Step 5 — Verdict (the deliverable, in the plan's language)

Write it to `docs/qa/<target>/verdict.md` from `templates/qa-verdict.template.md` — always the same structure — and summarize inline:

- **Blockers** — what actually broke (expected vs observed, evidence, likely layer/repo — no fix).
- **Warnings** — suspicious but not blocking (a WARN in a log, inconsistent data, a blocked scenario).
- **Brief summary** — what was covered, what passed, what couldn't be validated. Honest; don't fake success.

## Step 6 — Cleanup

Remove synthetic test data created under the plan's prefix, confirming synthetic-vs-pre-existing before deleting. If anything is ambiguous, ask.

## Anti-patterns

| Don't | Do instead |
|---|---|
| Run frontend in parallel on one browser | Sequential, one clean browser session |
| Fix code | Report the blocker; QA only tests |
| Report an out-of-scope bug as a blocker | Honor the plan's scope; note it, don't block |
| Skip the smoke-check | Smoke-check first, abort if it fails |
| Guess a port/credential when stalled | Stop and ask the human with a suggestion |
| Abort an assisted scenario at the credential step | Pause, ask the human, resume |
| Pull raw logs/transcripts into your own context | Delegate to a subagent that returns relevant lines |
| Start dev servers inside a subagent | Start from Bash directly — they must outlive the call |
