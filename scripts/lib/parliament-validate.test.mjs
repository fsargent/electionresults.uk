import { describe, it, expect } from 'vitest';
import {
  validateSchema,
  detectCaveats,
  boundaryCaveatFor
} from './parliament-validate.mjs';

describe('validateSchema', () => {
  it('returns ok when every expected column is present', () => {
    const rows = [{ constituency: 'Bristol East', votes: 100, party: 'Lab' }];
    const result = validateSchema(rows, ['constituency', 'votes', 'party']);
    expect(result).toEqual({ ok: true, missing: [], unexpected: [] });
  });

  it('reports missing columns and is not ok', () => {
    const rows = [{ constituency: 'Bristol East', votes: 100 }];
    const result = validateSchema(rows, ['constituency', 'votes', 'party']);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['party']);
    expect(result.unexpected).toEqual([]);
  });

  it('reports unexpected columns without failing ok', () => {
    const rows = [{ constituency: 'Bristol East', votes: 100, party: 'Lab', extra: 'x' }];
    const result = validateSchema(rows, ['constituency', 'votes', 'party']);
    expect(result.ok).toBe(true);
    expect(result.unexpected).toEqual(['extra']);
  });

  it('unions keys across rows so sparse sheets do not false-negative', () => {
    const rows = [
      { constituency: 'A', votes: 1 }, // no party column
      { constituency: 'B', votes: 2, party: 'Con' }
    ];
    const result = validateSchema(rows, ['constituency', 'votes', 'party']);
    expect(result.ok).toBe(true);
  });

  it('reports all expected columns missing on empty input', () => {
    const result = validateSchema([], ['a', 'b']);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['a', 'b']);
  });

  it('does not mutate the input rows', () => {
    const rows = [Object.freeze({ a: 1 })];
    expect(() => validateSchema(rows, ['a', 'b'])).not.toThrow();
  });
});

describe('detectCaveats', () => {
  it('emits no caveat on a clean two-candidate contested row', () => {
    const row = {
      constituencySlug: 'bristol-east',
      candidateCount: 2,
      electorate: 70000,
      validVotes: 45000,
      contestType: 'single-member'
    };
    expect(detectCaveats(row)).toEqual([]);
  });

  it('emits "uncontested" when there is a single candidate', () => {
    const row = {
      constituencySlug: 'somewhere',
      candidateCount: 1,
      electorate: 70000,
      validVotes: 45000,
      contestType: 'single-member'
    };
    expect(detectCaveats(row)).toContain('uncontested');
  });

  it('emits "speaker" for Chorley', () => {
    const row = {
      constituencySlug: 'chorley',
      candidateCount: 5,
      electorate: 70000,
      validVotes: 45000,
      contestType: 'single-member'
    };
    expect(detectCaveats(row)).toContain('speaker');
  });

  it('emits "missing-turnout" when electorate is null', () => {
    const row = {
      constituencySlug: 'historic-borough',
      candidateCount: 3,
      electorate: null,
      validVotes: 1000,
      contestType: 'single-member'
    };
    expect(detectCaveats(row)).toContain('missing-turnout');
  });

  it('emits "missing-turnout" when validVotes is undefined', () => {
    const row = {
      constituencySlug: 'historic-borough',
      candidateCount: 3,
      electorate: 5000,
      contestType: 'single-member'
    };
    expect(detectCaveats(row)).toContain('missing-turnout');
  });

  it('emits "multi-member-historical" for pre-1950 multi-member contests', () => {
    const row = {
      constituencySlug: 'city-of-london',
      candidateCount: 6,
      electorate: 30000,
      validVotes: 22000,
      contestType: 'multi-member-historical'
    };
    expect(detectCaveats(row)).toContain('multi-member-historical');
  });

  it('emits "source-discrepancy" when the flag is set', () => {
    const row = {
      constituencySlug: 'bristol-east',
      candidateCount: 3,
      electorate: 70000,
      validVotes: 45000,
      contestType: 'single-member',
      sourceDiscrepancy: true
    };
    expect(detectCaveats(row)).toContain('source-discrepancy');
  });

  it('stacks multiple caveats on the same row', () => {
    const row = {
      constituencySlug: 'chorley',
      candidateCount: 1, // uncontested
      electorate: null,  // missing-turnout
      validVotes: null,  // missing-turnout
      contestType: 'single-member'
    };
    const caveats = detectCaveats(row);
    expect(caveats).toContain('speaker');
    expect(caveats).toContain('uncontested');
    expect(caveats).toContain('missing-turnout');
  });

  it('returns [] on null / non-object input', () => {
    expect(detectCaveats(null)).toEqual([]);
    expect(detectCaveats(undefined)).toEqual([]);
  });

  it('does not mutate the input row', () => {
    const row = Object.freeze({
      constituencySlug: 'chorley',
      candidateCount: 1,
      electorate: null,
      validVotes: null
    });
    expect(() => detectCaveats(row)).not.toThrow();
  });
});

describe('boundaryCaveatFor', () => {
  const boundarySets = [
    {
      id: '2010-review',
      name: '2010 review',
      inForceFrom: '2010-05-06',
      inForceTo: '2024-05-30',
      comparableTo: []
    },
    {
      id: '2023-review',
      name: '2023 review',
      inForceFrom: '2024-07-04',
      comparableTo: []
    },
    {
      id: '1950-review',
      name: '1950 review',
      inForceFrom: '1950-02-23',
      inForceTo: '1955-05-26',
      comparableTo: ['1955-review']
    }
  ];

  it('returns null when constituency boundary set matches itself', () => {
    const c = { boundarySet: '2023-review' };
    expect(
      boundaryCaveatFor({
        constituency: c,
        compareAgainst: ['2023-review'],
        boundarySets
      })
    ).toBeNull();
  });

  it('returns the caveat when boundary sets differ and are not in comparableTo', () => {
    const c = { boundarySet: '2023-review' };
    expect(
      boundaryCaveatFor({
        constituency: c,
        compareAgainst: ['2010-review'],
        boundarySets
      })
    ).toBe('boundary-comparability-limited');
  });

  it('returns null when the constituency set explicitly lists the other as comparable', () => {
    const c = { boundarySet: '1950-review' };
    expect(
      boundaryCaveatFor({
        constituency: c,
        compareAgainst: ['1955-review'],
        boundarySets
      })
    ).toBeNull();
  });

  it('returns the caveat for an unknown boundary set ID', () => {
    const c = { boundarySet: 'totally-fictional' };
    expect(
      boundaryCaveatFor({
        constituency: c,
        compareAgainst: ['2023-review'],
        boundarySets
      })
    ).toBe('boundary-comparability-limited');
  });

  it('returns null when compareAgainst is empty (nothing to compare)', () => {
    const c = { boundarySet: '2023-review' };
    expect(
      boundaryCaveatFor({
        constituency: c,
        compareAgainst: [],
        boundarySets
      })
    ).toBeNull();
  });
});
