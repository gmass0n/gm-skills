# Archetype: `layers/<layer>-layer.md`

One document per **layer the project actually has**. Read the folder convention of a representative module and generate one doc per existing layer — don't impose a 4-layer model on a repo that has 2. Layer names follow the repo (`domain`/`application`/`infrastructure`/`presentation`, or `models`/`services`/`views`, or whatever it is).

## Language and shape

English. Identifiers, paths and library names verbatim.

## Doc structure

```markdown
# <Layer name> Layer

## Golden rule
<What this layer CAN and CANNOT import/do, in 1–3 sentences. For a domain:
"Pure TypeScript: no framework/ORM import. Allowed imports: domain itself
+ shared.">

<If there is a lint rule that enforces this, paste the real snippet right here.>

## Layer folders
<Tree of the real subfolders of this layer in a module, with 1 line per subfolder.>

## <Main elements>   (one section per element type of the layer)
<For each type (entities, value-objects, ports / handlers / adapters / controllers…):
a REAL code excerpt with `// path`, and the rule it exemplifies. List the
existing elements of the type with 1 line each. Cross-link to the pattern doc that
details the element: "Full pattern in [entity-pattern.md](../patterns/entity-pattern.md)".>

## Anti-patterns
<List with ❌. What looks like it belongs in the layer but violates it.>
```

## Where to look in the repo

- The folder tree of ONE representative module (depth 2–3 inside the layer).
- The imports at the top of the layer's files → reveal what it knows.
- The boundary lint rule that restricts the layer → the proof of the golden rule.
- 5–10 representative files of the layer. Don't read them all.

## Rules

- A layer's golden rule is about **allowed dependencies**. Start there.
- Each element type points to its `patterns/*.md` — the layer doc gives the panorama, the pattern doc gives the detail.
- Don't duplicate the pattern doc. Here: "what elements exist and what the layer allows". There: "how to build one".
- Anti-patterns come from plausible and real violations, not from a generic list.
