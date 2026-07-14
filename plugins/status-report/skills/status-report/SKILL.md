---
name: status-report
description: Write a plain-language status report and optional action plan.
disable-model-invocation: true
---

# Status Report

Write `docs/status-reports/<kebab-case-title>/status-report.txt` in the user's language. Create `action-plan.txt` only when the user asks for it or confirms it after the report.

## Workflow

1. Mine the session, supplied material, codebase, and history before asking. Establish title, status, plain-language symptom and root cause, impact and unaffected scope, resolution or next steps, and date.
2. If any essential field remains unknown, read [interview.md](references/interview.md) and ask one recommended question at a time. Stop when the essentials are covered.
3. Investigate timeline/root cause, supporting evidence, and candidate prevention actions. Use three focused subagents in parallel when available; otherwise perform those investigations sequentially without changing the result.
4. Render [status-report.template.txt](templates/status-report.template.txt). Remove template comments and empty fields. Preserve its WhatsApp/plain-text styling, status emoji, plain language, and audience-neutral scope.
5. If the user requested an action plan, render [action-plan.template.txt](templates/action-plan.template.txt). If they declined, skip it; otherwise ask once after the report. Gather owners and deadlines only for this branch.
6. Report the exact file paths created.

## Completion

Finish only when every reported fact is supported by supplied or inspected evidence, unknown facts have been resolved with the user, and the report makes status, impact, and next action clear to leadership, support, and customers.
