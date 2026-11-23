// Server-only accessor for Senedd election data. The JSON is imported
// at build time; import this module from +page.server.ts files only so
// the full dataset never ships to the browser.

import election2026 from '$lib/data/senedd/2026.json';
import catalog from '$lib/data/senedd/catalog.json';
import type { SeneddCatalogEntry, SeneddConstituency, SeneddElection } from './types';

const ELECTIONS: Record<number, SeneddElection> = {
  2026: election2026 as unknown as SeneddElection
};

export function seneddCatalog(): SeneddCatalogEntry[] {
  return catalog.elections as SeneddCatalogEntry[];
}

export function seneddYears(): number[] {
  return Object.keys(ELECTIONS)
    .map(Number)
    .sort((a, b) => b - a);
}

export function seneddElection(year: number): SeneddElection | null {
  return ELECTIONS[year] ?? null;
}

export function seneddConstituency(year: number, slug: string): SeneddConstituency | null {
  return ELECTIONS[year]?.constituencies.find((c) => c.slug === slug) ?? null;
}

/** Every Senedd URL this module prerenders, for the coordinator's sitemap. */
export function seneddSitemapUrls(): string[] {
  const urls = ['/senedd'];
  for (const year of seneddYears()) {
    urls.push(`/senedd/${year}`);
    for (const c of ELECTIONS[year].constituencies) urls.push(`/senedd/${year}/${c.slug}`);
  }
  return urls;
}
