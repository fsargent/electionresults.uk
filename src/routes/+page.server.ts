import {
  totals,
  allCycles,
  raceLeaderboard,
  generatedAt,
  latestCouncilSummaries,
  distinctCouncilSlugs,
  distortionLeaderboard,
  latestDistortionPerCouncil,
  latestFlipByCouncil,
  allFlips
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
  // Top 10 most FPTP-distorted single elections power the homepage
  // table. The map below uses the latest-per-council helper so every
  // council on the cartogram gets its freshest data point.
  const topDistortedCycles = distortionLeaderboard().slice(0, 10);
  const distortionMapEntries = latestDistortionPerCouncil();
  // For the year-over-year flip map: the most recent flip per council.
  const flipMapEntries = [...latestFlipByCouncil().values()];
  // 10 biggest council-control changes by composition shift — the
  // incoming party's gain in seat share on the full council. Tie-break
  // on the vote-vs-seat gap (most FPTP-amplified first), then most
  // recent. Recency-sorted version was misleading: a tiny snapshot
  // drift that nudged the largest-party label could outrank Doncaster
  // 2025's Reform sweep.
  const topFlipsByShift = [...allFlips]
    .sort((a, b) => {
      const shiftA = Math.abs(a.newPartySeatTo - a.newPartySeatFrom);
      const shiftB = Math.abs(b.newPartySeatTo - b.newPartySeatFrom);
      if (shiftB !== shiftA) return shiftB - shiftA;
      const ampA =
        Math.abs(a.newPartySeatTo - a.newPartySeatFrom) -
        Math.abs(a.newPartyVoteTo - a.newPartyVoteFrom);
      const ampB =
        Math.abs(b.newPartySeatTo - b.newPartySeatFrom) -
        Math.abs(b.newPartyVoteTo - b.newPartyVoteFrom);
      if (ampB !== ampA) return ampB - ampA;
      return b.yearTo - a.yearTo || b.yearFrom - a.yearFrom;
    })
    .slice(0, 10);
  return {
    totals,
    cycles: allCycles,
    generatedAt,
    topLowestShares,
    lowestWinner,
    topDistortedCycles,
    distortionMapEntries,
    topFlipsByShift,
    latestByCouncil: latestCouncilSummaries(),
    allCouncils: distinctCouncilSlugs(),
    flipMapEntries
  };
}
