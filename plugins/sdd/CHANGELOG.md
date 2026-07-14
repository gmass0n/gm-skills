# Changelog — sdd

All notable changes to the `sdd` plugin are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions track `.claude-plugin/plugin.json`.

## [0.11.0] — 2026-07-14

### Changed
- All SDD skills are now user-invoked only. Automatic discovery and cross-skill chaining were replaced by explicit manual handoffs.

## [0.10.0] — 2026-06-27

New skill `sdd:review` — the enterprise-grade **local** code review of any target, filling the gap between `sdd:implement`'s intra-task Post-Gate Review and the remote-PR `prs-review`. Pure orchestration (the same anti-hallucination DNA as `implement`/`debug`); the only executable addition is `review.js` (Node, stdlib-only), verified by its own `--selftest`.

### Added
- **`sdd:review` — five targets, one architecture.** Reviews a diff (default — branch vs GitFlow merge-base, or `--staged`/`--working`/`A..B`), a file/dir/glob (whole content), a commit/range/tag, the whole repo (`--all`, with announced sampling), or a pasted snippet (`--paste`). All five are classified and resolved by `review.js resolve`, which emits the manifest (files + churn + layer + risk flag + base + excluded generated files). New skill dir `skills/review/` (SKILL.md + 2 references + 1 template + `scripts/review.js`). (`review`)
- **Blind multi-lens dispatch with per-path slicing.** Five parallel, blind, fresh reasoning lenses (correctness, security incl. 401/logout, performance/N+1, architecture/DRY-SOLID-KISS-YAGNI + semantic-reimplementation detection, spec-alignment), each fed ONLY its `review.js slice` and a per-dimension "What NOT to flag" blocklist (Cloudflare's biggest FP reducer). Each returns findings as questions/hypotheses, never verdicts. New ref `review/references/review-lenses.md`. (`review`)
- **Adversarial verification batched per file.** A fresh verifier reads each file once and tries to FALSIFY every finding against the real `file:Lline` + callers/contract; partial confidence downgrades blocker→warning + `confirmar:`; refuted findings go to "Considered and cleared"; a 2-vote confirmation is required only for a blocker; the `❓ q:` channel converges uncertainty before emit (the skill never interviews). New ref `review/references/verification-discipline.md`. (`review`)
- **Executable gates + deterministic invariants + risk-gated mutation sensor.** Gates (test/typecheck/lint + test-count delta via `review.js testcount`) run in PARALLEL with the lenses; the enforced invariants (zero-`any`/no-hardcoded-strings/no-arbitrary-px) run as `grep`/`biome`, not an LLM lens; the mutation sensor fires only when the diff touches a risk file and reuses `implement/references/mutation-sensor.md` verbatim. (`review`)
- **`review.js` — deterministic bookkeeping** (Node, stdlib `fs`+`path`+`child_process`, zero deps): `resolve`/`slice`/`extract-symbols`/`group-findings`/`tally`/`testcount`, with a `--selftest`. The LLM judges; the script resolves the target, slices per lens, groups findings per file, and counts severities for the machine-readable trailer (so counts never drift between runs). (`review`)
- **Loop only for a new confirmed blocker (cap 2), bias-to-approve, machine-readable trailer.** Re-runs only when a new confirmed blocker appears (not "until dry" — CR-Bench: more iteration = more noise); only a confirmed blocker rejects (warnings/nits never block); the verdict lands in `docs/reviews/<slug>/review.md` with a `<!-- sdd-review-severity: … -->` trailer for CI. Ungrounded degradation (never refuses without the map); routes fixes to `sdd:debug`/`sdd:plan`/`sdd:spec` rather than applying them; reuses `implement/scripts/lessons.js` for the narrow lesson WRITE. New template `review/templates/review-report.template.md`. (`review`)

### Changed
- Plugin description (and the codex/marketplace mirrors) updated to surface `review` and its triggers for the router.

## [0.9.0] — 2026-06-27

Four improvements ported from the tlc-spec-driven v3 analysis, plus the spec prerequisite they need.
Prompt-as-code throughout; the only executable addition is `lessons.js` (Node, stdlib-only), verified by its own `--selftest`.

### Added
- **Priority-tagged requirements (`[P0|P1|P2]`).** User stories carry a priority tag; each REQ inherits its US's priority (override per-REQ only when it differs); untagged defaults to `P1`. The plan carries it forward as a task `Priority:` field. This is the prerequisite the mutation sensor consumes. (`spec`, `plan`)
- **Item A — discrimination sensor (mutation testing) on P0 REQs.** After the coverage matrix is green, the closing gate injects one risk-proportional mutant per P0 REQ in an isolated `git worktree` scratch (never `git stash`), runs only that REQ's named test scoped, and confirms the test kills the mutant. A surviving mutant becomes a fix task. Self-disables in any repo whose `testing.md` doesn't document a scoped run by test name. New ref `implement/references/mutation-sensor.md`. (`implement`)
- **Item C — self-improving lessons memory.** New `implement/scripts/lessons.js` (Node, stdlib `fs`+`path`, zero deps) owns all bookkeeping — stable IDs, exact-after-normalization dedup, recurrence, candidate→confirmed promotion, penalize→quarantine, windowed pruning, budget-capped render. The closing gate distills each real failure into a grounded one-line lesson (`--source` required — "a lesson with no grounding is an opinion"); `sdd:spec` and large `sdd:plan` runs load confirmed lessons as guidance. State lives in the versioned `docs/codebase/lessons/`. New ref `implement/references/lessons.md`. (`spec`, `plan`, `implement`, `codebase`)
- **Item C extended to `sdd:debug`.** The debug closing gate (F8) records a `root_cause` lesson when a runtime-confirmed bug's cause was *shared* (N affected callers, or a violated enforced invariant); F0 loads confirmed lessons as hypothesis priors. A point bug with a single caller writes nothing. New signal `root_cause` in `lessons.js`. (`debug`)

### Changed
- **Item B — evidence-or-zero + spec-anchored outcome check.** The Post-Gate Review and closing gate now require every REQ to trace to a locatable assertion at `file:line` (the plan's matrix gains an `Assertion` column); "probably covered" counts as uncovered, and an assertion that doesn't match the AC's outcome raises a `⚠️ spec-precision gap` in the report. (`implement`, `plan`)
- **Item D — trivial ramp-down.** A narrow exception to "one subagent per task": a ≤3-file, no-REQ change (typo, rename, constant) may run inline, still under RED/GREEN + the closing gate. Hard guard: >3 files or any REQ with an AC → stop and formalize to a subagent. All four assertions of the absolute rule were updated for consistency. (`implement`)
- **Guard:** `sdd:codebase` never touches `docs/codebase/lessons/` (owned by `sdd:implement`) when mapping or pruning orphans. (`codebase`)
- Skill descriptions (`spec`, `implement`) and the plugin description updated to surface the new triggers (priority tags, load/record lessons, the sensor) for the router.
