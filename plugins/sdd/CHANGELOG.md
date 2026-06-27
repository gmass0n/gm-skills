# Changelog — sdd

All notable changes to the `sdd` plugin are documented here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions track `.claude-plugin/plugin.json`.

## [0.9.0] — 2026-06-27

Four improvements ported from the tlc-spec-driven v3 analysis, plus the spec prerequisite they need.
Prompt-as-code throughout; the only executable addition is `lessons.js` (Node, stdlib-only), verified by its own `--selftest`.

### Added
- **Priority-tagged requirements (`[P0|P1|P2]`).** User stories carry a priority tag; each REQ inherits its US's priority (override per-REQ only when it differs); untagged defaults to `P1`. The plan carries it forward as a task `Priority:` field. This is the prerequisite the mutation sensor consumes. (`spec`, `plan`)
- **Item A — discrimination sensor (mutation testing) on P0 REQs.** After the coverage matrix is green, the closing gate injects one risk-proportional mutant per P0 REQ in an isolated `git worktree` scratch (never `git stash`), runs only that REQ's named test scoped, and confirms the test kills the mutant. A surviving mutant becomes a fix task. Self-disables in any repo whose `testing.md` doesn't document a scoped run by test name. New ref `implement/references/mutation-sensor.md`. (`implement`)
- **Item C — self-improving lessons memory.** New `implement/scripts/lessons.js` (Node, stdlib `fs`+`path`, zero deps) owns all bookkeeping — stable IDs, exact-after-normalization dedup, recurrence, candidate→confirmed promotion, penalize→quarantine, windowed pruning, budget-capped render. The closing gate distills each real failure into a grounded one-line lesson (`--source` required — "a lesson with no grounding is an opinion"); `sdd:spec` and large `sdd:plan` runs load confirmed lessons as guidance. State lives in the versioned `docs/codebase/lessons/`. New ref `implement/references/lessons.md`. (`spec`, `plan`, `implement`, `codebase`)

### Changed
- **Item B — evidence-or-zero + spec-anchored outcome check.** The Post-Gate Review and closing gate now require every REQ to trace to a locatable assertion at `file:line` (the plan's matrix gains an `Assertion` column); "probably covered" counts as uncovered, and an assertion that doesn't match the AC's outcome raises a `⚠️ spec-precision gap` in the report. (`implement`, `plan`)
- **Item D — trivial ramp-down.** A narrow exception to "one subagent per task": a ≤3-file, no-REQ change (typo, rename, constant) may run inline, still under RED/GREEN + the closing gate. Hard guard: >3 files or any REQ with an AC → stop and formalize to a subagent. All four assertions of the absolute rule were updated for consistency. (`implement`)
- **Guard:** `sdd:codebase` never touches `docs/codebase/lessons/` (owned by `sdd:implement`) when mapping or pruning orphans. (`codebase`)
- Skill descriptions (`spec`, `implement`) and the plugin description updated to surface the new triggers (priority tags, load/record lessons, the sensor) for the router.
