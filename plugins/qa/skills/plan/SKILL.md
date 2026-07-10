---
name: plan
description: "Use to turn 'I want to QA this feature end-to-end' into a complete, self-sufficient QA plan — the phase before qa:test. Run a one-question-at-a-time interview (grounded in docs/codebase/context.md when it exists), explore the repos FIRST via subagents, then ask only the risk questions the code couldn't answer, and write docs/qa/<target>/plan.md: how to stand up the stack (isolated git worktree per repo, dynamically-free ports, .env per service, mock-vs-dev data), a smoke-check, and a per-phase scenario checklist (happy path, edge cases, misuse, frontend via Playwright MCP marked sequential, backend via curl marked parallel-safe). Trigger whenever the user wants to 'criar plano de QA', 'planejar testes', 'quero testar essa feature end-to-end', 'validar essa stack local', 'QA plan', 'test plan', 'plan the QA for X' — and always before qa:test. The plan is the ONLY source of context qa:test gets, so the interview will not finish while any environment unknown is unresolved: what the skill can't discover with certainty, it asks — it never guesses."
---

# QA — Plan

## What this skill produces

One file: `docs/qa/<target>/plan.md`. It is the **complete, self-sufficient contract** that `qa:test` executes. `qa:test` gets no other context — it does not re-discover the environment and does not invent scenarios. So the plan must spell out, explicitly: how to stand up the stack, how to prove it's alive (smoke-check), and every scenario to run with its expected result and evidence.

If the plan is complete, `qa:test` can be simple and safe. If it's vague, nothing downstream works. Spend the effort here.

This skill only writes under `docs/qa/<target>/`. It reads the codebase map but never writes to it.

## Non-negotiable principles

1. **The plan is the single source of truth for `qa:test`.** Complete and explicit, or it fails downstream.
2. **Skills never decide the environment alone.** If information is missing or something is uncertain, **stop and ask the human** — via `AskUserQuestion`, always with a recommended default first. Never guess a path, port, credential, or provider.
3. **Frontend via Playwright MCP is sequential** — the browser is a singleton. The plan only marks as parallel what touches no shared resource (see "Model every shared resource" below).
4. **This skill only plans.** It never runs the tests and never fixes code.
5. **Light and fast.** No REQ-IDs, coverage matrices, or mutation sensors. This is not SDD — it's a QA checklist with an environment recipe.
6. **Orchestrate via subagents to protect the parent's context.** All heavy reading — exploring repos, reading `.env`/schemas, mapping how services boot — goes to subagents that return a **digest**, not raw bytes. The parent synthesizes and writes; it never accumulates raw files. But no ceremony: a subagent where there's a real token/isolation win, not one per micro-task.

## Language rule

The skill's own content (this file, references, templates) is always English. But **the interview, the narration to the user, and the generated `docs/qa/<target>/plan.md` follow the user's language.** Detect it from the user's first messages and lock it now. Write `lang: pt|en` in the plan's frontmatter so `qa:test` reads it and does not re-detect.

## Step 1 — Ground yourself (via subagent)

If `docs/codebase/context.md` exists (the SDD map), dispatch **one subagent** to read it and return a short digest: the real stack, how services boot, enforced invariants. Do not read it into your own context.

If it doesn't exist, proceed anyway but tell the user the plan is ungrounded (discovery will lean entirely on exploration + your questions).

## Step 2 — Explore the repos FIRST (before any question)

The order matters: **explore before you ask.** Each question must be born from a concrete unknown the exploration surfaced — never a generic questionnaire.

Dispatch **one `Explore` subagent per app/repo, in parallel**, each hunting the **same four things** and returning a digest:

- **(a) Start script + default port** — `start:dev` / `dev` / `start`, and the port it binds.
- **(b) Env + schema** — where `.env` comes from (main checkout vs `.env.example`), and which variables need adjusting to run locally.
- **(c) Real-data vs mock wiring** — the switches that point at a real dev backend vs a mock (`DATA_SOURCE`, `ORDER_PROVIDER`, `*_API_URL`, `API_BASE_URL`, etc.). This is the gap QA exists to close: testing the mock proves nothing.
- **(d) Auth/login flow** — the end-to-end login (fields, routes), and whether a reusable e2e/Playwright flow already exists.

See `references/stack-discovery.md` for the concrete traps to hunt for (Node version via `.nvmrc`, worktree + Turbopack symlink breakage, strict-zod empty vars, API prefix, mock cookies, orphan processes).

**Hard rule: anything exploration can't resolve with certainty becomes a question — you do not assume it.**

## Step 3 — Isolation strategy (record it in the plan)

- **Separate worktree, always.** Each repo under test runs in an isolated git worktree — never the main checkout, so the user's working tree stays clean and in-progress work doesn't collide. The plan records the worktree path and branch per repo, and how to create it (`git worktree add`) if it doesn't exist yet.
- **Dynamically-free ports.** Don't hardcode ports blind. The plan says, per service, how to pick a **free** port (detect occupancy with `lsof -ti:<port>`, escalate to the next free one in a range isolated from the defaults) and how to propagate it into the inter-service URLs (`*_API_URL`, `API_BASE_URL`) so the whole chain points at itself. Record the chosen ports in the preconditions block.
- **Model EVERY shared resource when marking parallelism (the root lesson).** Data isolation is not resource isolation. A scenario can have its own driver/order in the DB and still collide on a shared **browser (Playwright MCP is a singleton)**, files, or ports. When marking a scenario parallel, check *every* resource it touches. Any scenario that uses the browser is **sequential by definition**, however isolated its data. (In the session this skill distills, 5 QA agents sharing one browser burned ~2.8M tokens on contention and found zero real bugs; sequential execution then passed everything.)

## Step 4 — The interview (ask only what has risk)

Ask **only what exploration didn't resolve AND is costly if assumed wrong.** In practice that's a handful of questions, in these categories — the ones that break a multi-repo QA:

- **Access to real data** — is the tunnel/DB reachable, does the `.env` point at it, does the login user actually exist in that DB?
- **Environment collision** — which port range is free.
- **Stop criterion / scope** — what's explicitly in and out (e.g. a known-broken `/dashboard` 500 that's out of scope → the plan says "ignore, navigate straight to X").

Rules:
- **One question at a time**, binary/enumerated, via `AskUserQuestion`, with the **recommended default first**. Bring the answer ready and ask for confirmation — don't open-ended it.
- **Don't re-ask** what the user gave in the prompt or the code already answered. Treat prompt claims as things to verify via subagent, not gospel.
- Still, **exhaust the scenario tree** — that's the product. Happy path AND every edge (empty, failure, timeout, pagination limit, legacy record, "other type" of entity), **user misuse**, and what happens when it goes wrong. When the user delegates ("you decide"), give a verdict; for a heavy technical choice, check market QA patterns with `WebSearch` rather than memory alone.

## Step 5 — Credentials & interactive verification (detect early, decide in the plan)

Whenever a scenario depends on login, a credential, or a real-time verification step (email/phone confirmation, OTP/2FA, captcha), **detect it during the interview** and ask the user — via `AskUserQuestion` — which execution mode `qa:test` should use, because an unresolved one stalls execution mid-run:

- **Unattended (credential in the plan)** — user provides it now; `qa:test` uses it alone, no pausing. Fast.
- **Assisted (real-time pause)** — `qa:test` pauses at the exact point the flow needs the credential/verification, asks the human to type/confirm (email/phone/OTP), and resumes. Safe, but needs a human present.
- **Block the scenario** — marked non-executable; `qa:test` reports it as a *warning* and runs the rest without stalling.

The mode is recorded **per scenario** (one flow can be unattended, another assisted).

**Secret safety:** by default, do **not** write credentials in cleartext in `plan.md` (it may reach git) — prefer a separate gitignored file (e.g. `.qa-secrets`) that the plan only references. Only write a secret directly in `plan.md` if the user **explicitly authorizes it**, and then warn about the commit risk and suggest `.gitignore`.

## Step 6 — Write the plan

Write `docs/qa/<target>/plan.md` from `templates/qa-plan.template.md`. Fixed sections:

- **Target & scope** — what's tested, what's explicitly out.
- **Environment preconditions** — an executable, step-by-step block: verify the tunnel (`nc -zv host port`), prepare each `.env` (exact variables to adjust + known traps), pick free ports, stand up each service (command + cwd + port + `nvm use` if needed), confirm boot. In the worktree, not the main checkout.
- **Credentials & mode per scenario** — for each auth/verification scenario: the chosen mode and where the credential comes from (secret-file reference, or "pause and ask the human"). No cleartext secret without explicit authorization.
- **Smoke-check** — the minimum that proves the stack is up: each service responds + one real end-to-end login confirming a real user (not the mock).
- **Scenario checklist by phase** — each scenario: id, type (frontend/backend), credential mode, steps, expected result, evidence to capture. Frontend marked "sequential"; backend marked "parallel-safe".
- **Data strategy** — mock or real dev; if real, how to seed your own data (e.g. `POST /orders`) with unique prefixed identifiers so it can't collide, plus a cleanup note.
- **Execution rules** — inherited: frontend sequential, backend may parallelize; stop and ask if anything stalls.

## Anti-patterns

| Don't | Do instead |
|---|---|
| Assume an environment detail | Ask the human with a recommended default |
| Mix mock and real data unintentionally | Confirm the mock-vs-dev switch explicitly |
| Mark a browser scenario parallel | Browser is a singleton → sequential always |
| Leave a scenario without evidence | Every scenario names the evidence to capture |
| Decide a path/port/credential alone | Stop and ask |
| Read raw `.env`/schemas/logs into your own context | Delegate to a subagent that returns a digest |
| Write a secret in cleartext in `plan.md` | Gitignored secret file, unless user authorizes |
