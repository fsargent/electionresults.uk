import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { allCycles } from '$lib/data';
import { ingestedYears, nationalSummaryForYear, constituenciesForYear } from '$lib/parliament/data';
import { yearResults } from './nation-results';

export interface ElectionListing {
  id: string; year: number; date?: string; name: string; href: string;
  nation: string; system: string; seats: number; contests: number; coverage: string;
  kind: 'council' | 'parliament';
}
/** Optional domains join the index when their independently reviewable PR lands. */
export function readDomainCatalogs(root = resolve('src/lib/data')): ElectionListing[] {
  const entries: ElectionListing[] = [];
  for (const domain of ['assembly', 'senedd', 'holyrood']) {
    const path = resolve(root, domain, 'catalog.json');
    if (!existsSync(path)) continue;
    const catalog = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(catalog.elections)) throw Error(`Invalid ${domain} election catalog`);
    for (const e of catalog.elections) {
      if (!Number.isInteger(e.year) || !Number.isInteger(e.seats) || !Number.isInteger(e.contests) ||
          !e.id || !e.name || !e.nation || !e.system || !e.coverage ||
          typeof e.href !== 'string' || !e.href.startsWith(`/${domain}/`)) throw Error(`Invalid ${domain} election entry`);
      const names: Record<string,string> = {england:'England',scotland:'Scotland',wales:'Wales','northern-ireland':'Northern Ireland'};
      entries.push({ ...e, nation: names[e.nation] ?? e.nation, kind: 'parliament' });
    }
  }
  if (new Set(entries.map(e=>e.id)).size !== entries.length) throw Error('Duplicate election IDs');
  return entries;
}

export function electionListings(): ElectionListing[] {
  const council = allCycles.map(c => {
    const result = yearResults(c.year);
    return {id:`councils-${c.year}`,year:c.year,name:'Council elections',href:`/councils/${c.year}`,
      nation:'United Kingdom',system:'Varies by nation; see council results',seats:result.seats,contests:result.wards,
      coverage:`${result.councils} councils with records. Coverage is incomplete; nation pages explain gaps. By-elections are listed separately.`,kind:'council' as const};
  });
  const parliament = ingestedYears().map(year => {
    const summary = nationalSummaryForYear(year);
    const contests = constituenciesForYear(year);
    return {id:`westminster-${year}`,year,name:'UK Parliament general election',href:`/parliament/${year}`,
      nation:'United Kingdom',system:'First-past-the-post',seats:summary.totalSeats,contests:contests.length,
      coverage:'Imported constituency results. See the parliamentary pages for source coverage and boundary notes.',kind:'parliament' as const};
  });
  return [...council,...parliament,...readDomainCatalogs()].sort((a,b)=>b.year-a.year || a.name.localeCompare(b.name));
}
export function electionYears(): number[] { return [...new Set(electionListings().map(e=>e.year))].sort((a,b)=>b-a); }
export function electionSitemapUrls() { return ['/elections',...electionYears().map(y=>`/elections/${y}`)]; }
