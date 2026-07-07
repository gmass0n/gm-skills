---
name: github-release
description: Use when preparing a new GitHub release for a single repository — bumping the version, generating a changelog and draft release notes, opening the release PR, and checking it for conflicts — OR when finalizing an already-prepared release: publishing the draft and merging the release PR into prod. Triggers on "criar release", "preparar release", "nova versão", "release notes", "bump version", "gerar changelog", "publicar release", "subir release", "finalizar release", "aprovar release", "mergear o PR da release", "subir a tag", or running the release flow per repo.
---

# github-release

## Overview

Prepares a complete, standards-compliant GitHub release for **one repository**: detects the repo's own conventions, computes what changed since the last release, writes a **technical CHANGELOG** and **user-friendly draft release notes** (two distinct audiences), cuts the release branch, opens the release PR, and reports conflict status + next steps to production.

**Core principle:** The skill ASSERTS only what it can PROVE from the repo's own git history and diffs. No invented features, no cross-repo claims, no guessed conventions. Every destructive action that rewrites shared history STOPS for confirmation.

**Two modes, auto-selected by state (Phase 2):**
- **PREPARE** (default) — nothing exists yet for the target version → run Phases 0–9: compute delta, write artifacts, cut branch, open PR, push tag, create draft. Stops at the draft.
- **FINALIZE** — the release is already fully prepared (branch + PR + tag + **draft** release all present) → run Phase 10: publish the draft and merge the PR into prod. This is the human "go live" step the PREPARE flow deliberately leaves manual.

**Two-layer output (never merge them):**
- **CHANGELOG.md** → technical, for developers: symbols, file paths, migration names, endpoint signatures, event classes. Keep a Changelog format.
- **GitHub release notes** → friendly, for end users: benefit-led summary, outcome language, no symbols/paths. Always created as **draft**.

## When to Use

- Preparing/cutting a new release for a repo (minor/patch/major).
- Generating release notes + changelog from `dev` for a `release → prod` PR.
- Running the same standardized flow across many repos, one at a time.

- **Finalizing** an already-prepared release: publish the draft + merge the release PR into prod (FINALIZE mode, Phase 10). Triggers on "publicar release", "subir release", "finalizar release", "aprovar release", "mergear o PR da release".

**When NOT to use:**
- Multi-repo coordination in one run (skill is single-repo by design).
- Hotfix straight to prod with no dev branch.

## The Iron Rules

1. **Prove, don't guess.** Every changelog line, migration note, and convention comes from `git`/diff evidence. If you can't prove it from THIS repo, don't write it.
2. **Two audiences, two texts.** Technical CHANGELOG ≠ friendly release notes. Never ship the same prose in both.
3. **PREPARE never publishes.** In PREPARE mode release notes are always DRAFT and the PR is never merged — a human reviews first. Publishing/merging happens ONLY in FINALIZE mode (Phase 10), after the user explicitly confirms.
4. **Force-push is a STOP.** Any action rewriting shared history (rebase + force-push `dev`/`release`, moving a tag) halts and asks first, with a backup ref already created.
5. **Detect before create.** If the release branch/tag/PR/draft already exists → stop, report, ask abort-or-resume — OR, if ALL of them exist and the release is fully prepared, offer FINALIZE (Phase 10). Never silently overwrite.
6. **Migration notes ALWAYS present.** Every release's CHANGELOG and PR body has a Migration notes section (even if "No migration required").
7. **FINALIZE is one gated confirmation.** Merge + publish are irreversible and outward-facing. Show the state table, get ONE explicit confirmation, then merge-then-publish. Never finalize a version whose artifacts you didn't verify present in this run.

## Workflow (PREPARE: Phases 0–9 · FINALIZE: Phase 10)

Create a todo per phase.

### Phase 0 — Inputs & preconditions
- Input: the repo path (or owner/name). Confirm it's a git repo with a remote.
- **Resolve `<owner>/<repo>`** (needed for every `gh`/API call and the compare URL): `git -C <path> remote get-url origin` → parse `owner/repo`. If the input was a bare name with no local clone, ask the user for the path or `owner/repo`. Do not guess the owner.
- `gh auth status` must be logged in (release/PR creation needs it).
- Identify the **development branch** (default `dev`; else `develop`). Identify nothing else yet.

### Phase 1 — Detect repo conventions (auto, per repo)
Run these reads and record results — DO NOT hardcode FCX values:
- **Tag prefix:** `git tag --sort=-creatordate | head` → bare (`2.1.0`) or `v`-prefixed (`v2.1.0`)?
- **Production branch:** `git branch -r --contains <last-release-tag>` → the branch the last tag lives on IS prod (commonly `prod`, `main`, or `master`). The release PR targets THIS branch.
- **Version file:** presence of `package.json` / `pyproject.toml` / `Cargo.toml` / `VERSION` / `composer.json`.
- **Naming patterns** — read the last release to replicate exactly:
  - `gh release view <last-tag> --json name,tagName,body` → release title style (`2.1.0` vs `Version 2.1.0`), body shape, `Full Changelog` link format.
  - `git log` of the last release commit → release commit message style.
  - `gh pr list --state merged --search "release"` → release PR title style.
- **Changelog style:** does `CHANGELOG.md` use `## [Unreleased]` or jump straight to `## vX.Y.Z`? Match it.
- **Language:** read prior CHANGELOG/release bodies → English or pt-BR? Replicate.
- **First-release fallback:** if no prior tags/releases, use the documented defaults in `conventions.md` and CONFIRM them with the user before proceeding.

→ Produce a short detected-conventions summary. Show it. (No confirmation needed yet unless first-release.)

### Phase 2 — Idempotency probe (detect existing artifacts)
For the version you're about to compute, check ALL of:
- local + remote `release/v<X.Y.Z>` branch
- tag `<X.Y.Z>` (with/without prefix per Phase 1)
- open PR with head `release/v<X.Y.Z>`
- GitHub release (draft or published) for that tag

Route by what you find:
- **None exist** → PREPARE. Continue to Phase 3.
- **ALL exist** (release branch + open PR → prod + tag + **draft** release) → the release is fully prepared. Offer **FINALIZE** (jump to Phase 10) — publish + merge. Skip Phases 3–9.
- **Some exist** → STOP. Report a state table. Ask: **abort** or **resume** (resume = skip what exists, complete what's missing).
- **Published (non-draft) release** for that version already exists → check the PR: if still open, offer to merge it (Phase 10, publish already done); if already merged → hard stop: "vX.Y.Z already released and merged — bump higher?"

### Phase 3 — Compute the delta (read-only, raw diffs stay OUT of main thread)
- Sync: `git fetch origin <dev> <prod> --tags` (note `! [rejected] ... would clobber existing tag` is harmless).
- **Verify cloud state, not stale local refs:** confirm `origin/<dev>` HEAD via `gh api repos/<owner>/<repo>/commits/<dev>` (or `mcp__github__list_commits`). Local refs can be stale — always cross-check the remote.
- **New-commit list (changelog source)** — this exact command, everywhere in this skill (always with `--no-merges`):
  ```
  git log --cherry-pick --right-only --no-merges \
    --invert-grep --grep='^release(' --grep='^chore(release)' --grep='^docs(changelog)' --grep='bump version' \
    --format='%H %s' origin/<prod>...origin/<dev>
  ```
  `--cherry-pick --right-only` drops commits whose content already exists in prod (handles a rewritten/squashed dev — the duplicate-SHA trap). `--invert-grep --grep=...` removes release-plumbing commits in the same command (no manual filtering). The remainder is the **delta**; its count is `deltaCount` used in Phase 4.
- If the delta is empty → STOP ("nothing to release; dev == prod").
- **Record the API-verified `origin/<dev>` HEAD sha** — Phase 7 cuts the branch from this exact sha, not from a possibly-stale local ref.

### Phase 4 — Analyze the delta (subagent pipeline; context-protective + economical)
Raw diffs MUST NOT enter the main thread. Subagents read them and return compressed structured facts.

**Scale to size:**
- `N = deltaCount` (the POST-exclusion count from Phase 3, not the raw commit count). `chunks = ceil(N / 8)` (1 agent for ≤8 commits; fan out beyond).
- Dispatch ALL analyze agents **in parallel** (multiple Agent calls in ONE message). Prefer a read-only investigator agent type if available.

Each analyze agent gets ONLY its commit SHAs + exact commands, and returns ONLY this compact schema per commit (terse, no prose, no diff dumps):
```
{ sha, type: feat|fix|refactor|chore|docs|perf|breaking,
  summary,                       # one technical line, what + why
  migrations: [names],           # new DB migration dirs/files
  envVars: [names],              # new env vars
  endpoints: [method+path],      # new/changed routes
  events: [class names],         # new event classes
  schema: [field/table changes],
  removed: [files/features],
  breaking: bool }
```
Agent command budget per commit: `git show --stat <sha>` + targeted `git show <sha> -- <path>` for key files only. No open-ended exploration.

### Phase 5 — Synthesize CHANGELOG + self-verify (single agent, or inline if 1 chunk)
From the merged facts (NOT from re-reading diffs):
- Determine **version bump** by Conventional Commits: any `breaking`/`!` → **major**; else any `feat` → **minor**; else (`fix`/`chore`/`docs` only) → **patch**. Compute `X.Y.Z` from the last release version.
- **Present the bump + reasoning ("3 feat, 1 fix → minor 2.1.1 → 2.2.0") and WAIT for explicit user confirmation before using the version.** (Version is irreversible once tagged.) **Do not cut the branch, bump the manifest, or commit (Phase 7) until the user confirms** — Phases 7–8 are gated on this confirmation.
- Write the technical `## vX.Y.Z` CHANGELOG block (Keep a Changelog: `### Added / Changed / Fixed / Removed`), specific with symbols/migrations/endpoints. See `templates.md`.
- **Always** add a Migration notes section, derived from `migrations[]`/`envVars[]`/`breaking`:
  - Breaking release → header `### ⚠️ Breaking changes / Migration notes`.
  - Non-breaking but has migrations/env/infra → header `### ⚠️ Migration notes`.
  - Nothing applies → `### Migration notes` + `- No migration required.`
  - A non-breaking additive migration still belongs here, but does NOT make the bump major.
- **Adversarial self-verify (folded in, cheap):** for each claimed migration/endpoint/removed file, re-check existence via targeted `git show --stat` grep against the delta. Flag any claim not backed by the diff; drop or fix it. Do NOT re-read full diffs.

### Phase 6 — Friendly release notes (inline, no agent)
Reword the CHANGELOG text already in context (zero new git reads):
- Lead: 2–3 sentence benefit summary.
- Sections: `## ✨ New` / `## 📈 Improvements` / `## 🔧 Fixes` / `## 🗑️ Removed` (omit empty ones).
- Outcome language, NO symbols/paths/migration names/internal class names.
- End with `**Full Changelog**: <compare-url per Phase 1 format>`.
- No "For administrators" section unless the user asks. No AI-generated footer. See `templates.md`.

### Phase 7 — Apply files & cut the release branch
**Gated on the Phase 5 version confirmation — do not start until the user confirmed the version.**
- `git fetch origin <dev>` then `git checkout -B release/v<X.Y.Z> <dev-head-sha>` using the **API-verified `origin/<dev>` HEAD sha recorded in Phase 3** (not a stale local ref).
- Bump ONLY the version field in the detected manifest. Do NOT run install or touch lockfiles. For `pyproject.toml` with both `[project]` and `[tool.poetry]` tables, edit whichever the repo actually populates with a version (grep for the non-placeholder one); if both have it, edit both to stay consistent.
- Prepend the `## vX.Y.Z` block to `CHANGELOG.md` (or convert `## [Unreleased]` if the repo uses it).
- Commit (single release commit), message in the repo's detected style. FCX default:
  `release(v<X.Y.Z>): add changelog and increase package version`
  No AI/co-author footer unless the repo's history shows one.

### Phase 8 — Publish (low-risk, AUTO) — steps 1–4
These are safe (new refs only) — push without extra confirmation:
1. `git push -u origin release/v<X.Y.Z>` (normal push, new branch).
2. Open PR `release/v<X.Y.Z> → <prod>`:
   - Title in detected style. FCX default: `[RELEASE] Version <X.Y.Z>`.
   - Body = the changelog sections + Migration notes, in the artifact language (English by default). NO AI footer.
3. Create tag `<X.Y.Z>` (prefix per Phase 1) on the release branch HEAD; `git push origin refs/tags/<X.Y.Z>`.
4. Create **draft** GitHub release on that tag with the **friendly notes**:
   `gh release create <X.Y.Z> --draft --verify-tag --title "<detected title>" --notes-file <friendly.md>`
   (Draft `tag_name` may read `untagged-...` in the API until published — expected.)

### Phase 9 — Conflict check + next-steps report
- Check PR mergeability: `gh pr view <num> --json mergeable,mergeStateStatus` (or `mcp__github__pull_request_read`). `clean` = good; `dirty`/`CONFLICTING` = conflicts.
- **If conflicts (dev diverged from prod):**
  - This is the divergence case → steps 5–7 (rebase + force-push) may be needed. **STOP.** Do NOT force-push.
  - Diagnose: are the "conflicts" real content or just rewritten history? Check with
    `git log --cherry-pick --right-only --no-merges origin/<prod>...origin/<dev>` and a patch-id/tree compare (`git diff origin/<prod> origin/<dev> --stat`). If dev's content ⊆ prod + delta, conflicts are cosmetic (divergent SHAs).
  - Present the finding + 2–3 resolution approaches with trade-offs:
    - **Rebase dev onto prod** (`git rebase origin/<prod>` on dev) — git auto-skips duplicate commits by patch-id; linearizes dev. Requires **force-push of shared `dev`** → create backup ref `backup/<dev>-pre-rebase-<date>` first; **ask confirmation**.
    - **Merge `--no-ff` dev → prod** — one merge commit, resolve once, huge diff, no history rewrite.
    - **Cherry-pick only the delta onto prod** — cleanest PR, no dev rewrite.
  - **Recommendation when divergence is proven cosmetic** (dev content ⊆ prod + delta): **rebase dev onto prod** is safest and cleanest — git auto-skips the duplicate commits by patch-id, the resulting tree is identical to dev (verify `git diff backup/<dev>-pre-rebase-<date> <rebased-dev> --stat` returns empty), and no real conflicts arise. Still requires confirmation (it force-pushes shared `dev`). If the team forbids rewriting `dev`, fall back to cherry-pick-delta-onto-prod.
  - **Wait for the user to choose. Never force-push without confirmation.**
  - **After a rebase, the release branch and tag must move too** (push-gate steps 6–7): the tag `<X.Y.Z>` was pushed in Phase 8 onto the pre-rebase release HEAD; re-point it (`git tag -f`, force-push) to the rebased release HEAD. The existing **draft** release stays bound to tag `<X.Y.Z>` and will resolve to the new commit on publish (a draft does not pin a commit until published) — no need to recreate the draft; just confirm its notes still match.
- **If clean:** report the green state.
- **Always finish with a next-steps-to-production message** (see template in `templates.md`): branch/tag/PR/draft links, mergeability, and the ordered path: review draft → merge PR to prod → (decide tag placement) → publish release → deploy.

### Phase 10 — Finalize (FINALIZE mode only: publish draft + merge PR)
Reached only from Phase 2's "ALL exist" route. This is the outward-facing "go live" step. **One gated confirmation** (Iron Rule #7).

1. **Re-verify state live** (never trust stale context — the draft/PR may have changed since prepared):
   - PR: `gh pr view <num> --json number,state,mergeable,mergeStateStatus,baseRefName,headRefName` — must be `OPEN`, base = `<prod>`, head = `release/v<X.Y.Z>`.
   - Release: `gh release view <X.Y.Z> --json isDraft,tagName` — must be `isDraft: true`.
   - Tag: `git ls-remote --tags origin <X.Y.Z>` exists.
   - **If PR is not mergeable** (`dirty`/`CONFLICTING`) → STOP. This is the divergence case → route back to Phase 9's conflict handling (rebase/merge/cherry-pick options). Do NOT force-merge.
2. **Detect merge method** — match prior releases: `gh pr view <prev-release-pr> --json mergedBy` won't reveal method reliably, so check the prod branch shape (`git log origin/<prod> --merges -1` → if the last release landed as a merge commit, use `--merge`; if linear, `--squash`; if the team rebases, `--rebase`). Default `--merge` (keeps the release commit + one merge commit, matching FCX history). Confirm with the user if ambiguous.
3. **Detect tag placement** — where does the previous tag sit? `git branch -r --contains <prev-tag>`: if `<prev-tag>` is on the prod merge commit, the tag moves to the merge commit after merge; if it's on the release commit, it stays. Default: **stays on the release commit** (already pushed in Phase 8) — no tag move needed unless prior releases prove otherwise.
4. **Show the finalize plan + get ONE confirmation** (see `templates.md` §6): "Merge PR #<num> into `<prod>` via `<method>`, then publish release `<X.Y.Z>`. Tag stays on `<release-sha>` / moves to merge commit. Proceed?" WAIT for explicit yes.
5. **Execute (order matters — merge first, then publish):**
   - `gh pr merge <num> --<method>` (do NOT pass `--delete-branch` unless prior releases delete the release branch; check first).
   - If tag must move (step 3): re-point `<X.Y.Z>` to the prod merge commit — `git fetch origin <prod>`, `git tag -f <X.Y.Z> origin/<prod>`, `git push origin -f refs/tags/<X.Y.Z>`. This is a **tag move on shared history** → it's a force-push (push gate step 7): back up the old tag ref first (`backup/tag-<X.Y.Z>-<YYYYMMDD-HHMM>`) and it's already covered by this confirmation.
   - `gh release edit <X.Y.Z> --draft=false` (publishes; the draft's notes/tag binding resolve now).
6. **Verify + report:** PR `MERGED`, release `isDraft: false`, tag resolves to the intended commit. Finish with the go-live report (`templates.md` §7): merged PR link, published release link, and the deploy reminder (run migrations / configure infra if Migration notes apply).

## Push gate (memorize)

| Step | Action | Push | Gate |
|---|---|---|---|
| 1 | push `release/vX.Y.Z` | normal | **auto** |
| 2 | open PR → prod | API | **auto** |
| 3 | push tag | normal | **auto** |
| 4 | create draft release | API | **auto** |
| 5 | force-push rebased `dev` | force-with-lease | **STOP + backup + confirm** |
| 6 | re-push rebased `release` | force-with-lease | **STOP + confirm** |
| 7 | move tag to amended/merge commit | force | **STOP + confirm** |
| 8 | merge release PR → prod (FINALIZE) | API | **STOP + confirm (Phase 10)** |
| 9 | publish draft release (FINALIZE) | API | **covered by step 8's confirm** |

Steps 5–7 happen ONLY when dev diverged from prod. Steps 8–9 happen ONLY in FINALIZE mode (Phase 10); they share the single Phase 10 confirmation — merge first, then publish. Always create a backup ref before any rebase/force-push, named `backup/<branch>-pre-rebase-<YYYYMMDD-HHMM>` (date+time, e.g. `backup/develop-pre-rebase-20260619-2034`, so same-day retries don't collide). Never auto-rollback on failure — halt and report state + backup ref + recovery commands.

## Red Flags — STOP

- About to write a changelog line you can't point to a commit/diff for → delete it.
- About to claim a migration/endpoint/env var → grep the diff first; if absent, remove.
- About to put the same prose in CHANGELOG and release notes → split them.
- About to publish (non-draft) a release **during PREPARE** → stop; PREPARE is drafts only. Publishing is FINALIZE-only (Phase 10, gated).
- About to merge the release PR without the Phase 10 confirmation, or before publishing is due → STOP; FINALIZE needs the explicit go-ahead, and merge precedes publish.
- About to FINALIZE a PR that shows conflicts → STOP; resolve via Phase 9 first, never force-merge.
- About to `git push -f` / `--force` on `dev` without confirmation → STOP, backup, ask.
- About to assume `main`/`prod`/`v`-prefix without detecting → run Phase 1.
- About to apply an "FCX default" naming string without first reading THIS repo's last release/PR → detect first; defaults are fallback only.
- About to add "deploy the other repo first" → can't prove from one repo → remove.
- PR shows conflicts and you reach for force-push → STOP, diagnose, present options, confirm.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Used stale local `dev` ref | Verify `origin/<dev>` HEAD via GitHub API before computing delta |
| `tag..dev` listed old release commits | Use the Phase 3 command: `git log --cherry-pick --right-only --no-merges --invert-grep ...` |
| PR targeted `dev` | Release PR targets **prod** (branch holding the last tag) |
| Tag/PR/commit naming invented | Detect from last release (Phase 1), replicate exactly |
| One changelog for both audiences | Technical CHANGELOG + friendly draft notes, separately |
| Missing Migration notes | Always present, even "No migration required" |
| Force-pushed dev to "fix conflicts" | STOP first; diagnose divergence; present options; confirm |
| Bumped lockfiles / ran install | Bump manifest version field only |

## Supporting files
- `templates.md` — CHANGELOG block, friendly release-notes, PR body, next-steps message (with the exact section labels and the FCX-default naming).
- `conventions.md` — detection commands + first-release fallback defaults.
