import { error } from '@sveltejs/kit';
import {
  partyForSlug,
  partySlugs,
  partyTrend,
  yearsForParty,
  allPartyControlChanges,
  allCompositions
} from '$lib/data';
import type { CompositionSnapshot } from '$lib/types';

export const prerender = true;

export function entries() {
  return partySlugs().map((slug) => ({ slug }));
}

export function load({ params }: { params: { slug: string } }) {
  const partyName = partyForSlug(params.slug);
  if (!partyName) throw error(404, `Unknown party: ${params.slug}`);

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
  const partyChanges = allPartyControlChanges.filter(
    (c) => c.party === partyName
  );
  const totalGained = partyChanges.reduce(
    (sum, c) => sum + c.councilsGained.length,
    0
  );
  const totalLost = partyChanges.reduce(
    (sum, c) => sum + c.councilsLost.length,
    0
  );
  // Per-year control change counts, keyed by year for the Cycles cards.
  const controlByYear: Record<number, { gained: number; lost: number }> = {};
  for (const c of partyChanges) {
    controlByYear[c.year] = {
      gained: c.councilsGained.length,
      lost: c.councilsLost.length
    };
  }

  // Councils currently controlled by this party = take each council's
  // most recent composition snapshot and keep the ones where the party
  // is the named largest party. Drives the hex map.
  const latestPerCouncil = new Map<string, CompositionSnapshot>();
  for (const c of allCompositions) {
    const prev = latestPerCouncil.get(c.councilSlug);
    if (!prev || c.year > prev.year) latestPerCouncil.set(c.councilSlug, c);
  }
  const controlledCouncils = [...latestPerCouncil.values()]
    .filter((c) => c.largestParty === partyName)
    .map((c) => ({
      councilSlug: c.councilSlug,
      council: c.council,
      year: c.year,
      seats: c.largestPartySeats,
      totalSeats: c.totalSeats
    }))
    .sort((a, b) => a.council.localeCompare(b.council));

  return {
    partyName,
    partySlug: params.slug,
    trend,
    years,
    totalGained,
    totalLost,
    controlByYear,
    controlledCouncils
  };
}
