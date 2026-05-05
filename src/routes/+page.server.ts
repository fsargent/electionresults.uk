import {
  totals,
  cycleLabel,
  electionDateLabel,
  raceLeaderboard,
  allCouncils,
  generatedAt
} from '$lib/data';

export const prerender = true;

export function load() {
  const board = raceLeaderboard();
  return {
    totals,
    cycleLabel,
    electionDateLabel,
    generatedAt,
    topUnderPar: board.filter((r) => r.underPar > 0).slice(0, 10),
    councils: allCouncils,
    councilCount: allCouncils.length
  };
}
