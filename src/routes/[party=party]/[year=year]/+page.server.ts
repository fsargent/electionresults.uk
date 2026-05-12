import { error } from '@sveltejs/kit';
import {
  partyForSlug,
  partySlugs,
  partyTrend,
  partyYearStat,
  partyCouncilCyclesWithChange,
  partyControlChangesFor,
  cycleByYear
} from '$lib/data';

export const prerender = true;

export function entries() {
  // Only emit per-year pages for years the party actually contested —
  // chamber-only carry-forward years (e.g. Labour in 2020, before the
  // dataset starts) have no election to break down.
  const out: { party: string; year: string }[] = [];
  for (const slug of partySlugs()) {
    const partyName = partyForSlug(slug);
    if (!partyName) continue;
    for (const stat of partyTrend(partyName)) {
      if (stat.contestedSeats > 0) {
        out.push({ party: slug, year: String(stat.year) });
      }
    }
  }
  return out;
}

export function load({ params }: { params: { party: string; year: string } }) {
  const partyName = partyForSlug(params.party);
  if (!partyName) throw error(404, `Unknown party: ${params.party}`);

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

  return {
    partyName,
    partySlug: params.party,
    year,
    summary,
    cycle,
    councilRows,
    gained,
    lost,
    flat,
    debut,
    totalNet,
    controls
  };
}
