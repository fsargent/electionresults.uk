import { holyroodElection, holyroodYears } from '$lib/holyrood/data';

// Coordinator integration fragment; entries() uses the same data accessors.
export function holyroodSitemapUrls(): string[] {
  return ['/holyrood', ...holyroodYears().flatMap((year) => {
    const e = holyroodElection(year)!;
    return [
      `/holyrood/${year}`,
      ...e.constituencies.map((c) => `/holyrood/${year}/constituency/${c.slug}`),
      ...e.regions.map((r) => `/holyrood/${year}/region/${r.slug}`)
    ];
  })];
}
