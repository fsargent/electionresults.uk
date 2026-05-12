import {
  partyForSlug,
  partySlugs,
  partyTrend,
  allPartyControlChanges
} from '$lib/data';
import type { PartyYearStats } from '$lib/types';

export const prerender = true;

export interface PartyOverview {
  slug: string;
  name: string;
  trend: PartyYearStats[];
  /** Latest chamber-side row in the trend, used for the headline cards. */
  latest: PartyYearStats | null;
  /** Sum of all council-control gains across our window. */
  totalGained: number;
  /** Sum of all council-control losses across our window. */
  totalLost: number;
}

export function load() {
  const parties: PartyOverview[] = partySlugs().map((slug) => {
    const name = partyForSlug(slug)!;
    const trend = partyTrend(name);
    const chamberRows = trend.filter((r) => r.chamberTotal > 0);
    const latest = chamberRows[chamberRows.length - 1] ?? null;
    const totalGained = allPartyControlChanges
      .filter((c) => c.party === name)
      .reduce((sum, c) => sum + c.councilsGained.length, 0);
    const totalLost = allPartyControlChanges
      .filter((c) => c.party === name)
      .reduce((sum, c) => sum + c.councilsLost.length, 0);
    return { slug, name, trend, latest, totalGained, totalLost };
  });

  // The full set of years anyone has data for, ascending. Used as the
  // shared X-axis on the combined chart so every party plots against
  // the same domain.
  const yearSet = new Set<number>();
  for (const p of parties) {
    for (const s of p.trend) yearSet.add(s.year);
  }
  const years = [...yearSet].sort((a, b) => a - b);

  // Default visibility: show the five England-wide parties; hide the
  // regional parties (SNP, Plaid Cymru) initially so the main chart
  // isn't dominated by ~2% horizontal lines. Users can toggle anything.
  const defaultVisible = new Set([
    'labour',
    'conservative',
    'liberal-democrats',
    'green',
    'reform'
  ]);

  return {
    parties,
    years,
    defaultVisible: [...defaultVisible]
  };
}
