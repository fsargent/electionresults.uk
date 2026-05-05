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
  'herefordshire-county-of': ['herefordshire']
};

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
