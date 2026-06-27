---
name: review
description: "Enterprise-grade LOCAL code review of ANY target — the pre-flight before `git push`, when there is no remote PR yet. Use when the user says \"review my changes\", \"revisa antes do PR\", \"review this file/module\", \"review src/modules/orders\", \"audita o repo\", \"revisa esse trecho\", \"check this before I push\", or invokes `/sdd:review`. Reviews a diff (default), a file/dir/glob, a commit/range/tag, the whole repo (`--all`), or a pasted snippet (`--paste`). Blind parallel lenses (correctness, security, performance, architecture, spec-alignment) emit hypotheses, then adversarial verification falsifies each against real `file:Lline`; gates (test/typecheck/lint) and a mutation sensor run in parallel; bias-to-approve. Writes the verdict to docs/reviews/<slug>/review.md. It ROUTES, it does not fix. Do NOT use for a remote PR with a link (that's prs-review) or intra-task during a build (that's sdd:implement's Post-Gate Review)."
---

# SDD — Review (enterprise local review of any target)

## What this skill does, and the boundary it owns

A review is a **falsification engine**, not an opinion. Raw Claude reads a diff and says "looks good" — or worse, lists twenty plausible-sounding concerns, most of them false positives that train the author to ignore reviews. This skill does the opposite: it generates findings as *hypotheses*, then spends its budget trying to **prove each one wrong** against the real code before a single line reaches the report. What survives is grounded in a real `file:Lline` with a concrete impact. The state-of-the-art pipelines (Cloudflare's 131k reviews/month, the official Claude Code Code Review, CR-Bench, CodeAnt) all converge on the same shape — *parallel multi-lens → verification against real behavior → dedup → rank → emit* — and that is exactly the architecture here, plus two things the industry rarely has: **executable gates** (it actually runs the build) and a **risk-gated mutation sensor** (it proves the tests bite).

**This is the LOCAL review of ANY target — and only when there is no remote PR.** There are three review surfaces; this one fills the gap between the other two:

| Surface | Skill | When |
|---|---|---|
| Intra-task, during the build | `sdd:implement` Post-Gate Review | a task just committed inside a plan |
| **Local, before the PR exists — any target** | **`sdd:review` (this skill)** | pre-flight before `git push`; audit a module/file; review a pasted snippet |
| Remote PR (post-push) | `prs-review` (via Bitbucket/GitHub MCP) | the user pastes a PR link |

The boundary is **load-bearing — respect it, don't absorb a neighbor's job:**
- The user pastes a **PR link** (`bitbucket.org/.../pull-requests/...`, `github.com/.../pull/...`) → that's `prs-review`. It needs the MCP and reviews the remote PR. **This skill never touches MCP, git remotes, or a PR by URL.** Route there.
- The user is **mid-`sdd:implement`** and wants a task's commit checked → that's the Post-Gate Review, already inside the implement flow. Don't re-review here.
- Everything else local — *"review my changes before I push"*, *"audit the orders module"*, *"is this file OK"*, *"look at this snippet"* — is **this skill**.

This skill reads the codebase map and (when present) the feature's spec as input; it **writes one artifact**, `docs/reviews/<slug>/review.md`, and **changes no source** — it routes fixes to `sdd:debug` / `sdd:plan` / `sdd:spec`, it never applies them.

## The orchestrator is pure — this is the anti-hallucination core

You are the **orchestrator, and only the orchestrator.** You **never read the diff or the source in your own context to judge it.** You dispatch fresh, blind subagents — one per lens, one per verification batch, one for the gates — read their structured verdicts, and synthesize. Why this is non-negotiable: a reviewer that has read the author's reasoning (or the whole file, or the other lenses' findings) inherits their blind spots and rationalizations. A fresh subagent with a sharp brief and **only its slice** catches what a fat context rationalizes away. The same purity that `sdd:implement` and `sdd:debug` enforce: *commission and synthesize, never analyze in your own context.* If you find yourself reading source to decide whether a finding is real — stop, that's the verifier's job (F4).

The deterministic work — resolving the target, slicing per lens, grouping findings per file, tallying severities, the test-count delta — is **not LLM work.** It's exact, repeated parsing, and it lives in `scripts/review.js` (pure stdlib, zero deps, `--selftest`). The LLM gives the judgment; the script does the bookkeeping. Counting findings for the trailer by hand, or eyeballing which files a lens should see, is how counts drift between runs and slices leak.

## Tiers by capability — multi-LLM, never hardcode a model name

This skill describes the **capability tier** each phase needs; the runtime maps it to a concrete model (in Claude Code via `opts.model` — `haiku`/`sonnet`/`opus`; in another LLM, the equivalent). Hardcoding `opus`/`sonnet` would break portability. If the runtime has no tiers, everything collapses to the single model — it degrades, it doesn't break.

| Phase | Tier | Why |
|---|---|---|
| F0 grounding · F1 triage · F3 dedup · F5 gates · F6 verdict | **fast/cheap** | mechanical: read ~500 tokens, route, collapse `file:Lline`, run commands, assemble markdown. No reasoning about code. |
| `review.js` (resolve/slice/extract/group/tally/testcount) | **— (no LLM)** | deterministic parsing. Zero tokens. |
| F2 lenses · F4 verification · the mutant choice | **reasoning** | generating and falsifying subtle hypotheses about code — where the capable model earns its cost. |

## Before anything — ground and language (F0)

Read **only** `docs/codebase/context.md` (it's light, ~500 tokens) — the orchestrator's one in-context disk read; everything else (source, specs, `testing.md`) goes via subagent. It gives you four things that shape the review:
- **Enforced invariants** (the invariant → mechanism table) → these become the **deterministic gate checks** in F5 (zero-`any`, no-hardcoded-strings, no-arbitrary-px), not an LLM lens. They're `grep`/`biome`, cheaper and more reliable than a reasoning subagent.
- **Per-task loading + Catalog** → maps each target file to its layer, so a lens gets the right layer-doc pointer (read later, by its subagent — not loaded now).
- **Stack** → the gate commands (test/typecheck/lint runner).

**Load confirmed lessons once, here** (cheap, optional): if `docs/codebase/lessons/` exists, run `node ../implement/scripts/lessons.js list --status confirmed` and carry the result into F2 as **priors per dimension** — a `root_cause` lesson (*"the shared X mapper drops nulls"*) is exactly what a Correctness lens should look for first. Confirmed-only, top-N capped, so the load stays tiny. See `../implement/references/lessons.md`.

**Read `CLAUDE.md` (and `REVIEW.md` if it exists) for per-repo recalibration** — project-specific "what we do/don't flag" overrides the generic lens blocklists.

**Graceful degradation — review never refuses:**
- No `docs/codebase/context.md` → warn (*"Map missing — run `sdd:codebase` for a grounded review. Proceeding ungrounded."*) and **continue** without the invariant/spec checks; mark `grounded: no` in the report. The `review.js` layer/risk heuristics are the fallback.
- No `docs/codebase/conventions/testing.md` → infer the gate commands from `package.json`; if you can't, mark the gate `skipped` (don't fake it).
- A **spec** for this target (`docs/specs/<feature>/`, detected from the branch name or confirmed with the user) → enables the Spec-alignment lens. **No spec → that lens is off; never fabricate a requirement.**
- Target = **paste** → minimal grounding: no repo, no gate, just the lenses + lessons as priors.

**Detect and lock the language** of the user's prompt now — it governs **both the live narration** (the spoken summary, any question) **and the verdict file `review.md`**: a pt-BR prompt produces a pt-BR `review.md`, an English prompt an English one. Record that language in `lang:` in the frontmatter. What stays language-invariant regardless of `lang:`: the **code identifiers in backticks**, the `file:Lline` anchors, the **frontmatter keys**, the status string (`🟢 REVIEW APROVADO` / `🔴 REVIEW REJEITADO`), and the **machine-readable trailer** (CI parses it). Only the *prose* of each finding — the problem, the impact, the fix, praise, questions — and the section bodies follow `lang:`. (This differs from `sdd:spec`/`sdd:debug`, whose artifacts stay English; here the verdict is meant to be pasted back to the author in their own language.)

## The flow — F0 → F6, a funnel that falsifies before it reports

Each phase consumes the previous one's output. The critical-path trick: **F5 (gates) fires in parallel with F2 (lenses)** — gates don't depend on findings — and **F4 (verification) pipelines from F3** (verify a file the moment its findings are deduped, batched one verifier per file). So the wall-clock is `max(F2 lenses, F5 gates+sensor) → one batched wave of F4 → F6`, ~3 barriers, not 6.

### F1 — Target resolution + triage (orchestrator + `review.js resolve`)
**Resolve the target via `node scripts/review.js resolve <arg>`** → it returns the **manifest** (reviewable files + churn + layer + risk flag + the GitFlow base + the excluded generated files). It centralizes the five-kind classification so the orchestrator never hand-rolls "what to review":

| Target | Trigger | What it reviews |
|---|---|---|
| **diff** (default) | no arg, or `--staged`/`--working`/`A..B` | lines changed vs the GitFlow base (`merge-base`) — **declare the base** |
| **file/dir/glob** | `/sdd:review src/modules/orders/` | the whole content of the target (synthetic diff = file as additions) |
| **commit/range/tag** | `HEAD~3..HEAD` · `v1.2..v1.3` · a sha | what changed in the range |
| **repo (audit)** | `--all` / "audita o repo" | the whole codebase — **risk triage + sampling mandatory** |
| **paste** | `--paste` + snippet in chat | the snippet, no git, `grounded: partial` |

**Smart default, ask only if genuinely ambiguous.** An arg → use it. No arg → if the working tree is dirty **and** the branch is ahead of the base (two plausible targets), use `AskUserQuestion` (*"review the uncommitted changes, or the whole branch vs `develop`?"*); if only one is plausible, use it without asking. An empty target (empty diff, glob with no match) → say so, review nothing. **The base is always declared** in the report.

**Triage by size — no silent caps.** Small/medium → all files. Large/repo-audit → prioritize hot files (churn + risk by layer + the lessons' scopes) and **announce the sampling** in the report's `Deprioritized` section. Generated files (`*.lock`, `dist/`, snapshots, minified, `.d.ts`, vendored) are excluded by `resolve` and listed as `skipped: generated`.

**Slice per path/layer via `review.js slice`, not the LLM.** Each lens receives **only its dimension's files**: Security ← auth/input/queries/network; Performance ← loops/queries/render; Architecture ← everything (it judges topology + new files + DRY); Correctness ← anything with logic; Spec ← everything (only when a spec exists). This cuts 50-65% of the input. (For a file/repo target, the "slice" is the relevant subset of files for that lens.)

### F2 — Dispatch the lenses (parallel · blind · fresh · **reasoning** tier)
Subagents in the same turn, each **blind to the others and to the author's reasoning**, each receiving: `{the lens's SLICE (not the whole target), the requirements (only if a spec exists — never fabricated), its dimension's invariants + layer-doc pointer, the lessons priors of its dimension}`. The five lenses, their per-dimension checklists, and — critically — their **"What NOT to flag" blocklists** live in `references/review-lenses.md` (read it to build each briefing):

1. **Correctness / edge-cases** · 2. **Security** (incl. 401/logout) · 3. **Performance / N+1** · 4. **Architecture / DRY-SOLID-KISS-YAGNI + reimplementation** (catches code that re-implements something already in the repo under another name — semantic duplication, the most common slop; uses `review.js extract-symbols` for the target's symbols, then a directed `rg` lookup, never an N² repo catalog) · 5. **Spec-alignment** (REQ-by-REQ, only with a spec).

Each lens returns findings **as questions/hypotheses** — `{lens, file:Lline, severity-guess, claim, snippet}` — **never a verdict.** A lens may spawn a focused `Explore` for context outside its slice. **Scope rule:**
- Target = **diff/commit/range** → only **NEW** problems (nothing pre-existing on an untouched line). A landmine spotted outside the changed lines goes to the report's 🟣 pre-existing tier, non-blocking.
- Target = **file/dir/repo-audit/paste** → the **whole target is in scope** (the user asked for the code itself); there is no "new vs pre-existing", and the 🟣 tier does not exist.

**"What NOT to flag" is the single biggest false-positive reducer** (Cloudflare's own attribution). Each lens carries a blocklist targeted to its dimension — Security ignores a theoretical risk with no real exploit vector and redundant defense-in-depth; Performance ignores a micro-optimization with no measured impact; Architecture ignores trivial (identity/noop) duplication and an abstraction that would couple more than it dedups; all ignore style the linter already covers. It's a blocklist **and** an allowlist, not just an allowlist.

### F3 — Dedup (orchestrator, **fast/cheap** tier, before the expensive step)
Collapse the same `file:Lline` reported by different lenses (keep the highest severity + both rationales). Assign **stable IDs** (`F-1`, `F-2`, …). This shrinks the verification input and is mechanical — it doesn't spend the reasoning tier.

### F4 — Adversarial verification (the anti-false-positive gate, **reasoning** tier)
**Batch per file** via `node scripts/review.js group-findings`: one fresh verifier receives **all the findings of a single file** and **reads that file once**, trying to **falsify** each against the real `file:Lline` + its callers/contract. 30 findings across 8 files = ~8 calls (not 30), one wave of the concurrency cap. **Pipeline from F3:** the moment a file's findings are deduped, dispatch its verifier — don't wait for the global dedup. (Target = paste: no repo to read callers from; verify against the snippet alone, and any finding that depends on external context goes to `confirmar:`.)

The verification discipline — question→blocker, partial confidence, single-vote vs **2-vote-for-blocker**, the false-positive traps, and the `❓ q:` convergence channel — is in `references/verification-discipline.md`. The essentials:
- Confirmed with concrete impact → **🔴 blocker** (breaks/corrupts/security) or **🟡 warning** (fragile/swallowed error/missing validation).
- Partial confidence (impact depends on inaccessible code) → **downgrade** blocker→warning + tag `confirmar:`.
- Refuted → **dropped**, recorded in `Considered and cleared` (so it isn't re-litigated next run).
- **Vote:** single-vote default; **2-vote only for a blocker** (a 2nd verifier confirms the same `file:Lline`; divergence → warning + `confirmar:`). The false positive is guarded where it's most expensive (a blocked push), without the N× cost on every finding.
- **`❓ q:` channel:** genuine uncertainty **converges before emit** — the verifier resolves it by reading the real code. Resolved-and-a-problem → blocker/warning; resolved-and-fine → `Considered and cleared`; **irresolvable by code** (depends on the author's intent/business decision) → the `❓ Questions for author` section. **This skill does NOT interview** — unlike `sdd:spec`, the residual questions are *written into the report*, non-blocking; the review never stops to ask.

### F5 — Executable gates + deterministic invariants + risk-gated sensor (**fast/cheap** tier; fires in PARALLEL with F2)
One gate subagent, dispatched **alongside the lenses** (it doesn't depend on findings). It runs the commands from `testing.md` (or inferred from `package.json`): **test** (red = blocker), **typecheck + lint** (failure = blocker), **test-count vs base via `review.js testcount`** (a silent drop = blocker — only for diff/commit/range, where a base exists). The **deterministic invariants** (the old "lens 5") run here: zero-`any` / no-hardcoded-strings / no-arbitrary-px are `grep`/`biome`, not LLM work. **Gates by target:** diff/commit/file/dir/repo → yes (there's a runnable repo); **paste → gates `skipped`** (no repo), static analysis + verification only. Don't re-narrate what a gate covers (a failed lint is a gate blocker, not a lens finding).

**Mutation sensor — GATED BY RISK** (reasoning tier to pick/generate the mutant; runs off the critical path, in parallel). It fires **only when the diff touches a risk file**: P0 if there's a spec; otherwise auth/payment/domain/service/contracts per the invariant table (the `risk` flag from `review.js resolve`). A trivial diff (CSS, docs, rename) → **"sensor skip: no risk files"**. When it runs: one proportional mutant on the highest-risk assertion, in an isolated **`git worktree` scratch** (never `git stash`/the live tree), the scoped test only; a surviving mutant = the test doesn't discriminate → 🟡 warning + a `surviving_mutant` lesson. Self-disables (*"sensor off"*) if `testing.md` doesn't document a named scoped run. Reuses `../implement/references/mutation-sensor.md` verbatim — same worktree+symlink+cleanup machinery.

### F5.5 — Loop only for a NEW blocker (not "until dry")
Did a **new confirmed BLOCKER** appear this round (a warning/nit does not count)? Yes → re-dispatch **only the lenses that found something**, sending **only the still-uncovered slice + a summary of what's already found** (anti-redundancy). **Cap: 2 rounds** (announce if the cap stopped it). In a re-review, **suppress new nits** (Important-only). Why not "until dry": CR-Bench shows iterating for recall destroys the signal-to-noise (5.11→1.95); the industry runs one pass + verification. The trigger here is a blocker (high signal), not any finding.

### F6 — Verdict + output (orchestrator synthesizes, **fast/cheap** tier, writes ONE file)
Severity counts via `node scripts/review.js tally` (deterministic — the LLM does not count for the trailer). Assemble `docs/reviews/<slug>/review.md` (`<slug>` = branch / target path / `audit-<date>` / `paste-<date>`) per `templates/review-report.template.md`. In chat: a **terse summary + the path**; the full verdict lives in the file (long, pasteable into the PR later, survives the session). Target = paste → no repo path in `<slug>`; you may answer inline + write the file.

**Bias-to-approve — the verdict rule:** only a **confirmed blocker** rejects (`🔴 REVIEW REJEITADO`); a warning/nit **never** rejects (`🟢 REVIEW APROVADO` with comments). **Route, don't fix:** a runtime bug → `sdd:debug`; a coverage/requirement gap → `sdd:plan`/`sdd:spec`; mechanical fixes → the dev applies them. List the routing in `Next steps`.

## Lessons — narrow WRITE, READ in F0
Reuse the existing signals, **no new signal**. Write one only when a *confirmed* finding is durable + shared: a root cause shared across N callers / a violated invariant → `root_cause`; a real coverage/requirement gap → `ac_gap`; a surviving mutant → `surviving_mutant`; a `SPEC_DEVIATION` with no marker → `spec_deviation`. A point finding (one caller, no invariant) writes **nothing**. Every `add` carries `--source` (the grounding the script refuses without). Call the existing `../implement/scripts/lessons.js` — no new machine. (Same grounding rules as `sdd:implement` — see `../implement/references/lessons.md`.)

## Human / agent split
The orchestrator **commissions and synthesizes**; it never reads source nor judges a finding in its own context.

| Work | Who |
|---|---|
| Resolve the target, triage, slice, dedup, tally, assemble the verdict, decide routing | **Orchestrator** (reads digests/verdicts + `review.js` output) |
| Read a slice and emit findings-as-hypotheses (one per lens) | **Lens subagent** (blind, fresh, reasoning tier) |
| Falsify a file's findings against the real `file:Lline` + callers | **Verifier subagent** (one per file, reasoning tier) |
| Run test/typecheck/lint + deterministic invariants + test-count delta | **Gate subagent** (fast/cheap, parallel with the lenses) |
| Pick + inject the mutant in an isolated worktree, confirm the test kills it | **Sensor subagent** (reasoning, risk-gated, off the critical path) |
| Read extra context outside a slice | **`Explore` subagent** (spawned by a lens/verifier) |

## What this skill must not do

- **Don't review a remote PR.** A PR link → `prs-review` (it has the MCP). This skill is local-only; it never touches MCP, a git remote, or a PR by URL.
- **Don't fix.** It routes: runtime bug → `sdd:debug`; coverage/requirement gap → `sdd:plan`/`sdd:spec`; mechanical → the dev. It writes one report and changes no source.
- **Don't judge in your own context.** Commission a lens to find, a verifier to falsify, a gate to run. The orchestrator reads verdicts, never source.
- **Don't emit an unverified finding.** Every finding survives F4 (falsification against the real `file:Lline`) or it doesn't ship. "Looks like a bug" is a hypothesis, not a finding.
- **Don't reject on a warning.** Bias-to-approve: only a confirmed blocker is `🔴 REJEITADO`. A warning/nit is a comment on an approval.
- **Don't feed a lens the whole target.** Each lens gets its slice (`review.js slice`). The slice is what keeps the input sublinear and the lens on-dimension.
- **Don't count by hand.** The trailer severities come from `review.js tally`; a hand count drifts between runs.
- **Don't loop until dry.** Re-run only for a new confirmed blocker, cap 2, suppressing new nits. More iteration = more noise (CR-Bench).
- **Don't run the sensor on a trivial diff.** Risk-gated: no risk file → "sensor skip". No named scoped run in `testing.md` → "sensor off". Never run the suite N times silently.
- **Don't fabricate requirements.** No spec → the Spec lens is off. Don't invent an AC to flag against.
- **Don't interview.** Residual questions are written into the report's `❓ Questions for author`, non-blocking. The review never stops to ask (that's `sdd:spec`).
- **Don't refuse for a missing map.** Degrade to ungrounded, mark `grounded: no`, declare the limitation.
- **Don't switch language** mid-session; `review.md`'s prose follows the prompt's language (`lang:`), but code identifiers, `file:Lline`, the status string, and the trailer stay invariant.

## Common mistakes

| Mistake | Fix |
|---|---|
| Reviewing a pasted PR link here | That's `prs-review` (MCP, remote). This skill is local-only — route it. |
| Reading the diff in the orchestrator to judge it | Commission lenses + verifiers. The orchestrator reads verdicts, not source bytes. |
| Emitting a finding straight from a lens | A lens emits a *hypothesis*; F4 falsifies it against the real `file:Lline` before it counts. |
| Feeding every lens the whole diff | `review.js slice` per lens — Security never sees pure CSS, Performance never sees a config const. |
| Rejecting because there are warnings | Only a confirmed blocker rejects. Warnings/nits are comments on a 🟢 approval. |
| Counting severities by hand for the trailer | `review.js tally` — deterministic. A hand count varies between runs; CI reads the trailer. |
| Looping until no findings remain | Re-run only for a *new confirmed blocker*, cap 2, new nits suppressed. Recall-chasing tanks SNR. |
| Running the mutation sensor on a CSS/doc diff | Risk-gated: "sensor skip: no risk files". And "sensor off" if `testing.md` lacks a named scoped run. |
| Flagging a theoretical risk with no exploit vector | Each lens's "What NOT to flag" blocklist — the biggest FP reducer. See `references/review-lenses.md`. |
| Inventing a requirement to check against | No spec → Spec lens off. Never fabricate an AC. |
| Stopping the review to ask the author | Write it in `❓ Questions for author`, non-blocking. Interviewing is `sdd:spec`'s job, not this one's. |
| Verifying each finding in its own subagent (30 calls) | Batch per file via `group-findings` — one verifier reads each file once (~8 calls). |
| Re-narrating a failed lint as a lens finding | A failed gate is a gate blocker; don't double-report it from a lens. |
| Refusing because `docs/codebase/` is missing | Degrade to ungrounded (`grounded: no`), use `review.js` heuristics, declare the limitation. |
| Flagging a pre-existing landmine as a blocker on a diff target | On diff/commit/range it goes to 🟣 pre-existing (non-blocking). On a file/repo/paste target there's no such tier — it's in scope. |
| Letting the orchestrator apply the fix | Route to `sdd:debug`/`sdd:plan`. This skill reviews and reports; it never edits source. |
