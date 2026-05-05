import { describe, it, expect } from 'vitest';
import {
  candidateWinningPct,
  raceWinningPct,
  isMinority,
  electedCandidates,
  systemObservation,
  electedWinningPcts
} from './distortion';
import type { Race, Candidate } from './types';

const cand = (overrides: Partial<Candidate> = {}): Candidate => ({
  name: 'Alex Example',
  party: 'Test Party',
  partyAbbrev: 'TP',
  votes: 0,
  elected: false,
  rank: 1,
  ...overrides
});

const race = (overrides: Partial<Race> = {}): Race => ({
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
  isMinority: false,
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

  it('handles minority win', () => {
    const r = race({
      seats: 1,
      candidates: [
        cand({ votes: 350, elected: true, rank: 1 }),
        cand({ votes: 320, elected: false, rank: 2 }),
        cand({ votes: 330, elected: false, rank: 3 })
      ]
    });
    expect(raceWinningPct(r)).toBe(0.35);
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

describe('isMinority', () => {
  it.each([
    [0.49, true],
    [0.5, false],
    [0.51, false],
    [0.05, true]
  ])('isMinority(%f) === %s', (pct, expected) => {
    expect(isMinority(pct)).toBe(expected);
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

describe('systemObservation', () => {
  it('flags single-member minority win <25%', () => {
    const r = race({
      seats: 1,
      candidates: [
        cand({ votes: 200, elected: true, rank: 1, party: 'Green Party', name: 'Pat Specific' }),
        cand({ votes: 195, elected: false, rank: 2 }),
        cand({ votes: 190, elected: false, rank: 3 }),
        cand({ votes: 185, elected: false, rank: 4 }),
        cand({ votes: 180, elected: false, rank: 5 })
      ]
    });
    const obs = systemObservation(r);
    expect(obs).toMatch(/20\.0%/);
    expect(obs.toLowerCase()).toContain('first-past-the-post');
    expect(obs).not.toMatch(/Green Party/);
    // Editorial guard rail: the system observation must never name the
    // candidate. The voting method is the subject; the name is in the row.
    expect(obs).not.toMatch(/Pat Specific/);
  });

  it('mentions multi-member when seats > 1', () => {
    const r = race({
      seats: 2,
      validBallots: 1000,
      candidates: [
        cand({ votes: 400, elected: true }),
        cand({ votes: 200, elected: true }),
        cand({ votes: 150, elected: false })
      ]
    });
    const obs = systemObservation(r);
    expect(obs.toLowerCase()).toMatch(/multi-member|bloc/);
  });

  it('reports majority result without minority framing', () => {
    const r = race({
      seats: 1,
      candidates: [
        cand({ votes: 700, elected: true, rank: 1 }),
        cand({ votes: 200, elected: false, rank: 2 }),
        cand({ votes: 100, elected: false, rank: 3 })
      ]
    });
    const obs = systemObservation(r);
    expect(obs).toMatch(/70\.0%/);
    expect(obs.toLowerCase()).not.toContain('without majority');
  });
});
