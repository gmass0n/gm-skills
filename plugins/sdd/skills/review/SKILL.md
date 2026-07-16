---
name: review
description: Produce an evidence-backed local code-review verdict.
disable-model-invocation: true
---

# SDD — Review

*You have already been invoked; these instructions are now active context, not a pending action. Do not call the Skill tool to invoke this skill again.*

Review local code only and write one verdict at `docs/reviews/<slug>/review.md`. Route remote PR URLs to `$prs-review`; this skill never fixes code or changes a remote.

## Ground and resolve

1. Read `docs/codebase/context.md`, `CLAUDE.md`, and `REVIEW.md` when present. If the map is absent, continue with `grounded: no` and state the limitation. Lock the prompt language for report prose and narration.
2. Resolve the target with `node scripts/review.js resolve <arg>`. Support diff, file/directory/glob, commit/range/tag, full audit, and pasted code. If both working changes and branch diff are plausible, ask which target to review. Declare the base, any risk/churn sampling, generated files, and deprioritized files; an empty target produces no findings.
3. Load a matching spec only when one exists; otherwise disable the spec lens. Load confirmed lessons as priors only.

## Falsify findings

1. The orchestrator delegates and synthesizes; it does not judge source, promote a hypothesis, or override a verifier. Slice the target with `review.js slice` and commission fresh blind lenses for correctness, security, performance, architecture, and, conditionally, spec alignment. Lenses return hypotheses, never verdicts. Read [review lenses](references/review-lenses.md) when creating these briefs.
2. Run commands documented in `testing.md`, or `package.json` only when no convention exists: tests, typecheck, lint, deterministic invariants, and test-count comparison in parallel. A failing test/typecheck/lint or test-count drop where a base exists is a blocker; an unknown command is recorded as skipped, never guessed. Gates apply when a runnable repository exists; pasted code explicitly skips them.
3. Deduplicate findings and commission an adversarial verifier per file. No finding ships without its verified `file:Lline` and concrete impact; downgrade incomplete evidence to a warning with `confirmar:` and put intent-only uncertainty under questions for the author. Read [verification discipline](references/verification-discipline.md) for vote and confidence rules.
4. Run a proportional mutation sensor only for risk files with a documented scoped test command; otherwise record `sensor off`. It uses an isolated worktree, never the live tree; follow [the mutation-sensor reference](../implement/references/mutation-sensor.md). A surviving mutant is a blocker requiring a fix task and grounded lesson.

## Verdict and handoff

- Count severities with `review.js tally`; a confirmed verifier blocker or any failed required gate rejects. Warnings and nits approve with comments.
- On diff/range targets, report pre-existing untouched problems separately and non-blocking; on whole-target reviews, they are in scope.
- Re-run only for a new confirmed blocker, at most two rounds, suppressing new nits; re-run only lenses that found it, over the remaining slice, with the already-confirmed summary.
- Write the report using [the report template](templates/review-report.template.md), including gates, considered-and-cleared hypotheses, questions, and next-step routing.

Report the terse verdict and file path. Route runtime defects to `$sdd:debug`, specification gaps to `$sdd:spec` or `$sdd:plan`, and implementation work to the user; never auto-invoke them.
