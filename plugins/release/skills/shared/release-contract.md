# Release contract

Both platform skills use the same two states:

- **PREPARE** inspects first, confirms ambiguous choices, computes a proven
  delta, writes technical changelog plus audience-appropriate notes, creates
  the release branch/PR/tag, and stops before production merge.
- **FINALIZE** revalidates the live PR, expected tag and branch HEAD, approval,
  quality gates, and conflict state; it merges only after one explicit
  confirmation and reports verified post-merge state.

Common gates:

- Never overwrite a branch, tag, PR, changelog, notes, or release artifact.
- Never force-push or move a tag without a separate explicit confirmation.
- Every changelog and PR body contains 'Migration notes', including
  'No migration required.' when applicable.
- An empty development-to-production delta is a stop, not a release.
- Partial state is reported as a table with 'abort' or 'resume'; retries must
  reuse matching artifacts instead of duplicating them.
- FINALIZE stops on missing approval, pending/failed quality gate, conflict,
  wrong PR, wrong tag, or tag/HEAD divergence.
- A protected operation failing leaves a recoverable diagnostic: operation,
  current state, and safe next command.

The default merge method is a merge commit. Any other method requires an
explicit choice during that execution.
