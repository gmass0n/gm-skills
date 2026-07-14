---
name: codebase
description: Build or refresh the evidence-based codebase map.
disable-model-invocation: true
---

# SDD — Codebase map

Create the canonical, evidence-based map under `docs/codebase/`. The map lets a later human-invoked `$sdd:spec` or `$sdd:plan` load one relevant document instead of rediscovering the repository.

## Preconditions

- Work from the target repository and its current code, never assumptions.
- Keep generated prose in English. Cite every claim with a real path; call a rule enforced only when its enforcement mechanism is also cited.
- Never read, list as an orphan, or change `docs/codebase/lessons/`; it belongs to `$sdd:implement`.

## Choose the mode

- **Full** is the default for a new map or an explicit full request. Re-derive the complete map from code and prune stale map documents.
- **Diff** is the default when a map already exists and the request is ambiguous. Scope from the merge base and change only affected documents.

For full mode, discover the actual stack, imports, layers, tests, CI/lint enforcers, and document set before writing. For diff mode, compare changed paths against each document's `sources` frontmatter; regenerate only stale documents, append a dated changelog entry, and refresh `context.md` only when its catalog or routing changes.

## Produce the map

1. Build `context.md` and `overview.md`, plus only the discovered documents in `architecture/`, `layers/`, `patterns/`, `integrations/`, `conventions/`, and `concerns/`.
2. Use the matching template for every document. `context.md` is assembled last from the final document set and contains enforced invariants with mechanisms, stack, navigation by intent, per-task loading pointers, and a catalog. Load [the templates](templates/) when creating or changing the corresponding artifact.
3. Keep `context.md` lean, make `overview.md` narrative-only, and put each concern behind concrete evidence such as `path:line`, a confirmed TODO, or a proven test gap.
4. Reconcile root `CLAUDE.md` and `AGENTS.md` only as thin routers: both point to `docs/codebase/context.md`, require selective loading, name full/diff `$sdd:codebase`, and link the actual testing convention when a test suite exists. Do not touch the root `README.md`.

## Verify and hand off

- Every generated document has valid YAML frontmatter (`title`, `area`, `generated`, `sources`) and its cited paths exist.
- `context.md` catalogs every generated document and every router link resolves.
- In full mode, no stale map document remains outside `lessons/`; in diff mode, untouched documents remain byte-identical.
- Report changed map and router files. When the map is ready, tell the user to invoke `$sdd:spec <feature>` manually; direct to `$sdd:plan <feature>` only when that feature already has a ready spec.

Do not implement product code or write outside `docs/codebase/` except the two root routers above.
