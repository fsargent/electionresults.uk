import {
  totals,
  allCycles,
  raceLeaderboard,
  generatedAt,
  latestCouncilSummaries,
  distinctCouncilSlugs,
  allFlips
} from '$lib/data';

export const prerender = true;

export function load() {
  const topUnderPar = raceLeaderboard()
    .filter((r) => r.underPar > 0)
    .slice(0, 10);
  // Ten flips with the biggest seat swing relative to vote swing — the
  // FPTP-volatility headline. Already sorted by disproportion score in ETL.
  const topFlips = allFlips.slice(0, 10);
  return {
    totals,
    cycles: allCycles,
    generatedAt,
    topUnderPar,
    topFlips,
    latestByCouncil: latestCouncilSummaries(),
    allCouncils: distinctCouncilSlugs()
  };
}
