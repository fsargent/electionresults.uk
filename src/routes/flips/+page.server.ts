import {
  allFlips,
  yearOptions,
  partyOptions,
  distinctCouncilSlugs
} from '$lib/data';

export const prerender = true;

export function load() {
  // ETL already sorts by disproportion score (seat-shift / vote-shift).
  return {
    rows: allFlips,
    years: yearOptions(),
    parties: partyOptions(),
    councils: distinctCouncilSlugs()
  };
}
