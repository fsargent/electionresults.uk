import { describe, it, expect } from 'vitest';
import { normalizeNiParty, niCouncil, buildStvDomain, catalogEntry } from './council-stv.mjs';

describe('council-stv helpers', () => {
  it('normalizes the EONI party spellings to site labels', () => {
    const cases = {
      'Democratic Unionist Party - D.U.P.': 'Democratic Unionist Party', 'D.U.P.': 'Democratic Unionist Party',
      'Democratic Unionist Part - D.U.P': 'Democratic Unionist Party', 'Democratic Ulster Unionist - D.U.P.': 'Democratic Unionist Party',
      SF: 'Sinn Féin', 'Sinn Féin': 'Sinn Féin', ALL: 'Alliance', 'Alliance Party': 'Alliance',
      'SDLP (Social Democratic & Labour Party)': 'Social Democratic and Labour Party', UUP: 'Ulster Unionist Party',
      'TUV - No Sea Border': 'Traditional Unionist Voice', GRN: 'Green Party Northern Ireland',
      'Aontú For Life, Unity, Economic Justice': 'Aontú', Indepdendent: 'Independent', 'Not stated': '',
      'People Before Profit Alliance': 'People Before Profit Alliance', 'Socialist Party (Northenr Ireland)': 'Socialist Party'
    };
    for (const [raw, want] of Object.entries(cases)) expect(normalizeNiParty(raw), raw).toBe(want);
  });
  it('maps council names to hex-map slugs', () => {
    expect(niCouncil('Belfast City Council').slug).toBe('belfast');
    expect(niCouncil('Mid Ulster').slug).toBe('mid-ulster');
    expect(() => niCouncil('Nowhere')).toThrow();
  });
  it('summarises vacancies and no-poll contests without inventing votes', () => {
    const contest = (over) => ({ councilSlug: 'x', council: 'X', area: 'A', seats: 2, contested: true, seatsFilled: 2, vacancies: 0,
      validBallots: 10, candidates: [{ party: 'P', firstPreferences: 6, elected: true }, { party: 'Q', firstPreferences: 4, elected: true }, { party: 'Q', firstPreferences: 0, elected: false }], stages: null, ...over });
    const d = buildStvDomain({ id: 't', nation: 'scotland', year: 2022, date: '2022-05-05', name: 'T', href: '/t', sources: [], contests: [
      contest({}),
      contest({ area: 'B', contested: false, seatsFilled: 1, vacancies: 1, validBallots: null, candidates: [{ party: '', firstPreferences: null, elected: true }] })
    ] });
    expect(d.summary).toMatchObject({ contests: 2, contested: 1, noPoll: 1, seats: 4, seatsFilled: 3, vacancies: 1, validBallots: 10 });
    expect(d.parties.find((p) => p.party === 'Independent')).toMatchObject({ firstPreferences: 0, seats: 1, unopposedSeats: 1 });
    expect(catalogEntry(d).coverage).toBe('1 councils, 2 wards, 1 uncontested; 3 of 4 seats filled (1 left vacant)');
  });
});
