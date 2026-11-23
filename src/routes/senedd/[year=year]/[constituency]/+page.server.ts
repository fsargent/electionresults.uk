import { error } from '@sveltejs/kit';
import { seneddConstituency, seneddElection, seneddYears } from '$lib/senedd/data';

export const prerender = true;

export function entries() {
  return seneddYears().flatMap((year) =>
    seneddElection(year)!.constituencies.map((c) => ({ year: String(year), constituency: c.slug }))
  );
}

export function load({ params }: { params: { year: string; constituency: string } }) {
  const year = Number(params.year);
  const election = seneddElection(year);
  const c = election ? seneddConstituency(year, params.constituency) : null;
  if (!election || !c) throw error(404, `No Senedd constituency "${params.constituency}" for ${params.year}`);
  const i = election.constituencies.findIndex((x) => x.slug === c.slug);
  const n = election.constituencies.length;
  const neighbour = (k: number) => {
    const x = election.constituencies[(i + k + n) % n];
    return { slug: x.slug, name: x.name };
  };
  return {
    year,
    electionName: election.name,
    date: election.date,
    constituency: c,
    sources: election.manifest.sources,
    generatedAt: election.manifest.generatedAt,
    prev: neighbour(-1),
    next: neighbour(1)
  };
}
