---
name: bitbucket
description: Prepare or finalize Bitbucket releases with a release branch, production PR, tag, and merge-back to develop.
disable-model-invocation: true
---

# Bitbucket Release

*You have already been invoked; these instructions are now active context, not a pending action. Do not call the Skill tool to invoke this skill again.*

Run a release for a single Bitbucket repository in PREPARE or FINALIZE.
A release is represented by a commit, tag, PR, and report; do not invent a
platform release object. Apply the shared contract in
[../shared/release-contract.md](../shared/release-contract.md) and detect
conventions in [../shared/conventions.md](../shared/conventions.md).
Use [templates.md](templates.md) for the PR and report wire format.

## PREPARE

1. Confirm the git path and origin; derive the workspace/repository from the
   Bitbucket URL and confirm available authentication/API access. Detect
   develop (or the real development branch), master/production, the tag prefix,
   manifest/versioning, language, commit/PR format, CHANGELOG, and migration
   notes. For the first release, confirm the defaults.
2. Fetch branches and tags. Calculate the delta between the remote production
   and development HEADs, excluding release/changelog/version bump commits.
   Record the remote SHA used. If the delta is empty, stop.
3. Look for local/remote release/<version>, the tag, the open
   release/<version> to master PR, and any merge-back PR. Show the state: no
   artifacts = new; all artifacts = resume/finalize; partial = abort or resume.
   Never recreate or overwrite artifacts.
4. Analyze every commit in the delta and prove changes, removals, endpoints,
   events, schema, environment variables, and migrations in the diff. Propose
   major/minor/patch, version, and title
   [CHORE] #RELEASE - Release X.Y.Z; ask for confirmation before editing.
5. After confirmation, start from the recorded remote SHA and create
   release/<version>. Update only the detected version field, without installing
   dependencies or changing the lockfile. Update the technical CHANGELOG and
   PR notes/description in separate templates; include Migration notes.
6. Make one commit in the detected style, create the tag on the release branch,
   push the branch and tag, and open the PR to master. Verify that the PR
   matches the branch/version, has no conflicts, and record links, SHAs, and the
   pipeline. PREPARE ends here.

## FINALIZE

1. Re-read the correct release/<version> to master PR remotely, its HEAD,
   conflict status, approval, and pipelines/quality gates. No pending or failed
   check, missing approval, or conflict may proceed.
2. Verify that the candidate tag exists, is the expected tag, and points exactly
   to the release branch HEAD (discover the pointed-to SHA for annotated tags).
   Stop and show the divergence if any value does not match.
3. Show the complete plan and wait for explicit confirmation. Merge with a merge
   commit; use squash/rebase only if explicitly chosen.
4. Confirm the PR is MERGED, the tag is on the expected commit, and the tag is
   an ancestor of master. After merging, automatically open a master-to-develop
   PR with migration notes and release context. Never merge that PR automatically.
5. Deliver the final report with the production PR, merge commit, tag/HEAD,
   pipeline, approval, and merge-back PR. If any operation fails, stop with
   recoverable diagnostics and do not silently compensate.

## SERU rules

When the detected conventions are those of the SERU portal, preserve
develop -> release/* -> master + develop, the specified title, the tag on the
release branch, and explicit migration notes. Do not make this convention the
default for other repositories.
