// Build per-council SVG path strings from the GB local-authority TopoJSON
// (martinjc/UK-GeoJSON, 2013 boundaries — 380 features). Output is a small
// JSON object keyed by council slug, used to render an inline SVG choropleth
// at prerender time on cycle pages.
//
// Source coordinates are WGS84 lon/lat. We project with a UK-tuned conic
// equal-area (mimicking d3.geoAlbers but pinned for the British Isles), then
// emit SVG path strings in a 0..1000 viewport. The SVG is purely
// presentational — fill colours are applied server-side per cycle.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { geoConicEqualArea, geoPath } from 'd3-geo';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TOPO_PATH = resolve(ROOT, 'docs/topo_gb_lad.json');
const OUT_PATH = resolve(ROOT, 'src/lib/data/map.json');

const VIEW_W = 600;
const VIEW_H = 800;

// Slugify mirrors scripts/etl.mjs so map keys join the council table.
function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Manual overrides for boundary-set drift between the 2013 topology and our
// LEH cycles (council renames, splits, mergers). Keys are slugify(LAD13NM);
// values are the slug we use in the LEH data. Only entries we actually need
// — most names match directly via slugify.
const NAME_OVERRIDES = {
  // Anglesey: LEH uses "Isle of Anglesey", topo "Sir Ynys Mon" — Welsh.
  'sir-ynys-mon': 'isle-of-anglesey',
  // Bristol — LEH "Bristol, City Of" vs topo "Bristol, City of"
  'bristol-city-of': 'bristol-city-of',
  // Comhairle nan Eilean Siar / Western Isles
  'comhairle-nan-eilean-siar': 'na-h-eileanan-siar',
  // Edinburgh
  'city-of-edinburgh': 'edinburgh-city-of',
  'edinburgh-city-of': 'city-of-edinburgh'
};

console.log(`[map] reading ${TOPO_PATH}`);
const rawTopo = JSON.parse(readFileSync(TOPO_PATH, 'utf8'));

// Simplify aggressively. topojson-simplify's `quantile` is *minimum
// triangle area* keyed by quantile of remaining points, so LOWER values
// produce MORE simplification. At a 600x800 viewport the editorial map
// just needs council outlines recognisable, not coastline-perfect — q=0.05
// drops the ~95% smallest-triangle vertices and yields ~30k points.
const presimplified = presimplify(rawTopo);
const minWeight = quantile(presimplified, 0.05);
const topo = simplify(presimplified, minWeight);

const objKey = Object.keys(topo.objects)[0];
const fc = feature(topo, topo.objects[objKey]);
console.log(`[map] ${fc.features.length} features (simplified at q=0.05)`);

const projection = geoConicEqualArea()
  .parallels([50, 60])
  .rotate([4.4, 0])
  .center([0, 55.5])
  .fitExtent(
    [
      [10, 10],
      [VIEW_W - 10, VIEW_H - 10]
    ],
    fc
  );

const path = geoPath(projection);

// At a 600x800 viewport one decimal of precision = ~0.0625px — plenty for
// editorial-grade rendering. d3-geo emits ~12 decimal places by default,
// which inflates the path strings by ~10x. Round to 1 dp.
function trimPrecision(d) {
  if (!d) return d;
  return d.replace(/-?\d+\.\d+/g, (n) => Number(n).toFixed(1));
}

const shapes = {};
let unmatched = 0;
for (const f of fc.features) {
  const name = f.properties.LAD13NM;
  if (!name) continue;
  const baseSlug = slugify(name);
  const slug = NAME_OVERRIDES[baseSlug] ?? baseSlug;
  const d = trimPrecision(path(f));
  if (!d) continue;
  shapes[slug] = {
    name,
    code: f.properties.LAD13CD,
    d
  };
}
console.log(`[map] produced ${Object.keys(shapes).length} shapes`);
if (unmatched > 0) console.warn(`[map] ${unmatched} unmatched`);

const out = {
  generatedAt: new Date().toISOString(),
  source: 'martinjc/UK-GeoJSON administrative/gb/topo_lad.json (LAD13)',
  viewBox: `0 0 ${VIEW_W} ${VIEW_H}`,
  width: VIEW_W,
  height: VIEW_H,
  shapes
};
mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(out));
console.log(`[map] wrote ${OUT_PATH}`);
