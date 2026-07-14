---
name: discovery
description: Interview, discover, and publish an evidence-backed Jira implementation brief.
disable-model-invocation: true
---

# Jira Discovery

Run `$jira:discovery <JIRA-KEY | problem brief> [repo paths or names]` to turn
one problem into a small, evidence-backed Jira artifact. Publish it directly
to Jira when the MCP can write; use a local `.txt` only after the user accepts
that fallback.

## Interview

Start a `/grilling` session before reading Jira or publishing an artifact.
`/grill-me` is only an alias for the same protocol; use `/grilling` as the
single interview entrypoint.

Ask one question at a time and wait for its answer. Investigate facts in the
named codebases instead of asking about them; ask the user to decide intent,
scope, constraints, tradeoffs, and acceptance. Cover every unresolved decision
that changes the proposed issue.

Do not collect Jira data, write a local artifact, or create/update an issue
until the user confirms shared understanding of the problem and intended
outcome.

## Gate

Check only for the Jira/Atlassian MCP before collecting ticket data. Discover
its available read and write operations through ToolSearch when deferred.
Confirm that the connected account can create an issue and update an existing
issue in the target project. Use the MCP's native issue methods; never
fabricate ticket fields or access Jira through a browser, curl, or a local
cache.

If the MCP is unavailable or lacks either required write capability, respond
exactly and stop:

> 🚫 Discovery blocked: Jira MCP with create and update permissions is required to publish discovery. Continue with a local `.txt` instead? (yes/no)

Only after an explicit `yes`, continue in local fallback mode. In fallback
mode, do not call a Jira write operation.

## Discovery

1. Normalize the input after the interview. A Jira key identifies one existing issue; otherwise,
   the supplied brief is the source request. Ask one question only when neither
   identifies a concrete problem or impacted system.

   Complete when the source request and intended outcome are explicit.
2. When a key is given, fetch the issue and its relevant visible fields through
   the Jira MCP. Record the key, title, description, acceptance criteria,
   linked work, status, and attachments/links that change the scope. Without a
   key, require the target Jira project before publishing a new issue.

   Complete when each available scope signal is accounted for or marked absent.
3. Inspect only the named repositories and the minimum callers/contracts needed
   to trace the reported flow. If the request names multiple repositories,
   trace the boundary in each and state which owns source data, filtering, and
   presentation. Distinguish evidence from an implementation suggestion.

   Complete when the likely root boundary and every impacted repository are
   identified, or the uncertainty is stated.
4. Assemble the artifact using [the output template](references/output-template.txt):
   title, context, objective, scope, acceptance criteria, Definition of Done,
   out of scope, suggestions, risks/questions, affected repositories, and
   `path:line` evidence.

   In Jira-first mode, create the issue for a problem brief or update the named
   issue's discovery content through the Jira MCP. Preserve existing fields
   that the artifact does not address, then return the issue URL. Do not create
   a local `.txt`.

   In accepted local fallback mode, write `jira-<KEY-or-slug>-discovery.txt`
   in the current directory and return its path. Do not update Jira.

   Complete when every claim is either evidenced or labelled as a
   suggestion/question, and exactly one destination has received the artifact.

## Boundaries

- Keep discovery separate from `$jira:triage`: discovery defines one problem;
  triage selects small tickets and can open delivery PRs.
- Prefer the smallest contract that makes the decision at the owning boundary.
  Avoid proposing frontend-only filters when a backend/upstream source can
  filter list, count, and stream consistently.
- For a paginated list or aggregate count, verify that filtering happens before
  pagination/aggregation. Flag post-page filtering as a risk rather than
  presenting it as a solution.

## Completion

Respond only with the Jira issue URL or the accepted local `.txt` path.
