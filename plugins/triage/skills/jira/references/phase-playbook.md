# Phase Playbook

Operational detail for `triage:jira`. The `SKILL.md` body is the contract; this file is the *how* — exact subagent briefings, the small verdict each phase returns, and where each subagent reads its SDD method from. Read the section for the phase you are running.

## Table of contents

- [Resolving the SDD skill paths](#resolving-the-sdd-skill-paths)
- [The universal subagent contract](#the-universal-subagent-contract)
- [Phase 0 — Briefing](#phase-0--briefing)
- [Phase 1 — Filter](#phase-1--filter)
- [Phase 2 — Pre-triage](#phase-2--pre-triage)
- [Phase 3 — Plan + WIP PR](#phase-3--plan--wip-pr)
- [Phase 4 — Deliver](#phase-4--deliver)
- [Phase 5 — Review gate](#phase-5--review-gate)
- [Git, branch, and PR conventions](#git-branch-and-pr-conventions)

## Resolving the SDD skill paths

The subagents must read the **real** SDD skill files so they follow the method verbatim instead of inventing rules. The SDD plugin lives alongside this one in the `gm-skills` marketplace. From a subagent, resolve the path once:

```
SDD=$(dirname "$(find ~/.claude/plugins/marketplaces -path '*gm-skills*plugins/sdd/skills/plan/SKILL.md' | head -1)")/..
```

Then the method files are:

- Plan method → `$SDD/plan/SKILL.md`
- Implement method → `$SDD/implement/SKILL.md`
- Review method → `$SDD/review/SKILL.md` and `$SDD/review/references/review-lenses.md`

If `find` returns nothing (plugin not in the marketplace dir), fall back to the cache: `~/.claude/plugins/cache/gm-skills/sdd/<latest-version>/skills/...`. Always tell the subagent the resolved absolute path in its briefing — don't make it guess.

## The universal subagent contract

Every briefing you send, in every phase, includes these four lines so a weaker model cannot drift:

1. **Your job** — one sentence, the single thing this subagent does.
2. **Read this method** — the absolute SDD skill path to follow verbatim (Phases 3–5), or "do not read code / map" (Phases 0–1).
3. **Here is the codebase digest** — paste the Phase 0 digest (Phases 2–5). Tell it: *do not re-read `docs/codebase/` — use this digest.*
4. **Return exactly this JSON and nothing else** — the verdict shape for the phase. No prose, no diff, no file dump. This is what keeps the orchestrator's context tiny.

Reinforce in every briefing: **you may not spawn another subagent.** If the work needs sub-units, that is a signal to return `viable: false`, not to fan out.

## Phase 0 — Briefing

**Tier:** `fast`. **One subagent.**

Briefing: "Read `docs/codebase/context.md` and load only the entries relevant to a backend bug/chore. If `docs/codebase/lessons/` exists, list the confirmed lessons (cap to the top recurring ones). Return a compact digest: layer rules, enforced invariants, naming + test conventions, and the lessons. Do not dump file contents — summarize."

Hold the returned digest in the orchestrator. Inject it verbatim into Phases 2–5 briefings.

## Phase 1 — Filter

**Tier:** `fast`. **One subagent for ALL tickets.**

First, you (orchestrator) fetch the tickets via the Jira MCP from the named boards, open/backlog status. Pass the **list of `{key, title, description, labels, components}`** to the single subagent.

Briefing: "Classify each ticket **from its text alone**. Do NOT read any code. For each return `{key, size, reason, repo_guess}` where `size ∈ {PP,P,M,G}` (PP=trivial, P=small, M=medium, G=large). Flag clearly-complex or ambiguous tickets as `G`. `reason` is one line."

Verdict (array): `[{ key, size, reason, repo_guess }]`

Orchestrator then drops `G`/ambiguous, keeps `PP|P|M`, sorts smallest-first.

## Phase 2 — Pre-triage

**Tier:** `balanced`. **Sequential, one subagent per ticket, STOP at 3 viable.**

For each kept ticket (smallest first), briefing:

"Investigate the code paths this ticket touches, using the digest below (do NOT re-read `docs/codebase/`). Measure the real size. Apply two brakes and return `viable:false` if either trips:
- **Scope brake:** more than a handful of files touched, or you must open many files just to understand it → not small.
- **Multi-repo coupling:** isolated identical edits across repos are fine up to 3 repos; a contract/API change one repo's consumer must track → reject (`reason: cross-repo-contract`).
If viable, write a lean `docs/specs/<KEY>/spec.md` from the ticket (description + acceptance criteria as the requirements; English). Return the verdict."

Verdict: `{ key, viable, real_size, repos, reason, spec_path }`

**The instant 3 tickets return `viable:true`, stop spawning.** Remaining kept tickets wait for the next run.

## Phase 3 — Plan + WIP PR

**Tier:** `balanced`. **Up to 3 subagents in parallel — orchestrator spawns them.**

Per viable ticket, briefing:

"Read the plan method at `$SDD/plan/SKILL.md` and follow it to produce `docs/specs/<KEY>/plan.md` from `<spec_path>`. Execute the method yourself — do NOT invoke any skill, do NOT spawn subagents. English body. Anchor every decision to the digest below. If you cannot close the plan without an open `[NEEDS CLARIFICATION]`, finish anyway and set `needs_clarification:true`.

Then, via the Bitbucket MCP:
- create branch `type/<KEY>-short-desc` off the repo's develop base,
- commit the `docs/specs/<KEY>/` artifacts,
- open a **draft** PR titled `[TYPE] #<KEY> - Description` with a **Portuguese** description: 2-4 plain sentences on what the ticket is and how it will be implemented, plus a `needs manual follow-up` note if applicable.

Return the verdict only."

Verdict: `{ key, pr_url, size, summary_ptbr, needs_clarification }`

## Phase 4 — Deliver

**Tier:** `balanced`. **One subagent per approved ticket — orchestrator spawns.**

Briefing:

"Read the implement method at `$SDD/implement/SKILL.md`. Run its TDD loop **inline in your own context** (you may NOT spawn subagents): for each plan task — write the failing test, run it, watch it fail (RED), implement the minimum to pass (GREEN), refactor, commit. Then run the repo gates: test suite, typecheck, lint.

Code discipline (ponytail): fix the **root cause** — grep the callers of any function you touch, don't patch only the path the ticket names. Prefer stdlib and existing helpers over new code. Ship the smallest diff that works; no speculative scaffolding.

Work on branch `type/<KEY>-...` (already exists from Phase 3). Use the digest below; do not re-read the map. Return the verdict."

Verdict: `{ key, status, tests, commits }` (`status ∈ {done, blocked}`; if blocked, include a one-line reason).

## Phase 5 — Review gate

**Tier:** `deep`. **Orchestrator spawns one subagent PER LENS, in parallel, each blind.**

Lenses: `correctness`, `security`, `performance`, `architecture`, and `spec-alignment` (only if `docs/specs/<KEY>/spec.md` exists).

Per-lens briefing:

"You are the **<lens>** reviewer, blind to the other lenses. Read `$SDD/review/SKILL.md` and `$SDD/review/references/review-lenses.md`; apply ONLY the `<lens>` dimension's checklist **and its 'what NOT to flag' blocklist**. Review the diff of branch `type/<KEY>-...` vs its base. Report only grounded findings as `file:Lline` with a concrete impact and a fix. Honor the blocklist — a finding that the blocklist excludes is a false positive, do not raise it. Return the verdict."

Per-lens verdict: `{ lens, findings: [{ id, file_line, severity, problem, fix }] }`

Orchestrator collects findings across lenses. If any `blocker|warning|nit` survives:

1. Spawn **one** `balanced` fix subagent: "Resolve these findings (ponytail discipline), commit. Findings: <list>. Return `{ resolved, commits }`."
2. **Re-review:** spawn a **fresh** full set of lens subagents (new attempt = new context).
3. **Cap: 2 review→fix cycles.** Clean → publish the draft as Ready via the Bitbucket MCP (`publishDraftPullRequest` / convert from draft). Still failing → leave draft, post the open findings as a PR comment, flag to the human.

Final verdict: `{ key, verdict, ready, open_findings }`

## Git, branch, and PR conventions

These match the project's contributing rules — every subagent that commits or opens a PR must honor them:

- **Commit:** `type(scope): subject` — Conventional Commits, imperative, lowercase, no trailing dot.
- **Branch:** `type/JIRA-KEY-short-desc` off `develop` (or the repo's stated base).
- **PR title:** `[TYPE] #JIRA-KEY - Description`.
- **English** for commits, branches, PR titles, `spec.md`, and the `plan.md` body. **Portuguese** only for the `plan.md` summary block and the PR description.
- **Never** add an AI `Co-authored-by` trailer to any commit or PR.
- Some repos require **Node 24** for the commit/build toolchain; if a commit fails on a Node version error, surface it rather than silently downgrading.
