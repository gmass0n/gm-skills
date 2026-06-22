# gm-skills

Personal plugin marketplace for [Claude Code](https://claude.com/claude-code) **and** [OpenAI Codex](https://developers.openai.com/codex). The same skills run on both runtimes — one `skills/` directory, two manifests (`.claude-plugin/` and `.codex-plugin/`), no duplication.

## Plugins

### `sdd` — Spec-Driven Development

A brownfield-first SDD workflow as four composable skills. Each phase proves the
next can start, and the whole chain proves every requirement was built and tested.

| Skill | Phase | Does |
| --- | --- | --- |
| `sdd:codebase` | 0 — Map | Generates `docs/codebase/` (a `context.md` router with enforced invariants + per-concept docs). The brownfield-analysis layer the other phases read to stay on-pattern. |
| `sdd:spec` | 1 — Specify | A relentless one-question-at-a-time interview → `spec.md` with EARS requirements, REQ-IDs, acceptance criteria. Won't finish while any `[NEEDS CLARIFICATION]` is open. |
| `sdd:plan` | 2 — Design + Tasks | `plan.md` with a design anchored to the codebase map and an atomic task breakdown carrying a REQ→task→test coverage matrix. Fails if any requirement is uncovered; `/analyze` checks tasks against enforced invariants. |
| `sdd:implement` | 3 — Execute | Works the plan task by task (one subagent each, strict test-first TDD, serial by default). A closing gate walks the matrix and proves every requirement has a passing test. |

**The proof chain:** clarify (no open ambiguity) → coverage matrix (every REQ has a task+test) → analyze (no task contradicts an enforced invariant) → TDD (no code without a failing test first) → closing gate (every REQ green on the integrated branch).

Artifacts live in `docs/specs/<feature>/{spec.md, plan.md, state.md}`; the codebase map in `docs/codebase/`.

## Install

### Claude Code

```
/plugin marketplace add gmass0n/gm-skills
/plugin install sdd@gm-skills
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

In `/plugins`: switch to the **gm-skills** marketplace tab, open **sdd**, choose **install**, then press **Space** to enable it. Codex installs into `~/.codex/plugins/cache/gm-skills/sdd/<version>/` and stores the enabled state in `~/.codex/config.toml`. (Codex has no `codex plugin install` subcommand — installation is done through `/plugins`.)

Both runtimes read the **same** `plugins/sdd/skills/` — a skill is authored once and works in either. Claude Code resolves the plugin via `.claude-plugin/`; Codex via `.codex-plugin/` (manifest) and `.agents/plugins/marketplace.json` (marketplace). In Codex the skills surface through progressive disclosure (name + description first, full `SKILL.md` loaded on use); invoke a phase by intent (e.g. "map the repo", "spec out X", "plan this", "implement the plan").

## Layout

```
gm-skills/
├── .claude-plugin/marketplace.json   # Claude Code marketplace
├── .agents/plugins/marketplace.json  # Codex marketplace
└── plugins/sdd/
    ├── .claude-plugin/plugin.json    # Claude Code manifest
    ├── .codex-plugin/plugin.json     # Codex manifest
    └── skills/                       # shared — codebase / spec / plan / implement
```

