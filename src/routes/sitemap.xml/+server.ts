import { allCouncils, generatedAt } from '$lib/data';

export const prerender = true;

const ORIGIN = 'https://electionresults.uk';

export function GET() {
  // Use the ETL snapshot timestamp so the build is deterministic per the PRD.
  const today = generatedAt.slice(0, 10);
  const staticUrls = ['/', '/below-quota', '/methodology', '/data'];
  const urls = [
    ...staticUrls,
    ...allCouncils.map((c) => `/${c.councilSlug}`)
  ];
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
