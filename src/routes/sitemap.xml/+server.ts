import { generatedAt } from '$lib/data';
import { councilSitemapUrls } from '$lib/sitemap/council';

export const prerender = true;

const ORIGIN = 'https://electionresults.uk';

// Compose per-domain sitemap fragments. Each fragment lives in its
// own module under src/lib/sitemap/ — Epic 4 lands a parliament
// fragment alongside this council one, and concatenates the two
// before serialising. This keeps the +server.ts boilerplate flat
// even as the site grows new audit surfaces.

function serialise(urls: string[], lastmod: string): string {
  const body = urls
    .map(
      (u) => `  <url><loc>${ORIGIN}${u}</loc><lastmod>${lastmod}</lastmod></url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;
}

export function GET() {
  const today = generatedAt.slice(0, 10);
  const urls = [...councilSitemapUrls()];
  return new Response(serialise(urls, today), {
    headers: { 'content-type': 'application/xml; charset=utf-8' }
  });
}
