import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { parseAssemblyWorkbook } from './lib/assembly-parse.mjs';
const root = resolve('source-data/assembly/2022');
const index = 'https://www.eoni.org.uk/results-data/ni-assembly-election-2022-results/';
mkdirSync(root, {recursive:true});
if (process.argv.includes('--download')) {
  const response = await fetch(index); if (!response.ok) throw Error(`Source index: ${response.status}`);
  const html = await response.text(); writeFileSync(resolve(root,'index.html'),html);
  const urls = [...new Set([...html.matchAll(/href="(\/media\/[^"\s]+\.(?:xlsx|xls))"/g)].map(m => `https://www.eoni.org.uk${m[1]}`))];
  if (urls.length !== 18) throw Error(`Expected 18 constituency workbooks, got ${urls.length}`);
  const files=[];
  for (const url of urls) {
    const response=await fetch(url);if(!response.ok)throw Error(`${url}: ${response.status}`);
    const bytes=Buffer.from(await response.arrayBuffer());const file=url.split('/').at(-1);
    writeFileSync(resolve(root,file),bytes);
    files.push({url,file,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length});
  }
  writeFileSync(resolve(root,'sources.json'),JSON.stringify({index,files},null,2)+'\n');
}
const manifest=JSON.parse(readFileSync(resolve(root,'sources.json'),'utf8'));
const contests=manifest.files.map(source=>{
  const bytes=readFileSync(resolve(root,source.file));
  if(createHash('sha256').update(bytes).digest('hex')!==source.sha256)throw Error(`Checksum mismatch: ${source.file}`);
  return parseAssemblyWorkbook(bytes,source);
}).sort((a,b)=>a.name.localeCompare(b.name));
if(contests.length!==18 || contests.reduce((sum,c)=>sum+c.seats,0)!==90)throw Error('Expected 18 constituencies and 90 seats');
const totals=new Map();
for(const contest of contests)for(const c of contest.candidates){
  const row=totals.get(c.party)??{party:c.party,firstPreferences:0,seats:0};row.firstPreferences+=c.firstPreferences;row.seats+=Number(c.elected);totals.set(c.party,row);
}
const election={id:'assembly-2022',year:2022,date:'2022-05-05',name:'Northern Ireland Assembly',nation:'northern-ireland',system:'Single Transferable Vote',href:'/assembly/2022',seats:90,contests:18,coverage:'All 18 constituencies; recorded results and count stages, no ballot-level rankings.'};
const output=resolve('src/lib/data/assembly');mkdirSync(output,{recursive:true});
const result={election,source:manifest.index,licenceNote:'Official EONI results; Crown copyright. Source URLs and checksums preserved. No individual ballot records supplied.',parties:[...totals.values()].sort((a,b)=>b.seats-a.seats||b.firstPreferences-a.firstPreferences),contests};
writeFileSync(resolve(output,'2022.json'),JSON.stringify(result)+'\n');
writeFileSync(resolve(output,'catalog.json'),JSON.stringify({elections:[election]},null,2)+'\n');
console.log(`Imported ${contests.length} constituencies, ${election.seats} seats; ${contests.reduce((n,c)=>n+c.stages.length,0)} stages, ${contests.flatMap(c=>c.notes).length} source reconciliation notes`);
