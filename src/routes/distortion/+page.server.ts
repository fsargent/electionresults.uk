import {
  distortionLeaderboard,
  yearOptions,
  partyOptions,
  distinctCouncilSlugs
} from '$lib/data';

export const prerender = true;

export function load() {
  const rows = distortionLeaderboard();
  return {
    rows,
    years: yearOptions(),
    parties: partyOptions(),
    councils: distinctCouncilSlugs()
  };
}
