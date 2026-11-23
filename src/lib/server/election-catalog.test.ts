import {describe,it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {electionListings,electionYears,readDomainCatalogs} from './election-catalog';
describe('election year catalog',()=>{
  it('includes council and parliamentary results in the same year without combining ballots',()=>{
    const listings=electionListings();
    expect(listings.find(e=>e.id==='councils-2022')?.href).toBe('/councils/2022');
    expect(listings.find(e=>e.id==='assembly-2022')?.seats).toBe(90);
    expect(listings.find(e=>e.id==='westminster-2024')?.href).toBe('/parliament/2024');
    expect(electionYears()).toContain(2010);
    expect(new Set(listings.map(e=>e.id)).size).toBe(listings.length);
  });
  it('discovers a new domain only when an actual catalog exists',()=>{
    const root=mkdtempSync(join(tmpdir(),'election-catalog-'));
    try{
      expect(readDomainCatalogs(root)).toEqual([]);
      mkdirSync(join(root,'senedd'));
      const entry={id:'senedd-2026',year:2026,name:'Senedd',href:'/senedd/2026',nation:'Wales',system:'Closed list',seats:96,contests:16,coverage:'All constituencies'};
      writeFileSync(join(root,'senedd/catalog.json'),JSON.stringify({elections:[entry]}));
      expect(readDomainCatalogs(root)).toEqual([{...entry,kind:'parliament'}]);
      writeFileSync(join(root,'senedd/catalog.json'),JSON.stringify({elections:[{...entry,href:'https://example.com'}]}));
      expect(()=>readDomainCatalogs(root)).toThrow('Invalid senedd election entry');
    }finally{rmSync(root,{recursive:true,force:true});}
  });
});
