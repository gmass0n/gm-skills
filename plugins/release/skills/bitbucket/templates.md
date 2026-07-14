# Bitbucket release templates

Keep Bitbucket's wire format and audiences separate from GitHub's release
object and draft notes. Replace placeholders with facts proved by the delta.

## Release PR

Title: [CHORE] #RELEASE - Release <version>

Body:

    ## Summary

    Release <version> from <development> to <production>.

    ## Changes

    - <technical change proved by commit or file path>

    ## Migration notes

    - <required migration, environment, rollout, or No migration required.>

    ## Verification

    - Delta base: <production SHA>
    - Release head: <release branch SHA>
    - Tag: <tag> -> <tag SHA>

## Merge-back PR

Title: [CHORE] #RELEASE - Merge <version> back to <development>

Body:

    ## Purpose

    Bring the production merge for <version> back to <development>.

    ## Production merge

    - Production PR: <URL>
    - Merge commit: <SHA>
    - Tag: <tag> -> <tag SHA>

    ## Migration notes

    - <same operational note, or No migration required.>

    This PR is opened automatically after production merge and requires normal
    review. It must never be merged automatically.

## Final report

Record the production PR and merge commit, release branch, tag and pointed
SHA, approval, successful pipeline, conflict status, and the merge-back PR.
Mark any unverified item as blocked rather than inferring success.
