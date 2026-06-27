#!/usr/bin/env node
// Review bookkeeping layer for the sdd workflow — the deterministic work that lives OUTSIDE the LLM.
// Same split as lessons.js: the LLM gives the JUDGMENT (is this a real finding? what severity?);
// this script owns ALL the parsing — resolving the target, slicing the diff per lens, extracting
// symbols, grouping findings per file, tallying severities for the trailer, and the test-count delta.
// Counting/slicing/resolving is exact, repeated parsing — paying a reasoning tier for it is slow and
// non-deterministic (a trailer count must not vary between runs), so it belongs here.
//
// One file, six subcommands (see references + SKILL.md F1/F3/F4/F5/F6):
//   resolve   <arg?>            classify the target into 5 kinds, resolve the GitFlow base, emit the manifest
//   slice     --lens <dim>      [reads a manifest on stdin] the files/hunks of one lens's slice (path routing)
//   extract-symbols <path|->    new/defined symbols (for the DRY lens) — `rg`-backed, stdin or a path
//   group-findings  [<json>]    group findings by file for the per-file verification batch (F4)
//   tally           [<json>]    count by severity for the machine-readable trailer (F6) — deterministic
//   testcount <base> <head>     test-case delta vs base for the F5 gate (only diff/commit/range targets)
//
// ponytail: pure stdlib (fs + path + child_process for git/rg), zero deps, zero build, `--selftest`.
//   No JSON schema lib — the shapes are tiny and validated inline. No glob lib — git/rg do the matching.

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

// --- tiny arg parser (same shape as lessons.js: --flag value, bare --flag, positional in _) ---------
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else { out[key] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

// --- git/rg shells — never throw on a non-zero exit; return '' so callers degrade gracefully ---------
// ponytail: a missing binary or a non-git dir must not crash the script — the LLM reads the empty
// result and narrates "no repo" / "rg unavailable" rather than seeing a stack trace.
function sh(cmd, args, opts = {}) {
  try {
    const r = cp.spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
    if (r.status !== 0) return { ok: false, out: r.stdout || '', err: r.stderr || '' };
    return { ok: true, out: r.stdout || '', err: r.stderr || '' };
  } catch (e) {
    return { ok: false, out: '', err: String(e && e.message) };
  }
}
function git(args, cwd) { return sh('git', ['-C', cwd || '.', ...args]); }
function hasRg() { return sh('rg', ['--version']).ok; }

// --- generated-file exclusion: never review what a tool wrote ----------------------------------------
// Lockfiles, build output, snapshots, minified, vendored, declaration files. Listed in the manifest as
// "skipped: generated" so the skip is visible (no silent caps), never silently dropped.
const GENERATED = [
  /(^|\/)(dist|build|out|coverage|\.next|node_modules|vendor)\//,
  /(^|\/)[^/]+\.lock$/, /package-lock\.json$/, /pnpm-lock\.yaml$/, /yarn\.lock$/,
  /\.min\.(js|css)$/, /\.d\.ts$/, /\.snap$/, /\.map$/,
  /(^|\/)__snapshots__\//,
];
function isGenerated(file) { return GENERATED.some((re) => re.test(file)); }

// --- layer inference (path → layer) — the map's catalog is canonical; this is the cheap fallback -----
// ponytail: a coarse path heuristic, not a parse of context.md. The skill's F0 maps files to layers via
// the real catalog; this column is the degraded-mode default when the map is absent (ungrounded run).
function layerOf(file) {
  if (/(^|\/)(domain|entities|models)\//.test(file)) return 'domain';
  if (/(^|\/)(application|services|use-?cases|usecases)\//.test(file)) return 'application';
  if (/(^|\/)(data|repositories|adapters|gateways|infra|infrastructure)\//.test(file)) return 'data';
  if (/(^|\/)(ui|components|pages|app|views|screens|hooks)\//.test(file)) return 'ui';
  if (/(^|\/)(config|messages|i18n)\//.test(file)) return 'config';
  if (/(^|\/)(utils|helpers|lib|shared)\//.test(file)) return 'shared';
  return 'other';
}

// --- risk flag: which files gate the mutation sensor (F5) -------------------------------------------
// auth / payment / domain / service / contracts — the invariant table's high-risk zones. A diff that
// touches none of these → "sensor skip: no risk files". (P0-by-spec is decided by the skill, not here.)
function isRisk(file) {
  return /(auth|login|session|token|permission|guard)/i.test(file)
    || /(payment|invoice|billing|charge|refund|price|money|currency)/i.test(file)
    || /(^|\/)(domain|entities)\//.test(file)
    || /(^|\/)(services|use-?cases|usecases)\//.test(file)
    || /(contract|dto|schema|mapper|port)/i.test(file);
}

// --- lens → path routing (the slice). Each lens reviews only its dimension's files (F1). -------------
// Cuts 50-65% of the input: Security never sees a pure-CSS hunk, Performance never sees a config const.
// "correctness" is the catch-all (anything with logic) — it is the one lens that is never starved.
const LENS_ROUTES = {
  security: (f) => /(auth|login|session|token|permission|guard|input|valid|query|sql|fetch|axios|http|request|cors|crypto|password|secret|env)/i.test(f)
    || layerOf(f) === 'data',
  performance: (f) => /(loop|map|filter|reduce|query|render|memo|effect|list|paginat|batch|cache|index)/i.test(f)
    || ['data', 'ui'].includes(layerOf(f)),
  architecture: (f) => true, // sees everything: it judges topology + new files + DRY across the whole target
  correctness: (f) => /\.(ts|tsx|js|jsx|py|go|rb|java|kt|rs|php|cs)$/i.test(f), // anything with logic
  spec: (f) => true, // REQ-by-REQ over the whole target (only active when a spec exists)
};

// --- diff parsing: a unified diff → [{file, hunks:[{header, added:[{line,text}]}]}] ------------------
// We only need ADDED lines with their NEW-file line numbers (a review of a diff is a review of additions;
// for a file/dir target the whole file is fed in as synthetic additions). Deleted lines carry no review
// surface. The new-file line number comes from the @@ -a,b +c,d @@ header, advanced per non-removed line.
function parseUnifiedDiff(diff) {
  const files = [];
  let cur = null;
  let newLine = 0;
  const lines = diff.split('\n');
  for (const ln of lines) {
    if (ln.startsWith('diff --git')) {
      cur = null; // the real path comes from the +++ line below (handles renames/quotes uniformly)
      continue;
    }
    if (ln.startsWith('+++ ')) {
      let p = ln.slice(4).trim();
      if (p === '/dev/null') { cur = null; continue; }
      p = p.replace(/^b\//, '');
      cur = { file: p, hunks: [] };
      files.push(cur);
      continue;
    }
    if (!cur) continue;
    if (ln.startsWith('@@')) {
      const m = ln.match(/\+(\d+)/);
      newLine = m ? parseInt(m[1], 10) : 0;
      cur.hunks.push({ header: ln, added: [] });
      continue;
    }
    const hunk = cur.hunks[cur.hunks.length - 1];
    if (!hunk) continue;
    if (ln.startsWith('+')) { hunk.added.push({ line: newLine, text: ln.slice(1) }); newLine++; }
    else if (ln.startsWith('-')) { /* removed: no new-file line, don't advance */ }
    else { newLine++; } // context line advances the new-file counter
  }
  return files;
}

// --- GitFlow base resolution: first of develop/development/master/main that is an ancestor of HEAD,
// the most recent (largest merge-base distance forward). This is the declared base for a diff target. --
const BASE_CANDIDATES = ['develop', 'development', 'master', 'main'];
function resolveBase(cwd) {
  const cands = [];
  for (const b of BASE_CANDIDATES) {
    // prefer the local ref; fall back to origin/<b>
    for (const ref of [b, `origin/${b}`]) {
      const exists = git(['rev-parse', '--verify', '--quiet', ref], cwd).out.trim();
      if (!exists) continue;
      const anc = git(['merge-base', '--is-ancestor', ref, 'HEAD'], cwd);
      if (anc.ok) {
        const mb = git(['merge-base', 'HEAD', ref], cwd).out.trim();
        cands.push({ ref, mergeBase: mb });
      }
      break; // found this candidate (local or origin) — don't double-count
    }
  }
  if (!cands.length) return null;
  // "most recent" = the base whose merge-base is the furthest descendant. A merge-base that is an
  // ancestor of another candidate's merge-base is older; pick the one no other is a descendant of.
  let best = cands[0];
  for (const c of cands) {
    // if best.mergeBase is an ancestor of c.mergeBase, c is more recent → prefer c
    const r = git(['merge-base', '--is-ancestor', best.mergeBase, c.mergeBase], cwd);
    if (r.ok && c.mergeBase !== best.mergeBase) best = c;
  }
  return best;
}

// --- the manifest builder (the heart of `resolve`) --------------------------------------------------
function fileEntry(file, churn) {
  return { file, churn: churn || 0, layer: layerOf(file), risk: isRisk(file), generated: isGenerated(file) };
}

// classify the raw arg into one of the 5 target kinds (without touching git yet)
function classifyTarget(arg, cwd) {
  if (!arg || arg === true) return 'diff';            // empty → working/branch diff (skill disambiguates)
  if (arg === '--all' || arg === 'all') return 'repo';
  if (arg === '--paste' || arg === 'paste') return 'paste';
  if (arg === '--staged' || arg === '--working') return 'diff';
  if (/\.{2,3}/.test(arg)) return 'range';            // A..B or A...B
  // a path on disk (file/dir/glob) — check existence relative to cwd
  const abs = path.isAbsolute(arg) ? arg : path.join(cwd, arg);
  if (fs.existsSync(abs)) return 'path';
  if (/[*?[]/.test(arg)) return 'path';               // a glob even if it doesn't resolve yet
  // a lone sha/tag that exists → range-like (single commit); else assume a path the skill will report empty
  const isRev = git(['rev-parse', '--verify', '--quiet', arg], cwd).out.trim();
  if (isRev) return 'range';
  return 'path';
}

function listDiffFiles(range, cwd) {
  // numstat gives added\tdeleted\tfile — churn = added+deleted
  const r = git(['diff', '--numstat', ...range], cwd);
  const out = [];
  for (const ln of r.out.split('\n')) {
    const m = ln.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (!m) continue;
    const added = m[1] === '-' ? 0 : parseInt(m[1], 10);
    const deleted = m[2] === '-' ? 0 : parseInt(m[2], 10);
    out.push(fileEntry(m[3], added + deleted));
  }
  return out;
}

function cmdResolve(arg, cwd) {
  const kind = classifyTarget(arg, cwd);
  const inRepo = git(['rev-parse', '--is-inside-work-tree'], cwd).out.trim() === 'true';

  if (kind === 'paste') {
    return { ok: true, target: 'paste', grounded: 'partial', base: null, files: [], generated: [], note: 'paste target — no repo; the snippet is the scope' };
  }
  if (!inRepo && kind !== 'path') {
    return { ok: false, target: kind, error: 'not inside a git work tree' };
  }

  let files = [];
  let base = null;
  let declaredRange = [];

  if (kind === 'diff') {
    if (arg === '--staged') { declaredRange = ['--cached']; files = listDiffFiles(['--cached'], cwd); }
    else if (arg === '--working') { declaredRange = []; files = listDiffFiles([], cwd); }
    else {
      const b = resolveBase(cwd);
      if (!b) return { ok: false, target: 'diff', error: 'no GitFlow base branch (develop/development/master/main) is an ancestor of HEAD' };
      base = b.ref;
      declaredRange = [`${b.mergeBase}..HEAD`];
      files = listDiffFiles([`${b.mergeBase}..HEAD`], cwd);
    }
  } else if (kind === 'range') {
    const range = arg.includes('..') ? arg : `${arg}~1..${arg}`; // bare sha → that commit alone
    declaredRange = [range];
    files = listDiffFiles([range], cwd);
    base = arg.includes('..') ? arg.split(/\.{2,3}/)[0] : `${arg}~1`;
  } else if (kind === 'path') {
    // file/dir/glob: the WHOLE content is the scope (synthetic diff = file as additions).
    // Use git ls-files so .gitignore is respected; fall back to a recursive fs walk for untracked dirs.
    const tracked = git(['ls-files', '--', arg], cwd).out.split('\n').filter(Boolean);
    const found = tracked.length ? tracked : walkPath(arg, cwd);
    files = found.map((f) => fileEntry(f, 0));
  } else if (kind === 'repo') {
    const tracked = git(['ls-files'], cwd).out.split('\n').filter(Boolean);
    files = tracked.map((f) => fileEntry(f, 0));
  }

  const generated = files.filter((f) => f.generated).map((f) => f.file);
  const reviewable = files.filter((f) => !f.generated);

  return {
    ok: true,
    target: kind,
    grounded: inRepo ? 'yes' : 'partial',
    base,
    range: declaredRange,
    counts: { reviewable: reviewable.length, generated: generated.length },
    files: reviewable,
    generated,
  };
}

// recursive fs walk for an untracked path target (ponytail: only used when git ls-files is empty) -----
function walkPath(target, cwd) {
  const abs = path.isAbsolute(target) ? target : path.join(cwd, target);
  const out = [];
  const stack = [abs];
  while (stack.length) {
    const p = stack.pop();
    let st;
    try { st = fs.statSync(p); } catch { continue; }
    if (st.isDirectory()) {
      if (/(^|\/)(node_modules|\.git|dist|build|coverage)(\/|$)/.test(p)) continue;
      for (const ent of fs.readdirSync(p)) stack.push(path.join(p, ent));
    } else if (st.isFile()) {
      out.push(path.relative(cwd, p));
    }
  }
  return out;
}

// --- slice: filter a manifest's files to one lens's dimension ---------------------------------------
function cmdSlice(manifest, lens) {
  const route = LENS_ROUTES[lens];
  if (!route) throw new Error(`unknown lens "${lens}" — one of: ${Object.keys(LENS_ROUTES).join(', ')}`);
  const files = (manifest.files || []).filter((f) => route(f.file));
  return { ok: true, lens, count: files.length, files };
}

// --- extract-symbols: new/defined symbols for the DRY lens (the "extract" half, rg-backed) ----------
// Direction is target→repo (cheap): we list only the symbols the TARGET defines, so the lens can grep
// the repo for a pre-existing twin. We do NOT catalog the whole repo (that N² is the repo-audit case).
const SYMBOL_RE = [
  /\bfunction\s+([A-Za-z_$][\w$]*)/g,
  /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g, // arrow/fn assigned
  /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
  /\bclass\s+([A-Za-z_$][\w$]*)/g,
  /\bdef\s+([A-Za-z_$][\w$]*)/g, // python
  /\bfunc\s+([A-Za-z_$][\w$]*)/g, // go
];
function extractSymbolsFromText(text) {
  const syms = new Set();
  for (const re of SYMBOL_RE) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) if (m[1]) syms.add(m[1]);
  }
  return [...syms];
}
function cmdExtractSymbols(src, cwd) {
  let text;
  if (src === '-' || src === true) text = fs.readFileSync(0, 'utf8'); // stdin (a pasted diff/snippet)
  else {
    const abs = path.isAbsolute(src) ? src : path.join(cwd, src);
    text = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
  }
  // strip diff markers if it's a diff (review only what's ADDED — leading '+')
  const looksLikeDiff = /^\+\+\+ |^@@ /m.test(text);
  if (looksLikeDiff) {
    text = text.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1)).join('\n');
  }
  return { ok: true, symbols: extractSymbolsFromText(text), rg: hasRg() };
}

// --- group-findings: bucket findings by file so one verifier reads each file once (F4 batch) ---------
function readJsonArg(arg) {
  if (arg && arg !== true && arg !== '-') {
    const abs = path.resolve(arg);
    if (fs.existsSync(abs)) return JSON.parse(fs.readFileSync(abs, 'utf8'));
    return JSON.parse(arg); // inline JSON
  }
  return JSON.parse(fs.readFileSync(0, 'utf8')); // stdin ('-' or no arg)
}
function fileOf(f) { return (f.file || '').split(':')[0]; } // accept "src/x.ts:L42" or "src/x.ts"
function cmdGroupFindings(arg) {
  const findings = readJsonArg(arg);
  const byFile = {};
  for (const f of findings) {
    const key = fileOf(f) || '(unknown)';
    (byFile[key] = byFile[key] || []).push(f);
  }
  const groups = Object.keys(byFile).sort().map((file) => ({ file, count: byFile[file].length, findings: byFile[file] }));
  return { ok: true, fileCount: groups.length, findingCount: findings.length, groups };
}

// --- tally: count by severity for the machine-readable trailer (deterministic, never the LLM) -------
function cmdTally(arg) {
  const findings = readJsonArg(arg);
  const t = { blocker: 0, warning: 0, nit: 0, pre_existing: 0 };
  for (const f of findings) {
    const s = String(f.severity || '').toLowerCase();
    if (s in t) t[s]++;
    else if (s === 'pre-existing') t.pre_existing++;
  }
  const trailer = `<!-- sdd-review-severity: ${JSON.stringify(t)} -->`;
  return { ok: true, ...t, trailer };
}

// --- testcount: test-case delta vs base (F5 gate; only diff/commit/range, where a base exists) ------
// Counts test cases by grepping the test files at two revs. A silent drop is a blocker (a test deleted
// or .skip-ed to force green). ponytail: counts `it(`/`test(`/`def test_`, the common runners — not a
// parser; documented ceiling. The skill confirms the runner from testing.md before trusting the number.
const TEST_CASE_RE = /\b(it|test|Scenario)\s*\(|^\s*def\s+test_|\bfn\s+test_|\[Test\]|@Test\b/;
const TEST_FILE_RE = /(\.(test|spec)\.[jt]sx?|_test\.(go|py)|test_.*\.py|\.test\.py)$/i;
function countTestsAtRev(rev, cwd) {
  const list = git(['ls-tree', '-r', '--name-only', rev], cwd).out.split('\n').filter((f) => TEST_FILE_RE.test(f));
  let count = 0;
  const files = [];
  for (const f of list) {
    const blob = git(['show', `${rev}:${f}`], cwd).out;
    const n = blob.split('\n').filter((l) => TEST_CASE_RE.test(l)).length;
    if (n > 0) { count += n; files.push({ file: f, cases: n }); }
  }
  return { count, files: files.length };
}
function cmdTestcount(base, head, cwd) {
  if (!base || base === true || !head || head === true) throw new Error('testcount needs <base> <head> revs');
  const b = countTestsAtRev(base, cwd);
  const h = countTestsAtRev(head, cwd);
  return {
    ok: true,
    base: { rev: base, cases: b.count, files: b.files },
    head: { rev: head, cases: h.count, files: h.files },
    delta: h.count - b.count,
    regressed: h.count < b.count, // a drop with no legitimate removal is a gate blocker
  };
}

// --- selftest (the runnable check ponytail requires) ------------------------------------------------
function selftest() {
  const assert = require('assert');
  const os = require('os');

  // classifyTarget: the 5 kinds from the raw arg (no git needed for these)
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-'));
  assert.strictEqual(classifyTarget('', tmpdir), 'diff', 'empty arg → diff');
  assert.strictEqual(classifyTarget('--all', tmpdir), 'repo', '--all → repo');
  assert.strictEqual(classifyTarget('--paste', tmpdir), 'paste', '--paste → paste');
  assert.strictEqual(classifyTarget('HEAD~3..HEAD', tmpdir), 'range', 'A..B → range');
  assert.strictEqual(classifyTarget('v1.2..v1.3', tmpdir), 'range', 'tag range → range');
  fs.writeFileSync(path.join(tmpdir, 'real.ts'), 'x');
  assert.strictEqual(classifyTarget('real.ts', tmpdir), 'path', 'existing file → path');
  assert.strictEqual(classifyTarget('src/**/*.ts', tmpdir), 'path', 'glob → path');

  // isGenerated: lockfiles, dist, snapshots, .d.ts excluded; source kept
  assert.ok(isGenerated('pnpm-lock.yaml'), 'lockfile is generated');
  assert.ok(isGenerated('dist/app.js'), 'dist is generated');
  assert.ok(isGenerated('src/x.d.ts'), '.d.ts is generated');
  assert.ok(isGenerated('src/__snapshots__/a.snap'), 'snapshot is generated');
  assert.ok(!isGenerated('src/modules/orders/order.service.ts'), 'real source is not generated');

  // layerOf + isRisk
  assert.strictEqual(layerOf('src/domain/order.ts'), 'domain', 'domain layer');
  assert.strictEqual(layerOf('src/ui/components/Map.tsx'), 'ui', 'ui layer');
  assert.strictEqual(layerOf('src/config/messages/index.ts'), 'config', 'config layer');
  assert.ok(isRisk('src/auth/login.ts'), 'auth is risk');
  assert.ok(isRisk('src/services/payment.service.ts'), 'service+payment is risk');
  assert.ok(!isRisk('src/ui/components/Button.tsx'), 'a plain button is not risk');

  // slice: a lens only gets its dimension's files; architecture sees all; correctness sees logic files
  const manifest = {
    files: [
      { file: 'src/auth/login.ts' }, { file: 'src/ui/components/Button.tsx' },
      { file: 'styles/app.css' }, { file: 'src/services/order.service.ts' },
    ],
  };
  const sec = cmdSlice(manifest, 'security');
  assert.ok(sec.files.some((f) => f.file === 'src/auth/login.ts'), 'security slice keeps auth');
  assert.ok(!sec.files.some((f) => f.file === 'styles/app.css'), 'security slice drops pure css');
  assert.strictEqual(cmdSlice(manifest, 'architecture').count, 4, 'architecture sees every file');
  const corr = cmdSlice(manifest, 'correctness');
  assert.ok(!corr.files.some((f) => f.file === 'styles/app.css'), 'correctness drops css (no logic)');
  assert.throws(() => cmdSlice(manifest, 'bogus'), /unknown lens/, 'unknown lens refused');

  // parseUnifiedDiff: added lines carry their NEW-file line numbers
  const diff = [
    'diff --git a/src/x.ts b/src/x.ts',
    '--- a/src/x.ts',
    '+++ b/src/x.ts',
    '@@ -1,2 +1,3 @@',
    ' const a = 1;',
    '+const b = 2;',
    '-const old = 0;',
    '+const c = 3;',
  ].join('\n');
  const parsed = parseUnifiedDiff(diff);
  assert.strictEqual(parsed.length, 1, 'one file parsed');
  assert.strictEqual(parsed[0].file, 'src/x.ts', 'file path stripped of b/');
  const added = parsed[0].hunks[0].added;
  assert.deepStrictEqual(added.map((a) => a.text), ['const b = 2;', 'const c = 3;'], 'only added lines');
  assert.strictEqual(added[0].line, 2, 'const b is new-file line 2');
  assert.strictEqual(added[1].line, 3, 'const c is new-file line 3 (removed line did not advance)');

  // extract-symbols: function/const-arrow/class/def/func
  const syms = extractSymbolsFromText(
    'export function formatCurrency(x){}\nconst toBRL = (n) => n\nclass Money {}\ndef parse_amount():\nfunc Sum() {}'
  );
  for (const s of ['formatCurrency', 'toBRL', 'Money', 'parse_amount', 'Sum']) {
    assert.ok(syms.includes(s), `extracted ${s}`);
  }

  // group-findings: bucket by file, accept "file:Lline"
  const grouped = cmdGroupFindings(JSON.stringify([
    { file: 'src/a.ts:L10', claim: 'x' }, { file: 'src/a.ts:L20', claim: 'y' }, { file: 'src/b.ts:L5', claim: 'z' },
  ]));
  assert.strictEqual(grouped.fileCount, 2, 'two distinct files');
  assert.strictEqual(grouped.groups.find((g) => g.file === 'src/a.ts').count, 2, 'a.ts has 2 findings');

  // tally: severity counts + the exact trailer shape CI reads
  const tally = cmdTally(JSON.stringify([
    { severity: 'blocker' }, { severity: 'blocker' }, { severity: 'warning' },
    { severity: 'nit' }, { severity: 'pre-existing' },
  ]));
  assert.strictEqual(tally.blocker, 2, '2 blockers');
  assert.strictEqual(tally.pre_existing, 1, 'pre-existing normalized to pre_existing');
  assert.strictEqual(
    tally.trailer, '<!-- sdd-review-severity: {"blocker":2,"warning":1,"nit":1,"pre_existing":1} -->',
    'trailer is the exact machine-readable line'
  );

  // stdin path: `tally -` and a no-arg `tally` both read JSON from stdin (not parse "-" as JSON).
  // Exercised via a real subprocess pipe — the inline calls above can't cover fd 0.
  const self = __filename;
  for (const argv of [['tally', '-'], ['tally']]) {
    const piped = cp.spawnSync('node', [self, ...argv], {
      input: '[{"severity":"blocker"},{"severity":"nit"}]', encoding: 'utf8',
    });
    assert.strictEqual(piped.status, 0, `${argv.join(' ')} reads stdin without crashing`);
    // parse the child's JSON and assert the count — robust to pretty vs compact spacing/escaping
    assert.strictEqual(JSON.parse(piped.stdout).blocker, 1, `${argv.join(' ')} tallied from stdin`);
  }

  // a git-backed round-trip: build a tiny repo, branch, diff, resolve, testcount
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'review-repo-'));
  const G = (...a) => cp.spawnSync('git', ['-C', repo, ...a], { encoding: 'utf8' });
  G('init', '-q'); G('config', 'user.email', 't@t'); G('config', 'user.name', 't'); G('checkout', '-q', '-b', 'master');
  fs.writeFileSync(path.join(repo, 'a.ts'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(repo, 'a.spec.ts'), "it('a', () => {});\nit('b', () => {});\n");
  G('add', '-A'); G('commit', '-qm', 'base');
  G('checkout', '-q', '-b', 'feature/x');
  fs.writeFileSync(path.join(repo, 'a.ts'), 'export const a = 1;\nexport const b = 2;\n');
  fs.writeFileSync(path.join(repo, 'a.spec.ts'), "it('a', () => {});\n"); // dropped one test → regression
  G('add', '-A'); G('commit', '-qm', 'feat');
  const res = cmdResolve('', repo);
  assert.strictEqual(res.target, 'diff', 'default target is diff');
  assert.strictEqual(res.base, 'master', 'base resolved to master');
  assert.ok(res.files.some((f) => f.file === 'a.ts'), 'a.ts in the diff manifest');
  const tc = cmdTestcount('master', 'feature/x', repo);
  assert.strictEqual(tc.delta, -1, 'one test dropped');
  assert.strictEqual(tc.regressed, true, 'a silent test drop is flagged');

  // path target: whole file content is the scope (synthetic additions), generated excluded
  const pres = cmdResolve('a.ts', repo);
  assert.strictEqual(pres.target, 'path', 'a path arg → path target');
  assert.ok(pres.files.some((f) => f.file === 'a.ts'), 'path target lists the file');

  fs.rmSync(tmpdir, { recursive: true, force: true });
  fs.rmSync(repo, { recursive: true, force: true });
  console.log('review.js --selftest: OK');
}

// --- dispatch --------------------------------------------------------------------------------------
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selftest) { selftest(); return; }
  const cmd = args._[0];
  const cwd = args.cwd && args.cwd !== true ? args.cwd : '.';
  let result;
  try {
    switch (cmd) {
      case 'resolve':
        result = cmdResolve(args._[1] !== undefined ? args._[1] : (args.staged ? '--staged' : args.working ? '--working' : args.all ? '--all' : args.paste ? '--paste' : ''), cwd);
        break;
      case 'slice': {
        const manifest = readJsonArg(args.manifest);
        result = cmdSlice(manifest, args.lens && args.lens !== true ? args.lens : '');
        break;
      }
      case 'extract-symbols': result = cmdExtractSymbols(args._[1] !== undefined ? args._[1] : '-', cwd); break;
      case 'group-findings': result = cmdGroupFindings(args._[1]); break;
      case 'tally': result = cmdTally(args._[1]); break;
      case 'testcount': result = cmdTestcount(args._[1], args._[2], cwd); break;
      default:
        console.error('usage: review.js <resolve|slice|extract-symbols|group-findings|tally|testcount|--selftest> [flags] (see header)');
        process.exit(2);
    }
  } catch (err) {
    console.error(`review.js: ${err.message}`);
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}

main();
