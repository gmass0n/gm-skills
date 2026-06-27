# Reference: the lessons layer (self-improving error memory)

Read this when wiring lesson WRITE points into the closing gate, or when `sdd:spec`/`sdd:plan` READ confirmed lessons. The split is the whole design: **you (the LLM) judge — read the failure, phrase a one-line lesson, ground it to a source. `scripts/lessons.js` owns all bookkeeping** — IDs, dedup, recurrence, promotion, quarantine, pruning, the budget-capped render. Never count recurrence or assign an ID by hand; call the script.

The script lives at `skills/implement/scripts/lessons.js` (a single copy — `sdd:plan` invokes it by path, the same way the debug skill invokes `debug-server.js`). State lives in the **target project** at `docs/codebase/lessons/` (versioned, travels with the repo):

```
docs/codebase/lessons/
├── lessons.json   ← canonical machine state (NEVER hand-edit)
└── lessons.md     ← rendered playbook, read-only, regenerated on every write
```

Why `docs/codebase/` and not `docs/specs/`: `docs/specs/` is git-ignored in these repos — lessons there would vanish on a fresh clone, defeating a persistent memory. `docs/codebase/` is versioned and is already the project's durable, project-wide knowledge. **Guard:** `sdd:codebase`, when it regenerates the map, must NOT touch `docs/codebase/lessons/` — that subtree is owned by `sdd:implement`, not the mapper.

## WRITE — exact points and order in the closing gate

Two skills write lessons: **`sdd:implement`'s closing gate** (the signals below) and **`sdd:debug`'s closing gate** (`root_cause` only — see "sdd:debug" at the end of this section). Both call the same script, same grounding gate.

The implement closing gate (`implement/SKILL.md` › "The closing gate") has multiple exit points. Emit each `add` **in the order the gate reaches the signal**, not batched at the very end — a dead session must not lose the signals already produced. Each `add` is one shell call:

```
node <skill>/scripts/lessons.js add --signal <s> --lesson "<one-line lesson>" --source <grounding> [--feature <name>] [--scope <CONCERN-007|role>]
```

Sequence, walking the gate:

1. **Walking the matrix** — a REQ whose test isn't green / has no locatable assertion → `--signal ac_gap` the moment you find it.
2. **Mutation sensor (item A)** — a surviving mutant → `--signal surviving_mutant`.
3. **Spec-anchored check (item B)** — an AC too vague to anchor, or an assertion that doesn't match the outcome → `--signal spec_precision_gap`.
4. **Build/lint/typecheck gate failed** → `--signal gate_fail`.
5. **`// SPEC_DEVIATION` markers collected** → one `--signal spec_deviation` per distinct deviation.

A **clean PASS writes nothing** — lessons come from real failures only.

#### sdd:debug — `root_cause` from a confirmed hunt

`sdd:debug`'s closing gate (F8) emits **one** `root_cause` lesson **only when** the hunt confirmed a cause by runtime **and** F5 found the cause was *shared* — N callers had the same bug, or the fix had to respect an enforced invariant the original code broke. That's the durable, project-local pattern worth carrying forward (e.g. *"the shared X mapper drops nulls from upstream Y — guard at the mapper, not per-caller"*). `--source` is the shared `file:line` the fix landed on; `--scope` is ideally the touched `CONCERN-NNN`/role. A point bug with a single caller and no invariant in play writes nothing — it's not a reusable lesson. This is the same knowledge F8 already offers to push to `sdd:codebase diff`; the lesson is the lighter-weight, automatically-loaded half of that.

### Grounding gate (non-negotiable)

`add` **refuses** (exit ≠ 0) without `--source`: *"a lesson with no grounding is an opinion, not a lesson."* `--source` is the evidence — a `file:line`, a `grep:<pattern>`, a `gate:<name>`. No source → no lesson.

### Signal map (1:1 with the script's `SIGNALS`)

| `--signal` | origin in this suite |
|---|---|
| `surviving_mutant` | item A — sensor found a test that doesn't kill its mutant |
| `ac_gap` | closing gate — REQ with no `file:line` / no green test |
| `spec_precision_gap` | item B — vague AC / assertion not matching the outcome |
| `spec_deviation` | a `// SPEC_DEVIATION` marker the gate collected |
| `gate_fail` | build / lint / typecheck gate failed |
| `root_cause` | `sdd:debug` closing gate — a runtime-confirmed bug whose root cause spanned **N callers** (or violated an enforced invariant); the lesson is the pattern, grounded at the shared `file:line` |

### `--scope` — your differential over a map-less tool

`--scope` is an **opaque string** to the script (stdlib, no map access — no enforcement on write). Best-effort validation happens on READ: `sdd:spec` warns if a loaded scope matches no `CONCERN-NNN` or repo role in the map. **Ideal scope = a `CONCERN-NNN` id or a repo role from `docs/codebase/`** (e.g. `--scope CONCERN-007` ties the lesson to a known concern) — but it is not validated at write time. This anchoring is something a map-less tool can't do.

### Scope boundary (what a lesson IS)

Capture a lesson about **project-local execution** — a mistake about *this repo's code* (a guard that was missing, a contract that drifted, a test that didn't discriminate). **Never** write a lesson that is an opinion about the SDD process itself — that is a skill version bump, never self-authored into a project's memory.

## READ — exact points

Confirmed lessons only (`list --status confirmed`) load as guidance. Never load inside a loop — once, up front.

- **`sdd:spec`** — once, right after *"Before the interview — ground yourself"* (which already reads `context.md`), **before** the interview loop: `node <skill>/scripts/lessons.js list --status confirmed`. NEVER inside the question loop (it would reload per question).
- **`sdd:plan` (Large features)** — fold the `list --status confirmed` into the **same `Explore` subagent that already reads the codebase map**, so no extra subagent is opened.

### Budget (recurring cost — explicit cap)

`list` returns **top-N by recurrence desc (N=10)**; the rest collapses to an overflow line (`(+M more lessons in lessons.json)`). This keeps the load < ~40k even past 100 lessons. `--selftest` asserts `list --status confirmed` respects the cap. `window_days=45` + auto-prune contain candidates; the top-N cap contains the confirmed set.

## Lifecycle (owned by the script)

```
candidate    → 1st sighting of a lesson (1 feature)
confirmed    → recurs in a 2nd DISTINCT feature (promote_threshold=2)  ← only these load as guidance
quarantined  → was loaded yet the error recurred → `penalize`; 2× (quarantine_threshold=2) ⇒ quarantined
pruned       → a candidate that didn't recur within window_days=45 is auto-dropped on `prune`
```

Dedup is **exact-after-normalization** (lowercase, punctuation stripped) — no embeddings. Near-duplicate phrasings counting as distinct is an accepted, documented limitation (ponytail: zero-dep over a vector index).

## Verification

`node scripts/lessons.js --selftest` (stdlib `assert`, runs in a temp dir): grounding refuses without source; an unknown signal refuses; a normalized duplicate doesn't duplicate; a 2nd distinct feature promotes candidate→confirmed; `penalize` 2× quarantines; `list` respects the top-N cap and reports overflow; `prune` drops a candidate outside the window and keeps the in-window one. Exit 0 = OK. Run it before relying on the script.
