#!/usr/bin/env bun
// Download the local by-elections held after the 2026 polling day from
// Democracy Club and save them under source-data/council/.
//
// Democracy Club's CSV export filters on one exact election date, not a
// range. So this script downloads the full local results export (about
// 50 MB, every local ballot since 2016) and keeps only the rows we use:
//   - by-election ballots (`.by.` in ballot_paper_id)
//   - held after AFTER_DATE and on or before today
//
// The kept rows are byte-for-byte the rows Democracy Club published,
// with the same header. Only the row filter is ours.
//
// Usage: bun scripts/fetch-dc-by-elections.mjs
// Output: source-data/council/dc-by-elections-after-<AFTER_DATE>-<stamp>.csv

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const AFTER_DATE = '2026-05-07';
const URL =
  'https://candidates.democracyclub.org.uk/data/export_csv/' +
  '?election_id=local&field_group=results&format=csv';

// Split a CSV document into raw records (strings), keeping quoted
// newlines inside a record. We keep the raw text so the output rows
// match the published bytes.
function splitRecords(text) {
  const out = [];
  let start = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === '\n' && !inQuotes) {
      out.push(text.slice(start, i).replace(/\r$/, ''));
      start = i + 1;
    }
  }
  if (start < text.length) out.push(text.slice(start).replace(/\r$/, ''));
  return out.filter((r) => r.length > 0);
}

// Split one CSV record into field values (RFC 4180 quoting).
function splitFields(rec) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < rec.length; i++) {
    const ch = rec[i];
    if (inQuotes) {
      if (ch === '"' && rec[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const res = await fetch(URL);
if (!res.ok) {
  console.error(`[fetch-dc-by-elections] ${res.status} ${res.statusText} from ${URL}`);
  process.exit(1);
}
const records = splitRecords(await res.text());
const header = records[0];
const cols = splitFields(header);
const ballotIdx = cols.indexOf('ballot_paper_id');
const dateIdx = cols.indexOf('election_date');
if (ballotIdx < 0 || dateIdx < 0) {
  console.error('[fetch-dc-by-elections] export header is missing ballot_paper_id or election_date');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const kept = [];
for (const rec of records.slice(1)) {
  const f = splitFields(rec);
  const ballot = f[ballotIdx] ?? '';
  const date = f[dateIdx] ?? '';
  if (!/\.by\./.test(ballot)) continue;
  if (date <= AFTER_DATE || date > today) continue;
  kept.push(rec);
}

const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
const out = resolve(ROOT, `source-data/council/dc-by-elections-after-${AFTER_DATE}-${stamp}.csv`);
writeFileSync(out, [header, ...kept].join('\n') + '\n');
const ballots = new Set(kept.map((r) => splitFields(r)[ballotIdx]));
console.log(
  `[fetch-dc-by-elections] kept ${kept.length} candidacies in ${ballots.size} by-elections ` +
    `(${AFTER_DATE} < date <= ${today}) → ${out}`
);
