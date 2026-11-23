#!/usr/bin/env bun
// Derive Scottish 2022 first-preference totals from ward preference profiles.
//
// Why: the IndyLive extract (source-data/council/scotland-2022-stv-indylive.csv)
// has official elected flags for all 355 wards, but no first preferences for
// 28 contested wards in Comhairle nan Eilean Siar, North Ayrshire, Orkney and
// Shetland. Councils published the full ballot preference profiles for every
// contested ward; Denis Mollison's compilation of them in ballot (.dat) format
// is at https://www.macs.hw.ac.uk/~denis/stv_elections/SC2022/.
//
// What this script does: counts each ballot's first preference — a plain
// tally, not an STV simulation — and writes one row per IndyLive candidate to
// source-data/council/scotland-2022-profile-first-preferences.csv. It does not
// copy the profiles themselves (the compilation page states no licence).
// It also cross-checks the tallies against IndyLive's first preferences for
// every ward where both exist and records the result in the output.
//
// Usage: bun scripts/derive-scotland-profile-first-prefs.mjs [profileDir]
// Default profileDir is the local stv.vote checkout of the compilation.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE_DIR = process.argv[2]
  ?? '/home/fsargent/src/stv.vote/raw-data/uk/scotland/2022/SC2022_ballot_format';
const INDYLIVE = resolve(ROOT, 'source-data/council/scotland-2022-stv-indylive.csv');
const OUT = resolve(ROOT, 'source-data/council/scotland-2022-profile-first-preferences.csv');

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.length > 1 || r[0]);
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const norm = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
function fixMojibake(s) {
  // A few profile names were saved as UTF-8 read as Windows-1252 ("DÃ–RING").
  if (!/[ÃÂâ]/.test(s)) return s;
  const map = { '–': 0x96, '€': 0x80, '“': 0x93, '”': 0x94, '’': 0x92, '‘': 0x91, '—': 0x97 };
  const bytes = [...s].map((c) => map[c] ?? c.charCodeAt(0));
  if (bytes.some((b) => b > 255)) return s;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes)); } catch { return s; }
}

/** Parse one .dat file: title, "seats candidates <ballot lines> valid", names, ballots. */
export function parseProfile(text) {
  const lines = text.split(/\r?\n/);
  const title = lines[0].trim();
  const [seats, nc, , valid] = lines[1].trim().split(/\s+/).map(Number);
  const names = lines.slice(2, 2 + nc).map((n) => fixMojibake(n.trim()));
  const firstPrefs = new Array(nc).fill(0);
  let total = 0, noFirst = 0;
  for (const ln of lines.slice(2 + nc)) {
    if (!ln.trim()) continue;
    const [count, ...ranks] = ln.trim().split(/\s+/).map(Number);
    if (ranks.length !== nc) throw new Error(`bad ballot line in ${title}: ${ln}`);
    total += count;
    const firsts = ranks.flatMap((r, i) => (r === 1 ? [i] : []));
    if (firsts.length === 1) firstPrefs[firsts[0]] += count; else noFirst += count;
  }
  return { title, seats, valid, names, firstPrefs, total, noFirst };
}

function surnameOf(profileName) {
  const quoted = profileName.match(/^"([^"]*)"/);
  const base = quoted ? quoted[1] : profileName.replace(/,[^,]*$/, '');
  const toks = base.split(/\s+/);
  const sur = toks.filter((t) => /[A-Z]/.test(t) && t === t.toUpperCase());
  const given = toks.filter((t) => !sur.includes(t));
  // Names like "Norrie Tomsh MacDonald" have no capitalised surname.
  return { sur: norm(sur.length ? sur.join(' ') : toks.at(-1)), given: given.map(norm) };
}

/** Map IndyLive candidates to profile columns. Surname first, then given
 *  name, then elimination, then (only if IndyLive has them) equal votes. */
function matchCandidates(rows, profile) {
  const parsed = profile.names.map(surnameOf);
  const taken = new Set();
  const out = new Map();
  const pending = [];
  for (const r of rows) {
    const full = norm(r.name);
    const first = norm(r.name.split(/\s+/)[0]);
    let hits = parsed.flatMap((p, i) => (p.sur && full.endsWith(p.sur) ? [i] : []));
    if (hits.length > 1) {
      const byGiven = hits.filter((i) => parsed[i].given[0] === first);
      hits = byGiven.length === 1 ? byGiven : hits.filter((i) => parsed[i].given[0]?.[0] === first[0]);
    }
    if (hits.length === 1 && !taken.has(hits[0])) { out.set(r.id, hits[0]); taken.add(hits[0]); }
    else pending.push(r);
  }
  for (const r of [...pending]) {
    const fp = r.first_prefs ? Math.round(Number(r.first_prefs)) : null;
    const free = profile.names.map((_, i) => i).filter((i) => !taken.has(i));
    const byVotes = fp == null ? [] : free.filter((i) => profile.firstPrefs[i] === fp);
    const pick = free.length === 1 ? free[0] : byVotes.length === 1 ? byVotes[0] : null;
    if (pick == null) continue;
    out.set(r.id, pick); taken.add(pick); pending.splice(pending.indexOf(r), 1);
  }
  // Remaining ambiguous candidates: compare the closest profile surname.
  for (const r of pending) {
    const full = norm(r.name);
    const free = profile.names.map((_, i) => i).filter((i) => !taken.has(i));
    const score = (i) => { const s = parsed[i].sur; let k = 0; while (k < s.length && full.includes(s.slice(0, k + 1))) k++; return k; };
    free.sort((a, b) => score(b) - score(a));
    if (free.length && score(free[0]) >= 4 && (free.length === 1 || score(free[0]) > score(free[1]))) {
      out.set(r.id, free[0]); taken.add(free[0]);
    } else throw new Error(`cannot match ${r.name} in ${profile.title}: ${profile.names.join(' | ')}`);
  }
  return out;
}

const COUNCIL_FOLDERS = {
  'aberdeen-city': 'Aberdeen', 'dundee-city': 'Dundee', 'glasgow-city': 'Glasgow',
  'na-h-eileanan-an-iar': 'Eilean_Siar', 'orkney-islands': 'Orkney', 'shetland-islands': 'Shetland'
};
const folderFor = (slug) => COUNCIL_FOLDERS[slug]
  ?? slug.split('-').map((w) => (w === 'and' ? w : w[0].toUpperCase() + w.slice(1))).join('_');
const WARD_ALIASES = { 'sgiruigeaguscarlabhagh': 'sgiruigeaguscarlobhagh' };

function main() {
  const rows = parseCsv(readFileSync(INDYLIVE, 'utf8'));
  const wards = new Map();
  for (const r of rows) {
    const k = `${r.council_id}::${r.cand_ward_id}`;
    if (!wards.has(k)) wards.set(k, []);
    wards.get(k).push(r);
  }
  const profiles = [];
  for (const folder of readdirSync(PROFILE_DIR)) {
    const dir = join(PROFILE_DIR, folder);
    if (!statSync(dir).isDirectory() || folder === 'parties') continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.dat')) continue;
      const p = parseProfile(readFileSync(join(dir, f), 'utf8'));
      profiles.push({ folder, file: `${folder}/${f}`, key: norm(p.title.replace(/^\d+\s+/, '')), ...p });
    }
  }
  const out = [['indylive_candidate_id', 'council_id', 'ward_id', 'ward_name', 'candidate_name', 'profile_file',
    'profile_candidate', 'seats', 'profile_valid_ballots', 'first_prefs', 'indylive_first_prefs', 'check']];
  const stats = { wards: 0, contested: 0, noPoll: 0, exact: 0, differs: [], gapFilled: 0 };
  for (const [k, ws] of wards) {
    stats.wards++;
    const w = ws[0];
    const wkey = norm(w.ward_name);
    const prof = profiles.filter((p) => p.folder === folderFor(w.council_id) && p.key === (WARD_ALIASES[wkey] ?? wkey));
    if (prof.length !== 1) throw new Error(`ward ${k} ${w.ward_name}: ${prof.length} profiles`);
    const p = prof[0];
    if (p.seats !== Number(w.seats)) throw new Error(`seat mismatch ${k}`);
    // No poll: candidates did not exceed seats. IndyLive marks only three
    // such wards contested=0; the profiles (0 ballots) confirm all eight.
    if (ws.length <= p.seats) {
      if (p.total !== 0 || p.valid !== 0) throw new Error(`uncontested ward has ballots ${k}`);
      stats.noPoll++; continue;
    }
    if (w.contested === '0') throw new Error(`IndyLive marks ${k} uncontested but it has more candidates than seats`);
    stats.contested++;
    if (p.noFirst) throw new Error(`${p.file}: ${p.noFirst} ballots without a single first preference`);
    if (p.total !== p.valid) throw new Error(`${p.file}: ballots ${p.total} != header valid ${p.valid}`);
    const m = matchCandidates(ws, p);
    const hasIndy = ws.every((r) => r.first_prefs !== '');
    let wardOk = true;
    for (const r of ws) {
      const fp = p.firstPrefs[m.get(r.id)];
      const indy = hasIndy ? Math.round(Number(r.first_prefs)) : null;
      const check = indy == null ? 'gap-fill' : indy === fp ? 'match' : 'differs';
      if (check === 'differs') { wardOk = false; stats.differs.push(`${w.council_id}/${w.ward_name}/${r.name}: IndyLive ${indy}, profile ${fp}`); }
      out.push([r.id, w.council_id, w.cand_ward_id, w.ward_name, r.name, p.file, p.names[m.get(r.id)], p.seats, p.valid, fp, indy ?? '', check]);
    }
    if (!hasIndy) stats.gapFilled++;
    else if (wardOk) stats.exact++;
  }
  const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  writeFileSync(OUT, out.map((r) => r.map(esc).join(',')).join('\n') + '\n');
  console.log(`wards ${stats.wards}: ${stats.contested} contested (${stats.exact} exact match, ` +
    `${stats.contested - stats.exact - stats.gapFilled} differ, ${stats.gapFilled} gap-filled), ${stats.noPoll} no-poll`);
  for (const d of stats.differs) console.log(`  differs: ${d}`);
  console.log(`wrote ${OUT}`);
}

if (import.meta.main) main();
