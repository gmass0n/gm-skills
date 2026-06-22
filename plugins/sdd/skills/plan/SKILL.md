---
name: plan
description: Use to turn an approved spec into an executable implementation plan — Phase 2 (DESIGN + TASKS) of the SDD workflow, after sdd:spec and before sdd:implement. Reads docs/specs/<feature>/spec.md plus the codebase map, then writes a single docs/specs/<feature>/plan.md with the technical design (anchored to real project patterns, every decision tied to a REQ-ID) and an atomic task breakdown carrying stable IDs, a requirement→task→test coverage matrix, dependency graph, and pre-computed batches. Trigger whenever the user wants to plan a feature, design the implementation, break work into tasks, or says "plan this", "how do we build X", "make the task list" — and always after a spec exists. The plan is the contract sdd:implement executes against, so it will not finish while any requirement is uncovered or any decision contradicts the project's enforced invariants.
---

# SDD — Plan (Phase 2: Design + Tasks)

## What this phase produces

One file: `docs/specs/<feature>/plan.md`, with two sections in one document:
- **Design** — the technical HOW that satisfies the spec, anchored to the project's real patterns.
- **Tasks** — an atomic, ordered breakdown, each task tied back to the requirements it serves and the test that proves it.

One file, one approval gate. Design and tasks live together because you refine them against each other — splitting them would force you (the same person, same session) through two gates for one decision. The conceptual distinction stays (two sections), the ceremony doesn't.

**`plan.md` is the contract `sdd:implement` executes.** Almost all of the workflow's intelligence lives in the Tasks section: the IDs, the dependency graph, the file sets, the coverage matrix. If the plan encodes those well, the implementer can be simple and safe. If it encodes them poorly, nothing downstream works. So spend the effort here.

This phase reads `spec.md` and the codebase map; it writes only `plan.md`.

## Preconditions — refuse rather than build on sand

Before doing anything, check the spec:
- **No `spec.md`** → refuse: "Não há spec para `<feature>`. Rode `sdd:spec <feature>` primeiro."
- **`spec.md` has any open `[NEEDS CLARIFICATION]` (status: draft)** → refuse: "A spec tem clarificações pendentes — volte ao `sdd:spec` para fechá-las antes de planejar." This is the safety-net half of the clarification gate: in the normal flow it never fires (the spec left `sdd:spec` clean), but if a session died mid-interview and the user jumped straight here, this catches it.

**Inherit the language.** Read `lang:` from the spec's frontmatter. The whole `plan.md` is written in that language — never re-detect, never switch. The spec owner chose it.

## Ground the design in the real codebase

A plan that invents its own architecture is worse than useless in a brownfield — it produces code that fights the existing patterns. Read `docs/codebase/context.md` and load **only** the docs its "Carregamento por tarefa" pointers name for this kind of feature (selective loading — don't read all 30 docs). The context.md also gives you the **Invariantes enforced**, which the design must respect and which `/analyze` will check against at the end.

If a relevant codebase doc looks stale (its `sources` changed after its `generated:` date), recommend `sdd:codebase diff` before planning — otherwise the design anchors to a false picture.

For external libraries, use Context7 to confirm current APIs rather than guessing.

## The Design section

The HOW, in technical terms, satisfying the spec. Keep it anchored and traceable:
- **Cite the real patterns** it follows, by path: "segue o adapter de [integrations/seru-client.md], a regra de camada de [layers/presentation-layer.md]". The design conforms to what exists; it doesn't reinvent.
- **Every design decision points to a REQ-ID** it serves. A decision that serves no requirement is scope creep — cut it or question whether the spec is missing something.
- **Carry forward the spec's decision log.** The "Decisões e restrições da entrevista" from the spec are constraints here, not things to re-derive. If the spec said "SSE, not WebSocket", the design builds SSE.
- Cover: solution overview, components and where they live, the end-to-end flow, key trade-offs, and the files the change will touch.

## The Tasks section — where the intelligence lives

Break the work into **atomic tasks**. Each task has stable metadata that downstream phases parse mechanically. Follow `templates/plan.template.md` for the exact shape:

```
### T-3  [!]
- Origem: REQ-1, REQ-2          # which requirements this task serves (traceability)
- Depende de: T-1               # dependency graph edge (or "—")
- Arquivos: src/.../seru-notification.adapter.ts, src/.../tests/...spec.ts
- Verificação: teste `should emit order.status on change` cobre o critério de REQ-1
- Lote: L-2                     # pre-computed (see batching below)
```

- **`T-<n>` IDs are stable** — they're how `sdd:implement` targets a single task (`sdd:implement T-3`) and how the matrix traces coverage. Never renumber.
- **`Verificação` names the test**, and that test must cover an acceptance criterion from the spec. This is the link that makes "everything is tested" mechanical rather than hopeful.

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

**Same loop + persistence as the spec's clarification loop:** the plan does not finish while an inconsistency is open. The moment you find one, write a marker into `plan.md` now — `[ANALYSIS: T-4 viola boundary domain→infra de context.md]` — so the state survives a dead session. Resolve it (fix the design/task, remove the marker), and only finish when zero `[ANALYSIS]` markers remain. The gate at the start of `sdd:implement` is the safety net for the dropped-session case.

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
