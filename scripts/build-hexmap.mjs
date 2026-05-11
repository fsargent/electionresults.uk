// Load the Open Innovations / odileeds UK Local Authority District hex
// cartogram (HexJSON, 2025 edition) and emit a normalised JSON keyed by
// council slug so the SvelteKit pages can join it to our cycle data.
//
// Source: https://github.com/odileeds/hexmaps
//   maps/uk-local-authority-districts-2025.hexjson  (361 hexes, odd-r layout)
//
// We strip the source's default party colour (we apply our own per cycle)
// and add our council slug as the lookup key. ONS code is preserved for
// auditability.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const HEXJSON = resolve(ROOT, 'docs/uk-lad-2025.hexjson');
const OUT = resolve(ROOT, 'src/lib/data/hexes.json');

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Each hex can be looked up by *any* of several LEH-side slug variants —
// the LEH workbooks aren't consistent across years (e.g. "Durham" appears
// in some, "County Durham" in others; "King's Lynn" loses its apostrophe).
// Map odileeds slug → list of additional LEH-side slugs to alias.
const SLUG_ALIASES = {
  'county-durham': ['durham'],
  'kingston-upon-hull-city-of': ['kingston-upon-hull'],
  'king-s-lynn-and-west-norfolk': ['kings-lynn-and-west-norfolk'],
  'comhairle-nan-eilean-siar': ['na-h-eileanan-siar'],
  'herefordshire-county-of': ['herefordshire'],
  // Lincoln district (the city) appears under its full name in the
  // 2026 cohort — the hexjson source uses just 'Lincoln'.
  lincoln: ['city-of-lincoln']
};

// Upper-tier councils (English county councils + Surrey LGR successor
// unitaries planned for 2026) that the odileeds lower-tier hexjson
// doesn't include. These polled in our cycle data — Essex 2021/2026,
// Suffolk 2021/2026, etc. — so they need their own hexes to appear on
// the maps. (q,r) positions chosen as the nearest empty cell in the
// odd-r layout to each county's geographic district cluster, so each
// county hex sits visually adjacent to its constituent districts.
const ADDITIONAL_HEXES = [
  { onsCode: 'E10000012', name: 'Essex',           q: 17, r: 6,  region: 'E12000006' },
  { onsCode: 'E10000029', name: 'Suffolk',         q: 16, r: 9,  region: 'E12000006' },
  { onsCode: 'E10000020', name: 'Norfolk',         q: 16, r: 11, region: 'E12000006' },
  { onsCode: 'E10000015', name: 'Hertfordshire',   q: 14, r: 2,  region: 'E12000006' },
  { onsCode: 'E10000014', name: 'Hampshire',       q: 3,  r: -2, region: 'E12000008' },
  { onsCode: 'E10000030', name: 'Surrey',          q: 5,  r: -2, region: 'E12000008' },
  { onsCode: 'E06000093', name: 'East Surrey',     q: 6,  r: -3, region: 'E12000008' },
  { onsCode: 'E06000094', name: 'West Surrey',     q: 4,  r: -2, region: 'E12000008' },
  { onsCode: 'E10000011', name: 'East Sussex',     q: 11, r: -3, region: 'E12000008' },
  { onsCode: 'E10000032', name: 'West Sussex',     q: 7,  r: -3, region: 'E12000008' },
  { onsCode: 'E10000013', name: 'Gloucestershire', q: 0,  r: 4,  region: 'E12000009' }
];

const hex = JSON.parse(readFileSync(HEXJSON, 'utf8'));
const ids = Object.keys(hex.hexes);
console.log(`[hexmap] read ${ids.length} hexes (layout=${hex.layout})`);

const hexes = [];
for (const onsCode of ids) {
  const h = hex.hexes[onsCode];
  if (!h.n) continue;
  const slug = slugify(h.n);
  const aliases = SLUG_ALIASES[slug] ?? [];
  hexes.push({
    onsCode,
    name: h.n,
    slug,
    aliases,
    q: h.q,
    r: h.r,
    region: h.region ?? null
  });
}
// Splice in upper-tier counties (no source data for them; positions
// are hand-picked next to their districts). Validate each lands on an
// unoccupied (q,r) cell.
const occupied = new Set(hexes.map((h) => `${h.q},${h.r}`));
for (const a of ADDITIONAL_HEXES) {
  const key = `${a.q},${a.r}`;
  if (occupied.has(key)) {
    throw new Error(
      `[hexmap] additional hex ${a.slug ?? a.name} collides with existing hex at (${a.q},${a.r})`
    );
  }
  occupied.add(key);
  hexes.push({
    onsCode: a.onsCode,
    name: a.name,
    slug: slugify(a.name),
    aliases: [],
    q: a.q,
    r: a.r,
    region: a.region ?? null
  });
}
hexes.sort((a, b) => a.slug.localeCompare(b.slug));

const out = {
  generatedAt: new Date().toISOString(),
  source:
    'https://github.com/odileeds/hexmaps maps/uk-local-authority-districts-2025.hexjson',
  layout: hex.layout,
  hexCount: hexes.length,
  hexes
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));
console.log(`[hexmap] wrote ${OUT} (${hexes.length} hexes)`);
