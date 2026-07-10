---
target: <target-name>
lang: pt|en
executed: <YYYY-MM-DD>
result: pass | fail | partial
scenarios: <passed>/<total>
---

# QA Verdict — <target>

> One line: what was tested and the bottom line. Honest — don't fake success.

## Blockers

What actually broke. QA does not fix — it reports.

| id | Scenario | Expected | Observed | Evidence | Likely layer/repo |
|---|---|---|---|---|---|
| <S1> | <title> | <expected> | <observed> | <screenshot/log/network ref> | <repo/layer> |

_None._ <!-- keep this line only if there are no blockers -->

## Warnings

Suspicious but not blocking (WARN in a log, inconsistent data, blocked scenario).

| id | Scenario | What | Evidence |
|---|---|---|---|
| <S2> | <title> | <e.g. [VALIDATION_FAILED] in bff.log> | <log ref> |

_None._

## Summary

- **Covered:** <scenarios run>
- **Passed:** <ids>
- **Failed:** <ids + one-line why>
- **Could not validate:** <ids + reason: blocked credential / out of scope / stalled>

## Cleanup

- Synthetic data removed (prefix `<prefix>-`): yes | no | n/a
- Anything left behind or ambiguous: <note or "none">
