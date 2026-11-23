#!/usr/bin/env bun
// Build the 2026 Scottish Parliament results from the files in
// source-data/holyrood/2026/ (downloaded by scripts/fetch-holyrood.mjs).
//
// Source roles (see source-data/holyrood/README.md):
//   EMB workbook   – canonical votes, rejected ballots and seats.
//   SPICe workbook – constituency→region lookup, corrected electorates,
//                    regional list votes counted by constituency.
//   Democracy Club – candidate names, party labels, list order and
//                    which list candidates were elected.
//
// The constituency ballot and the regional ballot are kept apart
// everywhere. Nothing here adds them together.
//
// The importer re-runs the regional list allocation from the votes and
// fails unless it reproduces the published seats, party by party and
// member by member. Every place the sources disagree is written to
// `discrepancies` in the output, with the value we used.
//
// Usage: bun scripts/etl-holyrood.mjs
// Output: src/lib/data/holyrood/2026.json, src/lib/data/holyrood/catalog.json

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { allocateRegion } from './lib/holyrood-dhondt.mjs';
import {
  PARTIES,
  dcParty,
  embParty,
  independentId,
  spiceRegionalParty
} from './lib/holyrood-parties.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'source-data/holyrood/2026');
const OUT = resolve(ROOT, 'src/lib/data/holyrood');
const ETL_VERSION = 'holyrood-etl-1';

const TOTAL_MEMBERS = 129;
const CONSTITUENCY_SEATS = 73;
const REGIONAL_SEATS = 56;
const SEATS_PER_REGION = 7;

const discrepancies = [];
function note(d) {
  discrepancies.push(d);
}
function fail(msg) {
  throw new Error(`[etl-holyrood] ${msg}`);
}

// ---------- readers ----------

function sheet(file, name) {
  const wb = XLSX.read(readFileSync(resolve(SRC, file)));
  const ws = wb.Sheets[name];
  if (!ws) fail(`${file}: missing sheet ${name}`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const clean = (s) => String(s).replace(/\s+/g, ' ').trim();
const slugify = (s) =>
  clean(s)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const nameKey = (s) =>
  clean(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z ]/g, '');

// ---------- load sources ----------

const sources = JSON.parse(readFileSync(resolve(SRC, 'sources.json'), 'utf8')).sources;
for (const source of sources) {
  const bytes = readFileSync(resolve(SRC, source.file));
  if (bytes.length !== source.bytes || createHash('sha256').update(bytes).digest('hex') !== source.sha256)
    fail(`source checksum mismatch: ${source.file}`);
}
const EMB_FILE = 'emb-sp-2026-votes-and-seats.xlsx';
const SPICE_FILE = 'spice-election-2026-tools-data.xlsx';

const embCV = sheet(EMB_FILE, 'Constituency - Votes');
const embCS = sheet(EMB_FILE, 'Constituency - Seats');
const embRV = sheet(EMB_FILE, 'Region - Votes');
const embRS = sheet(EMB_FILE, 'Region - Seats');
const embSummary = sheet(EMB_FILE, 'Summary');
const spiceConst = sheet(SPICE_FILE, 'Tool 3  Constituency data');
const spiceRegional = sheet(SPICE_FILE, 'Tool 4 Regional data');
const dcC = parseCsv(readFileSync(resolve(SRC, 'dc-sp.c.2026-05-07-results.csv'), 'utf8'));
const dcR = parseCsv(readFileSync(resolve(SRC, 'dc-sp.r.2026-05-07-results.csv'), 'utf8'));

// ---------- regions ----------

const REGION_HEADER_ROW = embRV.findIndex((r) => clean(r[0]) === 'Region');
const regionHeaders = embRV[REGION_HEADER_ROW].slice(1, 9).map(clean);
const regions = regionHeaders.map((name) => ({ slug: slugify(name), name }));
if (regions.length !== 8) fail(`expected 8 regions, got ${regions.length}`);
const regionBySlug = new Map(regions.map((r) => [r.slug, r]));
for (const r of dcR) {
  const slug = r.ballot_paper_id.replace(/^sp\.r\./, '').replace(/\.2026-05-07$/, '');
  if (!regionBySlug.has(slug)) fail(`DC region ${slug} not in EMB`);
}

// ---------- constituencies ----------

const cvHeaderIdx = embCV.findIndex((r) => clean(r[0]) === 'Constituency');
const cvHeader = embCV[cvHeaderIdx].map(clean);
const col = (label) => {
  const i = cvHeader.indexOf(label);
  if (i < 0) fail(`EMB constituency sheet missing column ${label}`);
  return i;
};
const COL_ELECTORATE = col('Electorate');
const COL_TOTAL = col('Total Votes');
const COL_REJECTED = col('Rejected Ballot Papers');
const COL_IND = col('Independent Candidates');
const COL_CANDIDATES = col('Total No of Candidates');
const partyCols = [];
for (let i = COL_TOTAL + 1; i < COL_REJECTED; i++) {
  if (!cvHeader[i] || i === COL_IND) continue;
  partyCols.push({ i, partyId: embParty(cvHeader[i]) });
}

const embConst = new Map();
for (const r of embCV.slice(cvHeaderIdx + 1)) {
  const name = clean(r[0]);
  if (!name) continue;
  if (name === 'Total') break;
  embConst.set(name, r);
}
if (embConst.size !== CONSTITUENCY_SEATS) fail(`EMB has ${embConst.size} constituencies`);

const csHeaderIdx = embCS.findIndex((r) => clean(r[0]) === 'Constituency');
const csHeader = embCS[csHeaderIdx].map(clean);
const embWinnerParty = new Map();
for (const r of embCS.slice(csHeaderIdx + 1)) {
  const name = clean(r[0]);
  if (!embConst.has(name)) continue;
  const ticks = r.map((v, i) => (clean(v) ? i : -1)).filter((i) => i >= 2);
  if (ticks.length !== 1) fail(`EMB seats sheet: ${name} has ${ticks.length} winners`);
  const label = csHeader[ticks[0]];
  embWinnerParty.set(name, label === 'Independent Candidates' ? 'independent' : embParty(label));
}

const spiceByConst = new Map();
for (const r of spiceConst.slice(1)) {
  const name = clean(r[2]);
  if (!name) continue;
  if (!spiceByConst.has(name)) spiceByConst.set(name, []);
  spiceByConst.get(name).push(r);
}

const dcByConst = new Map();
for (const r of dcC) {
  const name = clean(r.post_label);
  if (!dcByConst.has(name)) dcByConst.set(name, []);
  dcByConst.get(name).push(r);
}

const constituencyWinnerPersonIds = new Set();
const constituencies = [];
for (const [name, row] of embConst) {
  const spice = spiceByConst.get(name);
  const dc = dcByConst.get(name);
  if (!spice) fail(`SPICe missing constituency ${name}`);
  if (!dc) fail(`Democracy Club missing constituency ${name}`);
  const slug = dc[0].ballot_paper_id.replace(/^sp\.c\./, '').replace(/\.2026-05-07$/, '');
  const regionSlug = slugify(spice[0][3]);
  if (!regionBySlug.has(regionSlug)) fail(`${name}: unknown region ${spice[0][3]}`);
  if (dc.length !== row[COL_CANDIDATES]) fail(`${name}: DC has ${dc.length} candidates, EMB ${row[COL_CANDIDATES]}`);

  // Party candidates: EMB column → exactly one DC candidate.
  const candidates = [];
  const dcInd = dc.filter((d) => d.party_id === 'ynmp-party:2');
  const dcParties = dc.filter((d) => d.party_id !== 'ynmp-party:2');
  const used = new Set();
  for (const { i, partyId } of partyCols) {
    const embVotes = row[i];
    if (embVotes === '' || embVotes == null) continue;
    const matches = dcParties.filter((d) => dcParty(d.party_id) === partyId);
    if (matches.length !== 1) fail(`${name}: ${matches.length} DC candidates for ${partyId}`);
    const d = matches[0];
    used.add(d);
    if (Number(d.votes_cast) !== embVotes) {
      note({
        scope: `constituency:${slug}`,
        field: `votes:${partyId}`,
        used: embVotes,
        usedSource: 'EMB',
        others: [
          { source: 'Democracy Club', value: Number(d.votes_cast) },
          ...spice
            .filter((s) => clean(s[0]) !== 'Independent')
            .filter((s) => s[5] === embVotes)
            .slice(0, 1)
            .map((s) => ({ source: 'SPICe', value: s[5] }))
        ],
        note: 'Democracy Club figure differs from EMB; SPICe agrees with EMB. Treated as a transcription error in the Democracy Club copy.'
      });
    }
    candidates.push({ name: clean(d.person_name), dcPersonId: d.person_id, partyId, votes: embVotes, dcElected: d.elected === 't' });
  }
  if (used.size !== dcParties.length) fail(`${name}: unmatched DC party candidates`);
  const embInd = row[COL_IND] === '' ? 0 : row[COL_IND];
  const dcIndVotes = dcInd.reduce((a, d) => a + Number(d.votes_cast), 0);
  if (dcInd.length === 0 && embInd) fail(`${name}: EMB independents with no DC independent`);
  if (dcIndVotes !== embInd) fail(`${name}: independent votes DC ${dcIndVotes} vs EMB ${embInd}`);
  for (const d of dcInd) {
    candidates.push({
      name: clean(d.person_name),
      dcPersonId: d.person_id,
      partyId: independentId(clean(d.person_name)),
      independent: true,
      votes: Number(d.votes_cast),
      dcElected: d.elected === 't'
    });
  }

  // East Kilbride style party-label disagreements with SPICe.
  for (const c of candidates) {
    const s = spice.find((r) => r[5] === c.votes);
    if (s && !c.independent && clean(s[0]) === 'Independent') {
      note({
        scope: `constituency:${slug}`,
        field: `party:${c.name}`,
        used: c.partyId,
        usedSource: 'EMB and Democracy Club',
        others: [{ source: 'SPICe (14 July 2026 revision)', value: 'Independent' }],
        note: 'EMB and Democracy Club both record this candidate under a party label; the SPICe revision lists them as Independent.'
      });
    }
  }

  candidates.sort((a, b) => b.votes - a.votes);
  const validVotes = candidates.reduce((a, c) => a + c.votes, 0);
  const winner = candidates[0];
  if (candidates[1] && candidates[1].votes === winner.votes) fail(`${name}: tie`);
  if (!winner.dcElected || candidates.filter((c) => c.dcElected).length !== 1)
    fail(`${name}: DC elected flag disagrees with top vote`);
  const embW = embWinnerParty.get(name);
  if (embW !== (winner.independent ? 'independent' : winner.partyId)) fail(`${name}: EMB seat tick disagrees`);
  constituencyWinnerPersonIds.add(winner.dcPersonId);

  const rejected = row[COL_REJECTED];
  if (spice[0][7] !== rejected) fail(`${name}: rejected EMB ${rejected} vs SPICe ${spice[0][7]}`);
  if (Number(dc[0].spoilt_ballots) !== rejected)
    note({ scope: `constituency:${slug}`, field: 'rejected', used: rejected, usedSource: 'EMB', others: [{ source: 'Democracy Club', value: Number(dc[0].spoilt_ballots) }], note: '' });

  const embTotal = row[COL_TOTAL];
  if (embTotal !== validVotes + rejected) {
    note({
      scope: `constituency:${slug}`,
      field: 'ballotsCounted',
      used: validVotes + rejected,
      usedSource: 'EMB candidate votes + EMB rejected ballots',
      others: [{ source: 'EMB "Total Votes" column', value: embTotal }],
      note: 'The EMB total does not equal the sum of its own candidate votes plus rejected ballots. Candidate votes agree across all three sources, so we derive the total from them.'
    });
  }

  const electorateSpice = spice[0][9];
  const electorateEmb = row[COL_ELECTORATE];
  if (electorateSpice !== electorateEmb) {
    note({
      scope: `constituency:${slug}`,
      field: 'electorate',
      used: electorateSpice,
      usedSource: 'SPICe (14 July 2026 revision)',
      others: [
        { source: 'EMB', value: electorateEmb },
        { source: 'Democracy Club', value: Number(dc[0].total_electorate) }
      ],
      note: 'Electorate differs between sources; we use the later SPICe revision.'
    });
  }

  const ballotsCounted = validVotes + rejected;
  constituencies.push({
    slug,
    name,
    regionSlug,
    electorate: electorateSpice,
    validVotes,
    rejected,
    ballotsCounted,
    turnout: ballotsCounted / electorateSpice,
    majority: winner.votes - (candidates[1]?.votes ?? 0),
    winner: { name: winner.name, partyId: winner.partyId },
    candidates: candidates.map((c, idx) => ({
      name: c.name,
      partyId: c.partyId,
      votes: c.votes,
      share: c.votes / validVotes,
      rank: idx + 1,
      elected: idx === 0
    })),
    regionalVote: null
  });
}
constituencies.sort((a, b) => a.name.localeCompare(b.name));
const constBySlug = new Map(constituencies.map((c) => [c.slug, c]));
const constByName = new Map(constituencies.map((c) => [c.name, c]));

// Every constituency belongs to exactly one region; regions hold 8–10.
for (const r of regions) {
  r.constituencySlugs = constituencies.filter((c) => c.regionSlug === r.slug).map((c) => c.slug);
  if (r.constituencySlugs.length < 8 || r.constituencySlugs.length > 10)
    fail(`${r.name} has ${r.constituencySlugs.length} constituencies`);
}

// ---------- regional votes ----------

const dcRByRegion = new Map();
for (const r of dcR) {
  const slug = r.ballot_paper_id.replace(/^sp\.r\./, '').replace(/\.2026-05-07$/, '');
  if (!dcRByRegion.has(slug)) dcRByRegion.set(slug, []);
  dcRByRegion.get(slug).push(r);
}

const individualNames = new Map(); // id -> name
function matchRegionalIndependent(embLabel, regionSlug) {
  const [surname, forenames] = embLabel.split(',').map((s) => nameKey(s));
  const first = forenames.split(' ')[0];
  const pool = (dcRByRegion.get(regionSlug) ?? []).filter((d) => d.party_id === 'ynmp-party:2');
  // Match on words, not order: DC writes "Bonnie Prince Bob" for EMB's
  // "BONNIE PRINCE, Bob".
  const hits = pool.filter((d) => {
    const words = new Set(nameKey(d.person_name).split(' '));
    return surname.split(' ').every((w) => words.has(w)) && words.has(first);
  });
  if (hits.length !== 1) fail(`regional independent ${embLabel} in ${regionSlug}: ${hits.length} DC matches`);
  return clean(hits[0].person_name);
}

const regionVotes = new Map(regions.map((r) => [r.slug, new Map()])); // slug -> id -> votes
let section = 'parties';
let regionRejected = null;
let regionTotalRow = null;
let regionElectorateRow = null;
for (const r of embRV.slice(REGION_HEADER_ROW + 1)) {
  const label = clean(r[0]);
  if (!label) continue;
  if (label === 'Registered Parties') continue;
  if (label === 'Individual Candidates') {
    section = 'individuals';
    continue;
  }
  if (label === 'Rejected ballot papers') {
    regionRejected = r;
    continue;
  }
  if (label === 'Total') {
    regionTotalRow = r;
    continue;
  }
  if (label === 'Electorate') {
    regionElectorateRow = r;
    continue;
  }
  if (/turnout|rejected papers/i.test(label)) continue;
  regions.forEach((reg, k) => {
    const v = r[k + 1];
    if (v === '' || v == null) return;
    let id;
    if (section === 'parties') id = embParty(label);
    else {
      const name = matchRegionalIndependent(label, reg.slug);
      id = independentId(name);
      individualNames.set(id, name);
    }
    const m = regionVotes.get(reg.slug);
    m.set(id, (m.get(id) ?? 0) + v);
  });
}
if (!regionRejected || !regionTotalRow || !regionElectorateRow) fail('EMB region sheet: missing totals rows');

// ---------- regional seats (EMB) ----------

const rsHeaderIdx = embRS.findIndex((r) => clean(r[0]) === 'Region');
const embRegionSeats = new Map(regions.map((r) => [r.slug, new Map()]));
for (const r of embRS.slice(rsHeaderIdx + 1)) {
  const label = clean(r[0]);
  if (!label || label === 'Registered Parties' || label === 'Individual Candidates' || label === 'Total') continue;
  regions.forEach((reg, k) => {
    const v = r[k + 1];
    if (!v) return;
    if (label.includes(',')) fail(`EMB says individual ${label} won a list seat; not handled`);
    const id = embParty(label);
    const m = embRegionSeats.get(reg.slug);
    m.set(id, (m.get(id) ?? 0) + v);
  });
}

// ---------- allocation + list members ----------

const allMembers = [];
for (const c of constituencies) {
  allMembers.push({
    name: c.winner.name,
    partyId: c.winner.partyId,
    seatType: 'constituency',
    constituencySlug: c.slug,
    regionSlug: c.regionSlug,
    listPosition: null
  });
}

regions.forEach((reg, k) => {
  const votes = regionVotes.get(reg.slug);
  const validVotes = [...votes.values()].reduce((a, b) => a + b, 0);
  const rejected = regionRejected[k + 1];
  const embTotal = regionTotalRow[k + 1];
  const constSeats = new Map();
  for (const slug of reg.constituencySlugs) {
    const w = constBySlug.get(slug).winner.partyId;
    constSeats.set(w, (constSeats.get(w) ?? 0) + 1);
  }
  const contestants = [...votes.entries()].map(([id, v]) => ({
    id,
    votes: v,
    constituencySeats: constSeats.get(id) ?? 0,
    individual: id.startsWith('ind-')
  }));
  // Party lists in order, with constituency winners skipped.
  const dcRows = dcRByRegion.get(reg.slug);
  const lists = new Map();
  for (const d of dcRows) {
    if (d.party_id === 'ynmp-party:2') continue;
    const pid = dcParty(d.party_id);
    if (!lists.has(pid)) lists.set(pid, []);
    lists.get(pid).push({
      name: clean(d.person_name),
      dcPersonId: d.person_id,
      position: Number(d.party_list_position),
      dcElected: d.elected === 't'
    });
  }
  for (const [pid, list] of lists) {
    // Democracy Club leaves the position blank on some one-person lists.
    // A one-person list has only one possible order.
    if (list.length === 1 && !list[0].position) list[0].position = 1;
    list.sort((a, b) => a.position - b.position);
    list.forEach((c, i) => {
      if (c.position !== i + 1) fail(`${reg.name} ${pid}: list positions not contiguous`);
    });
  }

  for (const c of contestants) {
    if (!c.individual) c.listCapacity = (lists.get(c.id) ?? [])
      .filter((candidate) => !constituencyWinnerPersonIds.has(candidate.dcPersonId)).length;
  }
  const { rounds, listSeats } = allocateRegion(contestants, SEATS_PER_REGION);

  // Must reproduce EMB's published regional seats exactly.
  const emb = embRegionSeats.get(reg.slug);
  const ids = new Set([...emb.keys(), ...Object.keys(listSeats).filter((id) => listSeats[id] > 0)]);
  for (const id of ids) {
    if ((emb.get(id) ?? 0) !== (listSeats[id] ?? 0))
      fail(`${reg.name}: recomputed ${id} list seats ${listSeats[id] ?? 0} vs EMB ${emb.get(id) ?? 0}`);
  }

  const elected = new Set();
  const members = [];
  for (const round of rounds) {
    const pid = round.winner;
    let member;
    if (pid.startsWith('ind-')) {
      member = { name: individualNames.get(pid), partyId: pid, listPosition: null };
    } else {
      const list = lists.get(pid);
      if (!list) fail(`${reg.name}: ${pid} won a seat but has no list in Democracy Club`);
      const next = list.find((c) => !constituencyWinnerPersonIds.has(c.dcPersonId) && !elected.has(c.dcPersonId));
      if (!next) fail(`${reg.name}: ${pid} list exhausted`);
      elected.add(next.dcPersonId);
      member = { name: next.name, partyId: pid, listPosition: next.position };
    }
    round.memberName = member.name;
    members.push({ ...member, round: round.round });
  }

  // Must match Democracy Club's elected list members exactly.
  const dcElected = new Set(dcRows.filter((d) => d.elected === 't').map((d) => clean(d.person_name)));
  const ours = new Set(members.map((m) => m.name));
  if (dcElected.size !== SEATS_PER_REGION || [...ours].some((n) => !dcElected.has(n)))
    fail(`${reg.name}: derived list members [${[...ours]}] vs DC [${[...dcElected]}]`);

  for (const m of members) {
    allMembers.push({
      name: m.name,
      partyId: m.partyId,
      seatType: 'regional',
      constituencySlug: null,
      regionSlug: reg.slug,
      listPosition: m.listPosition
    });
  }

  // Regional electorate: same register as the constituency ballot.
  const electorate = reg.constituencySlugs.reduce((a, s) => a + constBySlug.get(s).electorate, 0);
  if (electorate !== regionElectorateRow[k + 1]) {
    note({
      scope: `region:${reg.slug}`,
      field: 'electorate',
      used: electorate,
      usedSource: 'Sum of SPICe constituency electorates',
      others: [{ source: 'EMB region sheet', value: regionElectorateRow[k + 1] }],
      note: 'Follows the constituency electorate revisions noted above.'
    });
  }
  if (embTotal !== validVotes + rejected && embTotal !== validVotes) {
    fail(`${reg.name}: EMB total ${embTotal} matches neither valid ${validVotes} nor valid+rejected`);
  }
  if (embTotal === validVotes) {
    note({
      scope: `region:${reg.slug}`,
      field: 'ballotsCounted',
      used: validVotes + rejected,
      usedSource: 'EMB party votes + EMB rejected ballots',
      others: [{ source: 'EMB "Total" row', value: embTotal }],
      note: 'EMB total row equals valid votes only.'
    });
  }

  const ballotsCounted = validVotes + rejected;
  const parties = contestants
    .map((c) => ({
      partyId: c.id,
      votes: c.votes,
      share: c.votes / validVotes,
      constituencySeats: c.constituencySeats,
      regionalSeats: listSeats[c.id] ?? 0
    }))
    .sort((a, b) => b.votes - a.votes);
  // Parties that won constituency seats but stood no regional list
  // (none in 2026, but keep the seat count whole if it happens).
  for (const [pid, n] of constSeats) {
    if (!parties.some((p) => p.partyId === pid))
      parties.push({ partyId: pid, votes: 0, share: 0, constituencySeats: n, regionalSeats: 0 });
  }

  Object.assign(reg, {
    electorate,
    validVotes,
    rejected,
    ballotsCounted,
    turnout: ballotsCounted / electorate,
    parties,
    allocation: rounds.map((r) => ({
      round: r.round,
      winner: r.winner,
      memberName: r.memberName,
      figures: r.figures
    })),
    members,
    lists: [...lists.entries()]
      .map(([partyId, list]) => ({
        partyId,
        candidates: list.map((c) => {
          const wonConst = constituencyWinnerPersonIds.has(c.dcPersonId);
          const constituency = wonConst
            ? constituencies.find((k2) => k2.winner.name === c.name && k2.winner.partyId === partyId)?.slug ?? null
            : null;
          return {
            name: c.name,
            position: c.position,
            outcome: elected.has(c.dcPersonId) ? 'regional' : wonConst ? 'constituency' : 'not-elected',
            constituencySlug: constituency
          };
        })
      }))
      .sort((a, b) => (votes.get(b.partyId) ?? 0) - (votes.get(a.partyId) ?? 0)),
    individualCandidates: contestants
      .filter((c) => c.individual)
      .map((c) => ({ partyId: c.id, name: individualNames.get(c.id), votes: c.votes }))
  });
});

// ---------- SPICe regional votes by constituency ----------

const spiceRegByConst = new Map();
for (const r of spiceRegional.slice(1)) {
  if (r[0] !== 2026) continue;
  const name = clean(r[1]);
  const c = constByName.get(name);
  if (!c) fail(`SPICe regional data: unknown constituency ${name}`);
  let id;
  const label = clean(r[3]);
  if (label.startsWith('Independent - ')) {
    const raw = label.slice('Independent - '.length);
    const regionInds = regions.find((g) => g.slug === c.regionSlug).individualCandidates;
    // SPICe writes "Boulton, Marie", "Jeremy Ross Balfour" or "Bob Bonnie
    // Prince"; match when every word of the DC name appears.
    const words = new Set(nameKey(raw.replace(',', ' ')).split(' ').filter(Boolean));
    const hit = regionInds.find((i) => nameKey(i.name).split(' ').every((w) => words.has(w)));
    if (!hit) fail(`SPICe regional independent ${label} not found in ${c.regionSlug}`);
    id = hit.partyId;
  } else id = spiceRegionalParty(label);
  if (!spiceRegByConst.has(c.slug)) spiceRegByConst.set(c.slug, new Map());
  const m = spiceRegByConst.get(c.slug);
  m.set(id, (m.get(id) ?? 0) + r[4]);
}
for (const reg of regions) {
  const sums = new Map();
  for (const s of reg.constituencySlugs) {
    for (const [id, v] of spiceRegByConst.get(s) ?? []) sums.set(id, (sums.get(id) ?? 0) + v);
  }
  const mismatches = reg.parties.filter((p) => (sums.get(p.partyId) ?? 0) !== p.votes);
  reg.regionalVoteByConstituencyReconciles = mismatches.length === 0;
  for (const p of mismatches) {
    note({
      scope: `region:${reg.slug}`,
      field: `regionalVoteByConstituency:${p.partyId}`,
      used: p.votes,
      usedSource: 'EMB regional total',
      others: [{ source: 'Sum of SPICe constituency-level regional votes', value: sums.get(p.partyId) ?? 0 }],
      note: 'Constituency-level breakdown of the regional vote does not add up to the official regional total.'
    });
  }
}
for (const c of constituencies) {
  const m = spiceRegByConst.get(c.slug);
  if (!m) continue;
  const valid = [...m.values()].reduce((a, b) => a + b, 0);
  c.regionalVote = {
    validVotes: valid,
    parties: [...m.entries()]
      .map(([partyId, votes]) => ({ partyId, votes, share: votes / valid }))
      .sort((a, b) => b.votes - a.votes)
  };
}

// ---------- national totals ----------

function nationalBallot(kind) {
  const totals = new Map();
  let valid = 0;
  let rejected = 0;
  let electorate = 0;
  if (kind === 'constituency') {
    for (const c of constituencies) {
      valid += c.validVotes;
      rejected += c.rejected;
      electorate += c.electorate;
      for (const cand of c.candidates) {
        const t = totals.get(cand.partyId) ?? { votes: 0, seats: 0 };
        t.votes += cand.votes;
        t.seats += cand.elected ? 1 : 0;
        totals.set(cand.partyId, t);
      }
    }
  } else {
    for (const r of regions) {
      valid += r.validVotes;
      rejected += r.rejected;
      electorate += r.electorate;
      for (const p of r.parties) {
        const t = totals.get(p.partyId) ?? { votes: 0, seats: 0 };
        t.votes += p.votes;
        t.seats += p.regionalSeats;
        totals.set(p.partyId, t);
      }
    }
  }
  return {
    electorate,
    validVotes: valid,
    rejected,
    ballotsCounted: valid + rejected,
    turnout: (valid + rejected) / electorate,
    parties: [...totals.entries()]
      .map(([partyId, t]) => ({ partyId, votes: t.votes, share: t.votes / valid, seats: t.seats }))
      .sort((a, b) => b.votes - a.votes)
  };
}
const constituencyVote = nationalBallot('constituency');
const regionalVote = nationalBallot('regional');

// Cross-check with the EMB Summary sheet (votes and seats per major party).
const sumHeader = embSummary.findIndex((r) => clean(r[0]) === 'Party');
for (const r of embSummary.slice(sumHeader + 1)) {
  const label = clean(r[0]);
  if (!label || label === 'Total' || label.startsWith('Others')) {
    if (label === 'Total') {
      if (r[1] !== constituencyVote.validVotes) fail(`EMB summary constituency valid ${r[1]} vs ${constituencyVote.validVotes}`);
      if (r[6] !== regionalVote.validVotes) {
        note({
          scope: 'national',
          field: 'regionalValidVotes',
          used: regionalVote.validVotes,
          usedSource: 'Sum of EMB regional party and individual votes',
          others: [{ source: 'EMB Summary "Total" (regional)', value: r[6] }],
          note: 'The EMB summary regional total equals valid votes plus rejected ballots, although the sheet labels it as valid votes.'
        });
      }
      if (r[3] !== CONSTITUENCY_SEATS || r[8] !== REGIONAL_SEATS) fail('EMB summary seat totals');
      break;
    }
    continue;
  }
  const id = embParty(label);
  const cv = constituencyVote.parties.find((p) => p.partyId === id);
  const rv = regionalVote.parties.find((p) => p.partyId === id);
  if (cv?.votes !== r[1] || cv?.seats !== r[3]) fail(`EMB summary constituency mismatch for ${id}`);
  if (rv?.votes !== r[6] || rv?.seats !== r[8]) fail(`EMB summary regional mismatch for ${id}`);
}

if (allMembers.length !== TOTAL_MEMBERS) fail(`members ${allMembers.length}`);

const seatTotals = new Map();
for (const m of allMembers) {
  const t = seatTotals.get(m.partyId) ?? { constituency: 0, regional: 0 };
  t[m.seatType] += 1;
  seatTotals.set(m.partyId, t);
}
const seats = [...seatTotals.entries()]
  .map(([partyId, t]) => ({ partyId, constituency: t.constituency, regional: t.regional, total: t.constituency + t.regional }))
  .sort((a, b) => b.total - a.total || b.constituency - a.constituency);

// ---------- party table ----------

const usedIds = new Set();
for (const c of constituencies) for (const cand of c.candidates) usedIds.add(cand.partyId);
for (const r of regions) for (const p of r.parties) usedIds.add(p.partyId);
const independentNames = new Map(individualNames);
for (const c of constituencies)
  for (const cand of c.candidates) if (cand.partyId.startsWith('ind-')) independentNames.set(cand.partyId, cand.name);
const parties = [
  ...PARTIES.filter((p) => usedIds.has(p.id)).map((p) => ({ ...p, kind: 'party' })),
  ...[...independentNames.entries()]
    .filter(([id]) => usedIds.has(id))
    .map(([id, name]) => ({ id, name: `${name} (Independent)`, shortName: 'Independent', color: '#888888', kind: 'individual' }))
];
for (const id of usedIds) if (!parties.some((p) => p.id === id)) fail(`no party record for ${id}`);

// ---------- write ----------

const out = {
  id: 'sp-2026',
  year: 2026,
  date: '2026-05-07',
  name: 'Scottish Parliament election 2026',
  nation: 'scotland',
  system: 'Additional Member System',
  boundaries:
    'Constituencies and regions from the Second Review of Scottish Parliament Boundaries, first used in 2026.',
  asElected: 'Members as declared on 7–8 May 2026. Later resignations and list replacements are not reflected.',
  generatedAt: new Date().toISOString(),
  etlVersion: ETL_VERSION,
  sources: sources.map(({ file, url, landingPage, publisher, title, role, licence, retrievedAt, sha256 }) => ({
    file,
    url,
    landingPage,
    publisher,
    title,
    role,
    licence,
    retrievedAt: retrievedAt.slice(0, 10),
    sha256
  })),
  members: { total: TOTAL_MEMBERS, constituency: CONSTITUENCY_SEATS, regional: REGIONAL_SEATS, seatsPerRegion: SEATS_PER_REGION },
  parties,
  seats,
  constituencyVote,
  regionalVote,
  regions,
  constituencies,
  msps: allMembers,
  discrepancies
};

mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, '2026.json'), JSON.stringify(out) + '\n');

const catalog = {
  elections: [
    {
      id: out.id,
      year: out.year,
      date: out.date,
      name: out.name,
      href: '/holyrood/2026',
      nation: 'scotland',
      system: 'Additional Member System (73 constituency MSPs by first past the post; 56 regional MSPs by compensatory D’Hondt list)',
      seats: TOTAL_MEMBERS,
      contests: constituencies.length + regions.length,
      coverage: `Complete: all ${constituencies.length} constituency results and all ${regions.length} regional list results, ${allMembers.length} of ${TOTAL_MEMBERS} MSPs as declared.`
    }
  ]
};
writeFileSync(resolve(OUT, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');

console.log(
  `[etl-holyrood] ${constituencies.length} constituencies, ${regions.length} regions, ${allMembers.length} MSPs, ${discrepancies.length} discrepancies logged`
);
console.log(seats.map((s) => `${s.partyId} ${s.constituency}+${s.regional}=${s.total}`).join(' · '));
