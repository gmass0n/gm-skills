---
name: prs-review
description: Consolidated, multi-platform Pull Request review.
disable-model-invocation: true
---

# PRs Review

*You have already been invoked; these instructions are now active context, not a pending action. Do not call the Skill tool to invoke this skill again.*

Review a related batch of PRs from Bitbucket, GitHub, or both and deliver one
ClickUp-ready verdict. The scope is each PR's new diff; do not invent contracts,
rules, or context across repositories.

## Before starting

Require the PR links and task context. If context is missing, ask
`What context/details does the task implemented by these PRs have?` and stop.

Normalize URLs with `www.`, trailing slashes, or fragments. Accept only:

- `bitbucket.org/<workspace>/<repo>/pull-requests/<id>`;
- `github.com/<owner>/<repo>/pull/<number>`.

Unknown host: ask for clarification; do not guess.

Check only the MCPs for the platforms present before collecting any PR. Load a
deferred tool through ToolSearch when necessary.

- Bitbucket: `mcp__bitbucket__getPullRequest`,
  `mcp__bitbucket__getPullRequestDiff`, `mcp__bitbucket__getPullRequestCommits`.
- GitHub: `mcp__github__pull_request_read` and, for branch files,
  `mcp__github__get_file_contents`.

Beyond these minimums, discover the platform operation that lists changed files
(and the file-content operation at the PR head, if separate). Do not start the
analysis until that list can be paginated to the end. If the connector does not
expose the required operation, that PR's review is incomplete and rejected —
never assume the received diff represents every file.

If a required MCP is missing, end without a partial review using exactly one of
the following responses:

> 🚫 Review blocked: Bitbucket MCP is not installed. Install the Bitbucket MCP and try again.

> 🚫 Review blocked: GitHub MCP is not installed. Install the GitHub MCP and try again. See `references/github-mcp-install.md`.

> 🚫 Review blocked: MCPs missing for the platforms used: <list>. Install them and try again.

## Flow

1. For each PR, obtain the author, actual commit count, repository, id, original
   URL, and platform. On GitHub, use `pull_request_read` with `method: "get"`;
   use `get_commits` only if the list is needed. On Bitbucket, use the PR and
   commit endpoints.
2. Review all PRs in parallel, one subagent per PR, when supported. If subagents
   are unavailable, review inline and sequentially; that is not a reason to
   cancel the batch.
3. First build the complete inventory: paginate the changed-file list until
   there is no next page and record every path/status. Do this for inline review
   too; delegation does not transfer proof of coverage. Then fetch the diff via
   the MCP: Bitbucket `getPullRequestDiff`; GitHub
   `pull_request_read(method: "get_diff")` and paginated `get_files`. Reconcile
   the diff, pages, and inventory: every changed file must be marked as read.
   For missing, truncated, or binary patches, fetch the file content at the PR
   head and review it within the change scope; if it cannot be obtained or read,
   mark coverage incomplete. Do not approve a PR/batch with any unread file:
   include an explicit incomplete-coverage blocker.
4. Apply the `sdd:review` doctrine: blind lenses, followed by adversarial
   verification. Search the Claude and Codex caches,
   `~/.claude/plugins/cache/gm-skills/sdd/*/skills/review/` and
   `~/.codex/plugins/cache/gm-skills/sdd/*/skills/review/`; choose the highest
   compatible semver version containing **both**
   `references/review-lenses.md` and `references/verification-discipline.md`,
   and read them. If no compatible version exists, report in one line that the
   complete doctrine was unavailable and apply correctness, security,
   performance, architecture/DRY-SOLID, and spec lenses, followed by an explicit
   refutation attempt.
5. Generate hypotheses only from lines added to the diff. Verify each hypothesis
   against the PR branch and focused callers/contracts; do not explore the whole
   repository. A possible blocker requires a second fresh verification to
   confirm it. Divergence downgrades the item to a warning with `confirm:`.
   Refuted items and questions do not enter the verdict; partial becomes a
   warning.
6. Return only concrete blockers, warnings, and praise, with `file:Lline`.
   Discard nits.
7. Consolidate: any blocker — including incomplete coverage — rejects the batch
   and corresponding PR; with no blocker, approve both. Save the result to
   `code-review-<TASK-KEY-or-YYYY-MM-DD>.txt` in the current directory.

Read [the output contract](references/output-contract.md) before writing the
file. It is mandatory for formatting, grouping, and omissions. Read
[the platform prompts](references/subagent-prompt-bitbucket.md) or
[GitHub](references/subagent-prompt-github.md) when delegating review; they
contain the specifics of each MCP. For a complete file example, read
[example-verdict.md](references/example-verdict.md). Consult
[github-mcp-install.md](references/github-mcp-install.md) only when the GitHub
MCP needs to be installed.

## Completion

Respond in chat with only the path to the generated `.txt`. None of the verdict
may be included in chat.
