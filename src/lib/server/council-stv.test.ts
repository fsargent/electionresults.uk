import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { stvDomain, stvContestsFor } from './council-stv';
import { allRaces } from '$lib/data';
import { nationResults } from './nation-results';

function csv(path: string) {
  const text = readFileSync(path, 'utf8');
  const rows: string[][] = [];
  let row: string[] = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (ch === '"') q = false; else field += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; } else if (ch !== '\r') field += ch;
  }
  const [head, ...body] = rows;
  return body.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const indylive = csv('source-data/council/scotland-2022-stv-indylive.csv');
const scotland = stvDomain('scotland', 2022)!;

describe('Scotland 2022 council coverage', () => {
  it('covers all 32 councils and 355 wards, including 8 no-poll wards', () => {
    expect(scotland.summary).toMatchObject({ councils: 32, contests: 355, contested: 347, noPoll: 8 });
  });
  it('reconciles 1,226 seats available with 1,223 filled and 3 vacancies', () => {
    expect(scotland.summary.seats).toBe(1226);
    expect(scotland.summary.seatsFilled).toBe(1223);
    expect(scotland.summary.vacancies).toBe(3);
    for (const c of scotland.contests) {
      expect(c.seatsFilled).toBe(c.candidates.filter(x => x.elected).length);
      expect(c.seatsFilled + c.vacancies).toBe(c.seats);
    }
  });
  it('keeps no-poll vote fields null, never zero', () => {
    const noPoll = scotland.contests.filter(c => !c.contested);
    expect(noPoll.map(c => c.area).sort()).toEqual([
      'Barraigh agus Bhatarsaigh', 'Buckie', 'Caol and Mallaig', 'Inverclyde East', 'North Isles',
      "Sgìr' Ùige agus Càrlabhagh", 'Sgìre an Rubha', 'Shetland North'
    ]);
    for (const c of noPoll) {
      expect(c.candidates.length).toBeLessThanOrEqual(c.seats);
      expect(c.validBallots).toBeNull();
      expect(c.quota).toBeNull();
      expect(c.candidates.every(x => x.firstPreferences === null && x.elected)).toBe(true);
    }
    expect(allRaces.some(r => r.year === 2022 && noPoll.some(c => c.areaCode && r.wardCode.endsWith(c.areaCode)))).toBe(false);
  });
  it('preserves the official elected flags from the source for every candidate', () => {
    const elected = new Map(indylive.map(r => [`${r.council_id}|${r.cand_ward_id}|${r.name}`, r.elected === '1']));
    let n = 0;
    for (const c of scotland.contests) for (const cand of c.candidates) {
      const key = `${c.councilSlug}|gss-${c.areaCode}|${cand.name}`;
      if (cand.name !== 'John MCCOLL') expect(elected.get(key), key).toBe(cand.elected);
      else expect(cand.elected).toBe(false);
      n++;
    }
    expect(n).toBe(indylive.length + 1);
  });
  it('uses official declaration first preferences, including the compiled extract corrections', () => {
    const races = allRaces.filter(r => r.system === 'STV' && r.year === 2022);
    expect(races).toHaveLength(347);
    const byWard = new Map(races.map(r => [`${r.councilSlug}|${r.wardCode}`, r]));
    for (const row of indylive.filter(r => r.first_prefs !== '')) {
      const race = byWard.get(`${row.council_id}|${row.cand_ward_id}`)!;
      expect(race.candidates.find(c => c.name === row.name)?.votes).toBe(row.name === 'Laura Brennan-Whitefield' ? 1913 : Number(row.first_prefs));
    }
    const official = JSON.parse(readFileSync('source-data/council/scotland-2022/official-reconciliation.json', 'utf8'));
    expect(official.candidates).toHaveLength(2547);
    expect(official.unmatched.map((c: {CandidateName: string}) => c.CandidateName)).toEqual(['John MCCOLL']);
    for (const c of scotland.contests.filter(c => c.contested)) {
      expect(c.candidates.reduce((n, x) => n + (x.firstPreferences ?? 0), 0), c.area).toBe(c.validBallots);
      expect(c.firstPreferenceSource).toBe('official council declaration return');
    }
  });
  it('profile tallies agree with the compiled first preferences in 318 of 319 wards', () => {
    const rows = csv('source-data/council/scotland-2022-profile-first-preferences.csv');
    const wards = (check: string) => new Set(rows.filter(r => r.check === check).map(r => r.ward_id)).size;
    expect(wards('gap-fill')).toBe(28);
    expect(wards('differs')).toBe(1);
    expect(new Set(rows.filter(r => r.check !== 'gap-fill').map(r => r.ward_id)).size).toBe(319);
    expect(rows.filter(r => r.check === 'differs').map(r => r.ward_name)).toEqual(['Ayr North']);
  });
  it('verifies original source checksums', () => {
    const manifest = JSON.parse(readFileSync('source-data/council/northern-ireland-2023/eoni-manifest.json', 'utf8'));
    for (const f of manifest.files) expect(createHash('sha256').update(readFileSync(`source-data/council/northern-ireland-2023/originals/${f.filename}`)).digest('hex')).toBe(f.sha256);
    const src = scotland.sources[0];
    expect(createHash('sha256').update(readFileSync(`source-data/council/scotland-2022/${src.file}`)).digest('hex')).toBe(src.sha256);
  });
  it('does not rank STV winners by first preferences', () => {
    const contests = scotland.contests.filter(c => c.contested);
    expect(contests.some(c => c.candidates.slice(c.seats).some(x => x.elected))).toBe(true);
  });
});

describe('Northern Ireland 2023 council coverage', () => {
  const ni = stvDomain('northern-ireland', 2023);
  it('has a domain file with internally consistent DEAs', () => {
    expect(ni).not.toBeNull();
    for (const c of ni!.contests) {
      expect(c.areaType).toBe('DEA');
      expect(c.candidates.filter(x => x.elected).length).toBe(c.seats);
      const fp = c.candidates.reduce((n, x) => n + (x.firstPreferences ?? 0), 0);
      expect(Math.abs(fp - (c.validBallots ?? 0))).toBeLessThan(0.5);
      if (c.stages) {
        expect(c.stages[0].totals.map(Number)).toEqual(c.candidates.map(x => x.firstPreferences));
        for (const s of c.stages) expect(s.totals).toHaveLength(c.candidates.length);
      }
      expect(c.sources[0].url).toMatch(/^https:\/\/www\.eoni\.org\.uk\//);
    }
  });
  it('matches the official totals once all 80 DEAs are imported', () => {
    const s = ni!.summary;
    expect(s).toMatchObject({contests: 80, councils: 11, seats: 462, seatsFilled: 462, vacancies: 0});
    expect(ni!.parties.find(p => p.party === 'Sinn Féin')?.seats).toBe(144);
  });
  it('preserves every normalized source candidate and count-stage value in source order', () => {
    for (const format of ['spreadsheet', 'pdf', 'scanned']) {
      const records = JSON.parse(readFileSync(`source-data/council/northern-ireland-2023/${format}-counts.json`, 'utf8'));
      for (const record of records) {
        const contest = ni!.contests.find(c => c.area === record.dea)!;
        expect(contest, record.dea).toBeDefined();
        expect(contest.candidates.map(c => ({ name: c.name, sourceParty: c.sourceParty,
          firstPreferences: c.firstPreferences, elected: c.elected, sourceStatus: c.sourceStatus }))).toEqual(
          record.candidates.map((c: { name: string; party: string; firstPreferences: number; elected: boolean; sourceStatus?: string }) =>
            ({ name: c.name, sourceParty: c.party, firstPreferences: c.firstPreferences, elected: c.elected, sourceStatus: c.sourceStatus ?? null })));
        expect(contest.stages).toHaveLength(record.stages.length);
        for (const stage of record.stages) {
          expect(contest.stages!.find(s => s.number === stage.number)).toMatchObject({
            action: stage.action, totals: stage.totals, changes: stage.changes ?? [],
            nonTransferable: stage.nonTransferable ?? null, incomplete: stage.incomplete === true
          });
        }
        expect(contest.notes).toEqual(expect.arrayContaining(record.notes));
      }
    }
  });
  it('flags published anomalies rather than reconstructing transfers', () => {
    const sperrin = ni!.contests.find(c => c.area === 'Sperrin');
    expect(sperrin?.notes.join(' ')).toMatch(/stage 11/i);
    expect(sperrin?.stages?.find(s => s.number === 11)?.incomplete).toBe(true);
    const west = ni!.contests.find(c => c.area === 'West Tyrone')!;
    expect(west.quota).toBeNull();
    expect(west.stages?.find(s => s.number === 5)).toMatchObject({ incomplete: true });
    expect(ni!.contests.find(c => c.area === 'Enniskillen')?.sources).toHaveLength(2);
    for (const c of ni!.contests) for (const src of c.sources.slice(1)) {
      expect(createHash('sha256').update(readFileSync(`source-data/council/northern-ireland-2023/originals/${src.file}`)).digest('hex')).toBe(src.sha256);
    }
  });
  it('feeds the nation page and council pages', () => {
    const page = nationResults('northern-ireland', 2023);
    expect(page.wards).toBe(ni!.summary.contests);
    expect(page.seats).toBe(ni!.summary.seatsFilled);
    expect(stvContestsFor(2023, 'belfast')).toHaveLength(10);
    expect(stvContestsFor(2023, 'adur')).toHaveLength(0);
  });
});

describe('catalog contract', () => {
  it('lists each STV election with plain fields', () => {
    const cat = JSON.parse(readFileSync('src/lib/data/council-stv/catalog.json', 'utf8'));
    for (const e of cat.elections) {
      for (const k of ['id', 'date', 'name', 'href', 'nation', 'system', 'coverage']) expect(typeof e[k]).toBe('string');
      for (const k of ['year', 'seats', 'contests']) expect(typeof e[k]).toBe('number');
    }
    expect(cat.elections.find((e: { id: string }) => e.id === 'scotland-council-2022')).toMatchObject({ seats: 1226, contests: 355 });
  });
});
