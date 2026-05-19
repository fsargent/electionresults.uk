import {
  allCycles,
  allCouncils,
  allPartyYearStats,
  partySlugs,
  partyForSlug,
  slugForParty
} from '$lib/data';

// Council sitemap fragment.
//
// Returns the council-product URLs (relative paths, leading slash,
// no origin prefix) that belong in sitemap.xml. The +server.ts
// composes per-domain fragments — Epic 4 adds an equivalent
// `src/lib/sitemap/parliament.ts` helper and concatenates the two
// lists. Keeping each fragment in its own module means a refresh of
// either domain's data shape never edits the other's helper.
//
// Outputs use the post-2026-05-18 `/councils/...` namespace. Static
// council surfaces ('/' for the council homepage, '/councils/data'
// for the council download page) live in `staticCouncilUrls` so the
// +server.ts can decide once whether they belong in each composed
// document.

export const staticCouncilUrls = [
  '/',
  '/councils/flips',
  '/councils/below-quota',
  '/councils/methodology',
  '/councils/data',
  '/councils/parties'
];

export function councilSitemapUrls(): string[] {
  const cycleUrls = allCycles.map((c) => `/councils/${c.year}`);

  const distinctCouncilSlugs = new Set(allCouncils.map((c) => c.councilSlug));
  const councilOverviewUrls = [...distinctCouncilSlugs].map(
    (s) => `/councils/${s}`
  );
  const councilCycleUrls = allCouncils.map(
    (c) => `/councils/${c.councilSlug}/${c.year}`
  );

  // Party overview per slug + per-year drill-down for every (party,
  // year) pair where the party actually contested.
  const partyOverviewUrls = partySlugs()
    .filter((slug) => partyForSlug(slug) !== null)
    .map((slug) => `/councils/party/${slug}`);
  const partyYearUrls = allPartyYearStats
    .filter((s) => s.contestedSeats > 0)
    .map((s) => {
      const slug = slugForParty(s.party);
      return slug ? `/councils/party/${slug}/${s.year}` : null;
    })
    .filter((u): u is string => u !== null);

  return [
    ...staticCouncilUrls,
    ...cycleUrls,
    ...councilOverviewUrls,
    ...councilCycleUrls,
    ...partyOverviewUrls,
    ...partyYearUrls
  ];
}
