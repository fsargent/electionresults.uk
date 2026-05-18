import {
  constituenciesForYear,
  ingestedYears
} from '$lib/parliament/data';

// Parliament sitemap fragment.
//
// Returns the parliament-product URLs (relative paths, leading slash,
// no origin prefix) that belong in sitemap.xml.
//
// Source-of-truth discipline: every URL emitted here comes from the
// SAME accessor the route's `entries()` function uses to drive
// prerender. ingestedYears() drives both /parliament/[year] and the
// year sub-tree; constituenciesForYear() drives every
// /parliament/[year]/[constituency]. If a page prerenders, the
// equivalent sitemap entry resolves — no orphan sitemap entries
// possible by construction.

export const staticParliamentUrls = [
  '/parliament',
  '/parliament/methodology',
  '/parliament/data'
];

export function parliamentSitemapUrls(): string[] {
  const years = ingestedYears();
  const yearUrls = years.map((y) => `/parliament/${y}`);
  const constituencyUrls = years.flatMap((y) =>
    constituenciesForYear(y).map(
      (c) => `/parliament/${y}/${c.constituencySlug}`
    )
  );
  return [...staticParliamentUrls, ...yearUrls, ...constituencyUrls];
}
