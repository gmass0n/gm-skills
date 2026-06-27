# Archetype: `conventions/<family>.md`

One document per **convention family** of the repo. The highest-value ones are the **mechanical** ones — enforced by lint/types/CI/hooks — because they turn "we try to" into "the build fails".

Typical families: key-conventions (aliases, ENV, exceptions, mappers, commits — a summary of the agreements), naming-conventions, testing-conventions, quality-gates (coverage, hooks, thresholds), eslint-boundaries (or the stack's equivalent import-rules).

## Language and shape

English. Identifiers, paths, rule names verbatim.

## Doc structure

```markdown
# <Convention name>

## Golden rule
<The convention in 1–3 sentences. For boundaries: "lint makes the architecture
mechanical: layer separations become a lint error, not good manners.">

## <Configuration / types / real rules>
<For ENFORCED conventions: paste the real config snippet (eslint.config, ruff.toml,
jest.config, husky hook, CI step). The config IS the documentation. For naming/structure
conventions: table or list of observed rules with an example of each.>

## How to read a failure   (for conventions with enforcement)
<Show a real error message and how to fix it. "import of infra in a presentation
mapper → go through the handler's Result.">

## <How to extend>   (optional — when adding something requires touching the config)
<E.g.: new adapter → register in boundaries/elements + symmetric rules.>

## Anti-patterns
<List with ❌. Bypass with a disable-comment, rule without alignment, forgetting to
classify a new subfolder, etc.>
```

## Where to look in the repo

- `eslint.config.*`, `.eslintrc*`, `ruff.toml`, `.editorconfig`, `tsconfig.json` (paths/strict).
- `jest.config.*` / `vitest.config.*` → coverage thresholds, test organization.
- `.husky/`, `lefthook.yml`, `.github/workflows/` → CI/pre-push gates.
- `package.json` scripts (`lint`, `test`, `--max-warnings 0`).
- Naming patterns observed in 5–10 files.

## Rules

- For enforced conventions, **paste the real rule** — don't paraphrase. The config snippet proves the convention is law.
- "How to read a failure" is gold: the reader gets here precisely when the build broke.
- Cross-link from the `architecture/*` and `patterns/*` TO this doc — it's here that their enforcement is detailed.
- Naming/structure: document what the code does, including inconsistencies. Don't invent the ideal.

## Testing is a dedicated family — never a stray paragraph

`testing.md` is always its own doc when the repo has any suite (don't fold it inside quality-gates). Beyond stack/commands/coverage, **state explicitly** the three rules humans forget — it's to make them law that the map exists:

1. **Spec co-location** — where the spec lives *relative to the file it tests*, at the repo's real granularity. Read 5–10 source→spec pairs from different sub-layers and prove it with a real path. E.g.: spec lives in `tests/` inside the **own** sub-layer (`dtos/tests/`, `mappers/tests/`, `http/tests/`), never in a generic `tests/` of the layer above.
2. **Per-artifact coverage** — which artifacts *must* have a co-located spec (e.g. every dto/mapper/controller). If a real artifact is missing a spec, that becomes a finding in `concerns/`.
3. **TDD stance** — if the repo declares test-first anywhere (testing.md, CLAUDE.md, AGENTS.md, contributing), record it as policy, not a suggestion. If a hook/CI makes it mandatory, it also enters `context.md` › Enforced invariants.

`## Anti-patterns` of `testing.md` names the literal mistake: `❌ mapper/dto/controller without spec`, `❌ spec outside the tests/ of its own sub-layer`.

### Example of `testing.md` (NestJS repo with per-sub-layer mirror)

```markdown
# Testing

## Golden rule
Every dto/mapper/controller has a spec, and the spec lives in `tests/` INSIDE the file's
own sub-layer — `dtos/tests/`, `mappers/tests/`, `http/tests/` —, never in a
generic `tests/` of the layer above. Development is test-first (TDD).

## Co-location (per-sub-layer mirror)
\`\`\`
http/dtos/list-notifications.query.dto.ts
http/dtos/tests/list-notifications.query.dto.spec.ts      // same dir + tests/
http/mappers/notification-http.mapper.ts
http/mappers/tests/notification-http.mapper.spec.ts
\`\`\`

## Anti-patterns
- ❌ mapper/dto/controller without spec.
- ❌ dto/mapper spec outside the `tests/` of its own sub-layer (e.g. in a stray `http/tests/`).
```

## Example (extracted from a NestJS repo — adapt to the target stack)

```markdown
# ESLint Boundaries Enforcement

## Golden rule
`eslint-plugin-boundaries` makes the architecture mechanical: layer separations are
enforced as lint errors, not good manners.

## Observed rules (all the real `disallow`)
\`\`\`ts
{ from: { type: 'domain' },
  disallow: { to: { type: ['presentation','infrastructure'] } },
  message: 'Domain layer cannot import presentation or infrastructure.' }
\`\`\`

## How to read a failure
\`\`\`
presentation/http/mappers/issue-token.mapper.ts:5
  error  Presentation mappers cannot import from infrastructure.
\`\`\`
→ Fix: go through the handler's Result.

## Anti-patterns
- ❌ Bypass with `// eslint-disable-next-line boundaries/dependencies`.
```
