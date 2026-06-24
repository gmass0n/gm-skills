---
name: implement
description: "Execute an approved implementation plan task by task — Phase 3 (EXECUTE) of the SDD workflow, after sdd:plan. Use when the user says \"implement this\", \"build the plan\", \"run the tasks\", \"let's code X\", or names a task/batch like \"do T-3\". Works docs/specs/<feature>/plan.md as a pure orchestrator: one fresh subagent per task (mandatory even for a single task), never coding or analyzing in its own context. Each subagent runs the task's prescribed Steps (tests per docs/codebase/conventions/testing.md) in a strict test-first TDD loop — write the failing test, watch it fail, make it pass, refactor, commit; then a fresh review subagent does a Post-Gate check (test count didn't regress, no undocumented SPEC_DEVIATION, not overcomplicated). state.md is rewritten after every task for mid-session resume. Serial by default, parallel only when the plan proves file-isolation. A closing-gate subagent walks the coverage matrix; won't declare done while any requirement lacks a green test."
---

# SDD — Implement (Phase 3: Execute)

## What this phase does

Turn `docs/specs/<feature>/plan.md` into working, tested code — and **prove** it. This is the end of the proof chain: the spec said WHAT, the plan said HOW and built the coverage matrix, and this phase makes every requirement real and green. The user's strongest requirement governs everything here: *nothing is skipped, nothing is untested, and the flow proves it* — mechanically, not on trust.

You are the **orchestrator, and only the orchestrator**. You never write feature code, tests, run analysis, or review diffs in your own context — you dispatch a fresh subagent to implement each task, a fresh subagent to review it, read their verdicts, update `state.md`, and move on. Why: a subagent with a small, sharp brief is far less likely to drift or hallucinate than one big context accumulating every file it ever read. Isolation per task is the anti-hallucination mechanism.

**Spawning a subagent is mandatory for every task — no exceptions, even when the plan has a single task.** "It's just one small edit, I'll do it myself" is the exact rationalization that turns the orchestrator into an implementer and reintroduces drift. One task → one subagent. Always. If you ever find yourself reading feature source to decide *how* to implement, stop: that is the plan's job (Phase 2), already done, and doing it here means the plan was incomplete — fix the plan, don't analyze in implement.

**No codebase analysis in this phase.** The plan already did it — it carries the `Arquivos`, the `Steps`, the trechos, the `Verificação`. This phase only *executes* what the plan prescribes. If a task can't be executed without analysis, the plan is the bug; route it back to `sdd:plan`, don't paper over it here.

This phase reads `plan.md` and the codebase map; it writes code, tests, commits, and the feature's `state.md`.

## Preconditions — refuse rather than guess

- **No `plan.md`** → refuse: "Não há plano para `<feature>`. Rode `sdd:plan <feature>` primeiro."
- **`plan.md` has open `[ANALYSIS]` markers or `status: draft`** → refuse and point back to `sdd:plan`. This is the safety net for a plan abandoned mid-`/analyze`; normally it never fires.
- **Invoked with no plan at all** (user wants to just code) → don't silently comply. Say: "Sem plano não há matriz de cobertura — não consigo provar que tudo foi feito e testado. Confirma que quer modo vibe (sem garantia)?" Let the user choose the downgrade consciously rather than losing the guarantee silently.
- **Repo selector on a plan with no registry** (`sdd:implement <feature> <repo>` but the plan has no repo registry / `Repo:` tags) → refuse: "`<feature>` é single-repo — não há registro de repos para filtrar. Rode `sdd:implement <feature>` (ou `T-n`/`L-n`)." Conversely, a multi-repo plan whose selected repo has **no `Lote 0` worktree yet** → stop and point back to `sdd:plan`/`Lote 0` instead of creating it here.

**Inherit the language** from `plan.md`'s frontmatter (`lang:`). All your narration, commit messages follow the repo's git convention (English, per the project), but your communication with the user stays in the plan's language.

## Targeting — whole feature, one task, one batch, or one repo

`sdd:implement <feature>` is the base; the optional **second argument** narrows the scope. There are **three modes**, and the parser distinguishes them by the shape of that second argument:

- `sdd:implement <feature>` (no second arg) — work the whole plan, batch by batch.
- `sdd:implement <feature> T-3` — second arg matches `T<n>` → just **task** T-3. **Verify its preconditions** (its `Depende de:` tasks are already committed) but do **not** silently re-run dependencies — if a dependency isn't done, say so and stop.
- `sdd:implement <feature> L-2` — second arg matches `L<n>` → just **batch** L-2.
- `sdd:implement <feature> <repo-tag-or-slug>` — second arg matches neither `T<n>` nor `L<n>` → treat it as a **repo selector** (multi-repo plans only; see below).

**Parser order (deterministic):** `<feature>` is always required first. Then the second arg, if present, is classified: `^T\d` → task, `^L\d` → batch, otherwise → repo tag/slug. If the repo branch is reached but the token resolves to no repo in the spec's registry, **error clearly** — don't silently fall through to "whole feature". Example: `Repo "FOO" não está no registro de repos da spec. Tags disponíveis: LOC, CUS, BFF, POR.`

Stable task/batch IDs come from the plan; that's why they exist.

### The repo selector (multi-repo plans)

When the plan carries a `## Contrato de interface entre repos` block and tasks tagged `Repo:`, the feature spans several repositories in a chain (e.g. `operational-map`: locations-api → customer-api → BFF → portal). The model is **opção 1 — the machine understands the repos, the human drives the terminals (one per repo).** This is *not* automatic orchestration of N pipelines: each `sdd:implement <feature> <repo>` invocation works exactly one repo — the one the selector names — inside that repo's own worktree, and the human runs one such invocation per terminal/repo.

- **`<feature>` stays mandatory** before the repo token: the plan is needed to know the tasks *and* the repo registry (the selector only *filters* an existing plan, it never discovers repos).
- **Resolution against the registry.** The spec emits a repo registry (a table: tag / slug / role / base branch). The selector accepts either the **short tag** (`LOC`, `CUS`, `BFF`, `POR`) **or** the **slug** (`locations-api`, `customer-api`, …); the slug must match the `repo (slug)` column of that table. Resolve tag↔slug both ways. Unknown token → the clear error above.
- **Semantics — run all of that repo's tasks, in batch order.** Select every task whose `Repo:` equals the resolved repo, then run them **batch by batch (L-1 → L-2 → …)**, honoring each task's intra-repo `Depende de:`, and **stop at the first red test that won't pass** — same serial discipline as the whole-feature run, just filtered to one repo.
- **Single-repo is unchanged.** A plan with no `Repo:` tags has no registry; the repo selector simply doesn't apply, and `sdd:implement <feature>` behaves exactly as before. The repo mode only "exists" when the plan is multi-repo.

## Execution model — serial by default, parallel only when proven safe

**Default: serial.** Work one task at a time, in dependency order, reviewing each before the next. This is simpler, gives fine-grained checkpoints, and matches the anti-bureaucracy spirit of the whole workflow. In this coupled brownfield, serial is almost always the right call.

**Parallel is opt-in and must be earned.** Run a batch's tasks simultaneously only when the plan marked them `[P]` in the same `L-<n>` — which the plan only does when it proved their `Arquivos` sets don't intersect and none touch the hot list (`*.module.ts`, `env.schema.ts`, domain contracts). If you're unsure whether that proof holds, fall back to serial. A wrong parallel call corrupts a merge; a serial run just takes longer. The asymmetry says: when in doubt, serial.

When you do run a parallel batch, the mechanics matter (they're why most repos can't do this safely):
- Each task runs in its **own git worktree** so writes don't collide.
- **Symlink `node_modules`** from the repo root into each worktree — fresh worktrees have none, and the orphan worktrees already littering this repo prove nobody sets them up by hand.
- Run each task's tests with coverage **scoped to that task's `Arquivos`** (`--collectCoverageFrom`), not the global 80% threshold — that threshold only makes sense on the integrated branch.
- **Merge sequentially with a rebase** before each merge; on any conflict, abandon parallel for the rest and finish serial.
- After merging the batch, **run the full suite on the integrated branch** — a silent auto-merge of a shared module only surfaces here.
- **Remove the worktree** when done. Cleanup is not optional; the litter proves it won't happen on its own.

### Cross-repo worktrees (multi-repo plans) — reuse the same machinery, one worktree per repo

The worktree+symlink+rebase+cleanup machinery above is **intra-repo** (one repo, parallel tasks). A multi-repo plan reuses the *same* primitives at a coarser grain — **one worktree per repo**, not per task — and that worktree is created up front by the plan's `Lote 0` (worktree + branch + PR per repo, off each repo's base branch from the registry), not by this phase. This phase **operates inside the worktree the registry/Lote 0 already established for the selected repo**; it does not invent new worktrees for cross-repo.

What changes versus the intra-repo case, and only this:
- **The repo worktree is keyed by the registry**, not by a task. Its path is the repo's worktree root recorded in the spec's registry / created in `Lote 0`. The repo selector (and a task's `Repo:` tag) resolves to that root.
- **Every git, test, and commit for a task runs in that task's repo worktree** — operate on the worktree root explicitly (the `git -C <repo-worktree>` principle; don't hard-code a flag, the point is "act on *that* worktree, never the orchestrator's cwd"). Each invocation works the repo of its own terminal/context; it never reaches into a sibling repo's worktree.
- **`node_modules` symlink, scoped coverage, and cleanup are per repo**, exactly as above — each repo worktree gets its own symlink from *its* repo root, its own coverage threshold from *its* `testing.md`, and its own teardown.
- **No cross-repo merge here.** Intra-repo parallel batches still rebase-merge within a repo as above; across repos there is nothing to merge — each repo lands on its own branch/PR (the `## Contrato de interface entre repos` block is what keeps the branches compatible). Cross-repo integration is proven by the closing gate's per-repo matrix, not by a merge.

## The task loop — strict TDD, one subagent each

For each task, dispatch one fresh subagent. Give it a **task briefing (~500 tokens)** — not the whole codebase map. The briefing is the task's own block from the plan verbatim: its `Steps` (with the embedded trechos), `Arquivos`, and `Verificação`, **plus `docs/codebase/conventions/testing.md`** so the tests it writes follow the project's enforced test contract (location, naming, the per-suite coverage checklist, commands, threshold). That set is self-contained and execution-ready — the plan pre-digested the *how*, testing.md fixes the *test shape*, so the executor needs no map and no analysis. The subagent's job is to *carry out the Steps in order*, not to figure out what to do. This keeps each subagent lean and on-target.

**Read the task's `Repo:` tag and run in that repo's worktree.** On a multi-repo plan, each task carries a `Repo:` tag; resolve it against the spec's registry to the repo's worktree root (established by `Lote 0`) and put that root in the briefing, so the subagent runs *its* Steps, tests, and commit against that worktree (`git -C <repo-worktree>`), pulling the convention from *that* repo's `testing.md`. A task with **no `Repo:` tag** (single-repo plan) runs in the cwd worktree exactly as today — the tag is the only difference. Each invocation handles the repo of its own context; the orchestrator never reaches into another repo's worktree to "also" run its tasks.

Each subagent follows the plan's per-task `Steps`, which are already laid out as a strict **test-first TDD loop, no exceptions**:

```
loop over the task's Verificação criteria:
  RED      → write the test from the criterion. RUN IT. Watch it fail for the RIGHT reason
             (an assertion about the missing behavior — not a syntax/import error).
             If it passes before any code, the test is wrong — fix it until it fails.
  GREEN    → write the minimal code to make it pass. RUN IT. Watch it pass.
  REFACTOR → clean up with the test as a safety net. RUN the test again — still green.
repeat until every Verificação criterion of the task has a green test;
COMMIT     → atomic commit for this task (the project's commit convention; in English).
```

The loop is the *proof that it works the best way*: the subagent never moves to the next criterion until the current one is green, and never commits until every criterion of the task is green. Each `RUN IT` is a real test execution — the subagent reports the actual pass/fail output, not "should pass". A criterion that can't be made to fail-then-pass is a flaw in the task or the spec — surface it, don't fake green.

**Tests follow the project's testing convention.** The subagent's briefing includes `docs/codebase/conventions/testing.md` (file location, naming, the per-suite coverage checklist, the run commands, the coverage threshold). Tests are written *to that doc*, not to the subagent's own taste — it is the project's enforced test contract. If a task surfaces a real gap in that doc (a case it doesn't cover, a stale command), note it for `sdd:codebase diff` to fold back in — don't silently diverge.

The non-negotiable: **no production code without a failing test first.** This is the fourth link in the proof chain — it guarantees every line of feature code exists to satisfy a test that maps to a requirement. The discipline that makes this stick (and the rationalizations that erode it) is in `references/tdd-discipline.md` — read it when a task tempts you to skip the red step or when a test is hard to write.

### Post-Gate Review — a fresh subagent verifies, the orchestrator never analyzes

After a task's commit, **dispatch a separate review subagent** (not the same one that wrote the code, and never the orchestrator in its own context — you only orchestrate, you don't read source to judge it). The reviewer gets the task's `Arquivos`, `Verificação`, the diff, and `testing.md`, and checks three things tlc-spec-driven proved cheap and high-value:

1. **Test count didn't regress** — the suite has *at least* as many test cases as before the task. A drop means a test was silently deleted or skipped to force green. This is mechanical and catches the highest-impact cheat.
2. **No undocumented spec deviation** — if the code diverged from what the plan's Steps prescribed, there must be a `// SPEC_DEVIATION:` marker explaining it (see below). Divergence without a marker → kick back to fix.
3. **Not overcomplicated** — "would a senior engineer flag this as more complex than the task needs?" and "does it match the patterns in the codebase map?". If yes → the implementing subagent simplifies and re-runs the task's gate.

Only when the reviewer returns clean does the task count as done and `state.md` advance. The review is a subagent precisely so the orchestrator stays lean and unbiased — a reviewer with fresh eyes catches what the author rationalized.

**`// SPEC_DEVIATION:` marker.** When a task's implementation must diverge from the plan's Steps (a signature the plan didn't foresee, a different data structure for a real constraint), the implementing subagent leaves an inline marker at the divergence:

```
// SPEC_DEVIATION: usei Map em vez do array que o plano previa
// Reason: lookup O(1) exigido pelo volume real do upstream
```

It's the implement-phase twin of the spec's `[NEEDS CLARIFICATION]` and the plan's `[ANALYSIS]` — a durable, greppable record that code and plan disagreed *and why*. The closing gate collects every `SPEC_DEVIATION` and surfaces them in the final report, so a divergence is a conscious, reviewed decision, never a silent drift.

**Review after each task (serial path) — via the Post-Gate Review subagent above, not in your own context.** Before moving to the next task, the review subagent checks: tests green, the task's `Verificação` actually satisfied, test count didn't regress, no scope creep beyond the task's `Arquivos`, `SPEC_DEVIATION` markers present for any divergence, follows the patterns in the codebase map. You (orchestrator) read its verdict and decide go/fix — you don't read the diff yourself. On a parallel batch, review per-batch instead (after the integrated-branch suite passes) — that's the one place granularity yields to throughput.

Task status **derives from git** — an atomic commit per task is the record of what's done. Don't maintain a parallel "done list"; the commit log is the truth.

## state.md — the cursor, updated after every task

Maintain `docs/specs/<feature>/state.md` (lowercase) so work survives across sessions. **Only `sdd:implement` writes it.** Keep it bounded and **rewrite it compact each update — never append** — so it stays ~300-400 tokens and costs almost nothing to load:

```markdown
# state — <feature>
branch: feature/CL-28-notifications
último: T-3 (commit a1b2c3d)
próximo: T-4
abertas: —                          # decisões/bloqueios pendentes
cobertura: REQ-1 ✅  REQ-2 ✅  REQ-3 ⏳
```

**Multi-repo: track progress per repo/tag.** When the plan is multi-repo, `state.md` records a line per repo (keyed by tag), each with its own branch and last/next cursor — no new persistence machinery, just one more dimension on the same compact cursor. The repo selector and a dead-session resume read the row for the repo they're working:

```markdown
# state — operational-map
LOC (locations-api): branch feature/CL-31-loc | último T-2 (a1b2c3d) | próximo T-3
CUS (customer-api):  branch feature/CL-31-cus | último T-5 (e4f5g6h) | próximo —      ✅ repo green
BFF (seru-delivery): branch feature/CL-31-bff | último —             | próximo T-7
POR (portal):        branch feature/CL-31-por | último —             | próximo T-9
abertas: —
cobertura: REQ-1 ✅  REQ-2 ✅  REQ-3 ⏳ (BFF)
```

**Rewrite it the instant a task finishes — after the task's commit, before dispatching the next subagent.** This is non-negotiable: `state.md` must always reflect the *real* committed state, so if the session dies mid-plan, the next run reads `último`/`próximo` (for the relevant repo row, when multi-repo) and resumes from the exact task that was in flight — no re-doing committed work, no skipping an unstarted one. A `state.md` updated only at the end is useless for the one case it exists for.

It's a cursor, not a journal: where am I, what's next, which requirements are green. The `cobertura:` line mirrors the plan's matrix and feeds the closing gate. Detailed history lives in git, not here. On a parallel batch, only you (the orchestrator) touch `state.md` — subagents never write it, or they'd race.

## The closing gate — the proof

This is the payoff of the whole workflow. When the tasks are done, **dispatch a closing-gate subagent to walk the plan's coverage matrix and prove completion** — the orchestrator commissions the proof and reads the verdict; it doesn't run the checks in its own context. Don't declare done on vibes:

```
for each REQ in the plan's matrix:
    ├─ its task(s) committed?           (check git — in the task's repo worktree when multi-repo)
    ├─ its named test exists and is GREEN?   (run it in that repo's worktree)
    └─ ✅ only if both hold

then on the integrated branch (per repo when multi-repo — each in its own worktree):
    ├─ full suite passes
    ├─ test count did NOT regress vs base — no test silently deleted or skipped to go green
    ├─ coverage of the new slice didn't regress (threshold from that repo's testing.md)
    ├─ lint/typecheck/hooks pass (the project's enforced invariants)
    └─ collect every // SPEC_DEVIATION marker in the slice → list them in the report

# multi-repo only: feature is done ⟺ every repo in the registry passes the above;
# a single-repo target reports just its own repo green, others may stay open.
```

If any REQ lacks a committed task with a passing test, **do not declare done.** Report exactly which requirements are still open and what's missing. This is the difference from a static coverage check: here every requirement is proven by a *passing test on the real branch*, not just a row in a table.

**Multi-repo: "done" is repo-relative when a repo was the target; global done needs every repo green.** When the run was `sdd:implement <feature> <repo>`, the closing gate proves *that repo's* slice of the matrix (its tasks committed, its tests green on its branch in its worktree) and reports the repo as done — the other repos may still be open, and that's expected (one terminal per repo). The **feature** is done only when every repo in the registry is green: the closing gate walks the matrix **per repo**, each row resolved in its own worktree (`git -C <repo-worktree>`, tests via *that* repo's `testing.md`), and won't declare the feature complete while any repo's slice has an open REQ. Cross-repo interface compatibility is checked against the plan's `## Contrato de interface entre repos` block — a repo green in isolation but diverging from the contract is reported as a blocker, not a pass.

The **test-count check** is mechanical and cheap: it catches the one cheat a green suite hides — a test removed or `.skip`-ed so the bar is lower than it was. The gate compares the slice's test count against the base branch; a drop with no committed task that legitimately removed a test is a failure, not a pass. Coverage threshold and run commands come from `testing.md`, never invented.

When the gate is fully green, update `state.md` (`próximo: —`, all REQs ✅) and report: which tasks landed, the matrix all-green, suite + coverage status, test-count delta, and any `SPEC_DEVIATION` markers (each a conscious, reviewed divergence). That report is the proof the user asked for.

## What this skill must not do

- **No production code without a failing test first.** The red step is the guarantee, not a formality.
- **No declaring done with an uncovered REQ.** The closing gate exists precisely to prevent "looks finished but isn't".
- **No parallel without the plan's proof.** Unsure → serial. A corrupted merge costs more than the time saved.
- **No fat subagent context.** Briefing per task, not the whole map. Lean context is what keeps the executor from drifting.
- **No scope creep.** A task touches only its `Arquivos`. New work discovered mid-task → note it, finish the task, raise it — don't silently expand.
- **No implementing in your own context.** Every task, even the only task, goes to a fresh subagent. The orchestrator orchestrates; it never codes.
- **No reviewing or gating in your own context.** Post-Gate Review and the closing gate run in fresh subagents too. You commission the check and read the verdict — you never read source to judge it yourself.
- **No codebase analysis.** Analysis was Phase 2. If a task needs it, the plan is incomplete — fix the plan, don't analyze here.
- **No silent test deletion.** Test count must not regress to go green. A dropped/skipped test without a task that legitimately removed it fails the gate.
- **No undocumented divergence.** Code that departs from the plan's Steps carries a `// SPEC_DEVIATION:` marker with a reason. Drift without a marker is a review failure.
- **No state.md as a journal.** Cursor only, lowercase filename, rewritten compact after every task; git holds the history.

## Common mistakes

| Mistake | Fix |
|---|---|
| Writing the code, then a test for it | Test first, watch it fail. A test written after passes trivially and proves nothing. See `references/tdd-discipline.md`. |
| Declaring the feature done because "it works" | Walk the matrix. Every REQ needs a committed task and a green test on the integrated branch. |
| Running tasks in parallel to be fast | Only if the plan marked them `[P]` in a batch (proven file-isolated). Otherwise serial — a bad merge costs more. |
| Pasting the whole context.md into each subagent | ~500-token briefing from the plan's `Arquivos`/`Verificação`. The map was the plan's input, not the executor's. |
| One giant commit at the end | Atomic commit per task — that's how status derives from git and how rollback stays cheap. |
| "It's one tiny task, I'll just do it myself" | Spawn a subagent anyway. One task → one subagent, always. The orchestrator never codes. |
| Reviewing the diff yourself to save a subagent | Post-Gate Review and the closing gate are subagents. You read verdicts, not source. Fresh eyes catch what the author rationalized. |
| Reading source to decide how to implement | That's analysis — it belonged to Phase 2. The plan's Steps already say how. Missing? Fix the plan. |
| Suite green, so it's fine | Check the test count didn't drop — a `.skip` or a deleted case turns red green. The gate asserts count vs base. |
| Code diverged from the plan, no note | Leave a `// SPEC_DEVIATION:` marker with the reason. The closing gate collects them; silent drift is a review failure. |
| Writing tests to your own taste | Tests follow `docs/codebase/conventions/testing.md` — location, naming, coverage checklist, commands, threshold. It's the project's test contract. |
| Updating state.md only at the end | Rewrite it after every task's commit. It exists for the dead-session case; stale = useless. |
| state.md growing every session | Rewrite it compact each time. It's a cursor (branch, last/next, coverage), not a log. |
| Re-running dependencies when targeting a single task | Verify the dependency is committed; if not, stop and say so. Don't silently rebuild it. |
| Running a task in the orchestrator's cwd on a multi-repo plan | Resolve the task's `Repo:` tag to its worktree (from the registry / `Lote 0`) and run there (`git -C <repo-worktree>`). The cwd is only right for untagged single-repo tasks. |
| Treating the repo selector as "build all 4 repos for me" | One `sdd:implement <feature> <repo>` works one repo, in its terminal. Opção 1: the machine knows the repos, the human drives one terminal per repo. Not auto-orchestration of N pipelines. |
| Declaring the feature done after one repo goes green | Repo-target done is repo-relative. Feature done needs every repo in the registry green, each proven in its own worktree, and matching the interface contract. |
