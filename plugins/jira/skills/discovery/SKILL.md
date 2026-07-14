---
name: discovery
description: Interview, discover, and publish an evidence-backed Jira brief.
disable-model-invocation: true
---

# Jira Discovery

Run `$jira:discovery <JIRA-KEY | problem brief> [optional repo paths or names]` to turn
one problem into a small, evidence-backed Jira artifact. Publish it directly
to Jira when the MCP can write; use a local `.txt` only after the user accepts
that fallback.

## Interview

Interview the user relentlessly about every aspect of the request until shared
understanding is reached. Walk each branch of the design tree and resolve
dependent decisions one at a time. For every question, provide a recommended
answer.

Ask one question at a time and wait for the answer before continuing. When a
relevant codebase is available, investigate facts there instead of asking. Put
decisions about intent, scope, constraints, tradeoffs, and acceptance to the
user, then wait for the decision. A repository is optional; product and
reporting requests can proceed from the interview and Jira context alone.

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
   identifies a concrete problem or impacted audience/system.

   Complete when the source request and intended outcome are explicit.
2. When a key is given, fetch the issue and its relevant visible fields through
   the Jira MCP. Record the key, title, description, acceptance criteria,
   linked work, status, and attachments/links that change the scope. Without a
   key, require the target Jira project before publishing a new issue.

   Complete when each available scope signal is accounted for or marked absent.
3. If repositories are named or otherwise available, inspect only the minimum
   callers/contracts needed to trace the reported flow. If multiple repositories
   are relevant, state which owns source data, filtering, and presentation.
   When no repository is available, derive the scope from the interview and
   Jira context, and record technical details as risks/questions rather than
   assumptions.

   Complete when the product scope is clear and each available technical
   boundary is identified or explicitly uncertain.
4. Assemble the title and description with [the output template](references/output-template.txt).
   It is the single format reference for both Jira and local `.txt`: keep the
   title plain, render every description section in bold, use numbered
   acceptance criteria, and use bullets for all other lists.

   In Jira-first mode, create the issue for a problem brief or update the named
   issue's title and discovery description through the Jira MCP. Preserve
   existing fields that the artifact does not address, then return the issue
   URL. Do not create a local `.txt`.

   In accepted local fallback mode, write `jira-<KEY-or-slug>-discovery.txt`
   in the current directory and return its path. Do not update Jira.

   Complete when every claim is either evidenced or labelled as a
   suggestion/question, and exactly one destination has received the artifact.

## Boundaries

- Keep discovery separate from `$jira:triage`: discovery defines one problem;
  triage selects small tickets and can open delivery PRs.
- Treat technical implementation as a suggestion unless code or an existing
  contract confirms it. Preserve technical unknowns as risks/questions for the
  implementation team.
- When a technical flow is available, prefer the smallest contract that makes
  the decision at its owning boundary. For paginated lists or aggregate counts,
  verify filtering before pagination/aggregation.

## Completion

Respond only with the Jira issue URL or the accepted local `.txt` path.
