import { describe,it,expect } from 'vitest';
import {readFileSync} from 'node:fs';
import {parseAssemblyWorkbook} from './assembly-parse.mjs';
const root='source-data/assembly/2022/';
const manifest=JSON.parse(readFileSync(root+'sources.json','utf8'));
const parsed=manifest.files.map(f=>parseAssemblyWorkbook(readFileSync(root+f.file),f));
describe('official NI Assembly 2022 import',()=>{
  it('reconciles all constituencies and national totals to Assembly report 24/22',()=>{
    expect(parsed).toHaveLength(18);
    expect(parsed.reduce((s,c)=>s+c.candidates.length,0)).toBe(239);
    expect(parsed.reduce((s,c)=>s+c.validBallots,0)).toBe(862700);
    expect(parsed.reduce((s,c)=>s+c.ballotsCast,0)).toBe(873787);
    expect(parsed.reduce((s,c)=>s+c.electorate,0)).toBe(1373731);
    expect(parsed.reduce((s,c)=>s+c.candidates.filter(c=>c.elected).length,0)).toBe(90);
    for(const c of parsed){expect(c.candidates.filter(c=>c.elected)).toHaveLength(5);expect(c.quota).toBe(Math.floor(c.validBallots/6)+1);}
  });
  it('uses explicit election-order data when the elected marker is missing',()=>{
    for(const [slug,name] of [['east-antrim','HILDITCH, David William'],['south-antrim','CLARKE, Trevor'],['strangford','NESBITT, Mike']]){
      const c=parsed.find(c=>c.slug===slug).candidates.find(c=>c.name===name);
      expect(c.sourceStatus).toBe(0);expect(c.elected).toBe(true);expect(c.electionOrder).toBeGreaterThan(0);
    }
  });
  it('preserves fractional transfers and flags source stages that do not reconcile',()=>{
    expect(parsed.some(c=>c.stages.some(s=>s.candidates.some(c=>!Number.isInteger(c.value))))).toBe(true);
    const incomplete=parsed.flatMap(c=>c.stages.filter(s=>!s.reconciled));expect(incomplete).toHaveLength(5);
    for(const c of parsed){expect(c.notes).toHaveLength(c.stages.filter(s=>!s.reconciled).length);expect(c.stages[0].accounted).toBe(c.validBallots);}
  });
  it('elects transfer winners outside the leading five first preferences',()=>{
    expect(parsed.some(c=>[...c.candidates].sort((a,b)=>b.firstPreferences-a.firstPreferences).slice(5).some(c=>c.elected))).toBe(true);
  });
});
