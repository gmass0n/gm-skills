# Archetype: `concerns/<risk-area>.md`

One document per **risk area** of the code. Unlike the other five directories, `concerns/` is **evaluative, not descriptive**: it records what is wrong/fragile, not how the code works. That's why it **does not open with a `Golden rule`** — it opens straight at the findings.

Typical areas (generate only the ones with a real finding): `security-gaps.md`, `perf-hotspots.md`, `fragile-areas.md`, `tech-debt.md`. Don't create an area file without at least one evidenced finding.

## Language and shape

English. Paths, symbols and markers verbatim.

## Directory golden rule (does not go in the doc — it's for you)

**Strong evidence or nothing.** Every finding needs a real anchor: `path:line`, a `TODO`/`FIXME`/`HACK` confirmed in the code, a proven absence of a test, an out-of-date dependency. A concern without an anchor = speculation = cut it. This is the directory where the temptation to invent is highest — resist. An honestly short `concerns/` is worth more than an inflated one.

## Frontmatter (required)

```yaml
---
title: <Risk area>
area: concerns
generated: <date passed by you>
sources:
  - <the files/globs where this area's findings live>
---
```

## Doc structure

Each finding is **machine-parseable** — this is what differentiates this fork. `sdd:plan` ingests concerns by filtering on the `anchor`: it crosses the files the feature will touch against each finding's `anchor` and only brings in the relevant ones (opt-in, with a human gate) as remediation tasks. Prose is not filterable; that's why a stable `id`, a `severity` enum and an anchor **with a line number** are mandatory.

```markdown
# <Risk area>   (e.g. Security Gaps, Performance Hotspots, Fragile Areas, Tech Debt)

<1 sentence about the scope of this area. If the sweep found nothing relevant:
"No relevant <area> finding with evidence in the current code." and STOP — don't invent.>

## <Concise finding>          (one `##` section per finding, title = the problem itself)
- id: CONCERN-NNN          # stable; don't reuse numbers of removed findings
- severity: high           # exact enum: high | medium | low
- anchor: path/to/file.ts:NN   # ALWAYS with :line; list extra points if the finding repeats
- description: <the problem in one line — what is wrong>
- evidence: <the observed excerpt/marker/fact: the real TODO, the fragile code, the missing test>
- impact: <what can break / leak / degrade, concrete>
- suggestion: <optional, 1 line — only if obvious. Don't turn it into backlog grooming.>
```

> The field block is machine-read: keep the keys exact (`id`, `severity`, `anchor`, `description`, ...) and the `severity` inside the enum. An `Anchor:` without `:line` or a severity written in prose breaks `sdd:plan` ingestion.

## Where to look in the repo

- `rg -n "TODO|FIXME|HACK|XXX|@deprecated"` → debt declared by the team itself.
- Business-rule files without a co-located `*.spec`/`*.test` → missing coverage in a critical area.
- `eslint-disable`, `@ts-ignore`, `any` at sensitive points → type/lint escapes.
- Security: hardcoded secret, missing input validation at an entrypoint, authz checked in the wrong place, weak crypto/no rehash. **Only record what you see in the code** — don't run an external scanner or invent a CVE.
- Perf: N+1, loop over I/O, missing index/pagination where the data grows.
- Manifest: deps with an out-of-date major, an unmaintained package.

## Rules

- **Severity (enum) and id on every finding.** It's what makes the doc actionable by a human (triage) and by a machine (`sdd:plan` ingestion).
- **Observed, not imagined.** "This repo could have a problem with X" is not a finding. "`auth.ts:42` trusts `req.headers` without validating" is.
- No findings in an area → don't create the file. No findings anywhere → `concerns/` gets a single `tech-debt.md` with the note "no relevant findings", and the README records it.
- Cross-link to the descriptive doc of the area when useful (`fragile-areas.md` → `patterns/mapper-pattern.md`), but concern and description live separately on purpose.
- **Don't duplicate the other docs.** A naming inconsistency is `conventions/`, not a concern. A concern is a risk, not a style divergence.

## Volatility (matters for diff mode)

Concerns disappear when the code is fixed. In **diff mode**, when touching an area:
- Remove the finding the diff resolved (don't leave a dead concern). This includes the case where a `sdd:plan` remediation task (tracked as `Source: CONCERN-NNN`) closed the finding — remove the `CONCERN-NNN` and record it.
- Add what the diff introduced, with a new `id` (don't reuse the number of a removed one).
- Record in the doc's `## Changelog` what changed and why (`- [date]: removed CONCERN-007 (stream timeout), fixed in <commit/file>`).
