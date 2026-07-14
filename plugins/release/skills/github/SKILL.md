---
name: github
description: Prepare or finalize a GitHub release per repository, with a changelog, draft, PR, and merge gates.
disable-model-invocation: true
---

# GitHub Release

Prepare or finalize a release for a single repository. Prove every claim from
that repository's history and diff. `CHANGELOG.md` is technical; release notes
are user-friendly and always separate.

Also apply the shared contract in [../shared/release-contract.md](../shared/release-contract.md).

## Guardrails

- PREPARE creates only a draft release and never merges.
- FINALIZE publishes and merges only after explicit confirmation.
- Detect the branch, tag prefix, names, and language before using them; defaults
  are only for the first release, after user confirmation.
- Never silently overwrite existing artifacts.
- Before a rebase or force-push, create `backup/<branch>-pre-rebase-<YYYYMMDD-HHMM>`,
  show alternatives, and wait for confirmation. Never roll back automatically.
- Every push that rewrites a branch requires reading the remote HEAD again
  immediately before the push and using `--force-with-lease` pinned to that SHA;
  stop and show the SHAs if it diverges. Never force a tag without separate,
  explicit confirmation.
- Every CHANGELOG and PR body contains Migration notes, including
  `No migration required.`.

Consult [../shared/conventions.md](../shared/conventions.md) when detecting
conventions, calculating the version, or handling the first release. Consult
[templates.md](templates.md) when writing the CHANGELOG, notes, PR body, and
final reports.

## Flow

### 1. Validate and detect

Confirm the git path/repository, `origin`, `gh` authentication, and
`<owner>/<repo>` obtained from `origin`; if there is only a name, ask for the
path or owner. Detect `dev` or `develop`, the latest tag, production (the branch
containing the latest tag), the manifest/versioning, release conventions,
CHANGELOG, and language. Show the detected summary. For the first release,
confirm the defaults before continuing.

### 2. Probe state

For the candidate version, look for the local/remote `release/v<X.Y.Z>` branch,
tag, open PR to production, and GitHub release.

- No artifacts: PREPARE.
- All artifacts (branch, open PR to production, tag, and draft release): offer FINALIZE.
- Some artifacts: show the state table and ask for `abort` or `resume`.
- Published release: if a PR is open, offer only its merge; if it is already
  merged, stop and request a higher version.

### 3. Compute and analyze the delta

Run `git fetch origin <dev> <prod> --tags`, verifying the remote HEAD of
`origin/<dev>` through the GitHub API before using the ref. The delta is exclusively:

```bash
git log --cherry-pick --right-only --no-merges \
  --invert-grep --grep='^release(' --grep='^chore(release)' --grep='^docs(changelog)' --grep='bump version' \
  --format='%H %s' origin/<prod>...origin/<dev>
```

If it is empty, stop. Record the verified remote SHA. For up to eight commits,
analyze one batch; above that, split into batches of eight and analyze in
parallel. Investigators return only facts per commit (`sha`, type, summary,
migrations, env vars, endpoints, events, schema, removals, and breaking
changes), without raw diffs. Restrict each investigation to `git show --stat`
and key files.

### 4. Propose the version and artifacts

Derive major/minor/patch from conventional commits. Re-read each migration,
endpoint, env var, and removal before claiming it. Show the version and
rationale and wait for explicit confirmation: do not create a branch, commit,
tag, or file changes before then.

With the version confirmed, produce the technical CHANGELOG block and
user-friendly notes without reusing the same text. See the formats and rules in
[templates.md](templates.md).

### 5. Prepare

Starting from the recorded remote SHA, create `release/v<X.Y.Z>`. Change only
the version field in the detected manifest, without installing dependencies or
changing the lockfile; update the CHANGELOG and make one commit in the detected
style, without an AI footer.

Push the branch normally, open the PR to production, create/push the tag on the
branch, and create the draft GitHub release with the user-friendly notes. Verify
mergeability. If it is clean, report the branch, tag, PR, draft, and next steps:
review, merge the PR with a merge commit, publish the draft, and deploy.

### 6. Handle conflicts

Conflicted PRs are a stop condition: diagnose them with the same delta and tree
comparison. Present a rebase of `dev` onto production, a `--no-ff` merge, or a
cherry-pick of the delta, with trade-offs. For cosmetic-only divergence,
recommend a rebase, but execute it only after confirmation and backup. If a
rebase occurred, confirm before force-pushing `dev`, the release branch, and the
tag. For every rewritten branch, obtain its current SHA with
`git ls-remote origin refs/heads/<branch>` immediately before the push, compare
it with the expected/fetched SHA, and only then use
`git push --force-with-lease=refs/heads/<branch>:<remote-sha> origin <branch>`.
If any SHA diverges, do not push and report the local/remote state. A tag may be
moved only after separate, explicit confirmation; revalidate it and show the
old/new SHAs before `git push --force origin refs/tags/<tag>`. Move a branch/tag
only in this flow and verify that the draft remains correct.

### 7. Finalize

Revalidate in real time the open PR (`release/v<X.Y.Z>` → production),
mergeability, draft status, and remote tag. Before showing the confirmation,
obtain the draft's `tagName`, the remote HEAD of `release/v<X.Y.Z>`, and the
remote tag SHA (use the peeled SHA for an annotated tag). `tagName` must be
exactly the candidate tag and the two SHAs must match. Any absence or divergence
is a stop condition: show the table `draft tagName / candidate tag / branch HEAD /
tag SHA` and do not merge or publish. If there is a conflict, return to conflict
handling. Show the finalize plan and wait for confirmation to merge first and
publish afterward. The default is `gh pr merge <num> --merge`; honor another
method only if the user explicitly chose it in that run.

The tag remains on the release commit. After merging, confirm that it is an
ancestor of production, publish the draft, confirm the PR is `MERGED`, the
release is no longer a draft, and the tag points to the expected commit; then
deliver the go-live report from [templates.md](templates.md).

## Completion

PREPARE ends with a draft and next steps. FINALIZE ends only after verifying the
merge, publication, and tag. If any protected operation fails, stop and report
the current state, backup reference, and recovery commands.
