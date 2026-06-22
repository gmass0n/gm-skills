---
name: implement
description: Use to execute an approved implementation plan task by task — Phase 3 (EXECUTE) of the SDD workflow, after sdd:plan. Reads docs/specs/<feature>/plan.md and works through its tasks, one fresh subagent per task, each doing strict test-first TDD (write the failing test, watch it fail, make it pass, refactor, commit atomically), reviewed before moving on. Serial by default; parallel only when the plan proves tasks are file-isolated. Ends with a closing gate that walks the coverage matrix and proves every requirement has a passing test. Trigger whenever the user wants to build/implement/execute a feature that has a plan, says "implement this", "build the plan", "run the tasks", "let's code X", or names a task/batch like "do T-3" or "run batch L-2" — and always against an existing plan. It will not declare done while any requirement lacks a green test.
---

# SDD — Implement (Phase 3: Execute)

## What this phase does

Turn `docs/specs/<feature>/plan.md` into working, tested code — and **prove** it. This is the end of the proof chain: the spec said WHAT, the plan said HOW and built the coverage matrix, and this phase makes every requirement real and green. The user's strongest requirement governs everything here: *nothing is skipped, nothing is untested, and the flow proves it* — mechanically, not on trust.

You are the **orchestrator**. You don't write feature code in your own context; you dispatch a fresh subagent per task, review its work, and move on. Why: a subagent with a small, sharp brief is far less likely to drift or hallucinate than one big context accumulating every file it ever read. Isolation per task is the anti-hallucination mechanism.

This phase reads `plan.md` and the codebase map; it writes code, tests, commits, and the feature's `STATE.md`.

## Preconditions — refuse rather than guess

- **No `plan.md`** → refuse: "Não há plano para `<feature>`. Rode `sdd:plan <feature>` primeiro."
- **`plan.md` has open `[ANALYSIS]` markers or `status: draft`** → refuse and point back to `sdd:plan`. This is the safety net for a plan abandoned mid-`/analyze`; normally it never fires.
- **Invoked with no plan at all** (user wants to just code) → don't silently comply. Say: "Sem plano não há matriz de cobertura — não consigo provar que tudo foi feito e testado. Confirma que quer modo vibe (sem garantia)?" Let the user choose the downgrade consciously rather than losing the guarantee silently.

**Inherit the language** from `plan.md`'s frontmatter (`lang:`). All your narration, commit messages follow the repo's git convention (English, per the project), but your communication with the user stays in the plan's language.

## Targeting — whole feature, one task, or one batch

`sdd:implement` accepts an optional target:
- `sdd:implement <feature>` — work the whole plan, batch by batch.
- `sdd:implement T-3` — just task T-3. **Verify its preconditions** (its `Depende de:` tasks are already committed) but do **not** silently re-run dependencies — if a dependency isn't done, say so and stop.
- `sdd:implement L-2` — just batch L-2.

Stable task/batch IDs come from the plan; that's why they exist.

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

## The task loop — strict TDD, one subagent each

For each task, dispatch one fresh subagent. Give it a **task briefing (~500 tokens)** — not the whole codebase map. The briefing is assembled from the plan's `Arquivos` + `Verificação` fields plus the specific `caminho:linha` pointers it needs. Navigating the map was the plan's job; the executor gets a sharp, pre-digested brief. This keeps each subagent lean and on-target.

Each subagent does **test-first TDD, no exceptions**:

```
RED    → write the test from the task's Verificação criterion. RUN IT. Watch it fail.
         (If it passes before any code, the test is wrong — it's not testing the thing.)
GREEN  → write the minimal code to make it pass. RUN IT. Watch it pass.
REFACTOR → clean up with the test as a safety net. Tests stay green.
COMMIT → atomic commit for this task (the project's commit convention; in English).
```

The non-negotiable: **no production code without a failing test first.** This is the fourth link in the proof chain — it guarantees every line of feature code exists to satisfy a test that maps to a requirement. The discipline that makes this stick (and the rationalizations that erode it) is in `references/tdd-discipline.md` — read it when a task tempts you to skip the red step or when a test is hard to write.

**Review after each task (serial path).** Before moving to the next task, check the subagent's work: tests green, the task's `Verificação` actually satisfied, no scope creep beyond the task's `Arquivos`, follows the patterns in the codebase map. On a parallel batch, review per-batch instead (after the integrated-branch suite passes) — that's the one place granularity yields to throughput.

Task status **derives from git** — an atomic commit per task is the record of what's done. Don't maintain a parallel "done list"; the commit log is the truth.

## STATE.md — the cursor, kept tiny

Maintain `docs/specs/<feature>/STATE.md` so work survives across sessions. **Only `sdd:implement` writes it.** Keep it bounded and **rewrite it compact each update — never append** — so it stays ~300-400 tokens and costs almost nothing to load:

```markdown
# STATE — <feature>
branch: feature/CL-28-notifications
último: T-3 (commit a1b2c3d)
próximo: T-4
abertas: —                          # decisões/bloqueios pendentes
cobertura: REQ-1 ✅  REQ-2 ✅  REQ-3 ⏳
```

It's a cursor, not a journal: where am I, what's next, which requirements are green. The `cobertura:` line mirrors the plan's matrix and feeds the closing gate. Detailed history lives in git, not here. On a parallel batch, only you (the orchestrator) touch STATE.md — subagents never write it, or they'd race.

## The closing gate — the proof

This is the payoff of the whole workflow. When the tasks are done, **walk the plan's coverage matrix and prove completion** — don't declare done on vibes:

```
for each REQ in the plan's matrix:
    ├─ its task(s) committed?           (check git)
    ├─ its named test exists and is GREEN?   (run it)
    └─ ✅ only if both hold

then on the integrated branch:
    ├─ full suite passes
    ├─ coverage of the new slice didn't regress
    └─ lint/typecheck/hooks pass (the project's enforced invariants)
```

If any REQ lacks a committed task with a passing test, **do not declare done.** Report exactly which requirements are still open and what's missing. This is the difference from a static coverage check: here every requirement is proven by a *passing test on the real branch*, not just a row in a table.

When the gate is fully green, update STATE.md (`próximo: —`, all REQs ✅) and report: which tasks landed, the matrix all-green, suite + coverage status. That report is the proof the user asked for.

## What this skill must not do

- **No production code without a failing test first.** The red step is the guarantee, not a formality.
- **No declaring done with an uncovered REQ.** The closing gate exists precisely to prevent "looks finished but isn't".
- **No parallel without the plan's proof.** Unsure → serial. A corrupted merge costs more than the time saved.
- **No fat subagent context.** Briefing per task, not the whole map. Lean context is what keeps the executor from drifting.
- **No scope creep.** A task touches only its `Arquivos`. New work discovered mid-task → note it, finish the task, raise it — don't silently expand.
- **No STATE.md as a journal.** Cursor only, rewritten compact; git holds the history.

## Common mistakes

| Mistake | Fix |
|---|---|
| Writing the code, then a test for it | Test first, watch it fail. A test written after passes trivially and proves nothing. See `references/tdd-discipline.md`. |
| Declaring the feature done because "it works" | Walk the matrix. Every REQ needs a committed task and a green test on the integrated branch. |
| Running tasks in parallel to be fast | Only if the plan marked them `[P]` in a batch (proven file-isolated). Otherwise serial — a bad merge costs more. |
| Pasting the whole context.md into each subagent | ~500-token briefing from the plan's `Arquivos`/`Verificação`. The map was the plan's input, not the executor's. |
| One giant commit at the end | Atomic commit per task — that's how status derives from git and how rollback stays cheap. |
| STATE.md growing every session | Rewrite it compact each time. It's a cursor (branch, last/next, coverage), not a log. |
| Re-running dependencies when targeting a single task | Verify the dependency is committed; if not, stop and say so. Don't silently rebuild it. |
