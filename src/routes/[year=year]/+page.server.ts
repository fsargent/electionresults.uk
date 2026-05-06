import { error } from '@sveltejs/kit';
import {
  cycleByYear,
  councilsForYear,
  raceLeaderboard,
  allCycles
} from '$lib/data';

export const prerender = true;

export function entries() {
  return allCycles.map((c) => ({ year: String(c.year) }));
}

export function load({ params }: { params: { year: string } }) {
  const year = Number(params.year);
  if (!Number.isFinite(year)) throw error(404, `Bad year: ${params.year}`);
  const cycle = cycleByYear(year);
  if (!cycle) throw error(404, `No cycle for year ${year}`);
  const councils = councilsForYear(year);
  const topUnderPar = raceLeaderboard()
    .filter((r) => r.year === year && r.underPar < 0)
    .slice(0, 10);
  return { cycle, councils, topUnderPar };
}
