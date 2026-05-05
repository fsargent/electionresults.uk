import {
  raceLeaderboard,
  partyOptions,
  councilOptions,
  yearOptions,
  totals
} from '$lib/data';

export const prerender = true;

export function load() {
  const board = raceLeaderboard().filter((r) => r.underPar > 0);
  return {
    totals,
    rows: board,
    parties: partyOptions(),
    councils: councilOptions(),
    years: yearOptions()
  };
}
