// Build-time accessors for Scottish Parliament results. Everything is a
// static JSON import, so routes prerender with no runtime data fetch.

import election2026 from '$lib/data/holyrood/2026.json';
import catalogJson from '$lib/data/holyrood/catalog.json';
import type { CatalogEntry, HolyroodElection } from './types';

const ELECTIONS: Record<number, HolyroodElection> = {
  2026: election2026 as unknown as HolyroodElection
};

export const catalog: { elections: CatalogEntry[] } = catalogJson;

export function holyroodYears(): number[] {
  return Object.keys(ELECTIONS)
    .map(Number)
    .sort((a, b) => b - a);
}

export function holyroodElection(year: number): HolyroodElection | null {
  return ELECTIONS[year] ?? null;
}
