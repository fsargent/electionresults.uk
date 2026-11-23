#!/usr/bin/env bun
// Download the original source files for the 2026 Scottish Parliament
// election into source-data/holyrood/2026/ and record their checksums.
//
// We keep the files exactly as published. The importer
// (scripts/etl-holyrood.mjs) reads only these local copies, so a build
// never depends on the network.
//
// Usage: bun scripts/fetch-holyrood.mjs
// Output: source-data/holyrood/2026/<file> + sources.json

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'source-data/holyrood/2026');

export const SOURCES = [
  {
    file: 'emb-sp-2026-votes-and-seats.xlsx',
    url: 'https://www.emb.scot/downloads/file/1201/full-analysis-of-2026-results',
    landingPage: 'https://www.emb.scot/news/article/70/scottish-parliament-2026-results',
    publisher: 'Electoral Management Board for Scotland',
    title: 'Scottish Parliament Election 7 May 2026: Votes and Seats by Party/Individual Candidate (SP_2026___Votes_and_Seats.xlsx)',
    role: 'Canonical constituency votes, regional list votes, rejected ballots, seats by party and region.',
    licence:
      'Official election results published by the Electoral Management Board for Scotland. No licence is stated on the download page; reused here as public election results with attribution.'
  },
  {
    file: 'spice-election-2026-tools-data.xlsx',
    url: 'https://spice-spotlight.scot/wp-content/uploads/2026/05/Election-2026-tools-data-2.xlsx',
    landingPage: 'https://spice-spotlight.scot/2026/05/28/election-2026-results-in-full/',
    publisher: 'Scottish Parliament Information Centre (SPICe)',
    title: 'Election 2026 – tools data (updated 14 July 2026)',
    role: 'Constituency-to-region lookup on the 2026 boundaries, corrected electorates, and regional list votes counted by constituency.',
    licence:
      'Contains information licensed under the Scottish Parliament Copyright Licence. Scottish Parliamentary Corporate Body copyright. https://www.parliament.scot/about/copyright'
  },
  {
    file: 'dc-sp.c.2026-05-07-results.csv',
    url: 'https://candidates.democracyclub.org.uk/data/export_csv/?election_id=sp.c.2026-05-07&field_group=results&format=csv',
    landingPage: 'https://candidates.democracyclub.org.uk/elections/sp.c.2026-05-07/',
    publisher: 'Democracy Club',
    title: 'Scottish Parliament constituency candidates and results, 7 May 2026',
    role: 'Constituency candidate names and party labels. Votes are cross-checked against EMB.',
    licence: 'CC BY 4.0'
  },
  {
    file: 'dc-sp.r.2026-05-07-results.csv',
    url: 'https://candidates.democracyclub.org.uk/data/export_csv/?election_id=sp.r.2026-05-07&field_group=results&extra_fields=party_list_position&format=csv',
    landingPage: 'https://candidates.democracyclub.org.uk/elections/sp.r.2026-05-07/',
    publisher: 'Democracy Club',
    title: 'Scottish Parliament regional list candidates, list positions and elected members, 7 May 2026',
    role: 'Regional list candidates in party list order, independent regional candidates, and which list candidates were elected.',
    licence: 'CC BY 4.0'
  }
];

if (import.meta.main) {
  mkdirSync(OUT_DIR, { recursive: true });
  const retrievedAt = new Date().toISOString();
  const manifest = [];
  for (const s of SOURCES) {
    const res = await fetch(s.url, { headers: { 'user-agent': 'electionresults.uk data import' } });
    if (!res.ok) {
      console.error(`[fetch-holyrood] ${res.status} ${res.statusText} from ${s.url}`);
      process.exit(1);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(resolve(OUT_DIR, s.file), buf);
    const sha256 = createHash('sha256').update(buf).digest('hex');
    manifest.push({ ...s, retrievedAt, bytes: buf.length, sha256 });
    console.log(`[fetch-holyrood] ${s.file} ${buf.length} bytes ${sha256.slice(0, 12)}`);
  }
  writeFileSync(resolve(OUT_DIR, 'sources.json'), JSON.stringify({ sources: manifest }, null, 2) + '\n');
}
