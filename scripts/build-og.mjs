#!/usr/bin/env node
//
// Generate per-council Open Graph images for social-share previews.
//
// One PNG per (council, year) cycle plus one "latest" alias per council:
//   static/og/<councilSlug>-<year>.png   — specific cycle
//   static/og/<councilSlug>.png          — most recent cycle
//
// Each image (1200×630, the standard OG aspect) shows the same
// vote-share-vs-seats-won chart that lives on the per-council page:
// a top bar of vote shares, then the FPTP seat grid, then the
// D'Hondt proportional seat grid. The visual divergence between the
// bar and the FPTP grid is the editorial point — the same point the
// social card carries when someone shares the URL.
//
// SVG is composed by hand and rasterised through sharp. No headless
// browser, no font downloads — everything renders with system fonts,
// which sharp's librsvg backend resolves via fontconfig.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SNAPSHOT_PATH = resolve(ROOT, 'src/lib/data/generated.json');
const OUT_DIR = resolve(ROOT, 'static/og');

// --- Party colours ---------------------------------------------------------
//
// Mirror src/lib/party-colors.ts so the OG card matches the on-site
// chart. Keep in sync — there's no shared module because this script
// runs at build time outside the SvelteKit graph.

const PARTY_COLORS = {
  'Conservative Party': '#0087DC',
  'Conservative and Unionist Party': '#0087DC',
  'Labour Party': '#E4003B',
  'Labour and Co-operative Party': '#E4003B',
  'Liberal Democrats': '#FAA61A',
  'The Liberal Party': '#FFB100',
  'Green Party': '#6AB023',
  'Reform UK': '#12B6CF',
  'UK Independence Party (UKIP)': '#70147A',
  'Social Democratic Party': '#5784D7',
  Independent: '#888888',
  'Independent / Other': '#A0A0A0',
  Other: '#999999',
  'Ashfield Independents': '#B8860B',
  'Mebyon Kernow - The Party for Cornwall': '#F7D038',
  'Trade Unionist and Socialist Coalition': '#C41E3A',
  'Workers Party of Britain': '#C41E3A',
  Aspire: '#7B2D8E'
};

function partyColor(name) {
  if (PARTY_COLORS[name]) return PARTY_COLORS[name];
  // Heuristic fallbacks for the long tail; keeps the OG card from
  // ever painting an unknown party as missing/black.
  const lower = String(name).toLowerCase();
  if (lower.includes('independent')) return '#888888';
  if (lower.includes('green')) return '#6AB023';
  return '#777777';
}

// --- Layout ----------------------------------------------------------------

const W = 1200;
const H = 630;
const PADDING = 56;
const TITLE_FONT = 'Georgia, "Times New Roman", serif';
const BODY_FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif';
// Mirror src/lib/styles/global.css so the OG card and the on-site
// chart share the same palette. Keep in sync; no shared module
// because this script runs at build time outside the SvelteKit graph.
const FG = '#1a1a1a'; // --fg
const MUTED = '#5a5a5a'; // --muted
const BG = '#f6f5ee'; // --bg
const RULE = '#d8d4c4'; // --rule

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Vote-share row: a horizontal stacked bar segmented by party share.
 * Same data the on-site PartyBars component renders.
 */
function renderVoteShareBar(rows, total, x, y, width, height) {
  if (total <= 0 || rows.length === 0) return '';
  let cursor = x;
  let parts = '';
  for (const r of rows) {
    if (r.votes <= 0) continue;
    const w = (r.votes / total) * width;
    parts += `<rect x="${cursor}" y="${y}" width="${w}" height="${height}" fill="${partyColor(r.party)}" />`;
    cursor += w;
  }
  return parts;
}

/**
 * Seat grid: one square per seat, coloured by the party that won it.
 * Squares wrap into rows so the grid fits the available width.
 * Sized so a typical 50-seat council fills two rows comfortably.
 */
function renderSeatGrid(seatSegments, x, y, width, totalSeats) {
  if (totalSeats <= 0) return { svg: '', height: 0 };
  // Flatten into one slot per seat (in sorted order, biggest party first
  // matching the sort that comes out of the partyView).
  const seats = [];
  for (const s of seatSegments) {
    for (let i = 0; i < s.seats; i++) seats.push(s.party);
  }
  // Pick a square size that lets the row fit horizontally without
  // squeezing for very large councils (Birmingham, Wakefield).
  const gap = 3;
  // Aim for ~24 seats per row on a 1200-wide canvas; clamp by available
  // width so very large councils stay legible.
  const targetCols = Math.min(seats.length, 28);
  let size = Math.floor((width - (targetCols - 1) * gap) / targetCols);
  size = Math.max(12, Math.min(28, size));
  const cols = Math.max(1, Math.floor((width + gap) / (size + gap)));
  let parts = '';
  for (let i = 0; i < seats.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const px = x + col * (size + gap);
    const py = y + row * (size + gap);
    parts += `<rect x="${px}" y="${py}" width="${size}" height="${size}" rx="2" fill="${partyColor(seats[i])}" />`;
  }
  const rowsUsed = Math.ceil(seats.length / cols);
  return { svg: parts, height: rowsUsed * (size + gap) - gap };
}

/**
 * The on-site card uses three rows: vote share / actual seats /
 * proportional seats. Same here. Headline gives the council name +
 * year; sub-line states the seat-vs-vote disparity in plain English.
 */
function buildSvg({ council, year, view, reallocated, reallocatedShare }) {
  const sortedRows = [...view.rows].sort((a, b) => b.voteShare - a.voteShare);
  const fptpSegments = sortedRows
    .filter((r) => r.fptpSeats > 0)
    .map((r) => ({ party: r.party, seats: r.fptpSeats }));
  const dhondtSegments = sortedRows
    .filter((r) => r.dhondtSeats > 0)
    .map((r) => ({ party: r.party, seats: r.dhondtSeats }));

  const innerWidth = W - PADDING * 2;
  const labelGap = 18;
  const labelFontSize = 18;
  const headingFontSize = 44;
  const subheadingFontSize = 22;

  // y cursor walks down the canvas.
  let y = PADDING;
  const heading = `${council}, ${year}`;
  const subheading =
    reallocatedShare > 0
      ? `${reallocated} of ${view.totalSeats} seats unfairly awarded by FPTP — ${(reallocatedShare * 100).toFixed(1)}% of the cycle`
      : `${view.totalSeats} seats elected — FPTP allocation matched the proportional benchmark`;

  let parts = '';
  parts += `<rect width="${W}" height="${H}" fill="${BG}" />`;

  // Heading + subheading (top-left).
  parts += `<text x="${PADDING}" y="${y + headingFontSize - 6}" font-family="${escapeXml(
    TITLE_FONT
  )}" font-size="${headingFontSize}" font-weight="700" fill="${FG}">${escapeXml(
    heading
  )}</text>`;
  y += headingFontSize + 12;
  parts += `<text x="${PADDING}" y="${y + subheadingFontSize - 4}" font-family="${escapeXml(
    BODY_FONT
  )}" font-size="${subheadingFontSize}" fill="${MUTED}">${escapeXml(
    subheading
  )}</text>`;
  y += subheadingFontSize + 32;

  // Three rows: vote share bar / FPTP seats / proportional seats.
  const labels = [
    { text: 'Vote share' },
    { text: 'FPTP seats' },
    { text: 'Proportional seats' }
  ];
  const labelWidth = 230;
  const dataX = PADDING + labelWidth;
  const dataWidth = innerWidth - labelWidth;
  const rowGap = 28;

  // Vote share bar.
  const barHeight = 32;
  parts += `<text x="${PADDING}" y="${y + barHeight / 2 + 5}" font-family="${escapeXml(
    BODY_FONT
  )}" font-size="${labelFontSize}" font-weight="600" fill="${MUTED}">${labels[0].text.toUpperCase()}</text>`;
  parts += renderVoteShareBar(sortedRows, view.totalVotes, dataX, y, dataWidth, barHeight);
  parts += `<rect x="${dataX}" y="${y}" width="${dataWidth}" height="${barHeight}" fill="none" stroke="${RULE}" stroke-width="1" />`;
  y += barHeight + rowGap;

  // FPTP seats.
  const fptpGrid = renderSeatGrid(fptpSegments, dataX, y, dataWidth, view.totalSeats);
  parts += `<text x="${PADDING}" y="${y + 20}" font-family="${escapeXml(
    BODY_FONT
  )}" font-size="${labelFontSize}" font-weight="600" fill="${MUTED}">${labels[1].text.toUpperCase()}</text>`;
  parts += fptpGrid.svg;
  y += fptpGrid.height + rowGap;

  // D'Hondt proportional seats.
  const dhondtGrid = renderSeatGrid(dhondtSegments, dataX, y, dataWidth, view.totalSeats);
  parts += `<text x="${PADDING}" y="${y + 20}" font-family="${escapeXml(
    BODY_FONT
  )}" font-size="${labelFontSize}" font-weight="600" fill="${MUTED}">${labels[2].text.toUpperCase()}</text>`;
  parts += dhondtGrid.svg;
  y += dhondtGrid.height;

  // Footer: site identity (bottom-right).
  const footer = 'electionresults.uk';
  parts += `<text x="${W - PADDING}" y="${H - PADDING + 10}" text-anchor="end" font-family="${escapeXml(
    BODY_FONT
  )}" font-size="20" font-weight="600" fill="${MUTED}">${footer}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts}</svg>`;
}

// --- Main ------------------------------------------------------------------

if (!existsSync(SNAPSHOT_PATH)) {
  console.error(`[og] missing snapshot at ${SNAPSHOT_PATH}; run bun run etl first`);
  process.exit(1);
}
const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));

// Don't wipe the directory — `flip-map.png` and any other hand-curated
// assets live alongside the generated per-council files. Just ensure
// the dir exists and overwrite. Stale per-council PNGs from renamed
// slugs are a tolerable side effect (none in practice).
mkdirSync(OUT_DIR, { recursive: true });

// Per-(council, year) view + per-council "latest" alias. Latest =
// most recent cycle the council appears in (matches the per-council
// page's default content).
const partyViews = snapshot.partyViews ?? [];
const latestByCouncil = new Map();
for (const v of partyViews) {
  const cur = latestByCouncil.get(v.councilSlug);
  if (!cur || v.year > cur.year) latestByCouncil.set(v.councilSlug, v);
}

let written = 0;
let skipped = 0;
const errors = [];

async function emit(view, filenameBase) {
  // Skip degenerate cards: no seats, no party rows, or only a single
  // party (a 1-seat by-election doesn't say anything about FPTP).
  if (!view || view.totalSeats <= 0 || view.rows.length === 0) {
    skipped++;
    return;
  }
  const reallocated = Math.round(
    view.rows.reduce((s, r) => s + Math.abs(r.seatDelta), 0) / 2
  );
  const reallocatedShare = view.totalSeats > 0 ? reallocated / view.totalSeats : 0;
  const svg = buildSvg({
    council: view.council,
    year: view.year,
    view,
    reallocated,
    reallocatedShare
  });
  const pngPath = resolve(OUT_DIR, `${filenameBase}.png`);
  try {
    await sharp(Buffer.from(svg))
      .png({ compressionLevel: 9 })
      .toFile(pngPath);
    written++;
  } catch (err) {
    errors.push(`${filenameBase}: ${err.message}`);
  }
}

const tasks = [];
for (const view of partyViews) {
  tasks.push(emit(view, `${view.councilSlug}-${view.year}`));
}
for (const [slug, view] of latestByCouncil) {
  tasks.push(emit(view, slug));
}
await Promise.all(tasks);

console.log(
  `[og] wrote ${written} PNG${written === 1 ? '' : 's'} to ${OUT_DIR}` +
    (skipped ? ` (skipped ${skipped} degenerate views)` : '') +
    (errors.length ? `; ${errors.length} errors` : '')
);
if (errors.length > 0) {
  for (const e of errors.slice(0, 10)) console.warn('  -', e);
  if (errors.length > 10) console.warn(`  ... and ${errors.length - 10} more`);
  process.exit(1);
}
