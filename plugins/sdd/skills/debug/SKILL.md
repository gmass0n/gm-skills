---
name: debug
description: Diagnose a reproducible bug and apply a proven surgical fix.
disable-model-invocation: true
---

# SDD — Debug

*You have already been invoked; these instructions are now active context, not a pending action. Do not call the Skill tool to invoke this skill again.*

Debug is a hypothesis-first, runtime-evidence loop: symptom → root cause → smallest fix → proof. It is for bugs, not feature design or broad refactors.

## Ground and triage

1. Read `docs/codebase/context.md` if present, lock the prompt language for narration, and create `docs/debug/<slug>/report.md` (or `docs/specs/<feature>/debug-<slug>.md` for a named feature) from [the debug report template](templates/debug-report.template.md). The report is always English, records `lang:`, and is rewritten after each phase as the resume cursor and cleanup manifest.
2. If the map, testing convention, or spec is absent, continue in explicitly documented ungrounded/inferred mode; never refuse an emergency debug.
3. Capture the exact failure, expected versus observed behavior, and the smallest reproduction. Classify it as backend error, frontend failure, or silent/wrong flow. If it cannot reproduce locally, collect available runtime evidence or ask for a reproduction; do not guess.
4. For every additional repository touched, first read its own map and applicable spec before instrumenting it.

## Prove the cause

1. Commission focused exploration for 2–5 distinct, testable root-cause hypotheses. It must return the suspect path, distinguishing evidence, and the complete caller list; the orchestrator does not read source or edit code itself.
2. Persist hypotheses as untested in the report. Before a fix, obtain runtime evidence that confirms one; if no hypothesis is confirmed, continue collecting. Read [hypothesis discipline](references/hypothesis-discipline.md) before any fix and when an attempt fails.
3. When a new internal observation is needed, commission targeted structured capture with `scripts/debug-server.js`; use direct browser, network, database, or existing-runtime inspection when it already exposes the fact. Read [runtime capture](references/runtime-capture.md) only for the applicable stack or capture channel.
4. Mark every injected sender with the session anchor and remove it after collection. Capture remains in the session folder and is cited by the report.

## Fix and close

1. Commission a fix executor to make the minimized repro red for the right assertion, fix the shared root across all callers, and prove the regression test green. Reuse the existing test convention; test/typecheck/lint all affected repositories.
2. Before cleanup, re-run the same live reproduction and record the before/after delta. Then remove every anchored sender with grep-zero in each touched repo, stop the capture server, delete the capture only after reading that delta, and restore any service changed for capture. A closing gate requires all of this, the green regression test, and human confirmation before `resolved`.
3. Record a lesson only for a confirmed shared cause, using `$sdd:implement`'s existing lessons mechanism. Otherwise write no lesson.

If the user reports the bug still exists, mark the report reopened, stop editing, and re-enter at hypotheses rather than stacking another fix. After three failed attempts, re-hypothesize the symptom, target, and reproduction; if still blocked, escalate with the report. Do not write product design, leave instrumentation behind, or declare success without runtime evidence, re-repro, regression proof, cleanup, and confirmation.
