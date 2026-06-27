#!/usr/bin/env node
// Ephemeral debug server for the sdd:debug skill — local replica of Cursor's debug server.
// The instrumentation injected into the code (the "senders") POSTs to localhost:<port> with one
// JSON per event; this server only receives and appends, 1 JSON line per POST, into the capture
// file. The agent reads that file to confront runtime evidence vs hypotheses.
// Typical payload shape (free-form fields — the server stores any JSON; see runtime-capture.md):
//   {tag, hyp, stage, seq, var, value, file, line}  — `tag` (DEBUG-<hash>) is what F8 greps;
//   `stage`/`seq` make a flow chain readable by aggregation (1st missing stage = link that dies).
//
// Usage:  node debug-server.js [output-file] [port]
//   output-file  the skill passes docs/debug/<slug>/session.jsonl (folder-per-session);
//                default docs/debug/session.jsonl if omitted. The dir is created (recursive).
//   port         default 9999 (tries the next ones if busy)
//
// ponytail: pure stdlib (http+fs), zero deps, zero build. Starts in background, dies at F8.

const http = require('http');
const fs = require('fs');
const path = require('path');

const out = process.argv[2] || 'docs/debug/session.jsonl';
const basePort = parseInt(process.argv[3], 10) || 9999;

fs.mkdirSync(path.dirname(out), { recursive: true });

const server = http.createServer((req, res) => {
  // GET /health → liveness check (the agent confirms the channel is up before instrumenting)
  if (req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, out }));
    return;
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    // Accept the POST as received. If valid JSON, normalize into one line; otherwise store it raw
    // wrapped — a broken sender must never take down the capture.
    let line;
    try {
      line = JSON.stringify(JSON.parse(body));
    } catch {
      line = JSON.stringify({ raw: body });
    }
    fs.appendFileSync(out, line + '\n');
    res.end('ok');
  });
});

// Port busy → try the next one (up to +20). Very rare on localhost, but cheap to guard.
function listen(port, attempt = 0) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < 20) {
      listen(port + 1, attempt + 1);
    } else {
      console.error(`debug-server: failed to listen — ${err.message}`);
      process.exit(1);
    }
  });
  server.listen(port, '127.0.0.1', () => {
    // Line parseable by the agent: real port (may have changed) + capture file.
    console.log(JSON.stringify({ debugServer: 'up', port, out }));
  });
}

listen(basePort);
