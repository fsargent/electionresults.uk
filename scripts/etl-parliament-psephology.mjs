#!/usr/bin/env bun
// Parliamentary ETL — psephology.db variant.
//
// Reads the UK Parliament psephology SQLite database
// (https://github.com/ukparliament/psephology-datasette) and emits the
// same ParliamentSplit JSON + CSV artefacts as scripts/etl-parliament.mjs
// for one or more general-election years. Used for the pre-2019
// cycles (2010 / 2015 / 2017) where we don't have House of Commons
// Library briefing workbooks downloaded locally.
//
// Why a sibling script rather than collapsing both into one: the
// XLSX-briefing ETL is already producing known-good 2019 and 2024
// output, and there's value in cross-checking the DB-derived numbers
// against the briefing numbers before promoting any cycle to the DB
// path. Both write to src/lib/data/parliament/{year}/ in the exact
// same shape, so the site code is agnostic about which path produced
// the JSON.
//
// Licence: this script consumes data published under the Open
// Parliament Licence v3.0. Every emitted manifest carries the licence
// string and a verbatim © House of Commons attribution; the displayed
// "Source data" footer on /parliament/[year] surfaces both. See
// https://www.parliament.uk/site-information/copyright-parliament/open-parliament-licence/
// for the licence terms.

import { Database } from 'bun:sqlite';
import {
  writeFileSync,
  mkdirSync,
  existsSync,
  statSync,
  readdirSync,
  readFileSync
} from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeParty } from './party-normalize.mjs';
import { detectCaveats } from './lib/parliament-validate.mjs';
import {
  gallagherIndex,
  voteVsSeatGap,
  minorityWinnerCount,
  lowWinningShareLeaderboard
} from '../src/lib/parliament/metrics.ts';

const ETL_VERSION = 'parliament-etl-psephology@1';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DB_PATH = resolve(
  ROOT,
  'source-data/parliament/psephology/psephology.db'
);
const INDEX_FILE = resolve(ROOT, 'src/lib/data/parliament/index.json');

// Open Parliament Licence attribution string we want surfaced everywhere
// the data appears — same wording the user supplied verbatim.
const OPL_ATTRIBUTION =
  '© House of Commons 2026. Re-use our content freely and flexibly ' +
  'with only a few conditions under the Open Parliament Licence.';

// Pre-2019 GEs all sat on the same boundary set; the 2024 ETL handles
// the 2023-review set separately. Adding more years means adding
// pollingDate + boundarySet here, nothing else.
const ELECTIONS = {
  2010: { pollingDate: '2010-05-06', boundarySet: '2010-review' },
  2015: { pollingDate: '2015-05-07', boundarySet: '2010-review' },
  2017: { pollingDate: '2017-06-08', boundarySet: '2010-review' }
};

// ── shared helpers (lifted from etl-parliament.mjs verbatim) ────────────

function slugForName(name) {
  return String(name)
    .toLowerCase()
    .replace(/&/g, 'and')
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

// Caveats that exclude a contest's votes/seats from national party
// totals — same set as the XLSX ETL so totals are comparable.
const PARTY_TOTAL_EXCLUDING_CAVEATS = new Set([
  'speaker',
  'multi-member-historical'
]);

function contestExcludedFromPartyTotals(contest) {
  return contest.caveats.some((c) => PARTY_TOTAL_EXCLUDING_CAVEATS.has(c));
}

function buildPartyTotals({ contests, candidates, electionId }) {
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
  return {
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
}

function buildManifest({ electionYear, pollingDate, generatedAt, retrievalDate }) {
  return {
    id: `parliament-ge-${electionYear}-psephology`,
    sourceName: 'UK Parliament psephology database',
    sourceUrl: 'https://github.com/ukparliament/psephology-datasette',
    licence: 'Open Parliament Licence v3.0',
    retrievalDate,
    publicationDate: pollingDate,
    generatedAt,
    etlVersion: ETL_VERSION,
    caveats: [OPL_ATTRIBUTION]
  };
}

function writeSplitArtifact(path, manifest, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({ _manifest: manifest, data }, null, 2) + '\n'
  );
}

function writeIndex({ generatedAt, years }) {
  mkdirSync(dirname(INDEX_FILE), { recursive: true });
  writeFileSync(
    INDEX_FILE,
    JSON.stringify({ generatedAt, years: [...years].sort((a, b) => a - b) }, null, 2) + '\n'
  );
}

// ── SQL queries against psephology.db ───────────────────────────────────

const CONSTITUENCY_SQL = `
  SELECT
    e.id AS election_id_pk,
    ca.name AS constituency_name,
    ca.geographic_code AS ons_code,
    c.name AS country_name,
    e.valid_vote_count,
    e.invalid_vote_count,
    el.population_count AS electorate
  FROM elections e
  JOIN general_elections ge ON ge.id = e.general_election_id
  JOIN constituency_groups cg ON cg.id = e.constituency_group_id
  JOIN constituency_areas ca ON ca.id = cg.constituency_area_id
  JOIN countries c ON c.id = ca.country_id
  LEFT JOIN electorates el ON el.id = e.electorate_id
  WHERE ge.polling_on = ?
    AND e.is_notional = 0
  ORDER BY ca.name
`;

const CANDIDACY_SQL = `
  SELECT
    cand.election_id AS election_id_pk,
    cand.candidate_given_name,
    cand.candidate_family_name,
    cand.is_standing_as_independent,
    cand.is_standing_as_commons_speaker,
    cand.vote_count,
    cand.vote_share,
    cand.is_winning_candidacy,
    cand.result_position,
    pp.name AS party_name,
    pp.abbreviation AS party_abbreviation
  FROM elections e
  JOIN general_elections ge ON ge.id = e.general_election_id
  JOIN candidacies cand ON cand.election_id = e.id
  LEFT JOIN certifications cert
    ON cert.candidacy_id = cand.id
   AND cert.adjunct_to_certification_id IS NULL
  LEFT JOIN political_parties pp ON pp.id = cert.political_party_id
  WHERE ge.polling_on = ?
    AND e.is_notional = 0
  ORDER BY cand.election_id, cand.vote_count DESC
`;

// Map a psephology candidacy to the canonical (sourceLabel, displayName).
// `is_standing_as_commons_speaker` flags the Speaker (no party label in
// source) — we surface as "Speaker" so the Speaker contest gets the
// existing `speaker` caveat from detectCaveats. Independents become
// "Independent" rather than empty so partyId / partyDisplayName never
// collapse to empty strings downstream.
function resolveParty(row) {
  if (row.is_standing_as_commons_speaker) {
    return { sourceLabel: 'Speaker', displayName: 'Speaker' };
  }
  if (row.is_standing_as_independent || !row.party_name) {
    return { sourceLabel: 'Independent', displayName: 'Independent' };
  }
  const sourceLabel = row.party_name;
  const display = normalizeParty(sourceLabel) ?? sourceLabel;
  return { sourceLabel, displayName: display };
}

function ingestYear(db, year, generatedAt) {
  const { pollingDate, boundarySet } = ELECTIONS[year];
  const electionId = `ge-${year}`;
  const retrievalDate = new Date().toISOString().slice(0, 10);

  console.log(`parliament/psephology ETL: ${year} (${pollingDate})...`);

  const constituencyRows = db.query(CONSTITUENCY_SQL).all(pollingDate);
  const candidacyRows = db.query(CANDIDACY_SQL).all(pollingDate);

  // Index candidacies by the upstream election PK so we can join in one
  // O(N) pass instead of N² lookups.
  const candidaciesByElectionPk = new Map();
  for (const row of candidacyRows) {
    const list = candidaciesByElectionPk.get(row.election_id_pk);
    if (list) list.push(row);
    else candidaciesByElectionPk.set(row.election_id_pk, [row]);
  }

  const contests = [];
  const candidates = [];

  for (const row of constituencyRows) {
    const constituencyName = row.constituency_name;
    const slug = slugForName(constituencyName);
    const constituencyId = `${boundarySet}:${slug}`;
    const contestId = `${electionId}:${constituencyId}`;
    const country = countryFor(row.country_name);

    const validVotes =
      typeof row.valid_vote_count === 'number' ? row.valid_vote_count : null;
    const electorate =
      typeof row.electorate === 'number' ? row.electorate : null;
    const turnout =
      electorate !== null && validVotes !== null && electorate > 0
        ? validVotes / electorate
        : null;

    const rawCandidacies = candidaciesByElectionPk.get(row.election_id_pk) ?? [];

    // We deliberately don't pass `constituencySlug` to detectCaveats
    // here — that helper's speaker check is keyed off a static slug
    // list (currently just 'chorley' for 2019/2024) which would
    // false-positive on every earlier election where Chorley wasn't
    // a Speaker seat. The psephology source ships the authoritative
    // per-candidacy `is_standing_as_commons_speaker` flag instead, so
    // we layer that in below.
    const caveats = detectCaveats({
      candidateCount: rawCandidacies.length,
      electorate,
      validVotes,
      contestType: 'single-member'
    });

    if (rawCandidacies.some((c) => c.is_standing_as_commons_speaker)) {
      if (!caveats.includes('speaker')) caveats.push('speaker');
    }

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

    const contestCandidates = rawCandidacies
      .map((cand) => {
        const { sourceLabel, displayName } = resolveParty(cand);
        const firstName = (cand.candidate_given_name ?? '').trim();
        const surname = (cand.candidate_family_name ?? '').trim();
        const candidateName = [firstName, surname].filter(Boolean).join(' ');
        const votes =
          typeof cand.vote_count === 'number' ? cand.vote_count : 0;
        // psephology stores vote_share already as a fraction in [0,1].
        // Null when the source didn't publish it; the metrics functions
        // already cope with null shares.
        const share =
          typeof cand.vote_share === 'number' ? cand.vote_share : null;
        return {
          contestId,
          candidateName,
          partyId: partySlug(displayName),
          partyDisplayName: displayName,
          partySourceLabel: sourceLabel,
          votes,
          share,
          position: 0,
          isWinner: false,
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
    electionYear: year,
    pollingDate,
    generatedAt,
    retrievalDate
  });

  const outputDir = resolve(ROOT, `src/lib/data/parliament/${year}`);
  const csvOutputDir = resolve(ROOT, `static/data/parliament/${year}`);

  console.log(`  writing artefacts to ${outputDir}/`);
  writeSplitArtifact(resolve(outputDir, 'manifest.json'), manifest, {
    electionId,
    year,
    boundarySet,
    constituenciesFile: 'constituencies.json',
    partyTotalsFile: 'party-totals.json',
    nationalSummaryFile: 'national-summary.json'
  });
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
    electionYear: year,
    csvOutputDir,
    contestsWithCandidates,
    partyTotals
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
}

// ── CSV emission (subset of etl-parliament.mjs) ─────────────────────────

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
  writeFileSync(path, lines.join('\n') + '\n');
}

function joinCaveats(tokens) {
  return tokens && tokens.length > 0 ? tokens.join(';') : '';
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
        is_winner: cand.isWinner ? 1 : 0,
        caveats: joinCaveats(cand.caveats)
      });
    }
  }
  return out;
}

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

// ── budget warnings ─────────────────────────────────────────────────────

const BUDGET_SINGLE_FILE_BYTES = 5 * 1024 * 1024;
const BUDGET_TOTAL_BYTES = 50 * 1024 * 1024;

function emitBudgetWarnings(rootDir) {
  if (!existsSync(rootDir)) return;
  let total = 0;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
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

// ── main ────────────────────────────────────────────────────────────────

function readExistingIndexYears() {
  if (!existsSync(INDEX_FILE)) return [];
  try {
    return JSON.parse(readFileSync(INDEX_FILE, 'utf8')).years ?? [];
  } catch {
    return [];
  }
}

function main() {
  if (!existsSync(DB_PATH)) {
    throw new Error(
      `psephology.db not found at ${DB_PATH}. Run:\n` +
        `  curl -fsSL -o ${DB_PATH} \\\n` +
        `    https://raw.githubusercontent.com/ukparliament/psephology-datasette/main/psephology.db`
    );
  }
  const db = new Database(DB_PATH, { readonly: true });
  const generatedAt = new Date().toISOString();

  // Years are passed on the CLI; default to every year in the
  // ELECTIONS map. Lets `etl:parliament:psephology -- 2010` refresh
  // just one cycle without touching the others.
  const cliYears = process.argv
    .slice(2)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
  const yearsToIngest =
    cliYears.length > 0 ? cliYears : Object.keys(ELECTIONS).map(Number);

  for (const year of yearsToIngest) {
    if (!ELECTIONS[year]) {
      throw new Error(
        `Unknown year ${year}. Add it to ELECTIONS in ${import.meta.url}.`
      );
    }
    ingestYear(db, year, generatedAt);
  }

  // Index is the union of years we just wrote and years already on disk
  // (so the XLSX-ETL's 2019/2024 stay listed).
  const existing = readExistingIndexYears();
  const allYears = Array.from(new Set([...existing, ...yearsToIngest]));
  writeIndex({ generatedAt, years: allYears });

  emitBudgetWarnings(resolve(ROOT, 'src/lib/data/parliament'));
  console.log('parliament/psephology ETL: done.');
}

try {
  main();
} catch (err) {
  console.error(`parliament/psephology ETL failed: ${err.message}`);
  process.exit(1);
}
