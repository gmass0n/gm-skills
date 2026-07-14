---
name: discovery
description: Discover one Jira task or story and create a ready-to-copy implementation brief.
disable-model-invocation: true
---

# Jira Discovery

Run `$jira:discovery <JIRA-KEY | problem brief> [repo paths or names]` to turn
one problem into a small, evidence-backed Jira artifact. This is read-only:
inspect Jira through its MCP and local repositories, then write one `.txt` in
the current directory. It does not create or update Jira issues.

## Gate

Check only for the Jira/Atlassian MCP before collecting ticket data. Discover
its available read operations through ToolSearch when deferred. Use the MCP's
native issue search/get methods; never fabricate ticket fields or access Jira
through a browser, curl, or a local cache.

If the Jira MCP is unavailable, respond exactly:

> 🚫 Discovery blocked: Jira MCP is not installed. Install the Jira MCP and try again.

## Discovery

1. Normalize the input. A Jira key identifies one existing issue; otherwise,
   the supplied brief is the source request. Ask one question only when neither
   identifies a concrete problem or impacted system.

   Complete when the source request and intended outcome are explicit.
2. When a key is given, fetch the issue and its relevant visible fields through
   the Jira MCP. Record the key, title, description, acceptance criteria,
   linked work, status, and attachments/links that change the scope. Do not
   mutate Jira.

   Complete when each available scope signal is accounted for or marked absent.
3. Inspect only the named repositories and the minimum callers/contracts needed
   to trace the reported flow. If the request names multiple repositories,
   trace the boundary in each and state which owns source data, filtering, and
   presentation. Distinguish evidence from an implementation suggestion.

   Complete when the likely root boundary and every impacted repository are
   identified, or the uncertainty is stated.
4. Write `jira-<KEY-or-slug>-discovery.txt` using
   [the output template](references/output-template.txt). Keep it ready to
   copy into Jira: title, context, objective, scope, acceptance criteria,
   Definition of Done, out of scope, suggestions, risks/questions, and affected
   repositories. Cite code evidence as `path:line` when available.

   Complete when every claim in the artifact is either evidenced or labelled
   as a suggestion/question, and no remote system has changed.

## Boundaries

- Keep discovery separate from `$jira:triage`: triage selects small tickets and
  can open delivery PRs; this skill investigates a single problem and creates
  no remote write.
- Prefer the smallest contract that makes the decision at the owning boundary.
  Avoid proposing frontend-only filters when a backend/upstream source can
  filter list, count, and stream consistently.
- For a paginated list or aggregate count, verify that filtering happens before
  pagination/aggregation. Flag post-page filtering as a risk rather than
  presenting it as a solution.

## Completion

Respond only with the path to the generated `.txt`.
