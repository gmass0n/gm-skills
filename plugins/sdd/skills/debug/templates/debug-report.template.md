# Template: `report.md` (in the session folder)

The lightweight cursor of a bug hunt. It lives in the **session folder** `docs/debug/<slug>/report.md`, with the capture `session.jsonl` beside it (same folder — everything for the session centralized). When the bug is in a specified feature, it can live in `docs/specs/<feature>/debug-<slug>.md` to inherit the spec's context; in that case the `session.jsonl` still lives in `docs/debug/<slug>/`. It's not an eternal contract like `spec.md`/`plan.md` — it's **disposable scaffolding**: it serves to summarize the hunt if the session dies and to hold the cleanup manifest. The real durable record is the regression test in git; this `.md` can be archived or deleted after the fix.

## Language

`report.md` is **always written in English**, regardless of the conversation language. The `lang: pt|en` key in the frontmatter records the language of the conversation with the human (interview + live narration) — it never changes the file content. Detected from the initial `sdd:debug` prompt.

## Structure

```markdown
---
title: debug — <slug>
lang: pt | en                          # conversation language (interview + narration); report.md is always English
status: investigating | fix-applied | resolved   # fix-applied = fix-executor GREEN; resolved only with closing-gate green AND human-confirmation
debug-tag: DEBUG-a4f2                  # unique session hash — the cleanup manifest
feature: <feature or ->               # link to the spec if any; "-" if standalone bug
repos: [<main-repo>]                  # repos touched in the session; >1 only in multi-repo bug (each needs grep-zero in F8)
human-confirmation: <- | yes (date)>  # stamp from the final AskUserQuestion; without it, status is never "resolved"
generated: <date>
---

# Debug: <one-line symptom>

## Symptom
<the exact message/stack/wrong value. type: a (backend) | b (frontend) | c (silent flow).
 For type c, write "expected X, got Y" — without this, a silent flow is invisible.>

## Repro
<how to trigger the bug, minimized to the smallest scenario that still fails. 1-3 lines.
 Mark who triggers: [agent] scriptable (test/curl/navigate), [agent-playwright] backend
 flow with auth in the browser (curl fails without token), or [human] manual (login/state).>

## Hypotheses
<2-5, each one: mechanism — where (layer/file) — status + evidence.
 Status: ✅ confirmed | ❌ refuted | ❓ untested. The evidence is the exact .jsonl line.>
- H1: <mechanism> — <file> — ❓ untested
- H2: <mechanism> — <file> — ✅ confirmed (evidence: [DEBUG-a4f2] in foo.ts:42 showed user=null)
- H3: <mechanism> — <file> — ❌ refuted (evidence: branch B was never taken in the .jsonl)

## Spawned subagents (orchestration manifest)
<each commissioned subagent, to audit the orchestrator's purity and summarize if the session drops.
 The orchestrator doesn't appear here — it only commissions and synthesizes.>
- Explore (F2/F5): <what it read>
- instrumentation-executor (F3): <instrumented files> — or "—" if collapsed into the fix-executor
- fix-executor (F6): <the fix + commit>
- closing-gate (F8): <verdict>

## Instrumentation (cleanup manifest)
<everything the closing-gate will remove. Without this, orphan instrumentation stays forever if the session drops.
 Each sender has an anchor comment `// DEBUG-<hash> (sdd:debug) — remove on cleanup` on the line above.
 Multi-repo: name the repo of each sender — grep-zero runs in each one.>
- debug-tag: DEBUG-a4f2
- senders in: <repo-A> src/.../foo.ts:42, <repo-B> src/.../bar.ts:88
- server: port 9999 → docs/debug/<slug>/session.jsonl  (or direct file-write, if no network)
- service(s) restarted to instrument: <e.g. api (Node 24, node dist/main.js)> — restore in F8: yes/no

## Root cause
<the real function/line where the bug is born + how many callers share the same bug (from the F2 grep).
 If there's a spec: the violated REQ-ID, or "behavior never specified".>

## Fix
<file:line + 1 sentence of what changed. Cite the context.md invariant the fix respects
 and the layer pattern it follows.>

### TDD proof (from the fix-executor)
<the proof of R2 — RED before GREEN. Without the RED, the test passed trivially and proves nothing.>
- command: <yarn test <spec> / pytest ...>
- RED (before the fix): <pasted output — the test failed>
- GREEN (after the fix): <pasted output — the test passed>
- If skipped (honest escape): "no test — <reason>", recorded as debt.

## Closing-gate (verdict — the F8 double gate)
<the closing-gate proves; status only becomes "resolved" with all marked.>
- [ ] re-repro with the SAME live instrumentation = delta proven in the same `.jsonl` (before: <e.g. `stage:event-fired` missing / wrong value> → after: <e.g. present / right value>)
- [ ] regression test green
- [ ] grep-zero `DEBUG-<hash>` in the code — **in each repo of `repos:`** (only after the delta above)
- [ ] debug server process killed
- [ ] `session.jsonl` deleted (after the delta is read, before grep-zero)
- [ ] dev service(s) restarted in F4 restored to original state
- [ ] human confirmed the original symptom is gone (`human-confirmation`)

## Attempts (only if there was a circuit breaker)
<the hypotheses that didn't hold, so as not to repeat them when re-hypothesizing. Delete if it never fired.>
```

## Filling rules

- **Incremental persistence, rewrite never append.** The hypotheses enter here the moment they arise (F2), with status `❓`; they become `✅`/`❌` per the F4 evidence. The instrumentation manifest enters in F3, before any reproduction. **Rewrite the report at each phase that closes — never append; keep it ~300–400 tokens.** It's the debug's state.md (don't create another): a cursor, not a log.
- **`debug-tag` is the manifest.** The unique hash (`DEBUG-<hash>`) appears in the frontmatter and in the instrumentation section. F8 does a `grep` for it to remove all instrumentation — a forgotten hash is an orphan `console.log` in the diff.
- **Type c symptom needs "expected vs got".** With no error that screams, what defines the bug is the divergence. Write it explicitly.
- **Root cause names callers.** The number of callers that share the bug is what justifies the fix in the shared function instead of in the named caller.
- **The TDD proof is a durable record.** The `.md` is disposable; the test in git is not. The pasted RED proves the test was written before the fix. If the test was skipped, the debt is written here — it doesn't vanish in silence.
- **`status` is a real gate, in two jumps.** `investigating` → `fix-applied` (the fix-executor closed the GREEN, but nothing has yet confirmed it resolves the symptom) → `resolved` (**only** with all the closing-gate checkboxes marked **and** `human-confirmation` filled). Jumping from `investigating` straight to `resolved` is exactly the failure this skill exists to prevent.
- **Folder-per-session + multi-repo.** Everything for the session lives in `docs/debug/<slug>/` (report + `session.jsonl`), in a single repo even when the bug crosses repos — the capture converges in one `.jsonl`. If `repos:` has more than one, the manifest names the repo of each sender and the F8 grep-zero runs in each one; any service restarted to instrument returns to its original state at closing.
