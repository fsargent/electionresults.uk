import {
  allCycles,
  allCouncils,
  allPartyYearStats,
  generatedAt,
  partySlugs,
  partyForSlug,
  slugForParty
} from '$lib/data';

export const prerender = true;

const ORIGIN = 'https://electionresults.uk';

export function GET() {
  const today = generatedAt.slice(0, 10);
  const staticUrls = [
    '/',
    '/flips',
    '/below-quota',
    '/methodology',
    '/data',
    '/parties'
  ];
  const cycleUrls = allCycles.map((c) => `/${c.year}`);
  // Both an overview per council and a per-cycle drill-down per (council, year)
  const distinctCouncilSlugs = new Set(allCouncils.map((c) => c.councilSlug));
  const councilOverviewUrls = [...distinctCouncilSlugs].map((s) => `/${s}`);
  const councilCycleUrls = allCouncils.map((c) => `/${c.councilSlug}/${c.year}`);
  const councilUrls = [...councilOverviewUrls, ...councilCycleUrls];
  // Party overview per slug; per-year drill-down for every (party, year)
  // pair where the party actually contested.
  const partyOverviewUrls = partySlugs()
    .filter((slug) => partyForSlug(slug) !== null)
    .map((slug) => `/party/${slug}`);
  const partyYearUrls = allPartyYearStats
    .filter((s) => s.contestedSeats > 0)
    .map((s) => {
      const slug = slugForParty(s.party);
      return slug ? `/party/${slug}/${s.year}` : null;
    })
    .filter((u): u is string => u !== null);
  const partyUrls = [...partyOverviewUrls, ...partyYearUrls];
  const urls = [...staticUrls, ...cycleUrls, ...councilUrls, ...partyUrls];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url><loc>${ORIGIN}${u}</loc><lastmod>${today}</lastmod></url>`
  )
  .join('\n')}
</urlset>`;
  return new Response(body, {
    headers: { 'content-type': 'application/xml; charset=utf-8' }
  });
}
