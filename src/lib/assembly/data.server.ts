import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export interface AssemblyCandidate { name: string; party: string; firstPreferences: number; elected: boolean; electionOrder: number | null; sourceStatus: string | number; sourceElectionOrder: string | number | null }
export interface AssemblyStage { number: number; action: string; candidates: {name: string; value: number}[]; nonTransferable: number; accounted: number; reconciled: boolean }
export interface AssemblyContest { name: string; slug: string; electorate: number; seats: number; rejectedBallots: number; quota: number; ballotsCast: number; validBallots: number; turnout: number; candidates: AssemblyCandidate[]; stages: AssemblyStage[]; source: {url: string;file: string;sha256: string}; notes: string[] }
export interface AssemblyResults { election: {id:string;year:number;date:string;name:string;href:string;seats:number;contests:number;coverage:string}; source: string; licenceNote:string; parties:{party:string;firstPreferences:number;seats:number}[]; contests:AssemblyContest[] }
export const assemblyResults: AssemblyResults = JSON.parse(readFileSync(resolve('src/lib/data/assembly/2022.json'),'utf8'));
export function assemblySitemapUrls() { return ['/assembly','/assembly/2022',...assemblyResults.contests.map(c=>`/assembly/2022/${c.slug}`)]; }
