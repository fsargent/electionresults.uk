#!/usr/bin/env bun
// Download every 2026 Senedd source into source-data/senedd/2026/.
//
//   bun scripts/senedd/fetch-2026.mjs            # refresh everything
//   bun scripts/senedd/fetch-2026.mjs --vote-wales  # vote.wales pages only
//
// Committed sources (Senedd Research files, Democracy Club CSV) are
// overwritten in place so `git diff` shows any upstream revision.
// vote.wales pages go to vote-wales-cache/, which is git-ignored: the
// importer extracts the published figures from them into the committed
// vote-wales-lists.csv.
//
// The briefing PDF is converted to text with poppler's `pdftotext
// -layout` (committed alongside so the importer runs without poppler).

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  COMMITTED_SOURCES,
  SOURCE_DIR,
  VOTE_WALES_BASE,
  VOTE_WALES_SLUGS
} from './sources-2026.mjs';

const UA = 'electionresults.uk data refresh (+https://electionresults.uk)';
const root = resolve(process.cwd(), SOURCE_DIR);
const cache = resolve(root, 'vote-wales-cache');
mkdirSync(cache, { recursive: true });

async function download(url, dest) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  console.log(`  ${buf.length.toString().padStart(8)} B  ${dest.replace(process.cwd() + '/', '')}`);
}

const onlyVoteWales = process.argv.includes('--vote-wales');

console.log('vote.wales results pages');
await download(VOTE_WALES_BASE, resolve(cache, 'national.html'));
for (const slug of VOTE_WALES_SLUGS) {
  await download(`${VOTE_WALES_BASE}${slug}/`, resolve(cache, `${slug}.html`));
}

if (!onlyVoteWales) {
  console.log('Committed sources');
  for (const s of COMMITTED_SOURCES) await download(s.url, resolve(root, s.file));
  const pdf = resolve(root, 'senedd-research-briefing-senedd-election-2026.pdf');
  const txt = pdf.replace(/\.pdf$/, '.txt');
  const r = spawnSync('pdftotext', ['-layout', pdf, txt], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.warn('pdftotext failed or is missing; the committed .txt was left unchanged');
  }
}
console.log('Done. Now run: bun scripts/senedd/import-2026.mjs');
