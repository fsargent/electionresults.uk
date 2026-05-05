import {
  totals,
  cycleLabel,
  topMinorityWinners,
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
    generatedAt,
    topMinority: topMinorityWinners(10),
    worstRaces: board.filter((r) => r.winningPct < 0.5).slice(0, 10),
    councils: allCouncils,
    councilCount: allCouncils.length
  };
}
