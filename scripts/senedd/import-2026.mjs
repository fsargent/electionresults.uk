#!/usr/bin/env bun
// Build the 2026 Senedd election dataset.
//
//   bun scripts/senedd/import-2026.mjs             # parse vote.wales cache if present, then build
//   bun scripts/senedd/import-2026.mjs --from-csv  # build from the committed CSVs only
//
// Stage 1 (needs source-data/senedd/2026/vote-wales-cache/, filled by
// fetch-2026.mjs): extract the published list results from each
// vote.wales page into separate list, candidate and national CSV files.
//
// Stage 2 (offline): join those with the Senedd Research briefing and
// ODS files and Democracy Club list positions, re-run the statutory
// D'Hondt allocation, reconcile every figure across sources, and write
//
//   src/lib/data/senedd/2026.json     full election (pages read this)
//   src/lib/data/senedd/catalog.json  all-elections hub contract
//
// Any reconciliation failure aborts with a non-zero exit and writes
// nothing, so a bad refresh can't reach the site.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';
import { allocateSeats } from '../../src/lib/senedd/dhondt.ts';
import {
  nameKey,
  parseBriefing,
  parseCsv,
  parseVoteWalesConstituency,
  parseVoteWalesNational,
  slugify,
  toCsv,
  toInt
} from './parse-2026.mjs';
import { COMMITTED_SOURCES, SOURCE_DIR, VOTE_WALES_BASE, VOTE_WALES_SLUGS } from './sources-2026.mjs';

const ETL_VERSION = 'senedd-2026.2';
const ROOT = process.cwd();
const SRC = resolve(ROOT, SOURCE_DIR);
const OUT = resolve(ROOT, 'src/lib/data/senedd');
const CACHE = resolve(SRC, 'vote-wales-cache');
const LISTS_CSV = resolve(SRC, 'vote-wales-lists.csv');
const NATIONAL_CSV = resolve(SRC, 'vote-wales-national.csv');

const failures = [];
const fail = (msg) => failures.push(msg);
const read = (f) => readFileSync(resolve(SRC, f), 'utf8');

// ---------------------------------------------------------------------------
// Stage 1: vote.wales HTML → committed CSVs

const LIST_COLUMNS = [
  'constituency_slug',
  'constituency_name',
  'total_valid_votes',
  'seats',
  'entry_order',
  'ballot_label',
  'list_votes',
  'seats_won'
];

if (!process.argv.includes('--from-csv') && existsSync(resolve(CACHE, 'national.html'))) {
  const rows = [];
  const candidateRows = [];
  for (const slug of VOTE_WALES_SLUGS) {
    const page = parseVoteWalesConstituency(readFileSync(resolve(CACHE, `${slug}.html`), 'utf8'));
    page.entries.forEach((e, i) => {
      rows.push({
        constituency_slug: slug, constituency_name: page.name,
        total_valid_votes: page.totalValidVotes, seats: page.seats,
        entry_order: i + 1, ballot_label: e.ballotLabel,
        list_votes: e.votes, seats_won: e.seatsWon
      });
      const summary = page.electedSummary.find((x) => x.ballotLabel === e.ballotLabel);
      e.candidates.forEach((name, j) => candidateRows.push({
        constituency_slug: slug, entry_order: i + 1,
        list_position: j + 1, candidate_name: name,
        elected_source: summary?.candidates.includes(name) ? 'true' : 'false'
      }));
    });
    // The "Elected candidates" summary must agree with the full table.
    for (const s of page.electedSummary) {
      const full = page.entries.find((e) => e.ballotLabel === s.ballotLabel);
      if (!full || full.votes !== s.votes || full.seatsWon !== s.seatsWon) {
        fail(`${slug}: elected summary for "${s.ballotLabel}" disagrees with full table`);
      } else if (s.candidates.join('|') !== full.candidates.slice(0, s.seatsWon).join('|')) {
        fail(`${slug}: elected names for "${s.ballotLabel}" are not the top of the list`);
      }
    }
  }
  if (failures.length) throw new Error(failures.join('\n'));
  writeFileSync(LISTS_CSV, toCsv(rows, LIST_COLUMNS));
  writeFileSync(resolve(SRC, 'vote-wales-candidates.csv'), toCsv(candidateRows,
    ['constituency_slug', 'entry_order', 'list_position', 'candidate_name', 'elected_source']));
  const nat = parseVoteWalesNational(readFileSync(resolve(CACHE, 'national.html'), 'utf8'));
  if (nat.seatsDeclared !== '96 of 96') fail(`vote.wales national: seats declared "${nat.seatsDeclared}"`);
  writeFileSync(
    NATIONAL_CSV,
    toCsv(
      nat.parties.map((p) => ({ party_label: p.partyLabel, votes: p.votes, seats: p.seats })),
      ['party_label', 'votes', 'seats']
    )
  );
  console.log(`stage 1: ${rows.length} list rows from ${VOTE_WALES_SLUGS.length} vote.wales pages`);
} else {
  console.log('stage 1: skipped (using committed vote-wales-*.csv)');
}

// ---------------------------------------------------------------------------
// Stage 2: build

/**
 * Registered party → how the site shows it. `colorKey` is the canonical
 * name used by $lib/party-colors so the Welsh branches share the UK
 * party colour; `displayName` is the name the party campaigned under
 * (as used by Senedd Research).
 */
const PARTIES = {
  PP77: { colorKey: 'Plaid Cymru', displayName: 'Plaid Cymru', slug: 'plaid-cymru' },
  PP7931: { colorKey: 'Reform UK', displayName: 'Reform UK', slug: 'reform-uk' },
  PP53: { colorKey: 'Labour Party', displayName: 'Welsh Labour', slug: 'welsh-labour' },
  PP52: { colorKey: 'Conservative Party', displayName: 'Welsh Conservatives', slug: 'welsh-conservatives' },
  PP63: { colorKey: 'Green Party', displayName: 'Wales Green Party', slug: 'wales-green-party' },
  PP90: { colorKey: 'Liberal Democrats', displayName: 'Welsh Liberal Democrats', slug: 'welsh-liberal-democrats' },
  PP12550: { colorKey: 'Heritage Party', displayName: 'Heritage Party', slug: 'heritage-party' },
  PP6851: { colorKey: 'Gwlad', displayName: 'Gwlad', slug: 'gwlad' },
  PP17475: { colorKey: 'Open Party', displayName: 'Open Party', slug: 'open-party' },
  PP804: {
    colorKey: 'Trade Unionist and Socialist Coalition',
    displayName: 'Welsh Trade Unionist and Socialist Coalition',
    slug: 'welsh-tusc'
  },
  PP12731: { colorKey: 'Propel', displayName: 'Propel', slug: 'propel' },
  PP78: { colorKey: 'Communist Party of Britain', displayName: "Britain's Communist Party", slug: 'britains-communist-party' },
  PP2893: { colorKey: 'Christian Party', displayName: 'Welsh Christian Party', slug: 'welsh-christian-party' },
  PP73: { colorKey: 'Socialist Labour Party', displayName: 'Socialist Labour Party', slug: 'socialist-labour-party' },
  PP66: {
    colorKey: 'The Official Monster Raving Loony Party',
    displayName: 'Official Monster Raving Loony Party',
    slug: 'official-monster-raving-loony-party'
  },
  PP243: { colorKey: 'Social Democratic Party', displayName: 'Social Democratic Party', slug: 'social-democratic-party' }
};
const INDEPENDENT_ID = 'ynmp-party:2';

/** Senedd Research's short party names (briefing + ODS) → DC party id. */
const RESEARCH_NAME_TO_ID = {
  'Plaid Cymru': 'PP77',
  'Reform UK': 'PP7931',
  'Welsh Labour': 'PP53',
  'Welsh Conservatives': 'PP52',
  'Wales Green Party': 'PP63',
  'Welsh Liberal Democrats': 'PP90'
};

/** vote.wales national page labels → DC party id. */
const VOTE_WALES_NATIONAL_TO_ID = {
  'Plaid Cymru - The Party of Wales': 'PP77',
  'Reform UK Wales': 'PP7931',
  'Welsh Labour': 'PP53',
  'Welsh Conservatives': 'PP52',
  'Wales Green Party': 'PP63',
  'Welsh Liberal Democrats': 'PP90'
};

const listRows = parseCsv(read('vote-wales-lists.csv'));
const candidateRows = parseCsv(read('vote-wales-candidates.csv'));
const nationalRows = parseCsv(read('vote-wales-national.csv'));
const dcRows = parseCsv(read('democracy-club-senedd-2026-candidates.csv'));
const briefing = parseBriefing(read('senedd-research-briefing-senedd-election-2026.txt'));

function readOds(file) {
  const wb = XLSX.read(readFileSync(resolve(SRC, file)));
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
}
const odsMap = readOds('senedd-research-election_results_map.ods');
const odsTable = readOds('senedd-research-election_results_table.ods');
const odsSeats = readOds('senedd-research-seats_won.ods');

// Sources spell a few constituency names differently; compare on a folded key.
const ALIASES = { 'caerdydd fynnon taf': 'caerdydd ffynnon taf' };
const ckey = (s) => {
  const k = nameKey(s);
  return ALIASES[k] ?? k;
};

const surnameKey = (s) => nameKey(s).split(' ').at(-1);

const HONORIFICS = new Set(['dr', 'sir', 'mr', 'mrs', 'ms', 'miss', 'prof', 'cllr']);
const tokens = (s) => nameKey(s).split(' ').filter((t) => t && !HONORIFICS.has(t));

/**
 * Find a candidate's Democracy Club record within one constituency.
 * vote.wales prints full legal names ("Gareth David Beer"); DC usually
 * has the short form ("Gareth Beer"), occasionally with typos. Score
 * each DC row and accept a unique best match:
 *   4 exact name · 3 same surname + first initial · 2 same first name
 *   +1 when DC's list position agrees.
 */
function matchDc(name, position, rows, minScore = 2) {
  const a = tokens(name);
  const scored = rows
    .map((d) => {
      const b = tokens(d.person_name);
      let score = 0;
      if (a.join(' ') === b.join(' ')) score = 4;
      else if (a.at(-1) === b.at(-1) && a[0][0] === b[0][0]) score = 3;
      else if (a[0] === b[0] && a.slice(1).some((t) => b.includes(t))) score = 3;
      else if (a[0] === b[0] || a.at(-1) === b.at(-1)) score = 2;
      if (score && d.party_list_position && Number(d.party_list_position) === position) score += 1;
      return { d, score };
    })
    .filter((x) => x.score >= minScore)
    .sort((x, y) => y.score - x.score);
  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[1].score === scored[0].score) return null;
  return scored[0].d;
}

const constituencies = [];

for (const slug of VOTE_WALES_SLUGS) {
  const rows = listRows.filter((r) => r.constituency_slug === slug);
  if (rows.length === 0) {
    fail(`${slug}: no rows in vote-wales-lists.csv`);
    continue;
  }
  const name = rows[0].constituency_name;
  const seats = toInt(rows[0].seats);
  const totalValid = toInt(rows[0].total_valid_votes);
  const dc = dcRows.filter((r) => ckey(r.post_label) === ckey(name));
  if (dc.length === 0) fail(`${slug}: no Democracy Club rows`);

  // Group candidate rows back into ballot entries.
  const entryMap = new Map();
  for (const r of rows) {
    const k = Number(r.entry_order);
    if (!entryMap.has(k)) {
      entryMap.set(k, {
        ballotLabel: r.ballot_label,
        votes: toInt(r.list_votes),
        seatsWonPublished: toInt(r.seats_won),
        candidates: []
      });
    }
    entryMap.get(k).candidates = candidateRows
      .filter((c) => c.constituency_slug === slug && Number(c.entry_order) === k)
      .map((c) => ({ position: Number(c.list_position), name: c.candidate_name,
        electedSource: c.elected_source === 'true' }));
  }

  const entries = [...entryMap.values()].map((e) => {
    const isIndividual = /^Independent candidate$/i.test(e.ballotLabel);
    // Identify the registered party through Democracy Club: every
    // candidate on a list must belong to the same DC party.
    // Pass 1: confident matches across the constituency fix the list's
    // registered party. Pass 2: match the rest within that party only.
    const strong = e.candidates.map((c) => matchDc(c.name, isIndividual ? null : c.position, dc, 3));
    const strongIds = [...new Set(strong.filter(Boolean).map((m) => m.party_id))];
    const pool = strongIds.length === 1 ? dc.filter((d) => d.party_id === strongIds[0]) : dc;
    const matched = e.candidates.map((c, i) => strong[i] ?? matchDc(c.name, isIndividual ? null : c.position, pool));
    if (matched.some((m) => !m)) {
      const missing = e.candidates.filter((_, i) => !matched[i]).map((c) => c.name);
      fail(`${slug}: "${e.ballotLabel}" candidates not matched in Democracy Club: ${missing.join(', ')}`);
    }
    const partyIds = [...new Set(matched.filter(Boolean).map((m) => m.party_id))];
    if (partyIds.length !== 1) fail(`${slug}: "${e.ballotLabel}" maps to party ids ${partyIds.join(',')}`);
    const partyId = partyIds[0];
    if (isIndividual !== (partyId === INDEPENDENT_ID)) {
      fail(`${slug}: "${e.ballotLabel}" individual/party mismatch with Democracy Club`);
    }
    // List order check against Democracy Club's party_list_position.
    if (!isIndividual) {
      matched.forEach((m, i) => {
        if (m && m.party_list_position && Number(m.party_list_position) !== i + 1) {
          fail(
            `${slug}: ${e.candidates[i].name} is #${i + 1} on vote.wales but #${m.party_list_position} in Democracy Club`
          );
        }
      });
    }
    const info = isIndividual ? null : PARTIES[partyId] ?? { colorKey: e.ballotLabel, displayName: e.ballotLabel, slug: `unknown-${slugify(e.ballotLabel)}` };
    if (!isIndividual && !PARTIES[partyId]) fail(`${slug}: unknown party id ${partyId} for "${e.ballotLabel}"`);
    if (isIndividual && e.candidates.length !== 1) fail(`${slug}: individual entry with ${e.candidates.length} names`);
    if (!isIndividual && e.candidates.length > 8) fail(`${slug}: "${e.ballotLabel}" list exceeds 8 candidates`);

    const individualName = isIndividual ? e.candidates[0].name : null;
    return {
      id: isIndividual ? `individual-${slugify(individualName)}` : info.slug,
      kind: isIndividual ? 'individual' : 'party',
      ballotLabel: e.ballotLabel,
      partyId: partyId ?? '',
      party: isIndividual ? 'Independent' : info.colorKey,
      displayName: isIndividual ? `${individualName} (Independent)` : info.displayName,
      votes: e.votes,
      share: e.votes / totalValid,
      seatsWon: 0,
      seatsWonSource: e.seatsWonPublished,
      seatsWonPublished: e.seatsWonPublished,
      candidates: e.candidates.map((c, i) => ({
        position: i + 1,
        name: c.name,
        dcPersonId: matched[i]?.person_id ?? '',
        electedSource: c.electedSource,
        elected: false,
        seat: 0
      }))
    };
  });

  // Sum of list votes is the valid vote.
  const sumVotes = entries.reduce((s, e) => s + e.votes, 0);
  if (sumVotes !== totalValid) fail(`${slug}: list votes sum ${sumVotes} ≠ total valid ${totalValid}`);

  // Statutory allocation.
  const alloc = allocateSeats(
    entries.map((e) => ({ id: e.id, kind: e.kind, votes: e.votes, listLength: e.candidates.length })),
    seats
  );
  if (alloc.needsLots) fail(`${slug}: allocation needs lots at seat ${alloc.needsLots.seat}`);
  if (alloc.rounds.length !== seats) fail(`${slug}: only ${alloc.rounds.length} of ${seats} seats allocated`);

  const elected = alloc.rounds.map((r) => {
    const e = entries.find((x) => x.id === r.winnerId);
    e.seatsWon += 1;
    const cand = e.candidates[e.seatsWon - 1];
    cand.elected = true;
    cand.seat = r.seat;
    return {
      seat: r.seat,
      entryId: e.id,
      name: cand.name,
      listPosition: cand.position,
      party: e.party,
      displayName: e.displayName,
      figure: r.winningFigure,
      divisor: r.winningDivisor
    };
  });
  for (const e of entries) {
    if (e.seatsWon !== e.seatsWonPublished) {
      fail(`${slug}: D'Hondt gives "${e.ballotLabel}" ${e.seatsWon} seats; vote.wales says ${e.seatsWonPublished}`);
    }
  }

  for (const e of entries) {
    for (const c of e.candidates) {
      if (c.elected !== c.electedSource) fail(`${slug}: elected status differs for ${c.name}`);
    }
  }

  // Seat order vs Senedd Research map data.
  const mapRow = odsMap.find((r) => ckey(r.Constituency) === ckey(name));
  if (!mapRow) fail(`${slug}: not in Senedd Research map data`);
  else {
    for (let s = 1; s <= seats; s++) {
      const expectedId = RESEARCH_NAME_TO_ID[String(mapRow[`Seat ${s}`]).replace(/^Reform UK$/, 'Reform UK')];
      const got = entries.find((e) => e.id === elected[s - 1]?.entryId);
      if (!got || got.partyId !== expectedId) {
        fail(`${slug}: seat ${s} computed ${got?.displayName}; Senedd Research says ${mapRow[`Seat ${s}`]}`);
      }
    }
  }

  // Turnout + elected names vs the briefing.
  const b = briefing.find((x) => ckey(x.name) === ckey(name));
  if (!b) {
    fail(`${slug}: not found in Senedd Research briefing`);
    continue;
  }
  if (b.validVotes !== totalValid) fail(`${slug}: briefing valid ${b.validVotes} ≠ vote.wales ${totalValid}`);
  // The briefing says turnout = valid votes ÷ electorate. Record which
  // basis its published figure actually matches rather than assume.
  const turnoutValid = b.validVotes / b.electorate;
  const turnoutBallots = (b.validVotes + b.rejectedBallots) / b.electorate;
  const near = (x) => Math.abs(x * 100 - b.turnoutPublishedPct) < 0.006;
  const turnoutPublishedBasis = near(turnoutValid)
    ? 'valid-votes'
    : near(turnoutBallots)
      ? 'ballots-at-count'
      : 'unexplained';
  for (const be of b.elected) {
    const mine = elected[be.seat - 1];
    const sameName =
      mine &&
      (surnameKey(mine.name) === surnameKey(be.name) ||
        tokens(be.name).every((t) => tokens(mine.name).includes(t)));
    if (!sameName) {
      fail(`${slug}: seat ${be.seat} computed ${mine?.name}; briefing lists ${be.name}`);
    }
    if (mine && RESEARCH_NAME_TO_ID[be.party] !== entries.find((e) => e.id === mine.entryId).partyId) {
      fail(`${slug}: seat ${be.seat} party ${be.party} disagrees`);
    }
  }

  // Quotient table for the explainer: every figure up to the seat count.
  const quotients = entries.map((e) => {
    const n = e.kind === 'individual' ? 1 : Math.min(seats, e.candidates.length);
    return {
      entryId: e.id,
      figures: Array.from({ length: n }, (_, i) => {
        const won = elected.find((x) => x.entryId === e.id && x.divisor === i + 1 && e.kind === 'party');
        const wonInd = e.kind === 'individual' ? elected.find((x) => x.entryId === e.id) : null;
        return { divisor: i + 1, figure: e.votes / (i + 1), seat: (won ?? wonInd)?.seat ?? 0 };
      })
    };
  });

  entries.sort((a, b) => b.votes - a.votes || a.displayName.localeCompare(b.displayName));
  const ties = alloc.rounds.filter((r) => r.tie).length;
  const next = alloc.nextInLine;
  const nextEntry = next ? entries.find((e) => e.id === next.id) : null;

  constituencies.push({
    slug: slugify(name),
    name,
    voteWalesUrl: `${VOTE_WALES_BASE}${slug}/`,
    seats,
    electorate: b.electorate,
    validVotes: totalValid,
    rejectedBallots: b.rejectedBallots,
    ballotsAtCount: totalValid + b.rejectedBallots,
    turnoutValid,
    turnoutBallotsAtCount: turnoutBallots,
    turnoutPublishedPct: b.turnoutPublishedPct,
    turnoutPublishedBasis,
    entries: entries.map(({ seatsWonPublished, ...e }) => e),
    elected,
    quotients,
    lastSeat: {
      figure: elected.at(-1).figure,
      entryId: elected.at(-1).entryId,
      nextEntryId: next?.id ?? '',
      nextFigure: next?.figure ?? 0,
      nextDivisor: next?.divisor ?? 0,
      nextCandidate:
        nextEntry && nextEntry.kind === 'party'
          ? nextEntry.candidates[nextEntry.seatsWon]?.name ?? ''
          : nextEntry?.candidates[0].name ?? ''
    },
    tiesInAllocation: ties
  });
}

// ---------------------------------------------------------------------------
// National totals and reconciliation

const totals = new Map();
for (const c of constituencies) {
  for (const e of c.entries) {
    const key = e.kind === 'individual' ? 'independent' : e.id;
    if (!totals.has(key)) {
      totals.set(key, {
        id: key,
        party: e.party,
        displayName: e.kind === 'individual' ? 'Independent candidates' : e.displayName,
        partyId: e.kind === 'individual' ? INDEPENDENT_ID : e.partyId,
        votes: 0,
        seats: 0,
        constituenciesContested: 0,
        candidates: 0
      });
    }
    const t = totals.get(key);
    t.votes += e.votes;
    t.seats += e.seatsWon;
    t.constituenciesContested += e.kind === 'individual' ? 0 : 1;
    t.candidates += e.candidates.length;
  }
}

const validVotes = constituencies.reduce((s, c) => s + c.validVotes, 0);
const electorate = constituencies.reduce((s, c) => s + c.electorate, 0);
const rejected = constituencies.reduce((s, c) => s + c.rejectedBallots, 0);
const totalSeats = constituencies.reduce((s, c) => s + c.seats, 0);
const parties = [...totals.values()]
  .map((t) => ({ ...t, share: t.votes / validVotes, seatShare: t.seats / totalSeats }))
  .sort((a, b) => b.seats - a.seats || b.votes - a.votes);

if (constituencies.length !== 16) fail(`expected 16 constituencies, got ${constituencies.length}`);
if (totalSeats !== 96) fail(`expected 96 seats, got ${totalSeats}`);
const seatsAllocated = parties.reduce((s, p) => s + p.seats, 0);
if (seatsAllocated !== 96) fail(`allocated ${seatsAllocated} seats, expected 96`);

for (const r of nationalRows) {
  const id = VOTE_WALES_NATIONAL_TO_ID[r.party_label];
  const t = [...totals.values()].find((x) => x.partyId === id);
  if (!t) fail(`vote.wales national party "${r.party_label}" not in totals`);
  else if (t.votes !== toInt(r.votes) || t.seats !== toInt(r.seats)) {
    fail(`national ${r.party_label}: computed ${t.votes}/${t.seats}, vote.wales ${r.votes}/${r.seats}`);
  }
}
for (const r of odsTable) {
  const id = RESEARCH_NAME_TO_ID[r['Political Party']];
  const t = [...totals.values()].find((x) => x.partyId === id);
  if (!t || t.votes !== Number(r['2026 Total votes']) || t.seats !== Number(r['2026 Seats won'])) {
    fail(`Senedd Research table ${r['Political Party']}: ${r['2026 Total votes']}/${r['2026 Seats won']} disagrees`);
  }
}
for (const r of odsSeats) {
  const id = RESEARCH_NAME_TO_ID[r['Political party']];
  const t = [...totals.values()].find((x) => x.partyId === id);
  if (!t || t.seats !== Number(r['Seats won'])) fail(`seats_won.ods ${r['Political party']} disagrees`);
}
// National turnout: the briefing reports 51.7% on valid votes.
const turnoutValid = validVotes / electorate;
if (Math.abs(turnoutValid * 100 - 51.7) > 0.05) fail(`national valid-vote turnout ${(turnoutValid * 100).toFixed(2)}% ≠ 51.7%`);

if (failures.length) {
  console.error(`senedd import: ${failures.length} reconciliation failure(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Write

const generatedAt = new Date().toISOString();
const election = {
  id: 'senedd-2026',
  year: 2026,
  date: '2026-05-07',
  name: 'Senedd Cymru general election 2026',
  nation: 'Wales',
  system: 'Closed-list proportional representation (D\'Hondt), six seats per constituency',
  seats: totalSeats,
  manifest: {
    etlVersion: ETL_VERSION,
    generatedAt,
    sources: [
      ...['vote-wales-candidates.csv', 'vote-wales-national.csv'].map((file) => ({
        file, url: VOTE_WALES_BASE,
        publisher: 'Electoral Management Board for Wales',
        title: file === 'vote-wales-candidates.csv' ? 'Official candidate list order and elected status' : 'Official national result summary',
        licence: 'Facts extracted from official results pages; website pages not redistributed.',
        usedFor: file === 'vote-wales-candidates.csv' ? 'Candidate order and original elected status' : 'National party totals reconciliation'
      })),
      {
        file: 'vote-wales-lists.csv',
        url: VOTE_WALES_BASE,
        publisher: 'Electoral Management Board for Wales (vote.wales), from Constituency Returning Officers',
        title: 'Senedd election results by constituency',
        licence:
          'Facts extracted from the official results pages. The pages themselves are not redistributed (EMB website terms).',
        usedFor: 'Ordered party lists, list vote totals, seats won, total valid votes'
      },
      ...COMMITTED_SOURCES.map(({ file, url, publisher, title, licence, usedFor }) => ({
        file,
        url,
        publisher,
        title,
        licence,
        usedFor
      }))
    ].map((source) => ({ ...source, sha256: createHash('sha256').update(readFileSync(resolve(SRC, source.file))).digest('hex') })),
    checks: [
      'List votes in each constituency sum to the published total valid votes (vote.wales and Senedd Research agree)',
      'Statutory D\'Hondt (GoWA 2006 s. 9) reproduces the seats each list won on vote.wales',
      'Seat-by-seat allocation order matches Senedd Research map data for all 96 seats',
      'Elected members in seat order match the Senedd Research briefing',
      'List order matches Democracy Club list positions',
      'National party votes and seats match vote.wales and Senedd Research',
      'Turnout basis recorded explicitly, including discrepancies with the published constituency percentages',
      'No allocation needed a tie-break'
    ]
  },
  national: {
    electorate,
    validVotes,
    rejectedBallots: rejected,
    ballotsAtCount: validVotes + rejected,
    turnoutValid,
    turnoutPublishedPct: 51.7,
    seats: totalSeats,
    parties
  },
  constituencies
};

const catalog = {
  elections: [
    {
      id: election.id,
      year: election.year,
      date: election.date,
      name: election.name,
      href: '/senedd/2026',
      nation: election.nation,
      system: election.system,
      seats: election.seats,
      contests: constituencies.length,
      coverage: `Official results for all ${constituencies.length} constituencies and all ${totalSeats} seats: ordered party lists, list votes, electorate, rejected ballots and the seat-by-seat D'Hondt allocation, reconciled across vote.wales, Senedd Research and Democracy Club.`
    }
  ]
};

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, '2026.json'), JSON.stringify(election, null, 1) + '\n');
writeFileSync(resolve(OUT, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
console.log(
  `senedd import: ${constituencies.length} constituencies, ${totalSeats} seats, ${validVotes.toLocaleString('en-GB')} valid votes — all checks passed`
);
for (const p of parties.filter((p) => p.seats > 0)) {
  console.log(`  ${p.displayName.padEnd(26)} ${String(p.votes).padStart(8)}  ${(p.share * 100).toFixed(1).padStart(5)}%  ${p.seats}`);
}
