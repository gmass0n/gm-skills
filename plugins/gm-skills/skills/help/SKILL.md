---
name: help
description: Choose the gm-skills manual command for the current goal.
disable-model-invocation: true
---

# gm-skills help

*You have already been invoked; these instructions are now active context, not a pending action. Do not call the Skill tool to invoke this skill again.*

Identify the user's goal and respond only with the most suitable explicit command
and one short scope sentence. Do not run another skill or start work.

| Goal | Manual command |
| --- | --- |
| Map or update repository conventions | `$sdd:codebase` |
| Define feature requirements | `$sdd:spec` |
| Turn an approved spec into tasks | `$sdd:plan` |
| Execute an approved plan | `$sdd:implement` |
| Investigate and fix a defect | `$sdd:debug` |
| Review local changes before publishing | `$sdd:review` |
| Plan end-to-end QA | `$qa:plan` |
| Execute an approved QA plan | `$qa:test` |
| Explore one Jira task before implementation | `$jira:discovery` |
| Triage a bounded Jira board | `$jira:triage` |
| Review one or more remote PRs | `$prs-review:prs-review` |
| Prepare or finalize a GitHub release | `$release:github` |
| Prepare or finalize a Bitbucket release | `$release:bitbucket` |
| Produce a status update | `$status-report:status-report` |

Complete when the user has one explicit command to invoke. If there is more than
one goal, ask them to choose the first.
