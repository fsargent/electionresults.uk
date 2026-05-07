import {
  totals,
  allCycles,
  raceLeaderboard,
  generatedAt,
  latestCouncilSummaries,
  distinctCouncilSlugs,
  distortionLeaderboard,
  latestFlipByCouncil
} from '$lib/data';

export const prerender = true;

export function load() {
  const allBoardRows = raceLeaderboard();
  // Top 10 by absolute lowest winning share (matches the table heading
  // "Ten seats won on the smallest share of the vote"). Distinct from
  // the leaderboard's default sort, which is by gap below the quota.
  const topLowestShares = [...allBoardRows]
    .sort(
      (a, b) => a.winningPct - b.winningPct || a.marginalVotes - b.marginalVotes
    )
    .slice(0, 10);
  // The single lowest winning share anywhere in the data — used as the
  // concrete hook in the homepage lede ("they won with X%, 1-X chose
  // someone else, and they still won the seat").
  const lowestWinner = topLowestShares[0];
  // Per-cycle FPTP distortion ranking — sorted by raw count, share as
  // tiebreak. Top 10 power the homepage table; the map shading uses the
  // most recent cycle per council so every council on the cartogram
  // gets its freshest data point.
  const allDistorted = distortionLeaderboard();
  const topDistortedCycles = allDistorted.slice(0, 10);
  const latestDistortionPerCouncil = new Map<
    string,
    (typeof allDistorted)[number]
  >();
  for (const row of allDistorted) {
    const prev = latestDistortionPerCouncil.get(row.councilSlug);
    if (!prev || row.year > prev.year) {
      latestDistortionPerCouncil.set(row.councilSlug, row);
    }
  }
  const distortionMapEntries = [...latestDistortionPerCouncil.values()];
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
    topLowestShares,
    lowestWinner,
    topDistortedCycles,
    distortionMapEntries,
    latestByCouncil: latestCouncilSummaries(),
    allCouncils: distinctCouncilSlugs(),
    flipMapEntries
  };
}
