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

First, you (orchestrator) fetch the tickets via the Jira MCP. Build the JQL from the boards and the status (default `Priorizado`):

```
project in (<boards>) AND status = "<status>" ORDER BY created ASC
```

e.g. for `/triage:jira SUS` → `project = SUS AND status = "Priorizado" ORDER BY created ASC`. If `status` contains spaces or accents, keep it quoted. Pass the **list of `{key, title, description, labels, components}`** to the single subagent.

Briefing: "Classify each ticket **from its text alone**. Do NOT read any code. For each return `{key, size, nature, ambiguous, reason}`:
- `size ∈ {PP,P,M,G}` (PP=trivial/1-line, P=small, M=medium/one module, G=large/multi-area).
- `nature ∈ {backend, pdv-app, unknown}` — where the change lives (POS/PDV/terminal/Clover client → `pdv-app`; server/API/data/fiscal-note generation → `backend`). **Signal only, never a filter.**
- `ambiguous: true` when the ticket can't be acted on without a human: no identified root cause (open-ended 'investigar/analisar'), asks to 'define which rule applies', empty description, or an operational data fix that isn't code.
- `reason`: one line."

Verdict (array): `[{ key, size, nature, ambiguous, reason }]`

Orchestrator keeps `PP|P|M` **and** `ambiguous:false`; drops the rest; sorts kept smallest-first. `nature` is carried forward (it does not drop anything) so Phase 2 knows which repo family to clone.

## Phase 2 — Pre-triage

**Tier:** `balanced`. **Sequential, one subagent per ticket, STOP at 3 viable.**

For each kept ticket (smallest first), briefing:

"Find and clone the target repo, then investigate the real code. Steps:
1. **Discover the repo.** The ticket's `nature` is `<nature>`. List the workspace repos via the Bitbucket MCP and pick the slug that best matches the ticket (a `pdv-app` ticket → the POS client repo; a fiscal/backend ticket → the matching backend). If the local working directory already is that repo, use it.
2. **Clone on demand** into a temp dir (e.g. `<scratch>/triage-<KEY>`) unless it's the local repo. Investigate the code THERE. Do NOT reject just because the code wasn't local — you have Bitbucket access.
3. **Measure real size** against that repo, using the digest below (do NOT re-read `docs/codebase/`).
4. **Detect the stack** of the cloned repo (Node via `package.json`, Android via `build.gradle`, etc.) and record it — Phase 4 uses it to pick the right test/lint gates.

Apply two brakes and return `viable:false` if either trips:
- **Scope brake:** the change would touch more than a handful of files, or you must open many files just to understand it → not small.
- **Multi-repo coupling:** isolated identical edits across repos are fine up to 3 repos; a contract/API change one repo's consumer must track → reject (`reason: cross-repo-contract`).

If viable, write a lean `docs/specs/<KEY>/spec.md` in the target repo from the ticket (description + acceptance criteria as the requirements; English). Return the verdict."

Verdict: `{ key, viable, real_size, repo_slug, repo_path, stack, repos, reason, spec_path }` (`stack ∈ {node, android, other}`)

**The instant 3 tickets return `viable:true`, stop spawning.** Remaining kept tickets wait for the next run.

## Phase 3 — Plan + WIP PR

**Tier:** `balanced`. **Up to 3 subagents in parallel — orchestrator spawns them.**

Per viable ticket, briefing:

"Read the plan method at `$SDD/plan/SKILL.md` and follow it to produce `docs/specs/<KEY>/plan.md` from `<spec_path>`. Execute the method yourself — do NOT invoke any skill, do NOT spawn subagents. English body. Anchor every decision to the digest below. If you cannot close the plan without an open `[NEEDS CLARIFICATION]`, finish anyway and set `needs_clarification:true`.

Then, via the Bitbucket MCP:
- **fetch the target repo's branching model** (`getRepositoryBranchingModel`) and read its development branch + branch prefixes — do NOT assume `develop`/`type/`,
- create branch `<repo-prefix>/<KEY>-short-desc` off that development branch (e.g. `fix/<KEY>-...` off `development` for pos-facil-api),
- commit the `docs/specs/<KEY>/` artifacts,
- open a **draft** PR (base = that development branch) titled `[TYPE] #<KEY> - Description` with a **Portuguese** description: 2-4 plain sentences on what the ticket is and how it will be implemented, a note that this PR currently carries only the spec/plan (the fix comes after approval — Phase 4 will refresh this text), plus a `needs manual follow-up` note if applicable.

Return the verdict only."

Verdict: `{ key, pr_url, size, summary_ptbr, needs_clarification }`

## Phase 4 — Deliver

**Tier:** `balanced`. **One subagent per approved ticket — orchestrator spawns.**

Briefing:

"Read the implement method at `$SDD/implement/SKILL.md`. Run its TDD loop **inline in your own context** (you may NOT spawn subagents): for each plan task — write the failing test, run it, watch it fail (RED), implement the minimum to pass (GREEN), refactor, commit. Then run the gates for this repo's stack (`stack = <stack>`): Node → project `test`/`typecheck`/`lint` scripts; Android → `./gradlew test`/`lint`. Never run a Node gate against a Gradle repo. If the repo has no test harness, report it — don't fake a green.

**Re-anchor against the current code — don't trust line numbers from earlier phases.** The Phase 2/3 verdicts cite `file:line`, but branches move and those numbers go stale (a real run saw a cited `:3817` that was actually `:4727` on the live branch). Before editing, grep/search the current branch for the symbol or pattern named, and anchor to what you find now. The earlier phase told you *what* and *where roughly*; the live code tells you the exact line.

Code discipline (ponytail): fix the **root cause** — grep the callers of any function you touch, don't patch only the path the ticket names. Prefer stdlib and existing helpers over new code. Ship the smallest diff that works; no speculative scaffolding.

Work on the ticket's existing branch (created in Phase 3). Use the digest below; do not re-read the map.

**Update the PR description after delivering.** The Phase 3 description was written when only the spec/plan existed and says the fix is *not yet implemented*. Once you've committed the fix + tests, update the PR description (Bitbucket MCP `updatePullRequest`) so it reflects what was actually done: what changed, the tests added and their result, gate status. A Ready PR whose description still says 'not implemented' misleads the human reviewer. Keep it Portuguese.

Return the verdict."

Verdict: `{ key, status, tests, commits }` (`status ∈ {done, blocked}`; if blocked, include a one-line reason).

## Phase 5 — Review gate

**Tier:** `deep`. **Orchestrator spawns one subagent PER LENS, in parallel, each blind.**

Lenses: `correctness`, `security`, `performance`, `architecture`, and `spec-alignment` (only if `docs/specs/<KEY>/spec.md` exists).

Per-lens briefing:

"You are the **<lens>** reviewer, blind to the other lenses. Read `$SDD/review/SKILL.md` and `$SDD/review/references/review-lenses.md`; apply ONLY the `<lens>` dimension's checklist **and its 'what NOT to flag' blocklist**. Review the diff of the ticket's branch (`<branch>`) vs its base. Report only grounded findings as `file:Lline` **anchored to the current branch** (line numbers from earlier phases may be stale — verify against the diff you're reading). A finding that the blocklist excludes is a false positive; do not raise it. Return the verdict."

Per-lens verdict: `{ lens, findings: [{ id, file_line, severity, problem, fix }] }`

Orchestrator collects findings across lenses. If any `blocker|warning|nit` survives:

1. Spawn **one** `balanced` fix subagent: "Resolve these findings (ponytail discipline), commit. Findings: <list>. Return `{ resolved, commits }`."
2. **Re-review:** spawn a **fresh** full set of lens subagents (new attempt = new context).
3. **Cap: 2 review→fix cycles.** Clean → publish the draft as Ready via the Bitbucket MCP (`publishDraftPullRequest` / convert from draft). Still failing → leave draft, post the open findings as a PR comment, flag to the human.

Final verdict: `{ key, verdict, ready, open_findings }`

## Git, branch, and PR conventions

**Conventions are per-repo, not global — detect them, don't assume.** The triage spans many repos (seru-*, pos-facil-*, pra-notas-*, pdv-facil) and they do NOT share a branching model. Before creating a branch or PR, the Phase 3 subagent MUST fetch the target repo's branching model via the Bitbucket MCP (`getRepositoryBranchingModel`) and use it:

- **Base branch:** the repo's *development* branch from the branching model — it may be `develop` (seru) OR `development` (pos-facil-api) OR `master`. Never hard-code `develop`.
- **Branch prefix:** the repo's declared prefixes — e.g. seru uses `feature/`/`type/`; pos-facil-api uses `feat/`/`fix/`. Match a bug ticket to the bugfix prefix, a feature to the feature prefix.
- **Branch name:** `<prefix>JIRA-KEY-short-desc`.

The defaults below are the *seru* convention and apply only when the branching model doesn't say otherwise:

- **Commit:** `type(scope): subject` — Conventional Commits, imperative, lowercase, no trailing dot.
- **Branch:** `<repo-prefix>/JIRA-KEY-short-desc` off the repo's development branch.
- **PR title:** `[TYPE] #JIRA-KEY - Description`.
- **English** for commits, branches, PR titles, `spec.md`, and the `plan.md` body. **Portuguese** only for the `plan.md` summary block and the PR description.
- **Never** add an AI `Co-authored-by` trailer to any commit or PR.
- Some repos require **Node 24** for the commit/build toolchain; if a commit fails on a Node version error, surface it rather than silently downgrading.
