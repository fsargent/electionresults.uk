import { assemblyResults } from '$lib/assembly/data.server';
export const prerender = true;
export function load() {
  return { election: assemblyResults.election, source: assemblyResults.source,
    validBallots: assemblyResults.contests.reduce((s,c)=>s+c.validBallots,0),
    electorate: assemblyResults.contests.reduce((s,c)=>s+c.electorate,0),
    ballotsCast: assemblyResults.contests.reduce((s,c)=>s+c.ballotsCast,0),
    parties: assemblyResults.parties,
    contests: assemblyResults.contests.map(c=>({name:c.name,slug:c.slug,seats:c.seats,candidates:c.candidates.length})) };
}
