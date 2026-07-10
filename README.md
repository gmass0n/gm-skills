# gm-skills

Personal plugin marketplace for [Claude Code](https://claude.com/claude-code) **and** [OpenAI Codex](https://developers.openai.com/codex). The same skills run on both runtimes — one `skills/` directory, two manifests (`.claude-plugin/` and `.codex-plugin/`), no duplication.

## Plugins

### `sdd` — Spec-Driven Development

A brownfield-first SDD workflow as six composable skills. The four forward phases
prove the next can start, and the whole chain proves every requirement was built and
tested. The last two, `sdd:review` and `sdd:debug`, run off that trail — callable any
time you want a pre-push review or something breaks.

| Skill | Phase | Does |
| --- | --- | --- |
| `sdd:codebase` | 0 — Map | Generates `docs/codebase/` (a `context.md` router with enforced invariants + per-concept docs). The brownfield-analysis layer the other phases read to stay on-pattern. |
| `sdd:spec` | 1 — Specify | A relentless one-question-at-a-time interview → `spec.md` with EARS requirements, REQ-IDs, acceptance criteria, and a `[P0\|P1\|P2]` priority per user story. Loads the project's confirmed lessons to pre-empt known past failures. Won't finish while any `[NEEDS CLARIFICATION]` is open. |
| `sdd:plan` | 2 — Design + Tasks | `plan.md` with a design anchored to the codebase map and an atomic task breakdown carrying a REQ→task→test coverage matrix (with the assertion expression that proves each REQ). Fails if any requirement is uncovered; `/analyze` checks tasks against enforced invariants. |
| `sdd:implement` | 3 — Execute | Works the plan task by task (one subagent each, strict test-first TDD, serial by default; a trivial ≤3-file/no-REQ change may ramp down to inline). A closing gate walks the matrix proving every REQ has a *locatable* assertion (evidence-or-zero), runs a mutation/discrimination sensor on P0 REQs (one mutant in an isolated worktree, proving the test kills it), and records each real failure as a grounded lesson. |
| `sdd:review` | — Review | Enterprise-grade **local** code review (the pre-flight before `git push`, when there's no remote PR yet) of a diff, file, commit range, or the whole repo. Blind parallel lenses (correctness, security, performance, architecture, spec-alignment) emit hypotheses, then adversarial verification falsifies each against a real `file:line`; gates (test/typecheck/lint) and a mutation sensor run in parallel; bias-to-approve. Routes findings, never fixes. |
| `sdd:debug` | — Debug | Root-cause hunt with a surgical fix, in the spirit of Cursor's Debug Mode. Generates multiple hypotheses *before* touching code, instruments it with hypothesis-driven logs routed to a local debug server, collects real runtime evidence (server + Playwright, or the human reproducing), fixes at the root, proves it with a re-repro + a RED→GREEN regression test, then cleans up every trace. Records a grounded lesson when the cause was shared (N callers / a violated invariant). Reads `context.md` to avoid violating invariants; works without the map (ungrounded). A circuit breaker re-hypothesizes after 3 failed attempts. |

**The proof chain (forward phases):** clarify (no open ambiguity) → coverage matrix (every REQ has a task+test) → analyze (no task contradicts an enforced invariant) → TDD (no code without a failing test first) → closing gate (every REQ green *with a locatable assertion* on the integrated branch, P0 tests proven to discriminate by the mutation sensor).

**The lessons layer (self-improving memory):** `sdd:implement` and `sdd:debug` distill each real failure into a grounded one-line lesson in the versioned `docs/codebase/lessons/`; recurring ones are promoted to `confirmed` and loaded by `sdd:spec`/`sdd:plan` on the next feature — so the workflow stops re-learning the same mistake.

**The debug loop (off-trail):** read the error → multiple hypotheses → instrument → reproduce & collect runtime evidence → fix the root cause → verify (re-repro + regression test) → grep-zero cleanup. It never edits production code on a guess.

Artifacts live in `docs/specs/<feature>/{spec.md, plan.md, state.md}`; the codebase map and the lessons memory in `docs/codebase/` (`docs/codebase/lessons/`); debug reports in `docs/specs/<feature>/debug-<slug>.md` or `docs/debug/<slug>/report.md` (the runtime-capture `.jsonl` lives beside the report and is removed on cleanup).

### `status-report` — leadership-ready status reports

Turns any fix, incident, or in-flight change into a polished, audience-agnostic status report — one document clear enough for leadership, support, and the customer at once — plus an optional enterprise action plan. It mines the current session and context first, interviews you one question at a time when the context is thin (never inventing facts), then renders the validated WhatsApp/email style (📄 title, `*bold*` metadata, status emoji ✅ 🔧 ⛔).

| Output | When | Contains |
| --- | --- | --- |
| `status-report.txt` | always | Title, status, plain-language narrative of what happened + root cause, scope, resolution or next steps. |
| `action-plan.txt` | on request / when prevention work is warranted | Root cause to treat, numbered actions (1️⃣) with 👤 owner and 🗓️ deadline, prioritized recommendation. |

Reports follow the prompt's language (PT-BR → PT-BR, EN → EN) and land in `docs/status-reports/<slug>/`. On Claude it fans out three subagents (timeline+cause, evidence, action plan) and synthesizes; without subagents it degrades to the same work inline.

### `qa` — end-to-end QA plan & test

A lightweight, mono- or multi-repo QA workflow as two composable skills, mirroring the
`plan → test` contract shape of `sdd`. `qa:plan` writes a self-sufficient plan; `qa:test`
executes only that plan and reports — it never fixes code (that stays with `sdd:debug`).

| Skill | Does |
| --- | --- |
| `qa:plan` | Explores the repos via subagents first, then interviews you one question at a time (recommended default first) about only the risk unknowns — real-data access, port collision, scope. Writes `docs/qa/<target>/plan.md`: how to stand up the stack (isolated git worktree per repo, dynamically-free ports, `.env` per service, mock-vs-dev switch), a smoke-check, and a per-phase scenario checklist with a per-scenario credential mode (unattended / assisted / blocked). Stops and asks whatever it can't discover with certainty. |
| `qa:test` | Reads `docs/qa/<target>/plan.md` as its **only** context. Stands up the stack exactly as planned (re-confirming free ports), runs the mandatory smoke-check, then the scenarios — frontend via Playwright MCP strictly sequential in a fresh clean browser (the browser is a singleton; parallel frontend caused ~2.8M tokens of contention in a real session), backend via curl parallelized when independent. Returns a fixed-format verdict (`docs/qa/<target>/verdict.md`: blockers, warnings, summary, cleanup). |

The plan is the single source of truth: `qa:test` never re-discovers the environment or invents scenarios, and neither skill decides a path/port/credential alone — when in doubt they stop and ask. Skill content is English; the interview and generated artifacts follow the user's language (`lang: pt|en` in the plan's frontmatter).

### `triage` — automated Jira triage pipeline

Pulls tasks from the Jira boards you name, filters by size through three discarding gates, opens a draft WIP PR on Bitbucket per surviving task with a plain-language summary, pauses for your approval, then delivers the approved ones through the SDD TDD loop and flips the draft to Ready. Reuses the `sdd` plugin's plan/implement methods; nothing runs to completion without your checkpoint.

### `prs-review` — multi-PR code review

Structured review of one or more Pull Requests, Bitbucket and GitHub in the same batch. One subagent per PR (parallel, multi-repo) applies the `sdd` review doctrine — blind lenses plus adversarial verification — over the diff fetched via the matching MCP, and consolidates a single approved/rejected verdict with blockers, warnings, and praise.

### `github-release` — standards-compliant release flow

A single-repository GitHub release flow. **Prepare** detects the repo's conventions from git history, computes the delta since the last release, writes a technical CHANGELOG and friendly draft release notes, cuts the release branch, opens the release PR to prod, and reports conflict status. **Finalize** publishes the draft and merges the release PR into prod behind one gated confirmation. Every changelog line is proven from diffs; force-push and go-live are always gated.

## Install

### Claude Code

```
/plugin marketplace add gmass0n/gm-skills
/plugin install sdd@gm-skills
/plugin install qa@gm-skills
/plugin install status-report@gm-skills
/plugin install triage@gm-skills
/plugin install prs-review@gm-skills
/plugin install github-release@gm-skills
```

### OpenAI Codex

```
codex plugin marketplace add gmass0n/gm-skills
```

Then open the interactive plugin browser to install and enable it:

```
codex
/plugins
```

In `/plugins`: switch to the **gm-skills** marketplace tab, open the plugin you want (**sdd**, **qa**, **status-report**, **triage**, **prs-review**, or **github-release**), choose **install**, then press **Space** to enable it. Codex installs into `~/.codex/plugins/cache/gm-skills/<plugin>/<version>/` and stores the enabled state in `~/.codex/config.toml`. (Codex has no `codex plugin install` subcommand — installation is done through `/plugins`.)

Both runtimes read the **same** `plugins/sdd/skills/` — a skill is authored once and works in either. Claude Code resolves the plugin via `.claude-plugin/`; Codex via `.codex-plugin/` (manifest) and `.agents/plugins/marketplace.json` (marketplace). In Codex the skills surface through progressive disclosure (name + description first, full `SKILL.md` loaded on use); invoke a phase by intent (e.g. "map the repo", "spec out X", "plan this", "implement the plan", "debug this bug").

## Layout

```
gm-skills/
├── .claude-plugin/marketplace.json   # Claude Code marketplace
├── .agents/plugins/marketplace.json  # Codex marketplace
└── plugins/                          # each: .claude-plugin/ + .codex-plugin/ manifests + shared skills/
    ├── sdd/                           # codebase / spec / plan / implement / review / debug (see the table above)
    ├── qa/                            # plan / test
    ├── status-report/                 # status-report
    ├── triage/                        # jira triage pipeline
    ├── prs-review/                    # multi-PR review
    └── github-release/                # release flow
```

