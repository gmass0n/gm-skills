# gm-skills

Personal plugin marketplace for [Claude Code](https://claude.com/claude-code) and [OpenAI Codex](https://developers.openai.com/codex). Skills are **user-only**: they never auto-discover or invoke one another.

Start with `$gm-skills:help` when you need to choose a workflow. It maps one objective to one explicit command and does not perform work itself.

## Commands

| Goal | Explicit command |
| --- | --- |
| Map repository conventions | `$sdd:codebase` |
| Specify, plan, implement, debug, or locally review | `$sdd:spec`, `$sdd:plan`, `$sdd:implement`, `$sdd:debug`, `$sdd:review` |
| Plan or execute end-to-end QA | `$qa:plan`, `$qa:test` |
| Triage Jira work | `$triage:jira` |
| Review remote pull requests | `$prs-review:prs-review` |
| Prepare or finalize a GitHub release | `$release:github` |
| Prepare or finalize a Bitbucket release | `$release:bitbucket` |
| Write a status update | `$status-report:status-report` |

Each skill keeps its own prerequisites, artifacts, guardrails, and completion checks. When one workflow phase finishes, invoke its next phase yourself; for example, after an approved specification run `$sdd:plan`, then `$sdd:implement` only after the plan is approved.

## Install

### Claude Code

```text
/plugin marketplace add gmass0n/gm-skills
/plugin install gm-skills@gm-skills
/plugin install sdd@gm-skills
/plugin install qa@gm-skills
/plugin install status-report@gm-skills
/plugin install triage@gm-skills
/plugin install prs-review@gm-skills
/plugin install release@gm-skills
```

### OpenAI Codex

```text
codex plugin marketplace add gmass0n/gm-skills
```

Open `codex`, run `/plugins`, choose the **gm-skills** marketplace, then install and enable the desired plugin. Use `$gm-skills:help` or an explicit command listed above after installation.

## Layout

```text
gm-skills/
├── .claude-plugin/marketplace.json
├── .agents/plugins/marketplace.json
└── plugins/
    ├── gm-skills/       # manual command router
    ├── sdd/             # codebase, spec, plan, implement, review, debug
    ├── qa/              # plan, test
    ├── status-report/
    ├── triage/
    ├── prs-review/
    └── release/          # GitHub and Bitbucket
```
