# Interview — grilling for a status report

Use this only when the context is thin. The goal is a report a director, a support agent,
and a customer can all read and trust. That needs a small set of essential fields. Before
asking anything, **mine what you already have** — the session, pasted emails/chats, the
codebase, git history. If an answer is discoverable, find it; don't ask.

## The rule: one question at a time

Ask a single question, wait for the answer, then ask the next. Never batch. Each question
carries a **recommended answer** drawn from context, so the user can confirm with one word
instead of composing a reply. Stop the moment the essential fields are covered — don't
grill for completeness's sake.

## Essential fields (cover these, then stop)

1. **Title / subject** — what is this report about, in one line.
2. **Status** — Resolved ✅ / In progress 🔧 / Blocked ⛔ (with nuance if any, e.g.
   "resolved, prevention in progress").
3. **What happened** — the symptom as the audience felt it, plus the root cause in plain
   language. This is the heart; spend questions here if anything is fuzzy.
4. **Impact / scope** — who/what was affected, and explicitly what was *not*.
5. **Resolution or next steps** — what fixed it, or what comes next if not yet resolved.
6. **Date** — when. Default to today if obvious.

## Optional, only if it sharpens the report

- The "why only some cases" nuance (the partial-impact section) — ask only if the impact
  was partial and the reason isn't already clear.
- Action-plan inputs (root cause to treat, owners, deadlines, recommendation) — gather
  these **only if** the user wants the action plan. Ask about the plan at the end (see
  SKILL.md), not up front.

## Question shape

> "Status looks like **✅ Resolved, with a prevention plan still in progress** — confirm,
> or is it still In progress?"

Recommended answer first, the alternative as an easy correction. Keep it short. If the user
gives a terse "yes" / "isso" / "correto", take it and move on.

## Sensitive details

Treat the report as audience-neutral unless the user explicitly scopes an authorized internal
audience. Do not ask the user to paste secrets, credentials, tokens, PII, raw logs, payloads, or
internal identifiers. If a supplied detail is potentially sensitive and a safe summary would lose
material meaning, ask one question: whether to redact it, provide approved wording, or change the
audience. Never infer authorization from the source material alone.
