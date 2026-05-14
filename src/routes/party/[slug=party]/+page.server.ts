import { error } from '@sveltejs/kit';
import {
  partyForSlug,
  partySlugs,
  partyTrend,
  yearsForParty,
  allPartyControlChanges,
  allCompositions,
  allPartyCouncilCycles
} from '$lib/data';
import type { CompositionSnapshot } from '$lib/types';

export const prerender = true;

export function entries() {
  return partySlugs().map((slug) => ({ slug }));
}

function fptpEffectFor(partyName: string, years: number[] | null) {
  const yearSet = years ? new Set(years) : null;
  const rows = allPartyCouncilCycles.filter(
    (r) =>
      r.party === partyName &&
      (yearSet ? yearSet.has(r.year) : true) &&
      (r.system ?? 'FPTP') === 'FPTP'
  );
  const fptpSeats = rows.reduce((sum, r) => sum + r.seatsWon, 0);
  const dhondtSeats = rows.reduce((sum, r) => sum + r.dhondtSeats, 0);
  const seatDelta = rows.reduce((sum, r) => sum + r.seatDelta, 0);
  const rowYears = rows.map((r) => r.year);
  return {
    fptpSeats,
    dhondtSeats,
    seatDelta,
    councilCount: new Set(rows.map((r) => `${r.year}:${r.councilSlug}`)).size,
    yearStart: rowYears.length > 0 ? Math.min(...rowYears) : null,
    yearEnd: rowYears.length > 0 ? Math.max(...rowYears) : null
  };
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
  const latestYear = years[0] ?? null;
  const latestFptpEffect =
    latestYear != null ? fptpEffectFor(partyName, [latestYear]) : null;
  const cumulativeFptpEffect = fptpEffectFor(partyName, null);

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
    latestFptpEffect,
    cumulativeFptpEffect,
    controlledCouncils
  };
}
