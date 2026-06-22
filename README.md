# gm-skills

Personal [Claude Code](https://claude.com/claude-code) plugin marketplace.

## Plugins

### `sdd` — Spec-Driven Development

A brownfield-first SDD workflow as four composable skills. Each phase proves the
next can start, and the whole chain proves every requirement was built and tested.

| Skill | Phase | Does |
| --- | --- | --- |
| `sdd:codebase` | 0 — Map | Generates `docs/codebase/` (a `context.md` router with enforced invariants + per-concept docs). The brownfield-analysis layer the other phases read to stay on-pattern. |
| `sdd:spec` | 1 — Specify | A relentless one-question-at-a-time interview → `spec.md` with EARS requirements, REQ-IDs, acceptance criteria. Won't finish while any `[NEEDS CLARIFICATION]` is open. |
| `sdd:plan` | 2 — Design + Tasks | `plan.md` with a design anchored to the codebase map and an atomic task breakdown carrying a REQ→task→test coverage matrix. Fails if any requirement is uncovered; `/analyze` checks tasks against enforced invariants. |
| `sdd:implement` | 3 — Execute | Works the plan task by task (one subagent each, strict test-first TDD, serial by default). A closing gate walks the matrix and proves every requirement has a passing test. |

**The proof chain:** clarify (no open ambiguity) → coverage matrix (every REQ has a task+test) → analyze (no task contradicts an enforced invariant) → TDD (no code without a failing test first) → closing gate (every REQ green on the integrated branch).

Artifacts live in `docs/specs/<feature>/{spec.md, plan.md, STATE.md}`; the codebase map in `docs/codebase/`.

## Install

```
/plugin marketplace add gmass0n/gm-skills
/plugin install sdd@gm-skills
```
