---
name: plan
description: Turn an approved spec into an executable implementation plan — Phase 2 (DESIGN + TASKS) of the SDD workflow, after sdd:spec and before sdd:implement. Use when the user wants to "plan this", design the implementation, break work into tasks, or asks "how do we build X". The main agent orchestrates: it dispatches subagents to read the codebase map, investigate exact files, and confirm external APIs, then synthesizes — never reading raw source itself. Writes docs/specs/<feature>/plan.md with a design anchored to real patterns (every decision tied to a REQ-ID) and atomic tasks carrying stable IDs plus per-task TDD Steps detailed enough that sdd:implement runs without re-analyzing, a REQ→task→test coverage matrix, dependency graph, and pre-computed batches; a /analyze subagent loops until clean. Won't finish while any requirement is uncovered or any decision contradicts an enforced invariant.
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
- **No `spec.md`** → refuse: "Não há spec para `<feature>`. Rode `sdd:spec <feature>` primeiro."
- **`spec.md` has any open `[NEEDS CLARIFICATION]` (status: draft)** → refuse: "A spec tem clarificações pendentes — volte ao `sdd:spec` para fechá-las antes de planejar." This is the safety-net half of the clarification gate: in the normal flow it never fires (the spec left `sdd:spec` clean), but if a session died mid-interview and the user jumped straight here, this catches it.

**Inherit the language.** Read `lang:` from the spec's frontmatter. The whole `plan.md` is written in that language — never re-detect, never switch. The spec owner chose it.

## You orchestrate; subagents analyze

You are the **orchestrator** of this phase. You don't read the codebase into your own context — you dispatch subagents to analyze, and you synthesize their returns into `plan.md`. The synthesis (design, tasks, matrix, batches) is yours; the reading is delegated. This keeps your context lean and is the main token win of the phase: raw file bytes and doc dumps stay in the subagents.

What goes to subagents, run in **parallel** when independent:
- **Reading the codebase map** — one `Explore` subagent loads the docs `context.md`'s "Carregamento por tarefa" names for this feature (selective — not all 30) and returns the patterns, layer rules, and **Invariantes enforced** as a digest.
- **Investigating specific files** — the exact signatures, line ranges, and trechos each task's Steps will need. This is the analysis that gets *cached as Steps* so `sdd:implement` never re-analyzes.
- **Confirming external APIs** — a subagent uses Context7 to verify current library APIs rather than you guessing.

You receive digests, not raw files, and weave them into the design and the Steps.

If a relevant codebase doc looks stale (its `sources` changed after its `generated:` date), recommend `sdd:codebase diff` before planning — otherwise the design anchors to a false picture.

## The Design section

The HOW, in technical terms, satisfying the spec. Keep it anchored and traceable:
- **Cite the real patterns** it follows, by path: "segue o adapter de [integrations/seru-client.md], a regra de camada de [layers/presentation-layer.md]". The design conforms to what exists; it doesn't reinvent.
- **Every design decision points to a REQ-ID** it serves. A decision that serves no requirement is scope creep — cut it or question whether the spec is missing something.
- **Carry forward the spec's decision log.** The "Decisões e restrições da entrevista" from the spec are constraints here, not things to re-derive. If the spec said "SSE, not WebSocket", the design builds SSE.
- Cover: solution overview, components and where they live, the end-to-end flow, key trade-offs, and the files the change will touch.

## The Tasks section — where the intelligence lives

Break the work into **atomic tasks**. Each task has two parts: stable **metadata** that downstream phases parse mechanically, and an ordered list of **Steps** that the executor follows literally. Follow `templates/plan.template.md` for the exact shape:

```
### T-3  [!]
- Origem: REQ-1, REQ-2          # which requirements this task serves (traceability)
- Depende de: T-1               # dependency graph edge (or "—")
- Arquivos: src/.../seru-notification.adapter.ts, src/.../tests/...spec.ts
- Verificação: teste `should emit order.status on change` cobre o critério de REQ-1
- Lote: L-2                     # pre-computed (see batching below)

- [ ] **Step 1 (RED):** escrever teste failing `should emit...`; rodar `yarn test ...` → ver falhar
- [ ] **Step 2 (GREEN):** implementar <trecho só se não-óbvio>; rodar → ver passar
- [ ] **Step 3 (REFACTOR):** limpar; rodar → verde
- [ ] **Step 4 (COMMIT):** `feat(...): ...`
```

- **`T-<n>` IDs are stable** — they're how `sdd:implement` targets a single task (`sdd:implement T-3`) and how the matrix traces coverage. Never renumber.
- **`Verificação` names the test**, and that test must cover an acceptance criterion from the spec. This is the link that makes "everything is tested" mechanical rather than hopeful.

### Steps are where the analysis you do here gets cached for the executor

This is the heart of the division of labor. **`sdd:implement` does not analyze the codebase — it only executes.** That is only possible if *you* do all the analysis now and write it down as Steps concrete enough to follow blind:

- Every task carries **Steps** in checkbox form (`- [ ]`), in strict TDD order: RED (write the failing test, run it, watch it fail) → GREEN (minimal code, run it, watch it pass) → REFACTOR → a final atomic COMMIT. One RED→GREEN cycle per `Verificação` criterion.
- Each Step names the **file** it touches and the **exact command** to verify it (`yarn test <spec>`, `yarn tsc --noEmit`). The executor never has to guess what to run.
- Embed a **code trecho only when the edit is non-obvious** — a new signature, a conditional spread, a SQL fragment. A trivial edit (add a field to a DTO) is one descriptive line, no code block. Over-embedding bloats the plan; under-embedding forces the executor to analyze. Judge per edit.
- The test is the rule of thumb for "detailed enough": if a fresh subagent with only this task's block (no map, no repo tour) could carry out the Steps and land the commit, the task is complete. If it would have to go read source to know *how*, the Step is too thin — that missing analysis is your job, here, not the executor's.

Doing the analysis once, here, and caching it as Steps is also the token win: the executor loads a ~500-token task block instead of re-reading the codebase map per task.

### The two orthogonal axes — don't conflate them

A task has two independent properties. Keeping them separate is what makes the plan honest:

- **`[!]` criticality** — should this run alone, with its own review, because it's risky (touches business rules, security, a migration, a shared kernel)? This is about *review granularity*. You mark it: heuristically (auto-flag the risky kinds) and the user can override in the plan.
- **`[P]` parallelizability** — *computed, not declared.* A task is `[P]` only if its `Arquivos` set does not intersect any other task's in the same wave **and** none of its files are in the "hot list" — the shared-DI files every slice touches here (`*.module.ts`, `env.schema.ts`, domain contracts). You derive `[P]` from the file matrix; you don't let a task claim it.

Why computed: a self-declared `[P]` is a lie waiting to happen — two "independent" tasks that both edit `notification.module.ts` will collide. The file matrix is the truth. In this coupled brownfield, genuinely parallel tasks are rare, and that's fine — serial is the default downstream anyway.

### Pre-compute the batches

From the dependency graph and the two axes, group tasks into `L-<n>` batches:
- A `[!]` critical task → its own **solo batch** (runs, tests, validates before the next).
- `[P]` tasks with no file intersection → may share a **parallel batch**.
- Everything else → sequential.

Assign each task its `Lote: L-<n>`. The implementer uses these; it doesn't recompute them.

## The coverage matrix — the spine of the proof chain

The user's strongest requirement: *the flow proves everything is built and tested, nothing is skipped.* The matrix is how. Build a table inside `plan.md`:

```
| REQ   | Tasks      | Teste(s) que provam |
|-------|------------|---------------------|
| REQ-1 | T-3        | should emit order.status on change |
| REQ-2 | T-4        | should not enqueue while disconnected |
| REQ-3 | T-3, T-5   | should auto-reconnect on drop |
```

**The plan FAILS if any REQ-ID has no task with a named test.** Don't quietly proceed — list the uncovered requirements and stop. Every REQ from the spec must appear in this table with at least one task and one test. This is the mechanical guarantee that the spec can't be half-implemented. The matrix lives *inside* `plan.md` — it is not recomputed from the spec at runtime; it's the durable record the closing gate in `sdd:implement` walks.

## /analyze — the consistency loop before finishing

Coverage (the matrix) proves every requirement has a task. It does **not** prove the tasks are *consistent* with the spec and the project's rules. `/analyze` is that second check — and it's deliberately lean. Three list-checks, using artifacts you already have:

1. Every REQ-ID referenced in a task's `Origem:` actually exists in the spec (no phantom requirements).
2. Every REQ-ID in the spec appears in the matrix (this is the coverage check, restated).
3. **No design decision contradicts an "Invariante enforced" from `context.md`.** Example: a task proposes `domain/` importing `@nestjs/common` → context.md says eslint-boundaries forbids it → block it: "vai falhar no lint, fora do padrão." This is where the flow stays on-pattern — by reading what the project actually enforces, not a hand-written rulebook.

This is **not** a heavy semantic analyzer. It's three lookups against existing data.

**Run `/analyze` in a subagent — and loop.** Dispatch a subagent with the spec's REQ-IDs, the plan's matrix/Origem fields, and context.md's enforced invariants; it returns the list of inconsistencies (phantom REQs, uncovered REQs, boundary violations). You stay the orchestrator: you read its verdict and fix the plan, you don't run the checks in your own context. Then **loop** — after you fix the design/tasks, dispatch a *fresh* `/analyze` subagent to re-verify against the corrected plan. Repeat until a run comes back clean. A single pass can miss an inconsistency introduced *by* the fix; the loop is what guarantees convergence.

**Same persistence as the spec's clarification loop:** the plan does not finish while an inconsistency is open. The moment a subagent reports one, write a marker into `plan.md` now — `[ANALYSIS: T-4 viola boundary domain→infra de context.md]` — so the state survives a dead session. Resolve it (fix the design/task, remove the marker), re-run the subagent, and only finish when an `/analyze` run returns zero findings and zero `[ANALYSIS]` markers remain. The gate at the start of `sdd:implement` is the safety net for the dropped-session case.

## Scoped concern remediation — opt-in, never automatic

The codebase map's `concerns/` are machine-parseable (`id`, `severidade`, `ancora: caminho:linha`). When planning, look at the `Arquivos` your tasks will touch and find concerns whose anchor falls inside them. **Present those to the user** — "esta feature toca CONCERN-007 (alta): timeout não tratado. Incluir remediação?" If accepted, add it as a separate task with its own REQ-ID-like origin (`Origem: CONCERN-007`).

Never auto-inject. Never pull global debt (CORS, /docs) that the feature doesn't touch — that belongs in its own backlog. The filter is the point: surface the 1-2 concerns relevant to where the user is already working, with a human gate, and leave the rest alone. When a remediation task later closes, `sdd:codebase diff` removes that concern — closing the loop.

## Finishing — the handoff

When the matrix is complete (every REQ covered) and `/analyze` is clean (zero `[ANALYSIS]` markers):
1. Confirm `plan.md` has both sections, stable task IDs, the coverage matrix, and pre-computed batches.
2. Hand off explicitly: "Plano pronto em `docs/specs/<feature>/plan.md`, N tasks em M lotes. Próximo: `sdd:implement <feature>`."

## What this skill must not do

- **No implementation.** No writing the actual code or tests — that's `sdd:implement`. The plan describes; it doesn't build.
- **No finishing with an uncovered REQ or open `[ANALYSIS]`.** The matrix and the analyze loop are the guarantees; bypassing them defeats the whole proof chain.
- **No self-declared `[P]`.** Parallelizability is computed from the file matrix, always.
- **No design that contradicts an enforced invariant.** If context.md says the lint forbids it, the plan can't propose it.
- **No reading the codebase into your own context.** Delegate analysis to subagents and synthesize their digests. The main agent orchestrates; it doesn't accumulate file bytes.
- **No task without executable Steps.** Metadata alone isn't enough — the Steps must be detailed enough that `sdd:implement` runs them without analyzing. Thin Steps push analysis downstream, which is the bug this design exists to prevent.
- **No language drift.** Inherit `lang:` from the spec.

## Common mistakes

| Mistake | Fix |
|---|---|
| Designing an architecture from scratch | Anchor to `context.md` + the relevant codebase docs. Brownfield: conform, don't reinvent. |
| A task with no test in `Verificação` | Every task names the test that proves its requirement. No test → it's not in the proof chain. |
| A REQ with no task in the matrix | The plan FAILS. List the uncovered REQs and stop — don't proceed half-covered. |
| Declaring `[P]` by hand | Compute it from `Arquivos` intersection + the hot-list. A self-declared `[P]` collides at merge time. |
| Treating `[!]` and `[P]` as the same flag | `[!]` is review granularity; `[P]` is file isolation. Orthogonal. A task can be critical *and* parallelizable, or neither. |
| Running a heavy semantic analysis for `/analyze` | Three list-checks against the spec, the matrix, and context.md's enforced invariants. Lean by design. |
| Auto-adding every concern as a task | Scoped + opt-in only: concerns whose anchor touches the feature's files, presented for the user to accept. |
| Re-deriving decisions the spec already settled | The spec's decision log is input, not a starting point. Build what it decided. |
| Reading the codebase into your own context | Dispatch subagents to analyze; synthesize their digests. You orchestrate, you don't accumulate file bytes. |
| Tasks with only metadata, no Steps | Write per-task TDD Steps detailed enough that the executor runs them blind. Thin Steps push analysis into `sdd:implement`. |
| Running `/analyze` once, inline | Run it in a subagent and loop until a run is clean — a fix can introduce a new inconsistency the first pass misses. |
