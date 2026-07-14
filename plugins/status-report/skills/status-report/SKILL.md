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
4. Classify every candidate detail before writing. Never copy secrets, credentials, tokens, personal data, internal IDs, raw logs, stack traces, request/response bodies, hostnames, repository paths, or exploit-enabling implementation details into an audience-neutral report. Replace them with the minimum plain-language summary that preserves impact, cause, and next action; retain evidence privately only when the user explicitly scopes the report to an authorized internal audience.
5. If a detail might be sensitive and cannot be safely summarized without changing the report's meaning, stop and ask the user whether to redact it, use an approved wording, or change the audience. Do not guess authorization or include it by default.
6. Render [status-report.template.txt](templates/status-report.template.txt). Remove template comments and empty fields. Preserve its WhatsApp/plain-text styling, status emoji, plain language, and audience-neutral scope. Apply the same redaction rule to [action-plan.template.txt](templates/action-plan.template.txt).
7. If the user requested an action plan, render it. If they declined, skip it; otherwise ask once after the report. Gather owners and deadlines only for this branch.
8. Report the exact file paths created.

## Completion

Finish only when every reported fact is supported by supplied or inspected evidence, unknown facts and sensitive ambiguities have been resolved with the user, and the report makes status, impact, and next action clear to leadership, support, and customers without exposing restricted details.
