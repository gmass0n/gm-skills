---
name: status-report
description: "Use to write a polished, leadership-ready status report for any fix, incident, or in-flight change — and, optionally, a separate enterprise action plan. Trigger on \"status report\", \"status update\", \"incident report\", \"postmortem\", \"report on the fix/issue\", \"write up what happened\", \"update for the team/client/leadership\", \"resumo do ajuste\", \"relatório do incidente\" — and ALSO whenever the user describes a problem or change (resolved, in progress, or blocked) and wants to communicate it to people, even if they never say the words \"status report\". The report is styled for WhatsApp/email, reads clearly for directors + support + customer at once, and the skill interviews the user one question at a time when context is thin rather than inventing facts."
---

# Status Report

## What this skill produces

One file, sometimes two, under `docs/status-reports/<slug>/` in the current working directory:

- `status-report.txt` — always. A single, polished report in the validated style: a 📄 title,
  bold-labelled metadata lines, plain-language narrative sections, status emoji (✅ 🔧 ⛔).
  It is **audience-agnostic on purpose** — one report clear enough for leadership, support,
  and the customer at the same time. No per-audience variants.
- `action-plan.txt` — only when the situation warrants it and the user wants it. A 🛠️
  enterprise action plan: root cause to treat, numbered actions with owners and deadlines,
  and a prioritized recommendation.

`<slug>` is the kebab-case of the title (e.g. `bradesco-pix-webhook`).

## Why this skill exists

The raw instinct, when asked "write up what happened", is to dump a technical changelog or
to guess at facts that aren't in the conversation. Both fail the real reader: a director who
needs the impact in one breath, a support agent who needs to answer a customer, a customer
who needs reassurance in plain words. This skill enforces the opposite discipline — **mine
the context first, ask before inventing, then render in a style that has already been
validated with real stakeholders.**

## Workflow

### 1. Detect language

The report follows the language of the user's prompt. PT-BR prompt → PT-BR report; English
prompt → English report. Fixed labels in the templates get translated to match. Everything
below is about *process*; the *output* is in the user's language.

### 2. Assess the context

Before asking anything, gather what you already have: this session, files or text the user
pasted (emails, chat logs, timelines), the codebase, git history. Decide whether the
**essential fields** are covered: title, status (Resolved / In progress / Blocked), what
happened (symptom + root cause in plain language), impact/scope, resolution or next steps,
date. If an answer lives in the code or the context, **find it — don't ask.**

### 3. Interview only if the context is thin

If an essential field is genuinely missing, run the grilling in `references/interview.md`:
**one question at a time**, each with a recommended answer drawn from context, stopping the
moment the essentials are covered. Don't grill for completeness; a report you can already
write well doesn't need an interview.

### 4. Fan out, then synthesize

When the inputs are settled, gather depth with **three subagents in parallel** (Agent tool,
all in a single message). The orchestrator does not research in its own context — it only
reads the digests and synthesizes.

- **(a) Timeline + root cause** — reconstruct the sequence of events and the underlying
  mechanism (not just the symptom) from the context and codebase.
- **(b) Evidence** — sweep the available material (code, emails, conversations, logs) for
  concrete facts that back the narrative: what was affected, what wasn't, what confirmed the
  fix.
- **(c) Action plan** — draft enterprise prevention/next-step actions with candidate owners
  and deadlines, even if the user hasn't yet decided they want the plan file. Cheap to have
  ready; discard if they decline.

**Compatibility:** on Claude, use subagents as above. If subagents are unavailable (Codex,
or an inline-only environment), degrade to running these three investigations sequentially
inline — same output, just without the parallelism.

### 5. Render the status report

Fill `templates/status-report.template.txt` from the synthesized facts. Keep the validated
style exactly: 📄 title, `- *Label*: value` metadata, `*Header?*` / `*Header:*` section
titles, `-` lists, status emoji. Strip the template's `#` comment lines from the final file.
Drop any section or metadata line that has no content — never leave an empty placeholder.

### 6. Offer the action plan

If the user already asked for an action plan, generate it. If they already declined it,
don't. Otherwise, **ask once** at the end: "Want a separate action plan too?" Generate
`action-plan.txt` from `templates/action-plan.template.txt` only when they say yes (or when
the situation clearly calls for prevention work and they confirm).

### 7. Write and report the paths

Write to `docs/status-reports/<slug>/`, creating the directory. Tell the user the exact
file path(s) produced.

## Style notes (carried from the validated report)

- Bold is WhatsApp-style single asterisk: `*Status*`. In a plain-text email client the `*`
  shows literally — that's expected and accepted.
- Keep full accentuation (PT-BR: "Resolução", "Situação", "não").
- Status emoji: ✅ Resolved · 🔧 In progress · ⛔ Blocked. Reuse the same emoji on the
  "current state" bullets.
- Plain language over jargon. When something is counterintuitive, name it explicitly
  ("only Bradesco uses this kind of certificate; the others kept working").
