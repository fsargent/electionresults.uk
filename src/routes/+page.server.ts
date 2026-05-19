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
  incomplete2026Coverage,
  cohort2026Councils,
  stvDistortionPerCouncil
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

  // Cohort-wide unfairly-awarded: sum of per-cycle reallocations across
  // in-scope FPTP cycles.
  const distortionInScope =
    scopeYear === null
      ? distortionRows
      : distortionRows.filter((d) => d.year === scopeYear);
  const unfairlyAwardedSeats = distortionInScope.reduce(
    (s, r) => s + r.reallocated,
    0
  );

  // 2026 cohort councils with wards still being counted. Maps render
  // these with a dashed outline highlight (rather than overriding the
  // colour to black), so any flip we can already determine from the
  // counted wards still surfaces. Only meaningful for the 2026 view; in
  // the all-cycles view we have no such "in progress" set (each
  // council's latest cycle is the most recent finished one), so we
  // pass an empty list.
  const incompleteCouncils = scopeYear === 2026 ? incomplete2026Coverage() : [];

  // 2026 cohort councils that polled but didn't flip — election
  // happened, leading party unchanged. Lets the flip map distinguish
  // these from councils that simply weren't up for election (which
  // should stay default-grey). Incomplete councils still belong here
  // when no flip has been detected from the wards we do have — the
  // dashed-outline decoration signals that the picture may still
  // change. Only meaningful for the 2026 view.
  let polledNoFlipCouncils: string[] = [];
  if (scopeYear === 2026) {
    const flipped = new Set(flipMapEntries.map((f) => f.councilSlug));
    polledNoFlipCouncils = [...cohort2026Councils()].filter(
      (slug) => !flipped.has(slug)
    );
  }

  return {
    totals: scopedTotals,
    headline: {
      unfairlyAwardedSeats
    },
    lowestWinner,
    topLowestShares,
    topDistortedCycles,
    distortionMapEntries,
    latestByCouncil,
    flipMapEntries,
    topFlipsByShift,
    incompleteCouncils,
    polledNoFlipCouncils
  };
}

export function load() {
  // STV summary sits outside the per-cycle filter — Scotland's STV
  // contrast is a permanent reference point regardless of which year
  // the user is reading. We compute weighted-average distortion (per
  // seat, not per council, so a 12-seat island council doesn't drown
  // out Glasgow) for both systems so the comparison is one number vs
  // one number.
  const stvRows = stvDistortionPerCouncil();
  const stvTotalSeats = stvRows.reduce((s, r) => s + r.totalSeats, 0);
  const stvReallocated = stvRows.reduce((s, r) => s + r.reallocated, 0);
  const stvAvgShare = stvTotalSeats > 0 ? stvReallocated / stvTotalSeats : 0;

  // Latest-cycle FPTP comparison — same denominator: weighted by seats.
  const fptpLatest = latestDistortionPerCouncil();
  const fptpTotalSeats = fptpLatest.reduce((s, r) => s + r.totalSeats, 0);
  const fptpReallocated = fptpLatest.reduce((s, r) => s + r.reallocated, 0);
  const fptpAvgShare = fptpTotalSeats > 0 ? fptpReallocated / fptpTotalSeats : 0;

  return {
    cycles: allCycles,
    generatedAt,
    allCouncils: distinctCouncilSlugs(),
    views: {
      // Default — drives the post-election audit framing.
      '2026': buildView(2026),
      // Toggle target — historical leaderboard across all cycles.
      all: buildView(null)
    },
    stv: {
      councilCount: stvRows.length,
      totalSeats: stvTotalSeats,
      reallocated: stvReallocated,
      avgShare: stvAvgShare,
      // Best (cleanest) and worst (most-distorted) Scottish councils
      // for editorial colour. stvDistortionPerCouncil already sorts
      // ascending by share, so head/tail picks the extremes.
      best: stvRows.slice(0, 5),
      worst: [...stvRows].sort((a, b) => b.reallocatedShare - a.reallocatedShare).slice(0, 5)
    },
    fptpComparison: {
      councilCount: fptpLatest.length,
      totalSeats: fptpTotalSeats,
      reallocated: fptpReallocated,
      avgShare: fptpAvgShare
    }
  };
}
