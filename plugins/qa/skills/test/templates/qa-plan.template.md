---
target: <target-name>
lang: pt|en
created: <YYYY-MM-DD>
repos:
  - name: <repo>
    main_checkout: <absolute-main-checkout>
    worktree: <path>
    branch: <branch>
    expected_head: <commit-or-ref>
    port: <chosen-free-port>
---

# QA Plan — <target>

> This plan is the ONLY source of context for `qa:test`. Everything it needs to
> stand up the stack, prove it's alive, and run every scenario is here.

## Target & scope

- **Testing:** <what is under test>
- **Out of scope:** <what to ignore, e.g. "known /dashboard 500 — navigate straight to X">

## Environment preconditions

Executable, step by step. Run in the worktree, never the main checkout.

1. **Tunnel / DB reachable:** `nc -zv <host> <port>`
2. **Per service** (`<repo>`):
   - cwd: `<worktree-path>`
   - `source ~/.nvm/nvm.sh && nvm use`   # if .nvmrc present, version <x>
   - `.env` changes: `<VAR=value>` — trap: <known trap, e.g. remove empty DOCS_FAVICON_URL>
   - free port: `lsof -ti:<port>` (escalate if taken); propagate into `<*_API_URL>`
   - start: `<start command>` (background) on port `<port>`
   - confirm boot: `<curl / log line that proves it's up>`
3. Repeat per repo; ensure inter-service URLs point at the chosen local ports.

## Credentials & mode per scenario

| Scenario id | Auth needed | Mode (unattended/assisted/blocked) | Credential source |
|---|---|---|---|
| <S1> | login | unattended | `.qa-secrets` → `<key>` |
| <S2> | OTP | assisted | pause & ask human |

> No cleartext secret here unless the user explicitly authorized it. Prefer a
> gitignored `.qa-secrets` file the plan only references.

## Smoke-check (mandatory, before any scenario)

- [ ] Each service responds: `<curl per service>`
- [ ] One real end-to-end login confirming a real user (not the mock)

## Scenario checklist by phase

### Phase 1 — <name>

- **[S1] <title>** — type: `frontend` · **sequential** · credential: unattended
  - Steps: <ordered steps>
  - Expected: <expected result>
  - Evidence: screenshot + `browser_network_requests` + server log lines

- **[S2] <title>** — type: `backend` · **parallel-safe** · credential: n/a
  - Steps: `curl ...`
  - Expected: <status/body/headers>
  - Evidence: request/response + headers

## Data strategy

- **Source:** mock | real dev
- If real: before mutation, prove the non-production target and account: `<command/check>` → expected `<host/profile/account evidence>`; otherwise block the scenario.
- If real: seed own data with unique prefix `<prefix>-` (e.g. `POST /orders`), so it can't collide.
- **Cleanup:** delete everything under prefix `<prefix>-` at the end.

## Execution rules (inherited)

- Frontend sequential (browser is a singleton); backend may parallelize when independent.
- Fresh clean browser profile at start; close at end.
- Stop and ask the human if anything stalls — never guess a path/port/credential.
- qa:test only tests and reports — it never fixes code.
