import { describe, it, expect } from 'vitest';
import type {
  CandidateResult,
  ConstituencyContest,
  NationalPartyTotal
} from './types';
import {
  gallagherIndex,
  voteVsSeatGap,
  partyEfficiency,
  minorityWinnerCount,
  lowWinningShareLeaderboard
} from './metrics';

// Helpers to keep fixtures readable. Each constructor fills in
// defaults so a test can name only the fields it cares about.

function pt(over: Partial<NationalPartyTotal>): NationalPartyTotal {
  return {
    electionId: 'ge-test',
    partyId: 'party',
    partyDisplayName: 'Party',
    partySourceLabel: 'Party',
    votes: 0,
    voteShare: 0,
    seats: 0,
    seatShare: 0,
    seatDelta: 0,
    ...over
  };
}

function contest(over: Partial<ConstituencyContest>): ConstituencyContest {
  return {
    electionId: 'ge-test',
    constituencyId: '2023-review:somewhere',
    constituencySlug: 'somewhere',
    constituencyName: 'Somewhere',
    contestType: 'single-member',
    electorate: 70000,
    validVotes: 45000,
    turnout: 45000 / 70000,
    caveats: [],
    ...over
  };
}

function cand(over: Partial<CandidateResult>): CandidateResult {
  return {
    contestId: 'ge-test:2023-review:somewhere',
    candidateName: 'Anon',
    partyId: 'party',
    partyDisplayName: 'Party',
    partySourceLabel: 'Party',
    votes: 0,
    share: 0,
    position: 1,
    isWinner: false,
    caveats: [],
    ...over
  };
}

describe('gallagherIndex', () => {
  it('returns 0 for a perfectly proportional election', () => {
    const totals = [
      pt({ partyId: 'a', voteShare: 0.5, seatShare: 0.5 }),
      pt({ partyId: 'b', voteShare: 0.3, seatShare: 0.3 }),
      pt({ partyId: 'c', voteShare: 0.2, seatShare: 0.2 })
    ];
    expect(gallagherIndex(totals)).toBeCloseTo(0, 6);
  });

  it('returns 0 for an empty totals list', () => {
    expect(gallagherIndex([])).toBe(0);
  });

  it('reports double-digit disproportionality for a typical FPTP outcome', () => {
    // Stylised 3-party split where the second-largest party gets
    // squeezed: 40/35/25 votes, 55/30/15 seats. Known-good Gallagher
    // is sqrt(((40-55)^2 + (35-30)^2 + (25-15)^2) / 2)
    //        = sqrt((225 + 25 + 100) / 2)
    //        = sqrt(175)
    //        ≈ 13.23
    const totals = [
      pt({ partyId: 'a', voteShare: 0.40, seatShare: 0.55 }),
      pt({ partyId: 'b', voteShare: 0.35, seatShare: 0.30 }),
      pt({ partyId: 'c', voteShare: 0.25, seatShare: 0.15 })
    ];
    expect(gallagherIndex(totals)).toBeCloseTo(Math.sqrt(175), 6);
  });

  it('matches a precomputed value for an asymmetric 5-party split', () => {
    // Hand-computed reference: parties at (35, 25, 20, 12, 8) vote
    // share landing (45, 30, 15, 8, 2) seat share.
    // Squared diffs (in pct points): 100, 25, 25, 16, 36 → sum 202
    // Gallagher = sqrt(202/2) = sqrt(101) ≈ 10.0499
    const totals = [
      pt({ partyId: 'a', voteShare: 0.35, seatShare: 0.45 }),
      pt({ partyId: 'b', voteShare: 0.25, seatShare: 0.30 }),
      pt({ partyId: 'c', voteShare: 0.20, seatShare: 0.15 }),
      pt({ partyId: 'd', voteShare: 0.12, seatShare: 0.08 }),
      pt({ partyId: 'e', voteShare: 0.08, seatShare: 0.02 })
    ];
    expect(gallagherIndex(totals)).toBeCloseTo(Math.sqrt(101), 4);
  });
});

describe('voteVsSeatGap', () => {
  it('returns positive gap for over-represented parties, negative for under', () => {
    const totals = [
      pt({ partyId: 'big', partyDisplayName: 'Big', voteShare: 0.4, seatShare: 0.55 }),
      pt({ partyId: 'mid', partyDisplayName: 'Mid', voteShare: 0.35, seatShare: 0.30 }),
      pt({ partyId: 'small', partyDisplayName: 'Small', voteShare: 0.25, seatShare: 0.15 })
    ];
    const gaps = voteVsSeatGap(totals);
    expect(gaps[0].partyId).toBe('big');
    expect(gaps[0].gap).toBeCloseTo(0.15, 6);
    // 'small' is more under-represented in absolute terms (10pp) than
    // 'mid' (5pp), so it sorts higher.
    expect(gaps.map((g) => g.partyId)).toEqual(['big', 'small', 'mid']);
  });

  it('breaks ties by display name', () => {
    const totals = [
      pt({ partyId: 'zenith', partyDisplayName: 'Zenith', voteShare: 0.4, seatShare: 0.45 }),
      pt({ partyId: 'apex', partyDisplayName: 'Apex', voteShare: 0.4, seatShare: 0.45 })
    ];
    const gaps = voteVsSeatGap(totals);
    expect(gaps.map((g) => g.partyDisplayName)).toEqual(['Apex', 'Zenith']);
  });

  it('returns [] for empty input', () => {
    expect(voteVsSeatGap([])).toEqual([]);
  });
});

describe('partyEfficiency', () => {
  it('reports votes-per-seat for parties with at least one seat', () => {
    const totals = [
      pt({ partyId: 'a', votes: 1_000_000, seats: 20 }),
      pt({ partyId: 'b', votes: 500_000, seats: 2 })
    ];
    const eff = partyEfficiency(totals);
    expect(eff[0].votesPerSeat).toBe(50_000);
    expect(eff[1].votesPerSeat).toBe(250_000);
  });

  it('returns null for parties with zero seats — never divides by zero', () => {
    const totals = [pt({ partyId: 'a', votes: 100_000, seats: 0 })];
    expect(partyEfficiency(totals)[0].votesPerSeat).toBeNull();
  });

  it('returns [] for empty input', () => {
    expect(partyEfficiency([])).toEqual([]);
  });
});

describe('minorityWinnerCount', () => {
  it('counts winners with <50% share', () => {
    const contests = [
      contest({ constituencyId: '2023-review:a', constituencySlug: 'a' }),
      contest({ constituencyId: '2023-review:b', constituencySlug: 'b' })
    ];
    const candidates = [
      cand({ contestId: 'ge-test:2023-review:a', isWinner: true, share: 0.40, position: 1 }),
      cand({ contestId: 'ge-test:2023-review:a', share: 0.35, position: 2 }),
      cand({ contestId: 'ge-test:2023-review:b', isWinner: true, share: 0.60, position: 1 }),
      cand({ contestId: 'ge-test:2023-review:b', share: 0.40, position: 2 })
    ];
    expect(minorityWinnerCount(contests, candidates)).toBe(1);
  });

  it('returns 0 when every winner clears 50%', () => {
    const contests = [
      contest({ constituencyId: '2023-review:a', constituencySlug: 'a' }),
      contest({ constituencyId: '2023-review:b', constituencySlug: 'b' })
    ];
    const candidates = [
      cand({ contestId: 'ge-test:2023-review:a', isWinner: true, share: 0.55, position: 1 }),
      cand({ contestId: 'ge-test:2023-review:b', isWinner: true, share: 0.80, position: 1 })
    ];
    expect(minorityWinnerCount(contests, candidates)).toBe(0);
  });

  it('excludes contests flagged uncontested', () => {
    const contests = [
      contest({
        constituencyId: '2023-review:a',
        constituencySlug: 'a',
        caveats: ['uncontested']
      })
    ];
    const candidates = [
      cand({ contestId: 'ge-test:2023-review:a', isWinner: true, share: 0.30, position: 1 })
    ];
    expect(minorityWinnerCount(contests, candidates)).toBe(0);
  });

  it('excludes multi-member-historical contests (no single winner share applies)', () => {
    const contests = [
      contest({
        constituencyId: '1832-review:london-city',
        constituencySlug: 'london-city',
        caveats: ['multi-member-historical']
      })
    ];
    const candidates = [
      cand({
        contestId: 'ge-test:1832-review:london-city',
        isWinner: true,
        share: 0.20,
        position: 1
      }),
      cand({
        contestId: 'ge-test:1832-review:london-city',
        isWinner: true,
        share: 0.18,
        position: 2
      })
    ];
    expect(minorityWinnerCount(contests, candidates)).toBe(0);
  });

  it('INCLUDES Speaker contests (speaker caveat does not invalidate a winning share)', () => {
    const contests = [
      contest({
        constituencyId: '2023-review:chorley',
        constituencySlug: 'chorley',
        caveats: ['speaker']
      })
    ];
    const candidates = [
      cand({ contestId: 'ge-test:2023-review:chorley', isWinner: true, share: 0.40, position: 1 })
    ];
    expect(minorityWinnerCount(contests, candidates)).toBe(1);
  });

  it('skips contests whose winner has share === null', () => {
    const contests = [
      contest({
        constituencyId: '1923-review:somewhere',
        constituencySlug: 'somewhere'
      })
    ];
    const candidates = [
      cand({
        contestId: 'ge-test:1923-review:somewhere',
        isWinner: true,
        share: null,
        position: 1
      })
    ];
    expect(minorityWinnerCount(contests, candidates)).toBe(0);
  });
});

describe('lowWinningShareLeaderboard', () => {
  function fixture() {
    const contests = [
      contest({
        constituencyId: '2023-review:a',
        constituencySlug: 'a',
        constituencyName: 'Apple'
      }),
      contest({
        constituencyId: '2023-review:b',
        constituencySlug: 'b',
        constituencyName: 'Banana'
      }),
      contest({
        constituencyId: '2023-review:c',
        constituencySlug: 'c',
        constituencyName: 'Cherry'
      })
    ];
    const candidates = [
      // A: tight three-way, winner at 32%
      cand({ contestId: 'ge-test:2023-review:a', isWinner: true, share: 0.32, position: 1, candidateName: 'Alice', partyDisplayName: 'Alpha' }),
      cand({ contestId: 'ge-test:2023-review:a', share: 0.30, position: 2 }),
      cand({ contestId: 'ge-test:2023-review:a', share: 0.28, position: 3 }),
      // B: comfortable winner at 70%
      cand({ contestId: 'ge-test:2023-review:b', isWinner: true, share: 0.70, position: 1, candidateName: 'Bob' }),
      cand({ contestId: 'ge-test:2023-review:b', share: 0.20, position: 2 }),
      // C: winner at 40%
      cand({ contestId: 'ge-test:2023-review:c', isWinner: true, share: 0.40, position: 1, candidateName: 'Carla' }),
      cand({ contestId: 'ge-test:2023-review:c', share: 0.30, position: 2 })
    ];
    return { contests, candidates };
  }

  it('orders ascending by winning share', () => {
    const { contests, candidates } = fixture();
    const rows = lowWinningShareLeaderboard(contests, candidates);
    expect(rows.map((r) => r.constituencySlug)).toEqual(['a', 'c', 'b']);
  });

  it('truncates to N when N < total', () => {
    const { contests, candidates } = fixture();
    const rows = lowWinningShareLeaderboard(contests, candidates, 2);
    expect(rows.map((r) => r.constituencySlug)).toEqual(['a', 'c']);
  });

  it('captures runner-up share when there is one', () => {
    const { contests, candidates } = fixture();
    const rows = lowWinningShareLeaderboard(contests, candidates);
    const a = rows.find((r) => r.constituencySlug === 'a')!;
    expect(a.runnerUpShare).toBeCloseTo(0.30, 6);
  });

  it('breaks ties on winning share by constituency name', () => {
    const contests = [
      contest({ constituencyId: 'x:zenith', constituencySlug: 'zenith', constituencyName: 'Zenith' }),
      contest({ constituencyId: 'x:apex', constituencySlug: 'apex', constituencyName: 'Apex' })
    ];
    const candidates = [
      cand({ contestId: 'ge-test:x:zenith', isWinner: true, share: 0.35, position: 1 }),
      cand({ contestId: 'ge-test:x:apex', isWinner: true, share: 0.35, position: 1 })
    ];
    const rows = lowWinningShareLeaderboard(contests, candidates);
    expect(rows.map((r) => r.constituencyName)).toEqual(['Apex', 'Zenith']);
  });

  it('excludes uncontested contests from the leaderboard', () => {
    const contests = [
      contest({
        constituencyId: '2023-review:lonely',
        constituencySlug: 'lonely',
        constituencyName: 'Lonely',
        caveats: ['uncontested']
      })
    ];
    const candidates = [
      cand({ contestId: 'ge-test:2023-review:lonely', isWinner: true, share: 1.0, position: 1 })
    ];
    expect(lowWinningShareLeaderboard(contests, candidates)).toEqual([]);
  });

  it('carries contest caveats onto leaderboard rows', () => {
    const contests = [
      contest({
        constituencyId: '2023-review:chorley',
        constituencySlug: 'chorley',
        constituencyName: 'Chorley',
        caveats: ['speaker']
      })
    ];
    const candidates = [
      cand({ contestId: 'ge-test:2023-review:chorley', isWinner: true, share: 0.45, position: 1 })
    ];
    const rows = lowWinningShareLeaderboard(contests, candidates);
    expect(rows[0].caveats).toEqual(['speaker']);
  });
});
