# Archetype: `patterns/<pattern>.md`

One document per **recurring tactical pattern** — evidenced by **≥2 occurrences** in the code. A single file is not a pattern; don't document it.

Examples of patterns: entity, value-object, mapper, facade, dependency-injection, error-handling, env-validation, helper, thin controller, CLI command, scope-validation, module-wiring.

## Language and shape

English. Identifiers, paths and library names verbatim.

## Doc structure

```markdown
# <Pattern name> Pattern

## Golden rule
<The pattern's invariant in 1–3 sentences. For mapper: "Mappers live in `mappers/`
inside the I/O layer, are classes with static methods, stateless, no DI.
Cross-boundary is forbidden.">

## <Methods/canonical form>   (when the pattern has a recurring API)
<Table or list of the convention: method names by intent, typical signature,
where each one appears.>

## Example(s)
<One or more REAL code excerpts with `// path`. If the pattern appears in
different contexts (e.g. HTTP mapper vs Mongoose mapper vs JWT mapper), show
one of each. Right below, "Note:" with the points the example proves.>

## <Enforcement>   (when a lint/types/CI enforces it)
<Real snippet of the rule. Cross-link to the conventions doc.>

## Anti-patterns
<List with ❌. Each one is a real temptation that violates the pattern.>
```

## Where to look in the repo

- `grep`/`rg` by the pattern name or by file suffix (`*.mapper.ts`, `*.vo.ts`, `*.handler.ts`).
- Confirm ≥2 occurrences before creating the doc.
- The lint rule that governs the pattern (cross-boundary composition, forbidden instantiation, etc).

## Rules

- The example is the documentation. Prose with no code doesn't prove the pattern.
- "Note:" after the code turns the example into teaching — list what the excerpt proves (no `new`, no DI, composition only inside the boundary, etc).
- If the pattern has context variations, show one of each — that's what stops the reader from over-generalizing.
- Cross-link to the `layers/*.md` of the layer that hosts the pattern and to the `conventions/*` that enforces it.
