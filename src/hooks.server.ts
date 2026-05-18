import { redirect, type Handle } from '@sveltejs/kit';
import coreData from '$lib/data/core.json';

// Council overview pages moved /<slug> → /councils/<slug> on
// 2026-05-18. There are ~400 council slugs and the set grows when
// LGR (local-government reorganisation) creates new unitaries, so
// enumerating them in static/_redirects would be both verbose and
// stale-prone. The hook resolves the dynamic ones at the Worker
// layer; static slugs that aren't council names live in
// static/_redirects and never reach this code (Cloudflare serves
// _redirects at the edge before the Worker runs).
//
// Council/year drill-downs (/<slug>/<year>) are handled by the same
// rule: if the leading segment is a known council slug, redirect.
//
// Importing core.json directly (rather than $lib/data) keeps the
// worker bundle free of node:fs — $lib/data reads JSON at module
// init via readFileSync, which the Cloudflare worker runtime doesn't
// support. Vite inlines the JSON as a JS object, so the bundle cost
// is the same as a hand-maintained slug list, but the slug set stays
// in sync with the ETL on every refresh.

type CoreCouncil = { councilSlug: string };
type CoreData = { councils: CoreCouncil[] };
const COUNCIL_SLUGS = new Set(
  (coreData as CoreData).councils.map((c) => c.councilSlug)
);

// Paths under these prefixes are first-class routes (or framework
// assets) and must never be rewritten. Anything not in this list and
// not a council slug falls through to SvelteKit's normal routing,
// which will produce a proper 404 if nothing matches.
const PASS_THROUGH_PREFIXES = [
  '/councils/',
  '/parliament/',
  '/data',
  '/og/',
  '/_app/',
  '/api/',
  '/sitemap.xml',
  '/robots.txt',
  '/favicon'
];

export const handle: Handle = async ({ event, resolve }) => {
  // Read pathname only — touching event.url.search throws under
  // prerender. Query strings carry through Cloudflare's edge on the
  // status-301 response anyway, so we don't need to reconstruct them
  // in the redirect target.
  const { pathname } = event.url;

  // Cheap exits first.
  if (pathname === '/' || pathname === '/councils' || pathname === '/parliament') {
    return resolve(event);
  }
  if (PASS_THROUGH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return resolve(event);
  }

  // Match /<slug> or /<slug>/<rest>. Strip the leading slash, take the
  // first segment, ask the council set.
  const firstSegment = pathname.slice(1).split('/')[0];
  if (firstSegment && COUNCIL_SLUGS.has(firstSegment)) {
    throw redirect(301, `/councils${pathname}`);
  }

  return resolve(event);
};
