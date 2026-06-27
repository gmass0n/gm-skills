# Archetype: `integrations/<lib-or-service>.md`

One document per **external lib/service the runtime actually wires in** — not every transitive dependency of the manifest. Cross the manifest with real `import`/adapter code: the entry only exists if there is real wiring.

Examples: database client (mongoose, prisma, pg), logger (pino, winston), tracer (dd-trace, otel), auth/crypto libs (jsonwebtoken, bcrypt), HTTP doc generators (swagger, scalar), health probes (terminus), hardening (helmet), CLI framework.

These docs are **short** — operational reference, not an essay.

## Language and shape

English. Library names, paths and symbols verbatim.

## Doc structure

```markdown
# <lib-name>

## What it is / what it's for
<1–3 sentences. Its concrete role IN THIS repo, not its own README description.>

## Where it is in the code
<List of real paths: the adapter, the registration/module point, the config, the VO/type
that validates the format. Each item is a clickable path in backticks with 1 line.>

## Rules and patterns
<What the repo decided about using it. Guaranteed behaviors, deliberate
limitations, decisions ("there is no needsRehash", "RS256 only", "CSP in mode X").>
```

When the integration is rich (generates a contract, has its own decorators, exposes a route), it can grow with `## How it works` showing a real excerpt. Keep the focus: it is a reference for "how THIS is wired here".

## Where to look in the repo

- The manifest (`package.json` deps) → candidates.
- `rg "from '<lib>'"` or the lib's import → where it is really used.
- The registration module/file (provider, factory, `forRoot`, init).
- Related config (env vars, validation schema).

## Rules

- Only what is wired into the runtime gets in. Build/test dev-deps don't become an integration doc (they become, at most, an item in `conventions/quality-gates`).
- "Where it is in the code" is the heart — real paths the reader opens.
- If the repo has no relevant external integrations, **don't invent**. `integrations/` gets a short note in the README, not fabricated entries.
- Cross-link to the pattern/layer that consumes the integration (e.g.: `mongoose.md` → `mapper-pattern.md`, `port-and-adapter-pattern.md`).
