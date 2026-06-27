# Reference: verification discipline (the F4 anti-false-positive gate)

Read this when dispatching the F4 verifiers. F4 is where a *hypothesis* becomes a *finding* — or gets dropped. It is the single most important phase for the review's signal-to-noise: every state-of-the-art pipeline (Claude Code Code Review, Cloudflare, CodeAnt) has a verification step that checks candidate findings against the **real behavior** before reporting, and the false-positive rate of a tuned reviewer (5-15%) versus an untuned one (40-80%) is almost entirely this step. A lens that "looks good" without F4 is raw Claude with extra latency.

## The core stance: try to FALSIFY, not to confirm
A verifier is **adversarial toward the finding, not toward the code.** Its default question is *"why is this NOT a bug?"* — it reads the real `file:Lline`, the callers, the contract, and tries to prove the hypothesis wrong. A finding that survives a genuine attempt at refutation is real; one that's confirmed by a verifier looking to agree is theater. This inverts the lens's stance (the lens hypothesizes liberally); the asymmetry is deliberate — **liberal generation, skeptical verification.**

## Batch per file — read each file once
Dispatch via `node scripts/review.js group-findings`: **one verifier per file**, receiving **all** of that file's findings, reading the file **once**. 30 findings across 8 files = ~8 verifier calls, one wave of the concurrency cap — not 30 reads of the same files. **Pipeline from F3:** the instant a file's findings are deduped, dispatch its verifier; don't wait for the global dedup to finish. The verifier's briefing: the file's findings (with their `file:Lline` + claim + snippet), and permission to spawn a focused `Explore` for a caller/contract outside the file. It returns, per finding, a **verdict**.

## The four verdicts
1. **Confirmed, concrete impact** → 🔴 **blocker** (breaks/corrupts/security) or 🟡 **warning** (fragile/swallowed/missing validation). The verdict names the impact in one clause: *"on an empty `orders` the `.reduce` throws → the list page 500s"*.
2. **Partial confidence** (the impact depends on code the verifier couldn't reach) → **downgrade**: a would-be blocker becomes a 🟡 warning tagged `confirmar:` with what to check. *Never assert a blocker on evidence you couldn't reach* — that's the false positive that costs the most (a blocked push on a guess).
3. **Refuted** → **dropped** from the findings, recorded in `Considered and cleared` with the one-line reason it's not a bug. Recording it matters: it stops the next run (or the next lens) from re-litigating the same non-issue.
4. **Irresolvable by code** (the answer depends on the author's *intent* or a *business decision*, not on anything readable) → the `❓ Questions for author` section (see below). Not a finding, not a hedge in the list.

## Voting: single-vote default, 2-vote only for a blocker
- **Single-vote** is the default for warnings and nits — a second pass on a warning isn't worth the tokens.
- **2-vote for a blocker:** before a finding is emitted as 🔴, a **second fresh verifier** confirms it at the same `file:Lline`. This is a *confirmation*, not a distinct adversarial prompt (the user chose simple confirmation over a separate refuter design). Agreement → blocker stands. **Divergence → downgrade to warning + `confirmar:`** (if two competent verifiers disagree, it's not certain enough to block a push). The cost (2×) is paid only where it matters — a blocker blocks the push — never on every finding.

This is the **bias-to-approve** mechanism at the finding level: a blocker must clear two independent reads; a warning never blocks. Combined with F6's rule (only a confirmed blocker rejects), the review errs toward letting good code through over crying wolf.

## The `❓ q:` convergence channel (from caveman-review)
Genuine uncertainty **must converge before emit** — it never leaks into the findings list as a hedge. When a verifier is unsure:
1. **First, resolve it by reading the real code.** Most "uncertainty" is just unread context — read the caller, the contract, the type. Resolved → it becomes a normal verdict (blocker/warning, or `Considered and cleared` if it turned out fine).
2. **Only if it's irresolvable by code** — because the answer is *"did the author intend X?"* or *"is this business rule correct?"*, which no amount of reading settles — does it go to `❓ Questions for author`. That section is **non-blocking**: the review writes the question and approves/rejects on the findings it *could* resolve.

**This skill does NOT interview.** Unlike `sdd:spec` (synchronous, one-question-at-a-time, blocking via `AskUserQuestion`), the review is asynchronous and a router by nature — the residual questions are *written into the report*, the review never stops to ask. A verifier that ends a finding with *"…but I'm not sure if this is intended"* in the findings list has failed the discipline: resolve it or move it to `❓ Questions for author`.

## False-positive traps (the verifier's checklist before confirming)
Before a verifier confirms any finding, it rules out the common FP causes:
- **Already handled elsewhere** — the guard the lens says is missing exists at the trust boundary, one layer up. Find it before confirming.
- **Unreachable path** — the "edge case" needs an input the callers can't produce. Check the call sites.
- **Framework/library already covers it** — the ORM parameterizes, the framework escapes, the runtime guarantees the order. Don't flag what the platform handles.
- **Intentional and documented** — a `SPEC_DEVIATION` marker, a `ponytail:` comment naming a known ceiling, a comment explaining the choice. A documented decision is not a finding.
- **Test fixture / example / generated** — the "secret" is a test key, the "duplication" is a snapshot. (`review.js` already excludes generated files, but a fixture inside a source dir can slip through.)
- **The lens misread the snippet** — the `file:Lline` doesn't say what the claim says. Read the real line; a stale or hallucinated snippet is the most common FP of all.

A finding that trips any of these is **refuted** → `Considered and cleared`.

## Target-specific notes
- **Target = diff/commit/range:** only NEW problems. A real problem on an *untouched* line goes to 🟣 pre-existing (non-blocking, doesn't count toward the verdict) — surface the landmine, don't block the push for it.
- **Target = file/dir/repo-audit:** the whole target is in scope; there's no "new vs pre-existing", and no 🟣 tier — every confirmed problem is a normal finding.
- **Target = paste:** no repo to read callers/contracts from. Verify against the snippet alone; any finding whose impact depends on external context (a caller, a config) can't be confirmed → it stays `confirmar:`, never a blocker.

## What the verifier returns (per file)
A structured verdict the orchestrator can read without re-reading source:
```
file: src/modules/orders/order.service.ts
verdicts:
  - id: F-3  status: confirmed  severity: blocker  impact: "empty orders → .reduce throws → list 500s"  (2-vote: agreed)
  - id: F-7  status: partial    severity: warning  confirmar: "depends on whether upstream guarantees non-null — caller not in this file"
  - id: F-9  status: refuted    cleared: "the guard the lens flagged as missing is at order.guard.ts:L20"
  - id: F-12 status: question   ask: "is discarding the scheduled-to date intentional, or should it propagate?"
```
The orchestrator maps `confirmed`→Blockers/Warnings, `partial`→Warnings (`confirmar:`), `refuted`→Considered and cleared, `question`→Questions for author. It never overrides a verdict with its own read of the source.
