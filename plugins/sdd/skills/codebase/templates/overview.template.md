# Template: `overview.md`

The bird's-eye view of the system. The reader opens this file first and leaves knowing: what system this is, what stack runs, how it is divided, and how a request travels through the code end to end. Per-lib operational details live in `integrations/` — here only the panorama, with links.

## Language and shape

English. Identifiers, paths, library names verbatim.

## Doc structure

```markdown
# Overview

<1 paragraph: what the system is, what kind of service, entrypoints (HTTP/CLI/worker),
base architectural style. Points to integrations/ for the lib detail.>

## Stack summary
<Table: Concern → Current integration → Canonical reference (link to integrations/*
or conventions/* or patterns/*). One line per concern: HTTP server, CLI,
persistence, observability, health, docs, auth/crypto, ENV validation, quality.>

## <Aliases / module resolution>   (when the repo uses path aliases)
<Real block from tsconfig/jsconfig paths. Usage rule: when to use alias vs relative.>

## <High-level structure / bounded contexts>
<Depth 1–2 tree of src/ with 1 comment per entry. Shows the macro division:
entrypoints, modules/contexts, shared.>

## End-to-end <protocol> flow   (one block per entrypoint: HTTP, CLI…)
<Vertical ASCII diagram of a real request's path: Guard → Controller →
Mapper → Facade → Bus → Handler → Domain → Adapter → DB → back. Annotate each step
with the real class and its folder. It is the most valuable doc for onboarding — it shows how
the layers talk in a concrete request.>

## Non-negotiable principles
<Numbered list of the system's invariants, each one verifiable: "Domain does not import
framework — verified by <lint>", "Coverage ≥ X% blocking on pre-push". Each
principle points (implicitly or explicitly) to the doc that details it.>
```

## Where to look in the repo

- Entrypoints: `main.*`, `index.*`, `console.*`, `cmd/`, `manage.py`.
- Manifest + alias config.
- The `src/` tree at depth 1–2.
- ONE complete real flow: follow a route from the controller to the database and back. That trace is the heart of the overview.
- The quality gates (coverage, blocking lint) → they become the non-negotiable principles.

## Rules

- The end-to-end flow is the most important part. Trace a real path, with real class names and folders. Don't generalize.
- Each line of the stack table points to the canonical doc — the overview does not duplicate `integrations/`, it references it.
- Non-negotiable principles are **verifiable**, not slogans. If there is no enforcement, it is not non-negotiable — it is an aspiration; downgrade it.
- Keep it high level. Implementation detail belongs in the child docs.
