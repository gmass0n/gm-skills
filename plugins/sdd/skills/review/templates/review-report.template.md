# Template: `review.md` (the review verdict)

The durable verdict of a local review. It lives at `docs/reviews/<slug>/review.md` — `<slug>` is the branch (diff target), the target path slugified (file/dir target), `audit-<date>` (repo-audit), or `paste-<date>` (pasted snippet). It is **long on purpose**: it survives the session and is meant to be pasted into the PR description later. The chat only gets a terse summary + the path; the verdict lives here.

## Language
`review.md`'s **prose follows the prompt's language** (`lang:`): a pt-BR prompt → a pt-BR verdict, an English prompt → an English one. The verdict is meant to be pasted back to the author in their own language, so the finding prose (problem, impact, fix), praise, and questions are written in `lang:`. **Language-invariant regardless of `lang:`** (never translated): the **code identifiers in backticks**, the `file:Lline` anchors, the **frontmatter keys**, the status string (`🟢 REVIEW APROVADO` / `🔴 REVIEW REJEITADO`), and the **machine-readable trailer** CI parses. (This differs from `sdd:spec`/`sdd:debug`, whose artifacts stay English.)

## The grammar (one line per finding — inherited from caveman/prs-review)
- **One finding = one line.** Never split a finding across lines.
- **Every code identifier in backticks** — file, function, variable, enum, value, call: `` `formatCurrency` ``, `` `order.service.ts:L42` ``, `` `status === 9` ``.
- **The exact `file:Lline`** anchors every finding. No `file:Lline` = no finding (evidence-or-zero).
- Terse, no hedging. A blocker line names the **impact**: `` `x:Ln`: <problem> → <impact>. <fix>. ``. A warning/nit: `` `x:Ln`: <problem>. <fix>. ``.

## Structure
```markdown
---
title: review — <slug>
lang: pt | en                 # prompt language; the finding prose follows it (code/file:Lline/trailer stay invariant)
target: diff | file | range | repo-audit | paste
scope: <e.g. "branch feature/CL-18 vs develop (merge-base 135fb89)"; or the path; or "snippet">
grounded: yes | no | partial  # no = map missing (ungrounded); partial = paste (no repo callers)
feature: <feature or ->       # the spec, if the Spec lens ran; "-" otherwise
sampled: <omit if everything was reviewed; else "hot files only — N of M, see Deprioritized">
generated: <date>
---

# Review: <one-line target description>

🟢 REVIEW APROVADO   |   🔴 REVIEW REJEITADO
Scope: <target + base/path> · Blockers: N · Warnings: M · Nits: K<· 🟣 Pre-existing: P, only on a diff target>
Gates: test <pass|fail|skipped> · typecheck <…> · lint <…> · test-count <Δ or n/a> · invariants <ok|N violations> · sensor <killed N | skip: no risk files | off: no scoped run>

## 🔴 Blockers
<only confirmed blockers — each cleared F4's 2-vote. This section is what makes the verdict 🔴.>
1. `file:Lline`: <problem> → <impact>. <fix>.

## 🟡 Warnings
1. `file:Lline`: <problem>. <fix>.
2. `file:Lline`: <problem>. <fix>. (confirmar: <what couldn't be reached>)

## 🔵 Nits
<nit-cap: top-N + a count of the rest. Don't list 40 nits.>
1. `file:Lline`: <problem>. <fix>.
   _(+N more nits — mostly <category>)_

## ✅ Praise
<only concrete, real positives from the target — never invented.>
1. <concrete positive> (`file:Lline`).

## ❓ Questions for author
<non-blocking. Residual uncertainty that depends on intent/business decision, irresolvable by code.
 The review approved/rejected on the findings it COULD resolve; these don't block.>
- `file:Lline`: <the question — e.g. "is discarding `shippingScheduledTo` intentional?">

## Considered and cleared
<findings the verifier refuted — recorded so the next run doesn't re-litigate them.>
- `file:Lline`: <hypothesis> — cleared: <why it's not a bug>.

## 🟣 Pre-existing
<ONLY on a diff/commit/range target. Landmines on untouched lines — surfaced, never blocking, not counted.>
- `file:Lline`: <pre-existing issue> (outside the diff — not introduced here).

## Deprioritized
<ONLY when sampled. What the triage skipped and why, so the skip is visible (no silent caps).>
- <files/areas not reviewed> — <reason: low churn / low risk / generated>.

## Next steps
<routing — this skill routes, it does not fix.>
- Runtime bug in <area> → `sdd:debug`.
- Coverage/requirement gap (REQ-x) → `sdd:plan` / `sdd:spec`.
- Mechanical (nits, lint) → the dev applies.

<!-- sdd-review-severity: {"blocker":N,"warning":M,"nit":K,"pre_existing":P} -->
```

## Filling rules
- **The status line is the verdict.** `🔴 REVIEW REJEITADO` iff there is ≥1 confirmed blocker; otherwise `🟢 REVIEW APROVADO`. **Bias-to-approve:** a warning/nit **never** makes it 🔴. This is the single rule the whole skill bends toward.
- **Omit empty sections entirely** (title included). A clean review is a status line + `Gates:` + maybe Praise — not a wall of empty headers.
- **Counts come from `review.js tally`**, not a hand count — and the **trailer is the last line**, the exact output of `tally` (CI reads it; it must match the section counts). The gate is the hard stop; the trailer is the neutral-by-default count CI consumes.
- **The base is always declared** in `scope:` for a diff target (`merge-base <sha>`) — a review of "the diff" is meaningless without saying against what.
- **🟣 Pre-existing exists ONLY on a diff/commit/range target.** On a file/dir/repo-audit/paste target the whole target is in scope — there is no "pre-existing", so the section and the trailer's `pre_existing` stay at 0 and the section is omitted.
- **Nit-cap.** List the top nits, then collapse the rest to a count (`(+N more nits)`). A review drowning in nits buries the blocker.
- **`confirmar:` is honest partial confidence**, not a hedge — it names exactly what the verifier couldn't reach. A finding with no impact and no `confirmar:` shouldn't be a warning; it's `Considered and cleared` or a `❓ question`.
- **Praise is concrete or absent.** "Good code" is not praise; "`order.mapper.ts:L12` correctly normalizes the antimeridian bounds before `fitBounds`" is.
- **`grounded:` is honest.** `no` when the map was missing (the review ran on `review.js` heuristics — say so); `partial` for a paste (no repo callers to verify against).
- **The report routes, it doesn't fix.** `Next steps` points at `sdd:debug`/`sdd:plan`/`sdd:spec`/the dev — this skill never edits source.
