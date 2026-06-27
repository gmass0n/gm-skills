#!/usr/bin/env node
// Lessons layer for the sdd workflow — a self-improving memory of real, grounded mistakes.
// The LLM supplies the JUDGMENT (read the failure, phrase the one-line lesson, ground it to a source);
// this script owns ALL the bookkeeping: stable IDs, dedup, recurrence, promotion, quarantine, pruning,
// budget-capped render. Splitting judgment from mechanics is what keeps the layer from rotting.
//
// Two files, two readers (see references/lessons.md):
//   docs/codebase/lessons/lessons.json  — canonical machine state (versioned; NEVER hand-edit)
//   docs/codebase/lessons/lessons.md    — rendered playbook (versioned; read-only; regenerated every write)
//
// Lifecycle: candidate (1st sighting) → confirmed (recurs in a 2nd distinct feature) →
//            quarantined (was loaded as guidance yet the error recurred → penalize, 2× = quarantine).
// A candidate that doesn't recur within window_days is auto-pruned.
//
// Usage:
//   node lessons.js init   [--dir <docs/codebase/lessons>]
//   node lessons.js add    --signal <s> --lesson "<text>" --source <file:line|grep:...|gate:...> [--feature <name>] [--scope <CONCERN-007|role>] [--dir <d>]
//   node lessons.js list   [--status confirmed|candidate|quarantined|all] [--top <N>] [--dir <d>]
//   node lessons.js penalize --id L-007 [--dir <d>]
//   node lessons.js prune  [--dir <d>]
//   node lessons.js status [--dir <d>]
//   node lessons.js --selftest
//
// Signals (1:1 with the emission points — see references/lessons.md):
//   surviving_mutant | ac_gap | spec_precision_gap | spec_deviation | gate_fail | root_cause
//   (root_cause is emitted by sdd:debug's closing gate when a runtime-confirmed bug had N affected callers)
//
// ponytail: pure stdlib (fs+path), zero deps, zero build. Dedup is exact-after-normalization
// (lowercase, punctuation stripped) — no embeddings; near-duplicate phrasings are an accepted limitation.

const fs = require('fs');
const path = require('path');

const DEFAULT_DIR = 'docs/codebase/lessons';
const SIGNALS = ['surviving_mutant', 'ac_gap', 'spec_precision_gap', 'spec_deviation', 'gate_fail', 'root_cause'];
const DEFAULTS = { promote_threshold: 2, window_days: 45, quarantine_threshold: 2, render_top_n: 10 };

// --- arg parsing (tiny; --flag value, plus bare --selftest) ----------------------------------------
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

// --- state io --------------------------------------------------------------------------------------
function paths(dir) {
  return { json: path.join(dir, 'lessons.json'), md: path.join(dir, 'lessons.md') };
}
function emptyState() {
  return { version: 1, config: { ...DEFAULTS }, next_id: 1, lessons: [] };
}
function load(dir) {
  const { json } = paths(dir);
  if (!fs.existsSync(json)) return emptyState();
  const s = JSON.parse(fs.readFileSync(json, 'utf8'));
  s.config = { ...DEFAULTS, ...(s.config || {}) };
  s.lessons = s.lessons || [];
  return s;
}
function save(dir, state, now) {
  const { json } = paths(dir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(json, JSON.stringify(state, null, 2) + '\n');
  fs.writeFileSync(paths(dir).md, render(state, now));
}

// --- helpers ---------------------------------------------------------------------------------------
function normKey(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}
function nowISO(now) { return (now || new Date()).toISOString().slice(0, 10); }
function daysBetween(aISO, bISO) {
  return Math.round((Date.parse(bISO) - Date.parse(aISO)) / 86400000);
}
// ponytail: promote_threshold is config-driven but never overridden today; reads DEFAULTS directly
// so statusOf stays pure (no state handle). Thread state.config here if the threshold becomes tunable.
function statusOf(l) {
  if (l.quarantined) return 'quarantined';
  if (l.features.length >= DEFAULTS.promote_threshold) return 'confirmed';
  return 'candidate';
}

// --- commands --------------------------------------------------------------------------------------
function cmdInit(dir, now) {
  const state = load(dir);
  save(dir, state, now);
  return { ok: true, dir };
}

function cmdAdd(dir, args, now) {
  // Grounding gate: a lesson with no source is an opinion, not a lesson.
  if (!args.source || args.source === true) {
    throw new Error('grounding gate: --source is required (a lesson with no grounding is an opinion, not a lesson)');
  }
  if (!args.lesson || args.lesson === true) throw new Error('--lesson is required');
  if (!args.signal || !SIGNALS.includes(args.signal)) {
    throw new Error(`--signal must be one of: ${SIGNALS.join(', ')}`);
  }
  const today = nowISO(now);
  const feature = args.feature && args.feature !== true ? args.feature : '(unspecified)';
  const state = load(dir);
  const key = normKey(args.lesson);
  let lesson = state.lessons.find((l) => l.key === key);

  if (lesson) {
    // Dedup: same lesson seen again. Recurrence counts only DISTINCT features.
    lesson.last_seen = today;
    lesson.recurrence = (lesson.recurrence || 0) + 1;
    if (!lesson.features.includes(feature)) lesson.features.push(feature);
    if (args.source !== true) lesson.sources = Array.from(new Set([...(lesson.sources || []), args.source]));
    if (args.scope && args.scope !== true && !lesson.scopes.includes(args.scope)) lesson.scopes.push(args.scope);
  } else {
    lesson = {
      id: `L-${String(state.next_id).padStart(3, '0')}`,
      key,
      signal: args.signal,
      text: args.lesson,
      features: [feature],
      sources: [args.source],
      scopes: args.scope && args.scope !== true ? [args.scope] : [],
      recurrence: 1,
      quarantined: false,
      penalties: 0,
      first_seen: today,
      last_seen: today,
    };
    state.next_id += 1;
    state.lessons.push(lesson);
  }
  save(dir, state, now);
  return { ok: true, id: lesson.id, status: statusOf(lesson), recurrence: lesson.recurrence };
}

function cmdPenalize(dir, args, now) {
  if (!args.id || args.id === true) throw new Error('--id is required');
  const state = load(dir);
  const lesson = state.lessons.find((l) => l.id === args.id);
  if (!lesson) throw new Error(`no lesson ${args.id}`);
  lesson.penalties = (lesson.penalties || 0) + 1;
  lesson.last_seen = nowISO(now);
  if (lesson.penalties >= state.config.quarantine_threshold) lesson.quarantined = true;
  save(dir, state, now);
  return { ok: true, id: lesson.id, penalties: lesson.penalties, quarantined: lesson.quarantined };
}

function cmdPrune(dir, now) {
  const state = load(dir);
  const today = nowISO(now);
  const before = state.lessons.length;
  // Prune only CANDIDATES past the window. Confirmed/quarantined are durable.
  state.lessons = state.lessons.filter((l) => {
    if (statusOf(l) !== 'candidate') return true;
    return daysBetween(l.last_seen, today) < state.config.window_days;
  });
  const pruned = before - state.lessons.length;
  save(dir, state, now);
  return { ok: true, pruned, remaining: state.lessons.length };
}

function cmdList(dir, args) {
  const state = load(dir);
  const want = args.status && args.status !== true ? args.status : 'confirmed';
  const top = args.top && args.top !== true ? parseInt(args.top, 10) : state.config.render_top_n;
  let lessons = state.lessons.map((l) => ({ ...l, status: statusOf(l) }));
  if (want !== 'all') lessons = lessons.filter((l) => l.status === want);
  lessons.sort((a, b) => b.recurrence - a.recurrence);
  const shown = lessons.slice(0, top);
  const overflow = lessons.length - shown.length;
  return { ok: true, status: want, total: lessons.length, shown: shown.length, overflow, lessons: shown };
}

function cmdStatus(dir) {
  const state = load(dir);
  const by = { confirmed: 0, candidate: 0, quarantined: 0 };
  for (const l of state.lessons) by[statusOf(l)]++;
  return { ok: true, total: state.lessons.length, ...by, next_id: state.next_id };
}

// --- render (the .md projection — budget-capped top-N by recurrence) -------------------------------
function render(state, now) {
  const top = state.config.render_top_n;
  const groups = { confirmed: [], candidate: [], quarantined: [] };
  for (const l of state.lessons) groups[statusOf(l)].push(l);
  for (const k of Object.keys(groups)) groups[k].sort((a, b) => b.recurrence - a.recurrence);

  const section = (title, list) => {
    if (!list.length) return `## ${title}\n\n_None._\n`;
    const shown = list.slice(0, top);
    const lines = shown.map(
      (l) => `- **${l.id}** (${l.signal}, ×${l.recurrence}${l.scopes.length ? `, scope: ${l.scopes.join('/')}` : ''}): ${l.text}`
    );
    const overflow = list.length - shown.length;
    if (overflow > 0) lines.push(`- _(+${overflow} more lessons in lessons.json)_`);
    return `## ${title}\n\n${lines.join('\n')}\n`;
  };

  return [
    '<!-- GENERATED by lessons.js — read-only, do not hand-edit. Source of truth: lessons.json -->',
    `# Lessons — project playbook`,
    '',
    `_Generated ${nowISO(now)}. Confirmed lessons load into sdd:spec / sdd:plan as guidance._`,
    '',
    section('Confirmed', groups.confirmed),
    section('Candidate', groups.candidate),
    section('Quarantined', groups.quarantined),
  ].join('\n');
}

// --- selftest (the runnable check ponytail requires) -----------------------------------------------
function selftest() {
  const assert = require('assert');
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lessons-'));
  const D = (iso) => new Date(`${iso}T00:00:00Z`);

  // grounding gate: add without --source is refused
  assert.throws(
    () => cmdAdd(tmp, { signal: 'ac_gap', lesson: 'x' }, D('2026-01-01')),
    /grounding gate/, 'add must refuse without --source'
  );

  // bad signal refused
  assert.throws(
    () => cmdAdd(tmp, { signal: 'bogus', lesson: 'x', source: 'f:1' }, D('2026-01-01')),
    /--signal must be/, 'add must refuse an unknown signal'
  );

  // root_cause is an accepted signal (sdd:debug emits it) — isolated dir so it doesn't skew counts below
  const tmpRC = fs.mkdtempSync(path.join(os.tmpdir(), 'lessons-'));
  assert.doesNotThrow(
    () => cmdAdd(tmpRC, { signal: 'root_cause', lesson: 'shared mapper missed null upstream', source: 'm.ts:7', feature: 'dbg' }, D('2026-01-01')),
    'root_cause must be an accepted signal'
  );
  fs.rmSync(tmpRC, { recursive: true, force: true });

  // first add → candidate
  let r = cmdAdd(tmp, { signal: 'ac_gap', lesson: 'Guard the empty list before mapping', source: 'a.ts:10', feature: 'feat-A' }, D('2026-01-01'));
  assert.strictEqual(r.status, 'candidate', '1st sighting is candidate');
  assert.strictEqual(r.id, 'L-001');

  // duplicate (normalized) in SAME feature → no new id, recurrence up, still candidate
  r = cmdAdd(tmp, { signal: 'ac_gap', lesson: 'guard the EMPTY list before mapping!!', source: 'a.ts:10', feature: 'feat-A' }, D('2026-01-02'));
  assert.strictEqual(r.id, 'L-001', 'dedup: normalized text reuses the id');
  assert.strictEqual(r.status, 'candidate', 'same feature does not promote');
  assert.strictEqual(cmdStatus(tmp).total, 1, 'no duplicate row created');

  // recurrence in a 2nd DISTINCT feature → confirmed
  r = cmdAdd(tmp, { signal: 'ac_gap', lesson: 'Guard the empty list before mapping', source: 'b.ts:20', feature: 'feat-B' }, D('2026-01-03'));
  assert.strictEqual(r.status, 'confirmed', '2nd distinct feature promotes candidate→confirmed');

  // list --status confirmed returns it
  let lst = cmdList(tmp, { status: 'confirmed' });
  assert.strictEqual(lst.shown, 1, 'confirmed list has the promoted lesson');

  // penalize 2× → quarantined
  cmdPenalize(tmp, { id: 'L-001' }, D('2026-01-04'));
  r = cmdPenalize(tmp, { id: 'L-001' }, D('2026-01-05'));
  assert.strictEqual(r.quarantined, true, 'penalize 2× quarantines');
  assert.strictEqual(cmdList(tmp, { status: 'confirmed' }).shown, 0, 'quarantined drops out of confirmed');

  // budget cap: many confirmed lessons, list respects --top
  for (let i = 0; i < 15; i++) {
    cmdAdd(tmp, { signal: 'gate_fail', lesson: `cap lesson ${i}`, source: `c.ts:${i}`, feature: 'cap-A' }, D('2026-02-01'));
    cmdAdd(tmp, { signal: 'gate_fail', lesson: `cap lesson ${i}`, source: `c.ts:${i}`, feature: 'cap-B' }, D('2026-02-02'));
  }
  lst = cmdList(tmp, { status: 'confirmed', top: '10' });
  assert.strictEqual(lst.shown, 10, 'list caps at top-N');
  assert.ok(lst.overflow > 0, 'overflow is reported, not silently dropped');
  assert.ok(/\+\d+ more lessons/.test(fs.readFileSync(paths(tmp).md, 'utf8')), 'md projection shows overflow line');

  // prune: a stale candidate outside the window is dropped; a fresh one survives
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'lessons-'));
  cmdAdd(tmp2, { signal: 'ac_gap', lesson: 'stale candidate', source: 's.ts:1', feature: 'x' }, D('2026-01-01'));
  cmdAdd(tmp2, { signal: 'ac_gap', lesson: 'fresh candidate', source: 'f.ts:1', feature: 'x' }, D('2026-03-01'));
  r = cmdPrune(tmp2, D('2026-03-10')); // 45-day window: Jan-01 is >45d before Mar-10, Mar-01 is not
  assert.strictEqual(r.pruned, 1, 'prune drops the candidate outside the window');
  assert.strictEqual(r.remaining, 1, 'the in-window candidate survives');

  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(tmp2, { recursive: true, force: true });
  console.log('lessons.js --selftest: OK');
}

// --- dispatch --------------------------------------------------------------------------------------
function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selftest) { selftest(); return; }
  const cmd = args._[0];
  const dir = args.dir && args.dir !== true ? args.dir : DEFAULT_DIR;
  let result;
  try {
    switch (cmd) {
      case 'init': result = cmdInit(dir); break;
      case 'add': result = cmdAdd(dir, args); break;
      case 'list': result = cmdList(dir, args); break;
      case 'penalize': result = cmdPenalize(dir, args); break;
      case 'prune': result = cmdPrune(dir); break;
      case 'status': result = cmdStatus(dir); break;
      default:
        console.error('usage: lessons.js <init|add|list|penalize|prune|status|--selftest> [flags] (see header)');
        process.exit(2);
    }
  } catch (err) {
    // CLI errors (grounding gate, bad signal, unknown id) exit 1 with a clean message — no stack trace.
    console.error(`lessons.js: ${err.message}`);
    process.exit(1);
  }
  console.log(JSON.stringify(result, null, 2));
}

main();
