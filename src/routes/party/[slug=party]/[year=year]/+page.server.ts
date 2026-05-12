import { error } from '@sveltejs/kit';
import {
  partyForSlug,
  partySlugs,
  partyTrend,
  partyYearStat,
  partyCouncilCyclesWithChange,
  partyControlChangesFor,
  cycleByYear,
  allCompositions
} from '$lib/data';
import type { CompositionSnapshot } from '$lib/types';

export const prerender = true;

export function entries() {
  // Only emit per-year pages for years the party actually contested —
  // chamber-only carry-forward years (e.g. Labour in 2020, before the
  // dataset starts) have no election to break down.
  const out: { slug: string; year: string }[] = [];
  for (const slug of partySlugs()) {
    const partyName = partyForSlug(slug);
    if (!partyName) continue;
    for (const stat of partyTrend(partyName)) {
      if (stat.contestedSeats > 0) {
        out.push({ slug, year: String(stat.year) });
      }
    }
  }
  return out;
}

export function load({ params }: { params: { slug: string; year: string } }) {
  const partyName = partyForSlug(params.slug);
  if (!partyName) throw error(404, `Unknown party: ${params.slug}`);

  const year = Number(params.year);
  if (!Number.isFinite(year)) throw error(404, `Bad year: ${params.year}`);

  const summary = partyYearStat(partyName, year);
  if (!summary || summary.contestedSeats === 0) {
    throw error(404, `${partyName} did not contest ${year}`);
  }

  const cycle = cycleByYear(year) ?? null;
  const councilRows = partyCouncilCyclesWithChange(partyName, year);
  const controls = partyControlChangesFor(partyName, year);

  // Derived breakdowns the template renders directly. Buckets:
  //   gainedSeats  — councils where we won more seats than last cycle
  //   lostSeats    — councils where we won fewer than last cycle
  //   debutCouncils — no previous cycle in our window (boundary
  //                   reorgs / first appearance)
  //   heldFlat     — same seat count vs last cycle (still listed for
  //                  completeness but folded into a "no change" total)
  const gained = councilRows
    .filter((r) => r.netChange != null && r.netChange > 0)
    .sort((a, b) => (b.netChange ?? 0) - (a.netChange ?? 0));
  const lost = councilRows
    .filter((r) => r.netChange != null && r.netChange < 0)
    .sort((a, b) => (a.netChange ?? 0) - (b.netChange ?? 0));
  const flat = councilRows.filter((r) => r.netChange === 0);
  const debut = councilRows.filter((r) => r.netChange == null);

  const totalNet = councilRows.reduce(
    (sum, r) => sum + (r.netChange ?? 0),
    0
  );

  // Councils the party "had" as of {year} = take each council's latest
  // composition snapshot with year ≤ {year} and keep the ones where
  // this party was the named largest party. The "as-of" interpretation
  // (snapshot ≤ year) is more honest than year == X when oncd doesn't
  // publish a snapshot for every council every year.
  const asOf = new Map<string, CompositionSnapshot>();
  for (const c of allCompositions) {
    if (c.year > year) continue;
    const prev = asOf.get(c.councilSlug);
    if (!prev || c.year > prev.year) asOf.set(c.councilSlug, c);
  }
  const controlledCouncils = [...asOf.values()]
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
    year,
    summary,
    cycle,
    councilRows,
    gained,
    lost,
    flat,
    debut,
    totalNet,
    controls,
    controlledCouncils
  };
}
