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
    topLowestShares,
    lowestWinner,
    topFlips,
    latestByCouncil: latestCouncilSummaries(),
    allCouncils: distinctCouncilSlugs(),
    flipMapEntries
  };
}
