import {
  distortionLeaderboard,
  latestDistortionPerCouncil,
  yearOptions,
  partyOptions,
  distinctCouncilSlugs
} from '$lib/data';

export const prerender = true;

export function load() {
  const rows = distortionLeaderboard();
  return {
    rows,
    mapEntries: latestDistortionPerCouncil(),
    years: yearOptions(),
    parties: partyOptions(),
    councils: distinctCouncilSlugs()
  };
}
