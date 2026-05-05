#!/usr/bin/env node
// ETL: LEH-shaped XLSX → SQLite + CSVs + build-time JSON snapshot.
// Source fixture: docs/LEH-2025-results-HoC.xlsx
// Dev-only: per the PRD this fixture is never deployed as published copy;
// it stands in for the same-shape 2026 LEH that will land months later.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { Database } from 'bun:sqlite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const FIXTURE = resolve(ROOT, 'docs/LEH-2025-results-HoC.xlsx');
const OUT_DIR = resolve(ROOT, 'static/data');
const SQLITE_PATH = resolve(OUT_DIR, 'results.sqlite');
const SNAPSHOT_PATH = resolve(ROOT, 'src/lib/data/generated.json');

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function truthy(v) {
  if (v === true || v === 1) return true;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === 'y' || s === 'yes' || s === '1';
  }
  return false;
}

function ensureDir(p) {
  mkdirSync(dirname(p), { recursive: true });
}

function loadSheet(wb, name) {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Missing sheet: ${name}`);
  // LEH sheets have a title row 1, then headers on row 2, then data.
  // Header strings frequently carry stray whitespace (e.g. ' Ballots ',
  // ' Votes cast ', 'ONS ward code ') — trim every key so callers can use
  // the obvious names.
  const rows = XLSX.utils.sheet_to_json(ws, { range: 1, defval: null });
  return rows.map((row) => {
    const out = {};
    for (const k of Object.keys(row)) out[k.trim()] = row[k];
    return out;
  });
}

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function writeCsv(path, rows, columns) {
  const header = columns.join(',');
  const body = rows.map((r) => columns.map((c) => csvEscape(r[c])).join(',')).join('\n');
  writeFileSync(path, header + '\n' + body + '\n');
}

console.log(`[etl] reading ${FIXTURE}`);
if (!existsSync(FIXTURE)) {
  console.error(`[etl] fixture not found: ${FIXTURE}`);
  process.exit(1);
}

const wb = XLSX.read(readFileSync(FIXTURE), { type: 'buffer' });

const candidatesRaw = loadSheet(wb, 'Candidates result');
const wardsRaw = loadSheet(wb, 'Ward results');
const partyKeyRaw = loadSheet(wb, 'Party names');

console.log(
  `[etl] read ${candidatesRaw.length} candidate rows, ${wardsRaw.length} ward rows, ${partyKeyRaw.length} parties`
);

// --- Party abbreviation lookup ---
const partyAbbrev = new Map();
for (const row of partyKeyRaw) {
  const name = row['Party name'];
  const abbrev = row['Party abbreviation'];
  if (name && abbrev) partyAbbrev.set(name, abbrev);
}

// --- Build wards keyed by EC ward code (numeric, unique per race) ---
// NB: ONS ward code can be shared across multiple LAs in some edge cases;
// EC ward code is the per-election-row primary key in this dataset.
const wards = new Map();
for (const w of wardsRaw) {
  const ecCode = String(w['EC ward code']);
  const wardName = (w['Ward/ County Electoral District name'] || '').trim();
  const lowerTier = (w['Lower tier authority'] || '').trim();
  const upperTier = (w['Upper tier authority'] || '').trim();
  const authorityType = (w['Local authority type'] || '').trim();
  const electionType = (w['Election type'] || '').trim();
  const seats = Number(w['Seats'] || 0);
  const electorate = Number(w['Electorate'] || 0);
  const ballots = Number(w['Ballots'] || 0);
  const invalidVotes = Number(w['Invalid votes'] || 0);
  const validBallots = Math.max(0, ballots - invalidVotes);

  const council = lowerTier || upperTier;
  const councilSlug = slugify(council);
  const wardSlug = slugify(`${wardName}-${ecCode}`);

  wards.set(ecCode, {
    wardName,
    wardSlug,
    wardCode: String(w['ONS ward code'] || ecCode).trim(),
    ecCode,
    council,
    councilSlug,
    upperTier,
    authorityType,
    electionType,
    seats,
    electorate,
    ballots,
    invalidVotes,
    validBallots,
    candidates: []
  });
}

// --- Attach candidates to wards ---
// We capture the source's own `Elected` flag as `electedSource` for forensic
// purposes but DO NOT trust it. The LEH-2025 workbook has confirmed
// inconsistencies (e.g. EC 62374 Cramlington Village marks both Swinburn at
// 791 votes and Leyland at 91 votes as elected for a single-seat race).
// Below, we recompute the elected flag as "top N by vote count where N =
// seats contested" — the actual rule under FPTP and bloc vote.
let orphanCandidates = 0;
for (const c of candidatesRaw) {
  const ecCode = String(c['EC ward code']);
  const ward = wards.get(ecCode);
  if (!ward) {
    orphanCandidates++;
    continue;
  }
  const partyName = (c['Party name'] || '').trim();
  ward.candidates.push({
    name: (c['Candidate name'] || '').trim(),
    firstName: c['First names'] ?? null,
    lastName: c['Last names'] ?? null,
    party: partyName,
    partyAbbrev: partyAbbrev.get(partyName) ?? null,
    gender: c['Gender'] ?? null,
    votes: Number(c['Votes cast'] || 0),
    electedSource: truthy(c['Elected']),
    elected: false, // recomputed below
    rank: Number(c['Rank'] || 0),
    incumbent: Number(c['Incumbent'] || 0)
  });
}
if (orphanCandidates > 0) {
  console.warn(`[etl] ${orphanCandidates} candidate rows had no matching ward`);
}

// --- Recompute `elected` from votes: top N by vote count, N = ward seats. ---
let electedFlagOverrides = 0;
for (const w of wards.values()) {
  // Sort by votes desc; tiebreak by source rank ascending so deterministic.
  w.candidates.sort((a, b) => b.votes - a.votes || (a.rank || 999) - (b.rank || 999));
  const seatsToFill = Math.max(0, Number(w.seats) || 0);
  for (let i = 0; i < w.candidates.length; i++) {
    const shouldBeElected = i < seatsToFill;
    if (shouldBeElected !== w.candidates[i].electedSource) electedFlagOverrides += 1;
    w.candidates[i].elected = shouldBeElected;
    // Renumber rank from votes order (1 = highest vote count) so the rank we
    // display is internally consistent with the ordering on the page.
    w.candidates[i].rank = i + 1;
  }
}
if (electedFlagOverrides > 0) {
  console.warn(`[etl] overrode source 'Elected' flag on ${electedFlagOverrides} candidacies (top-N-by-votes rule)`);
}

// --- Drop wards with zero candidates (uncontested rows we can't render) ---
const racesAll = [...wards.values()];
const races = racesAll.filter((r) => r.candidates.length > 0 && r.validBallots > 0);
const dropped = racesAll.length - races.length;
if (dropped > 0) {
  console.warn(`[etl] dropped ${dropped} wards with no candidates or zero valid ballots`);
}

// --- Compute distortion fields (mirror src/lib/distortion.ts) ---
function candidatePct(votes, valid) {
  return valid > 0 ? votes / valid : 0;
}
function quotaForSeats(seats) {
  return Number.isFinite(seats) && seats >= 1 ? 1 / (seats + 1) : 0.5;
}

for (const r of races) {
  const elected = r.candidates.filter((c) => c.elected);
  const electedPcts = elected.map((c) => candidatePct(c.votes, r.validBallots));
  r.winningPct = electedPcts.length ? Math.min(...electedPcts) : 0;
  r.quota = quotaForSeats(r.seats);
  r.underPar = r.quota - r.winningPct;
  r.isBelowQuota = r.underPar > 0;
  r.electedNames = elected.map((c) => c.name);
}

// --- Council summaries ---
// "Below quota" = the marginal elected candidate's share fell below the
// Droop quota (1 / (seats + 1)). For each council we count seats whose own
// candidate share is below the quota for that ward.
const councilMap = new Map();
for (const r of races) {
  if (!councilMap.has(r.councilSlug)) {
    councilMap.set(r.councilSlug, {
      council: r.council,
      councilSlug: r.councilSlug,
      authorityType: r.authorityType,
      raceCount: 0,
      totalSeatCount: 0,
      belowQuotaSeatCount: 0
    });
  }
  const s = councilMap.get(r.councilSlug);
  s.raceCount += 1;
  const elected = r.candidates.filter((c) => c.elected);
  s.totalSeatCount += elected.length;
  for (const c of elected) {
    if (candidatePct(c.votes, r.validBallots) < r.quota) s.belowQuotaSeatCount += 1;
  }
}
const councils = [...councilMap.values()].map((s) => ({
  ...s,
  belowQuotaShare:
    s.totalSeatCount > 0 ? s.belowQuotaSeatCount / s.totalSeatCount : 0
}));
councils.sort((a, b) => a.council.localeCompare(b.council));

// --- Marginal-winner roll-up (every elected candidate; sortable by under-par desc) ---
const marginal = [];
for (const r of races) {
  for (const c of r.candidates.filter((c) => c.elected)) {
    const winningPct = candidatePct(c.votes, r.validBallots);
    marginal.push({
      candidateName: c.name,
      party: c.party,
      partyAbbrev: c.partyAbbrev,
      votes: c.votes,
      winningPct,
      quota: r.quota,
      underPar: r.quota - winningPct,
      wardName: r.wardName,
      wardSlug: r.wardSlug,
      council: r.council,
      councilSlug: r.councilSlug,
      seats: r.seats,
      validBallots: r.validBallots
    });
  }
}
// Sort by under-par desc — the seats furthest below the proportional quota
// rank highest. Tiebreak: fewer absolute votes first (smaller absolute mandate).
marginal.sort((a, b) => b.underPar - a.underPar || a.votes - b.votes);

const belowQuotaSeats = marginal.filter((m) => m.underPar > 0).length;
console.log(
  `[etl] computed ${races.length} races across ${councils.length} councils; ${marginal.length} elected seats; ${belowQuotaSeats} seats elected below the proportional quota`
);

// --- Emit SQLite ---
mkdirSync(OUT_DIR, { recursive: true });
if (existsSync(SQLITE_PATH)) rmSync(SQLITE_PATH);
const db = new Database(SQLITE_PATH, { create: true });
db.exec('PRAGMA journal_mode = DELETE');

db.exec(`
CREATE TABLE councils (
  council_slug TEXT PRIMARY KEY,
  council TEXT NOT NULL,
  authority_type TEXT,
  race_count INTEGER NOT NULL,
  total_seats INTEGER NOT NULL,
  -- seats whose marginal candidate share fell below the Droop quota
  -- (1 / (seats + 1)) for that ward
  below_quota_seats INTEGER NOT NULL,
  below_quota_share REAL NOT NULL
);
CREATE TABLE races (
  ec_code TEXT PRIMARY KEY,
  ward_code TEXT,
  ward_name TEXT NOT NULL,
  ward_slug TEXT NOT NULL,
  council_slug TEXT NOT NULL,
  council TEXT NOT NULL,
  authority_type TEXT,
  election_type TEXT,
  seats INTEGER NOT NULL,
  electorate INTEGER,
  ballots INTEGER,
  invalid_votes INTEGER,
  valid_ballots INTEGER NOT NULL,
  winning_pct REAL NOT NULL,
  -- Droop quota: 1 / (seats + 1) — share needed to be guaranteed a seat under PR
  quota REAL NOT NULL,
  -- quota - winning_pct (positive = below par)
  under_par REAL NOT NULL,
  -- 1 when winning_pct < quota
  is_below_quota INTEGER NOT NULL,
  FOREIGN KEY (council_slug) REFERENCES councils(council_slug)
);
CREATE TABLE candidates (
  ec_code TEXT NOT NULL,
  rank INTEGER,
  candidate_name TEXT NOT NULL,
  party TEXT,
  party_abbrev TEXT,
  votes INTEGER NOT NULL,
  elected INTEGER NOT NULL,
  -- LEH source Elected column as published; differs from elected on a
  -- small number of candidacies where the source workbook is inconsistent.
  elected_source INTEGER NOT NULL,
  gender TEXT,
  incumbent INTEGER,
  FOREIGN KEY (ec_code) REFERENCES races(ec_code)
);
CREATE INDEX idx_races_council ON races(council_slug);
CREATE INDEX idx_candidates_ec ON candidates(ec_code);
`);

const insCouncil = db.prepare(`
INSERT INTO councils (council_slug, council, authority_type, race_count, total_seats, below_quota_seats, below_quota_share)
VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insRace = db.prepare(`
INSERT INTO races (ec_code, ward_code, ward_name, ward_slug, council_slug, council, authority_type, election_type, seats, electorate, ballots, invalid_votes, valid_ballots, winning_pct, quota, under_par, is_below_quota)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insCand = db.prepare(`
INSERT INTO candidates (ec_code, rank, candidate_name, party, party_abbrev, votes, elected, elected_source, gender, incumbent)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const tx = db.transaction(() => {
  for (const c of councils) {
    insCouncil.run(
      c.councilSlug,
      c.council,
      c.authorityType,
      c.raceCount,
      c.totalSeatCount,
      c.belowQuotaSeatCount,
      c.belowQuotaShare
    );
  }
  for (const r of races) {
    insRace.run(
      r.ecCode,
      r.wardCode,
      r.wardName,
      r.wardSlug,
      r.councilSlug,
      r.council,
      r.authorityType,
      r.electionType,
      r.seats,
      r.electorate,
      r.ballots,
      r.invalidVotes,
      r.validBallots,
      r.winningPct,
      r.quota,
      r.underPar,
      r.isBelowQuota ? 1 : 0
    );
    for (const cand of r.candidates) {
      insCand.run(
        r.ecCode,
        cand.rank,
        cand.name,
        cand.party,
        cand.partyAbbrev,
        cand.votes,
        cand.elected ? 1 : 0,
        cand.electedSource ? 1 : 0,
        cand.gender,
        cand.incumbent
      );
    }
  }
});
tx();
db.close();
console.log(`[etl] wrote ${SQLITE_PATH}`);

// --- Emit per-table CSVs alongside the SQLite ---
writeCsv(
  resolve(OUT_DIR, 'councils.csv'),
  councils.map((c) => ({
    council_slug: c.councilSlug,
    council: c.council,
    authority_type: c.authorityType,
    race_count: c.raceCount,
    total_seats: c.totalSeatCount,
    below_quota_seats: c.belowQuotaSeatCount,
    below_quota_share: c.belowQuotaShare.toFixed(6)
  })),
  [
    'council_slug', 'council', 'authority_type', 'race_count', 'total_seats',
    'below_quota_seats', 'below_quota_share'
  ]
);
writeCsv(
  resolve(OUT_DIR, 'races.csv'),
  races.map((r) => ({
    ec_code: r.ecCode,
    ward_code: r.wardCode,
    ward_name: r.wardName,
    ward_slug: r.wardSlug,
    council_slug: r.councilSlug,
    council: r.council,
    authority_type: r.authorityType,
    seats: r.seats,
    valid_ballots: r.validBallots,
    winning_pct: r.winningPct.toFixed(6),
    quota: r.quota.toFixed(6),
    under_par: r.underPar.toFixed(6),
    is_below_quota: r.isBelowQuota ? 1 : 0
  })),
  [
    'ec_code', 'ward_code', 'ward_name', 'ward_slug', 'council_slug', 'council',
    'authority_type', 'seats', 'valid_ballots', 'winning_pct', 'quota',
    'under_par', 'is_below_quota'
  ]
);
const candidateCsvRows = [];
for (const r of races) {
  for (const c of r.candidates) {
    candidateCsvRows.push({
      ec_code: r.ecCode,
      ward_name: r.wardName,
      council_slug: r.councilSlug,
      candidate_name: c.name,
      party: c.party,
      party_abbrev: c.partyAbbrev,
      votes: c.votes,
      elected: c.elected ? 1 : 0,
      rank: c.rank
    });
  }
}
writeCsv(
  resolve(OUT_DIR, 'candidates.csv'),
  candidateCsvRows,
  ['ec_code', 'ward_name', 'council_slug', 'candidate_name', 'party', 'party_abbrev', 'votes', 'elected', 'rank']
);

// --- Emit JSON snapshot for the SvelteKit build ---
ensureDir(SNAPSHOT_PATH);
const snapshot = {
  generatedAt: new Date().toISOString(),
  source: 'docs/LEH-2025-results-HoC.xlsx',
  electionDate: '2025-05-01',
  electionDateLabel: '1 May 2025',
  cycleLabel: 'May 2025 (dev fixture — same shape as the 2026 LEH that lands months out)',
  totals: {
    councils: councils.length,
    races: races.length,
    seats: marginal.length,
    belowQuotaSeats: marginal.filter((m) => m.underPar > 0).length
  },
  councils,
  races: races.map((r) => ({
    ecCode: r.ecCode,
    wardName: r.wardName,
    wardSlug: r.wardSlug,
    wardCode: r.wardCode,
    council: r.council,
    councilSlug: r.councilSlug,
    authorityType: r.authorityType,
    electionType: r.electionType,
    seats: r.seats,
    electorate: r.electorate,
    ballots: r.ballots,
    invalidVotes: r.invalidVotes,
    validBallots: r.validBallots,
    candidates: r.candidates.map((c) => ({
      name: c.name,
      party: c.party,
      partyAbbrev: c.partyAbbrev,
      votes: c.votes,
      elected: c.elected,
      rank: c.rank
    })),
    winningPct: r.winningPct,
    quota: r.quota,
    underPar: r.underPar,
    isBelowQuota: r.isBelowQuota
  })),
  marginalWinners: marginal
};
writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot));
console.log(`[etl] wrote ${SNAPSHOT_PATH}`);
console.log('[etl] done');
