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
import { reorganisationIndex } from './council-reorganisations.mjs';

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

// D'Hondt seat allocation, mirrors src/lib/distortion.ts. Pure function so
// the snapshot is identical to a runtime call on the same inputs.
function dhondt(parties, totalSeats) {
  const seats = new Map();
  for (const p of parties) seats.set(p.name, 0);
  if (totalSeats <= 0) return seats;
  for (let i = 0; i < totalSeats; i++) {
    let bestName = null;
    let bestQ = -Infinity;
    let bestVotes = -Infinity;
    for (const p of parties) {
      const q = p.votes / (seats.get(p.name) + 1);
      if (
        q > bestQ ||
        (q === bestQ && p.votes > bestVotes) ||
        (q === bestQ && p.votes === bestVotes && (bestName === null || p.name < bestName))
      ) {
        bestQ = q;
        bestVotes = p.votes;
        bestName = p.name;
      }
    }
    if (bestName === null) break;
    seats.set(bestName, seats.get(bestName) + 1);
  }
  return seats;
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
    // Signed gap: negative = below quota (the indictment); positive = above.
    const underPar = winningPct - quota;
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
      isBelowQuota: underPar < 0,
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

// --- Per-(year, council) party totals + D'Hondt proxy --------------------
// Sums candidate votes by party across all wards in the council in this
// cycle, then applies D'Hondt to the same total-seats target to surface
// what proportional allocation would have looked like.
//
// Caveat: in multi-member wards (bloc vote), each voter casts up to N
// votes, so parties that ran a full slate get systematically inflated
// totals vs parties that ran fewer candidates. Treat the D'Hondt column
// as a proxy, not a strict counterfactual. We document this on the
// methodology page.
const partyViewByCouncil = new Map(); // key: `${year}::${councilSlug}`
for (const r of allRaces) {
  const key = `${r.year}::${r.councilSlug}`;
  if (!partyViewByCouncil.has(key)) {
    partyViewByCouncil.set(key, {
      year: r.year,
      council: r.council,
      councilSlug: r.councilSlug,
      partyTotals: new Map(),
      totalSeats: 0,
      totalVotes: 0
    });
  }
  const view = partyViewByCouncil.get(key);
  view.totalSeats += r.candidates.filter((c) => c.elected).length;
  for (const c of r.candidates) {
    if (!c.party) continue;
    view.totalVotes += c.votes;
    if (!view.partyTotals.has(c.party)) {
      view.partyTotals.set(c.party, { votes: 0, fptpSeats: 0 });
    }
    const t = view.partyTotals.get(c.party);
    t.votes += c.votes;
    if (c.elected) t.fptpSeats += 1;
  }
}

const partyViews = [];
for (const view of partyViewByCouncil.values()) {
  const partyArr = [...view.partyTotals.entries()].map(([name, t]) => ({
    name,
    votes: t.votes,
    fptpSeats: t.fptpSeats
  }));
  const dhondtSeats = dhondt(
    partyArr.map((p) => ({ name: p.name, votes: p.votes })),
    view.totalSeats
  );
  const rows = partyArr
    .map((p) => {
      const dhondtSeatCount = dhondtSeats.get(p.name) ?? 0;
      return {
        party: p.name,
        votes: p.votes,
        voteShare: view.totalVotes > 0 ? p.votes / view.totalVotes : 0,
        fptpSeats: p.fptpSeats,
        fptpSeatShare: view.totalSeats > 0 ? p.fptpSeats / view.totalSeats : 0,
        dhondtSeats: dhondtSeatCount,
        dhondtSeatShare:
          view.totalSeats > 0 ? dhondtSeatCount / view.totalSeats : 0,
        seatDelta: p.fptpSeats - dhondtSeatCount
      };
    })
    .sort((a, b) => b.votes - a.votes);
  partyViews.push({
    year: view.year,
    council: view.council,
    councilSlug: view.councilSlug,
    totalSeats: view.totalSeats,
    totalVotes: view.totalVotes,
    rows
  });
}

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
      underPar: winningPct - r.quota,
      wardName: r.wardName,
      wardSlug: r.wardSlug,
      council: r.council,
      councilSlug: r.councilSlug,
      seats: r.seats,
      validBallots: r.validBallots
    });
  }
}
// Sort most-negative-first (= furthest below quota first), tiebreak by lowest raw votes.
marginal.sort((a, b) => a.underPar - b.underPar || a.votes - b.votes);

// --- Council flips: same council, consecutive cycles, plurality changed --
//
// "Plurality" here = the party that won the most seats this cycle (FPTP
// definition of who controls the council). A flip is when consecutive
// cycles for the same council have different plurality parties. The
// editorial story is the cases where the plurality changed despite tiny
// vote-share movement — FPTP volatility on small swings.
//
// Caveat: by-thirds councils elect only a third of seats per cycle, so
// comparing 2024→2025 for a by-thirds council compares different sets of
// wards. Page copy explains this.
const partyViewByKey = new Map();
for (const v of partyViews) {
  partyViewByKey.set(`${v.year}::${v.councilSlug}`, v);
}
const viewsByCouncil = new Map();
for (const v of partyViews) {
  const arr = viewsByCouncil.get(v.councilSlug) ?? [];
  arr.push(v);
  viewsByCouncil.set(v.councilSlug, arr);
}
const flips = [];
for (const [slug, views] of viewsByCouncil) {
  if (views.length < 2) continue;
  views.sort((a, b) => a.year - b.year);
  for (let i = 1; i < views.length; i++) {
    const prev = views[i - 1];
    const next = views[i];
    const pluralityOf = (rows) =>
      [...rows].sort(
        (a, b) => b.fptpSeats - a.fptpSeats || b.votes - a.votes
      )[0] ?? null;
    const prevP = pluralityOf(prev.rows);
    const nextP = pluralityOf(next.rows);
    if (!prevP || !nextP) continue;
    if (prevP.party === nextP.party) continue;

    const newInPrev = prev.rows.find((r) => r.party === nextP.party);
    const oldInNext = next.rows.find((r) => r.party === prevP.party);
    const totalPrev = prev.totalSeats || 1;
    const totalNext = next.totalSeats || 1;
    const newPartyVoteFrom = newInPrev?.voteShare ?? 0;
    const newPartyVoteTo = nextP.voteShare;
    const newPartySeatFrom = (newInPrev?.fptpSeats ?? 0) / totalPrev;
    const newPartySeatTo = nextP.fptpSeats / totalNext;
    const oldPartyVoteFrom = prevP.voteShare;
    const oldPartyVoteTo = oldInNext?.voteShare ?? 0;
    const oldPartySeatFrom = prevP.fptpSeats / totalPrev;
    const oldPartySeatTo = (oldInNext?.fptpSeats ?? 0) / totalNext;
    const voteSwingNew = Math.abs(newPartyVoteTo - newPartyVoteFrom);
    const seatSwingNew = Math.abs(newPartySeatTo - newPartySeatFrom);

    flips.push({
      councilSlug: slug,
      council: prev.council,
      yearFrom: prev.year,
      yearTo: next.year,
      fromParty: prevP.party,
      toParty: nextP.party,
      newPartyVoteFrom,
      newPartyVoteTo,
      newPartySeatFrom,
      newPartySeatTo,
      oldPartyVoteFrom,
      oldPartyVoteTo,
      oldPartySeatFrom,
      oldPartySeatTo,
      voteSwingNew,
      seatSwingNew,
      // Disproportion score: seat-swing-per-unit-vote-swing. Higher =
      // smaller vote shift produced a bigger seat shift, which is the
      // FPTP-volatility story Felix wants to lead with. Floor at 1pp on
      // the denominator so we don't divide by zero (and so a 0pp vote
      // shift with a big seat shift still ranks).
      disproportionScore: seatSwingNew / Math.max(voteSwingNew, 0.01)
    });
  }
}
flips.sort((a, b) => b.disproportionScore - a.disproportionScore);

// --- Council reorganisations (curated) ---------------------------------
//
// Drawn from scripts/council-reorganisations.mjs — a hand-curated table of
// known UK council reorganisations during our window (2019–2023 wave),
// sourced from the Wikipedia/Commons Library record of LGR. We attach
// these to the relevant council slugs so the council overview page can
// flag "this council was created/abolished in YYYY" rather than silently
// presenting two different electoral bodies as one continuous series.
const reorgIndex = reorganisationIndex();
const reorganisations = [];
for (const slug of new Set(allRaces.map((r) => r.councilSlug))) {
  const entry = reorgIndex.get(slug);
  if (entry) reorganisations.push(entry);
}
console.log(
  `[etl] flagged ${reorganisations.length} councils as touched by a known reorganisation`
);

const totals = {
  cycles: cycleSummaries.length,
  councils: councils.length,
  races: allRaces.length,
  seats: marginal.length,
  belowQuotaSeats: marginal.filter((m) => m.underPar < 0).length,
  flips: flips.length
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

CREATE TABLE council_flips (
  council_slug TEXT NOT NULL,
  year_from INTEGER NOT NULL,
  year_to INTEGER NOT NULL,
  from_party TEXT NOT NULL,
  to_party TEXT NOT NULL,
  new_party_vote_from REAL NOT NULL,
  new_party_vote_to REAL NOT NULL,
  new_party_seat_from REAL NOT NULL,
  new_party_seat_to REAL NOT NULL,
  old_party_vote_from REAL NOT NULL,
  old_party_vote_to REAL NOT NULL,
  old_party_seat_from REAL NOT NULL,
  old_party_seat_to REAL NOT NULL,
  vote_swing_new REAL NOT NULL,
  seat_swing_new REAL NOT NULL,
  disproportion_score REAL NOT NULL,
  PRIMARY KEY (council_slug, year_from, year_to)
);
CREATE TABLE council_reorganisations (
  council_slug TEXT NOT NULL,
  council_name TEXT NOT NULL,
  -- 'created' (this council came into existence) or 'abolished' (this
  -- council ceased to exist on the date below)
  event TEXT NOT NULL,
  date TEXT NOT NULL,
  year INTEGER NOT NULL,
  -- the abolished councils that this new one replaced, OR the new
  -- council that replaced this abolished one. Stored as JSON array.
  counterparts TEXT NOT NULL,
  PRIMARY KEY (council_slug, event)
);
CREATE TABLE party_view (
  year INTEGER NOT NULL,
  council_slug TEXT NOT NULL,
  party TEXT NOT NULL,
  votes INTEGER NOT NULL,
  vote_share REAL NOT NULL,
  fptp_seats INTEGER NOT NULL,
  fptp_seat_share REAL NOT NULL,
  -- D'Hondt seat count if total council seats were allocated proportionally
  -- to party vote totals (a proxy for what list-PR would deliver — see
  -- methodology for the bloc-vote inflation caveat).
  dhondt_seats INTEGER NOT NULL,
  dhondt_seat_share REAL NOT NULL,
  -- fptp_seats - dhondt_seats; positive = over-represented by FPTP
  seat_delta INTEGER NOT NULL,
  PRIMARY KEY (year, council_slug, party),
  FOREIGN KEY (year, council_slug) REFERENCES councils(year, council_slug)
);
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
const insReorg = db.prepare(`
INSERT INTO council_reorganisations (council_slug, council_name, event, date, year, counterparts)
VALUES (?, ?, ?, ?, ?, ?)
`);
const insFlip = db.prepare(`
INSERT INTO council_flips (council_slug, year_from, year_to, from_party, to_party,
  new_party_vote_from, new_party_vote_to, new_party_seat_from, new_party_seat_to,
  old_party_vote_from, old_party_vote_to, old_party_seat_from, old_party_seat_to,
  vote_swing_new, seat_swing_new, disproportion_score)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insPartyView = db.prepare(`
INSERT INTO party_view (year, council_slug, party, votes, vote_share, fptp_seats, fptp_seat_share, dhondt_seats, dhondt_seat_share, seat_delta)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  for (const view of partyViews) {
    for (const row of view.rows) {
      insPartyView.run(
        view.year, view.councilSlug, row.party, row.votes, row.voteShare,
        row.fptpSeats, row.fptpSeatShare, row.dhondtSeats, row.dhondtSeatShare, row.seatDelta
      );
    }
  }
  for (const f of flips) {
    insFlip.run(
      f.councilSlug, f.yearFrom, f.yearTo, f.fromParty, f.toParty,
      f.newPartyVoteFrom, f.newPartyVoteTo, f.newPartySeatFrom, f.newPartySeatTo,
      f.oldPartyVoteFrom, f.oldPartyVoteTo, f.oldPartySeatFrom, f.oldPartySeatTo,
      f.voteSwingNew, f.seatSwingNew, f.disproportionScore
    );
  }
  for (const r of reorganisations) {
    insReorg.run(
      r.councilSlug, r.councilName, r.event, r.date, r.year,
      JSON.stringify(r.counterparts)
    );
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
  marginalWinners: marginal,
  partyViews,
  flips,
  reorganisations
};
writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot));
console.log(`[etl] wrote ${SNAPSHOT_PATH}`);
console.log('[etl] done');
