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
  allFlips,
  cycleByYear,
  incomplete2026Councils
} from '$lib/data';

export const prerender = true;

// Tie-break on the vote-vs-seat gap (most FPTP-amplified first), then
// most recent. Recency-sorted version was misleading: a tiny snapshot
// drift that nudged the largest-party label could outrank a real sweep.
const flipShiftSort = (a: (typeof allFlips)[number], b: (typeof allFlips)[number]) => {
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
};

/**
 * Build one homepage view (lede totals + lede example + four maps +
 * four tables) scoped to either a single cycle year or the full data.
 * Same shape regardless of scope so the page can swap views via one
 * filter state without conditional plumbing per section.
 */
function buildView(scopeYear: number | null) {
  const allBoardRows = raceLeaderboard();
  const board = scopeYear === null
    ? allBoardRows
    : allBoardRows.filter((r) => r.year === scopeYear);
  const topLowestShares = [...board]
    .sort(
      (a, b) => a.winningPct - b.winningPct || a.marginalVotes - b.marginalVotes
    )
    .slice(0, 10);
  const lowestWinner = topLowestShares[0] ?? null;

  const distortionRows = distortionLeaderboard();
  const topDistortedCycles = (
    scopeYear === null
      ? distortionRows
      : distortionRows.filter((d) => d.year === scopeYear)
  ).slice(0, 10);

  // Maps default to "latest per council"; in a single-cycle view we
  // restrict to councils that polled this cycle so the cartogram
  // reflects only data within scope (other councils render as grey).
  const distortionMapEntries =
    scopeYear === null
      ? latestDistortionPerCouncil()
      : distortionRows.filter((d) => d.year === scopeYear);

  const latestByCouncilAll = latestCouncilSummaries();
  const latestByCouncil =
    scopeYear === null
      ? latestByCouncilAll
      : latestByCouncilAll.filter((c) => c.year === scopeYear);

  const flipMapAll = [...latestFlipByCouncil().values()];
  const flipMapEntries =
    scopeYear === null
      ? flipMapAll
      : flipMapAll.filter((f) => f.yearTo === scopeYear);

  const flipsInScope =
    scopeYear === null
      ? allFlips
      : allFlips.filter((f) => f.yearTo === scopeYear);
  const topFlipsByShift = [...flipsInScope].sort(flipShiftSort).slice(0, 10);

  // Lede totals: roll up across the in-scope (council, year) cycles.
  // For a single year, this matches the cycle summary; for "all" it
  // matches the headline totals object.
  let scopedTotals: {
    councils: number;
    races: number;
    seats: number;
    belowQuotaSeats: number;
  };
  if (scopeYear === null) {
    scopedTotals = {
      councils: totals.councils,
      races: totals.races,
      seats: totals.seats,
      belowQuotaSeats: totals.belowQuotaSeats
    };
  } else {
    const cyc = cycleByYear(scopeYear);
    scopedTotals = {
      councils: cyc?.councilCount ?? 0,
      races: cyc?.raceCount ?? 0,
      seats: cyc?.seatCount ?? 0,
      belowQuotaSeats: cyc?.belowQuotaSeatCount ?? 0
    };
  }

  // 2026 cohort councils with wards still being counted: every map
  // surfaces these as black so a partial-count colour doesn't mislead.
  // Only meaningful for the 2026 view; in the all-cycles view we have
  // no such "in progress" set (each council's latest cycle is the
  // most recent finished one), so we pass an empty array.
  const incompleteCouncils = scopeYear === 2026
    ? [...incomplete2026Councils()]
    : [];

  return {
    totals: scopedTotals,
    lowestWinner,
    topLowestShares,
    topDistortedCycles,
    distortionMapEntries,
    latestByCouncil,
    flipMapEntries,
    topFlipsByShift,
    incompleteCouncils
  };
}

export function load() {
  return {
    cycles: allCycles,
    generatedAt,
    allCouncils: distinctCouncilSlugs(),
    views: {
      // Default — drives the post-election audit framing.
      '2026': buildView(2026),
      // Toggle target — historical leaderboard across all cycles.
      all: buildView(null)
    }
  };
}
