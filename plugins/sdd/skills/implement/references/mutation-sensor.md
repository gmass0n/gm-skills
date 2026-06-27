# Reference: the discrimination sensor (mutation testing on P0 REQs)

Read this when the closing gate reaches a **green matrix** and the plan has P0 tasks. The sensor answers a question a green test can't: *does the test actually discriminate the right behavior, or does it pass for the wrong reason?* A test that stays green when the code is broken is a false proof — the sensor injects one small break (a mutant) and confirms the named test **kills** it.

## Scope — P0 only, one mutant per REQ, scoped run

- The sensor runs **only on REQs whose task is `Priority: P0`** in the plan. P1/P2 are out — mutation testing is the expensive end of the proof, spent where the risk is.
- For each P0 REQ: **one** mutant, proportional to the risk of that REQ's logic. Not a mutant zoo — the smallest break that the REQ's behavior should catch.
- The run is **scoped to that REQ's named test**, the same scoping the gate already uses (`implement/SKILL.md` closing gate: "its named test … run it"). One scoped test execution per P0 REQ — **not the suite**. The gate narrates the cost up front: *"sensor: N P0 REQs, N scoped tests"*.

## Precondition — prove the scoped run exists, or disable

Before injecting anything, **dispatch an `Explore` subagent at the target repo's `docs/codebase/conventions/testing.md`** and confirm it documents **running a single test by name** (`--testNamePattern` on Jest/Vitest, `-k` on pytest, the repo's equivalent).

- **Documented** → the sensor uses that exact command. Cost = one scoped test per P0 REQ.
- **Not documented / suite-only** → the sensor **disables itself in this repo** and the gate narrates: *"sensor off: testing.md does not document a scoped run by test name"*. It does **not** fall back to running the full suite N times — that cost is never paid silently.

Multi-repo: this check is **per repo** (each repo has its own `testing.md`), exactly like the rest of the gate.

## Mutation catalog — pick ONE proportional to the REQ

| Mutant | When it fits | Example |
|---|---|---|
| boolean flip | REQ guarded by a condition | `if (x)` → `if (!x)` |
| comparison swap | boundary/threshold REQ | `>=` → `>`, `<` → `<=` |
| off-by-one | pagination/index/count REQ | `i < n` → `i <= n` |
| return swap | REQ asserts a specific output | `return mapped` → `return raw` (or `null`) |
| short-circuit removal | REQ about a side effect / emission | delete the line that emits/persists |

Pick the one that targets **the behavior the REQ's AC names**. A REQ about "emit within 2s" → kill the emission line; a REQ about "discard while disconnected" → flip the disconnected guard.

## The scratch — git worktree, never `git stash`

**Do not use `git stash`.** Stash pushes onto the repo-global stash stack, shared across every worktree of a multi-repo checkout; a lost `pop` contaminates the next gate. Instead, mutate in a throwaway worktree — the same primitive the gate already uses for parallel batches:

```
loop over P0 REQs:
  tmp=$(absolute path under the OS tmp dir, unique per REQ)
  git -C <repo> worktree add "$tmp" HEAD          # isolated copy at HEAD, real tree untouched
  try:
    symlink node_modules from <repo> into "$tmp"   # fresh worktree has none (same as parallel batches)
    apply the ONE mutant to the REQ's source file in "$tmp"
    run the REQ's named test, scoped, in "$tmp"    # the testing.md command
    assert: the test now FAILS (it killed the mutant)
  finally:
    git -C <repo> worktree remove --force "$tmp"   # MANDATORY even on error/exception
```

- Path is **absolute** (a relative path resolves against the wrong cwd in a multi-repo run).
- Cleanup is in a `finally` — a thrown assertion or a crashed test never leaves an orphan worktree. (The orphan worktrees already littering these repos are the proof this matters.)
- Zero touch on the real tree and zero touch on the stash. The closing gate stays read-only on the working copy.

## Verdict

- **Mutant killed** (test went red) → the test discriminates. REQ passes the sensor.
- **Mutant survived** (test stayed green) → the test is weak: it's green for the wrong reason. This becomes a **fix task**, routed through the same fix loop the gate uses for any red REQ — write a stronger assertion, re-run, re-sense. It also emits a `surviving_mutant` lesson (see `references/lessons.md`).

A surviving mutant is **not** a gate pass with a warning — it's a real failure of the proof, because the REQ's test demonstrably does not detect the REQ being broken.

## What the sensor is NOT

- Not a full mutation-testing run (no Stryker, no mutant matrices) — one mutant per P0 REQ, by hand, scoped. Zero new dependency.
- Not a replacement for RED/GREEN — it runs **after** the matrix is already green, as an extra discrimination check on the P0 slice only.
- Not run on P1/P2 — priority is the budget. If everything is P0, the spec mis-prioritized; the sensor cost scales with how many P0s the spec declared.
