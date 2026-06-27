---
name: plan
description: "Turn an approved spec into an executable implementation plan — Phase 2 (DESIGN + TASKS) of the SDD workflow, after sdd:spec and before sdd:implement. Use when the user wants to \"plan this\", design the implementation, break work into tasks, or asks \"how do we build X\". The main agent orchestrates: it dispatches subagents to read the codebase map, investigate exact files, and confirm external APIs, then synthesizes — never reading raw source itself. Writes docs/specs/<feature>/plan.md with a design anchored to real patterns (every decision tied to a REQ-ID) and atomic tasks carrying stable IDs plus per-task TDD Steps detailed enough that sdd:implement runs without re-analyzing, a REQ→task→test coverage matrix, dependency graph, and pre-computed batches; a /analyze subagent loops until clean. Won't finish while any requirement is uncovered or any decision contradicts an enforced invariant."
---

# SDD — Plan (Phase 2: Design + Tasks)

## What this phase produces

One file: `docs/specs/<feature>/plan.md`, with two sections in one document:
- **Design** — the technical HOW that satisfies the spec, anchored to the project's real patterns.
- **Tasks** — an atomic, ordered breakdown, each task tied back to the requirements it serves and the test that proves it.

One file, one approval gate. Design and tasks live together because you refine them against each other — splitting them would force you (the same person, same session) through two gates for one decision. The conceptual distinction stays (two sections), the ceremony doesn't.

**`plan.md` is the contract `sdd:implement` executes.** Almost all of the workflow's intelligence lives in the Tasks section: the IDs, the dependency graph, the file sets, the coverage matrix. If the plan encodes those well, the implementer can be simple and safe. If it encodes them poorly, nothing downstream works. So spend the effort here.

This phase reads `spec.md` and — through subagents — the codebase map; the main agent writes only `plan.md`. You orchestrate the analysis; you don't pull raw source into your own context (see "You orchestrate; subagents analyze" below).

## Preconditions — refuse rather than build on sand

Before doing anything, check the spec:
- **No `spec.md`** → refuse: "There's no spec for `<feature>`. Run `sdd:spec <feature>` first."
- **`spec.md` has any open `[NEEDS CLARIFICATION]` (status: draft)** → refuse: "The spec has pending clarifications — go back to `sdd:spec` to close them before planning." This is the safety-net half of the clarification gate: in the normal flow it never fires (the spec left `sdd:spec` clean), but if a session died mid-interview and the user jumped straight here, this catches it.

**Inherit the language.** Read `lang:` from the spec's frontmatter and use it for live **narration** to the user — but **`plan.md` is always written in English.** `lang:` records the conversation language; never re-detect, never switch. The spec owner chose it.

## You orchestrate; subagents analyze

You are the **orchestrator** of this phase. You don't read the codebase into your own context — you dispatch subagents to analyze, and you synthesize their returns into `plan.md`. The synthesis (design, tasks, matrix, batches) is yours; the reading is delegated. This keeps your context lean and is the main token win of the phase: raw file bytes and doc dumps stay in the subagents.

What goes to subagents, run in **parallel** when independent:
- **Reading the codebase map** — one `Explore` subagent loads the docs `context.md`'s "Loading per task" names for this feature (selective — not all 30) and returns the patterns, layer rules, and **enforced invariants** as a digest. **In the same subagent, on a large feature, also run `node <sdd-implement-skill>/scripts/lessons.js list --status confirmed`** if `docs/codebase/lessons/` exists, and fold the confirmed lessons (capped top-N by recurrence) into the digest — the project's distilled past failures, so the design pre-empts a known repeat. Don't open a second subagent for it; it rides along with the map read.
- **Investigating specific files** — the exact signatures, line ranges, and snippets each task's Steps will need. This is the analysis that gets *cached as Steps* so `sdd:implement` never re-analyzes.
- **Confirming external APIs** — a subagent uses Context7 to verify current library APIs rather than you guessing.

You receive digests, not raw files, and weave them into the design and the Steps.

If a relevant codebase doc looks stale (its `sources` changed after its `generated:` date), recommend `sdd:codebase diff` before planning — otherwise the design anchors to a false picture.

## The Design section

The HOW, in technical terms, satisfying the spec. Keep it anchored and traceable:
- **Cite the real patterns** it follows, by path: "follows the adapter from [integrations/seru-client.md], the layer rule from [layers/presentation-layer.md]". The design conforms to what exists; it doesn't reinvent.
- **Every design decision points to a REQ-ID** it serves. A decision that serves no requirement is scope creep — cut it or question whether the spec is missing something.
- **Carry forward the spec's decision log.** The "Decisions and constraints from the interview" from the spec are constraints here, not things to re-derive. If the spec said "SSE, not WebSocket", the design builds SSE.
- Cover: solution overview, components and where they live, the end-to-end flow, key trade-offs, and the files the change will touch.

### Multi-repo features — inherit the map, freeze the contract

When a feature crosses repositories, the spec already emitted what you need — **inherit it, don't rediscover it**:
- A `## Repos involved` table (tag/slug/role/base branch/cloned?) — the registry every downstream field reads.
- A `Chain:` describing the data flow across repos (e.g. `locations-api → customer-api → BFF → portal`).
- A REQ→repo map saying which repo each requirement lands in.

The plan carries these forward: each task's `Repo:` comes from the REQ→repo map, each Batch-0 task's base/title comes from the registry. You never re-decide which repo a thing lives in.

The new design artifact you do own is the **interface contract that ties the chain together** (next section). Single-repo features have no chain — they skip all of this; `Repo:` is trivial and the contract block is omitted.

#### `## Cross-repo interface contract` — freeze the shape that crosses the chain

A multi-repo feature is coupled by the **data that travels the chain**, not by files (tasks in different repos never share a file). The real coupling is the *shape* — the field name and type of every datum that one repo produces and the next consumes (e.g. `latitude: number|null`, `longitude: number|null` on the address). That axis is invisible to the file matrix, so you make it explicit.

This block **freezes that shape**: for each datum crossing the chain, its name + type, who produces it and who consumes it. It is **mandatory when multi-repo**. It's also what unlocks the parallelism: once the contract is frozen, each repo **mocks against it** and implements independently — nobody needs another repo live to make progress. The contract is the seam; the mock is how each side works alone. Omit this block entirely when the feature touches a single repo.

## The Tasks section — where the intelligence lives

Break the work into **atomic tasks**. Each task has two parts: stable **metadata** that downstream phases parse mechanically, and an ordered list of **Steps** that the executor follows literally. Follow `templates/plan.template.md` for the exact shape:

```
### T-3  [!]
- Source: REQ-1, REQ-2          # which requirements this task serves (traceability)
- Repo: BFF                     # repo TAG from the spec's REQ→repo map (multi-repo only; trivial/omitted single-repo)
- Depends on: T-1               # dependency graph edge (or "—")
- Files: src/.../seru-notification.adapter.ts, src/.../tests/...spec.ts
- Verification: test `should emit order.status on change` covers the REQ-1 criterion
- Batch: L-2                     # pre-computed (see batching below)

- [ ] **Step 1 (RED):** write failing test `should emit...`; run `yarn test ...` → see it fail
- [ ] **Step 2 (GREEN):** implement <snippet only if non-obvious>; run → see it pass
- [ ] **Step 3 (REFACTOR):** clean up; run → green
- [ ] **Step 4 (COMMIT):** `feat(...): ...`
```

- **`Repo:` is the repo TAG** (`LOC`, `BFF`, …) the task lands in, **derived from the spec's REQ→repo map** — the plan inherits it, it doesn't decide it. `sdd:implement` reads `Repo:` to pick which repo's worktree to run the task in. When the feature touches a single repo, `Repo:` is trivial and may be omitted; the field only earns its keep cross-repo.

- **`T-<n>` IDs are stable** — they're how `sdd:implement` targets a single task (`sdd:implement T-3`) and how the matrix traces coverage. Never renumber.
- **`Verification` names the test**, and that test must cover an acceptance criterion from the spec. This is the link that makes "everything is tested" mechanical rather than hopeful.

### Steps are where the analysis you do here gets cached for the executor

This is the heart of the division of labor. **`sdd:implement` does not analyze the codebase — it only executes.** That is only possible if *you* do all the analysis now and write it down as Steps concrete enough to follow blind:

- Every task carries **Steps** in checkbox form (`- [ ]`), in strict TDD order: RED (write the failing test, run it, watch it fail) → GREEN (minimal code, run it, watch it pass) → REFACTOR → a final atomic COMMIT. One RED→GREEN cycle per `Verification` criterion.
- Each Step names the **file** it touches and the **exact command** to verify it (`yarn test <spec>`, `yarn tsc --noEmit`). The executor never has to guess what to run.
- Embed a **code snippet only when the edit is non-obvious** — a new signature, a conditional spread, a SQL fragment. A trivial edit (add a field to a DTO) is one descriptive line, no code block. Over-embedding bloats the plan; under-embedding forces the executor to analyze. Judge per edit.
- The test is the rule of thumb for "detailed enough": if a fresh subagent with only this task's block (no map, no repo tour) could carry out the Steps and land the commit, the task is complete. If it would have to go read source to know *how*, the Step is too thin — that missing analysis is your job, here, not the executor's.

Doing the analysis once, here, and caching it as Steps is also the token win: the executor loads a ~500-token task block instead of re-reading the codebase map per task.

### The two orthogonal axes — don't conflate them

A task has two independent properties. Keeping them separate is what makes the plan honest:

- **`[!]` criticality** — should this run alone, with its own review, because it's risky (touches business rules, security, a migration, a shared kernel)? This is about *review granularity*. You mark it: heuristically (auto-flag the risky kinds) and the user can override in the plan.
- **`[P]` parallelizability** — *computed, not declared.* `[P]` runs on **two orthogonal axes**, and a task is parallelizable only if it clears both:
  - **File collision (intra-repo)** — the axis that always applies. A task fails it if its `Files` set intersects another task's in the same wave, **or** any of its files are in the "hot list" — the shared-DI files every slice touches in a repo (`*.module.ts`, `env.schema.ts`, domain contracts). Same-repo tasks that touch the same file can't run in parallel. This is the only axis single-repo features have.
  - **Contract barrier (cross-repo)** — the axis multi-repo adds. The chain *produces → transforms → consumes* a datum, so a consumer task and its producer task are coupled **even though they live in different repos and share no file**. Here the file matrix says "parallel" by accident (different repos never collide on a file) and is wrong: the truth is the contract, not the file. The rule: tasks in different repos are `[P]` **to implement** if the `## Cross-repo interface contract` is frozen — each side mocks against the frozen shape and needs no other repo live. If the contract is **not** frozen, they are serial. But implementing in parallel is not the same as merging in any order: the consumer must not merge before the producer exposes the contract. **Parallel to implement ≠ ordered to merge.** Encode that merge order as a `Depends on:` edge (consumer depends on producer) even when the two are `[P]`.

Why computed: a self-declared `[P]` is a lie waiting to happen — two same-repo "independent" tasks that both edit `notification.module.ts` collide, and a cross-repo consumer that "looks parallel" by file but races its producer's contract collides at merge. The file matrix is the truth for the intra-repo axis; the frozen contract is the truth for the cross-repo axis. In this coupled brownfield, genuinely parallel tasks are rare, and that's fine — serial is the default downstream anyway.

### Pre-compute the batches

From the dependency graph and the two axes, group tasks into `L-<n>` batches:
- A `[!]` critical task → its own **solo batch** (runs, tests, validates before the next).
- `[P]` tasks with no file intersection → may share a **parallel batch**.
- Everything else → sequential.

Assign each task its `Batch: L-<n>`. The implementer uses these; it doesn't recompute them.

**Multi-repo opens with `Batch 0` — the scaffold batch.** Before any feature work, a cross-repo feature needs each repo checked out, branched, and PR-opened so the chain has somewhere to land. So emit **one deterministic task per repo** in the registry, all in `L-0`:

1. Clone the repo if it's absent (the registry's `clonado?` column says which).
2. Create a git **worktree** + branch off **that repo's base** — bases can differ per repo (some `master`, some `develop`); read each from the registry, never assume one base.
3. Commit the spec scaffold (the `docs/specs/<feature>/` artifacts) into the branch.
4. Push.
5. Open a **draft PR** — base and title come from the registry, not invented here.

`L-0` is fully determined by the `## Repos involved` registry — title, base, and repo are all reads, no judgment. The PR tooling is the executor's detail (`gh`, an MCP, whatever the repo uses) — don't hard-code one. Single-repo features have no `L-0`.

## The coverage matrix — the spine of the proof chain

The user's strongest requirement: *the flow proves everything is built and tested, nothing is skipped.* The matrix is how. Build a table inside `plan.md`:

```
| REQ   | Tasks      | Test(s) that prove it |
|-------|------------|---------------------|
| REQ-1 | T-3        | should emit order.status on change |
| REQ-2 | T-4        | should not enqueue while disconnected |
| REQ-3 | T-3, T-5   | should auto-reconnect on drop |
```

**The plan FAILS if any REQ-ID has no task with a named test.** Don't quietly proceed — list the uncovered requirements and stop. Every REQ from the spec must appear in this table with at least one task and one test. This is the mechanical guarantee that the spec can't be half-implemented. The matrix lives *inside* `plan.md` — it is not recomputed from the spec at runtime; it's the durable record the closing gate in `sdd:implement` walks.

## /analyze — the consistency loop before finishing

Coverage (the matrix) proves every requirement has a task. It does **not** prove the tasks are *consistent* with the spec and the project's rules. `/analyze` is that second check — and it's deliberately lean. List-checks, using artifacts you already have:

1. Every REQ-ID referenced in a task's `Source:` actually exists in the spec (no phantom requirements).
2. Every REQ-ID in the spec appears in the matrix (this is the coverage check, restated).
3. **No design decision contradicts an "Invariante enforced" from `context.md`.** Example: a task proposes `domain/` importing `@nestjs/common` → context.md says eslint-boundaries forbids it → block it: "it'll fail the lint, off-pattern." This is where the flow stays on-pattern — by reading what the project actually enforces, not a hand-written rulebook.
4. **(multi-repo only) Cross-repo contract consistency** — each datum in `## Cross-repo interface contract` appears with the **same name and type** in the task that PRODUCES it and the task that CONSUMES it. Example: producer task emits `latitude: number` but consumer task reads `latitude: number|null` → block it: "divergent shape in the contract, it'll break at the merge." This catches the divergent shape *in the plan*, not at merge time — the failure mode the contract block exists to prevent. Skip this check entirely when single-repo (no contract block).

This is **not** a heavy semantic analyzer. It's a handful of lookups against existing data.

**Run `/analyze` in a subagent — and loop.** Dispatch a subagent with the spec's REQ-IDs, the plan's matrix/Source fields, and context.md's enforced invariants; it returns the list of inconsistencies (phantom REQs, uncovered REQs, boundary violations). You stay the orchestrator: you read its verdict and fix the plan, you don't run the checks in your own context. Then **loop** — after you fix the design/tasks, dispatch a *fresh* `/analyze` subagent to re-verify against the corrected plan. Repeat until a run comes back clean. A single pass can miss an inconsistency introduced *by* the fix; the loop is what guarantees convergence.

**Same persistence as the spec's clarification loop:** the plan does not finish while an inconsistency is open. The moment a subagent reports one, write a marker into `plan.md` now — `[ANALYSIS: T-4 violates the domain→infra boundary from context.md]` — so the state survives a dead session. Resolve it (fix the design/task, remove the marker), re-run the subagent, and only finish when an `/analyze` run returns zero findings and zero `[ANALYSIS]` markers remain. The gate at the start of `sdd:implement` is the safety net for the dropped-session case.

## Scoped concern remediation — opt-in, never automatic

The codebase map's `concerns/` are machine-parseable (`id`, `severity`, `anchor: path:line`). When planning, look at the `Files` your tasks will touch and find concerns whose anchor falls inside them. **Present those to the user** — "this feature touches CONCERN-007 (high): unhandled timeout. Include remediation?" If accepted, add it as a separate task with its own REQ-ID-like origin (`Source: CONCERN-007`).

Never auto-inject. Never pull global debt (CORS, /docs) that the feature doesn't touch — that belongs in its own backlog. The filter is the point: surface the 1-2 concerns relevant to where the user is already working, with a human gate, and leave the rest alone. When a remediation task later closes, `sdd:codebase diff` removes that concern — closing the loop.

## Finishing — the handoff

When the matrix is complete (every REQ covered) and `/analyze` is clean (zero `[ANALYSIS]` markers):
1. Confirm `plan.md` has both sections, stable task IDs, the coverage matrix, and pre-computed batches.
2. Hand off explicitly: "Plan ready at `docs/specs/<feature>/plan.md`, N tasks in M batches. Next: `sdd:implement <feature>`."

## What this skill must not do

- **No implementation.** No writing the actual code or tests — that's `sdd:implement`. The plan describes; it doesn't build.
- **No finishing with an uncovered REQ or open `[ANALYSIS]`.** The matrix and the analyze loop are the guarantees; bypassing them defeats the whole proof chain.
- **No self-declared `[P]`.** Parallelizability is computed from the file matrix, always.
- **No design that contradicts an enforced invariant.** If context.md says the lint forbids it, the plan can't propose it.
- **No reading the codebase into your own context.** Delegate analysis to subagents and synthesize their digests. The main agent orchestrates; it doesn't accumulate file bytes.
- **No task without executable Steps.** Metadata alone isn't enough — the Steps must be detailed enough that `sdd:implement` runs them without analyzing. Thin Steps push analysis downstream, which is the bug this design exists to prevent.
- **No language drift.** Inherit `lang:` for narration; `plan.md` stays English.

## Common mistakes

| Mistake | Fix |
|---|---|
| Designing an architecture from scratch | Anchor to `context.md` + the relevant codebase docs. Brownfield: conform, don't reinvent. |
| A task with no test in `Verification` | Every task names the test that proves its requirement. No test → it's not in the proof chain. |
| A REQ with no task in the matrix | The plan FAILS. List the uncovered REQs and stop — don't proceed half-covered. |
| Declaring `[P]` by hand | Compute it from `Files` intersection + the hot-list. A self-declared `[P]` collides at merge time. |
| Calling cross-repo tasks `[P]` because they share no file | File isolation is only the intra-repo axis. Cross-repo, the contract is the coupling: `[P]` only if it's frozen, and still `Depends on:` producer for merge order. Parallel to implement ≠ ordered to merge. |
| Re-deciding which repo a task lands in | `Repo:` is inherited from the spec's REQ→repo map. The plan carries it; it doesn't choose it. |
| Skipping `L-0` on a multi-repo feature | Every multi-repo feature opens with one scaffold task per repo (clone → worktree+branch off the registry's base → push → draft PR). The chain needs somewhere to land. |
| Treating `[!]` and `[P]` as the same flag | `[!]` is review granularity; `[P]` is file isolation. Orthogonal. A task can be critical *and* parallelizable, or neither. |
| Running a heavy semantic analysis for `/analyze` | Three list-checks against the spec, the matrix, and context.md's enforced invariants. Lean by design. |
| Auto-adding every concern as a task | Scoped + opt-in only: concerns whose anchor touches the feature's files, presented for the user to accept. |
| Re-deriving decisions the spec already settled | The spec's decision log is input, not a starting point. Build what it decided. |
| Reading the codebase into your own context | Dispatch subagents to analyze; synthesize their digests. You orchestrate, you don't accumulate file bytes. |
| Tasks with only metadata, no Steps | Write per-task TDD Steps detailed enough that the executor runs them blind. Thin Steps push analysis into `sdd:implement`. |
| Running `/analyze` once, inline | Run it in a subagent and loop until a run is clean — a fix can introduce a new inconsistency the first pass misses. |
