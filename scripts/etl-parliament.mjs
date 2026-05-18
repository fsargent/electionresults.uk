#!/usr/bin/env node
// Parliamentary ETL — happy-path ingest of the 2024 General Election.
//
// Reads two House of Commons Library workbooks (constituencies +
// candidates) from source-data/parliament/2024/, joins them, runs
// party labels through scripts/party-normalize.mjs, and writes four
// JSON files under src/lib/data/parliament/2024/ wrapped in the
// ParliamentSplit<T> envelope (top-level `_manifest` + `data`).
//
// Story 2.5 (this file): happy path only. caveats[] is always present
// on contest and candidate rows but empty — Story 2.6 wires
// detectCaveats(), the national-summary precomputation, the Markdown
// validation report, and the budget warnings on top.
//
// Council data (src/lib/data/*.json) is never touched. AR5: parliament
// ETL writes only under src/lib/data/parliament/.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import xlsx from 'xlsx';

import { normalizeParty } from './party-normalize.mjs';
import { validateSchema } from './lib/parliament-validate.mjs';

const ETL_VERSION = 'parliament-etl@1';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = resolve(ROOT, 'source-data/parliament/2024');
const OUTPUT_DIR = resolve(ROOT, 'src/lib/data/parliament/2024');
const INDEX_FILE = resolve(ROOT, 'src/lib/data/parliament/index.json');

const CONSTITUENCY_FILE = resolve(
  SOURCE_DIR,
  'HoC-GE2024-results-by-constituency.xlsx'
);
const CANDIDATE_FILE = resolve(
  SOURCE_DIR,
  'HoC-GE2024-results-by-candidate.xlsx'
);

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
    const constituencyName = row['Constituency name'];
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
      caveats: []
    });

    const contestCandidates = (candidatesByOns.get(onsId) ?? [])
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
          caveats: []
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

function buildPartyTotals({ candidates, electionId }) {
  // National totals: votes summed across all candidates per canonical
  // party; seats = count of winning candidates per canonical party.
  const totalsByParty = new Map();
  let totalVotes = 0;
  let totalSeats = 0;

  for (const c of candidates) {
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

function buildManifest({ retrievalDate, publicationDate, generatedAt }) {
  return {
    id: 'parliament-ge-2024-cbp-10009',
    sourceName: 'House of Commons Library general election results 2024',
    sourceUrl: 'https://commonslibrary.parliament.uk/research-briefings/cbp-10009/',
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

function main() {
  const electionYear = 2024;
  const electionId = `ge-${electionYear}`;
  const boundarySet = '2023-review';
  const retrievalDate = '2026-05-18';
  // From the `About` sheet inside each workbook: "Last updated:
  // Monday, 5th January 2026". Updates in lockstep with each refresh.
  const publicationDate = '2026-01-05';
  const generatedAt = new Date().toISOString();

  console.log(`parliament ETL: reading ${electionYear} source files...`);

  const constituencyRows = readWorkbook(
    CONSTITUENCY_FILE,
    CONSTITUENCY_COLUMNS,
    'constituency workbook'
  );
  const candidateRows = readWorkbook(
    CANDIDATE_FILE,
    CANDIDATE_COLUMNS,
    'candidate workbook'
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

  // Join contests with their candidates for the per-row output.
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

  const partyTotals = buildPartyTotals({ candidates, electionId });

  const manifest = buildManifest({ retrievalDate, publicationDate, generatedAt });

  console.log(`  writing artefacts to ${OUTPUT_DIR}/`);
  // manifest.json's _manifest carries the source provenance; `data`
  // carries the per-year inventory so the downloads page (Story 4.3)
  // can render file sizes and per-file links without re-statting the
  // filesystem from the browser.
  writeSplitArtifact(
    resolve(OUTPUT_DIR, 'manifest.json'),
    manifest,
    {
      electionId,
      year: electionYear,
      boundarySet,
      constituenciesFile: 'constituencies.json',
      partyTotalsFile: 'party-totals.json'
    }
  );
  writeSplitArtifact(
    resolve(OUTPUT_DIR, 'constituencies.json'),
    manifest,
    contestsWithCandidates
  );
  writeSplitArtifact(
    resolve(OUTPUT_DIR, 'party-totals.json'),
    manifest,
    partyTotals
  );

  // Years index. For now, only 2024 — Phase 2 ingest adds historical
  // years and this loop extends to enumerate them all.
  writeIndex({ generatedAt, years: [electionYear] });

  console.log(`  ${contests.length} contests`);
  console.log(`  ${candidates.length} candidates`);
  console.log(`  ${partyTotals.length} parties (national totals)`);
  console.log('parliament ETL: done.');
}

try {
  main();
} catch (err) {
  console.error(`parliament ETL failed: ${err.message}`);
  process.exit(1);
}
