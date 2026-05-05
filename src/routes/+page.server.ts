import {
  totals,
  allCycles,
  raceLeaderboard,
  generatedAt,
  latestCouncilSummaries,
  distinctCouncilSlugs,
  allFlips,
  latestFlipByCouncil
} from '$lib/data';

export const prerender = true;

export function load() {
  const topUnderPar = raceLeaderboard()
    .filter((r) => r.underPar > 0)
    .slice(0, 10);
  const topFlips = allFlips.slice(0, 10);
  // For the year-over-year map: the most recent flip per council, plus
  // the corresponding party fills.
  const latestFlipMap = latestFlipByCouncil();
  const flipMapEntries = [...latestFlipMap.values()].map((f) => ({
    councilSlug: f.councilSlug,
    council: f.council,
    yearFrom: f.yearFrom,
    yearTo: f.yearTo,
    fromParty: f.fromParty,
    toParty: f.toParty,
    voteSwingNew: f.voteSwingNew,
    seatSwingNew: f.seatSwingNew
  }));
  return {
    totals,
    cycles: allCycles,
    generatedAt,
    topUnderPar,
    topFlips,
    latestByCouncil: latestCouncilSummaries(),
    allCouncils: distinctCouncilSlugs(),
    flipMapEntries
  };
}
