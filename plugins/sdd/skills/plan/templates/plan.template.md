# Template: `plan.md`

The **HOW** contract of a feature: design + tasks in a single file, at `docs/specs/<feature>/plan.md`. It's what `sdd:implement` executes — so the format of the tasks, the matrix, and the batches IS a contract, machine-parsed. This template is the source of truth for that format.

## Language

Files are always written in English. Live narration to the user inherits `lang:` from `spec.md` (`lang:` in the frontmatter) — `lang:` records the conversation language; it never changes file content. Do not re-detect.

## Structure

```markdown
---
title: <feature>
lang: pt | en              # inherited from spec
status: draft | ready      # "ready" only with a complete matrix AND zero open [ANALYSIS]
spec: ./spec.md
generated: <date>
---

# Plan: <feature>

> **For the executors (sdd:implement):** each task is executed by a fresh subagent that only FOLLOWS the Steps below, in order, without analyzing the codebase — all the analysis was already done here. Steps use checkboxes (`- [ ]`) and follow TDD: RED → GREEN → REFACTOR → COMMIT.

**Goal:** <what this feature delivers, in 1-2 sentences. Include any collateral bug fixed, if there is one.>

**Architecture:** <the technical approach in 1-3 sentences: the pipeline/flow the change goes through and the real patterns it follows.>

**Tech Stack:** <stack relevant to the feature — e.g. NestJS, TypeScript, CQRS, TypeORM, Jest.>

---

## Design

### Solution overview
<how the spec is satisfied, in technical terms. 3-5 sentences.>

### Codebase anchoring
<the real patterns this design follows, by path. Brownfield: conform, don't reinvent.>
- Follows the adapter from [integrations/seru-client.md](../../codebase/integrations/seru-client.md)
- Respects the layer rule from [layers/presentation-layer.md](../../codebase/layers/presentation-layer.md)

### Components and flow
<what changes/is born, where it lives, and the end-to-end path. Each decision → REQ-id.>
- `SeruNotificationAdapter.streamStatus()` — subscribes to the upstream stream → REQ-1, REQ-3
- No persistence (stateless stream) → REQ-2

### Trade-offs
<the technical choices and why. Inherits the "Decisions and constraints" from the spec.>
- SSE instead of WebSocket: unidirectional is enough (REQ-1), less infra. (decision D-1 from spec)

## Cross-repo interface contract

<ONLY multi-repo. Omit entirely when the feature touches a single repo.
 FREEZES the shape of the data that crosses the chain (`Chain:` from the spec): name + type of each field,
 who PRODUCES and who CONSUMES. It's what unlocks the parallelism — each repo mocks against this shape
 and implements alone, without needing the other one LIVE. Inherits `## Repos involved` and the `Chain:` from the spec.>

| Field     | Type          | Produces | Consumes    |
|-----------|---------------|----------|-------------|
| latitude  | number\|null  | LOC      | BFF, portal |
| longitude | number\|null  | LOC      | BFF, portal |

## Tasks

<each task is atomic. T-<n> stable. [!] = critical (solo batch). [P] is NOT declared here —
 it's computed on TWO axes: file collision (intra-repo) + contract barrier (cross-repo).
 The plan records the result in the Batch field.

 The metadata fields (Source/Repo/Depends on/Files/Verification/Batch) are the parseable CONTRACT.
 `Repo:` = repo TAG (LOC/BFF...), inherited from the spec's REQ→repo map; trivial/omitted single-repo.
 `sdd:implement` reads `Repo:` to pick the worktree where the task runs.
 The Steps below them are the execution SCRIPT: the implement subagent only follows them, it doesn't decide.
 Each task starts with a failing test and ends in an atomic commit — TDD, no exception.

 Steps rule: ALWAYS checkbox + file + verification command. Embedded code snippet
 ONLY when the edit is non-obvious (a new signature, a conditional spread, a SQL). A trivial edit
 (adding a field to a DTO) is described in one line, no code block.>

### T-1
- Source: REQ-2
- Depends on: —
- Files: src/modules/notification/domain/ports/notification-gateway.port.ts, src/.../tests/notification-gateway.port.spec.ts
- Verification: test `should expose stream contract` covers the REQ-2 criterion
- Batch: L-1

- [ ] **Step 1 (RED):** write the failing test `should expose stream contract` in the `.spec.ts`, asserting the observable contract of REQ-2. Run `yarn test notification-gateway.port.spec` → see it FAIL on the assertion (not on import/syntax).
- [ ] **Step 2 (GREEN):** define the minimal port that satisfies the test. Run the test → see it PASS.
- [ ] **Step 3 (REFACTOR):** clean up with the test as a safety net. Run again → green.
- [ ] **Step 4 (COMMIT):** `feat(notification): expose stream contract on the port` (Conventional Commits, English).

### T-2  [!]
- Source: REQ-1, REQ-3
- Depends on: T-1
- Files: src/modules/notification/infrastructure/seru/seru-notification.adapter.ts, src/.../tests/seru-notification.adapter.spec.ts
- Verification: test `should emit order.status on change` covers the REQ-1 criterion; `should auto-reconnect on drop` covers REQ-3
- Batch: L-2

- [ ] **Step 1 (RED):** write the failing test `should emit order.status on change`. Run → see it FAIL.
- [ ] **Step 2 (GREEN):** implement `streamStatus()` in the adapter. Non-obvious snippet (subscribes upstream and remaps):
  ```ts
  streamStatus(orderCode: string): Observable<OrderStatusEvent> {
    return this.upstream.subscribe(orderCode).pipe(
      map((raw) => new OrderStatusEvent(raw.code, raw.status)),
    );
  }
  ```
  Run the test → see it PASS.
- [ ] **Step 3 (RED):** write the failing test `should auto-reconnect on drop` (REQ-3). Run → see it FAIL.
- [ ] **Step 4 (GREEN):** add `retryWhen`/backoff to the pipe. Run both tests → green.
- [ ] **Step 5 (REFACTOR):** extract the backoff if it repeats. Run → green.
- [ ] **Step 6 (COMMIT):** `feat(notification): emit order.status and reconnect in the SERU adapter`.

## Batches

<pre-computed from the dependency graph + the two axes (file collision intra-repo +
 contract barrier cross-repo). The implement uses them, doesn't recompute.

 MULTI-REPO opens with L-0: 1 task/repo from the `## Repos involved` registry — clone if absent →
 worktree + branch off the repo's base (bases differ: some master, some develop) → commit the specs
 scaffold → push → DRAFT PR. Base and title come from the registry; the PR tool is the executor's detail.
 Single-repo has NO L-0.

 Cross-repo: tasks in different repos are [P] to IMPLEMENT if the contract is frozen
 (each one mocks against the shape), BUT the consumer has `Depends on:` the producer for MERGE order.
 Parallel to implement ≠ ordered to merge.>
- **L-0** (multi-repo scaffold): T-0-LOC, T-0-BFF — clone/worktree/branch/push/draft PR per repo
- **L-1** (serial): T-1
- **L-2** (solo, [!]): T-2 — critical, runs and validates alone
- **L-3** (parallel): T-4, T-5 — Files with no intersection, none on the hot list

## Coverage matrix (REQ → task → test)

<the spine of the proof chain. EVERY REQ from the spec appears here with ≥1 task and ≥1 test.
 If any REQ is left uncovered, the plan FAILS and lists the gap — it doesn't proceed.>

| REQ   | Tasks    | Test(s) that prove it                     |
|-------|----------|-------------------------------------------|
| REQ-1 | T-2      | should emit order.status on change        |
| REQ-2 | T-1      | should expose stream contract             |
| REQ-3 | T-2      | should auto-reconnect on drop             |

## Concern remediation (optional, opt-in)

<only concerns whose anchor falls in the feature's Files, and that the dev ACCEPTED to include.
 Empty if none was accepted. Global debt does NOT go here.>
- T-6 — Source: CONCERN-007 — handles the upstream stream timeout (src/.../adapter.ts:42)

## Pending analysis

<the open [ANALYSIS: ...] items from /analyze. Persisted HERE the moment they arise.
 While there are items, status = draft and sdd:implement REFUSES. Empty → "None." and status = ready.>
- None.
```

## Filling-in rules

- **Steps are the execution script.** Every task has checkbox Steps that the implement subagent follows without analyzing anything. The codebase analysis happens HERE, in the plan; the implement only executes. Poorly-made Steps force the implement to analyze — exactly what the design wants to prevent.
- **Steps follow TDD.** Fixed order per `Verification` criterion: RED (failing test + run + see it fail) → GREEN (minimal code + run + see it pass) → REFACTOR → and one atomic COMMIT at the end of the task. Each test Step names the real command (`yarn test ...`).
- **Code snippet only when non-obvious.** Always checkbox + file + command. Embedded code block only for non-trivial edits (new signature, conditional spread, SQL); a trivial edit becomes a one-line description.
- **Atomic task, stable ID.** `T-<n>` never renumbered — it's the target of `sdd:implement T-n` and the matrix key.
- **`Verification` names the test** that covers a spec acceptance criterion. Without a named test, the task is outside the proof chain.
- **`[!]` is marked; `[P]`/`Batch` is computed on two axes.** Criticality you decide (heuristic + dev override). Parallelizability comes from TWO orthogonal axes: **file collision (intra-repo)** — `Files` intersection + hot list (`*.module.ts`, `env.schema.ts`, contracts); and **contract barrier (cross-repo)** — tasks in different repos are `[P]` to implement IF the `## Cross-repo interface contract` is frozen, otherwise serial. Single-repo only has the file axis. Cross-repo `[P]` still carries `Depends on:` the producer (merge order ≠ implementation order). The result becomes the `Batch`.
- **`Repo:` is inherited, not decided.** Comes from the spec's REQ→repo map. Repo TAG (LOC/BFF...). Single-repo: trivial/omitted. `sdd:implement` uses it to pick the worktree.
- **Cross-repo contract is mandatory multi-repo.** The `## Cross-repo interface contract` block freezes name+type of each field that crosses the chain. Omitted entirely single-repo.
- **`L-0` opens every multi-repo feature.** 1 task/repo from the registry: clone if absent → worktree+branch off the repo's base → commit scaffold → push → draft PR. Deterministic (base/title from the registry). Single-repo doesn't have one.
- **Complete matrix is a gate.** Every REQ from the spec → a row in the matrix with a task + test. Missing one → plan FAILS, lists the gap, stops.
- **`/analyze` blocking loop.** Checks: phantom REQ, uncovered REQ, contradiction with an enforced invariant, and (multi-repo) **cross-repo contract consistency** — the field in the `## Cross-repo interface contract` appears with the SAME name+type in the task that PRODUCES it and the one that CONSUMES it. Inconsistency found → `[ANALYSIS: ...]` persisted in "Pending analysis" immediately. `status: ready` only with that section empty. `sdd:implement` reads the status and the section — a `draft` plan or one with an open `[ANALYSIS]` is refused.
- **Concerns only by scope and opt-in.** Filters by anchor in the feature's `Files`, presents to the dev, only enters if accepted. Never auto-injects, never pulls global debt.
- **Each Design decision → REQ-id.** An orphan decision (no REQ) is scope creep.
