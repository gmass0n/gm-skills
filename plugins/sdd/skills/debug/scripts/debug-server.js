#!/usr/bin/env node
// Debug server efêmero da skill sdd:debug — réplica local do debug server do Cursor.
// A instrumentação injetada no código (os "senders") faz POST localhost:<porta> com um
// JSON por evento; este servidor só recebe e faz append, 1 linha JSON por POST, no arquivo
// de captura. O agente lê esse arquivo para confrontar evidência de runtime vs hipóteses.
//
// Uso:  node debug-server.js [arquivo-de-saida] [porta]
//   arquivo-de-saida  default docs/debug/session.jsonl
//   porta             default 9999 (tenta as próximas se ocupada)
//
// ponytail: stdlib pura (http+fs), zero deps, zero build. Sobe em background, morre na F8.

const http = require('http');
const fs = require('fs');
const path = require('path');

const out = process.argv[2] || 'docs/debug/session.jsonl';
const basePort = parseInt(process.argv[3], 10) || 9999;

fs.mkdirSync(path.dirname(out), { recursive: true });

const server = http.createServer((req, res) => {
  // GET /health → liveness check (o agente confirma que o canal está de pé antes de instrumentar)
  if (req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, out }));
    return;
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    // Aceita o POST como veio. Se for JSON válido, normaliza numa linha; senão, grava cru
    // entre aspas — um sender quebrado nunca deve derrubar a captura.
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

// Porta ocupada → tenta a próxima (até +20). Raríssimo em localhost, mas barato blindar.
function listen(port, attempt = 0) {
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && attempt < 20) {
      listen(port + 1, attempt + 1);
    } else {
      console.error(`debug-server: falhou ao escutar — ${err.message}`);
      process.exit(1);
    }
  });
  server.listen(port, '127.0.0.1', () => {
    // Linha parseável pelo agente: porta real (pode ter mudado) + arquivo de captura.
    console.log(JSON.stringify({ debugServer: 'up', port, out }));
  });
}

listen(basePort);
