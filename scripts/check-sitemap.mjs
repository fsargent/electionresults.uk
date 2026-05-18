#!/usr/bin/env node
// Build-time guard against orphan sitemap entries — every URL in the
// prerendered sitemap.xml must correspond to a prerendered HTML page.
// Runs as `postbuild` so the prerender artifacts are on disk.
//
// Why this exists: SvelteKit's prerender crawler follows <a href> in
// HTML responses but does NOT crawl <loc> entries inside an XML
// sitemap. So a broken sitemap URL would ship silently. This script
// closes the gap.
//
// Also detects duplicate <loc> entries — domain fragments could
// double-emit a shared static URL by accident.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const SITEMAP = resolve(ROOT, '.svelte-kit/output/prerendered/pages/sitemap.xml');
const PAGES_DIR = resolve(ROOT, '.svelte-kit/output/prerendered/pages');

function fail(messages) {
  console.error(`check-sitemap: ${messages.length} failure(s)`);
  for (const m of messages) console.error(`  - ${m}`);
  process.exit(1);
}

function extractLocs(xml) {
  const out = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

function pathOf(url) {
  // Strip origin; leave a leading-slash path. The sitemap emits
  // absolute URLs with the canonical origin; we only care about the
  // path for file-existence checks.
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function prerenderedFileFor(path) {
  // SvelteKit writes prerendered routes as `<path>.html` (or
  // `<path>/index.html` if the path is `/`). Trailing-slash paths
  // become `<path>index.html`.
  if (path === '/') return resolve(PAGES_DIR, 'index.html');
  const trimmed = path.endsWith('/') ? path.slice(0, -1) : path;
  return resolve(PAGES_DIR, trimmed.replace(/^\//, '') + '.html');
}

function main() {
  if (!existsSync(SITEMAP)) {
    console.error(`check-sitemap: ${SITEMAP} not found — did the build run?`);
    process.exit(2);
  }

  const xml = readFileSync(SITEMAP, 'utf8');
  const locs = extractLocs(xml);

  if (locs.length === 0) {
    fail(['sitemap.xml contains zero <loc> entries']);
  }

  const failures = [];

  // Duplicate <loc>?
  const seen = new Map();
  for (const loc of locs) {
    seen.set(loc, (seen.get(loc) ?? 0) + 1);
  }
  for (const [loc, count] of seen) {
    if (count > 1) failures.push(`duplicate <loc>: ${loc} (×${count})`);
  }

  // Each URL resolves to a prerendered HTML page?
  for (const loc of locs) {
    const path = pathOf(loc);
    const file = prerenderedFileFor(path);
    if (!existsSync(file)) {
      failures.push(
        `sitemap URL ${loc} has no prerendered file at ${file.replace(ROOT + '/', '')}`
      );
    }
  }

  if (failures.length > 0) fail(failures);

  console.log(
    `check-sitemap: ${locs.length} URL(s) verified against prerender output\n  status: ok`
  );
}

main();
