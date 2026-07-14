---
name: jira
description: Triage small Jira tickets into reviewed Bitbucket pull requests.
disable-model-invocation: true
---

# Jira Triage

Run `$triage:jira <boards> [--status=<status>]` as a bounded Jira-to-Bitbucket pipeline. Default status is `Priorizado`. If boards are absent and not configured, ask once. Open at most three draft WIP PRs, stop for explicit human approval, and deliver only the approved tickets.

## Guardrails

- Refuse when Jira authentication or Bitbucket MCP access is unavailable. Do not fabricate tickets or PRs.
- Treat every branch creation, remote commit/push, PR create/update, PR comment, and draft publication as a remote write. Immediately before each such write for a ticket, verify and record its Bitbucket workspace, repository slug, current remote HEAD, base branch, and intended PR source/base destination from live MCP/Git evidence. Stop that ticket when repository inference, ownership, or destination is not conclusive; never guess a workspace, repo, branch, or PR.
- Prefer the Jira MCP's structured project/status filters. When only JQL is available, validate project keys and escape JQL string literals before constructing the query; never concatenate raw `boards` or `--status` input. Before Phase 3 opens any PR, display the final query (or structured filter) and the exact `{key, title}` ticket list selected from it.
- Keep only unambiguous `PP`, `P`, or `M` tickets. Reject open-ended investigation, rule-definition, empty, operational-data, large, cross-contract, or otherwise non-small work.
- Stop pre-triage as soon as three tickets are viable. A missing codebase map weakens fidelity but does not reject a repo by itself.
- Keep orchestration flat: the orchestrator spawns each focused subagent; subagents return compact verdicts and never spawn more agents. Keep source, diffs, and plans on disk or in PRs, not in orchestration context.
- Discover each repository, stack, development branch, and branch prefix from current sources. Never assume the local repo, `develop`, Node gates, or earlier line numbers.
- Use English for narration, branches, commits, titles, specs, and technical plans. Use Brazilian Portuguese for the plan summary and PR description. Never add an AI co-author.
- Use `fast` for mechanical filtering and digest assembly, `balanced` for investigation, planning, and delivery, and `deep` for adversarial review. Keep these tier names in phase briefings instead of model names.

## Pipeline

1. Read the applicable sections of [phase-playbook.md](references/phase-playbook.md) before each phase; it defines the exact briefings, SDD method paths, and JSON verdicts.
2. Create one codebase digest, then classify all candidate ticket text without opening code. Keep only smallest-first, unambiguous candidates; preserve their `nature` as routing signal, never as a filter.
3. Pre-triage candidates sequentially in the real target repo, including on-demand cloning. Measure change scope and coupling, record the stack, and write a lean English `docs/specs/<KEY>/spec.md` only for viable tickets. Stop at three.
4. Display the final ticket selection, then plan viable tickets in parallel. For each ticket, complete the live remote-write preflight before creating the repository-convention branch, committing/pushing the spec/plan artifacts, or opening a Portuguese draft WIP PR. Mark unresolved planning as manual follow-up; do not deliver it without a separate human decision.
5. Stop and present the WIP PRs with key, size, Portuguese summary, link, and follow-up flag. Wait for explicit approval before delivery.
6. Deliver each approved ticket with the referenced TDD method and current stack gates. Re-anchor against the live branch, make the smallest root-cause fix, commit, and update the Portuguese PR description with delivered work and validation.
7. Run blind review lenses. Resolve grounded findings and re-review with fresh lenses for no more than two cycles. Publish Ready only when clean; otherwise keep draft, post open findings, and report them.

## Completion

Report swept, rejected, viable, and approved tickets; every WIP PR; and each approved ticket's Ready or draft state with open findings. Do not continue past the approval checkpoint without the human's explicit decision.
