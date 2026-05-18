import { generatedAt } from '$lib/data';
import { councilSitemapUrls } from '$lib/sitemap/council';
import { parliamentSitemapUrls } from '$lib/sitemap/parliament';

export const prerender = true;

const ORIGIN = 'https://electionresults.uk';

// Compose per-domain sitemap fragments. Each fragment lives in its
// own module under src/lib/sitemap/ and is concatenated here before
// serialisation. New audit surfaces add a module + one line below.
// We deduplicate at the end so domain fragments can both safely
// emit shared static URLs without producing duplicate <loc>s.

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
  const merged = [...councilSitemapUrls(), ...parliamentSitemapUrls()];
  const urls = [...new Set(merged)];
  return new Response(serialise(urls, today), {
    headers: { 'content-type': 'application/xml; charset=utf-8' }
  });
}
