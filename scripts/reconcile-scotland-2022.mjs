#!/usr/bin/env bun
// Join the Electoral Management Board's council declaration returns to the
// existing candidate IDs. No count is simulated and no winner is inferred.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';
import { parseCsv } from './derive-scotland-profile-first-prefs.mjs';
const dir = 'source-data/council/scotland-2022/';
const bytes = readFileSync(dir + 'emb-results-2022.xlsx');
const book = XLSX.read(bytes);
const official = XLSX.utils.sheet_to_json(book.Sheets.RawDetails);
const rows = parseCsv(readFileSync('source-data/council/scotland-2022-stv-indylive.csv', 'utf8'));
const norm = s => s.normalize('NFKD').toLowerCase().replace(/[^a-z]/g, '');
const council = s => norm(s.replaceAll('&', 'and')).replace(/^the/, '').replace('cityof', '').replace('council', '');
const tokens = s => new Set(s.normalize('NFKD').toLowerCase().match(/[a-z]+/g));
const subset = (a,b) => [...a].every(x => b.has(x));
// Audited name variants/typographical and encoding differences. These select
// an existing declaration row; they never alter that row's votes or result.
const aliases = {
84288:'Richard BROOKS',85540:'Neil BAILLIE',84563:'James Richard WHITEHEAD',85233:'Ian WREN',85920:'Dawn MALCOLM',20260:'Norrie WORK',72481:'Edward John THORNLEY',20621:'Philip DOGGART',86182:'David Don JACOBSEN',21868:'KENNY MACLEOD',20541:'Ann JOHNSTONE',85616:'Keyrin James VON-DÃ–RING',6005:'Andrew MORRISON',85850:'Robert Jonathan HUGH-JONES',21131:'Martin James KEATINGS',6173:'William BONNAR',21646:'Allan GOW',85015:'OisÃ­n DUNCAN',84961:'Olu SHOKUNBI',85018:'Annie MCALLISTER',73450:'LeÃ³dhas Iain MASSIE',85017:'Jennie ROBERTSON',22647:'Peter Ã“ DONNGHAILE',22633:'Chris BIRT',22294:'Christopher Curley',85609:'Leslie TARR',84949:'JÃ©rÃ©mie FERNANDES',22177:'Alexander MCVEY',21312:'Heather BRANNAN-MCVEY',21975:'Michael James WILLIAMSON',86129:'Paula HUNTER',22465:'William Hannah BOYLE',22461:'Robert Durie HOWDEN',83827:'Thomas George ULLATHORNE',85269:'Ruth HUTCHISON'
};
const used = new Set();
const candidates = rows.map(r => {
 const pool = official.filter(e => council(e['Authority Name']) === council(r.council_name));
 let hits = pool.filter(e => norm(e.CandidateName) === norm(aliases[r.id] ?? r.name));
 if (!hits.length && !aliases[r.id]) hits = pool.filter(e => subset(tokens(e.CandidateName),tokens(r.name)) || subset(tokens(r.name),tokens(e.CandidateName)));
 if (hits.length > 1) hits = hits.filter(e => norm(e['Ward Number and Description']).includes(norm(r.ward_name)));
 if (hits.length !== 1) throw new Error(`${r.id} ${r.name}: ${hits.length} matches`);
 const e = hits[0];
 if (used.has(e)) throw new Error(`reused declaration row ${e.CandidateName}`);
 used.add(e);
 if ((e.CandidateElected === 'Yes') !== (r.elected === '1')) throw new Error(`elected flag disagreement ${r.name}`);
 return {id:r.id,councilSlug:r.council_id,wardCode:r.cand_ward_id,name:r.name,sourceName:e.CandidateName,sourceWard:e['Ward Number and Description'],report:e.ReportName,elected:e.CandidateElected === 'Yes',firstPreferences:e.NumberOfFirstPreferenceVotes ?? null,electorate:e.Electorate ?? null,validBallots:e['Total Ballot Papers Included In Count'] ?? null,invalidBallots:e['Total Ballot Papers Rejected'] ?? null,ballots:e['Total Ballot Papers'] ?? null};
});
const unmatched = official.filter(e => !used.has(e));
writeFileSync(dir+'official-reconciliation.json',JSON.stringify({source:{label:'Electoral Management Board for Scotland: council declaration returns 2022',url:'https://www.emb.scot/downloads/file/980/local-government-elections-2022-results-updated-with-postals-station-split',file:'emb-results-2022.xlsx',sheet:'RawDetails',sha256:createHash('sha256').update(bytes).digest('hex'),licence:'Official council returns; see publisher reuse terms'},candidates,unmatched},null,2)+'\n');
console.log(`${candidates.length} candidates reconciled; ${candidates.filter(c=>c.elected).length} elected; ${unmatched.length} unmatched workbook rows`);
console.log(unmatched);
