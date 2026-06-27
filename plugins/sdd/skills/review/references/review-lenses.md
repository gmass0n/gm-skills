# Reference: the review lenses (checklist + "What NOT to flag" + slice routing + tier)

Read this when building each lens's briefing in F2. Each lens is a **fresh, blind subagent** at the **reasoning** tier, fed **only its slice** (`review.js slice --lens <dim>`), the spec requirements *only if a spec exists*, its dimension's invariants + layer-doc pointer, and its dimension's confirmed-lesson priors. **A lens returns findings as questions/hypotheses** — `{lens, file:Lline, severity-guess, claim, snippet}` — never a verdict. The verdict is F4's job.

The non-obvious half of every lens is the **"What NOT to flag"** blocklist. Cloudflare credits its targeted blocklists as the single biggest false-positive reducer — more than any allowlist. A lens with only a checklist of what to find will find *plausible* things that waste the verifier and erode trust. The blocklist is what keeps each lens's output high-signal. It's a blocklist **and** an allowlist.

## Table of contents
- Lens 1 — Correctness / edge-cases
- Lens 2 — Security
- Lens 3 — Performance / N+1
- Lens 4 — Architecture / DRY-SOLID-KISS-YAGNI + **reimplementation detection**
- Lens 5 — Spec-alignment (spec-only)
- Severity guessing (the lens guesses; the verifier decides)

---

## Lens 1 — Correctness / edge-cases
**Slice:** anything with logic (`review.js slice --lens correctness` routes by code extension). The one lens that is never starved — if a file has a branch or a loop, it's in scope.

**Look for:**
- Null/undefined that reaches a deref; an empty list/array mapped without a guard; an `Option`/`Maybe` unwrapped without the None case.
- Off-by-one in pagination/indexing/slicing; an inclusive/exclusive boundary that flipped.
- A branch that can't be reached, or a default that swallows a real case; a `switch` with a missing arm.
- An `async`/`await` dropped (a floating promise), a race between two writes, an ordering assumption that the runtime doesn't guarantee.
- A swallowed error (`catch {}`), a `try` whose `catch` hides the real failure, a rejected promise with no handler.
- A type coercion that changes the value (`==` vs `===`, a number parsed from a string with no radix, a date built from an ambiguous string).
- The lessons priors of `root_cause`/`ac_gap` — a past confirmed bug in this dimension is the first hypothesis.

**What NOT to flag:**
- A defensive check the type system already guarantees (a non-null assertion on a value the signature says is non-null) — it's redundant, not a bug.
- An "edge case" with no real input path (a guard for a value the caller can never produce) — theoretical, not real. When in doubt whether the path is reachable, emit it as a **question** (`❓ q:`), not a blocker.
- Style the linter covers (a missing semicolon, a `var` vs `const`).
- A `TODO`/`FIXME` the author left intentionally — note it once if it's load-bearing, don't flag every one.

---

## Lens 2 — Security (includes 401/logout)
**Slice:** auth/login/session/token/permission/guard/input/validation/query/sql/fetch/http/cors/crypto/secret/env, plus the whole `data` layer.

**Look for:**
- Unvalidated input reaching a query/command/render (injection: SQL, NoSQL, command, XSS, SSRF), a template built by string concatenation.
- A missing/weak authz check on a protected route or mutation; an object reference the caller shouldn't be able to address (IDOR).
- A secret/token/credential in the diff (a key, a `.env` value, a hardcoded password) or logged.
- The **401/logout invariant** (this codebase's enforced rule): an authenticated request that, on a 401, doesn't route through the project's logout/guard — a stale session that should have been killed.
- A missing rate-limit/throttle on an expensive or auth-sensitive endpoint; a CORS/CSP that's too open.
- A crypto misuse (a weak hash for passwords, a predictable IV, `Math.random()` for a token).

**What NOT to flag:**
- A **theoretical risk with no real exploit vector** — a "could be unsafe if X" where X can't happen given the call sites. Security's highest-FP failure mode. If you can't name the vector, it's a `❓ q:`, not a blocker.
- **Defense-in-depth that's redundant when the primary defense already holds** — flagging a missing secondary check where the framework/ORM already parameterizes is noise.
- Input validation on a value that's already validated upstream at the trust boundary (find the boundary before flagging the inner layer).
- A "secret" that's a public key, a published config, or a test fixture.

---

## Lens 3 — Performance / N+1
**Slice:** loops/map/filter/reduce/query/render/memo/effect/list/pagination/batch/cache/index, plus the `data` and `ui` layers.

**Look for:**
- An N+1 query (a query inside a loop over rows), a fetch inside a `.map`, a per-item round-trip that should be a batch/`IN`.
- A render-path recompute that should be memoized (an expensive derive in a hot component, a new object/array literal as a prop breaking memoization downstream).
- An O(n²) scan where an index/Set/Map makes it O(n); a repeated linear lookup inside a loop.
- A missing pagination/limit on an unbounded list; loading a whole table to count or to find one row.
- A blocking call on a hot path; a synchronous file/network read where async exists.

**What NOT to flag:**
- A **micro-optimization with no measured impact** — a `for` vs `.forEach` on a 3-element array, a string concat in a cold path. Performance's highest-FP failure mode. Flag only where the input scales.
- A premature cache/index where the data set is provably tiny and bounded.
- "This could be faster" with no evidence the path is hot — if you can't argue the scale, it's not a finding.

---

## Lens 4 — Architecture / DRY-SOLID-KISS-YAGNI + reimplementation detection
**Slice:** everything (`architecture` sees the whole target) — it judges topology, new files, and duplication across the target.

**Look for (classic):**
- A new abstraction with a single implementation (a factory for one product, an interface with one impl, config for a value that never changes) — YAGNI.
- A god-function/class doing several jobs; a leak across the layer boundary the map defines (a UI file importing a data adapter directly, a domain file reaching into infrastructure).
- A change that adds coupling where duplication would be simpler and looser; an inheritance chain where composition fits.
- Dead flexibility — a parameter never passed a non-default, a hook never used.

**Look for (reimplementation — the most common slop, ponytail rung 2):** code in the target that **re-implements something the repo already has under another name/implementation** — *semantic* duplication (same intent, different code), which `grep`/jscpd miss. The technique is adapted from `obra/superpowers-lab finding-duplicate-functions`, with the **direction inverted** (target→repo, which is what makes it cheap enough for a subagent):
1. **Tiny left side:** extract only the target's symbols via `node scripts/review.js extract-symbols <diff|file>` (`rg`-backed) — do **not** catalog the whole repo (that N² is the repo-audit case only).
2. **Directed lookup, not N²:** for each new symbol, `rg` the repo for its purpose/synonyms + the high-risk zones (`utils/`, `helpers/`, `lib/`, mappers, `src/config/`). In this repo, **`docs/codebase/` replaces the categorization phase** — the map already says where the canonical helpers live. Special case: a **hardcoded UI string** in the diff re-implements the existing i18n pattern (`src/config/messages/index.ts`) — flag it as reimplementation of an established pattern.
3. **Semantic judgment with the anti-FP bias:** HIGH/MEDIUM/LOW, and **"when in doubt → INVESTIGATE (warning), not CONSOLIDATE (blocker)"**. Generic utilities (identity/noop/constant) are duplicated on purpose — don't flag; "reuse where it couples more than it dups" is worse than the duplication.
4. **Anchor BOTH sides:** `` reuse: `formatCurrency` (new, src/x.ts:L42) reimplements `toBRL` (existing, src/lib/money.ts:L10) ``. **No real candidate located in the repo = no finding** (evidence-or-zero — a suspicion with no twin is not a finding).

**What NOT to flag:**
- **Trivial duplication** (an identity wrapper, a one-line noop, a constant repeated) — consolidating it couples more than it saves.
- An abstraction the codebase map's patterns explicitly endorse (don't fight the established pattern as "over-engineering").
- A "DRY violation" that's actually two things that look alike but evolve independently (false DRY — coupling them is the real bug).
- Style/naming the linter covers.

---

## Lens 5 — Spec-alignment (only when a spec exists)
**Slice:** everything. **OFF when there is no `docs/specs/<feature>/`** — never fabricate a requirement to flag against.

**Look for:**
- A REQ-ID with no corresponding behavior in the target (an acceptance criterion not met).
- Behavior in the target that diverges from the spec's Steps **with no `// SPEC_DEVIATION:` marker** → emit `spec_deviation` (the marker is the contract that code and spec may disagree, but only on purpose).
- An AC whose outcome the code asserts the *wrong* way (the test/code exists but checks the wrong thing).

**What NOT to flag:**
- A requirement the spec doesn't actually state (don't infer ACs the spec didn't write).
- An implementation detail the spec left open (the spec says WHAT, not HOW — flag a HOW only if it violates an invariant).
- A documented `SPEC_DEVIATION` — that's a conscious, reviewed divergence, not a finding.

---

## Severity guessing (the lens guesses; the verifier decides)
The lens attaches a **`severity-guess`**, not a verdict — F4 falsifies and assigns the real severity. The guessing scale:
- **blocker** — if real, it breaks behavior / corrupts data / opens a security hole / fails the task's goal.
- **warning** — fragile, a swallowed error, a missing validation, a dubious rule, a race that's hard to hit.
- **nit** — style the linter doesn't catch, dead code, a typo, a naming inconsistency.

A lens that can't decide between two severities **guesses the lower one and tags `❓ q:`** — the verifier resolves it against the real code. Over-guessing blocker is how a review loses trust; the verifier can always promote, the report can't un-cry-wolf.
