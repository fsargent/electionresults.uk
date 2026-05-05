import {
  totals,
  allCycles,
  raceLeaderboard,
  generatedAt,
  latestCouncilSummaries,
  distinctCouncilSlugs
} from '$lib/data';

export const prerender = true;

export function load() {
  const topUnderPar = raceLeaderboard()
    .filter((r) => r.underPar > 0)
    .slice(0, 10);
  return {
    totals,
    cycles: allCycles,
    generatedAt,
    topUnderPar,
    latestByCouncil: latestCouncilSummaries(),
    allCouncils: distinctCouncilSlugs()
  };
}
