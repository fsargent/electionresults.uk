import {error} from '@sveltejs/kit';
import {electionListings,electionYears} from '$lib/server/election-catalog';
export const prerender=true;
export function entries(){return electionYears().map(year=>({year:String(year)}));}
export function load({params}:{params:{year:string}}){
  const year=Number(params.year);const elections=electionListings().filter(e=>e.year===year);
  if(!elections.length)error(404,'No imported election results for this year');
  return {year,elections,years:electionYears()};
}
