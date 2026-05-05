#!/usr/bin/env node
// Multi-year ETL for the LEH (Local Election Handbook) workbooks downloaded
// into ./docs. Each year has a slightly different sheet layout, so we drive
// ingestion through a per-cycle adapter config rather than a single rigid
// schema. Output: SQLite database (sceptic-grade), per-table CSVs, and a
// JSON snapshot consumed by the SvelteKit server load functions.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { Database } from 'bun:sqlite';
import { normalizeParty } from './party-normalize.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'static/data');
const SQLITE_PATH = resolve(OUT_DIR, 'results.sqlite');
const SNAPSHOT_PATH = resolve(ROOT, 'src/lib/data/generated.json');

// --- Cycle configuration -----------------------------------------------------
// Each cycle declares the workbook to read, the polling date, and the column
// names to map onto our internal canonical schema. Adapters pull rows through
// `loadSheet` (which trims stray whitespace from header keys) and use
// `cols.candidates` / `cols.wards` to project them.

const CYCLES = [
  {
    year: 2021,
    electionDate: '2021-05-06',
    electionDateLabel: '6 May 2021',
    file: 'docs/local_elections_2021_results-2.xlsx',
    candSheet: 'Candidates-results',
    wardSheet: 'Wards-results',
    candHeaderRow: 1,
    wardHeaderRow: 1,
    cols: {
      cand: {
        council: 'Local authority name',
        wardCode: 'Ward/ED code',
        wardName: 'Ward/ED name',
        candidateName: 'Candidate name',
        party: 'Party name',
        votes: 'Votes',
        electedSource: 'Elected'
      },
      ward: {
        council: 'Local authority name',
        wardCode: 'Ward/ED code',
        wardName: 'Ward/ED name',
        seats: 'Vacancies',
        electorate: 'Electorate',
        authorityType: 'Type'
      }
    }
  },
  {
    year: 2022,
    electionDate: '2022-05-05',
    electionDateLabel: '5 May 2022',
    file: 'docs/local-elections-2022.xlsx',
    candSheet: 'Candidates-results',
    wardSheet: 'Wards-results',
    candHeaderRow: 1,
    wardHeaderRow: 1,
    cols: {
      cand: {
        council: 'Local authority name',
        wardCode: 'Ward code',
        wardName: 'Ward name',
        candidateName: 'Candidate name',
        party: 'Party name',
        votes: 'Votes',
        electedSource: 'Elected'
      },
      ward: {
        council: 'Local authority name',
        wardCode: 'Ward code',
        wardName: 'Ward name',
        seats: 'Vacancies',
        electorate: 'Electorate',
        authorityType: 'Type'
      }
    }
  },
  {
    year: 2023,
    electionDate: '2023-05-04',
    electionDateLabel: '4 May 2023',
    file: 'docs/LEH-Candidates-2023.xlsx',
    candSheet: 'Cand_Table',
    wardSheet: 'Ward_Level',
    candHeaderRow: 0,
    wardHeaderRow: 0,
    // 2023 uses a completely different schema — no separate ward code, all
    // upper-snake-case column names. We synthesise a ward key from
    // (council, ward name).
    cols: {
      cand: {
        council: 'DISTRICTNAME',
        wardCode: null, // synthesised from council + ward name
        wardName: 'WARDNAME',
        candidateName: 'NAME',
        party: 'PARTYNAME',
        votes: 'VOTE',
        electedSource: 'WINNER'
      },
      ward: {
        council: 'DISTRICTNAME',
        wardCode: null,
        wardName: 'WARDNAME',
        seats: 'VACS',
        electorate: 'ELECT',
        authorityType: 'TYPE'
      }
    }
  },
  {
    year: 2024,
    electionDate: '2024-05-02',
    electionDateLabel: '2 May 2024',
    file: 'docs/LEH-2024-results-HoC-version.xlsx',
    candSheet: 'Candidates results',
    wardSheet: 'Wards results',
    candHeaderRow: 1,
    wardHeaderRow: 1,
    cols: {
      cand: {
        council: 'Local authority name',
        wardCode: 'Ward code',
        wardName: 'Ward name',
        candidateName: 'Name',
        party: 'Party name',
        votes: 'Votes',
        electedSource: 'Elected'
      },
      ward: {
        council: 'Local authority name',
        wardCode: 'Ward code',
        wardName: 'Ward name',
        seats: 'Vacancies',
        electorate: 'Electorate',
        authorityType: 'Local authority type'
      }
    }
  },
  {
    year: 2025,
    electionDate: '2025-05-01',
    electionDateLabel: '1 May 2025',
    file: 'docs/LEH-2025-results-HoC.xlsx',
    candSheet: 'Candidates result',
    wardSheet: 'Ward results',
    candHeaderRow: 1,
    wardHeaderRow: 1,
    cols: {
      cand: {
        council: 'Lower tier authority',
        wardCode: 'EC ward code',
        wardName: 'Ward/ County Electoral District name',
        candidateName: 'Candidate name',
        party: 'Party name',
        votes: 'Votes cast',
        electedSource: 'Elected'
      },
      ward: {
        council: 'Lower tier authority',
        wardCode: 'EC ward code',
        wardName: 'Ward/ County Electoral District name',
        seats: 'Seats',
        electorate: 'Electorate',
        ballots: 'Ballots',
        invalidVotes: 'Invalid votes',
        authorityType: 'Local authority type'
      }
    }
  }
];

// --- Helpers -----------------------------------------------------------------

/**
 * Title-case an all-uppercase ward name. About 2% of LEH ward rows are
 * shouted in upper case (Westminster's "LITTLE VENICE", "QUEENS PARK";
 * many Amber Valley wards in 2022; etc.). If the string has any
 * lowercase letter we leave it alone — the source already capitalised
 * it intentionally (e.g. "St James's", "Knightsbridge & Belgravia").
 */
function titleCaseWardName(s) {
  if (!s) return s;
  if (/[a-z]/.test(s)) return s;
  return s.replace(
    /([A-Z][A-Z']*)/g,
    (word) => word.charAt(0) + word.slice(1).toLowerCase()
  );
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
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

function loadSheet(wb, name, headerRow) {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Missing sheet: ${name}`);
  const rows = XLSX.utils.sheet_to_json(ws, { range: headerRow, defval: null });
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

function quotaForSeats(seats) {
  return Number.isFinite(seats) && seats >= 1 ? 1 / (seats + 1) : 0.5;
}

// Stable synthetic ward key for cycles (notably 2023) where the source has
// no ward code. council slug + ward slug uniquely identifies a race within
// a council, which is enough for our purposes — we never join across years
// on ward code anyway (ward boundaries change between cycles).
function deriveWardKey(cycle, councilSlug, wardName) {
  return `Y${cycle.year}-${councilSlug}-${slugify(wardName)}`;
}

// --- Per-cycle ingest --------------------------------------------------------

function ingestCycle(cycle) {
  const file = resolve(ROOT, cycle.file);
  if (!existsSync(file)) {
    console.warn(`[etl] skipping ${cycle.year}: file not found ${file}`);
    return null;
  }
  const wb = XLSX.read(readFileSync(file), { type: 'buffer' });
  const candidatesRaw = loadSheet(wb, cycle.candSheet, cycle.candHeaderRow);
  const wardsRaw = loadSheet(wb, cycle.wardSheet, cycle.wardHeaderRow);

  // Build wards keyed by either source ward code or synthetic key.
  const wardsByKey = new Map();
  for (const w of wardsRaw) {
    const wc = cycle.cols.ward;
    const council = String(w[wc.council] ?? '').trim();
    if (!council) continue;
    const wardName = titleCaseWardName(String(w[wc.wardName] ?? '').trim());
    const wardCodeRaw = wc.wardCode ? w[wc.wardCode] : null;
    const councilSlug = slugify(council);
    const wardCode = wardCodeRaw != null ? String(wardCodeRaw).trim() : null;
    const key = wardCode
      ? `${cycle.year}::${wardCode}`
      : deriveWardKey(cycle, councilSlug, wardName);

    const seatsRaw = Number(w[wc.seats] ?? 0);
    const seats = Number.isFinite(seatsRaw) && seatsRaw >= 1 ? seatsRaw : 1;
    const electorate = Number(w[wc.electorate] ?? 0);
    const authorityType = w[wc.authorityType] ? String(w[wc.authorityType]).trim() : null;
    const ballots = wc.ballots != null ? Number(w[wc.ballots] ?? 0) : null;
    const invalidVotes = wc.invalidVotes != null ? Number(w[wc.invalidVotes] ?? 0) : null;

    wardsByKey.set(key, {
      year: cycle.year,
      electionDate: cycle.electionDate,
      key,
      wardCode,
      wardName,
      council,
      councilSlug,
      authorityType,
      seats,
      electorate,
      ballots,
      invalidVotes,
      candidates: []
    });
  }

  // Attach candidates.
  let orphanCount = 0;
  for (const c of candidatesRaw) {
    const cc = cycle.cols.cand;
    const council = String(c[cc.council] ?? '').trim();
    if (!council) {
      orphanCount += 1;
      continue;
    }
    const wardName = titleCaseWardName(String(c[cc.wardName] ?? '').trim());
    const wardCodeRaw = cc.wardCode ? c[cc.wardCode] : null;
    const councilSlug = slugify(council);
    const wardCode = wardCodeRaw != null ? String(wardCodeRaw).trim() : null;
    const key = wardCode
      ? `${cycle.year}::${wardCode}`
      : deriveWardKey(cycle, councilSlug, wardName);
    const ward = wardsByKey.get(key);
    if (!ward) {
      orphanCount += 1;
      continue;
    }
    const partyRaw = c[cc.party];
    ward.candidates.push({
      name: String(c[cc.candidateName] ?? '').trim(),
      party: normalizeParty(partyRaw) ?? '',
      votes: Number(c[cc.votes] ?? 0),
      electedSource: truthy(c[cc.electedSource]),
      elected: false // recomputed
    });
  }
  if (orphanCount > 0) {
    console.warn(`[etl ${cycle.year}] ${orphanCount} candidate rows had no matching ward`);
  }

  // Recompute elected (top N by votes, where N = seats).
  let electedOverrides = 0;
  for (const ward of wardsByKey.values()) {
    ward.candidates.sort((a, b) => b.votes - a.votes);
    const seatsToFill = Math.max(0, ward.seats);
    for (let i = 0; i < ward.candidates.length; i++) {
      const should = i < seatsToFill;
      if (should !== ward.candidates[i].electedSource) electedOverrides += 1;
      ward.candidates[i].elected = should;
      ward.candidates[i].rank = i + 1;
    }
  }
  if (electedOverrides > 0) {
    console.warn(
      `[etl ${cycle.year}] overrode source 'Elected' flag on ${electedOverrides} candidacies`
    );
  }

  // Compute per-race derived fields. valid_ballots = sum of candidate votes
  // (the LEH "Valid vote turnout (HoC method)" denominator). For 2025 we
  // also have explicit Ballots − Invalid votes; we keep both.
  const races = [];
  for (const w of wardsByKey.values()) {
    if (w.candidates.length === 0) continue;
    const votesSum = w.candidates.reduce((a, c) => a + (Number.isFinite(c.votes) ? c.votes : 0), 0);
    let validBallots = votesSum;
    let ballots = w.ballots;
    let invalidVotes = w.invalidVotes;
    if (ballots != null && invalidVotes != null && ballots - invalidVotes > 0) {
      validBallots = ballots - invalidVotes;
    } else {
      ballots = ballots ?? validBallots;
      invalidVotes = invalidVotes ?? 0;
    }
    if (validBallots <= 0) continue;

    const elected = w.candidates.filter((c) => c.elected);
    const electedPcts = elected.map((c) => c.votes / validBallots);
    const winningPct = electedPcts.length ? Math.min(...electedPcts) : 0;
    const quota = quotaForSeats(w.seats);
    const underPar = quota - winningPct;
    const wardSlug = w.wardCode
      ? slugify(`${w.wardName}-${w.wardCode}`)
      : slugify(w.wardName);

    races.push({
      year: w.year,
      electionDate: w.electionDate,
      key: w.key,
      wardCode: w.wardCode ?? '',
      wardName: w.wardName,
      wardSlug,
      council: w.council,
      councilSlug: w.councilSlug,
      authorityType: w.authorityType ?? '',
      electionType: '',
      seats: w.seats,
      electorate: w.electorate,
      ballots,
      invalidVotes,
      validBallots,
      winningPct,
      quota,
      underPar,
      isBelowQuota: underPar > 0,
      candidates: w.candidates
    });
  }

  console.log(
    `[etl ${cycle.year}] read ${candidatesRaw.length} candidate rows, ${wardsRaw.length} ward rows; produced ${races.length} races`
  );
  return { cycle, races };
}

// --- Run all cycles ----------------------------------------------------------

const allRaces = [];
const cycleSummaries = [];
for (const cycle of CYCLES) {
  const result = ingestCycle(cycle);
  if (!result) continue;
  allRaces.push(...result.races);
  const totalSeats = result.races.reduce((a, r) => a + r.candidates.filter((c) => c.elected).length, 0);
  const belowQuotaSeats = result.races.reduce((a, r) => {
    let n = 0;
    for (const c of r.candidates) {
      if (c.elected && c.votes / r.validBallots < r.quota) n += 1;
    }
    return a + n;
  }, 0);
  const distinctCouncils = new Set(result.races.map((r) => r.councilSlug));
  cycleSummaries.push({
    year: cycle.year,
    electionDate: cycle.electionDate,
    electionDateLabel: cycle.electionDateLabel,
    raceCount: result.races.length,
    seatCount: totalSeats,
    belowQuotaSeatCount: belowQuotaSeats,
    belowQuotaShare: totalSeats > 0 ? belowQuotaSeats / totalSeats : 0,
    councilCount: distinctCouncils.size
  });
}

// --- Council summaries (per (year, council)) ---------------------------------
const councilMap = new Map(); // key: `${year}::${councilSlug}`
for (const r of allRaces) {
  const key = `${r.year}::${r.councilSlug}`;
  if (!councilMap.has(key)) {
    councilMap.set(key, {
      year: r.year,
      electionDate: r.electionDate,
      council: r.council,
      councilSlug: r.councilSlug,
      authorityType: r.authorityType,
      raceCount: 0,
      totalSeatCount: 0,
      belowQuotaSeatCount: 0
    });
  }
  const s = councilMap.get(key);
  s.raceCount += 1;
  const elected = r.candidates.filter((c) => c.elected);
  s.totalSeatCount += elected.length;
  for (const c of elected) {
    if (c.votes / r.validBallots < r.quota) s.belowQuotaSeatCount += 1;
  }
}
const councils = [...councilMap.values()].map((s) => ({
  ...s,
  belowQuotaShare:
    s.totalSeatCount > 0 ? s.belowQuotaSeatCount / s.totalSeatCount : 0
}));
councils.sort((a, b) => b.year - a.year || a.council.localeCompare(b.council));

// --- Marginal-winner roll-up (one row per elected candidacy across all years)
const marginal = [];
for (const r of allRaces) {
  for (const c of r.candidates.filter((c) => c.elected)) {
    const winningPct = c.votes / r.validBallots;
    marginal.push({
      year: r.year,
      electionDate: r.electionDate,
      candidateName: c.name,
      party: c.party,
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
marginal.sort((a, b) => b.underPar - a.underPar || a.votes - b.votes);

const totals = {
  cycles: cycleSummaries.length,
  councils: councils.length,
  races: allRaces.length,
  seats: marginal.length,
  belowQuotaSeats: marginal.filter((m) => m.underPar > 0).length
};
console.log(
  `[etl] total: ${totals.cycles} cycles, ${totals.councils} council-cycles, ${totals.races} races, ${totals.seats} seats, ${totals.belowQuotaSeats} below-quota`
);

// --- Emit SQLite -------------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true });
if (existsSync(SQLITE_PATH)) rmSync(SQLITE_PATH);
const db = new Database(SQLITE_PATH, { create: true });
db.exec('PRAGMA journal_mode = DELETE');
db.exec(`
CREATE TABLE cycles (
  year INTEGER PRIMARY KEY,
  election_date TEXT NOT NULL,
  election_date_label TEXT NOT NULL,
  race_count INTEGER NOT NULL,
  seat_count INTEGER NOT NULL,
  below_quota_seat_count INTEGER NOT NULL,
  below_quota_share REAL NOT NULL,
  council_count INTEGER NOT NULL
);
CREATE TABLE councils (
  year INTEGER NOT NULL,
  council_slug TEXT NOT NULL,
  council TEXT NOT NULL,
  authority_type TEXT,
  race_count INTEGER NOT NULL,
  total_seats INTEGER NOT NULL,
  below_quota_seats INTEGER NOT NULL,
  below_quota_share REAL NOT NULL,
  PRIMARY KEY (year, council_slug),
  FOREIGN KEY (year) REFERENCES cycles(year)
);
CREATE TABLE races (
  year INTEGER NOT NULL,
  ec_code TEXT,
  ward_slug TEXT NOT NULL,
  ward_name TEXT NOT NULL,
  council_slug TEXT NOT NULL,
  council TEXT NOT NULL,
  authority_type TEXT,
  seats INTEGER NOT NULL,
  electorate INTEGER,
  ballots INTEGER,
  invalid_votes INTEGER,
  valid_ballots INTEGER NOT NULL,
  winning_pct REAL NOT NULL,
  quota REAL NOT NULL,
  under_par REAL NOT NULL,
  is_below_quota INTEGER NOT NULL,
  PRIMARY KEY (year, council_slug, ward_slug),
  FOREIGN KEY (year, council_slug) REFERENCES councils(year, council_slug)
);
CREATE TABLE candidates (
  year INTEGER NOT NULL,
  council_slug TEXT NOT NULL,
  ward_slug TEXT NOT NULL,
  rank INTEGER,
  candidate_name TEXT NOT NULL,
  party TEXT,
  votes INTEGER NOT NULL,
  elected INTEGER NOT NULL,
  -- LEH source 'Elected' flag, before our top-N-by-votes correction
  elected_source INTEGER NOT NULL,
  FOREIGN KEY (year, council_slug, ward_slug) REFERENCES races(year, council_slug, ward_slug)
);
CREATE INDEX idx_races_council ON races(year, council_slug);
CREATE INDEX idx_candidates_race ON candidates(year, council_slug, ward_slug);
`);

const insCycle = db.prepare(`
INSERT INTO cycles (year, election_date, election_date_label, race_count, seat_count, below_quota_seat_count, below_quota_share, council_count)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insCouncil = db.prepare(`
INSERT INTO councils (year, council_slug, council, authority_type, race_count, total_seats, below_quota_seats, below_quota_share)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insRace = db.prepare(`
INSERT INTO races (year, ec_code, ward_slug, ward_name, council_slug, council, authority_type, seats, electorate, ballots, invalid_votes, valid_ballots, winning_pct, quota, under_par, is_below_quota)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insCand = db.prepare(`
INSERT INTO candidates (year, council_slug, ward_slug, rank, candidate_name, party, votes, elected, elected_source)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const tx = db.transaction(() => {
  for (const c of cycleSummaries) {
    insCycle.run(c.year, c.electionDate, c.electionDateLabel, c.raceCount, c.seatCount, c.belowQuotaSeatCount, c.belowQuotaShare, c.councilCount);
  }
  for (const c of councils) {
    insCouncil.run(c.year, c.councilSlug, c.council, c.authorityType, c.raceCount, c.totalSeatCount, c.belowQuotaSeatCount, c.belowQuotaShare);
  }
  for (const r of allRaces) {
    insRace.run(
      r.year, r.wardCode || null, r.wardSlug, r.wardName, r.councilSlug, r.council,
      r.authorityType, r.seats, r.electorate, r.ballots, r.invalidVotes, r.validBallots,
      r.winningPct, r.quota, r.underPar, r.isBelowQuota ? 1 : 0
    );
    for (const cand of r.candidates) {
      insCand.run(r.year, r.councilSlug, r.wardSlug, cand.rank, cand.name, cand.party, cand.votes, cand.elected ? 1 : 0, cand.electedSource ? 1 : 0);
    }
  }
});
tx();
db.close();
console.log(`[etl] wrote ${SQLITE_PATH}`);

// --- CSVs --------------------------------------------------------------------
writeCsv(
  resolve(OUT_DIR, 'cycles.csv'),
  cycleSummaries.map((c) => ({
    year: c.year,
    election_date: c.electionDate,
    council_count: c.councilCount,
    race_count: c.raceCount,
    seat_count: c.seatCount,
    below_quota_seat_count: c.belowQuotaSeatCount,
    below_quota_share: c.belowQuotaShare.toFixed(6)
  })),
  ['year', 'election_date', 'council_count', 'race_count', 'seat_count', 'below_quota_seat_count', 'below_quota_share']
);
writeCsv(
  resolve(OUT_DIR, 'councils.csv'),
  councils.map((c) => ({
    year: c.year,
    council_slug: c.councilSlug,
    council: c.council,
    authority_type: c.authorityType,
    race_count: c.raceCount,
    total_seats: c.totalSeatCount,
    below_quota_seats: c.belowQuotaSeatCount,
    below_quota_share: c.belowQuotaShare.toFixed(6)
  })),
  ['year', 'council_slug', 'council', 'authority_type', 'race_count', 'total_seats', 'below_quota_seats', 'below_quota_share']
);
writeCsv(
  resolve(OUT_DIR, 'races.csv'),
  allRaces.map((r) => ({
    year: r.year,
    ec_code: r.wardCode,
    ward_slug: r.wardSlug,
    ward_name: r.wardName,
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
  ['year', 'ec_code', 'ward_slug', 'ward_name', 'council_slug', 'council', 'authority_type', 'seats', 'valid_ballots', 'winning_pct', 'quota', 'under_par', 'is_below_quota']
);
const candidateCsvRows = [];
for (const r of allRaces) {
  for (const c of r.candidates) {
    candidateCsvRows.push({
      year: r.year,
      council_slug: r.councilSlug,
      ward_slug: r.wardSlug,
      ward_name: r.wardName,
      candidate_name: c.name,
      party: c.party,
      votes: c.votes,
      elected: c.elected ? 1 : 0,
      rank: c.rank
    });
  }
}
writeCsv(
  resolve(OUT_DIR, 'candidates.csv'),
  candidateCsvRows,
  ['year', 'council_slug', 'ward_slug', 'ward_name', 'candidate_name', 'party', 'votes', 'elected', 'rank']
);

// --- JSON snapshot for SvelteKit server load fns ----------------------------
function ensureDir(p) {
  mkdirSync(dirname(p), { recursive: true });
}
ensureDir(SNAPSHOT_PATH);
const snapshot = {
  generatedAt: new Date().toISOString(),
  source: 'docs/LEH-{2021..2025}-results-HoC*.xlsx',
  totals,
  cycles: cycleSummaries,
  councils,
  races: allRaces.map((r) => ({
    year: r.year,
    electionDate: r.electionDate,
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
