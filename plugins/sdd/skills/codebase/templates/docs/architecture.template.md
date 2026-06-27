# Archetype: `architecture/<decision>.md`

One document per **macro architectural decision or style** that the code actually commits to. Don't document styles the repo *could* use — only the ones imposed in the structure.

Signals that justify a doc here: dependency rule between layers, ports & adapters (abstraction + swappable concrete implementation), CQRS (command/query/handler/bus split), bounded contexts (self-contained modules), monorepo layout.

## Language and shape

English. Identifiers, paths and library names stay verbatim.

## Doc structure

```markdown
# <Style name>   (e.g. Clean Architecture, Hexagonal Architecture, CQRS)

## Golden rule
<The central invariant in 1–3 sentences. For Clean Arch: "Dependency always points
inward." If there is an ASCII dependency-flow diagram that fits, include it.>

## Mapping to folders   (when the style materializes in folders)
<Table: layer/element → folder → what it can import. Real repo paths.>

## How each part isolates the next   (the proof)
<REAL code excerpts, each with `// path/to/file`, showing the rule
in action. For each layer/element, a short example that proves the isolation.
Show the allowed import AND the forbidden one.>

## Symptoms of violation
<List of imports/structures that betray a break of the style. "`import X` in Y → wrong.">

## Why this rigidity   (optional, but valuable)
<Testability, swappability, onboarding. Why the rule exists, not just what it is.>
```

## Where to look in the repo

- The folder structure repeated across modules → reveals the layering style.
- Abstract classes (ports) + concrete implementations (adapters) + the wiring point (`provide/useClass`, factory, container).
- Command/Query/Handler/Bus → CQRS.
- Boundary lint config / import rules → **the proof that the style is enforced, not aspirational.** Cite it and cross-link to the `conventions/` doc that details the enforcement.

## Rules

- Cross-link to `conventions/*-boundaries.md` (or equivalent) — that's where the enforcement lives.
- Cross-link to the `layers/*.md` this style organizes.
- Every claim cites a real path. A diagram with no code under it proves nothing.

## Example (extracted from a NestJS repo — adapt to the target stack)

```markdown
# Clean Architecture

## Golden rule

**Dependency always points inward.** Outer layers know inner ones;
inner ones do not know outer ones.

Presentation ──► Application ──► Domain ◄── Infrastructure

## How each layer isolates the next

### Domain isolates technology
\`\`\`ts
// src/modules/identity/domain/entities/user.entity.ts
export class User {
  // ZERO imports from NestJS, Fastify, Mongoose.
}
\`\`\`

Reinforced by `eslint-plugin-boundaries` — see [eslint-boundaries.md](../conventions/eslint-boundaries.md).

## Symptoms of violation
- `import { MongooseUserRepository }` in `presentation/` → wrong.
- `import '@nestjs/common'` in `domain/` → wrong.
```
