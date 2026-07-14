---
name: debug
description: Diagnose a reproducible bug and apply a proven surgical fix.
disable-model-invocation: true
---

# SDD — Debug

Debug is a hypothesis-first, runtime-evidence loop: symptom → root cause → smallest fix → proof. It is for bugs, not feature design or broad refactors.

## Ground and triage

1. Read `docs/codebase/context.md` if present, lock the prompt language for narration, and create `docs/debug/<slug>/report.md` (or `docs/specs/<feature>/debug-<slug>.md` for a named feature). The report is always English and records `lang:`.
2. If the map, testing convention, or spec is absent, continue in explicitly documented ungrounded/inferred mode; never refuse an emergency debug.
3. Capture the exact failure, expected versus observed behavior, and the smallest reproduction. Classify it as backend error, frontend failure, or silent/wrong flow. If it cannot reproduce locally, collect available runtime evidence or ask for a reproduction; do not guess.
4. For every additional repository touched, first read its own map and applicable spec before instrumenting it.

## Prove the cause

1. Commission focused exploration for 2–5 distinct, testable root-cause hypotheses. It must return the suspect path, distinguishing evidence, and the complete caller list; the orchestrator does not read source or edit code itself.
2. Persist hypotheses as untested in the report. Before a fix, obtain runtime evidence that confirms one; if no hypothesis is confirmed, continue collecting.
3. When a new internal observation is needed, commission targeted structured capture with `scripts/debug-server.js`; use direct browser, network, database, or existing-runtime inspection when it already exposes the fact. Read [runtime capture](references/runtime-capture.md) only for the applicable stack or capture channel, and [hypothesis discipline](references/hypothesis-discipline.md) when deciding whether evidence is sufficient.
4. Mark every injected sender with the session anchor and remove it after collection. Capture remains in the session folder and is cited by the report.

## Fix and close

1. Commission a fix executor to make the minimized repro red, fix the shared root across all callers, and prove the regression test green. Reuse the existing test convention; test/typecheck/lint all affected repositories.
2. Remove every debug anchor and stop the capture server. A closing gate confirms the evidence, root cause, caller scope, regression proof, cleanup, and human confirmation.
3. Record a lesson only for a confirmed shared cause, using `$sdd:implement`'s existing lessons mechanism. Otherwise write no lesson.

If the user reports the bug still exists, re-enter at hypotheses rather than stacking another fix. Do not write product design, leave instrumentation behind, or declare success without runtime evidence, regression proof, and confirmation.
