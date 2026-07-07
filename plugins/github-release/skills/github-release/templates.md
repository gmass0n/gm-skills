# Release templates

Exact shapes for each artifact. Replace `<...>`. Keep the audience split: CHANGELOG = technical, release notes = friendly. Default language is English (detect from prior releases and match).

---

## 1. CHANGELOG.md block (technical — for developers)

Prepend this above the previous `## v<prev>` entry (or convert an existing `## [Unreleased]` heading into `## v<X.Y.Z>` if the repo uses that style).

```markdown
## v<X.Y.Z>

<One- to two-sentence technical summary of the release theme.>

### Added
- **<Feature>** (`<Module/Class>`): <what it does, with exact symbols>.
  - `<Model/Entity>` <field/table changes>.
  - `<EVENT_CLASS>` / `<listener-file.ts>` <behavior>.
  - `<METHOD> <route>` — <auth, pagination, filters>.

### Changed
- `<Symbol/Interface>`: `+field` / `-field` <reason>.

### Fixed
- `<symbol>` <what was wrong → now correct> (<context>).

### Removed
- `<file/table/feature>` <what and why>.

### ⚠️ Breaking changes / Migration notes
- New migrations: `<migration_name>`, ... **Back up before deploying.**
- New env vars: `<VAR>` (<purpose>).
- <Other config/infra required, e.g. S3 bucket, queue>.
```

Migration-notes header by case:
- Breaking release → `### ⚠️ Breaking changes / Migration notes`
- Non-breaking but has migrations/env/infra → `### ⚠️ Migration notes`
- Nothing applies → `### Migration notes` + `- No migration required.`
(A non-breaking additive migration goes under "Migration notes" and does NOT make the bump major.)

Rules:
- Omit empty sections (`Added`/`Changed`/`Fixed`/`Removed`) — but **never** omit Migration notes.
- Every line traceable to a commit/diff. No invented detail.

---

## 2. GitHub release notes (friendly — for end users, DRAFT)

```markdown
<2–3 sentence benefit-led summary. What shipped and why it matters, in plain language. No symbols, no file paths.>

## ✨ New

- **<Feature in plain words>** — <what the user can now do>.

## 📈 Improvements

- <Outcome-focused improvement, e.g. "Faster invoice loading">.

## 🔧 Fixes

- <User-visible fix in plain words>.

## 🗑️ Removed

- <What was removed, plainly>.

**Full Changelog**: https://github.com/<owner>/<repo>/compare/<prev-tag>...<X.Y.Z>
```

Rules:
- Omit any empty section.
- NO symbols / paths / migration names / internal class names.
- NO "For administrators" section unless the user explicitly asks.
- NO AI-generated / co-author footer.
- Outcome language: "Reports load faster" not "Optimized SQL query".

---

## 3. PR body (release → prod)

```markdown
Prepares release **v<X.Y.Z>** (<minor|patch|major>): bumps `<manifest>` (<prev> → <X.Y.Z>) and adds the `CHANGELOG.md` entry.

No code changes — version and changelog only. The features are already on `<dev>`.

## Included in this release

### Added
- ...
### Changed
- ...
### Fixed
- ...
### Removed
- ...

### ⚠️ Migration notes
- <migrations / env / infra, or "No migration required.">

The `<X.Y.Z>` tag has been created on this release branch. The GitHub release will be published after merge.
```

Rules:
- PR title in detected style. FCX default: `[RELEASE] Version <X.Y.Z>`.
- Body language matches artifacts (English default).
- NO AI footer.

---

## 4. Commit message (release commit)

Detected from the repo's last release commit. FCX default:

```
release(v<X.Y.Z>): add changelog and increase package version
```

No body needed. No AI/co-author footer unless the repo's history shows one.

---

## 5. Next-steps-to-production message (always end with this)

```markdown
## Release v<X.Y.Z> prepared — <repo>

| Artifact | Value |
|---|---|
| Release branch | `release/v<X.Y.Z>` @ `<sha>` |
| Tag | `<X.Y.Z>` @ `<sha>` |
| PR → <prod> | <url> (mergeable: <clean|CONFLICTS>) |
| Draft release | <releases-url> |

### Next steps to production
1. Review the draft release notes: <releases-url>
2. Review & approve the PR: <pr-url>
3. <If conflicts: resolve via the chosen approach (rebase/merge/cherry-pick) — see options above.>
4. Merge the PR into `<prod>`.
5. Decide tag placement: keep on the release commit, or move to the prod merge commit (match prior releases — check where `<prev-tag>` sits).
6. Publish the draft GitHub release.
7. Deploy `<prod>` (<run migrations / configure infra if Migration notes apply>).
```

---

## 6. Finalize plan (FINALIZE mode — show before the single confirmation)

```markdown
## Finalize release v<X.Y.Z> — <repo>

Everything is prepared. This will make it live:

| Action | Detail |
|---|---|
| Merge PR #<num> → `<prod>` | method: `<merge\|squash\|rebase>` (matches prior releases), mergeable: `<clean>` |
| Tag `<X.Y.Z>` | <stays on release commit `<sha>` \| moves to prod merge commit> |
| Publish release | draft <releases-url> → public |

Order: **merge first, then publish.** Both are irreversible.
Proceed? (yes / no)
```

---

## 7. Go-live report (FINALIZE — always end with this)

```markdown
## Release v<X.Y.Z> is live — <repo>

| Artifact | Value |
|---|---|
| PR → <prod> | <url> — **MERGED** |
| Tag | `<X.Y.Z>` @ `<sha>` |
| Release | <releases-url> — **published** |

### Deploy
- Deploy `<prod>`.
- <Run migrations / configure infra if Migration notes apply — else "No migration required.">
```
