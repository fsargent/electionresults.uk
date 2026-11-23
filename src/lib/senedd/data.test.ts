// Invariants on the committed dataset. These re-check, from the shipped
// JSON alone, the guarantees the importer enforced against its sources.
import { describe, expect, it } from 'vitest';
import election from '$lib/data/senedd/2026.json';
import catalog from '$lib/data/senedd/catalog.json';
import { allocateSeats } from './dhondt';
import type { SeneddElection } from './types';

const el = election as unknown as SeneddElection;

describe('Senedd 2026 dataset', () => {
  it('covers 16 constituencies and 96 seats', () => {
    expect(el.constituencies).toHaveLength(16);
    expect(el.constituencies.every((c) => c.seats === 6 && c.elected.length === 6)).toBe(true);
    expect(el.national.parties.reduce((s, p) => s + p.seats, 0)).toBe(96);
    expect(new Set(el.constituencies.map((c) => c.slug)).size).toBe(16);
  });

  it('matches the published national result', () => {
    const seats = Object.fromEntries(el.national.parties.map((p) => [p.displayName, p.seats]));
    expect(seats).toMatchObject({
      'Plaid Cymru': 43,
      'Reform UK': 34,
      'Welsh Labour': 9,
      'Welsh Conservatives': 7,
      'Wales Green Party': 2,
      'Welsh Liberal Democrats': 1
    });
    expect(el.national.validVotes).toBe(1255914);
    expect(el.national.rejectedBallots).toBe(2986);
  });

  for (const c of el.constituencies) {
    describe(c.name, () => {
      it('list votes sum to valid votes', () => {
        expect(c.entries.reduce((s, e) => s + e.votes, 0)).toBe(c.validVotes);
        expect(c.ballotsAtCount).toBe(c.validVotes + c.rejectedBallots);
      });

      it('respects list caps and the independent single-seat rule', () => {
        for (const e of c.entries) {
          if (e.kind === 'individual') {
            expect(e.candidates).toHaveLength(1);
            expect(e.seatsWon).toBeLessThanOrEqual(1);
          } else {
            expect(e.candidates.length).toBeLessThanOrEqual(8);
          }
          expect(e.candidates.map((x) => x.position)).toEqual(e.candidates.map((_, i) => i + 1));
        }
      });

      it('fills each list from the top', () => {
        for (const e of c.entries) {
          const elected = e.candidates.filter((x) => x.elected);
          expect(elected).toHaveLength(e.seatsWon);
          expect(e.seatsWon).toBe(e.seatsWonSource);
          for (const c of e.candidates) expect(c.elected).toBe(c.electedSource);
          expect(elected.map((x) => x.position)).toEqual(elected.map((_, i) => i + 1));
        }
      });

      it('re-running D\'Hondt reproduces the stored allocation', () => {
        const r = allocateSeats(
          c.entries.map((e) => ({ id: e.id, kind: e.kind, votes: e.votes, listLength: e.candidates.length })),
          c.seats
        );
        expect(r.needsLots).toBeNull();
        expect(r.rounds.map((x) => x.winnerId)).toEqual(c.elected.map((m) => m.entryId));
      });
    });
  }

  it('publishes a plain catalog entry for the all-elections hub', () => {
    expect(catalog.elections).toHaveLength(1);
    const e = catalog.elections[0];
    expect(Object.keys(e).sort()).toEqual(
      ['contests', 'coverage', 'date', 'href', 'id', 'name', 'nation', 'seats', 'system', 'year'].sort()
    );
    for (const v of Object.values(e)) expect(['string', 'number']).toContain(typeof v);
    expect(e).toMatchObject({ id: 'senedd-2026', href: '/senedd/2026', seats: 96, contests: 16, year: 2026 });
  });
});
