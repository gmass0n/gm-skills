# Runtime capture — read this when instrumenting (F3) and reproducing (F4)

Debug Mode trades guessing for evidence. This is the mechanics of how to obtain that evidence in Claude Code: the local debug server (the **always** channel), the senders per language, how to restart the target service and automate the repro, and Playwright both for what the log doesn't see and as a trigger for an authenticated flow.

**Who executes:** the injection of the senders (F3) and their removal (F8) are **commissioned to subagents** — the `instrumentation-executor` injects, the `closing-gate` removes and proves grep-zero. The orchestrator never writes those senders in its own context; it passes this doc in the subagent's briefing and reads the manifest/verdict back. The mechanics below are what goes in the briefing.

## Two capture modes: injected instrumentation vs. direct inspection

There are two legitimate ways to obtain runtime. Choose by the nature of the observation point, not by laziness:

**1. Injected instrumentation (debug server) — when the observation point does NOT exist and you need to create it inside the code.** Value of an internal variable, which branch was taken, timing between layers, state at a boundary. There, the sender with `// DEBUG-<hash>` POSTs to the debug server, the capture lands structured in the `.jsonl`, and grep-zero cleans it up. It's the **mandatory** channel for that case — a loose `console.log` on stdout won't do (fragile, vanishes in the worker/SSR/container, orphaned in the diff).

**2. Direct inspection — when the observation point ALREADY exists outside the code.** Don't instrument what you can observe from outside:
- **Frontend / request / render** → Playwright: `browser_network_requests` (the real request/response/status), `browser_console_messages`, `browser_evaluate`. The Network tab is already the evidence — attach it to the report.
- **"Did it really save?" / persistence** → direct query to the DB. Does the record exist? with what value? did `updatedAt` change? It's the strongest proof that the flow reached the end — stronger than a sender mid-path.
- **Already-exposed state** (`window.__x`, a header, a log the service already writes) → read it directly.

Attach the inspection's evidence to the `.jsonl`/report as a citable line, same as the sender. **The real rule isn't "always use the server"; it's "no fix without runtime that confirms the hypothesis".** The sin is deducing from reading the code and calling it proof. Direct inspection IS runtime. What follows is the mechanics of mode 1 (the server), because that's what needs scaffolding; mode 2 uses the tools you already have.

## The debug server — the channel for injected instrumentation

When mode 1 applies, the capture goes through the debug server, with no loose `console.log`. Cursor solves this with a debug server in an extension — the instrumentation does a `POST localhost` and the server aggregates everything. We replicate this with `scripts/debug-server.js`:

- **Pure stdlib (`http`+`fs`), zero dependencies, zero build.** Runs in any Node project without installing anything. For non-Node projects it still serves: it's a language-agnostic HTTP endpoint, and the sender (in Python, Go, etc.) only needs to make a POST.
- **Structured capture.** Each POST becomes 1 JSON line in `docs/debug/<slug>/session.jsonl` (the session folder created in F0; the `report.md` is its sibling). `{tag, hyp, stage, seq, var, value, file, line}` is parseable; you read the file and cross-reference with the hypotheses without guessing.
- **Single channel — including multi-repo.** Backend and frontend POST to the same server → the evidence from both sides (from two repos, included) lands in the same `session.jsonl`, in the real order of events. That's why the session folder lives in a single repo: everything converges in one place.
- **Terminal-independent.** It doesn't matter which process emitted it — the POST always arrives.

## Reading the `.jsonl` by aggregation — verdict, not bytes

The one who reads the `.jsonl` is a **subagent** (the orchestrator is pure — it never reads the raw capture). And the subagent **does not dump the file into the digest**: it **aggregates and returns only the verdict**. Dumping hundreds of raw events into the orchestrator's context is the opposite of what structured capture exists to avoid.

- **Chain bug (type c):** count hits per `stage` and report **the first `stage` with zero hits** — it's the link where the flow dies.
  ```bash
  # hits per stage; the 1st with 0 is where the chain dies
  node -e 'let c={};require("fs").readFileSync("docs/debug/<slug>/session.jsonl","utf8").split("\n").filter(Boolean).forEach(l=>{try{let s=JSON.parse(l).stage||"?";c[s]=(c[s]||0)+1}catch{}});console.log(JSON.stringify(c))'
  ```
  The subagent returns `{"event-fired":0,"handler-entered":0,...}` (≈1 line), not the events. Real case: `event-fired:0` isolated the cause (the player never fires `timeupdate`) without reading a single raw payload.
- **Point bug (a/b):** aggregate per `hyp` — which hypothesis had confirmatory evidence, and the value observed at the boundary. Same principle: the orchestrator reads the aggregated verdict and decides the cause; the raw bytes stay in the `.jsonl`.

## Starting and tearing down the server (lifecycle)

```bash
# Start in background in F3. The slug names the session folder; the capture goes inside it.
node scripts/debug-server.js docs/debug/<slug>/session.jsonl 9999 &
# The 1st stdout line is parseable: {"debugServer":"up","port":9999,"out":"docs/debug/<slug>/session.jsonl"}
# If 9999 is busy, the server tries 9999+1..9999+20 and reports the real port on that line — use it in the sender.

# Confirm the channel is up before instrumenting:
curl -s localhost:9999/health    # → {"ok":true,"out":"..."}

# Tear down in F8, in this order:
kill <pid>                              # 1. kill the process (pid saved at start, recorded in the manifest)
rm docs/debug/<slug>/session.jsonl      # 2. delete the capture BEFORE the grep (else the grep finds the tag inside it)
grep -rn "DEBUG-<hash>" .               # 3. prove grep-zero in the code — in EACH instrumented repo
```

**Disciplined lifecycle (the F8 closing-gate depends on it):** the server starts in F3, lives through F4–F6 **and through the F8 re-repro** — because the **same `session.jsonl` holds the "before" (bug) and the "after" (fix)**, and the delta between the two is the cheapest proof that the symptom is gone (see F8, item 1). Only **after** the closing-gate reads that delta does the server die, the `.jsonl` get deleted, and the senders get removed (grep-zero **in each repo**). Deleting the `.jsonl` or removing senders *before* the post-fix re-repro discards the cheapest proof and forces manual re-instrumentation (rework). **The cleanup order matters:** delete the `.jsonl` before grep-zero, otherwise `grep` finds the `DEBUG-<hash>` itself inside the capture file (where it belongs) and grep-zero never closes. Nothing of the server survives the end of the debug. Record port + pid + path of the `.jsonl` in the report's manifest as soon as it starts.

## Senders per language

The server is the same; only the snippet injected in the code changes. Every sender POSTs the same JSON shape and **must never break the app** (it swallows its own error). The `tag` carries the session's `DEBUG-<hash>` for cleanup.

Always mark each insertion with the **anchor comment** on the line above, so F8 removes it unambiguously (Cursor uses "clear comments which help the AI clean them up later"):
```
// DEBUG-a4f2 (sdd:debug) — remove on cleanup
```

**JavaScript / TypeScript (browser or Node 18+):**
```js
// DEBUG-a4f2 (sdd:debug) — remove on cleanup
fetch('http://localhost:9999',{method:'POST',body:JSON.stringify({tag:'DEBUG-a4f2',hyp:'H2',stage:'http-sent',seq:3,var:'payload',value:payload,file:'foo.ts',line:42})}).catch(()=>{});
```

**Payload fields** (all optional except `tag`; the server stores any JSON, so adding fields breaks nothing):
- `tag` — the session's `DEBUG-<hash>` (**mandatory**; it's what F8 greps to remove).
- `hyp` — which hypothesis this sender tests (`H2`), to cross-reference evidence with hypothesis.
- `var` / `value` — the observed variable and its value at runtime (can be `null`/`undefined`/object).
- `file` / `line` — where the sender lives.
- **`stage`** — the chain link, in a **flow bug** (type c): `event-fired | handler-entered | guard-passed | http-sent | http-acked | persisted` (or the flow's real names). It's what makes the chain readable in one pass: **the first `stage` missing in the `.jsonl` is the link where the flow dies** — and isolating that kills several hypotheses at once (see F2, "point bug vs. chain"). In a point bug (a/b) it's dispensable.
- **`seq`** — increasing integer per sender (or use the arrival order in the `.jsonl`); together with `stage` it reconstructs the real order of events when timing matters.

**Old Node (no `fetch`):**
```js
require('http').request({host:'localhost',port:9999,method:'POST'},()=>{}).on('error',()=>{}).end(JSON.stringify({tag:'DEBUG-a4f2',var:'user',value:user}));
```

**Python:**
```python
import urllib.request, json
try: urllib.request.urlopen('http://localhost:9999', json.dumps({'tag':'DEBUG-a4f2','var':'user','value':repr(user)}).encode(), timeout=0.2)
except Exception: pass
```

**Go:**
```go
b, _ := json.Marshal(map[string]any{"tag": "DEBUG-a4f2", "var": "user", "value": user})
http.Post("http://localhost:9999", "application/json", bytes.NewReader(b)) // error ignored on purpose
```

**Generic (any language with a shell at hand):**
```bash
curl -s -XPOST localhost:9999 -d '{"tag":"DEBUG-a4f2","var":"user","value":"'"$USER_VAL"'"}' >/dev/null 2>&1 || true
```

The `DEBUG-<hash>` in the `tag` is what F8 greps to remove. Use the same hash in all senders of a session.

## Restarting the target service (mandatory for long-running; critical in multi-repo)

The senders only start posting to the debug server **after the service that contains them is restarted**. Instrumenting a backend/watcher and not restarting it = empty `.jsonl` and the false conclusion that the repro didn't fire. Sequence:

1. **Find out how the service runs.** `lsof -ti:<port>` gives the PID listening on the port; `ps aux | grep <name>` shows the exact command (watch? dist? which entrypoint?).
2. **Restart with the runtime THAT repo requires.** Check `engines`/`.nvmrc`/`package.json` of the target repo — in multi-repo the 2nd repo may require another Node version that the manager *blocks* if you use the wrong one. Real case: `engines.node>=24` made `pnpm start` fail under Node 22; the way out was to use Node 24 (via nvm) and run the compiled entrypoint directly (`node dist/main.js`), bypassing the manager's gate.
3. **Capture the boot stdout** (redirect to a file) and confirm the "listening on ..." before firing the repro — otherwise you fire against a service that didn't come up.
4. **If you tore down the dev process, note it in the manifest and RESTORE it in F8.** The closing-gate brings the service back up in its original mode (watch/dev, same runtime). The human's environment must not end up different from how it started.

## Deterministic repro ranking

Reproducing is a prerequisite for everything. The *automated* repro is what makes the rest mechanical — you run it as many times as you want, without depending on the human, and it becomes the regression test later. Try from top to bottom as the case allows:

1. **A test that fails at the right seam** — the best. The minimized repro from F1 written as a red test **is** the fix-executor's RED test in F6 — it becomes the regression test itself. Zero rework.
2. **HTTP script / `curl`** at the endpoint that triggers the bug — deterministic for API/backend bugs. **But:** if the auth lives in an httpOnly cookie / server-side session, `curl` fails (no token) — skip to #3 Playwright.
3. **Playwright with a real session — trigger, not just capture.** When the token is in the browser (httpOnly cookie), the **logged-in browser triggers the backend flow** that `curl` can't reach: navigate/interact to fire the request, and read the evidence in the `session.jsonl`. Real case: `GET /courses` required a session bearer; `curl` returned 401, but reopening the popover in the logged-in browser fired the fetch and the sender captured the raw payload. Playwright (`browser_navigate` + interactions) is also the default deterministic repro for UI/frontend bugs.
4. **CLI with snapshot diff** — run the command, capture the output, compare with the expected. Good for silent flow (type c): the diff points to where it diverged.
5. **Differential** — run the working version and the broken one, compare the two `.jsonl`. The first line that differs is the clue. Useful for regressions.

Only fall back to **"human triggers in the real app"** when none of the five is viable (needs a real login, hand-mounted state, hardware). There it's Debug Mode's back-and-forth: the human gives the steps, the agent reads the `session.jsonl`.

## Capture per bug type

**(a) backend / console / terminal**
- Sender at the hypothesis points; the server captures everything in the `.jsonl`.
- Repro by the ranking above (#1 test, #2 curl). If it needs a real environment, the human runs it and the agent reads the `.jsonl`.
- Evidence: value of the variables, branch taken, the exception with the real line.

**(b) frontend / screen — Playwright MCP is the complement AND the trigger**
The sender in the browser JS POSTs to the same server (the front's *logic* lands in the `.jsonl`). But the **visual and the geometry** the log doesn't capture — for that, Playwright:
- `browser_navigate` → the repro URL.
- `browser_console_messages` → browser console errors/warns (even what the sender doesn't already cover).
- `browser_network_requests` → requests that failed, status, payload (API bug seen from the client).
- `browser_snapshot` → the accessible DOM (missing element, broken render).
- `browser_take_screenshot` → the visual state (blank screen, crooked layout).
- `browser_click` / `browser_fill_form` → the agent reproduces the flow on its own when no human is needed (includes triggering an authenticated backend flow — see #3 of the ranking).
- `browser_run_code_unsafe` / `browser_evaluate` → **proof of hit-testing and geometry.** `document.elementFromPoint(x,y)` confirms WHICH element receives a click (kills the false-negative of "I clicked but it didn't close" when the click landed on another element, e.g. an overlapping header); `getBoundingClientRect()` measures boxes to validate that an overlay/close covers the right area. Real case: the "click on the backdrop doesn't close" was the click landing on the app header, not the backdrop — only `elementFromPoint` proved where the pointer was landing.

**(c) wrong / silent flow — instrumentation is mandatory**
There's no error to capture; what defines the bug is the divergence. Put a sender at **each boundary** of the suspect flow, printing the *expected vs real* state at each step. Run the repro and read the sequence in the `.jsonl`: the line where the state diverges from the expected **is** the cause. This turns "wrong flow" (vague) into "at line 47 `x` is already wrong, but at 31 it was right" (localized). It's "runtime evidence rather than guessing" applied to the case without an exception.

## Fallbacks — rare exceptions, NOT a convenience route

The debug server is the always channel. The fallbacks below only kick in when the HTTP server is **technically unfeasible** — not because "it's faster" or "the service already logs to the terminal". `console.log`/stdout is not an acceptable shortcut; it's a last-resort fallback. Cursor itself only degrades to **"file writes in certain environments"** when the HTTP channel won't do. Order of preference:

1. **Direct file-write (no network).** In a sandbox without `localhost`, or an environment where opening a port fails, the sender writes the JSON line directly to the `.jsonl` instead of doing a POST — same structured capture, same file, same cleanup, just without the server in the middle:
   ```js
   // DEBUG-a4f2 (sdd:debug) — remove on cleanup
   require('fs').appendFileSync('docs/debug/<slug>/session.jsonl', JSON.stringify({tag:'DEBUG-a4f2',var:'user',value:user})+'\n');
   ```
   ```python
   # DEBUG-a4f2 (sdd:debug) — remove on cleanup
   open('docs/debug/<slug>/session.jsonl','a').write(__import__('json').dumps({'tag':'DEBUG-a4f2','value':repr(user)})+'\n')
   ```
   Doesn't work for the **browser** (no filesystem access) — there, the channel is Playwright (`browser_console_messages`) or the HTTP sender to the server running on the dev's machine.
2. **stdout/stderr of a deterministic repro.** Only when neither the server nor the file-write works. The agent runs the test/command and reads the direct output; the senders become `console.log`/`print` with a `[DEBUG-<hash>]` prefix. Less structured — last resort, not a preference.
3. **Human pastes the artifact they already have** (stack/log/screenshot). Zero cost, real evidence — always the first to try when they've already reproduced it.

In any fallback, the F8 discipline doesn't change: anchor comment + grep-zero (in each repo), and the `session.jsonl` deleted before the grep.
