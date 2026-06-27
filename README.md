# gm-skills

Personal plugin marketplace for [Claude Code](https://claude.com/claude-code) **and** [OpenAI Codex](https://developers.openai.com/codex). The same skills run on both runtimes — one `skills/` directory, two manifests (`.claude-plugin/` and `.codex-plugin/`), no duplication.

## Plugins

### `sdd` — Spec-Driven Development

A brownfield-first SDD workflow as five composable skills. The four forward phases
prove the next can start, and the whole chain proves every requirement was built and
tested. The fifth, `sdd:debug`, runs off that trail — callable any time something breaks.

| Skill | Phase | Does |
| --- | --- | --- |
| `sdd:codebase` | 0 — Map | Generates `docs/codebase/` (a `context.md` router with enforced invariants + per-concept docs). The brownfield-analysis layer the other phases read to stay on-pattern. |
| `sdd:spec` | 1 — Specify | A relentless one-question-at-a-time interview → `spec.md` with EARS requirements, REQ-IDs, acceptance criteria, and a `[P0\|P1\|P2]` priority per user story. Loads the project's confirmed lessons to pre-empt known past failures. Won't finish while any `[NEEDS CLARIFICATION]` is open. |
| `sdd:plan` | 2 — Design + Tasks | `plan.md` with a design anchored to the codebase map and an atomic task breakdown carrying a REQ→task→test coverage matrix (with the assertion expression that proves each REQ). Fails if any requirement is uncovered; `/analyze` checks tasks against enforced invariants. |
| `sdd:implement` | 3 — Execute | Works the plan task by task (one subagent each, strict test-first TDD, serial by default; a trivial ≤3-file/no-REQ change may ramp down to inline). A closing gate walks the matrix proving every REQ has a *locatable* assertion (evidence-or-zero), runs a mutation/discrimination sensor on P0 REQs (one mutant in an isolated worktree, proving the test kills it), and records each real failure as a grounded lesson. |
| `sdd:debug` | — Debug | Root-cause hunt with a surgical fix, in the spirit of Cursor's Debug Mode. Generates multiple hypotheses *before* touching code, instruments it with hypothesis-driven logs routed to a local debug server, collects real runtime evidence (server + Playwright, or the human reproducing), fixes at the root, proves it with a re-repro + a RED→GREEN regression test, then cleans up every trace. Records a grounded lesson when the cause was shared (N callers / a violated invariant). Reads `context.md` to avoid violating invariants; works without the map (ungrounded). A circuit breaker re-hypothesizes after 3 failed attempts. |

**The proof chain (forward phases):** clarify (no open ambiguity) → coverage matrix (every REQ has a task+test) → analyze (no task contradicts an enforced invariant) → TDD (no code without a failing test first) → closing gate (every REQ green *with a locatable assertion* on the integrated branch, P0 tests proven to discriminate by the mutation sensor).

**The lessons layer (self-improving memory):** `sdd:implement` and `sdd:debug` distill each real failure into a grounded one-line lesson in the versioned `docs/codebase/lessons/`; recurring ones are promoted to `confirmed` and loaded by `sdd:spec`/`sdd:plan` on the next feature — so the workflow stops re-learning the same mistake.

**The debug loop (off-trail):** read the error → multiple hypotheses → instrument → reproduce & collect runtime evidence → fix the root cause → verify (re-repro + regression test) → grep-zero cleanup. It never edits production code on a guess.

Artifacts live in `docs/specs/<feature>/{spec.md, plan.md, state.md}`; the codebase map and the lessons memory in `docs/codebase/` (`docs/codebase/lessons/`); debug reports in `docs/specs/<feature>/debug-<slug>.md` or `docs/debug/<slug>/report.md` (the runtime-capture `.jsonl` lives beside the report and is removed on cleanup).

### `status-report` — leadership-ready status reports

Turns any fix, incident, or in-flight change into a polished, audience-agnostic status report — one document clear enough for leadership, support, and the customer at once — plus an optional enterprise action plan. It mines the current session and context first, interviews you one question at a time when the context is thin (never inventing facts), then renders the validated WhatsApp/email style (📄 title, `*bold*` metadata, status emoji ✅ 🔧 ⛔).

| Output | When | Contains |
| --- | --- | --- |
| `status-report.txt` | always | Title, status, plain-language narrative of what happened + root cause, scope, resolution or next steps. |
| `action-plan.txt` | on request / when prevention work is warranted | Root cause to treat, numbered actions (1️⃣) with 👤 owner and 🗓️ deadline, prioritized recommendation. |

Reports follow the prompt's language (PT-BR → PT-BR, EN → EN) and land in `docs/status-reports/<slug>/`. On Claude it fans out three subagents (timeline+cause, evidence, action plan) and synthesizes; without subagents it degrades to the same work inline.

## Install

### Claude Code

```
/plugin marketplace add gmass0n/gm-skills
/plugin install sdd@gm-skills
/plugin install status-report@gm-skills
```

### OpenAI Codex

```
codex plugin marketplace add gmass0n/gm-skills
```

Then open the interactive plugin browser to install and enable it:

```
codex
/plugins
```

In `/plugins`: switch to the **gm-skills** marketplace tab, open the plugin you want (**sdd** or **status-report**), choose **install**, then press **Space** to enable it. Codex installs into `~/.codex/plugins/cache/gm-skills/sdd/<version>/` and stores the enabled state in `~/.codex/config.toml`. (Codex has no `codex plugin install` subcommand — installation is done through `/plugins`.)

Both runtimes read the **same** `plugins/sdd/skills/` — a skill is authored once and works in either. Claude Code resolves the plugin via `.claude-plugin/`; Codex via `.codex-plugin/` (manifest) and `.agents/plugins/marketplace.json` (marketplace). In Codex the skills surface through progressive disclosure (name + description first, full `SKILL.md` loaded on use); invoke a phase by intent (e.g. "map the repo", "spec out X", "plan this", "implement the plan", "debug this bug").

## Layout

```
gm-skills/
├── .claude-plugin/marketplace.json   # Claude Code marketplace
├── .agents/plugins/marketplace.json  # Codex marketplace
└── plugins/
    ├── sdd/
    │   ├── .claude-plugin/plugin.json    # Claude Code manifest
    │   ├── .codex-plugin/plugin.json     # Codex manifest
    │   └── skills/                       # shared — codebase / spec / plan / implement / debug
    └── status-report/
        ├── .claude-plugin/plugin.json
        ├── .codex-plugin/plugin.json
        └── skills/                       # shared — status-report
```

