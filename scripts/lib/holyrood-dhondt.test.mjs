import { describe, expect, it } from 'vitest';
import { allocateRegion } from './holyrood-dhondt.mjs';

describe('allocateRegion (Scottish Parliament regional list)', () => {
  it('starts each party divisor at constituency seats + 1', () => {
    // A wins 5 constituencies, so its first figure is 50000 / 6.
    const { rounds, listSeats } = allocateRegion(
      [
        { id: 'A', votes: 50000, constituencySeats: 5 },
        { id: 'B', votes: 30000, constituencySeats: 0 },
        { id: 'C', votes: 20000, constituencySeats: 0 }
      ],
      3
    );
    expect(rounds[0].figures.find((f) => f.id === 'A')?.divisor).toBe(6);
    expect(rounds.map((r) => r.winner)).toEqual(['B', 'C', 'B']);
    expect(listSeats).toEqual({ A: 0, B: 2, C: 1 });
  });

  it('adds each list seat won to the divisor', () => {
    const { rounds } = allocateRegion(
      [
        { id: 'A', votes: 900, constituencySeats: 0 },
        { id: 'B', votes: 400, constituencySeats: 0 }
      ],
      3
    );
    // 900/1, then 900/2=450 beats 400, then 400/1 beats 900/3=300.
    expect(rounds.map((r) => r.winner)).toEqual(['A', 'A', 'B']);
    expect(rounds[2].figures.find((f) => f.id === 'A')).toMatchObject({ divisor: 3, quotient: 300 });
  });

  it('lets an individual candidate win once at most', () => {
    const { rounds, listSeats } = allocateRegion(
      [
        { id: 'ind-x', votes: 10000, constituencySeats: 0, individual: true },
        { id: 'A', votes: 6000, constituencySeats: 0 }
      ],
      3
    );
    expect(listSeats['ind-x']).toBe(1);
    expect(rounds.map((r) => r.winner)).toEqual(['ind-x', 'A', 'A']);
  });

  it('fails on an exact tie rather than guessing', () => {
    expect(() =>
      allocateRegion(
        [
          { id: 'A', votes: 100, constituencySeats: 0 },
          { id: 'B', votes: 100, constituencySeats: 0 }
        ],
        1
      )
    ).toThrow(/tie/);
  });
});


describe('allocation eligibility and precision', () => {
  it('disregards an exhausted party list', () => {
    const { rounds } = allocateRegion([
      { id: 'A', votes: 1000, constituencySeats: 0, listCapacity: 1 },
      { id: 'B', votes: 100, constituencySeats: 0, listCapacity: 2 },
      { id: 'C', votes: 900, constituencySeats: 0, listCapacity: 0 }
    ], 3);
    expect(rounds.map((r) => r.winner)).toEqual(['A', 'B', 'B']);
    expect(rounds[1].figures.map((f) => f.id)).toEqual(['B']);
  });
  it('excludes an individual already elected in a constituency', () => {
    const { rounds } = allocateRegion([
      { id: 'ind-x', votes: 1000, constituencySeats: 1, individual: true },
      { id: 'A', votes: 100, constituencySeats: 0 }
    ], 1);
    expect(rounds[0].winner).toBe('A');
  });
  it('keeps precision when displayed figures would round to the same value', () => {
    const { rounds } = allocateRegion([
      { id: 'A', votes: 1000, constituencySeats: 2 },
      { id: 'B', votes: 233334, constituencySeats: 699 }
    ], 1);
    expect(rounds[0].winner).toBe('B');
    expect(rounds[0].figures[0].quotient).toBe(233334 / 700);
  });
  it('fails for equal ratios with different divisors', () => {
    expect(() => allocateRegion([
      { id: 'A', votes: 300, constituencySeats: 2 },
      { id: 'B', votes: 100, constituencySeats: 0 }
    ], 1)).toThrow(/tie/);
  });
});
