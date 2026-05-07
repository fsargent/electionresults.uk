import {
  raceLeaderboard,
  partyOptions,
  councilOptions,
  yearOptions,
  latestCouncilSummaries,
  totals
} from '$lib/data';

export const prerender = true;

export function load() {
  const board = raceLeaderboard().filter((r) => r.underPar < 0);
  return {
    totals,
    rows: board,
    mapEntries: latestCouncilSummaries(),
    parties: partyOptions(),
    councils: councilOptions(),
    years: yearOptions()
  };
}
