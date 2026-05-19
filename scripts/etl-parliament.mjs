#!/usr/bin/env node
// Parliamentary ETL — ingest of UK General Elections.
//
// For each entry in ELECTIONS below, reads two House of Commons Library
// workbooks (constituencies + candidates) from source-data/parliament/
// {year}/, joins them, runs party labels through party-normalize.mjs,
// and writes four JSON files under src/lib/data/parliament/{year}/
// wrapped in the ParliamentSplit<T> envelope (top-level `_manifest` +
// `data`). Adding an election is an entry in ELECTIONS plus the source
// files; the rest of the pipeline is year-agnostic.
//
// Story 2.5 (this file): happy path only. caveats[] is always present
// on contest and candidate rows but empty — Story 2.6 wires
// detectCaveats(), the national-summary precomputation, the Markdown
// validation report, and the budget warnings on top.
//
// Council data (src/lib/data/*.json) is never touched. AR5: parliament
// ETL writes only under src/lib/data/parliament/.

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  statSync,
  readdirSync
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import xlsx from 'xlsx';

import { normalizeParty } from './party-normalize.mjs';
import { validateSchema, detectCaveats } from './lib/parliament-validate.mjs';
// bun runs TS at import time — let the metrics module stay in one
// authoritative copy under src/lib/parliament/metrics.ts and the ETL
// re-use it instead of forking the formula here.
import {
  gallagherIndex,
  voteVsSeatGap,
  minorityWinnerCount,
  lowWinningShareLeaderboard
} from '../src/lib/parliament/metrics.ts';

const ETL_VERSION = 'parliament-etl@1';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX_FILE = resolve(ROOT, 'src/lib/data/parliament/index.json');

// Election register. Add an entry here + drop the publisher's workbooks
// under source-data/parliament/{year}/ to ingest a new general election.
// The Commons Library workbooks share a stable shape (Data sheet, row 3
// header, the columns enumerated below) across the 2010-review and
// 2023-review boundary sets, so the same loader handles every year.
const ELECTIONS = [
  {
    year: 2019,
    electionId: 'ge-2019',
    boundarySet: '2010-review',
    constituencyFile: 'HoC-GE2019-results-by-constituency.xlsx',
    candidateFile: 'HoC-GE2019-results-by-candidate.xlsx',
    retrievalDate: '2026-05-19',
    // From the `About` sheet inside each workbook: "Last updated:
    // Friday, 2nd May 2025". Updates in lockstep with each refresh.
    publicationDate: '2025-05-02',
    manifest: {
      id: 'parliament-ge-2019-cbp-8749',
      sourceName: 'House of Commons Library general election results 2019',
      sourceUrl: 'https://commonslibrary.parliament.uk/research-briefings/cbp-8749/'
    }
  },
  {
    year: 2024,
    electionId: 'ge-2024',
    boundarySet: '2023-review',
    constituencyFile: 'HoC-GE2024-results-by-constituency.xlsx',
    candidateFile: 'HoC-GE2024-results-by-candidate.xlsx',
    retrievalDate: '2026-05-18',
    // From the `About` sheet inside each workbook: "Last updated:
    // Monday, 5th January 2026". Updates in lockstep with each refresh.
    publicationDate: '2026-01-05',
    manifest: {
      id: 'parliament-ge-2024-cbp-10009',
      sourceName: 'House of Commons Library general election results 2024',
      sourceUrl: 'https://commonslibrary.parliament.uk/research-briefings/cbp-10009/'
    }
  }
];

function sourceDirFor(year) {
  return resolve(ROOT, `source-data/parliament/${year}`);
}
function outputDirFor(year) {
  return resolve(ROOT, `src/lib/data/parliament/${year}`);
}
function csvOutputDirFor(year) {
  return resolve(ROOT, `static/data/parliament/${year}`);
}

// Real header in row 3 (1-based); xlsx's `range: 2` is 0-based row
// offset, so the third row becomes the header.
const HEADER_ROW_OFFSET = 2;

const CONSTITUENCY_COLUMNS = [
  'ONS ID',
  'Constituency name',
  'Region name',
  'Country name',
  'Constituency type',
  'Electorate',
  'Valid votes'
];

const CANDIDATE_COLUMNS = [
  'ONS ID',
  'Constituency name',
  'Party name',
  'Candidate first name',
  'Candidate surname',
  'Votes',
  'Share'
];

function readWorkbook(path, expectedColumns, label) {
  if (!existsSync(path)) {
    throw new Error(`Source file missing: ${path}`);
  }
  // xlsx.readFile is unavailable in the ESM build; load the file via
  // node:fs and hand the buffer to xlsx.read instead.
  const buffer = readFileSync(path);
  const wb = xlsx.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets['Data'];
  if (!sheet) {
    throw new Error(`${label}: no "Data" sheet in workbook ${path}`);
  }
  const rows = xlsx.utils.sheet_to_json(sheet, {
    defval: null,
    range: HEADER_ROW_OFFSET
  });
  const validation = validateSchema(rows, expectedColumns);
  if (!validation.ok) {
    const list = validation.missing.join(', ');
    throw new Error(
      `${label}: source schema check failed — missing column(s): ${list}.\n` +
        `  source file: ${path}\n` +
        `  expected: ${expectedColumns.join(', ')}\n` +
        `  refusing to overwrite previously-generated JSON.`
    );
  }
  return rows;
}

function slugForName(name) {
  return String(name)
    .toLowerCase()
    .replace(/&/g, 'and')
    // Strip diacritics so "Ynys Môn" and "Antrim & Newtownabbey" land
    // on predictable kebab-case slugs.
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function countryFor(rawCountryName) {
  switch (rawCountryName) {
    case 'England':
      return 'england';
    case 'Scotland':
      return 'scotland';
    case 'Wales':
      return 'wales';
    case 'Northern Ireland':
      return 'northern-ireland';
    default:
      throw new Error(`Unknown country: "${rawCountryName}"`);
  }
}

function partySlug(displayName) {
  return slugForName(displayName);
}

function buildContests({ constituencyRows, candidateRows, electionId, boundarySet }) {
  // Index candidates by ONS ID for O(N) joins.
  const candidatesByOns = new Map();
  for (const row of candidateRows) {
    const id = row['ONS ID'];
    const list = candidatesByOns.get(id);
    if (list) list.push(row);
    else candidatesByOns.set(id, [row]);
  }

  const contests = [];
  const candidates = [];

  for (const row of constituencyRows) {
    const onsId = row['ONS ID'];
    // The HCL 2019 briefing publishes "Isleof Wight" with a missing
    // space — corrected here so the slug round-trips against the hex
    // cartogram and against every other year's data. Add new mappings
    // as further typos are spotted.
    const SOURCE_NAME_FIXES = { 'Isleof Wight': 'Isle of Wight' };
    const rawName = row['Constituency name'];
    const constituencyName = SOURCE_NAME_FIXES[rawName] ?? rawName;
    const slug = slugForName(constituencyName);
    const constituencyId = `${boundarySet}:${slug}`;
    const contestId = `${electionId}:${constituencyId}`;
    const country = countryFor(row['Country name']);

    const validVotes =
      typeof row['Valid votes'] === 'number' ? row['Valid votes'] : null;
    const electorate =
      typeof row['Electorate'] === 'number' ? row['Electorate'] : null;
    const turnout =
      electorate !== null && validVotes !== null && electorate > 0
        ? validVotes / electorate
        : null;

    const candidatesRaw = candidatesByOns.get(onsId) ?? [];

    const caveats = detectCaveats({
      constituencySlug: slug,
      candidateCount: candidatesRaw.length,
      electorate,
      validVotes,
      contestType: 'single-member'
    });

    contests.push({
      electionId,
      constituencyId,
      constituencySlug: slug,
      constituencyName,
      contestType: 'single-member',
      electorate,
      validVotes,
      turnout,
      country,
      caveats
    });

    const contestCandidates = candidatesRaw
      .map((c) => {
        const partySourceLabel = String(c['Party name'] ?? '').trim() || 'Unknown';
        const partyDisplayName = normalizeParty(partySourceLabel) ?? partySourceLabel;
        const firstName = String(c['Candidate first name'] ?? '').trim();
        const surname = String(c['Candidate surname'] ?? '').trim();
        const candidateName = [firstName, surname].filter(Boolean).join(' ');
        const votes = typeof c['Votes'] === 'number' ? c['Votes'] : 0;
        // Share in source is already a fraction in [0, 1].
        const share = typeof c['Share'] === 'number' ? c['Share'] : null;
        return {
          contestId,
          candidateName,
          partyId: partySlug(partyDisplayName),
          partyDisplayName,
          partySourceLabel,
          votes,
          share,
          // position + isWinner assigned after sorting
          position: 0,
          isWinner: false,
          // Per-candidate caveats inherit the contest-level set in v1.
          // Per-row caveat detection (e.g. a candidate-specific
          // discrepancy) can be added without changing the wire shape.
          caveats: [...caveats]
        };
      })
      .sort((a, b) => b.votes - a.votes);

    contestCandidates.forEach((c, i) => {
      c.position = i + 1;
      c.isWinner = i === 0;
    });

    candidates.push(...contestCandidates);
  }

  return { contests, candidates };
}

// Caveats whose presence on a contest means that contest's votes/seats
// should not feed national party totals: the Speaker stands as
// "Speaker", not for a party. Uncontested rows still contribute their
// single winner's seat but the vote-share denominator is degenerate;
// we keep them in the totals (the seat is real) and only exclude
// Speaker. Multi-member-historical doesn't apply to modern GEs but
// would similarly distort per-party seat counts.
const PARTY_TOTAL_EXCLUDING_CAVEATS = new Set(['speaker', 'multi-member-historical']);

function contestExcludedFromPartyTotals(contest) {
  return contest.caveats.some((c) => PARTY_TOTAL_EXCLUDING_CAVEATS.has(c));
}

function buildPartyTotals({ contests, candidates, electionId }) {
  // Set of contestIds we'll skip when aggregating party totals.
  const excludedContestIds = new Set(
    contests
      .filter(contestExcludedFromPartyTotals)
      .map((c) => `${electionId}:${c.constituencyId}`)
  );

  const totalsByParty = new Map();
  let totalVotes = 0;
  let totalSeats = 0;

  for (const c of candidates) {
    if (excludedContestIds.has(c.contestId)) continue;
    totalVotes += c.votes;
    if (c.isWinner) totalSeats += 1;
    const existing = totalsByParty.get(c.partyId);
    if (existing) {
      existing.votes += c.votes;
      if (c.isWinner) existing.seats += 1;
    } else {
      totalsByParty.set(c.partyId, {
        electionId,
        partyId: c.partyId,
        partyDisplayName: c.partyDisplayName,
        partySourceLabel: c.partySourceLabel,
        votes: c.votes,
        voteShare: 0,
        seats: c.isWinner ? 1 : 0,
        seatShare: 0,
        seatDelta: 0
      });
    }
  }

  const totals = [...totalsByParty.values()];
  for (const p of totals) {
    p.voteShare = totalVotes > 0 ? p.votes / totalVotes : 0;
    p.seatShare = totalSeats > 0 ? p.seats / totalSeats : 0;
    p.seatDelta = p.seatShare - p.voteShare;
  }

  totals.sort((a, b) => b.votes - a.votes);
  return totals;
}

function summariseCaveats(contests) {
  const counts = new Map();
  const examples = new Map();
  for (const contest of contests) {
    for (const caveat of contest.caveats) {
      counts.set(caveat, (counts.get(caveat) ?? 0) + 1);
      if (!examples.has(caveat)) examples.set(caveat, contest.constituencyName);
    }
  }
  return [...counts.entries()]
    .map(([caveat, count]) => ({ caveat, count, example: examples.get(caveat) }))
    .sort((a, b) => b.count - a.count);
}

function buildNationalSummary({ contests, candidates, partyTotals, electionId }) {
  const summary = {
    electionId,
    totalVotes: partyTotals.reduce((sum, p) => sum + p.votes, 0),
    totalSeats: partyTotals.reduce((sum, p) => sum + p.seats, 0),
    gallagher: gallagherIndex(partyTotals),
    minorityWinnerCount: minorityWinnerCount(contests, candidates),
    voteVsSeatGap: voteVsSeatGap(partyTotals),
    lowWinningShareLeaderboard: lowWinningShareLeaderboard(contests, candidates, 20),
    excludedFromMetrics: summariseCaveats(contests).map(({ caveat, count }) => ({
      caveat,
      count
    }))
  };
  return summary;
}

function writeValidationReport({
  reportPath,
  electionYear,
  sourceFiles,
  contests,
  candidates,
  caveatBreakdown,
  generatedAt
}) {
  const lines = [];
  lines.push(`# Parliament ETL Report — ${electionYear} General Election`);
  lines.push('');
  lines.push(`Generated: ${generatedAt}`);
  lines.push(`Source files: ${sourceFiles.join(', ')}`);
  lines.push(`ETL version: ${ETL_VERSION}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Constituencies ingested: ${contests.length}`);
  lines.push(`- Candidates ingested: ${candidates.length}`);
  lines.push(`- Rows with caveats: ${contests.filter((c) => c.caveats.length > 0).length}`);
  lines.push('- Build status: PASS');
  lines.push('');
  lines.push('## Caveat breakdown');
  lines.push('');
  if (caveatBreakdown.length === 0) {
    lines.push('No caveats detected on any contest row.');
  } else {
    lines.push('| Caveat | Count | Example |');
    lines.push('|---|---|---|');
    for (const { caveat, count, example } of caveatBreakdown) {
      lines.push(`| ${caveat} | ${count} | ${example ?? '—'} |`);
    }
  }
  lines.push('');
  lines.push('## Validation failures');
  lines.push('');
  lines.push('None.');
  lines.push('');
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, lines.join('\n'));
}

const BUDGET_SINGLE_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const BUDGET_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB

function emitBudgetWarnings(rootDir) {
  if (!existsSync(rootDir)) return;
  let total = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const size = statSync(full).size;
        total += size;
        if (size > BUDGET_SINGLE_FILE_BYTES) {
          console.warn(
            `WARN: ${full} is ${(size / 1024 / 1024).toFixed(2)} MB ` +
              `(budget: ${(BUDGET_SINGLE_FILE_BYTES / 1024 / 1024).toFixed(0)} MB single-file).`
          );
        }
      }
    }
  };
  walk(rootDir);
  if (total > BUDGET_TOTAL_BYTES) {
    console.warn(
      `WARN: ${rootDir} totals ${(total / 1024 / 1024).toFixed(2)} MB ` +
        `(budget: ${(BUDGET_TOTAL_BYTES / 1024 / 1024).toFixed(0)} MB).`
    );
  }
}

function buildManifest({ manifestSeed, retrievalDate, publicationDate, generatedAt }) {
  return {
    id: manifestSeed.id,
    sourceName: manifestSeed.sourceName,
    sourceUrl: manifestSeed.sourceUrl,
    licence: 'Open Parliament Licence v3.0',
    retrievalDate,
    publicationDate,
    generatedAt,
    etlVersion: ETL_VERSION,
    caveats: []
  };
}

function writeSplitArtifact(path, manifest, data) {
  mkdirSync(dirname(path), { recursive: true });
  const payload = { _manifest: manifest, data };
  // Stable JSON output: two-space indent, trailing newline. Reviewable
  // diffs across data refreshes.
  writeFileSync(path, JSON.stringify(payload, null, 2) + '\n');
}

function writeIndex({ generatedAt, years }) {
  mkdirSync(dirname(INDEX_FILE), { recursive: true });
  writeFileSync(INDEX_FILE, JSON.stringify({ generatedAt, years }, null, 2) + '\n');
}

// ── CSV emission ────────────────────────────────────────────────────────
//
// Story 4.2: analyst-facing CSV exports under static/data/parliament/.
// snake_case headers (AR17, pandas/R convention) distinct from the
// JSON camelCase, so a reader can tell which surface they're consuming.
// Caveats render as semicolon-joined token strings; nulls render as
// empty fields (no `0`/`-1`/`"N/A"` — matches JSON null semantics).

/** RFC 4180 escape: wrap in quotes when the value contains a comma,
 *  newline, or quote; double internal quotes. Plain values pass through
 *  unchanged. */
function csvEscape(value) {
  if (value == null) return '';
  const str = String(value);
  if (str === '') return '';
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function writeCsv(path, headers, rows) {
  mkdirSync(dirname(path), { recursive: true });
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  // LF line endings (Unix convention) — pandas, R, and modern Excel
  // all read this; some old Excel installs prefer CRLF but the trade-
  // off isn't worth the diff noise on every refresh.
  writeFileSync(path, lines.join('\n') + '\n');
}

function joinCaveats(tokens) {
  return tokens && tokens.length > 0 ? tokens.join(';') : '';
}

/** Per-constituency rollup row — one row per contest with the winner
 *  and runner-up fields denormalised in so an analyst can compute
 *  national headline numbers from this single CSV. */
function constituencyCsvRows(contestsWithCandidates) {
  return contestsWithCandidates.map((c) => {
    const winner = c.candidates.find((cand) => cand.isWinner) ?? null;
    const runnerUp = c.candidates.find((cand) => cand.position === 2) ?? null;
    const majority =
      winner && runnerUp && winner.votes != null && runnerUp.votes != null
        ? winner.votes - runnerUp.votes
        : null;
    return {
      election_id: c.electionId,
      constituency_id: c.constituencyId,
      constituency_slug: c.constituencySlug,
      constituency_name: c.constituencyName,
      country: c.country,
      contest_type: c.contestType,
      electorate: c.electorate,
      valid_votes: c.validVotes,
      turnout: c.turnout,
      caveats: joinCaveats(c.caveats),
      winning_party_id: winner?.partyId ?? null,
      winning_party: winner?.partyDisplayName ?? null,
      winning_candidate: winner?.candidateName ?? null,
      winning_votes: winner?.votes ?? null,
      winning_share: winner?.share ?? null,
      runner_up_party_id: runnerUp?.partyId ?? null,
      runner_up_party: runnerUp?.partyDisplayName ?? null,
      runner_up_candidate: runnerUp?.candidateName ?? null,
      runner_up_votes: runnerUp?.votes ?? null,
      runner_up_share: runnerUp?.share ?? null,
      majority
    };
  });
}

const CONSTITUENCY_CSV_HEADERS = [
  'election_id',
  'constituency_id',
  'constituency_slug',
  'constituency_name',
  'country',
  'contest_type',
  'electorate',
  'valid_votes',
  'turnout',
  'caveats',
  'winning_party_id',
  'winning_party',
  'winning_candidate',
  'winning_votes',
  'winning_share',
  'runner_up_party_id',
  'runner_up_party',
  'runner_up_candidate',
  'runner_up_votes',
  'runner_up_share',
  'majority'
];

function candidateCsvRows(contestsWithCandidates) {
  const out = [];
  for (const c of contestsWithCandidates) {
    for (const cand of c.candidates) {
      out.push({
        election_id: c.electionId,
        constituency_id: c.constituencyId,
        constituency_slug: c.constituencySlug,
        constituency_name: c.constituencyName,
        candidate_name: cand.candidateName,
        party_id: cand.partyId,
        party_display_name: cand.partyDisplayName,
        party_source_label: cand.partySourceLabel,
        votes: cand.votes,
        share: cand.share,
        position: cand.position,
        // Integer booleans match the council CSV convention
        // (see static/data/candidates.csv: `elected` is 0/1).
        is_winner: cand.isWinner ? 1 : 0,
        caveats: joinCaveats(cand.caveats)
      });
    }
  }
  return out;
}

const CANDIDATE_CSV_HEADERS = [
  'election_id',
  'constituency_id',
  'constituency_slug',
  'constituency_name',
  'candidate_name',
  'party_id',
  'party_display_name',
  'party_source_label',
  'votes',
  'share',
  'position',
  'is_winner',
  'caveats'
];

function nationalTotalsCsvRows(partyTotals) {
  return partyTotals.map((p) => ({
    election_id: p.electionId,
    party_id: p.partyId,
    party_display_name: p.partyDisplayName,
    party_source_label: p.partySourceLabel,
    votes: p.votes,
    vote_share: p.voteShare,
    seats: p.seats,
    seat_share: p.seatShare,
    seat_delta: p.seatDelta
  }));
}

const NATIONAL_TOTALS_CSV_HEADERS = [
  'election_id',
  'party_id',
  'party_display_name',
  'party_source_label',
  'votes',
  'vote_share',
  'seats',
  'seat_share',
  'seat_delta'
];

function writeCsvArtifacts({
  electionYear,
  csvOutputDir,
  contestsWithCandidates,
  partyTotals
}) {
  const filePrefix = `parliament-${electionYear}`;
  writeCsv(
    resolve(csvOutputDir, `${filePrefix}-constituencies.csv`),
    CONSTITUENCY_CSV_HEADERS,
    constituencyCsvRows(contestsWithCandidates)
  );
  writeCsv(
    resolve(csvOutputDir, `${filePrefix}-candidates.csv`),
    CANDIDATE_CSV_HEADERS,
    candidateCsvRows(contestsWithCandidates)
  );
  writeCsv(
    resolve(csvOutputDir, `${filePrefix}-national-totals.csv`),
    NATIONAL_TOTALS_CSV_HEADERS,
    nationalTotalsCsvRows(partyTotals)
  );
}

function ingestElection(election, generatedAt) {
  const {
    year: electionYear,
    electionId,
    boundarySet,
    constituencyFile,
    candidateFile,
    retrievalDate,
    publicationDate,
    manifest: manifestSeed
  } = election;

  const sourceDir = sourceDirFor(electionYear);
  const outputDir = outputDirFor(electionYear);
  const csvOutputDir = csvOutputDirFor(electionYear);

  console.log(`parliament ETL: reading ${electionYear} source files...`);

  const constituencyRows = readWorkbook(
    resolve(sourceDir, constituencyFile),
    CONSTITUENCY_COLUMNS,
    `${electionYear} constituency workbook`
  );
  const candidateRows = readWorkbook(
    resolve(sourceDir, candidateFile),
    CANDIDATE_COLUMNS,
    `${electionYear} candidate workbook`
  );

  console.log(
    `  ${constituencyRows.length} constituency rows, ${candidateRows.length} candidate rows`
  );

  const { contests, candidates } = buildContests({
    constituencyRows,
    candidateRows,
    electionId,
    boundarySet
  });

  const candidatesByContest = new Map();
  for (const c of candidates) {
    const list = candidatesByContest.get(c.contestId);
    if (list) list.push(c);
    else candidatesByContest.set(c.contestId, [c]);
  }
  const contestsWithCandidates = contests.map((contest) => ({
    ...contest,
    candidates: (
      candidatesByContest.get(`${electionId}:${contest.constituencyId}`) ?? []
    ).sort((a, b) => a.position - b.position)
  }));

  const partyTotals = buildPartyTotals({ contests, candidates, electionId });
  const nationalSummary = buildNationalSummary({
    contests,
    candidates,
    partyTotals,
    electionId
  });
  const caveatBreakdown = summariseCaveats(contests);

  const manifest = buildManifest({
    manifestSeed,
    retrievalDate,
    publicationDate,
    generatedAt
  });

  console.log(`  writing artefacts to ${outputDir}/`);
  writeSplitArtifact(
    resolve(outputDir, 'manifest.json'),
    manifest,
    {
      electionId,
      year: electionYear,
      boundarySet,
      constituenciesFile: 'constituencies.json',
      partyTotalsFile: 'party-totals.json',
      nationalSummaryFile: 'national-summary.json'
    }
  );
  writeSplitArtifact(
    resolve(outputDir, 'constituencies.json'),
    manifest,
    contestsWithCandidates
  );
  writeSplitArtifact(
    resolve(outputDir, 'party-totals.json'),
    manifest,
    partyTotals
  );
  writeSplitArtifact(
    resolve(outputDir, 'national-summary.json'),
    manifest,
    nationalSummary
  );

  console.log(`  writing CSV exports to ${csvOutputDir}/`);
  writeCsvArtifacts({
    electionYear,
    csvOutputDir,
    contestsWithCandidates,
    partyTotals
  });

  const reportPath = resolve(
    ROOT,
    `_bmad-output/etl-reports/parliament-${electionYear}.md`
  );
  writeValidationReport({
    reportPath,
    electionYear,
    sourceFiles: [constituencyFile, candidateFile],
    contests,
    candidates,
    caveatBreakdown,
    generatedAt
  });

  console.log(`  ${contests.length} contests`);
  console.log(`  ${candidates.length} candidates`);
  console.log(`  ${partyTotals.length} parties (national totals)`);
  console.log(
    `  caveats: ${caveatBreakdown.length === 0 ? 'none' : caveatBreakdown
        .map((c) => `${c.caveat}=${c.count}`)
        .join(', ')}`
  );
  console.log(
    `  Gallagher: ${nationalSummary.gallagher.toFixed(2)} · ` +
      `minority-mandate seats: ${nationalSummary.minorityWinnerCount}`
  );
  console.log(`  validation report → ${reportPath}`);
}

function main() {
  const generatedAt = new Date().toISOString();
  for (const election of ELECTIONS) {
    ingestElection(election, generatedAt);
  }
  // Years index enumerates every ingested election so the overview
  // page, downloads page, and sitemap fragment stay in lockstep.
  writeIndex({
    generatedAt,
    years: ELECTIONS.map((e) => e.year).sort((a, b) => a - b)
  });
  emitBudgetWarnings(resolve(ROOT, 'src/lib/data/parliament'));
  console.log('parliament ETL: done.');
}

try {
  main();
} catch (err) {
  console.error(`parliament ETL failed: ${err.message}`);
  process.exit(1);
}
