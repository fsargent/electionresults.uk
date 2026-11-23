import { describe, it, expect } from 'vitest';
import { nationResults, yearResults, nationForRace } from './nation-results';
import { allRaces, councilsForYear, latestCouncilSummaries } from '$lib/data';

describe('nation result coverage', () => {
  it('accounts for every record exactly once across nations for each year', () => {
    for (const year of new Set(allRaces.map(r => r.year))) {
      const result = yearResults(year);
      // STV nations backed by council-stv domain data count every ward,
      // including no-poll wards that have no Race record.
      for (const g of result.groups) {
        if (g.stv) {
          const races = allRaces.filter(r => r.year === year && nationForRace(r) === g.nation);
          expect(g.stv.contested).toBe(races.length);
          expect(g.wards).toBe(g.stv.contested + g.stv.noPoll);
        } else {
          expect(g.wards).toBe(allRaces.filter(r => r.year === year && nationForRace(r) === g.nation).length);
        }
      }
      const keys = result.groups.flatMap(g => g.councils.map(c => c.slug));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
  it('keeps historic English authorities and reports missing NI coverage', () => {
    const race = allRaces[0];
    expect(nationForRace({ ...race, councilSlug: 'abolished-english-county', wardCode: 'E123', system: 'FPTP' })).toBe('england');
    expect(nationForRace({ ...race, councilSlug: 'cardiff', wardCode: 'W123', system: 'STV' })).toBe('wales');
    expect(nationForRace({ ...race, councilSlug: 'belfast', wardCode: 'N123', system: 'STV' })).toBe('northern-ireland');
    expect(nationResults('northern-ireland', 2022).wards).toBe(0);
    expect(nationResults('northern-ireland', 2022).stv).toBeNull();
    expect(nationResults('england', 2026).wards).toBe(2951);
  });
  it('excludes STV council summaries from below-quota maps and year views', () => {
    const slugs = new Set(allRaces.filter(r => r.system === 'STV').map(r => r.councilSlug));
    expect(councilsForYear(2022).some(c => slugs.has(c.councilSlug))).toBe(false);
    expect(latestCouncilSummaries().some(c => slugs.has(c.councilSlug))).toBe(false);
  });
  it('keeps Scottish STV and Welsh plurality records separate', () => {
    const scotland = nationResults('scotland', 2022);
    const wales = nationResults('wales', 2022);
    expect(scotland.councils).toHaveLength(32);
    expect(scotland.wards).toBe(355);
    expect(wales.councils).toHaveLength(22);
    expect(wales.wards).toBe(690);
    expect(scotland.councils.some(c => wales.councils.some(w => w.slug === c.slug))).toBe(false);
  });
  it('aggregates recorded STV winners rather than choosing first-preference leaders', () => {
    const races = allRaces.filter(r => r.system === 'STV');
    expect(races.some(r => [...r.candidates].sort((a,b) => b.votes-a.votes)
      .slice(r.seats).some(c => c.elected))).toBe(true);
    const result = nationResults('scotland', 2022);
    const scot = races.filter(r => nationForRace(r) === 'scotland' && r.year === 2022);
    // Seats include the unopposed returns in the 8 no-poll wards.
    expect(result.parties.reduce((n,p) => n+p.seats,0)).toBe(
      scot.reduce((n,r) => n+r.candidates.filter(c => c.elected).length,0) + 18);
    expect(result.parties.reduce((n,p) => n+p.votes,0)).toBeCloseTo(
      scot.reduce((n,r) => n+r.candidates.reduce((v,c) => v+c.votes,0),0), 0);
  });
});
