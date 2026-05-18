#!/usr/bin/env node
// Build-time guard against route collisions and orphan redirects.
// Runs as `prebuild` in package.json so `bun run build` aborts before
// SvelteKit spends time prerendering an inconsistent route tree.
//
// Failure modes:
//   (a) Top-level static slug collides with the [year=year] matcher
//       (e.g. a folder named `2024` would be ambiguous with /[year=year]/).
//   (b) Two routes resolve to the same canonical path.
//   (c) A static/_redirects source path is also a current static route
//       (the redirect would never fire — Cloudflare serves _redirects
//       before SvelteKit, but if you also kept the route, you'd be
//       lying about deprecation).
//   (d) A static/_redirects target does not resolve to any current route
//       or to another redirect chain (404 redirect target).
//
// Year matcher is hardcoded as 4-digit because src/params/year.ts
// uses /^\d{4}$/. If that matcher changes, update YEAR_MATCHER below.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const ROOT = resolve(process.cwd());
const ROUTES_DIR = resolve(ROOT, 'src/routes');
const REDIRECTS_FILE = resolve(ROOT, 'static/_redirects');

const YEAR_MATCHER = /^\d{4}$/;

/**
 * Walk src/routes and return one entry per leaf route.
 * Each entry has:
 *   - segments: array of route segments, in dir order
 *   - canonical: normalized URL path (matchers replaced with `:param`,
 *                dynamic params with `:slug`, used to detect duplicates)
 *   - staticPath: URL path treating only literal segments, or null if
 *                 any segment is dynamic
 *   - dir: relative directory path for error messages
 *   - file: which route file marked it as a leaf (+page.svelte etc.)
 */
function collectRoutes(dir, segments = []) {
  const entries = [];
  let entriesInDir;
  try {
    entriesInDir = readdirSync(dir);
  } catch {
    return entries;
  }

  // A directory is a route leaf if it contains a +page.svelte,
  // +page.server.ts, +server.ts, or +server.js. (sitemap.xml uses
  // +server.ts.) We don't traverse into per-route node_modules etc.
  const leafFiles = entriesInDir.filter((name) =>
    /^\+(page|server|layout)\.(svelte|ts|js)$/.test(name)
  );
  if (
    leafFiles.some((f) => /^\+page\./.test(f)) ||
    leafFiles.some((f) => /^\+server\./.test(f))
  ) {
    entries.push({
      segments: [...segments],
      canonical: canonicalize(segments),
      staticPath: staticPathOf(segments),
      dir: relative(ROOT, dir) || 'src/routes',
      file:
        leafFiles.find((f) => /^\+page\.svelte/.test(f)) ||
        leafFiles.find((f) => /^\+page\./.test(f)) ||
        leafFiles.find((f) => /^\+server\./.test(f)) ||
        '+page'
    });
  }

  for (const name of entriesInDir) {
    const full = resolve(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    // Skip private route groups for path-collision purposes? Svelte
    // route groups use parentheses (group) — none currently in repo,
    // but support them safely by treating them as transparent.
    if (/^\(.+\)$/.test(name)) {
      entries.push(...collectRoutes(full, segments));
    } else {
      entries.push(...collectRoutes(full, [...segments, name]));
    }
  }

  return entries;
}

function canonicalize(segments) {
  const parts = segments.map((seg) => {
    if (/^\[\.\.\..+\]$/.test(seg)) return ':rest*';
    if (/^\[(.+?)=.+\]$/.test(seg)) {
      // [param=matcher] — canonical name :matcher to surface duplicate
      // matchers on the same path shape.
      const m = seg.match(/^\[.+?=(.+)\]$/);
      return `:${m[1]}`;
    }
    if (/^\[.+\]$/.test(seg)) return ':slug';
    return seg;
  });
  return '/' + parts.join('/');
}

function staticPathOf(segments) {
  if (segments.some((s) => /^\[.+\]$/.test(s))) return null;
  return '/' + segments.join('/');
}

function parseRedirects(text) {
  const rules = [];
  const lines = text.split('\n');
  lines.forEach((rawLine, idx) => {
    const line = rawLine.replace(/^\s+|\s+$/g, '');
    if (!line || line.startsWith('#')) return;
    // Cloudflare _redirects: source target [status]
    const parts = line.split(/\s+/);
    if (parts.length < 2) return;
    const [source, target, status] = parts;
    rules.push({
      source,
      target,
      status: status || '301',
      line: idx + 1
    });
  });
  return rules;
}

function stripQueryAndFragment(p) {
  return p.split('?')[0].split('#')[0];
}

/**
 * Cloudflare splat support: a source ending in `/*` matches any
 * trailing path; the matched portion is available as `:splat` in the
 * target. For target-existence validation we collapse a `/:splat` (or
 * `:splat`) suffix in the target to the literal prefix, which is what
 * we need to check resolves somewhere.
 */
function collapseTargetSplat(target) {
  return target.replace(/\/:splat$/, '').replace(/:splat$/, '');
}

function targetResolves(target, routes, redirects) {
  const clean = stripQueryAndFragment(collapseTargetSplat(target));
  // External URLs are out of scope — only relative targets are
  // validated. If we ever start redirecting to absolute URLs, drop
  // them at this step.
  if (/^https?:\/\//.test(clean)) return true;
  // A target like `/councils/birmingham` matches if there's any route
  // whose canonical or static path equals it, OR whose param shape
  // can accept it.
  for (const r of routes) {
    if (r.staticPath && r.staticPath === clean) return true;
    if (matchesRouteShape(clean, r)) return true;
  }
  // Or chains through another redirect.
  if (redirects.some((rd) => rd.source === clean)) return true;
  return false;
}

function matchesRouteShape(path, route) {
  const pathParts = path.split('/').filter(Boolean);
  if (pathParts.length !== route.segments.length) return false;
  for (let i = 0; i < pathParts.length; i++) {
    const seg = route.segments[i];
    const val = pathParts[i];
    if (/^\[\.\.\..+\]$/.test(seg)) return true; // rest matcher swallows the rest
    if (/^\[(.+?)=year\]$/.test(seg)) {
      if (!YEAR_MATCHER.test(val)) return false;
    } else if (/^\[.+?=party\]$/.test(seg)) {
      // Party slug matcher — we don't load it dynamically here.
      // Accept as valid (the matcher itself validates at runtime).
    } else if (/^\[.+\]$/.test(seg)) {
      // Generic [slug] — accept anything non-empty.
      if (!val) return false;
    } else {
      if (seg !== val) return false;
    }
  }
  return true;
}

function main() {
  if (!existsSync(ROUTES_DIR)) {
    console.error(`check-routes: ${ROUTES_DIR} does not exist`);
    process.exit(2);
  }

  const routes = collectRoutes(ROUTES_DIR);
  const failures = [];

  // (a) Top-level static slug collides with [year=year]
  const topStatic = routes
    .map((r) => r.segments[0])
    .filter((s) => s && !/^\[.+\]$/.test(s));
  const yearCollisions = [...new Set(topStatic)].filter((s) => YEAR_MATCHER.test(s));
  for (const slug of yearCollisions) {
    failures.push(
      `(a) top-level slug "${slug}" collides with [year=year] matcher — rename or move under a namespace`
    );
  }

  // (b) Duplicate canonical paths
  const canonicalCount = new Map();
  for (const r of routes) {
    canonicalCount.set(r.canonical, (canonicalCount.get(r.canonical) || []).concat([r]));
  }
  for (const [path, rs] of canonicalCount) {
    if (rs.length > 1) {
      const dirs = rs.map((r) => r.dir).join(', ');
      failures.push(`(b) duplicate canonical path "${path}" — defined by: ${dirs}`);
    }
  }

  // Redirect validation
  let redirects = [];
  if (existsSync(REDIRECTS_FILE)) {
    const text = readFileSync(REDIRECTS_FILE, 'utf8');
    redirects = parseRedirects(text);
  }

  // (c) Source path is also a current static route
  const staticRoutePaths = new Set(routes.map((r) => r.staticPath).filter(Boolean));
  for (const rd of redirects) {
    const src = stripQueryAndFragment(rd.source.replace(/\/\*$/, ''));
    if (staticRoutePaths.has(src)) {
      failures.push(
        `(c) _redirects:${rd.line} source "${rd.source}" is also a current static route — remove the route or the redirect`
      );
    }
  }

  // (d) Target does not resolve
  for (const rd of redirects) {
    if (!targetResolves(rd.target, routes, redirects)) {
      failures.push(
        `(d) _redirects:${rd.line} target "${rd.target}" does not resolve to any current route or redirect chain`
      );
    }
  }

  // Summary
  const summary = [
    `check-routes: ${routes.length} route(s), ${redirects.length} redirect(s)`,
    `  failures: ${failures.length}`
  ].join('\n');

  if (failures.length === 0) {
    console.log(`${summary}\n  status: ok`);
    process.exit(0);
  } else {
    console.error(summary);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
}

main();
