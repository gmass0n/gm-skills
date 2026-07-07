# Convention detection

Run these per repo. NEVER hardcode — detect every time. `<owner>/<repo>` and branch names come from the repo.

## Detection commands

```bash
# Tag prefix: bare "2.1.0" vs "v2.1.0"
git tag --sort=-creatordate | head -10

# Last release tag (the most recent semver tag)
LAST_TAG=$(git tag --sort=-v:refname | grep -E '^v?[0-9]+\.[0-9]+\.[0-9]+$' | head -1)

# Production branch = branch the last tag lives on (NOT necessarily main)
git branch -r --contains "$LAST_TAG"      # commonly origin/prod, origin/main, origin/master

# Development branch
git branch -r | grep -E 'origin/(dev|develop)$'

# Version file (first match wins)
ls package.json pyproject.toml Cargo.toml composer.json VERSION 2>/dev/null

# Naming style — read the last release verbatim and replicate
gh release view "$LAST_TAG" --json name,tagName,body
git log -1 --format='%s' "$LAST_TAG"~0          # release commit subject style (approx)
gh pr list --state merged --search "release in:title" --json title --limit 5

# Changelog style: "## [Unreleased]" vs "## vX.Y.Z"
head -20 CHANGELOG.md

# Language of artifacts (English vs pt-BR)
gh release view "$LAST_TAG" --json body --jq '.body' | head -20
```

## Version field per manifest

| File | Field |
|---|---|
| `package.json` | `"version": "X.Y.Z"` |
| `pyproject.toml` | `version = "X.Y.Z"` — edit whichever table the repo populates: `[project]` (PEP 621) or `[tool.poetry]`. Grep first; if both carry a version, edit both. |
| `Cargo.toml` | `version = "X.Y.Z"` (`[package]`) |
| `composer.json` | `"version": "X.Y.Z"` |
| `VERSION` | bare `X.Y.Z` |

Bump ONLY this field. Do NOT run install or modify lockfiles.

## Compare-URL format

`https://github.com/<owner>/<repo>/compare/<prev-tag>...<new-tag>` — use the detected tag prefix on both sides (bare or `v`).

## SemVer bump from Conventional Commits

Scan the delta commit subjects:
- any `!` suffix or `BREAKING CHANGE` → **major** (`X+1.0.0`)
- else any `feat:` / `feat(...)` → **minor** (`X.Y+1.0`)
- else (`fix` / `chore` / `docs` / `refactor` / `perf` only) → **patch** (`X.Y.Z+1`)

Always present the computed bump + reasoning and WAIT for explicit user confirmation before tagging.

## First-release fallback (no prior tags/releases)

When the repo has never released, detection has nothing to read. Use these defaults and CONFIRM with the user before proceeding:

| Convention | Default |
|---|---|
| Tag prefix | bare `X.Y.Z` |
| Production branch | `prod` if it exists, else `main` |
| Release branch | `release/vX.Y.Z` (with `v`) |
| Release commit | `release(vX.Y.Z): add changelog and increase package version` |
| PR title | `[RELEASE] Version X.Y.Z` |
| Release title | `X.Y.Z` |
| First version | `1.0.0` (or as the user specifies) |
| Language | English |

## Gotchas

- `git fetch --tags` may print `! [rejected] <tag> (would clobber existing tag)` — harmless, the branch still fetches.
- Local refs can be stale — verify `origin/<dev>` and `origin/<prod>` HEADs via the GitHub API before computing the delta.
- A draft release's `tag_name` may show `untagged-<hash>` via the API until the release is published — expected; it binds to the real tag on publish.
- If the tag already exists when publishing a draft, GitHub uses the existing tag and ignores `target_commitish`.
