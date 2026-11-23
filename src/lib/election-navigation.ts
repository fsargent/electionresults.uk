import cycleCsv from '../../static/data/cycles.csv?raw';
interface Catalog { elections: {year:number;href:string}[] }
// Small, build-time catalog imports work in both browser and Cloudflare bundles.
const catalogs = import.meta.glob('/src/lib/data/{assembly,senedd,holyrood}/catalog.json', {eager:true,import:'default'}) as Record<string,Catalog>;
export const councilYears = cycleCsv.trim().split(/\r?\n/).slice(1).map(row=>Number(row.split(',')[0])).filter(Number.isFinite).sort((a,b)=>b-a);
export const electionNavigation = ['senedd','holyrood','assembly'].flatMap(domain=>{
  const catalog=Object.entries(catalogs).find(([path])=>path.includes(`/${domain}/`))?.[1];
  const election=catalog?.elections.slice().sort((a,b)=>b.year-a.year)[0];
  return election ? [{href:election.href,label:domain==='senedd'?'Senedd':domain==='holyrood'?'Scottish Parliament':'NI Assembly'}] : [];
});
