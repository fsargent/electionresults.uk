#!/usr/bin/env node
// Multi-year ETL for the LEH (Local Election Handbook) workbooks downloaded
// into ./docs. Each year has a slightly different sheet layout, so we drive
// ingestion through a per-cycle adapter config rather than a single rigid
// schema. Output: SQLite database (sceptic-grade), per-table CSVs, and a
// JSON snapshot consumed by the SvelteKit server load functions.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
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
  // Per-word: title-case any run of 3+ consecutive capitals. Handles
  // partial-shouty source data (e.g. "POUND HILL NORTH and Forge
  // Wood") and apostrophe names (e.g. "D'ABERNON" → "D'Abernon" — the
  // apostrophe-bounded second segment is treated as its own word).
  // Single-character segments after an apostrophe are treated as
  // possessives (DUKE'S → Duke's, not Duke'S). Two-letter initials
  // (BBC etc.) are rare in ward names; the 3+ threshold lets them
  // pass through if they ever appear.
  return s.replace(/[A-Z]{3,}'?[A-Z]*/g, (word) =>
    word
      .split("'")
      .map((part, i) => {
        if (part.length === 0) return part;
        // Possessive 's after apostrophe: lowercase the lone letter.
        if (i > 0 && part.length === 1) return part.toLowerCase();
        return part.charAt(0) + part.slice(1).toLowerCase();
      })
      .join("'")
  );
}

/**
 * Normalise a ward-name string for consistency across LEH cycles.
 *
 * The LEH workbooks introduce two classes of inconsistency for the
 * same ward across years that both cause duplicate rows in the
 * ward-grid matcher (which compares literal `wardName` strings):
 *
 *   1. ` & ` vs ` and ` (e.g. "Longcross, Lyne & Chertsey South" in
 *      2021–2023 → "Longcross, Lyne and Chertsey South" in 2024).
 *      Standardise on " and ".
 *
 *   2. Capitalisation of small connecting words. UK title-case
 *      convention (Ordnance Survey, Royal Mail PAF) lowercases
 *      and / the / with / on / of / de / la / le / du / in / by
 *      mid-name. The LEH source flips between cases across years
 *      (e.g. "Horncastle and the Keals" vs "Horncastle and The Keals";
 *      "Bourton-on-the-Water" vs "Bourton-On-The-Water"). Lowercase
 *      these words wherever they appear between separators (space or
 *      hyphen) — never at the start of the name, where capitalisation
 *      is correct ("The Stows", "On the Hill ward").
 *
 * Also runs the title-case fix above for shouty source data.
 */
const SMALL_WORDS_PATTERN =
  /(?<=[ -])(And|The|With|On|Of|De|La|Le|Du|In|By|Under|Upon|Next|En)(?=[ -]|$)/g;

function normaliseWardName(s) {
  if (!s) return s;
  return titleCaseWardName(s)
    .replace(/ & /g, ' and ')
    .replace(SMALL_WORDS_PATTERN, (m) => m.toLowerCase())
    // "ST." (Saint, two-letter abbrev outside the 3+ title-case rule)
    // → "St." Source data flips between the two across cycles.
    .replace(/\bST\./g, 'St.')
    // Capital-letter + apostrophe + lowercase (e.g. "D'abernon" in one
    // cycle, "D'Abernon" in another) — capitalise the post-apostrophe
    // letter to match the convention for D'/O'/M'-prefixed names.
    .replace(/\b([A-Z])'([a-z])/g, (_, p1, p2) => `${p1}'${p2.toUpperCase()}`);
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

// LEH source data uses inconsistent council names across cycles
// (e.g. 2024 calls it "Durham", earlier cycles "County Durham"). Map
// the slugified-but-non-canonical form to the canonical councilSlug
// used elsewhere on the site so all years agree on one identity per
// real council. New mismatches will appear in the composition-LEH
// join audit at the end of this script.
const LEH_COUNCIL_SLUG_ALIASES = {
  durham: 'county-durham',
  'kingston-upon-hull': 'kingston-upon-hull-city-of'
};

function councilSlugify(name) {
  const raw = slugify(name);
  return LEH_COUNCIL_SLUG_ALIASES[raw] ?? raw;
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
    const wardName = normaliseWardName(String(w[wc.wardName] ?? '').trim());
    const wardCodeRaw = wc.wardCode ? w[wc.wardCode] : null;
    const councilSlug = councilSlugify(council);
    const wardCode = wardCodeRaw != null ? String(wardCodeRaw).trim() : null;
    const key = wardCode
      ? `${cycle.year}::${wardCode}`
      : deriveWardKey(cycle, councilSlug, wardName);

    const seatsRaw = Number(w[wc.seats] ?? 0);
    const seats = Number.isFinite(seatsRaw) && seatsRaw >= 1 ? seatsRaw : 1;
    // Use null (not 0) when the source omits a value, so the UI can
    // distinguish "not reported" from "really zero" instead of
    // rendering a misleading "Electorate 0" / "Ballots 0".
    const electorateRaw = Number(w[wc.electorate] ?? 0);
    const electorate = Number.isFinite(electorateRaw) && electorateRaw > 0 ? electorateRaw : null;
    const authorityType = w[wc.authorityType] ? String(w[wc.authorityType]).trim() : null;
    const ballotsRaw = wc.ballots != null ? Number(w[wc.ballots] ?? 0) : null;
    const ballots = Number.isFinite(ballotsRaw) && ballotsRaw > 0 ? ballotsRaw : null;
    const invalidVotesRaw = wc.invalidVotes != null ? Number(w[wc.invalidVotes] ?? 0) : null;
    const invalidVotes =
      invalidVotesRaw != null && Number.isFinite(invalidVotesRaw) ? invalidVotesRaw : null;

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
    const wardName = normaliseWardName(String(c[cc.wardName] ?? '').trim());
    const wardCodeRaw = cc.wardCode ? c[cc.wardCode] : null;
    const councilSlug = councilSlugify(council);
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

  // Compute per-race derived fields. validBallots is meant to represent
  // the number of voters (people who cast a ballot), so candidate_votes /
  // validBallots gives a candidate's share of the *electorate that
  // turned out* — comparable across single-member and multi-member
  // wards.
  //
  // In bloc-vote (multi-member FPTP) wards each voter casts up to N
  // votes, so summing candidate votes over-counts voters by ~N. When
  // the source provides actual ballots-issued data (LEH 2025 has it
  // explicitly), use ballots − invalid. Otherwise approximate voters
  // as votesSum / seats. The approximation assumes voters use all N
  // votes — most do — and matches the standard ERS adjustment for
  // bloc-vote multi-member wards.
  const races = [];
  for (const w of wardsByKey.values()) {
    if (w.candidates.length === 0) continue;
    const votesSum = w.candidates.reduce((a, c) => a + (Number.isFinite(c.votes) ? c.votes : 0), 0);
    // ballots / invalidVotes are kept as null when the source doesn't
    // report them (most LEH cycles before 2025, all of DC 2026), so the
    // per-race meta line on the UI doesn't render fake zeros. The
    // approximation only flows into validBallots so the per-candidate
    // share calculation has a sensible denominator.
    let validBallots;
    const ballots = w.ballots;
    const invalidVotes = w.invalidVotes;
    if (ballots != null && invalidVotes != null && ballots - invalidVotes > 0) {
      validBallots = ballots - invalidVotes;
    } else {
      validBallots = w.seats >= 1 ? votesSum / w.seats : votesSum;
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
      system: 'FPTP',
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

// --- Democracy Club 2026 adapter --------------------------------------------
//
// Polling-night-onward live(ish) results for the 2026 cohort. Source shape
// is one row per candidacy in a single flat CSV — different from the LEH
// workbooks (one sheet per entity), so this gets its own ingest function
// that produces the same `{ cycle, races }` output the rest of the pipeline
// already consumes.
//
// Header: person_id, person_name, election_id, ballot_paper_id,
// election_date, election_current, party_name, party_id, post_label,
// cancelled_poll, seats_contested, votes_cast, elected, tied_vote_winner,
// rank, turnout_reported, spoilt_ballots, total_electorate,
// turnout_percentage, results_source.
//
// Conventions:
//   - council slug = strip "local." prefix and ".YYYY-MM-DD" suffix from
//     election_id (e.g. "local.adur.2026-05-07" → "adur"). Aligns with
//     the LEH councilSlug derived from `slugify(councilName)`.
//   - ward key = ballot_paper_id (unique per race in DC's namespace);
//     post_label is the human-readable ward name.
//   - Skip cancelled_poll = 't' (no result will arrive for those).
//   - Skip rows where votes_cast is empty (results not yet entered for
//     that race; will get picked up on the next ETL run after DC publishes).

// Latest DC candidates export under docs/ — picks the most recently
// modified `*dc-candidates-*results_true-*.csv`. Refresh by dropping a
// new export into docs/; no edit needed here. Sorted by mtime rather
// than filename so `downloaded-...-` and bare `dc-...-` prefixes are
// both ordered correctly.
function findLatestDcExport() {
  const docsDir = resolve(ROOT, 'docs');
  const matches = readdirSync(docsDir)
    .filter((f) => /dc-candidates-.*results_true-.*\.csv$/i.test(f))
    .map((f) => {
      const path = resolve(docsDir, f);
      return { name: f, path, mtimeMs: statSync(path).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return matches[0]?.path ?? null;
}

const DC_2026_FILE = findLatestDcExport();
const DC_2026_CYCLE = {
  year: 2026,
  electionDate: '2026-05-07',
  electionDateLabel: '7 May 2026',
  file: DC_2026_FILE
};

// Council-name lookup so DC slugs render with the LEH-style display name
// when our prior-cycle data has it. Falls back to title-casing the slug
// for councils we've never seen before (e.g. LGR-successor councils that
// didn't exist in 2021–2024).
const councilNameBySlug = new Map();
function rememberCouncilName(slug, name) {
  if (slug && name && !councilNameBySlug.has(slug)) {
    councilNameBySlug.set(slug, name);
  }
}
function titleCaseFromSlug(slug) {
  return slug
    .split('-')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

function parseCsv(text) {
  // Standard CSV — quoted fields may contain commas and escaped quotes
  // (""). XLSX.read handles all of that, so we route through it rather
  // than reimplementing.
  const wb = XLSX.read(text, { type: 'string' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
}

function councilSlugFromElectionId(electionId, electionDate) {
  // election_id format: "local.<slug>.<YYYY-MM-DD>". Strip the "local."
  // prefix and the trailing date.
  if (!electionId) return null;
  let s = String(electionId).trim();
  if (s.startsWith('local.')) s = s.slice('local.'.length);
  const dateSuffix = `.${electionDate}`;
  if (s.endsWith(dateSuffix)) s = s.slice(0, -dateSuffix.length);
  return s || null;
}

function ingestDcCycle(cycle) {
  if (!cycle.file) {
    console.warn(`[etl] skipping ${cycle.year}: no DC export found in docs/`);
    return null;
  }
  const file = resolve(ROOT, cycle.file);
  if (!existsSync(file)) {
    console.warn(`[etl] skipping ${cycle.year}: file not found ${file}`);
    return null;
  }
  console.log(`[etl ${cycle.year}] DC source: ${cycle.file.split('/').pop()}`);
  const rows = parseCsv(readFileSync(file, 'utf8'));

  // Build wards keyed by ballot_paper_id (one race per ward).
  const wardsByKey = new Map();
  let skippedCancelled = 0;
  let skippedNoBallot = 0;
  let skippedByElection = 0;
  for (const r of rows) {
    if (truthy(r.cancelled_poll)) {
      skippedCancelled++;
      continue;
    }
    const ballot = r.ballot_paper_id ? String(r.ballot_paper_id).trim() : '';
    if (!ballot) {
      skippedNoBallot++;
      continue;
    }
    // By-elections held on the same day as the cohort vote (DC marks
    // them with `.by.` in the ballot_paper_id, e.g.
    // `local.chelmsford.broomfield-and-the-walthams.by.2026-05-07`).
    // These aren't part of the council's full-cycle electorate, just a
    // single mid-term seat being filled. Including them would make a
    // non-cohort council appear on the 2026 map with one trivial 0%
    // distortion datapoint.
    if (/\.by\./i.test(ballot)) {
      skippedByElection++;
      continue;
    }
    const councilSlug = councilSlugFromElectionId(r.election_id, cycle.electionDate);
    if (!councilSlug) continue;
    const wardName = normaliseWardName(String(r.post_label ?? '').trim());
    const seats = Number(r.seats_contested ?? 1) || 1;
    // DC ships total_electorate empty for most 2026 wards. Keep null
    // when missing so the UI can hide "Electorate 0" rather than
    // misreporting it as zero.
    const electorateRaw = Number(r.total_electorate ?? 0);
    const electorate = Number.isFinite(electorateRaw) && electorateRaw > 0 ? electorateRaw : null;
    const partyRaw = r.party_name;
    // Keep all candidacies in memory regardless of whether votes have
    // been entered yet — the partial-results filter below drops the
    // whole ward if any candidacy is still pending. This avoids
    // marking the wrong N candidates as "elected" in a ward where
    // only some candidacies have results.
    const hasVotes = r.votes_cast !== null && r.votes_cast !== '';
    const candidate = {
      name: String(r.person_name ?? '').trim(),
      party: normalizeParty(partyRaw) ?? '',
      votes: hasVotes ? Number(r.votes_cast) || 0 : null,
      electedSource: truthy(r.elected),
      elected: false // recomputed
    };
    let ward = wardsByKey.get(ballot);
    if (!ward) {
      ward = {
        year: cycle.year,
        electionDate: cycle.electionDate,
        key: ballot,
        wardCode: ballot,
        wardName,
        council: '', // resolved below
        councilSlug,
        authorityType: null,
        seats,
        electorate,
        ballots: null,
        invalidVotes:
          r.spoilt_ballots != null && r.spoilt_ballots !== ''
            ? Number(r.spoilt_ballots) || 0
            : null,
        candidates: []
      };
      wardsByKey.set(ballot, ward);
    }
    ward.candidates.push(candidate);
  }

  // Per-council coverage snapshot, captured BEFORE we drop incomplete
  // wards. Used downstream to render incomplete cohort councils as
  // black on the homepage maps (rather than colouring them by their
  // partial counted subset, or hiding them as no-data grey).
  const coverageByCouncil = new Map(); // slug -> { wardsExpected, wardsCounted }
  for (const ward of wardsByKey.values()) {
    const slug = ward.councilSlug;
    const cur = coverageByCouncil.get(slug) ?? { wardsExpected: 0, wardsCounted: 0 };
    cur.wardsExpected += 1;
    coverageByCouncil.set(slug, cur);
  }

  // Drop wards where any candidacy is still pending — preliminary
  // results are useless for this site's analyses (vote share, FPTP
  // distortion, quota gap) until the full count is in.
  let skippedPartialWards = 0;
  let skippedPendingCands = 0;
  for (const [key, ward] of wardsByKey) {
    const pending = ward.candidates.filter((c) => c.votes === null).length;
    if (pending > 0) {
      skippedPartialWards++;
      skippedPendingCands += pending;
      wardsByKey.delete(key);
    } else {
      const slug = ward.councilSlug;
      const cur = coverageByCouncil.get(slug);
      if (cur) cur.wardsCounted += 1;
    }
  }

  // Recompute elected (top N by votes, where N = seats) — same rule
  // the LEH adapter applies, so the snapshot is consistent across
  // cycles even when the source flag lags.
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

  // Materialise races, mirroring ingestCycle()'s derived fields.
  // DC doesn't (yet) report ballots-issued or turnout per race, so for
  // multi-member (bloc-vote) wards we approximate voters as
  // votesSum / seats — the standard ERS adjustment that makes the
  // per-candidate "won at" % comparable to single-member wards and to
  // the Droop quota benchmark.
  const races = [];
  for (const w of wardsByKey.values()) {
    if (w.candidates.length === 0) continue;
    const votesSum = w.candidates.reduce(
      (a, c) => a + (Number.isFinite(c.votes) ? c.votes : 0),
      0
    );
    if (votesSum <= 0) continue;
    const validBallots = w.seats >= 1 ? votesSum / w.seats : votesSum;
    // DC doesn't publish ballots-issued, so we don't fabricate one.
    // The race meta line on the UI hides this when null instead of
    // showing the synthetic round(validBallots) we used to emit.
    const ballots = null;
    const elected = w.candidates.filter((c) => c.elected);
    const electedPcts = elected.map((c) => c.votes / validBallots);
    const winningPct = electedPcts.length ? Math.min(...electedPcts) : 0;
    const quota = quotaForSeats(w.seats);
    const underPar = winningPct - quota;
    const wardSlug = slugify(`${w.wardName}-${w.wardCode}`);
    const councilName =
      councilNameBySlug.get(w.councilSlug) ?? titleCaseFromSlug(w.councilSlug);
    rememberCouncilName(w.councilSlug, councilName);
    races.push({
      year: w.year,
      electionDate: w.electionDate,
      key: w.key,
      wardCode: w.wardCode,
      wardName: w.wardName,
      wardSlug,
      council: councilName,
      councilSlug: w.councilSlug,
      authorityType: '',
      electionType: '',
      system: 'FPTP',
      seats: w.seats,
      electorate: w.electorate,
      ballots,
      invalidVotes: w.invalidVotes,
      validBallots,
      winningPct,
      quota,
      underPar,
      isBelowQuota: underPar < 0,
      candidates: w.candidates
    });
  }

  console.log(
    `[etl ${cycle.year}] DC: read ${rows.length} candidacy rows ` +
      `(${skippedCancelled} cancelled, ${skippedNoBallot} no ballot id, ` +
      `${skippedByElection} by-election rows); ` +
      `dropped ${skippedPartialWards} wards still counting ` +
      `(${skippedPendingCands} pending candidacies); ` +
      `produced ${races.length} races, ` +
      `${electedOverrides} source-elected overrides`
  );
  return { cycle, races, coverage: coverageByCouncil };
}

// --- Scottish STV adapter (2022) ---------------------------------------
//
// Scotland has used Single Transferable Vote (STV) for council elections
// since 2007. The 2022 cycle is the most recent and serves as the
// proportional-system contrast to the FPTP English/Welsh data.
//
// Source: indylive.radio's CC-BY-SA 4.0 redistribution of the 2022
// Scottish council results. One row per candidacy with first-preference
// votes, the round-by-round transfer counts (transfers02..transfers13 +
// total_votes02..total_votes13), and the actual elected flag from the
// council's eCount export. Per-ward fields (electorate, total_poll,
// valid_poll, rejected, quota, seats) are repeated on every candidate
// row.
//
// For the editorial framing we only need first-prefs by party and
// final seats by party — the STV transfer rounds get preserved as raw
// CSV under static/data/stv/ for sister-site (stv.vote) reuse.

const SCOTLAND_STV_CYCLE = {
  year: 2022,
  electionDate: '2022-05-05',
  electionDateLabel: '5 May 2022',
  file: 'docs/scotland-2022-stv-indylive.csv',
  region: 'Scotland'
};

function ingestScottishStvCycle(cycle) {
  const file = resolve(ROOT, cycle.file);
  if (!existsSync(file)) {
    console.warn(`[etl] skipping Scotland ${cycle.year}: file not found ${file}`);
    return null;
  }
  const rows = parseCsv(readFileSync(file, 'utf8'));

  // Build wards keyed by council + cand_ward_id.
  const wardsByKey = new Map();
  for (const r of rows) {
    const councilSlug = String(r.council_id ?? '').trim();
    if (!councilSlug) continue;
    const wardCode = String(r.cand_ward_id ?? r.map_ward_id ?? '').trim();
    if (!wardCode) continue;
    const key = `${councilSlug}::${wardCode}`;
    const wardName = normaliseWardName(String(r.ward_name ?? '').trim());
    const seats = Number(r.seats ?? 1) || 1;
    const electorate = Number(r.electorate ?? 0) || null;
    const validPoll = Number(r.valid_poll ?? 0) || 0;
    const rejected = Number(r.rejected ?? 0) || 0;
    const totalPoll = Number(r.total_poll ?? 0) || 0;

    let ward = wardsByKey.get(key);
    if (!ward) {
      ward = {
        year: cycle.year,
        electionDate: cycle.electionDate,
        key,
        wardCode,
        wardName,
        council: String(r.council_name ?? '').trim(),
        councilSlug,
        authorityType: 'Scottish council',
        seats,
        electorate,
        ballots: totalPoll > 0 ? totalPoll : null,
        invalidVotes: rejected > 0 ? rejected : null,
        validBallots: validPoll > 0 ? validPoll : 0,
        candidates: []
      };
      wardsByKey.set(key, ward);
    }
    const partyRaw = r.party_name;
    ward.candidates.push({
      name: String(r.name ?? '').trim().replace(/^"|"$/g, ''),
      party: normalizeParty(partyRaw) ?? '',
      votes: Number(r.first_prefs ?? 0) || 0,
      electedSource: String(r.elected ?? '').trim() === '1',
      elected: String(r.elected ?? '').trim() === '1'
    });
  }

  // Materialise races. STV "winning_pct" reuses the same field so the
  // shape stays compatible, but it's the marginal elected candidate's
  // first-preference share — informational only; the editorial
  // distortion claim for STV lives at the council/party level.
  const races = [];
  for (const w of wardsByKey.values()) {
    if (w.candidates.length === 0) continue;
    const validBallots = w.validBallots > 0
      ? w.validBallots
      : w.candidates.reduce((a, c) => a + c.votes, 0);
    if (validBallots <= 0) continue;
    w.candidates.sort((a, b) => b.votes - a.votes);
    for (let i = 0; i < w.candidates.length; i++) w.candidates[i].rank = i + 1;
    const elected = w.candidates.filter((c) => c.elected);
    const electedPcts = elected.map((c) => c.votes / validBallots);
    const winningPct = electedPcts.length ? Math.min(...electedPcts) : 0;
    const quota = quotaForSeats(w.seats);
    const underPar = winningPct - quota;
    const wardSlug = slugify(`${w.wardName}-${w.wardCode}`);
    races.push({
      year: w.year,
      electionDate: w.electionDate,
      key: w.key,
      wardCode: w.wardCode,
      wardName: w.wardName,
      wardSlug,
      council: w.council,
      councilSlug: w.councilSlug,
      authorityType: w.authorityType,
      electionType: '',
      system: 'STV',
      seats: w.seats,
      electorate: w.electorate,
      ballots: w.ballots,
      invalidVotes: w.invalidVotes,
      validBallots,
      winningPct,
      quota,
      underPar,
      isBelowQuota: underPar < 0,
      candidates: w.candidates
    });
  }

  console.log(
    `[etl ${cycle.year}] Scotland STV: read ${rows.length} candidacy rows; ` +
      `produced ${races.length} races across ${new Set(races.map((r) => r.councilSlug)).size} councils`
  );
  return { cycle, races };
}

// --- Run all cycles ----------------------------------------------------------

const allRaces = [];
const cycleSummaries = [];
// Seed the council-name lookup from prior-cycle LEH data BEFORE running
// the DC adapter, so DC's slug-only rows can pick up the LEH display
// name (e.g. "Adur" not "adur" → "Adur"; "City of London" not "city-of-
// london" → "City Of London").
for (const cycle of CYCLES) {
  const result = ingestCycle(cycle);
  if (!result) continue;
  for (const r of result.races) rememberCouncilName(r.councilSlug, r.council);
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

// Scotland 2022 STV — runs alongside the English 2022 LEH cycle. We
// don't merge them into one cycleSummary entry because the systems
// don't share a denominator: distortion / below-quota framing makes
// sense only for FPTP. Scottish councils get their own (year, councilSlug)
// keys that don't collide with English ones.
{
  const result = ingestScottishStvCycle(SCOTLAND_STV_CYCLE);
  if (result) {
    for (const r of result.races) rememberCouncilName(r.councilSlug, r.council);
    allRaces.push(...result.races);
    // Don't push a separate cycleSummaries entry for Scotland — the
    // 2022 row already exists for England and the homepage cycle list
    // groups by year. Scotland's contribution shows up via the
    // dedicated STV section.
  }
}

// 2026 cycle (Democracy Club preliminary results — runs after the LEH
// loop so the DC adapter can pick up display names from prior cycles).
let cycle2026Coverage = null;
{
  const result = ingestDcCycle(DC_2026_CYCLE);
  if (result) {
    allRaces.push(...result.races);
    cycle2026Coverage = Object.fromEntries(
      [...result.coverage.entries()].map(([slug, c]) => [
        slug,
        {
          wardsExpected: c.wardsExpected,
          wardsCounted: c.wardsCounted,
          complete: c.wardsCounted === c.wardsExpected
        }
      ])
    );
    const totalSeats = result.races.reduce(
      (a, r) => a + r.candidates.filter((c) => c.elected).length,
      0
    );
    const belowQuotaSeats = result.races.reduce((a, r) => {
      let n = 0;
      for (const c of r.candidates) {
        if (c.elected && c.votes / r.validBallots < r.quota) n += 1;
      }
      return a + n;
    }, 0);
    const distinctCouncils = new Set(result.races.map((r) => r.councilSlug));
    cycleSummaries.push({
      year: DC_2026_CYCLE.year,
      electionDate: DC_2026_CYCLE.electionDate,
      electionDateLabel: DC_2026_CYCLE.electionDateLabel,
      raceCount: result.races.length,
      seatCount: totalSeats,
      belowQuotaSeatCount: belowQuotaSeats,
      belowQuotaShare: totalSeats > 0 ? belowQuotaSeats / totalSeats : 0,
      councilCount: distinctCouncils.size
    });
  }
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
      system: r.system ?? 'FPTP',
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
    system: view.system,
    totalSeats: view.totalSeats,
    totalVotes: view.totalVotes,
    rows
  });
}

// --- Marginal-winner roll-up (one row per elected candidacy across all years)
//
// Restricted to FPTP races. STV "winning %" is a candidate's first-pref
// share, but they may have been elected on transfers — surfacing that
// figure on the "lowest share" leaderboard would mislead.
const marginal = [];
for (const r of allRaces) {
  if (r.system === 'STV') continue;
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

// --- Composition truth-set (opencouncildata) ----------------------------
//
// Annual snapshot of every council's actual composition (per-party seat
// counts) sourced from https://opencouncildata.co.uk. Captures live
// composition including by-elections and defections, not just election
// cycles. Used to:
//   (a) replace the cycle-leader-based flip detection with a
//       composition-truth definition (a flip is when the largest party
//       in the running composition actually changes — not when one
//       cycle's election produced a different cycle leader)
//   (b) replace the "Council composition (approx.)" sum-across-cycles
//       approximation on per-council pages with the actual snapshot
//
// Provenance: docs/history2016-2025.csv, downloaded from
// opencouncildata.co.uk (CC BY-SA 4.0). Refresh by re-downloading and
// committing to docs/.
const COMP_PARTY_COLS = {
  con: 'Conservative Party',
  lab: 'Labour Party',
  ld: 'Liberal Democrats',
  green: 'Green Party',
  ukip: 'UK Independence Party (UKIP)',
  ref: 'Reform UK',
  pc: 'Plaid Cymru',
  snp: 'Scottish National Party'
  // 'other' column is NOT a real party - treated separately as the
  // catch-all bucket. See largestParty derivation below.
};

// LEH and opencouncildata use slightly different conventions for some
// council names — LEH appends "City of" / "County" suffixes, drops
// apostrophes inconsistently. Map opencouncildata's slugified authority
// to our canonical LEH councilSlug for these specific cases.
const COMP_SLUG_ALIASES = {
  bristol: 'bristol-city-of',
  durham: 'county-durham',
  'king-s-lynn-and-west-norfolk': 'kings-lynn-and-west-norfolk',
  'kingston-upon-hull': 'kingston-upon-hull-city-of'
};

// The per-councillor CSVs use different party-name conventions from
// the canonical names we use across the site. Normalise to canonical.
// Anything not in this map passes through untouched (so local parties
// like "Ashfield Independents" / "Aspire" / "Havering Residents
// Association" keep their literal names — that's what we want for
// per-square labelling).
const COUNCILLOR_PARTY_NORMALISE = {
  'Conservative and Unionist': 'Conservative Party',
  'Conservative and Unionist Party': 'Conservative Party',
  'Labour and Co-operative Party': 'Labour Party',
  'Green Party (E&W)': 'Green Party',
  'Plaid Cymru - The Party of Wales': 'Plaid Cymru',
  'Scottish National Party (SNP)': 'Scottish National Party',
  'Independent / Other': 'Independent / Other'
};

// Per-councillor snapshot ingest. Each year's CSV at
// docs/opencouncildata_councillors_YYYY.csv carries one row per sitting
// councillor — Council, Ward, Councillor Name, Next Election, Party,
// EC Code. We aggregate per (councilSlug, year) into a partiesDetailed
// dict (canonical-party-name → seat count). This lets the SeatChart on
// every composition viz label each square with the actual party (e.g.
// "Ashfield Independents", "Aspire", "Independent / Other") instead of
// rolling everything into the generic "Other" bucket from the summary
// CSV. Returns a Map keyed by `${slug}::${year}`.
function ingestCouncillorSnapshots() {
  // Per-ward LEH party lookup: for each (councilSlug, wardName slug),
  // collect the most recent LEH-elected candidates' parties. Used to
  // refine oncd's "Independent / Other" labels — when a ward elected
  // a specific local-party (Broxtowe Alliance, etc.) in our LEH data,
  // we know that's what the oncd "Independent / Other" entries in
  // that ward really are. oncd's per-councillor CSV lumps local
  // parties without an EC code into "Independent / Other"; LEH keeps
  // their proper names.
  //
  // Structure: Map<councilSlug, Map<wardSlugified, Map<party, count>>>
  // — counts per party in each ward, taken from the most recent LEH
  // cycle that elected to that ward.
  const lehWardParties = new Map();
  // Track the latest cycle year per (council, ward) to use only the
  // freshest LEH data for that ward.
  const latestLehYearForWard = new Map();
  for (const r of allRaces) {
    const wardKey = slugify(r.wardName);
    const composedKey = `${r.councilSlug}::${wardKey}`;
    const prevYear = latestLehYearForWard.get(composedKey) ?? -Infinity;
    if (r.year < prevYear) continue;
    if (r.year > prevYear) {
      // Newer cycle — replace any prior counts for this ward.
      latestLehYearForWard.set(composedKey, r.year);
      const councilWards = lehWardParties.get(r.councilSlug) ?? new Map();
      councilWards.set(wardKey, new Map());
      lehWardParties.set(r.councilSlug, councilWards);
    }
    const wardCounts = lehWardParties.get(r.councilSlug).get(wardKey);
    for (const c of r.candidates.filter((c) => c.elected)) {
      const p = c.party || 'Independent';
      wardCounts.set(p, (wardCounts.get(p) ?? 0) + 1);
    }
  }

  // Refine an oncd party label using LEH data for the ward. When oncd
  // says "Independent / Other" but LEH knows the ward elected a
  // specific local-party label, prefer the LEH label. Multi-seat wards
  // with multiple non-major-party labels: distribute proportionally
  // (track per-ward usage so subsequent oncd rows pick a different
  // local-party label until LEH's count is exhausted).
  const wardLabelUsage = new Map(); // `${slug}::${ward}` → Map<party, used>
  function refineParty(partyRaw, councilSlug, wardSlug) {
    if (partyRaw !== 'Independent / Other') return partyRaw;
    const wardCounts = lehWardParties.get(councilSlug)?.get(wardSlug);
    if (!wardCounts) return partyRaw;
    // Find a non-major-party label LEH knows about for this ward
    // (excludes Lab/Con/LD/Green/Reform/UKIP/SNP/PC + literal Independent
    // since "Independent" is the same as oncd's bucket-meaning). The
    // intent is to surface specifically-named local parties.
    const NAMED = new Set(Object.values(COMP_PARTY_COLS));
    const usageKey = `${councilSlug}::${wardSlug}`;
    let usage = wardLabelUsage.get(usageKey);
    if (!usage) {
      usage = new Map();
      wardLabelUsage.set(usageKey, usage);
    }
    // Try local parties (anything that isn't a named major party AND
    // isn't literal "Independent") first; pick one with capacity.
    const sortedParties = [...wardCounts.entries()].sort(
      (a, b) => b[1] - a[1]
    );
    for (const [p, n] of sortedParties) {
      if (NAMED.has(p) || p === 'Independent') continue;
      if ((usage.get(p) ?? 0) < n) {
        usage.set(p, (usage.get(p) ?? 0) + 1);
        return p;
      }
    }
    // No local party available; if literal "Independent" has capacity,
    // use it (slightly more honest than the oncd "Independent / Other"
    // bucket — at least we know it's a real Independent from LEH).
    const indCount = wardCounts.get('Independent') ?? 0;
    if ((usage.get('Independent') ?? 0) < indCount) {
      usage.set('Independent', (usage.get('Independent') ?? 0) + 1);
      return 'Independent';
    }
    return partyRaw;
  }

  const out = new Map();
  let refinedCount = 0;
  let unrefinedOtherCount = 0;
  for (let year = 2016; year <= 2025; year++) {
    const csvPath = resolve(ROOT, `docs/opencouncildata_councillors_${year}.csv`);
    if (!existsSync(csvPath)) continue;
    const wb = XLSX.read(readFileSync(csvPath, 'utf8'), { type: 'string' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
    // Reset per-ward usage trackers across snapshot years (each year is
    // a fresh assignment; LEH data is constant).
    wardLabelUsage.clear();
    for (const r of rows) {
      const authority = String(r['Council'] ?? '').trim();
      if (!authority) continue;
      const wardName = String(r['Ward Name'] ?? '').trim();
      const partyRaw = String(r['Party Name'] ?? '').trim();
      if (!partyRaw) continue;
      // Skip "Vacant" entries — these aren't councillors with party
      // affiliation, they're empty seats. Keeps the seat-count totals
      // honest re: "people sitting in the chamber under a party banner".
      if (partyRaw === 'Vacant') continue;
      const partyNormalised =
        COUNCILLOR_PARTY_NORMALISE[partyRaw] ?? partyRaw;
      const rawSlug = slugify(authority);
      const slug = COMP_SLUG_ALIASES[rawSlug] ?? rawSlug;
      const wardSlug = wardName ? slugify(wardName) : null;
      // LEH-refine the oncd party label where possible.
      const party = wardSlug
        ? refineParty(partyNormalised, slug, wardSlug)
        : partyNormalised;
      if (partyNormalised === 'Independent / Other') {
        if (party !== 'Independent / Other') refinedCount++;
        else unrefinedOtherCount++;
      }
      const key = `${slug}::${year}`;
      let breakdown = out.get(key);
      if (!breakdown) {
        breakdown = new Map();
        out.set(key, breakdown);
      }
      breakdown.set(party, (breakdown.get(party) ?? 0) + 1);
    }
  }
  console.log(
    `[etl] LEH-refined ${refinedCount} oncd "Independent / Other" entries to specific local-party labels; ${unrefinedOtherCount} kept as the bucket (no LEH match for that ward)`
  );
  return out;
}

function ingestCompositions() {
  const csvPath = resolve(ROOT, 'docs/history2016-2025.csv');
  if (!existsSync(csvPath)) {
    console.warn('[etl] composition CSV not found; skipping');
    return [];
  }
  const councillorSnapshots = ingestCouncillorSnapshots();
  console.log(
    `[etl] ingested per-councillor snapshots for ${councillorSnapshots.size} (council, year) keys`
  );
  const wb = XLSX.read(readFileSync(csvPath, 'utf8'), { type: 'string' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
  const out = [];
  for (const r of rows) {
    const authority = String(r.authority ?? '').trim();
    if (!authority) continue;
    const year = Number(r.year);
    if (!Number.isFinite(year)) continue;
    const totalSeats = Number(r.total) || 0;
    const parties = {};
    for (const [col, canonical] of Object.entries(COMP_PARTY_COLS)) {
      parties[canonical] = Number(r[col]) || 0;
    }
    const otherSeats = Number(r.other) || 0;
    // Largest party by seat count. "Other" is the catch-all bucket
    // (independents + local groupings + whatever else opencouncildata
    // doesn't break out as a named column); when it exceeds every
    // named party, we honour that — councils like Ashfield have ~30
    // Ashfield Independents seats vs 3 Conservative, and pretending
    // the largest party is "Conservative" produces nonsense flips
    // (Con:3 → Reform:3 reads as "Reform took control" when in
    // reality Independents have held it the whole time). When Other
    // wins, largestParty is the literal string "Other"; the flip
    // detection that compares strings naturally produces "no flip"
    // when Other is largest in both years (correct behaviour because
    // we have no way to tell from oncd's CSV whether year-N's
    // "Other" cohort is the same set of councillors as year-N+1's).
    // largestIsOtherDominant flags the same fact for downstream
    // consumers that want to render or filter on it.
    let largestParty = null;
    let largestSeats = -1;
    for (const [party, seats] of Object.entries(parties)) {
      if (
        seats > largestSeats ||
        (seats === largestSeats &&
          (largestParty === null || party.localeCompare(largestParty) < 0))
      ) {
        largestParty = party;
        largestSeats = seats;
      }
    }
    if (otherSeats > largestSeats) {
      largestParty = 'Other';
      largestSeats = otherSeats;
    }
    const rawSlug = slugify(authority);
    const finalSlug = COMP_SLUG_ALIASES[rawSlug] ?? rawSlug;
    // Pull the per-councillor breakdown for this (council, year) if we
    // have it. Object form keyed by canonical party name → seat count.
    const detailedMap = councillorSnapshots.get(`${finalSlug}::${year}`);
    const partiesDetailed = detailedMap ? Object.fromEntries(detailedMap) : null;
    out.push({
      councilSlug: finalSlug,
      council: authority,
      year,
      totalSeats,
      parties,
      otherSeats,
      partiesDetailed,
      largestParty,
      largestPartySeats: largestSeats,
      // True when no named party exceeds the "other" bucket - means the
      // truth-set's flip-detection might fire spuriously, so consumers
      // can downgrade or annotate these cases.
      largestIsOtherDominant: otherSeats > largestSeats,
      sourceMajority: String(r.majority ?? '').trim()
    });
  }
  return out;
}

const compositions = ingestCompositions();
const compositionByKey = new Map();
for (const c of compositions) {
  compositionByKey.set(`${c.councilSlug}::${c.year}`, c);
}
console.log(
  `[etl] ingested ${compositions.length} composition snapshots from opencouncildata`
);

// --- Synthesised 2026 composition snapshots ----------------------------
//
// opencouncildata's annual snapshot is published months after polling
// day, so on 2026-05-08 there is no 2026 row in their data. To get the
// flip detector running on 2025→2026 transitions in time for the
// post-election audit, we synthesise a 2026 snapshot per council from:
//
//   retainedIncumbents = 2025 oncd councillors whose Next Election ≠ 2026
//   newIncumbents      = 2026 election winners (top-N by votes per ward)
//
// The synthesised snapshot replaces only the seats that actually rotated
// this cycle (which keeps by-thirds councils correct: 2/3 of their seats
// carry forward from 2025), and is annotated with `synthesised: true` so
// downstream consumers can label it as derived rather than truth-set.
// When oncd publishes its real 2026 snapshot, the synthesised rows will
// be replaced on the next ETL run.

const COMP_NAMED_PARTY_SET = new Set(Object.values(COMP_PARTY_COLS));

function ingestCouncillors2025NextElection() {
  // Returns Map<councilSlug, Array<{party, nextElection: string|null}>>.
  // We keep one row per councillor so the retain/replace partition is
  // computed on actual headcount rather than aggregate party counts.
  const csvPath = resolve(ROOT, 'docs/opencouncildata_councillors_2025.csv');
  if (!existsSync(csvPath)) {
    console.warn('[etl] 2025 per-councillor CSV not found; skipping 2026 synthesis');
    return null;
  }
  // raw:false renders cells through Excel's display formatter, which
  // returns "2026-05-07" for date cells. raw:true would return the
  // Excel date serial (e.g. 46149) and break the "2026-" prefix check
  // below — every councillor would look retained and the synth would
  // double-count seats.
  const wb = XLSX.read(readFileSync(csvPath, 'utf8'), { type: 'string' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  const out = new Map();
  for (const r of rows) {
    const authority = String(r['Council'] ?? '').trim();
    if (!authority) continue;
    const partyRaw = String(r['Party Name'] ?? '').trim();
    if (!partyRaw || partyRaw === 'Vacant') continue;
    const party = COUNCILLOR_PARTY_NORMALISE[partyRaw] ?? partyRaw;
    const rawSlug = slugify(authority);
    const slug = COMP_SLUG_ALIASES[rawSlug] ?? rawSlug;
    const nextElection = String(r['Next Election'] ?? '').trim() || null;
    if (!out.has(slug)) out.set(slug, []);
    out.get(slug).push({ party, nextElection });
  }
  return out;
}

function bumpParty(parties, otherSeatsRef, party, delta) {
  // Maintain the named-vs-other split that oncd uses so largestParty
  // computation stays consistent with the truth-set rows.
  if (COMP_NAMED_PARTY_SET.has(party)) {
    parties[party] = (parties[party] ?? 0) + delta;
    if (parties[party] < 0) parties[party] = 0;
  } else {
    otherSeatsRef.value += delta;
    if (otherSeatsRef.value < 0) otherSeatsRef.value = 0;
  }
}

function synthesise2026Compositions() {
  const councillors2025 = ingestCouncillors2025NextElection();
  if (!councillors2025) return [];
  const races2026ByCouncil = new Map();
  for (const r of allRaces) {
    if (r.year !== 2026) continue;
    if (!races2026ByCouncil.has(r.councilSlug)) {
      races2026ByCouncil.set(r.councilSlug, []);
    }
    races2026ByCouncil.get(r.councilSlug).push(r);
  }
  const out = [];
  let synthesisedCount = 0;
  let skippedNoBaseline = 0;
  let skippedNoRoster = 0;
  for (const [slug, races] of races2026ByCouncil) {
    const baseline = compositionByKey.get(`${slug}::2025`);
    if (!baseline) {
      skippedNoBaseline++;
      continue;
    }
    const roster = councillors2025.get(slug);
    if (!roster) {
      skippedNoRoster++;
      continue;
    }
    // Initialise from named columns only (zeroes for missing); other is
    // tracked via a ref so bumpParty can mutate it.
    const parties = {};
    for (const canonical of Object.values(COMP_PARTY_COLS)) parties[canonical] = 0;
    const otherSeatsRef = { value: 0 };
    // Carry forward 2025 incumbents whose seat is NOT up in 2026.
    let retained = 0;
    for (const c of roster) {
      const isUp = (c.nextElection ?? '').startsWith('2026-');
      if (isUp) continue;
      bumpParty(parties, otherSeatsRef, c.party, 1);
      retained++;
    }
    // Add 2026 winners.
    let added = 0;
    for (const r of races) {
      for (const cand of r.candidates.filter((c) => c.elected)) {
        const party = cand.party || 'Independent';
        bumpParty(parties, otherSeatsRef, party, 1);
        added++;
      }
    }
    const totalSeats = retained + added;
    const otherSeats = otherSeatsRef.value;
    // Recompute largestParty (same tie-breaking as ingestCompositions).
    let largestParty = null;
    let largestSeats = -1;
    for (const [party, seats] of Object.entries(parties)) {
      if (
        seats > largestSeats ||
        (seats === largestSeats &&
          (largestParty === null || party.localeCompare(largestParty) < 0))
      ) {
        largestParty = party;
        largestSeats = seats;
      }
    }
    if (otherSeats > largestSeats) {
      largestParty = 'Other';
      largestSeats = otherSeats;
    }
    const partiesDetailed = {};
    for (const [p, n] of Object.entries(parties)) {
      if (n > 0) partiesDetailed[p] = n;
    }
    out.push({
      councilSlug: slug,
      council: baseline.council,
      year: 2026,
      totalSeats,
      parties,
      otherSeats,
      partiesDetailed,
      largestParty,
      largestPartySeats: largestSeats,
      largestIsOtherDominant: otherSeats > largestSeats,
      sourceMajority: '',
      // Marker for transparency in the UI / methodology page. Real oncd
      // rows have this absent (or false); synthesised rows are tagged.
      synthesised: true
    });
    synthesisedCount++;
  }
  console.log(
    `[etl] synthesised ${synthesisedCount} 2026 composition snapshots from oncd 2025 + DC 2026 ` +
      `(${skippedNoBaseline} councils skipped: no 2025 baseline; ${skippedNoRoster} skipped: no 2025 roster)`
  );
  return out;
}

const synth2026 = synthesise2026Compositions();
for (const c of synth2026) {
  compositions.push(c);
  compositionByKey.set(`${c.councilSlug}::${c.year}`, c);
}

// --- Composition-LEH join audit -----------------------------------------
//
// We rely on slugified council names matching across the two datasets.
// Print any LEH councils that don't have a composition snapshot for any
// of their cycle years so we know what we're missing. (Conversely,
// composition rows for councils we don't have LEH data for are just
// ignored - that's expected for non-English councils.)
const lehCouncilSlugs = new Set(allRaces.map((r) => r.councilSlug));
const compCouncilSlugs = new Set(compositions.map((c) => c.councilSlug));
const lehWithoutComposition = [...lehCouncilSlugs]
  .filter((s) => !compCouncilSlugs.has(s))
  .sort();
if (lehWithoutComposition.length > 0) {
  console.warn(
    `[etl] ${lehWithoutComposition.length} LEH councils have NO composition match (slug mismatch or missing in opencouncildata):`
  );
  for (const s of lehWithoutComposition.slice(0, 20)) console.warn(`  - ${s}`);
  if (lehWithoutComposition.length > 20) {
    console.warn(`  ... and ${lehWithoutComposition.length - 20} more`);
  }
} else {
  console.log('[etl] all LEH councils have a composition match ✓');
}

// --- Council flips (composition truth-set) ------------------------------
//
// A flip is a change in the largest party of the council's running
// composition between consecutive years where a cycle was held. The
// composition snapshot reflects the actual council after the year's
// events (election + by-elections), so this captures the genuine
// editorial signal: the cycle's election results actually moved who
// holds the most seats overall.
//
// Drops misleading cycle-leader flips (East Lindsey 2024 — Reform topped
// the per-cycle table but Conservatives still hold ~28 of 55 seats);
// preserves real ones (Wealden 2023 — boundary-review all-out, LD
// became largest party of the new council). Cycles where we have no
// composition data on either side are skipped (logged for transparency).
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
let cyclesWithCompositionGap = 0;
let cyclesEvaluated = 0;
let cyclesWithSamelLeader = 0;
for (const [slug, views] of viewsByCouncil) {
  if (views.length < 2) continue;
  views.sort((a, b) => a.year - b.year);
  for (let i = 1; i < views.length; i++) {
    const prev = views[i - 1];
    const next = views[i];
    cyclesEvaluated++;
    const compPrev = compositionByKey.get(`${slug}::${prev.year}`);
    const compNext = compositionByKey.get(`${slug}::${next.year}`);
    if (!compPrev || !compNext) {
      cyclesWithCompositionGap++;
      continue;
    }
    const fromParty = compPrev.largestParty;
    const toParty = compNext.largestParty;
    if (!fromParty || !toParty) continue;
    if (fromParty === toParty) {
      cyclesWithSamelLeader++;
      continue;
    }

    // Cycle-side context for the rank-by-disproportion score: vote
    // shifts come from the actual election that triggered the change,
    // because composition data has no vote-share information.
    //
    // "Other" needs special handling on both vote-share and seat-share
    // sides, because oncd buckets independents/local groupings into
    // one `otherSeats` field and our partyView.rows uses real LEH party
    // names. A flip Conservative→Other (e.g. Castle Point 2021→2022)
    // would otherwise show 0.0 pts vote shift and 0.0 pts seat shift.
    const NAMED_PARTY_SET = new Set(Object.values(COMP_PARTY_COLS));
    const voteShareForParty = (view, party) => {
      if (party === 'Other') {
        // Sum vote shares of every party that isn't in oncd's named
        // columns — that's the bucket oncd would have lumped into Other.
        return view.rows
          .filter((r) => !NAMED_PARTY_SET.has(r.party))
          .reduce((sum, r) => sum + r.voteShare, 0);
      }
      return view.rows.find((r) => r.party === party)?.voteShare ?? 0;
    };
    const compSeatShare = (comp, party) => {
      const total = comp.totalSeats || 1;
      const seats =
        party === 'Other' ? comp.otherSeats : comp.parties[party] ?? 0;
      return seats / total;
    };

    const newPartyVoteFrom = voteShareForParty(prev, toParty);
    const newPartyVoteTo = voteShareForParty(next, toParty);
    const oldPartyVoteFrom = voteShareForParty(prev, fromParty);
    const oldPartyVoteTo = voteShareForParty(next, fromParty);

    // Composition seat shares — the meaningful change-of-control number,
    // unlike per-cycle seat shares which only reflect the seats up that
    // single cycle.
    const newPartySeatFrom = compSeatShare(compPrev, toParty);
    const newPartySeatTo = compSeatShare(compNext, toParty);
    const oldPartySeatFrom = compSeatShare(compPrev, fromParty);
    const oldPartySeatTo = compSeatShare(compNext, fromParty);

    const voteSwingNew = Math.abs(newPartyVoteTo - newPartyVoteFrom);
    const seatSwingNew = Math.abs(newPartySeatTo - newPartySeatFrom);

    flips.push({
      councilSlug: slug,
      council: prev.council,
      yearFrom: prev.year,
      yearTo: next.year,
      fromParty,
      toParty,
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
      // Disproportion score: composition-seat-swing per unit
      // cycle-vote-swing. Higher = smaller vote shift produced a bigger
      // overall composition shift. Floor at 1pp on the denominator so a
      // 0pp vote shift with a big seat shift still ranks.
      disproportionScore: seatSwingNew / Math.max(voteSwingNew, 0.01)
    });
  }
}
// --- 2025→2026 backfill flips -------------------------------------------
//
// The loop above iterates over `partyViews` pairs, which means a
// council with no LEH partyView for the prev cycle (e.g. county
// councils — the LEH 2021 workbook only covers districts/UAs/mets) is
// skipped even when a real composition flip happened. For those
// councils the synthesised 2026 composition is paired explicitly with
// the 2025 oncd composition; if largestParty changed, we emit the flip
// using the same field shape so downstream consumers don't need to
// branch. dedup against (slug, yearFrom, yearTo) so we don't double-
// count councils the prev-cycle loop already caught.
const NAMED_PARTY_SET_GLOBAL = new Set(Object.values(COMP_PARTY_COLS));
function voteShareForPartyGeneric(view, party) {
  if (!view) return 0;
  if (party === 'Other') {
    return view.rows
      .filter((r) => !NAMED_PARTY_SET_GLOBAL.has(r.party))
      .reduce((sum, r) => sum + r.voteShare, 0);
  }
  return view.rows.find((r) => r.party === party)?.voteShare ?? 0;
}
function compSeatShareGeneric(comp, party) {
  if (!comp) return 0;
  const total = comp.totalSeats || 1;
  const seats =
    party === 'Other' ? comp.otherSeats : comp.parties[party] ?? 0;
  return seats / total;
}
const flipKey = (f) => `${f.councilSlug}::${f.yearFrom}::${f.yearTo}`;
const existingFlipKeys = new Set(flips.map(flipKey));
let backfillFlips = 0;
let displaced = 0;
for (const comp2026 of compositions) {
  if (comp2026.year !== 2026 || !comp2026.synthesised) continue;
  const slug = comp2026.councilSlug;
  const comp2025 = compositionByKey.get(`${slug}::2025`);
  if (!comp2025) continue;
  const fromParty = comp2025.largestParty;
  const toParty = comp2026.largestParty;
  // Prefer the 2025→2026 window as the canonical record of what the
  // 2026 election changed: drop any prev-cycle-driven 2026-yearTo flip
  // for this council (e.g. Wakefield 2024→2026) before pushing the
  // backfill, so the front-page table doesn't double-list the same
  // council. Only do this when largestParty actually moved 2025→2026;
  // a same-leader transition leaves the older record alone.
  if (fromParty && toParty && fromParty !== toParty) {
    for (let i = flips.length - 1; i >= 0; i--) {
      const f = flips[i];
      if (f.councilSlug === slug && f.yearTo === 2026 && f.yearFrom !== 2025) {
        flips.splice(i, 1);
        existingFlipKeys.delete(flipKey(f));
        displaced++;
      }
    }
  }
  if (!fromParty || !toParty || fromParty === toParty) continue;
  if (existingFlipKeys.has(`${slug}::2025::2026`)) continue;
  // Use the 2026 partyView for vote shares; 2025 vote shares come from
  // the 2025 partyView when the council polled in 2025, otherwise 0
  // (e.g. counties on a 4-year cycle had no 2025 election).
  const view2025 = partyViewByKey.get(`2025::${slug}`);
  const view2026 = partyViewByKey.get(`2026::${slug}`);
  const newPartyVoteFrom = voteShareForPartyGeneric(view2025, toParty);
  const newPartyVoteTo = voteShareForPartyGeneric(view2026, toParty);
  const oldPartyVoteFrom = voteShareForPartyGeneric(view2025, fromParty);
  const oldPartyVoteTo = voteShareForPartyGeneric(view2026, fromParty);
  const newPartySeatFrom = compSeatShareGeneric(comp2025, toParty);
  const newPartySeatTo = compSeatShareGeneric(comp2026, toParty);
  const oldPartySeatFrom = compSeatShareGeneric(comp2025, fromParty);
  const oldPartySeatTo = compSeatShareGeneric(comp2026, fromParty);
  const voteSwingNew = Math.abs(newPartyVoteTo - newPartyVoteFrom);
  const seatSwingNew = Math.abs(newPartySeatTo - newPartySeatFrom);
  flips.push({
    councilSlug: slug,
    council: comp2026.council,
    yearFrom: 2025,
    yearTo: 2026,
    fromParty,
    toParty,
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
    disproportionScore: seatSwingNew / Math.max(voteSwingNew, 0.01)
  });
  backfillFlips++;
}

flips.sort((a, b) => b.disproportionScore - a.disproportionScore);
console.log(
  `[etl] flips: ${flips.length} from ${cyclesEvaluated} cycle pairs ` +
    `(${cyclesWithSamelLeader} same-leader, ${cyclesWithCompositionGap} skipped for missing composition; ` +
    `+${backfillFlips} backfilled 2025→2026, ${displaced} prev-cycle 2026 flips replaced by the 2025→2026 window)`
);

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
    system: r.system ?? 'FPTP',
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
  compositions,
  reorganisations,
  // Per-council 2026 coverage so consumers (homepage maps) can render
  // cohort councils whose count is incomplete as black, instead of
  // colouring them by their partial subset of counted wards.
  cycle2026Coverage
};
writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot));
console.log(`[etl] wrote ${SNAPSHOT_PATH}`);

// --- STV raw data mirror -----------------------------------------------
// Mirror the indylive Scottish 2022 STV CSV under static/data/stv/ so
// the deployed site serves it at /data/stv/scotland-2022.csv. That
// gives sister projects (notably stv.vote) a stable URL to pull from
// without re-deriving from the parent indylive source. Round-by-round
// transfer columns and per-ward ballots/quota are preserved verbatim.
const STV_OUT_DIR = resolve(OUT_DIR, 'stv');
mkdirSync(STV_OUT_DIR, { recursive: true });
const stvSrc = resolve(ROOT, SCOTLAND_STV_CYCLE.file);
if (existsSync(stvSrc)) {
  const stvDest = resolve(STV_OUT_DIR, 'scotland-2022.csv');
  writeFileSync(stvDest, readFileSync(stvSrc));
  console.log(`[etl] wrote ${stvDest} (Scotland 2022 STV raw)`);
}
console.log('[etl] done');
