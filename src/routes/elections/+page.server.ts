import { electionListings, electionYears } from '$lib/server/election-catalog';
export const prerender = true;
export function load() {
  const elections=electionListings();
  return {years:electionYears().map(year=>({year,elections:elections.filter(e=>e.year===year)}))};
}
