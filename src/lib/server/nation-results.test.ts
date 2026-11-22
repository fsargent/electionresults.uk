import { describe, it, expect } from 'vitest';
import { nationResults } from './nation-results';
import { allRaces, councilsForYear, latestCouncilSummaries } from '$lib/data';

describe('nation result coverage', () => {
  it('excludes STV council summaries from below-quota maps and year views', () => {
    const slugs = new Set(allRaces.filter(r => r.system === 'STV').map(r => r.councilSlug));
    expect(councilsForYear(2022).some(c => slugs.has(c.councilSlug))).toBe(false);
    expect(latestCouncilSummaries().some(c => slugs.has(c.councilSlug))).toBe(false);
  });
  it('keeps Scottish STV and Welsh plurality records separate', () => {
    const scotland = nationResults('scotland', 2022);
    const wales = nationResults('wales', 2022);
    expect(scotland.councils).toHaveLength(28);
    expect(scotland.wards).toBe(319);
    expect(wales.councils).toHaveLength(22);
    expect(wales.wards).toBe(690);
    expect(scotland.councils.some(c => wales.councils.some(w => w.slug === c.slug))).toBe(false);
  });
  it('aggregates recorded STV winners rather than choosing first-preference leaders', () => {
    const races = allRaces.filter(r => r.system === 'STV');
    expect(races.some(r => [...r.candidates].sort((a,b) => b.votes-a.votes)
      .slice(r.seats).some(c => c.elected))).toBe(true);
    const result = nationResults('scotland', 2022);
    expect(result.parties.reduce((n,p) => n+p.seats,0)).toBe(
      races.reduce((n,r) => n+r.candidates.filter(c => c.elected).length,0));
    expect(result.parties.reduce((n,p) => n+p.votes,0)).toBe(
      races.reduce((n,r) => n+r.candidates.reduce((v,c) => v+c.votes,0),0));
  });
});
