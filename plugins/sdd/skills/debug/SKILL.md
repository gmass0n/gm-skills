---
name: debug
description: "Hunt the root cause of a bug and apply a surgical fix — off the forward SDD track, triggerable at any time. Use whenever something BROKE: console error, stack trace, exception, on-screen/UI error, failing request, red test, wrong flow, wrong value/state, unexpected behavior, regression — or when the user says \"it's broken\", \"it's throwing an error\", \"debug this\", \"why doesn't this work\", \"fix this bug\", \"investigate this problem\". Adapts Debug Mode (Cursor-style) to Claude Code: reads docs/codebase/context.md to find the bug's layer and to avoid violating invariants in the fix, generates SEVERAL root-cause hypotheses BEFORE any correction, instruments the code with hypothesis-driven logs (unique prefix, removed at the end) that send evidence to a local debug server, collects real runtime (server + Playwright MCP for the browser, or the human reproducing) instead of guessing, isolates the cause, applies the smallest possible fix at the root (not at the symptom — grep the callers), verifies by reproducing again + a regression test, and CLEANS UP all the instrumentation. After 3 failed attempts, it stops and re-hypothesizes (circuit breaker). Works without the map (ungrounded mode), but is far more efficient with it. Do NOT use to build a new feature or a broad refactor — that's sdd:spec / sdd:plan / sdd:implement."
---

# SDD — Debug (root-cause hunt + surgical fix)

## What this skill does, and why it exists

A bug is a symptom. The temptation — that of raw Claude, that of the 3am dev — is to edit the first plausible line and hope. That's the haste that costs dearly: the fix masks the symptom, the bug comes back elsewhere, and the diff turns to junk. This skill swaps the guess for **runtime evidence**: it generates hypotheses, instruments the code to test them, makes the bug actually run, reads what really happened, and only then fixes — at the root, with the smallest possible diff, proving the fix before declaring it.

It's the **anti-skill** of the other four in SDD. They are *forward* (idea → spec → plan → code), exhaustive, with gates. This one is *backward* (symptom → cause → fix), fast, surgical. But it inherits the full DNA — including what raw Claude lacks the most: **the orchestrator is pure.** A fresh subagent per read, per instrumentation, per fix, per proof — **mandatory even for a single one-line fix**; the orchestrator **never reads source nor edits code in its own context**, it only commissions subagents, reads the digests and the verdicts, and synthesizes. (`pure orchestrator — one fresh subagent per read, per fix, per proof, mandatory even for a single fix; never coding or analyzing in its own context`, same as `sdd:implement`/`sdd:plan`.) It reads the codebase map and specs as input, persists incrementally, and proves what it claims — it never declares resolved without technical proof **and** human confirmation.

**The fast-vs-rigor axis resolves like this: rigor IS the shortcut.** Hypotheses-first is not slowness — it's what avoids three wrong fixes in a row. Root cause is not ceremony — it's the smaller diff (one guard in the shared function is less code than a guard in every caller). The haste that works is hypothesis-first; jumping to the fix is the haste that bills you at 3am.

This skill reads the map and specs as input, and writes only a lightweight report inside the session folder `docs/debug/<slug>/report.md` (or, if the bug is in a specified feature, `docs/specs/<feature>/debug-<slug>.md`) — alongside the ephemeral `session.jsonl` capture, removed at the end. It never touches the map.

## Before anything — ground and language

Read `docs/codebase/context.md` first (only it — it's light, ~500 tokens). It gives you three things that change the debug:
- **Enforced invariants** (invariant → mechanism table with a real path): the fix **cannot violate** any of them. "Fixing" by breaking the lint boundary breaks the build — worse than the original bug.
- **Per-task loading** + **Catalog**: they map the symptom to the layer where it lives, and tell you which doc to read to understand that layer's pattern (read later, via subagent).
- **Stack**: so you know which runtime you're instrumenting.

**Graceful degradation — debug is an emergency, never refuse:**
- No `docs/codebase/context.md` → warn: *"Map missing — it would be more efficient and safer with it (run `sdd:codebase`). Proceeding in ungrounded mode."* and **continue**. Unlike `sdd:plan`/`sdd:implement`, which refuse without a precondition: refusing a debug would be hostile. The risk of ungrounded mode (you may violate an invisible invariant in the fix) you declare in the report.
- No `docs/codebase/conventions/testing.md` → write the regression test by the pattern you infer from the repo, and note the inference.
- No `docs/specs/<feature>/` → debug without the contractual "expected"; use the expected the human describes. It's the common case — most bugs are not in a specified feature.

**Detect and SAVE the language now.** Detect the language of the user's initial prompt and **save it for the INTERVIEW + the live NARRATION** (the dialog with the user — every question and every spoken update is in that language). **`report.md` is always written in English**, regardless of the detected language. Record the conversation language in `lang:` in the report frontmatter; it records the conversation language and never changes file content. Never mix or switch mid-session. (Same pattern as `sdd:spec`.)

## Where this skill shines — and where it isn't the right tool

The method (instrument → reproduce → read runtime) is unbeatable when the bug is **reproducible and observable in code**: race conditions and async timing bugs, UI inconsistencies (SSR hydration, client/server mismatch), silent flows that yield the wrong value, regressions. In those cases the runtime evidence finds what three code reviews didn't.

But the prerequisite is **being able to reproduce the bug** — it's the central limitation of Debug Mode (unanimous testimony from the Cursor reviews: "many bugs are hard to trigger, and those are exactly the bugs Debug Mode cannot solve"). When the bug **doesn't reproduce under instrumentation**, don't force the method; tell the human and change approach:
- **Intermittent / production-only / not locally reproducible** → instrumenting doesn't capture what doesn't run. Collect what exists (production logs, traces) or ask the human for a reproduction path before continuing.
- **Memory leak / memory profiling** → that's heap-snapshot work (DevTools, profiler), not boundary logging.
- **Cause outside the code** (hardware, faulty adapter, environment config, network) → instrumentation will "blame" the wrong code. If the code hypotheses run out, raise the possibility of an external cause instead of instrumenting deeper.

Recognizing early that the bug is out of the method's reach is part of the discipline — it avoids instrumenting in the dark a bug that will never show up in the `.jsonl`.

## The flow — eight linear phases (F0–F8) + one re-entry (F9), a funnel with a gate

Each phase consumes what the previous one produced; you don't advance without it. **No shortcut: even a one-line null check goes through the full flow — the gates ARE the value.** It was exactly the shortcut that failed in the real runs (skipped hypotheses, didn't create the report, didn't do TDD, declared resolved without proving). There is no fast-path. **F9 is not a linear end: it's the re-entry door when the human says "it didn't work" — it throws you back into F2, it doesn't let you turn into raw Claude.** The typical collapse isn't skipping phases on the 1st run (that one usually comes out right); it's **abandoning the whole flow on the 2nd round**, after the "still broken" feedback. F9 exists to prevent exactly that.

**The skill is not ceremony — it's orchestration.** The orchestrator's purity and the closing gate are what was missing and what is non-negotiable; **the number of intermediate subagents collapses to the size of the bug.** A bug localized from one hypothesis can be **a single fix-executor** that instruments, confirms, fixes and proves in one briefing — not 8 subagents for a null check. What never collapses is the closing gate (closing-gate + human confirmation).

### F0 — Grounding
Read `context.md` (above), lock the language, and check whether the bug falls into an existing `docs/specs/<feature>/` (note it for F5 — knowing the *expected* behavior changes the fix). This is the only disk read the orchestrator does in its own context; everything else (source, specs, testing.md) goes via subagent.

**Create the session folder now:** `docs/debug/<slug>/` — everything for the session lives here (the report `report.md` AND the capture `session.jsonl`), centralized in one place. In multi-repo, **the folder lives in the repo where the session started**; the capture from both repos converges into the same `session.jsonl` (the debug server is a single one). No loose `.md`/`.jsonl` at the root of `docs/debug/`.

**Multi-repo — grounding in the 2nd repo (non-negotiable rule).** If the bug crosses into another repository (e.g. the frontend calls a backend that lives in another repo), **before instrumenting that 2nd repo do a mini-F0 in it**: read *its* `docs/codebase/context.md` (the enforced invariants are different), and if there's a corresponding `docs/specs/<feature>/`, note the REQ. **Never instrument a repo whose map you haven't read** — you may violate an invisible invariant in the fix, and *that* repo's lint/typecheck gate breaks the build. (Real case: a bug that was born in the portal followed into the API; the API had its own `context.md`, `CLAUDE.md` and specs — ignoring them is instrumenting blind.)

### F1 — Triage and symptom capture
**Read the error message / stack trace to the end, BEFORE hypothesizing.** Error messages frequently contain the exact solution; skipping the read to theorize is mistake #1. Then:

- **Classify the bug into a type** (this routes the capture — see `references/runtime-capture.md`):
  - **(a) backend / console / terminal** — exception, stack trace, error log, red test, crashing process.
  - **(b) frontend / screen** — browser console error, request failing in the UI, broken render, blank screen.
  - **(c) wrong / silent flow** — no error, but wrong result: incorrect value, branch not taken, swapped order, divergent state. The most treacherous one — nothing screams.
- **Capture the exact "fact 0":** the literal message, the file:line at the top of the stack, the wrong value *vs* the expected. It's what anchors the hypotheses.
- **Ask the human via `AskUserQuestion`:** the minimal repro (*how do I trigger this?*) and the artifact they already have (*do you have the stack/log/screenshot? paste it here*) — because the evidence the human already holds is the cheapest capture there is.
- **Minimize the repro:** shrink it to the smallest scenario that still stays red — keep only what is load-bearing for the failure. A minimized repro makes the hypotheses sharper and the `.jsonl` less noisy. **This minimized repro usually becomes, literally, the fix-executor's RED test in F6** — it's not wasted work, it's the regression test being born early.

### F2 — Multiple hypotheses (the heart)
**Before any fix**, generate **2 to 5 distinct root-cause hypotheses**. Each one:
- a one-sentence mechanism ("`x` is null because the upstream `Y` doesn't fill it in case `Z`"),
- the **layer/file** where it probably lives (from the F0 mapping),
- how you would **distinguish** it from the others (which evidence confirms or refutes it).

**Delegate the code reading to an `Explore` subagent — never read source in your own context.** To locate where each hypothesis lives, dispatch `Explore` to read the code around the symptom and **grep the callers** of the suspect function (root-cause, not symptom: how many call it? do they all have the same bug?). You receive the digest — relevant snippets and the caller list — not the bytes. The orchestrator's context stays clean.

**Ask for a LEAN digest, with a ceiling.** The `Explore` briefing asks for *only* what distinguishes the hypotheses — the suspect function + the **complete caller list (file:line)** + the load-bearing snippet —, **not** a tour of the layer. A digest that comes back at 150+ KB is exhaustive exploration in the wrong place: in a bug hunt `Explore` confirms *where the hypothesis lives*, it doesn't document the architecture (that's `sdd:codebase`). Target: each digest fits in a few KB. If the symptom is a flow, ask for **the call chain** (who calls whom, from the event to the persist), not the body of each function. The caller list is mandatory and complete (it's what guarantees the fix at the root); only the *body* of the functions shrinks.

**Persist now:** write the hypotheses into the report with status `❓ untested`. If the session dies, they survive.

**Point bug vs. chain bug — choose the instrumentation mode BEFORE hypothesizing deeply.** If the symptom is a value/branch at one point (type a/b) → a few surgical senders at the points that separate the hypotheses (the F3 default). But if the bug is a **silent linear flow** (type c: `event → handler → guard → throttle → fetch → persist`) where *nothing screams* and the real question is "**at which link does the flow die?**", don't iterate hypothesis-by-hypothesis over each stage — **instrument the WHOLE chain at once, 1 sender per link**, each one marking its `stage` (schema in `references/runtime-capture.md`). A single reproduction reveals the first link that doesn't emit, and that **kills several hypotheses at once** instead of one per round. Real case: 5 hypotheses about the data contract (list→save→POST→response) cost a whole round of instrumentation that only proved "contract OK" without finding the cause; instrumenting `event-fired → handler → http-sent → http-acked` in one pass would have shown `event-fired:0` at the first link (the event never fires) and skipped straight to the root. **Whole chain ≠ spam:** it's 1 sender per named stage (the chain has 4–6 links), not dozens at the same point.

**Anti-jump rule (non-negotiable, no exception):** if you're about to commission a fix-executor and you still **don't have runtime evidence that confirms a hypothesis, STOP — you're guessing.** Debug Mode doesn't guess; it collects. Go to F3. (The trap phrases that signal you've gone back to guessing are in `references/hypothesis-discipline.md` — read it when you feel the temptation of "I'll just try this quick fix".)

### F3 — Hypothesis-driven instrumentation + bring up the debug server (commissioned)
**The orchestrator commissions the instrumentation to a subagent — it doesn't inject senders in its own context** (`the orchestrator commissions the instrumentation; it doesn't inject senders in its own context`).

**Step 0 of F3 — detect the target repo's stack BEFORE choosing the sender.** The sender is a direct `fetch`/POST to the debug server, but the right form depends on the language and runtime of that repo — choosing the wrong sender means instrumenting and the `.jsonl` comes out empty. The F0 `context.md` already gave you the stack; confirm the detail that changes the sender: the language (TS/JS, Python, Go, …), the runtime and version (Node 18+ has native `fetch`; old Node doesn't — use `http.request`), and whether the instrumented point runs in the **browser** or on the **server** (both have `fetch`, but the browser may hit CORS/CSP — point the POST at the server's `localhost:<port>`, which responds to any origin). In **multi-repo, detect the stack of EACH repo** — the 2nd may be another language/version. The catalog of senders per stack (TS/JS with `fetch`, old Node, Python, Go, shell) is in `references/runtime-capture.md`; the `instrumentation-executor` briefing carries the sender **already chosen for that point's stack**, not a generic one. Rule: the sender is always a structured POST to the server (the "server HTTP + direct fetch" half of the mechanism), **never** a loose `console.log`/stdout.

**What the debug-server rule really forbids is a loose `console.log` on stdout** — fragile, vanishes in the worker/SSR/container, and is orphaned in the diff. What it requires is **structured, traceable capture in a `.jsonl`**. The debug server (`scripts/debug-server.js`) is the default channel and **mandatory when the evidence needs to be *injected* into the code** (an internal variable, which branch was taken, timing between layers) — there the sender with `// DEBUG-<hash>` is the right form, and there's grep-zero to clean up.

**Capture by direct inspection is a legitimate channel — record it, don't treat it as a forbidden shortcut.** When the symptom is observable *from outside* without injecting anything into the code, prefer inspection and **attach the evidence to the `.jsonl`/report**:
- **Frontend / request / render** → Playwright (`browser_network_requests`, `browser_console_messages`, `browser_evaluate`) is the natural source — the real request/response, the status, the console. Don't instrument what the Network tab already shows.
- **Persistence / "did it really save?"** → a direct query to the DB (does the record exist? with what value? did `updatedAt` change?) is the strongest proof that the flow reached the end — stronger than a log mid-path.
- **Runtime state already exposed** (a field on `window`, a header, a log file the service already writes) → read it directly.

The rule: **if you need to CREATE an observation point inside the code → debug server + sender** (and the capture goes to the `.jsonl`). **If the observation point already exists outside the code → inspect directly and attach to the report.** Both end up in the `.jsonl`/report as citable evidence. The sin isn't "I didn't use the server"; it's "my 'proof' was a deduction from reading the code, with no runtime at all". For the loose `console.log`/stdout case and the file-write fallback, see `references/runtime-capture.md`. When the sender IS necessary, it points at `docs/debug/<slug>/session.jsonl` (the session folder created in F0). The subagent injects, at the points the F2 digest pointed to as the ones that **distinguish the hypotheses**, a *sender* that does a `POST` to the server with a structured payload: `{tag: "DEBUG-<hash>", hyp: "H2", stage?: "...", seq?: NN, var: "...", value: ..., file: "...", line: NN}` (in a flow/type-c bug, each sender carries its `stage` in the chain — full schema in `references/runtime-capture.md`). Each insertion carries an **anchor comment** on the line above — `// DEBUG-<hash> (sdd:debug) — remove on cleanup` — so that the F8 removal is unambiguous. The `<hash>` is a unique 4-character identifier for this session (e.g. `a4f2`). The subagent returns the **filled manifest** (hash, instrumented files:line, port, `.jsonl` path); the orchestrator writes it into the report without seeing the source bytes.

> **Reuse (ponytail):** the instrumentation subagent is the **same type as the fix-executor** — editing files by briefing, marking with anchors, returning a manifest is the same operation. Don't invent a third role. For a localized bug, instrumentation and fix can be **a single fix-executor** in one briefing.

The subagent's briefing is **~500 tokens, self-contained, execution-ready**: the points to instrument (from the F2 digest), the session hash, the command to bring up the server. The logs are **hypothesis-driven, not random** — targeted instrumentation, not `console.log` spam: each one prints exactly what confirms or refutes a hypothesis (the value of the suspect variable, which branch was taken, the timing, the state at the boundary between layers). **Minimal** instrumentation (3–5 points that separate the hypotheses, not dozens). In **chain mode** (type-c bug, decided in F2), the "minimal" is **one sender per flow link** with its `stage` — the whole chain in one round, to locate where it dies in a single reproduction; it's still targeted, not spam (the number of senders = number of chain stages, typically 4–6). The sender per language, the server lifecycle and the file-write fallback are in `references/runtime-capture.md`.

**Persist the cleanup manifest** in the report: the `DEBUG-<hash>`, the instrumented files (**with each one's repo**, if multi-repo), the server port and the `.jsonl` path (`docs/debug/<slug>/session.jsonl`). It's what F8 will remove — without it, orphan instrumentation stays forever if the session drops.

### F4 — Reproduction + collection (human triggers / agent collects)
**Restarting the target service is mandatory when it's long-running** (backend server, front build, watcher). The senders only start posting to the debug server **after the restart** — instrumenting without restarting captures nothing, and the agent stares at an empty `.jsonl` thinking the repro didn't fire. Cursor makes this step explicit ("restart the application and reproduce the bug"). When restarting:
- **Use the runtime the repo requires.** Check `engines`/`.nvmrc`/`package.json` of *that* repo; a Node or manager mismatch blocks the boot (real case: pnpm's `engines.node>=24` gate prevented the start — it took the right Node via nvm and running the compiled entrypoint directly). Confirm in the boot stdout that the service came up ("listening on ...").
- **If you tore down the dev process to restart, note it in the manifest and RESTORE it to the original state in F8.** Don't leave the human's environment different from how it was.

Then make the bug run and capture the evidence. **Who triggers depends on the repro:**
- **Scriptable** (a test, a `curl`, a `browser_navigate`) → the agent triggers on its own.
- **Backend repro whose auth lives in the browser** (httpOnly cookie, server-side session) → **the agent triggers via Playwright**: the logged-in browser fires the request that `curl` can't (no token). Playwright isn't just visual capture — it's the trigger of the backend flow when the session is in the browser.
- **Manual** (needs a real login, hand-mounted state, hardware) → the human triggers in the real app; the agent observes. It's the "tight back-and-forth": the agent does the tedious work, the human gives the steps only they have.

**The capture is the `.jsonl`:** read `docs/debug/<slug>/session.jsonl` (structured, parseable, independent of which process/terminal emitted it — and it unifies backend and frontend in a single channel, even in multi-repo). For type (b), complement with Playwright (`browser_console_messages`, `browser_network_requests`, `browser_take_screenshot`, and `browser_run_code_unsafe`/`browser_evaluate` for hit-testing proof) for what the log doesn't see — the visual and the geometry. Details and the ranking of how to automate the repro are in `references/runtime-capture.md`.

**Confront each record with the hypotheses:** update in the report `✅ confirmed` / `❌ refuted` + the evidence (the exact `.jsonl` line). None confirmed and the logs aren't enough? → go back to F3 with finer instrumentation — **this counts as 1 circuit-breaker attempt.** One confirmed → F5.

### F5 — Analysis / root-cause isolation
With the hypothesis confirmed by the evidence, isolate the **root cause, not the symptom.** The key question: *the symptom shows up here, but is the cause in the shared function above? how many callers have the same bug?* — use the F2 caller grep. The fix goes at the root where they all pass through, not at the caller the ticket named.

- **If F0 found a spec:** delegate to an `Explore` to read the relevant REQ-IDs and acceptance criteria — to know the behavior that *was* contracted. Does the bug violate REQ-x, or is it behavior never specified? That changes the fix.
- **Check invariants:** does the root cause touch an enforced invariant from `context.md`? The fix will have to respect it.

Clear and single root cause → F6. Ambiguous cause, or "fix it in one place and it reappears in another" → sign of a wrong hypothesis → circuit breaker.

### F6 — Surgical fix (at the root, via TDD fix-executor)
**The orchestrator commissions one fix-executor per fix — it doesn't edit code in its own context.** A fresh subagent, mandatory even for a one-liner (`spawn a fix-executor anyway`). The briefing is **~500 tokens, self-contained, execution-ready, concrete enough to follow blind**: the root cause (F5), the files to touch, the enforced invariants to respect (F0), the project's test command (`docs/codebase/conventions/testing.md`), and the minimized repro from F1 as the starting point of the RED test.

The fix-executor runs the **strict test-first loop identical to `sdd:implement`** — `write the failing test, watch it fail, make it pass, refactor, commit`:
1. **RED** — writes the regression test at the right seam, **RUNS it, and watches it fail.** The test asserts **observable behavior** (the right value, the emitted event), not the mechanism of the fix. If there's a spec, it cites the violated REQ-ID.
2. **GREEN** — only then the **smallest fix that attacks the root cause** (two or three lines, not speculative code; one guard in the shared function, not in every caller). **RUNS it, and watches it pass.**
3. **REFACTOR** — cleans up, staying green.
4. **COMMIT** — atomic.

The fix-executor **returns the RED output and the GREEN output as proof** — the orchestrator pastes both into the "TDD proof" section of the report. Without RED before GREEN, the test passed trivially and proves nothing.

**Honest boundary:** if the fix requires an architecture change, is large, or crosses several layers → **it's not a quick fix, it's a feature/refactor.** Stop and recommend `sdd:spec`/`sdd:plan`. Debug is not the back door for a big change without a spec.

### F7 — Verification (absorbed into F6 and F8)
Verification is no longer an action phase of the orchestrator — it **dissolves into the delegated gates**: the **RED→GREEN test** was already proven by the fix-executor in F6 (with the output pasted into the report); the **symptom re-reproduction** is the first step of the closing-gate in F8. Nothing here does the orchestrator run in its own context.

- **Honest test escape:** the default is the F6 RED→GREEN test. But if the bug is trivial at a seam with no suite, or an obvious one-liner where the test would be disproportionate, **the fix-executor records the absence as explicit debt in the report** instead of faking coverage — and the closing-gate flags that debt in the verdict.

### F8 — Closing + cleanup (double gate, non-negotiable)
This is the phase that **was missing** in the real runs — the skill declared resolved without proving the symptom was gone. Now closing requires **delegated technical proof AND human confirmation**, neither of them skippable.

**(1) closing-gate subagent — the proof.** The orchestrator commissions a subagent that **walks the matrix and returns a structured verdict** (`the orchestrator commissions the proof and reads the verdict; it doesn't run the checks in its own context`). The closing-gate proves, in this order:
1. **Re-repro:** runs the **SAME repro from F4** with the fix — the evidence that previously showed the bug now shows the right behavior. **Proof by reproduction, not by vibe.** This proof is **real runtime** (the `.jsonl`/Playwright/the human triggering the flow for real), **not** the step-2 unit test. A green test proves the unit does what the test asserts; only the re-repro proves that the *human's symptom* is gone in the running app. Both are required and **don't substitute for each other**: declaring resolved with only a green unit test, without a runtime re-repro, is the mistake that reopens the bug. If the repro depends on a component that's hard to automate (e.g. a video player, a map, a canvas, a third party), **the human triggers and you observe the `.jsonl`/the UI** — don't swap the re-repro for an "equivalent" unit test. **The F3 instrumentation survives until HERE — don't remove it before the re-repro.** The re-repro runs with the **same senders still alive**, in the **same `session.jsonl`**: the "before" capture (bug — e.g. `stage:event-fired` missing, `timeupdate=0`) and the "after" capture (fix — `event-fired` present, `timeupdate=34`) sit in the same file, in order. The **delta in the same `.jsonl` is the cheapest and most direct proof** that the symptom is gone — aggregate by `stage` (see `runtime-capture.md`) and compare before×after; **do not re-instrument manually for the re-repro** (rework that happened in the real case). Only after the closing-gate reads that delta does cleanup (step 3) run.
2. **Green test:** the F6 regression test passes.
3. **Cleanup with grep-zero (per repo) — only after the step-1 delta is proven:** kills the debug server process (F3 manifest) → **deletes the `.jsonl`** (`docs/debug/<slug>/session.jsonl`) *before* the grep, otherwise the grep finds the `DEBUG-<hash>` itself inside the capture file → removes each sender AND its anchor comment → `grep -rn "DEBUG-<hash>" .` returns **zero**. **Multi-repo: grep-zero runs in EACH instrumented repo** (the manifest names each sender's repo) — a sender forgotten in the 2nd repo is an orphan `console.log` that goes into that repo's PR. Also check nested branches that didn't run — grep-zero is the net that catches the orphan sender the `.jsonl` didn't see.
4. **Restore the environment:** any dev service you restarted/tore down in F4 returns to its original state (same runtime, same mode — watch/dev). (`the closing-gate removes the instrumentation and proves grep-zero; the orchestrator reads the verdict`.)

The verdict comes back as a checklist: `re-repro OK / green test / grep-zero OK in each repo / server dead / .jsonl deleted / dev service(s) restored`. A red verdict on any item → **it doesn't close**; go back to the corresponding phase (re-repro failed = wrong hypothesis → circuit breaker).

**(2) Human confirmation — the stamp.** With the green verdict in hand, the orchestrator asks the human via `AskUserQuestion`: *"is the original symptom you reported really gone?"*. **It's the only closing question** (the human is only consulted at the ends: initial repro in F1, confirmation here). Without the "yes", the status stays `fix-applied`, not `resolved`.

**The skill does not declare resolved while** the closing-gate verdict is red OR the human hasn't confirmed (`won't declare resolved while the verdict is red or the human hasn't confirmed`). Only with **both** does the report become `status: resolved`.

Close the report and do the **handoff**: symptom → root cause (file:line) → evidence that proved it → green test (RED→GREEN pasted) → green closing-gate → human confirmation. If F5 saw that N callers share the pattern, flag it: *"layer X has the same risk in N callers — worth a `sdd:codebase diff` to record?"*

### F9 — Reopening ("it didn't work", the bug came back) — RE-ENTER the flow, don't turn into raw Claude

**This is the phase where the skill fails most in practice.** The observed pattern: on the 1st run everything is followed to the letter; the human comes back and says *"it still doesn't work"* / *"the progress doesn't save"*; and the orchestrator **abandons the flow** — it starts editing code in its own context, stops doing TDD, stops instrumenting, and stacks reproduction attempts until the context blows up. This is the #1 anti-pattern of this skill. **When the human reopens, you are NOT on a new bug nor in a free mode: you re-enter the SAME flow, with the existing report as state.md.**

Trigger: the human says any variation of *"it didn't work / still broken / the bug came back / it still errors"* **after** a `fix-applied` or `resolved`. The instant this happens:

1. **STOP editing.** Don't touch code yet. The temptation of "just one more quick tweak" is exactly the collapse. The previous fix was based on a hypothesis that runtime has now **refuted** — you don't have a confirmed hypothesis for the new state.
2. **The reopening counts as a circuit-breaker attempt** (see the dedicated section) — add it to the session's attempts. If this takes the total to 3, fire the circuit breaker NOW: re-hypothesize the premise from scratch before any fix.
3. **Re-enter F2 with the report as state.md.** Re-read the hypotheses already marked `✅/❌`. The fact that the fix didn't hold is **new evidence**: either the confirmed hypothesis was incomplete (there was a 2nd cause in series), or the F4 "confirmation" was weak (you never saw the real runtime — see R-runtime below). Generate hypotheses for the **new** observed state.
4. **Go back to instrumenting (F3) with the debug server** for the exact point the human describes — don't guess from reading. If the symptom is "X doesn't fire", instrument the path of X and prove with runtime BEFORE proposing the fix. The human reports the symptom; the `.jsonl` says the cause.
5. **The new fix is a new fix-executor with TDD** (F6) — the previous round's regression test clearly didn't cover the real case, so the new round's RED is the case the human just described.
6. **The closing-gate (F8) runs again, in full.** A reopening invalidates the previous green verdict. Without a new green closing-gate + a new human confirmation, the status goes back to `fix-applied`.

**Hard closing rule under reopening:** as long as the human says it doesn't work, the report's status is `fix-applied` (or `investigating` if you went back to F2), **never `resolved`** — and you **do not commit a fix whose symptom the human just said persists**, unless they explicitly ask to commit anyway (then the commit records in the report that the symptom is still open). Committing "resolved" over an unconfirmed "it didn't work" is the worst possible outcome: it masks the bug in git.

## Human / agent split

The orchestrator **commissions and synthesizes**; it never reads source nor edits code in its own context. Each "subagent" line below is a ~500-token briefing, self-contained.

| Work | Who | Why |
|---|---|---|
| Classify the type, generate hypotheses, choose where to instrument, read digests/verdicts, synthesize | **Orchestrator** | it's reasoning over the digest — the only role with no source read/write |
| Read the source around the symptom, grep the callers, read spec/REQ/testing.md | **`Explore` subagent** | keeps the orchestrator's context clean (SDD DNA) |
| Bring up the server + inject the instrumentation senders | **`instrumentation-executor` subagent** (same type as fix-executor) | writing to production leaves the orchestrator (R4) |
| Trigger the repro in the real app (login, manual state, hardware) | **Human** | the agent doesn't have the credentials/the environment — Debug Mode's "back-and-forth" |
| Trigger a scriptable repro (test, curl, `browser_navigate`) + capture the `.jsonl`/Playwright | **Agent** | deterministic, "the agent handles the tedious work" |
| Trigger a backend repro whose auth lives in the browser (httpOnly cookie/session) | **Agent via Playwright** | the logged-in browser fires the request; `curl` fails without the token |
| Decide whether a behavior is a bug or intentional | **Human** (`AskUserQuestion`) | it's a product judgment, not evidence |
| Write the RED→GREEN test + the fix + commit | **`fix-executor` subagent** | surgical TDD execution; one per fix, outside the orchestrator's context |
| Re-reproduce + prove green test + clean up instrumentation + grep-zero | **`closing-gate` subagent** | the proof is commissioned, not self-executed |
| Confirm the original symptom is gone | **Human** (`AskUserQuestion`) | closing isn't decided alone — final stamp |

## Circuit breaker — stop before stacking fixes

Each cycle "I instrumented/fixed → reproduced → no hypothesis confirmed, or the fix didn't hold" counts as **one attempt**. **After 3 failed attempts, STOP** — don't try a 4th variation in the same direction. Instead:
1. Declare to the human: *"3 hypotheses didn't hold — likely a premise error, not an implementation one."*
2. **Re-hypothesize from scratch (go back to F2)** questioning the premise: *is the symptom what I think it is? am I in the right file? does the repro actually reproduce this bug, or another?*
3. If still stuck → **escalate to the human with the complete report** (the 3 refuted hypotheses + evidence) instead of continuing to guess. Honesty beats thrashing.

**The breaker counts attempts of the WHOLE session, not just the initial investigation.** A reopening by the human ("it didn't work") **is a failed attempt** and adds to the counter — even if the previous fix passed the closing-gate and the confirmation. Real scenario that exhausts the breaker: fix 1 committed → human reopens (attempt 1) → fix 2 without TDD → human reopens (attempt 2) → fix 3 → human reopens (attempt 3) → **STOP**. Three fixes that didn't hold almost never call for a 4th similar one; they call for questioning the premise: *did I really see the symptom's runtime, or did I only read the code and deduce? was the F4 "confirmation" a real `.jsonl` or a unit test I wrote myself?* A green unit test **is not** runtime confirmation — it's F6, not F4.

Without the breaker, an agent "fixes" six times, each fix masking the previous one, and the diff turns to junk. The breaker is what keeps the surgical fix surgical. Detail in `references/hypothesis-discipline.md`.

## Artifact — a lightweight, disposable report

Write a lightweight, incremental bug report (~half a page) following `templates/debug-report.template.md`. Location: `docs/debug/<slug>/report.md` (the session folder created in F0, with the `session.jsonl` beside it); or `docs/specs/<feature>/debug-<slug>.md` if the bug is in a specified feature (inherits the spec's context). **Create it right away in F1/F2** (`status: investigating`) — not at the end. It goes through three states: `investigating` → `fix-applied` (fix-executor GREEN, but closing-gate/human haven't confirmed yet) → `resolved` (only with a green closing-gate **and** human confirmation).

The report **is the debug's state.md** — don't create a separate state file, it's already the resumability cursor. Therefore: **rewrite it the instant each phase closes — never append**, keep it ~300–400 tokens. It's a cursor, not a log; a diary that grows loses its function. If the session dies, the report on disk says which hypotheses already fell, which `DEBUG-<hash>` are loose, and what state the fix is in — so as not to re-decide the already-decided.

**Why persist and not stay only in the chat:** the concrete gain is **resumability + the cleanup manifest**. If the session dies in F4, the report on disk says which hypotheses were already tested and — critically — which `DEBUG-<hash>` are loose in the code. Without it, orphan instrumentation stays forever.

**Why lightweight and disposable:** it's a hunt cursor, not a spec. The truly durable record is the **regression test in git** — the `.md` is scaffolding. Unlike spec/plan (eternal contracts), this artifact can be archived or deleted after the fix.

## Why this skill, and not just asking Claude to debug

1. **Multiple hypotheses forced before the fix.** Raw Claude jumps to the first plausible fix; the skill forbids editing production without evidence that confirms a hypothesis. Kills the thrashing.
2. **Runtime evidence, not guessing.** Targeted instrumentation + real capture (server/Playwright/human) instead of "it's probably this".
3. **Mechanical root cause.** Mandatory grep of the callers; fix in the shared function. Raw Claude fixes the named caller and leaves the siblings broken.
4. **Doesn't violate invariants in the fix.** Reads the enforced invariants from `context.md`; raw Claude "fixes" by breaking the lint and breaks the build.
5. **Proves the fix — and the proof is commissioned, not self-declared.** closing-gate (re-repro + RED→GREEN test + grep-zero) **plus** human confirmation of the symptom. Raw Claude says "it should be resolved"; here the session doesn't close without both.
6. **Cleans up after itself.** grep-zero of the `DEBUG-<hash>` + server dead + `.jsonl` removed. Raw Claude leaves an orphan `console.log` in the diff.
7. **Circuit breaker.** It stops and re-thinks instead of stacking fixes.
8. **Resumable.** The lightweight report saves the hunt and the cleanup if the session dies.
9. **Knows the expected.** Reads spec/REQ-IDs when the bug is in a feature; it knows whether it violates a contract or is new behavior.

In the Cursor Debug Mode reviews, this method caught race conditions that passed through three code reviews and resolved timezone/hydration bugs in minutes where manual print-debugging took dozens — because runtime evidence finds what reading the code alone doesn't. This skill brings that loop to Claude Code, with the SDD codebase connection on top.

## What this skill must not do

- **Don't fix without evidence.** Without a hypothesis confirmed by runtime, you're guessing. No exception — there is no fast-path.
- **Don't edit code in your own context.** Commission a fix-executor even for a one-liner. The orchestrator reads digests and verdicts, not source bytes.
- **Don't write the fix before the red test.** Strict test-first: the fix-executor watches the RED fail before the GREEN. A test written afterwards passes trivially and proves nothing.
- **Don't declare resolved without the double gate.** Green closing-gate (re-repro + test + grep-zero) **AND** human confirmation of the symptom. Without both, the status stays `fix-applied`.
- **Don't fix the symptom.** Grep the callers; go to the root where they all pass through.
- **Don't turn into a feature.** A fix that requires architecture/crosses layers → recommend `sdd:spec`/`sdd:plan`.
- **Don't leave instrumentation behind.** The closing-gate proves grep-zero, server dead, `.jsonl` deleted.
- **Don't switch language** mid-session. Lock it from the initial prompt.
- **Don't stack attempts.** 3 failures → circuit breaker.

## Common mistakes

| Mistake | Fix |
|---|---|
| Jumping to the fix without reproducing or collecting evidence | Hypotheses first (F2), instrument (F3), make it run (F4). Without runtime that confirms, you're guessing. |
| Reading half the error message and theorizing | Read the stack to the end before hypothesizing — the solution is usually right there. |
| Fixing the caller the ticket named | Grep all the callers; the fix goes in the shared function (root cause, not symptom). |
| Instrumenting with generic logs | Each log is hypothesis-driven — it prints what distinguishes H1 from H2. |
| "It's a tiny fix, I'll do it myself in my context" | Spawn a fix-executor anyway — pure orchestrator, no exception even for the one-liner. |
| Orchestrator reads source / injects sender / edits fix | Commission: `Explore` reads, `instrumentation-executor` injects, `fix-executor` edits, `closing-gate` cleans up. The orchestrator reads the digest and the verdict. |
| Writing the fix and then the test | Strict test-first: write the failing test, watch it fail (RED), only then the fix, watch it pass (GREEN), refactor, commit. Paste RED and GREEN. |
| Declaring resolved because the test passed | closing-gate proves re-repro + grep-zero, **AND** the human confirms the symptom is gone. Without both, status stays `fix-applied`. |
| Forgetting `console.log`/senders in the diff | The closing-gate, in order: kills the server, deletes the `.jsonl`, then grep-zero of the `DEBUG-<hash>` in the code. |
| grep-zero never closes | Delete the `.jsonl` before the grep — otherwise it finds the tag itself inside the capture file. |
| Stacking a 4th fix in the same direction | 3 failures → stop, re-hypothesize the premise, escalate with the report. |
| "Fixing" by violating an enforced invariant | Check the `context.md` table; the fix respects the boundary, it doesn't break it. |
| Refusing because the map is missing | Debug is an emergency — degrade to ungrounded, warn, and declare the risk in the report. |
| Turning the debug into a feature without a spec | A large/architectural fix → honest boundary: recommend `sdd:spec`/`sdd:plan`. |
| Instrumenting in the dark a bug that doesn't reproduce | If it doesn't reproduce under instrumentation (intermittent, production-only, memory leak, hardware), tell the human and change approach — it's the method's central limitation. |
| Instrumenting the 2nd repo without reading its map | Multi-repo: mini-F0 in the target repo (its `context.md`) before touching it — the invariants are different. |
| Instrumenting a long-running service without restarting | The senders only post after the restart; restart with the runtime the repo requires (`engines`/`.nvmrc`) and confirm "listening". |
| Capturing with a loose `console.log` on stdout | Use the right channel: sender→debug server when you need to INJECT observation into the code (goes to the `.jsonl`); direct inspection (Playwright network/console, DB query) when the point already exists outside the code. The forbidden thing is loose, orphan stdout, not "I didn't bring up the server". |
| "It didn't work" → editing inline and continuing to try | Reopening = F9: STOP editing, count it as a circuit-breaker attempt, re-enter F2 with the report as state.md, re-instrument and prove the NEW state before any fix. Don't turn into raw Claude. |
| Declaring resolved with a green unit test | A unit test is F6, not F4. The closing-gate requires a **real runtime** re-repro (the human's symptom disappearing in the app), which the test doesn't substitute. |
| Committing a fix the human said doesn't work | Under an unconfirmed reopening the status is `fix-applied`, never `resolved`. Only commit if the human asks, and record in the report that the symptom is still open — never mask it as resolved in git. |
| Stacking reproduction attempts via the same failed method | If the repro doesn't fire after 2 attempts via the same path (e.g. automating a player/canvas/3rd party), stop: ask the human to trigger the real flow and you observe. Each failed attempt counts in the breaker. |
| Inflating the context by editing everything in the orchestrator | Every fix of every round (including post-reopening) is a fresh fix-executor with TDD. An orchestrator that edits inline across 4 rounds blows up the context — it's the symptom of having abandoned the flow. |
| Loose `.md` and `.jsonl` in `docs/debug/` | Folder-per-session: `docs/debug/<slug>/` with `report.md` AND `session.jsonl` inside. In multi-repo, in the repo where the session started. |
| Leaving the dev environment altered | If you restarted/tore down a service to instrument, restore it to the original state in the closing-gate. |
| Thinking Playwright is only for the visual | When the auth lives in the browser, Playwright triggers the backend flow; and `browser_evaluate`/`run_code_unsafe` proves hit-testing (`elementFromPoint`). |
