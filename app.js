/* Color Code Inspection (CCI) – offline PWA, vanilla JS, no build step.
   Data lives in IndexedDB on this device only (single JSON document). */
(function () {
'use strict';

const APP_VERSION = '1.0.0';
const QR_PREFIX = 'CCI:';
const ID_DIGITS = 4;
const DB_NAME = 'cci-db';
const DB_STORE = 'kv';
const DB_KEY = 'state';
const BACKUP_REMIND_DAYS = 7;
const OTHER = 'Other';
const DEFAULT_TYPES = ['Harness', 'Ladder', 'Cable Reel', 'Light', 'Power Tool', 'Welding Machine', 'Chain Block', 'Lifeline', 'Anchorage Beam'];
const DEFAULT_TEAMS = ['Welder', 'Boiler', 'STG', 'Demin', 'Sewage', 'Electrical', 'Operation', 'Motor Shop', 'E&S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ---------------------------------------------------------------- helpers */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const pad2 = n => String(n).padStart(2, '0');
function toDate(d) { if (d instanceof Date) return d; if (!d) return null; const x = new Date(d); return isNaN(x.getTime()) ? null : x; }
function fmtDate(d, withYear) { d = toDate(d); if (!d) return ''; return pad2(d.getDate()) + '-' + MONTHS[d.getMonth()] + (withYear === false ? '' : '-' + d.getFullYear()); }
function fmtDateTime(d) { d = toDate(d); if (!d) return ''; return fmtDate(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
function ymd(d) { d = toDate(d); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function stamp(d) { return ymd(d).replace(/-/g, ''); }
function startOfDay(d) { d = toDate(d); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d, n) { const x = new Date(toDate(d).getTime()); x.setDate(x.getDate() + n); return x; }
const byId = (a, b) => a.id.localeCompare(b.id);
function pct(n, d) { return d ? Math.round((n / d) * 100) : 0; }

/* Test date override: open the app with ?today=YYYY-MM-DD (development only). */
const TODAY_OVERRIDE = (function () {
  const v = new URLSearchParams(location.search).get('today');
  if (!v) return null;
  const d = new Date(v + 'T12:00:00');
  return isNaN(d.getTime()) ? null : d;
})();
function now() {
  if (!TODAY_OVERRIDE) return new Date();
  const t = new Date();
  return new Date(TODAY_OVERRIDE.getFullYear(), TODAY_OVERRIDE.getMonth(), TODAY_OVERRIDE.getDate(), t.getHours(), t.getMinutes(), t.getSeconds());
}

/* ------------------------------------------------------------- label ids */
function normalizeId(raw) {
  let s = String(raw == null ? '' : raw).trim().toUpperCase().replace(/\s+/g, '');
  if (!s) return null;
  if (/^\d+$/.test(s)) { if (s.length > 6) return null; return s.padStart(ID_DIGITS, '0'); }
  if (/^[A-Z0-9-]{2,12}$/.test(s)) return s;
  return null;
}
function parseQr(text) {
  const t = String(text == null ? '' : text).trim();
  if (t.toUpperCase().indexOf(QR_PREFIX) !== 0) return null;
  return normalizeId(t.slice(QR_PREFIX.length));
}

/* --------------------------------------------------------------- quarters */
function quarterInfo(d) {
  d = toDate(d);
  const y = d.getFullYear(), q = Math.floor(d.getMonth() / 3) + 1;
  return { year: y, q, key: y + '-Q' + q, start: new Date(y, (q - 1) * 3, 1), end: new Date(y, q * 3, 0, 23, 59, 59, 999) };
}
function prevQuarterInfo(qi) { return quarterInfo(new Date(qi.year, (qi.q - 1) * 3 - 1, 1)); }
function parseQuarterKey(key) {
  const m = /^(\d{4})-Q([1-4])$/.exec(String(key));
  return m ? quarterInfo(new Date(+m[1], (+m[2] - 1) * 3, 1)) : null;
}
function quarterColor(q) { return S.settings.quarterColors['Q' + q] || { name: '?', hex: '#777777' }; }
function graceDeadline(qi) { return addDays(qi.start, Math.max(0, (S.settings.graceDays | 0) - 1)); }
function inGrace(qi, d) { const days = Math.round((startOfDay(d) - qi.start) / 864e5); return days < (S.settings.graceDays | 0); }
function textOn(hex) {
  const c = String(hex || '').replace('#', '');
  if (c.length < 6) return '#fff';
  const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? '#111' : '#fff';
}

/* ------------------------------------------------------------------ state */
function defaultSettings() {
  return {
    quarterColors: {
      Q1: { name: 'YELLOW', hex: '#FFD600' },
      Q2: { name: 'BROWN', hex: '#8B5A2B' },
      Q3: { name: 'BLUE', hex: '#1E64D8' },
      Q4: { name: 'GREEN', hex: '#14A44D' }
    },
    graceDays: 14,
    types: DEFAULT_TYPES.slice(),
    teams: DEFAULT_TEAMS.slice(),
    inspector: 'Jackis',
    lastType: '',
    lastTeam: '',
    lastBackupAt: null
  };
}
function defaultState() { return { schema: 1, items: {}, inspections: [], replaced: {}, nextRecId: 1, settings: defaultSettings() }; }
function migrate(st) {
  const out = Object.assign(defaultState(), st && typeof st === 'object' ? st : {});
  const ds = defaultSettings();
  out.settings = Object.assign(ds, (st && st.settings) || {});
  out.settings.quarterColors = Object.assign(defaultSettings().quarterColors, out.settings.quarterColors || {});
  if (!Array.isArray(out.settings.types) || !out.settings.types.length) out.settings.types = DEFAULT_TYPES.slice();
  if (!Array.isArray(out.settings.teams) || !out.settings.teams.length) out.settings.teams = DEFAULT_TEAMS.slice();
  if (!out.items || typeof out.items !== 'object' || Array.isArray(out.items)) out.items = {};
  if (!Array.isArray(out.inspections)) out.inspections = [];
  if (!out.replaced || typeof out.replaced !== 'object') out.replaced = {};
  if (!Number.isInteger(out.nextRecId)) out.nextRecId = out.inspections.reduce((m, r) => Math.max(m, r.recId | 0), 0) + 1;
  return out;
}

const DB = {
  _p: null,
  open() {
    if (!this._p) {
      this._p = new Promise((res, rej) => {
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = () => { r.result.createObjectStore(DB_STORE); };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error || new Error('IndexedDB open failed'));
      });
    }
    return this._p;
  },
  async get(key) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const rq = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  },
  async set(key, val) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(val, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error || new Error('aborted'));
    });
  }
};

let S = defaultState();
let saveChain = Promise.resolve();
function persist() {
  const snapshot = JSON.parse(JSON.stringify(S));
  saveChain = saveChain.then(() => DB.set(DB_KEY, snapshot)).catch(e => {
    console.error(e);
    toast('SAVE FAILED: ' + (e && e.message ? e.message : e));
  });
  return saveChain;
}

/* ----------------------------------------------------------------- domain */
function items() { return Object.values(S.items); }
function activeItems() { return items().filter(i => i.status !== 'Retired'); }
function recordsFor(id) { return S.inspections.filter(r => r.itemId === id); }
function latestIn(id, qkey) {
  let best = null;
  for (const r of S.inspections) if (r.itemId === id && r.quarter === qkey && (!best || r.recId > best.recId)) best = r;
  return best;
}
function lastRecord(id) {
  let best = null;
  for (const r of S.inspections) if (r.itemId === id && (!best || r.recId > best.recId)) best = r;
  return best;
}
function isSuperseded(r) { const l = latestIn(r.itemId, r.quarter); return !!l && l.recId !== r.recId; }
function typeLabel(it) { return it.type === OTHER && it.typeDetail ? OTHER + ' (' + it.typeDetail + ')' : it.type; }
function teamLabel(it) { return it.team === OTHER && it.teamDetail ? OTHER + ' (' + it.teamDetail + ')' : it.team; }

/* Judgement for one item at date d (spec section 3). */
function evaluate(item, d) {
  d = d || now();
  const qi = quarterInfo(d);
  if (item.status === 'Retired') {
    return { code: 'RETIRED', title: 'RETIRED', sub: 'REMOVE FROM SERVICE', bg: '#111111', fg: '#fff', instr: 'Do not use. Remove from service.' };
  }
  const cur = latestIn(item.id, qi.key);
  if (cur && cur.result === 'Fail') {
    return { code: 'REJECTED', title: 'REJECTED', sub: 'QUARANTINE', bg: '#d32f2f', fg: '#fff', record: cur, instr: 'Tag out. Repair, then re-inspect.' };
  }
  if (cur) {
    const c = quarterColor(qi.q);
    return { code: 'VALID', title: 'VALID', sub: qi.year + ' Q' + qi.q + ' ' + c.name, bg: c.hex, fg: textOn(c.hex), record: cur, color: c, instr: 'Tape colour: ' + c.name };
  }
  if (inGrace(qi, d)) {
    const pq = prevQuarterInfo(qi);
    const prev = latestIn(item.id, pq.key);
    if (prev && prev.result === 'Pass') {
      const c = quarterColor(pq.q), until = graceDeadline(qi);
      return { code: 'GRACE', title: 'VALID (GRACE)', sub: pq.year + ' Q' + pq.q + ' ' + c.name, bg: c.hex, fg: textOn(c.hex), record: prev, color: c, until, instr: 'Inspect before ' + fmtDate(until, false) };
    }
  }
  return { code: 'NOT_INSPECTED', title: 'NOT INSPECTED', sub: 'DO NOT USE', bg: '#d32f2f', fg: '#fff', stripes: true, instr: 'Inspect before use.' };
}
function lookup(id) {
  if (S.items[id]) return { kind: 'item', item: S.items[id] };
  if (S.replaced[id]) return { kind: 'replaced', info: S.replaced[id] };
  return { kind: 'unknown' };
}
function progress(d) {
  d = d || now();
  const out = { active: 0, inspected: 0, rejected: 0, grace: 0, notInspected: 0 };
  for (const it of activeItems()) {
    out.active++;
    const st = evaluate(it, d);
    if (st.code === 'VALID' || st.code === 'REJECTED') out.inspected++;
    if (st.code === 'REJECTED') out.rejected++;
    if (st.code === 'GRACE') out.grace++;
  }
  out.notInspected = out.active - out.inspected;
  return out;
}

/* mutations */
function registerItem(id, type, typeDetail, team, teamDetail) {
  const t = now().toISOString();
  S.items[id] = { id, type, typeDetail: typeDetail || '', team, teamDetail: teamDetail || '', status: 'Active', createdAt: t, updatedAt: t, remarks: '', previousIds: [] };
  S.settings.lastType = type;
  S.settings.lastTeam = team;
  return persist();
}
function updateItem(id, patch) {
  Object.assign(S.items[id], patch, { updatedAt: now().toISOString() });
  return persist();
}
function recordInspection(id, result) {
  const d = now(), qi = quarterInfo(d);
  const rec = { recId: S.nextRecId++, itemId: id, quarter: qi.key, date: d.toISOString(), result, inspector: S.settings.inspector || '', color: quarterColor(qi.q).name };
  S.inspections.push(rec);
  S.items[id].updatedAt = rec.date;
  return persist().then(() => rec);
}
function replaceLabel(oldId, newId) {
  const item = S.items[oldId];
  const t = now().toISOString();
  const moved = Object.assign({}, item, { id: newId, previousIds: (item.previousIds || []).concat([oldId]), updatedAt: t });
  delete S.items[oldId];
  S.items[newId] = moved;
  for (const r of S.inspections) if (r.itemId === oldId) r.itemId = newId;
  for (const k of Object.keys(S.replaced)) if (S.replaced[k].newId === oldId) S.replaced[k].newId = newId;
  S.replaced[oldId] = { newId, date: t };
  return persist();
}

/* ------------------------------------------------------------------- ui */
let flash = null;      // one-off message shown on the next result screen
let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}
function setApp(html) { $('#app').innerHTML = html; window.scrollTo(0, 0); }
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
function topbar(title, backHref, backText) {
  return '<div class="topbar"><h1>' + title + '</h1><a class="btn ghost sm w-auto" href="' + backHref + '">' + (backText || 'Back') + '</a></div>';
}
function bannerAttrs(st) {
  return (st.stripes ? 'class="banner stripes"' : 'class="banner"') + ' style="' + (st.stripes ? '' : 'background:' + st.bg + ';') + 'color:' + st.fg + '"';
}
function badgeText(st) {
  return { VALID: 'VALID', GRACE: 'GRACE', REJECTED: 'REJECTED', NOT_INSPECTED: 'NOT INSP.', RETIRED: 'RETIRED' }[st.code] || st.code;
}

/* --- Home --- */
function viewHome() {
  const d = now(), qi = quarterInfo(d), c = quarterColor(qi.q), p = progress(d);
  const last = S.settings.lastBackupAt ? toDate(S.settings.lastBackupAt) : null;
  const backupDue = p.active > 0 && (!last || (d - last) > BACKUP_REMIND_DAYS * 864e5);
  setApp(
    '<div class="screen">' +
    '<div class="banner" style="background:' + esc(c.hex) + ';color:' + textOn(c.hex) + '"><div class="q">' + qi.year + ' Q' + qi.q + '</div><div class="c">' + esc(c.name) + '</div></div>' +
    '<a class="btn primary huge" href="#scan">SCAN</a>' +
    '<div class="card progress"><div class="big">' + p.inspected + ' / ' + p.active + ' inspected</div>' +
    '<div class="muted">' + p.rejected + ' rejected · ' + p.notInspected + ' not inspected' + (p.grace ? ' · ' + p.grace + ' in grace' : '') + '</div></div>' +
    (backupDue ? '<a class="notice" href="#export">Backup recommended – last backup: ' + (last ? fmtDate(last) : 'never') + '</a>' : '') +
    '<div class="nav"><a class="btn" href="#items">Items</a><a class="btn" href="#export">Export</a><a class="btn" href="#settings">Settings</a></div>' +
    '</div>'
  );
}

/* --- Scan (normal or replace-label mode) --- */
function viewScan(mode, refId) {
  const replacing = mode === 'replace' ? refId : null;
  if (replacing && !S.items[replacing]) return go('#home');
  setApp(
    '<div class="screen">' +
    topbar(replacing ? 'Replace label <span class="idsm">' + esc(replacing) + '</span>' : 'Scan', replacing ? '#item/' + esc(replacing) : '#home', 'Cancel') +
    (replacing ? '<div class="notice">Scan a NEW blank label for item ' + esc(replacing) + '. The old label must be destroyed.</div>' : '') +
    '<div class="scanbox"><video id="video" playsinline muted autoplay></video><div class="guide"></div><div class="scanmsg" id="scanmsg">Point the camera at the QR label</div></div>' +
    '<canvas id="canvas" hidden></canvas>' +
    '<button class="btn outline" id="manual-btn" type="button">Enter number manually</button>' +
    '<form id="manual" class="card" hidden><label class="f" for="manual-id">Label number</label>' +
    '<div class="row"><input id="manual-id" type="text" inputmode="numeric" autocomplete="off" placeholder="e.g. 0045">' +
    '<button class="btn primary" type="submit" style="flex:0 0 92px">OK</button></div></form>' +
    '</div>'
  );
  const onId = id => { if (replacing) doReplace(replacing, id); else go('#result/' + id); };
  const showManual = () => { $('#manual').hidden = false; $('#manual-id').focus(); };
  $('#manual-btn').onclick = () => { Scanner.stop(); showManual(); };
  $('#manual').onsubmit = e => {
    e.preventDefault();
    const id = normalizeId($('#manual-id').value);
    if (!id) return toast('Enter a valid label number');
    onId(id);
  };
  let lastWarn = 0;
  Scanner.start($('#video'), $('#canvas'), text => {
    const id = parseQr(text);
    if (!id) { if (Date.now() - lastWarn > 1500) { lastWarn = Date.now(); $('#scanmsg').textContent = 'Not a CCI label'; } return false; }
    onId(id);
    return true;
  }).catch(err => {
    const m = $('#scanmsg');
    if (m) m.textContent = 'Camera not available (' + (err && err.name ? err.name : err) + ')';
    showManual();
  });
}
async function doReplace(oldId, newId) {
  if (!S.items[oldId]) return toast('Item not found');
  if (newId === oldId) return toast('That is the same label');
  if (S.items[newId]) return toast(newId + ' is already registered');
  if (S.replaced[newId]) return toast(newId + ' is an old replaced label – use a fresh one');
  if (!confirm('Move item ' + oldId + ' to new label ' + newId + '?\n\nThe old label ' + oldId + ' must be destroyed.')) return;
  await replaceLabel(oldId, newId);
  flash = { text: 'Label replaced: ' + oldId + ' → ' + newId };
  go('#result/' + newId);
}

/* --- Result (judgement) --- */
function resultShell(st, id, infoHtml, actionsHtml, f) {
  return '<div class="result' + (st.stripes ? ' stripes' : '') + '" style="' + (st.stripes ? '' : 'background:' + st.bg + ';') + 'color:' + st.fg + '">' +
    (f ? '<div class="flash">' + esc(f.text) + '</div>' : '') +
    '<div class="status">' + esc(st.title) + '</div><div class="sub">' + esc(st.sub) + '</div>' +
    '<div class="id">' + esc(id) + '</div>' +
    infoHtml +
    '<div class="actions">' + actionsHtml + '</div></div>';
}
function viewResult(id) {
  const lk = lookup(id);
  const f = flash; flash = null;
  if (lk.kind === 'unknown') {
    setApp(resultShell({ title: 'NOT REGISTERED', sub: 'New label', bg: '#6b7280', fg: '#fff' }, id,
      '<div class="info">This label is not registered yet.<div class="instr">Attach it to the equipment, then register.</div></div>',
      '<a class="btn primary" href="#register/' + esc(id) + '">REGISTER</a><a class="btn" href="#scan">SCAN NEXT</a>', f));
    return;
  }
  if (lk.kind === 'replaced') {
    const r = lk.info;
    setApp(resultShell({ title: 'LABEL REPLACED', sub: 'Now ' + r.newId, bg: '#6b7280', fg: '#fff' }, id,
      '<div class="info">This label was replaced by <b>' + esc(r.newId) + '</b> on ' + fmtDate(r.date) + '.<div class="instr">Destroy this old label.</div></div>',
      '<a class="btn primary" href="#result/' + esc(r.newId) + '">OPEN ' + esc(r.newId) + '</a><a class="btn" href="#scan">SCAN NEXT</a>', f));
    return;
  }
  const it = lk.item, st = evaluate(it), last = lastRecord(it.id);
  const canInspect = it.status !== 'Retired';
  const info = '<div class="info"><div class="kv">' +
    '<b>Type</b><span>' + esc(typeLabel(it)) + '</span>' +
    '<b>Team</b><span>' + esc(teamLabel(it)) + '</span>' +
    '<b>Last inspection</b><span>' + (last ? fmtDate(last.date) + ' · ' + esc(last.result) + (last.inspector ? ' · ' + esc(last.inspector) : '') : 'None') + '</span>' +
    '</div>' + (st.instr ? '<div class="instr">' + esc(st.instr) + '</div>' : '') + '</div>';
  const actions =
    (canInspect ? '<button class="btn primary" id="inspect-btn" type="button">INSPECT</button>' : '') +
    '<a class="btn" href="#scan">SCAN NEXT</a>' +
    '<div class="row"><a class="btn sm" href="#item/' + esc(id) + '">Details</a>' +
    (canInspect ? '<a class="btn sm" href="#scan/replace/' + esc(id) + '">Replace label</a>' : '') + '</div>';
  setApp(resultShell(st, id, info, actions, f));
  if (canInspect) $('#inspect-btn').onclick = () => startInspect(it);
}
function startInspect(it) {
  const cur = latestIn(it.id, quarterInfo(now()).key);
  if (cur && !confirm('Already inspected on ' + fmtDate(cur.date, false) + (cur.inspector ? ' by ' + cur.inspector : '') + ' (' + cur.result + ').\nRe-inspect?')) return;
  go('#inspect/' + it.id);
}

/* --- Register / Edit --- */
function viewRegister(id) {
  const editing = location.hash.indexOf('#edit/') === 0;
  const it = S.items[id];
  if (editing && !it) return go('#items');
  if (!editing && (it || S.replaced[id])) return go('#result/' + id);
  const types = S.settings.types.slice(), teams = S.settings.teams.slice();
  if (editing && it.type !== OTHER && types.indexOf(it.type) < 0) types.push(it.type);
  if (editing && it.team !== OTHER && teams.indexOf(it.team) < 0) teams.push(it.team);
  types.push(OTHER); teams.push(OTHER);
  const sel = {
    type: editing ? it.type : (types.indexOf(S.settings.lastType) >= 0 ? S.settings.lastType : ''),
    typeDetail: editing ? (it.typeDetail || '') : '',
    team: editing ? it.team : (teams.indexOf(S.settings.lastTeam) >= 0 ? S.settings.lastTeam : ''),
    teamDetail: editing ? (it.teamDetail || '') : ''
  };
  const sugg = key => Array.from(new Set(items().map(i => i[key]).filter(Boolean))).sort();
  const pick = (name, list, cur) => '<div class="pick" data-pick="' + name + '">' +
    list.map(v => '<button type="button" class="btn' + (v === cur ? ' on' : '') + '" data-v="' + esc(v) + '">' + esc(v) + '</button>').join('') + '</div>';
  const detail = (name, value, show, suggestions) =>
    '<input id="' + name + '-detail" type="text" list="' + name + '-sugg" placeholder="Describe (optional)" value="' + esc(value) + '"' + (show ? '' : ' hidden') + ' autocomplete="off">' +
    '<datalist id="' + name + '-sugg">' + suggestions.map(v => '<option value="' + esc(v) + '"></option>').join('') + '</datalist>';
  setApp(
    '<div class="screen">' +
    topbar((editing ? 'Edit' : 'Register') + ' <span class="idsm">' + esc(id) + '</span>', editing ? '#item/' + esc(id) : '#result/' + esc(id), 'Cancel') +
    '<h2>Type</h2>' + pick('type', types, sel.type) + detail('type', sel.typeDetail, sel.type === OTHER, sugg('typeDetail')) +
    '<h2>Team</h2>' + pick('team', teams, sel.team) + detail('team', sel.teamDetail, sel.team === OTHER, sugg('teamDetail')) +
    '<button class="btn primary huge" id="save" type="button">SAVE</button>' +
    '</div>'
  );
  for (const grid of $$('.pick')) {
    grid.addEventListener('click', e => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      const name = grid.dataset.pick;
      sel[name] = b.dataset.v;
      for (const x of $$('button', grid)) x.classList.toggle('on', x === b);
      const inp = $('#' + name + '-detail');
      inp.hidden = sel[name] !== OTHER;
      if (!inp.hidden) inp.focus();
    });
  }
  $('#save').onclick = async () => {
    if (!sel.type) return toast('Select a type');
    if (!sel.team) return toast('Select a team');
    const typeDetail = sel.type === OTHER ? $('#type-detail').value.trim() : '';
    const teamDetail = sel.team === OTHER ? $('#team-detail').value.trim() : '';
    $('#save').disabled = true;
    if (editing) {
      await updateItem(id, { type: sel.type, typeDetail, team: sel.team, teamDetail });
      toast('Saved');
      go('#item/' + id);
    } else {
      await registerItem(id, sel.type, typeDetail, sel.team, teamDetail);
      flash = { text: 'Registered ' + id + ' – now inspect it' };
      go('#result/' + id);
    }
  };
}

/* --- Inspect --- */
function viewInspect(id) {
  const it = S.items[id];
  if (!it || it.status === 'Retired') return go('#result/' + id);
  setApp(
    '<div class="screen">' +
    topbar('Inspect', '#result/' + esc(id), 'Cancel') +
    '<div class="card"><div class="id">' + esc(id) + '</div><div>' + esc(typeLabel(it)) + ' · ' + esc(teamLabel(it)) + '</div>' +
    '<div class="muted">' + fmtDate(now()) + ' · Inspector: ' + esc(S.settings.inspector || '(not set – see Settings)') + '</div></div>' +
    '<button class="btn green huge" id="pass" type="button">OK – PASS</button>' +
    '<button class="btn red huge" id="fail" type="button">FAIL</button>' +
    '</div>'
  );
  const done = async result => {
    $('#pass').disabled = true; $('#fail').disabled = true;
    await recordInspection(id, result);
    const c = quarterColor(quarterInfo(now()).q);
    flash = result === 'Pass' ? { text: 'Saved – apply ' + c.name + ' tape' } : { text: 'Saved – tag out & quarantine' };
    go('#result/' + id);
  };
  $('#pass').onclick = () => done('Pass');
  $('#fail').onclick = () => done('Fail');
}

/* --- Items list --- */
const itemsUI = { q: '', status: 'ALL', team: 'ALL' };
function viewItems() {
  setApp(
    '<div class="screen">' +
    topbar('Items <span class="muted" id="cnt"></span>', '#home', 'Home') +
    '<input id="q" type="text" inputmode="numeric" placeholder="Search label number" value="' + esc(itemsUI.q) + '" autocomplete="off">' +
    '<div class="chips" id="chips"></div>' +
    '<select id="team"></select>' +
    '<div class="list" id="list"></div>' +
    '</div>'
  );
  const teams = Array.from(new Set(items().map(i => i.team))).sort();
  $('#team').innerHTML = '<option value="ALL">All teams</option>' +
    teams.map(t => '<option value="' + esc(t) + '"' + (t === itemsUI.team ? ' selected' : '') + '>' + esc(t) + '</option>').join('');
  $('#q').oninput = e => { itemsUI.q = e.target.value.trim().toUpperCase(); renderItemsList(); };
  $('#team').onchange = e => { itemsUI.team = e.target.value; renderItemsList(); };
  $('#chips').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; itemsUI.status = c.dataset.s; renderItemsList(); };
  renderItemsList();
}
function matchStatus(st, s) {
  if (s === 'ALL') return true;
  if (s === 'TODO') return st.code === 'NOT_INSPECTED' || st.code === 'GRACE';
  return st.code === s;
}
function renderItemsList() {
  const d = now();
  const all = items().map(it => ({ it, st: evaluate(it, d) }));
  const base = all.filter(x => (!itemsUI.q || x.it.id.indexOf(itemsUI.q) >= 0) && (itemsUI.team === 'ALL' || x.it.team === itemsUI.team));
  const chipDefs = [['ALL', 'All'], ['TODO', 'Not inspected'], ['VALID', 'Valid'], ['REJECTED', 'Rejected'], ['RETIRED', 'Retired']];
  $('#chips').innerHTML = chipDefs.map(([s, label]) =>
    '<button type="button" class="chip' + (itemsUI.status === s ? ' on' : '') + '" data-s="' + s + '">' + label + ' ' + base.filter(x => matchStatus(x.st, s)).length + '</button>').join('');
  const rows = base.filter(x => matchStatus(x.st, itemsUI.status)).sort((a, b) => byId(a.it, b.it));
  $('#cnt').textContent = rows.length + ' / ' + all.length;
  $('#list').innerHTML = rows.length ? rows.map(x =>
    '<a class="item" href="#item/' + esc(x.it.id) + '"><div class="iid">' + esc(x.it.id) + '</div>' +
    '<div class="meta">' + esc(typeLabel(x.it)) + '<br>' + esc(teamLabel(x.it)) + '</div>' +
    '<span class="badge" style="background:' + x.st.bg + ';color:' + x.st.fg + '">' + esc(badgeText(x.st)) + '</span></a>').join('')
    : '<div class="muted center">No items</div>';
}

/* --- Item detail --- */
function viewItem(id) {
  const it = S.items[id];
  if (!it) return go(S.replaced[id] ? '#result/' + id : '#items');
  const st = evaluate(it);
  const hist = recordsFor(id).sort((a, b) => b.recId - a.recId);
  const retired = it.status === 'Retired';
  setApp(
    '<div class="screen">' +
    topbar('Item', '#items', 'Items') +
    '<div ' + bannerAttrs(st) + '><div class="c" style="font-size:30px">' + esc(st.title) + '</div><div class="q">' + esc(st.sub) + '</div></div>' +
    '<div class="card"><div class="id">' + esc(id) + '</div><div class="kv">' +
    '<b>Type</b><span>' + esc(typeLabel(it)) + '</span><b>Team</b><span>' + esc(teamLabel(it)) + '</span>' +
    '<b>Status</b><span>' + esc(it.status) + (retired && it.retiredAt ? ' (' + fmtDate(it.retiredAt) + ')' : '') + '</span>' +
    '<b>Registered</b><span>' + fmtDate(it.createdAt) + '</span>' +
    (it.previousIds && it.previousIds.length ? '<b>Previous labels</b><span>' + esc(it.previousIds.join(', ')) + '</span>' : '') +
    '</div></div>' +
    (retired ? '' : '<button class="btn primary" id="inspect-btn" type="button">INSPECT</button>' +
      '<div class="row"><a class="btn sm" href="#scan/replace/' + esc(id) + '">Replace label</a><a class="btn sm" href="#edit/' + esc(id) + '">Edit type / team</a></div>') +
    '<div class="card"><label class="f" for="remarks">Remarks</label><textarea id="remarks" rows="2">' + esc(it.remarks || '') + '</textarea>' +
    '<button class="btn sm outline" id="save-remarks" type="button">Save remarks</button></div>' +
    '<div class="card"><h2>History</h2>' + (hist.length ? hist.map(r =>
      '<div class="hist"><span>' + fmtDate(r.date) + ' · ' + esc(r.quarter) + '</span><span><b style="color:' + (r.result === 'Pass' ? 'var(--green)' : 'var(--red)') + '">' + esc(r.result) + '</b>' +
      (r.inspector ? ' ' + esc(r.inspector) : '') + (isSuperseded(r) ? ' <span class="muted">(superseded)</span>' : '') + '</span></div>').join('')
      : '<div class="muted">No inspections yet</div>') + '</div>' +
    (retired ? '<button class="btn sm outline" id="reactivate" type="button">Reactivate (back to Active)</button>'
      : '<button class="btn sm danger-outline" id="retire" type="button">Retire – remove from service</button>') +
    '</div>'
  );
  if (!retired) $('#inspect-btn').onclick = () => startInspect(it);
  $('#save-remarks').onclick = async () => { await updateItem(id, { remarks: $('#remarks').value.trim() }); toast('Remarks saved'); };
  if (retired) {
    $('#reactivate').onclick = async () => { await updateItem(id, { status: 'Active', retiredAt: null }); toast(id + ' is active again'); render(); };
  } else {
    $('#retire').onclick = async () => {
      if (!confirm('Retire ' + id + '?\nIt will no longer be counted. History is kept.')) return;
      await updateItem(id, { status: 'Retired', retiredAt: now().toISOString() });
      toast(id + ' retired');
      render();
    };
  }
}

/* --- Export / backup --- */
function quarterKeys() {
  const set = new Set(S.inspections.map(r => r.quarter));
  set.add(quarterInfo(now()).key);
  return Array.from(set).sort().reverse();
}
function viewExport() {
  const cur = quarterInfo(now()).key;
  setApp(
    '<div class="screen">' +
    topbar('Export', '#home', 'Home') +
    '<div class="card"><label class="f" for="qsel">Quarter</label><select id="qsel">' +
    quarterKeys().map(k => '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + k + '</option>').join('') + '</select>' +
    '<button class="btn primary" id="report" type="button">Export inspection report (.xlsx)</button>' +
    '<div class="muted">Saves the report and a backup file to Downloads.</div></div>' +
    '<div class="card"><button class="btn" id="master" type="button">Download master list (.xlsx)</button></div>' +
    '<div class="card"><button class="btn" id="backup" type="button">Backup now (.json)</button>' +
    '<div class="muted">Last backup: ' + (S.settings.lastBackupAt ? fmtDateTime(S.settings.lastBackupAt) : 'never') + '</div></div>' +
    '<div class="card"><label class="f" for="restore">Restore backup (.json)</label><input type="file" id="restore" accept=".json,application/json">' +
    '<div class="muted">Replaces ALL data on this phone with the backup file.</div></div>' +
    '</div>'
  );
  $('#report').onclick = () => {
    try {
      exportReport($('#qsel').value);
      setTimeout(backupNow, 900);
      toast('Report saved to Downloads');
    } catch (e) { console.error(e); toast('Export failed: ' + e.message); }
  };
  $('#master').onclick = () => { try { exportMaster(); toast('Master list saved to Downloads'); } catch (e) { console.error(e); toast('Export failed: ' + e.message); } };
  $('#backup').onclick = () => { backupNow(); toast('Backup saved to Downloads'); render(); };
  $('#restore').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data || data.app !== 'CCI' || !data.state) throw new Error('Not a CCI backup file');
      const st = migrate(data.state);
      const n = Object.keys(st.items).length, m = st.inspections.length;
      if (!confirm('Restore backup from ' + fmtDateTime(data.exportedAt) + '?\nItems: ' + n + ', inspections: ' + m + '\n\nThis will REPLACE all data on this phone.')) { e.target.value = ''; return; }
      S = st;
      await persist();
      toast('Restored ' + n + ' items, ' + m + ' inspections');
      go('#home');
    } catch (err) {
      console.error(err);
      toast('Restore failed: ' + err.message);
      e.target.value = '';
    }
  };
}
function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
}
function saveWorkbook(wb, name) {
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
}
function sheet(rows, widths) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (widths) ws['!cols'] = widths.map(w => ({ wch: w }));
  return ws;
}
function backupNow() {
  S.settings.lastBackupAt = now().toISOString();
  persist();
  const payload = { app: 'CCI', schema: S.schema, appVersion: APP_VERSION, exportedAt: S.settings.lastBackupAt, state: S };
  downloadBlob(new Blob([JSON.stringify(payload)], { type: 'application/json' }), 'CCI_Backup_' + stamp(now()) + '.json');
}
function exportReport(qkey) {
  const qi = parseQuarterKey(qkey);
  if (!qi) throw new Error('Bad quarter');
  const d = now();
  const data = activeItems().filter(it => toDate(it.createdAt) <= qi.end).sort(byId).map(it => {
    const r = latestIn(it.id, qkey);
    return { it, r, result: r ? r.result : 'Not inspected' };
  });
  const summary = (keyFn, label) => {
    const groups = new Map();
    for (const x of data) {
      const k = keyFn(x.it);
      if (!groups.has(k)) groups.set(k, { a: 0, p: 0, f: 0 });
      const g = groups.get(k); g.a++;
      if (x.result === 'Pass') g.p++; else if (x.result === 'Fail') g.f++;
    }
    const rows = [[label, 'Active items', 'Inspected', 'Pass', 'Fail', 'Not inspected', 'Completion %']];
    const T = { a: 0, p: 0, f: 0 };
    for (const k of Array.from(groups.keys()).sort()) {
      const g = groups.get(k);
      rows.push([k, g.a, g.p + g.f, g.p, g.f, g.a - g.p - g.f, pct(g.p + g.f, g.a)]);
      T.a += g.a; T.p += g.p; T.f += g.f;
    }
    rows.push(['TOTAL', T.a, T.p + T.f, T.p, T.f, T.a - T.p - T.f, pct(T.p + T.f, T.a)]);
    return rows;
  };
  const wb = XLSX.utils.book_new();
  const sumRows = [
    ['Color Code Inspection – Summary'],
    ['Quarter', qkey, 'Colour', quarterColor(qi.q).name],
    ['Generated', fmtDateTime(d)],
    ['Inspector', S.settings.inspector || ''],
    []
  ].concat(summary(it => it.type, 'Type'), [[]], summary(it => it.team, 'Team'));
  XLSX.utils.book_append_sheet(wb, sheet(sumRows, [22, 12, 11, 8, 8, 14, 13]), 'Summary');
  const order = { Fail: 0, 'Not inspected': 1, Pass: 2 };
  const stRows = [['ID', 'Type', 'Team', 'Result', 'Inspection Date', 'Inspector', 'Colour']];
  for (const x of data.slice().sort((a, b) => (order[a.result] - order[b.result]) || byId(a.it, b.it))) {
    stRows.push([x.it.id, typeLabel(x.it), teamLabel(x.it), x.result, x.r ? fmtDate(x.r.date) : '', x.r ? x.r.inspector : '', x.r ? x.r.color : '']);
  }
  XLSX.utils.book_append_sheet(wb, sheet(stRows, [8, 22, 18, 14, 15, 14, 10]), qkey + ' Status');
  const hRows = [['Date', 'Quarter', 'ID', 'Type', 'Team', 'Result', 'Colour', 'Inspector', 'Superseded']];
  for (const r of S.inspections.slice().sort((a, b) => b.recId - a.recId)) {
    const it = S.items[r.itemId];
    hRows.push([fmtDateTime(r.date), r.quarter, r.itemId, it ? typeLabel(it) : '', it ? teamLabel(it) : '', r.result, r.color, r.inspector, isSuperseded(r) ? 'Yes' : '']);
  }
  XLSX.utils.book_append_sheet(wb, sheet(hRows, [18, 9, 8, 22, 18, 8, 10, 14, 11]), 'History');
  saveWorkbook(wb, 'CCI_Inspection_' + qkey + '_' + stamp(d) + '.xlsx');
}
function exportMaster() {
  const rows = [['ID', 'Type', 'Type Detail', 'Team', 'Team Detail', 'Status', 'Registered', 'Previous Labels', 'Remarks']];
  for (const it of items().sort(byId)) {
    rows.push([it.id, it.type, it.typeDetail || '', it.team, it.teamDetail || '', it.status, fmtDate(it.createdAt), (it.previousIds || []).join(', '), it.remarks || '']);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(rows, [8, 18, 18, 14, 14, 9, 12, 16, 30]), 'Master List');
  saveWorkbook(wb, 'CCI_MasterList_' + stamp(now()) + '.xlsx');
}

/* --- Settings --- */
function viewSettings() {
  const s = S.settings;
  setApp(
    '<div class="screen">' +
    topbar('Settings', '#home', 'Home') +
    '<form id="sform" class="card">' +
    '<div><label class="f" for="inspector">Inspector name (written on every inspection)</label><input id="inspector" type="text" value="' + esc(s.inspector) + '"></div>' +
    '<div><label class="f" for="grace">Grace days (previous quarter colour stays valid)</label><input id="grace" type="number" min="0" max="90" value="' + (s.graceDays | 0) + '"></div>' +
    '<h2>Quarter colours</h2>' +
    ['Q1', 'Q2', 'Q3', 'Q4'].map(q => '<div class="row qc"><span class="qn">' + q + '</span><input type="text" id="' + q + '-name" value="' + esc(s.quarterColors[q].name) + '" placeholder="Colour name"><input type="color" id="' + q + '-hex" value="' + esc(s.quarterColors[q].hex) + '"></div>').join('') +
    '<div><label class="f" for="types">Equipment types – one per line (“Other” is always offered)</label><textarea id="types">' + esc(s.types.join('\n')) + '</textarea></div>' +
    '<div><label class="f" for="teams">Teams – one per line (“Other” is always offered)</label><textarea id="teams">' + esc(s.teams.join('\n')) + '</textarea></div>' +
    '<button class="btn primary" type="submit">SAVE SETTINGS</button>' +
    '</form>' +
    '<div class="card"><h2>Data</h2><div class="muted">Items: ' + Object.keys(S.items).length + ' · Inspections: ' + S.inspections.length + '</div>' +
    '<button class="btn sm danger-outline" id="wipe" type="button">Delete all items &amp; inspections</button></div>' +
    '<div class="card"><div class="muted">Color Code Inspection v' + APP_VERSION + '</div><button class="btn sm outline" id="checkupd" type="button">Check for update</button></div>' +
    '</div>'
  );
  $('#sform').onsubmit = async e => {
    e.preventDefault();
    const lines = id => $('#' + id).value.split('\n').map(x => x.trim()).filter((x, i, a) => x && x.toLowerCase() !== OTHER.toLowerCase() && a.indexOf(x) === i);
    const types = lines('types'), teams = lines('teams');
    if (!types.length) return toast('At least one type is needed');
    if (!teams.length) return toast('At least one team is needed');
    s.inspector = $('#inspector').value.trim();
    s.graceDays = Math.max(0, Math.min(90, parseInt($('#grace').value, 10) || 0));
    for (const q of ['Q1', 'Q2', 'Q3', 'Q4']) s.quarterColors[q] = { name: ($('#' + q + '-name').value.trim() || q).toUpperCase(), hex: $('#' + q + '-hex').value };
    s.types = types; s.teams = teams;
    await persist();
    toast('Settings saved');
    go('#home');
  };
  $('#wipe').onclick = async () => {
    if (prompt('Type DELETE to erase all items and inspections on this phone.\n(Settings are kept.)') !== 'DELETE') return;
    S.items = {}; S.inspections = []; S.replaced = {}; S.nextRecId = 1;
    await persist();
    toast('All items and inspections deleted');
    render();
  };
  $('#checkupd').onclick = () => {
    if (!('serviceWorker' in navigator)) return toast('Not available');
    navigator.serviceWorker.getRegistration().then(r => r ? r.update().then(() => toast('Checked – you will be told if an update is ready')) : toast('Offline cache not installed yet')).catch(() => toast('Check failed (offline?)'));
  };
}

/* ---------------------------------------------------------------- scanner */
const Scanner = {
  stream: null, timer: null, running: false, detector: null, video: null,
  async start(video, canvas, onDecode) {
    this.stop();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('NoCamera');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
    this.stream = stream; this.video = video;
    video.srcObject = stream;
    try { await video.play(); } catch (e) { /* muted + playsinline normally allows autoplay */ }
    this.detector = null;
    if ('BarcodeDetector' in window) {
      try {
        const f = await window.BarcodeDetector.getSupportedFormats();
        if (f.indexOf('qr_code') >= 0) this.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) { this.detector = null; }
    }
    this.running = true;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    let lastText = '', lastAt = 0;
    const tick = async () => {
      if (!this.running) return;
      try {
        if (video.readyState >= 2 && video.videoWidth) {
          let text = null;
          if (this.detector) {
            try { const codes = await this.detector.detect(video); if (codes.length) text = codes[0].rawValue; }
            catch (e) { this.detector = null; }
          }
          if (!this.detector && window.jsQR) {
            const scale = Math.min(1, 640 / video.videoWidth);
            const w = Math.round(video.videoWidth * scale), h = Math.round(video.videoHeight * scale);
            if (canvas.width !== w) canvas.width = w;
            if (canvas.height !== h) canvas.height = h;
            ctx.drawImage(video, 0, 0, w, h);
            const img = ctx.getImageData(0, 0, w, h);
            const code = window.jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
            if (code && code.data) text = code.data;
          }
          if (text) {
            const t = Date.now();
            if (text !== lastText || t - lastAt > 1500) {
              lastText = text; lastAt = t;
              if (onDecode(text) === true) { this.stop(); return; }
            }
          }
        }
      } catch (e) { console.warn('scan frame error', e); }
      if (this.running) this.timer = setTimeout(tick, 90);
    };
    tick();
  },
  stop() {
    this.running = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.stream) { for (const t of this.stream.getTracks()) t.stop(); this.stream = null; }
    if (this.video) { try { this.video.srcObject = null; } catch (e) { /* ignore */ } this.video = null; }
  }
};
document.addEventListener('visibilitychange', () => { if (document.hidden) Scanner.stop(); });

/* ----------------------------------------------------------------- router */
const routes = [
  [/^#?$|^#home$/, viewHome],
  [/^#scan(?:\/(replace)\/([A-Z0-9-]+))?$/, viewScan],
  [/^#result\/([A-Z0-9-]+)$/, viewResult],
  [/^#register\/([A-Z0-9-]+)$/, viewRegister],
  [/^#edit\/([A-Z0-9-]+)$/, viewRegister],
  [/^#inspect\/([A-Z0-9-]+)$/, viewInspect],
  [/^#items$/, viewItems],
  [/^#item\/([A-Z0-9-]+)$/, viewItem],
  [/^#export$/, viewExport],
  [/^#settings$/, viewSettings]
];
function render() {
  Scanner.stop();
  const h = location.hash || '#home';
  for (const [re, fn] of routes) {
    const m = re.exec(h);
    if (m) { try { fn.apply(null, m.slice(1)); } catch (e) { console.error(e); toast('Error: ' + e.message); } return; }
  }
  go('#home');
}
window.addEventListener('hashchange', render);

/* --------------------------------------------------------- service worker */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').then(reg => {
    const show = w => {
      const b = $('#update-banner');
      b.hidden = false;
      b.onclick = () => { w.postMessage({ type: 'SKIP_WAITING' }); b.textContent = 'Updating…'; };
    };
    if (reg.waiting && navigator.serviceWorker.controller) show(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) show(nw); });
    });
  }).catch(e => console.warn('Service worker registration failed', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
}

/* ------------------------------------------------------------------- init */
async function init() {
  try {
    const saved = await DB.get(DB_KEY);
    S = migrate(saved);
  } catch (e) {
    console.error(e);
    S = defaultState();
    toast('Storage error: ' + (e && e.message ? e.message : e));
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (TODAY_OVERRIDE) { const b = $('#dev-banner'); b.textContent = 'TEST DATE: ' + ymd(TODAY_OVERRIDE); b.hidden = false; }
  render();
  registerSW();
}
window.CCI = { version: APP_VERSION, state: () => S, evaluate, quarterInfo, now, normalizeId, parseQr, persist };
init();

})();
