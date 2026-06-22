# Agent Dispatch Contract

How to fan out the discovered document set to parallel agents. **One agent → one document.** Dispatch concurrently — all in one message when the plan is ≤~10 docs, otherwise in back-to-back full batches of ~10 (never batch by directory). See SKILL.md Step 2 for the batching rule.

Each document belongs to one of the six directories (or is `overview.md`), and each directory has an **archetype template** under `templates/docs/` (overview uses `templates/overview.template.md`). The agent **reads its archetype file** — that file carries the section structure, size target, where-to-look guidance, and good/bad examples for that kind of doc.

The `context.md` router is **not** dispatched. You assemble it yourself, last, from the files that exist plus the Step 1 enforcer inventory (see `templates/context.template.md`).

## Full-mode agent prompt

Fill the bracketed values per document. Reuse the same recon summary and doc plan for every agent.

```
You are mapping ONE document of a codebase reference map. Output is PT-BR.

Repository root: [absolute path]
Target document: docs/codebase/[DIR/FILE].md
Archetype to follow (READ THIS FIRST): [skill]/templates/docs/[archetype].template.md
   (overview.md uses [skill]/templates/overview.template.md)
Size target: ~[N–M] linhas (from the archetype table in SKILL.md — a target, not a hard cap).
Today's date (for the `generated:` frontmatter): [YYYY-MM-DD]   (use verbatim; do not compute)

Recon summary (shared facts, already gathered — do not re-derive):
[paste: detected stack signals, top-level tree to depth 3, build/CI/lint config presence]

Full doc plan (every file that will exist — use to cross-link siblings by relative path):
[paste the flat list of all planned files across the six dirs + overview]

Your job:
0. Open the doc with YAML frontmatter: title, area, generated (the date above),
   and sources (the globs/paths THIS doc describes — the honest staleness basis).
1. Read your archetype file in full. It defines the section structure, where to look,
   and good/bad examples for THIS kind of document.
2. Produce ONLY docs/codebase/[DIR/FILE].md following that archetype, in PT-BR.
3. Open the body with a `## Regra-de-ouro` — the central invariant in 1–3 sentences.
   EXCEPTION — `concerns/` docs: they are evaluative, NOT descriptive. Do not write a
   Regra-de-ouro or Anti-padrões. Open at the findings. Each finding is machine-parseable:
   `id: CONCERN-NNN`, `severidade:` enum (alta|média|baixa), `ancora: caminho:linha`
   (ALWAYS with line number), `descricao`. Evidence bar is strict: no anchor → cut it. An
   honestly short concerns doc beats an invented one. Follow concern.template.md exactly.
4. Derive every claim from real code. Show real excerpts with the file path as a
   `// caminho` comment. Sample 5–10 representative files for your area — do NOT read
   the whole tree.
5. When a lint/type/CI rule ENFORCES your concept, cite the real config snippet.
   "Imposto por X" beats "convencionou-se que".
6. Close with `## Anti-padrões` (lista com ❌) when real violations are plausible.
   (Skip for `concerns/` — see step 3.)
7. Cross-link relevant sibling docs by relative path, e.g.
   [mapper-pattern.md](../patterns/mapper-pattern.md). Use the doc plan to know what exists.
8. Observed reality, not ideals. Include inconsistencies. Omit empty sections —
   do not invent content to fill space.
9. Stay near the size target. The canonical style is lean — one real code excerpt
   beats three paragraphs of prose. If you're way over, you're padding; cut it. If the
   topic genuinely needs more, the doc set is probably missing a sibling doc — note that.
10. Prefer ripgrep/ast-grep over grep. Exclude node_modules, dist, build, .git, vendor.

Constraints:
- Do NOT write files. Return the finished markdown as your result.
- Do NOT touch any other document or any path outside your target.
- Do NOT assume project conventions are rules — map what the code shows.

Return: the complete PT-BR markdown body of docs/codebase/[DIR/FILE].md.
```

## Diff-mode agent prompt

Dispatched only for docs the change affects (routing table in SKILL.md). A changed file may update an existing doc or justify a brand-new one — for a new doc, omit the "read the existing doc" step and follow the full-mode prompt instead.

```
You are updating ONE document of an existing codebase reference map after a change.
Output is PT-BR.

Repository root: [absolute path]
Target document: docs/codebase/[DIR/FILE].md (already exists — read it first)
Archetype (for section structure + rules): [skill]/templates/docs/[archetype].template.md
Today's date: [YYYY-MM-DD]   (use verbatim; do not compute a date)

Changed files in this branch (vs base), relevant to this doc:
[paste the relevant subset of `git diff --name-only BASE...HEAD`]

Your job:
1. Read the existing docs/codebase/[DIR/FILE].md.
2. For each relevant changed file, read it and update the affected sections — new
   patterns/services/rules, corrected stale facts, new real excerpts with paths.
3. Refresh the `generated:` frontmatter date to the date above; keep `title`/`area`/`sources`
   (extend `sources` if the doc now describes new paths).
4. Append (create if absent) a `## Changelog` section at the end with one line:
   `- [YYYY-MM-DD]: <resumo conciso do que esta atualização mudou>`
5. Keep everything else byte-identical. Keep the archetype's section order.
6. Cite real file paths. Evidence only. Cross-links stay valid.

Constraints:
- Do NOT write files. Return the full updated markdown as your result.
- Do NOT touch other documents or unrelated sections.

Return: the complete updated PT-BR markdown body of docs/codebase/[DIR/FILE].md.
```

## Integration after agents return (you do this)

1. Write each returned body to its `docs/codebase/<DIR>/<FILE>.md` (you persist; agents cannot). Create the directories as needed. Never write outside `docs/codebase/` (the root `README.md` is off-limits).
2. Assemble `context.md` from the final file list + the Step 1 enforcer inventory — `templates/context.template.md`. **Full mode:** always. **Diff mode:** only if a doc was added/removed, or an enforcer config changed.
3. Write `overview.md` (full mode: always; diff mode: only if affected).
4. Verify: every planned file exists (`test -e`); 2–3 cited paths per doc resolve; every `context.md` link points to a real file and every real file is linked; every "Invariantes enforced" line names a real mechanism path; every concern is machine-parseable (id + severidade enum + ancora:linha).
5. Report: mode, files written/updated, the final doc plan, enforcers vs invariant lines, any unverifiable claim.
```
