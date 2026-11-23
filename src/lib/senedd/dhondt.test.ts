import { describe, expect, it } from 'vitest';
import { allocateSeats, type AllocationEntrant } from './dhondt';

const party = (id: string, votes: number, listLength = 8): AllocationEntrant => ({
  id,
  kind: 'party',
  votes,
  listLength
});
const individual = (id: string, votes: number): AllocationEntrant => ({
  id,
  kind: 'individual',
  votes,
  listLength: 1
});

describe('allocateSeats (GoWA 2006 s. 9)', () => {
  it('reproduces Bangor Conwy Môn 2026', () => {
    const r = allocateSeats(
      [
        party('plaid', 31057),
        party('reform', 19440, 6),
        party('con', 8555, 6),
        party('lab', 4448, 6),
        party('green', 3101, 6),
        party('ld', 1591, 6),
        party('slp', 285, 1),
        party('loony', 279, 1),
        party('heritage', 231, 1),
        party('communist', 143, 1)
      ],
      6
    );
    expect(r.rounds.map((x) => x.winnerId)).toEqual(['plaid', 'reform', 'plaid', 'plaid', 'reform', 'con']);
    expect(r.seatsWon).toMatchObject({ plaid: 3, reform: 2, con: 1, lab: 0 });
    expect(r.rounds[2]).toMatchObject({ winningDivisor: 2, winningFigure: 15528.5 });
    expect(r.nextInLine).toEqual({ id: 'plaid', figure: 7764.25, divisor: 4 });
    expect(r.needsLots).toBeNull();
  });

  it('never divides an independent and caps them at one seat', () => {
    const r = allocateSeats([individual('ind', 100000), party('a', 30000)], 6);
    expect(r.seatsWon).toEqual({ ind: 1, a: 5 });
    expect(r.rounds[0]).toMatchObject({ winnerId: 'ind', winningDivisor: 1, winningFigure: 100000 });
  });

  it('drops a party once its list is exhausted', () => {
    const r = allocateSeats([party('big', 100000, 2), party('small', 1000)], 6);
    expect(r.seatsWon).toEqual({ big: 2, small: 4 });
  });

  it('leaves seats unfilled when every list is exhausted', () => {
    const r = allocateSeats([party('a', 500, 2), individual('i', 10)], 6);
    expect(r.rounds).toHaveLength(3);
    expect(r.nextInLine).toBeNull();
  });

  it('seats every tied entrant when enough seats remain (s. 9(7))', () => {
    const r = allocateSeats([party('a', 1000), party('b', 1000)], 2);
    expect(r.seatsWon).toEqual({ a: 1, b: 1 });
    expect(r.rounds.every((x) => x.tie && x.tieResolution === 'all-seated')).toBe(true);
  });

  it('breaks an overflowing tie by adding one vote (s. 9(8))', () => {
    // Last seat: a's second figure 1000 (2000 ÷ 2) ties b's first (1000).
    // Adding one vote: a = 2001 ÷ 2 = 1000.5, b = 1001 — b wins.
    const r = allocateSeats([party('a', 2000), party('b', 1000)], 2);
    expect(r.rounds.map((x) => x.winnerId)).toEqual(['a', 'b']);
    expect(r.rounds[1].tieResolution).toBe('votes-plus-one');
  });

  it('refuses to guess when the statute requires lots (s. 9(9))', () => {
    const r = allocateSeats([party('a', 1000), party('b', 1000), party('c', 10)], 1);
    expect(r.needsLots).toEqual({ seat: 1, tiedIds: ['a', 'b'] });
    expect(r.rounds).toHaveLength(0);
  });

  it('rejects malformed input', () => {
    expect(() => allocateSeats([party('a', 1), party('a', 2)], 1)).toThrow(/duplicate/);
    expect(() => allocateSeats([party('a', 1.5)], 1)).toThrow(/invalid votes/);
    expect(() => allocateSeats([{ id: 'i', kind: 'individual', votes: 1, listLength: 2 }], 1)).toThrow();
  });
});
