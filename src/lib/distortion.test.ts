import { describe, it, expect } from 'vitest';
import {
  candidateWinningPct,
  raceWinningPct,
  electedCandidates,
  electedWinningPcts,
  quotaForSeats,
  underPar,
  isBelowQuota,
  dhondt
} from './distortion';
import type { Race, Candidate } from './types';

const cand = (overrides: Partial<Candidate> = {}): Candidate => ({
  name: 'Alex Example',
  party: 'Test Party',
  votes: 0,
  elected: false,
  rank: 1,
  ...overrides
});

const race = (overrides: Partial<Race> = {}): Race => ({
  year: 2025,
  electionDate: '2025-05-01',
  wardName: 'Test Ward',
  wardSlug: 'test-ward',
  wardCode: 'X01',
  council: 'Testshire',
  councilSlug: 'testshire',
  authorityType: 'UC',
  electionType: 'All',
  seats: 1,
  electorate: 5000,
  ballots: 1010,
  invalidVotes: 10,
  validBallots: 1000,
  candidates: [],
  winningPct: 0,
  quota: 0.5,
  underPar: 0,
  isBelowQuota: false,
  ...overrides
});

describe('candidateWinningPct', () => {
  it('returns candidate votes divided by valid ballots', () => {
    const c = cand({ votes: 600 });
    const r = race({ candidates: [c] });
    expect(candidateWinningPct(c, r)).toBe(0.6);
  });

  it('returns 0 when no valid ballots', () => {
    const c = cand({ votes: 0 });
    const r = race({ validBallots: 0, candidates: [c] });
    expect(candidateWinningPct(c, r)).toBe(0);
  });
});

describe('raceWinningPct (single-member)', () => {
  it('uses the winning candidate', () => {
    const r = race({
      seats: 1,
      candidates: [
        cand({ votes: 600, elected: true, rank: 1 }),
        cand({ votes: 400, elected: false, rank: 2 })
      ]
    });
    expect(raceWinningPct(r)).toBe(0.6);
  });
});

describe('raceWinningPct (multi-member)', () => {
  it('returns the marginal (lowest-vote) elected candidate share', () => {
    const r = race({
      seats: 2,
      validBallots: 1000,
      candidates: [
        cand({ votes: 600, elected: true, rank: 1 }),
        cand({ votes: 300, elected: true, rank: 2 }),
        cand({ votes: 250, elected: false, rank: 3 })
      ]
    });
    expect(raceWinningPct(r)).toBe(0.3);
  });

  it('three-seat ward picks lowest-elected', () => {
    const r = race({
      seats: 3,
      validBallots: 2000,
      candidates: [
        cand({ votes: 800, elected: true, rank: 1 }),
        cand({ votes: 700, elected: true, rank: 2 }),
        cand({ votes: 500, elected: true, rank: 3 }),
        cand({ votes: 400, elected: false, rank: 4 })
      ]
    });
    expect(raceWinningPct(r)).toBe(0.25);
  });
});

describe('electedCandidates / electedWinningPcts', () => {
  it('returns elected candidates only', () => {
    const r = race({
      seats: 2,
      candidates: [
        cand({ name: 'A', votes: 600, elected: true, rank: 1 }),
        cand({ name: 'B', votes: 300, elected: true, rank: 2 }),
        cand({ name: 'C', votes: 250, elected: false, rank: 3 })
      ]
    });
    expect(electedCandidates(r).map((c) => c.name)).toEqual(['A', 'B']);
  });

  it('returns winning pct per elected candidate', () => {
    const r = race({
      seats: 2,
      validBallots: 1000,
      candidates: [
        cand({ votes: 600, elected: true }),
        cand({ votes: 300, elected: true }),
        cand({ votes: 250, elected: false })
      ]
    });
    expect(electedWinningPcts(r)).toEqual([0.6, 0.3]);
  });
});

describe('quotaForSeats (Droop quota = 1/(seats+1))', () => {
  it.each([
    [1, 0.5],
    [2, 1 / 3],
    [3, 0.25],
    [4, 0.2],
    [5, 1 / 6]
  ])('quotaForSeats(%i) === %f', (seats, expected) => {
    expect(quotaForSeats(seats)).toBeCloseTo(expected, 6);
  });

  it('returns 0.5 for malformed seat counts (defensive)', () => {
    expect(quotaForSeats(0)).toBe(0.5);
    expect(quotaForSeats(-1)).toBe(0.5);
  });
});

describe('underPar', () => {
  it('zero when winner exactly meets the quota', () => {
    const r = race({
      seats: 2,
      validBallots: 3,
      candidates: [
        cand({ votes: 2, elected: true, rank: 1 }),
        cand({ votes: 1, elected: true, rank: 2 })
      ]
    });
    expect(underPar(r)).toBeCloseTo(0, 6);
  });

  it('positive when marginal winner is below quota (the indictment)', () => {
    // Upton-style: 2-seat race, marginal elected on 15.3% of valid ballots.
    // Quota = 33.33%. Under par = ~18.0 points.
    const r = race({
      seats: 2,
      validBallots: 1000,
      candidates: [
        cand({ votes: 250, elected: true, rank: 1 }),
        cand({ votes: 153, elected: true, rank: 2 }),
        cand({ votes: 100, elected: false, rank: 3 })
      ]
    });
    expect(underPar(r)).toBeCloseTo(1 / 3 - 0.153, 4);
  });

  it('negative when marginal winner exceeds the quota (above-par mandate)', () => {
    const r = race({
      seats: 1,
      candidates: [
        cand({ votes: 700, elected: true, rank: 1 }),
        cand({ votes: 200, elected: false, rank: 2 }),
        cand({ votes: 100, elected: false, rank: 3 })
      ]
    });
    expect(underPar(r)).toBeCloseTo(-0.2, 6);
  });
});

describe('dhondt', () => {
  it('allocates 0 seats when totalSeats is 0', () => {
    const seats = dhondt([{ name: 'A', votes: 100 }], 0);
    expect(seats.get('A')).toBe(0);
  });

  it('reproduces the canonical Wikipedia example (5 seats, 4 parties)', () => {
    // From https://en.wikipedia.org/wiki/D%27Hondt_method#Example
    // Party A: 100,000  → 4 seats
    // Party B:  80,000  → 3 seats
    // Party C:  30,000  → 1 seat
    // Party D:  20,000  → 0 seats
    // (8 seats total)
    const seats = dhondt(
      [
        { name: 'A', votes: 100_000 },
        { name: 'B', votes: 80_000 },
        { name: 'C', votes: 30_000 },
        { name: 'D', votes: 20_000 }
      ],
      8
    );
    expect(seats.get('A')).toBe(4);
    expect(seats.get('B')).toBe(3);
    expect(seats.get('C')).toBe(1);
    expect(seats.get('D')).toBe(0);
  });

  it('exposes FPTP distortion: party with 35% of votes does not win 56% of seats', () => {
    // Two parties contesting a council with 25 seats. FPTP can give the
    // 35%-vote party 56% of seats by winning lots of close races; D'Hondt
    // mirrors the vote share much more closely.
    const seats = dhondt(
      [
        { name: 'A', votes: 35 },
        { name: 'B', votes: 33 },
        { name: 'C', votes: 32 }
      ],
      25
    );
    expect(seats.get('A')).toBe(9); // 36%
    expect(seats.get('B')).toBe(8); // 32%
    expect(seats.get('C')).toBe(8); // 32%
  });

  it('breaks ties deterministically by party name', () => {
    // Two parties with identical vote totals competing for 1 seat.
    const seats = dhondt(
      [
        { name: 'Beta', votes: 100 },
        { name: 'Alpha', votes: 100 }
      ],
      1
    );
    expect(seats.get('Alpha')).toBe(1);
    expect(seats.get('Beta')).toBe(0);
  });
});

describe('isBelowQuota', () => {
  it('flags a 2-seat race won at 15% (quota 33.3%)', () => {
    const r = race({
      seats: 2,
      validBallots: 1000,
      candidates: [
        cand({ votes: 250, elected: true, rank: 1 }),
        cand({ votes: 150, elected: true, rank: 2 }),
        cand({ votes: 100, elected: false, rank: 3 })
      ]
    });
    expect(isBelowQuota(r)).toBe(true);
  });

  it('does NOT flag a 2-seat race won at 35% (quota 33.3%) — above par', () => {
    // Honesty: under the old <50% "minority" rule this would be flagged.
    // Under the proportional quota it is not — a proportional method would
    // have elected this candidate too with comparable support.
    const r = race({
      seats: 2,
      validBallots: 1000,
      candidates: [
        cand({ votes: 500, elected: true, rank: 1 }),
        cand({ votes: 350, elected: true, rank: 2 }),
        cand({ votes: 100, elected: false, rank: 3 })
      ]
    });
    expect(isBelowQuota(r)).toBe(false);
  });

  it('single-seat 49% is below quota (50%)', () => {
    const r = race({
      seats: 1,
      candidates: [
        cand({ votes: 490, elected: true, rank: 1 }),
        cand({ votes: 280, elected: false, rank: 2 }),
        cand({ votes: 230, elected: false, rank: 3 })
      ]
    });
    expect(isBelowQuota(r)).toBe(true);
  });

  it('single-seat 51% is at or above quota', () => {
    const r = race({
      seats: 1,
      candidates: [
        cand({ votes: 510, elected: true, rank: 1 }),
        cand({ votes: 490, elected: false, rank: 2 })
      ]
    });
    expect(isBelowQuota(r)).toBe(false);
  });
});
