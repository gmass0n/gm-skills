---
name: codebase
description: Build or refresh the evidence-based codebase map.
disable-model-invocation: true
---

# SDD — Codebase map

*You have already been invoked; these instructions are now active context, not a pending action. Do not call the Skill tool to invoke this skill again.*

Create the canonical, evidence-based map under `docs/codebase/`. The map lets a later human-invoked `$sdd:spec` or `$sdd:plan` load one relevant document instead of rediscovering the repository.

## Preconditions

- Work from the target repository and its current code, never assumptions.
- Keep generated prose in English. Cite every claim with a real path; call a rule enforced only when its enforcement mechanism is also cited.
- Never read, list as an orphan, or change `docs/codebase/lessons/`; it belongs to `$sdd:implement`.

## Choose the mode

- **Full** is the default for a new map or an explicit full request. Re-derive the complete map from code and prune only verified stale map documents.
- **Diff** is the default when a map already exists and the request is ambiguous. Resolve and record the real merge base; if it is unavailable, run full mode or stop rather than guessing. Change only affected documents.

For full mode, discover the actual stack, imports, layers, tests, CI/lint enforcers, and document set before writing. Build a final document plan before delegation; one focused task owns one document. A failed required document blocks completion and its partial output is removed or quarantined before `context.md` is assembled; an optional document may be omitted only with recorded evidence and is never linked. For diff mode, compare changed paths against each document's `sources` frontmatter; regenerate only stale documents, refresh `generated`/`sources`/dated changelog and resolved concerns, and refresh `context.md` only when its catalog or routing changes.

## Produce the map

1. Build `context.md` and `overview.md`, plus only the discovered documents in `architecture/`, `layers/`, `patterns/`, `integrations/`, `conventions/`, and `concerns/`.
2. Use the matching template for every document. `context.md` is assembled last from the final document set and contains enforced invariants with mechanisms, stack, navigation by intent, per-task loading pointers, and a catalog. Load [the templates](templates/) when creating or changing the corresponding artifact.
3. Keep `context.md` lean, make `overview.md` narrative-only, and put each concern behind concrete evidence such as `path:line`, a confirmed TODO, or a proven test gap.
4. In full mode, create or reconcile root `CLAUDE.md` and `AGENTS.md` as thin mirrored routers; in diff mode touch them only when routing/catalog changes. Both point to `docs/codebase/context.md`, require selective loading, name full/diff `$sdd:codebase`, and link the actual testing convention when a test suite exists; compare their normalized routing content before completion. Do not touch the root `README.md`.

## Verify and hand off

- Every generated document has valid YAML frontmatter (`title`, `area`, `generated`, `sources`); every factual or normative claim has a declared source and anchor `path:line`, and 2–3 per-document checks are a sanity check rather than a substitute. Every `context.md` invariant names a real enforcement mechanism; every concern has a stable id, severity, and `path:line` evidence.
- Reconcile discovery to output: every runtime integration/import, test suite, CI/Docker gate, real layer/recurring pattern, and enforcer has its required map entry. An omission is valid only for an evidenced obsolete or out-of-scope item; a discovered undocumented item blocks completion. `context.md` catalogs every generated document and every router link resolves.
- In full mode, prune only `docs/codebase/**/*.md` outside the verified final document plan when evidence proves their sources are obsolete or absent; preserve uncertain documents and always exclude `lessons/`. In diff mode, untouched documents remain byte-identical.
- Report changed map and router files. When the map is ready, tell the user to invoke `$sdd:spec <feature>` manually; direct to `$sdd:plan <feature>` only when that feature already has a ready spec.

Do not implement product code or write outside `docs/codebase/` except the two root routers above.
