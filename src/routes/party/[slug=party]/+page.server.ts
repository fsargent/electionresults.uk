import { error } from '@sveltejs/kit';
import {
  partyForSlug,
  partySlugs,
  partyTrend,
  yearsForParty,
  allPartyControlChanges
} from '$lib/data';

export const prerender = true;

export function entries() {
  return partySlugs().map((party) => ({ party }));
}

export function load({ params }: { params: { party: string } }) {
  const partyName = partyForSlug(params.party);
  if (!partyName) throw error(404, `Unknown party: ${params.party}`);

  const trend = partyTrend(partyName);
  if (trend.length === 0) {
    throw error(404, `No data yet for ${partyName}`);
  }

  // Years a /[party]/[year]/ page exists for. Use yearsForParty (which
  // requires either a contested cycle or a chamber row) so the link
  // list doesn't include pure carry-forward chamber-only years where
  // the party didn't actually run.
  const years = yearsForParty(partyName).filter((y) =>
    trend.some((s) => s.year === y && s.contestedSeats > 0)
  );

  // Headline: net council-control swing across our entire window.
  const totalGained = allPartyControlChanges
    .filter((c) => c.party === partyName)
    .reduce((sum, c) => sum + c.councilsGained.length, 0);
  const totalLost = allPartyControlChanges
    .filter((c) => c.party === partyName)
    .reduce((sum, c) => sum + c.councilsLost.length, 0);

  return {
    partyName,
    partySlug: params.party,
    trend,
    years,
    totalGained,
    totalLost
  };
}
