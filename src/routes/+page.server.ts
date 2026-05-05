import { totals, allCycles, raceLeaderboard, generatedAt } from '$lib/data';

export const prerender = true;

export function load() {
  // Top 10 globally — most-egregious below-quota seats across every cycle.
  const topUnderPar = raceLeaderboard()
    .filter((r) => r.underPar > 0)
    .slice(0, 10);
  return { totals, cycles: allCycles, generatedAt, topUnderPar };
}
