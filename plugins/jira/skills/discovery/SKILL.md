---
name: discovery
description: Interview, investigate, and publish an evidence-backed Jira task, bug, or story. Use when the user asks to create a new Jira work item or update a named existing issue and wants the board, scope, and evidence understood before publication.
disable-model-invocation: true
---

# Jira Discovery

*You have already been invoked; these instructions are now active context, not a pending action. Do not call the Skill tool to invoke this skill again.*

Run `$jira:discovery <JIRA-KEY | problem brief> [optional repo paths or names]` to
turn one request into one evidence-backed Jira artifact. Follow the phases in
order. Do not skip the interview or publish from a prompt alone.

## 1. Availability

Check only whether a Jira/Atlassian MCP is available and exposes native read
and write issue operations. Discover deferred tools through ToolSearch. Do not
read Jira, inspect repositories, write a local artifact, or create/update an
issue in this phase.

If the MCP is unavailable, respond exactly and stop:

> 🚫 Discovery blocked: Jira MCP with native issue read and write operations is required to publish discovery. Continue with a local `.txt` instead? (yes/no)

Only after an explicit `yes`, use local fallback. In fallback mode, do not call
a Jira write operation.

## 2. Interview

Interview first, one question at a time. Provide a recommended answer and wait
for the user's response. Do not investigate the board or code until the user
confirms shared understanding.

Resolve these decisions, using facts already supplied by the user and asking
only for missing material decisions:

- **Operation:** a supplied Jira key means update that exact issue; otherwise
  create one new issue. Never edit an issue found only by title similarity.
- **Outcome and audience:** the problem, intended result, and whether this is
  planned work or a record of a completed correction.
- **Destination:** target Jira project/board; for a new issue, required type
  (`Task`, `Bug`, or `Story`) if it cannot be inferred from the request.
- **Scope:** included systems, repositories, constraints, and acceptance.

### Backlog standard

Choose the work-item type from the value being managed; do not preserve a
user's label when the board reveals a materially better fit:

- **Story:** one user or stakeholder can describe a goal and benefit. Write
  `As a <role>, I want <outcome>, so that <benefit>.`
- **Task / Technical:** operational, enabling, migration, or maintenance work
  with no direct user-facing goal. State the outcome and delivery boundary.
- **Bug:** a verified deviation from expected behavior; state current behavior,
  expected behavior, impact, and reproduction when known.
- **Epic:** an outcome that requires multiple independently valuable stories.
  Propose it instead of forcing a large cross-system initiative into one story.

For every type, lead with the problem, audience, desired outcome, and value.
Acceptance criteria describe observable, testable behavior — not endpoints,
libraries, classes, or a step-by-step implementation. Put confirmed technical
constraints under **Delivery constraints** and optional architecture under
**Implementation considerations**. Label suggestions and inferences clearly.

Subtasks are a delivery decomposition, not a substitute for scope. Suggest
them only after the parent outcome is clear; create them only when the user
explicitly asks. Each subtask needs one owner boundary, one deliverable, and
one verification signal.

Treat an existing brief, branch, report, or local artifact as user-provided
context, not as permission to skip the interview. Complete only when the user
confirms the intended operation and outcome.

## 3. Board discovery

After the interview, inspect the target board before technical investigation.

1. For an update, fetch the exact issue and record its title, description,
   type, status, linked work, and fields that change scope.
2. For a new issue, fetch the target project metadata: available issue types,
   required fields, defaults, and any board-specific constraints. Scope every
   metadata query to the known project key — an unscoped project listing can
   exceed the tool result limit. Inspect a small number of recent comparable
   issues only when it helps explain a required field or convention.
3. Validate only the operation that will occur: `create` for a new issue or
   `update` for the supplied issue. Do not require update permission to create,
   nor create permission to edit.
4. If a required field has no user-confirmed value, ask one question. Never
   invent a product, component, sprint, parent, assignee, priority, or status.
5. A workflow validator can require a field that the create metadata omits —
   it only surfaces as a create-time rejection naming the field. Recover by
   reading recent issues of the same project and type: when they all carry one
   value for that field, use it and name the field and value in the draft
   summary; when they diverge, ask.

If the required operation is unavailable, offer local fallback only for that
operation, naming it accurately. Do not select fallback because an unrelated
permission is absent.

## 4. Evidence discovery

Inspect the minimum Jira context and repository callers/contracts needed to
substantiate the agreed scope. If multiple repositories are relevant, state
which owns source data, filtering, and presentation. Treat unverified technical
details as risks/questions, not facts.

When a branch or diff is the evidence, fetch the remote and diff against the
remote base branch (`origin/<base>`); a stale local base silently narrows the
scope to a subset of the real change.

For a completed correction, verify the named change and its focused regression
check when available; do not turn the record into new implementation work.

## 5. Draft and confirmation

Assemble the title and description with [the output template](references/output-template.txt).
Write user-facing text — the title included — in the language of the request;
keep code, URLs, commands, Jira keys, and `path:line` references literal. Use numbered
acceptance criteria and bullets for other lists. Apply the Backlog standard:
the draft must make the **why**, **who**, **what outcome**, **scope**, and
**success criteria** scannable before technical detail.

Present a concise draft summary: operation, project, issue type, required
board fields, title, and any unresolved risk. Ask for one final confirmation.
Do not write locally or to Jira until it is received.

## 6. Publish and verify

- **Create:** create exactly one issue with the confirmed project, type,
  required fields, title, and description.
- **Update:** update only the supplied key; preserve unrelated existing fields.
- **Local fallback:** write `jira-<KEY-or-slug>-discovery.txt` in the current
  directory and do not call a Jira write operation.

Read back the destination and verify the title, type, required fields, and
description were saved. If the service truncates or rejects content, report the
specific failure and ask before any corrective write.

## Boundaries

- Keep discovery separate from `$jira:triage`: discovery defines one problem;
  triage selects small tickets and can open delivery PRs.
- Every claim must be evidenced or labelled as a suggestion/question.
- Prefer the smallest contract at its owning boundary. For paginated lists or
  aggregate counts, verify filtering before pagination/aggregation.

## Completion

Respond only with the Jira issue URL or the accepted local `.txt` path.
