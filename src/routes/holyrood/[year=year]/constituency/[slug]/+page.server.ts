import { error } from '@sveltejs/kit';
import { holyroodElection, holyroodYears } from '$lib/holyrood/data';
export const prerender = true;
export function entries() {
  return holyroodYears().flatMap((year) => holyroodElection(year)!.constituencies.map((c) => ({ year: String(year), slug: c.slug })));
}
export function load({ params }: { params: { year: string; slug: string } }) {
  const e = holyroodElection(Number(params.year));
  const c = e?.constituencies.find((c) => c.slug === params.slug);
  if (!e || !c) error(404, 'Constituency result not found');
  const region = e.regions.find((r) => r.slug === c.regionSlug)!;
  return { year: e.year, constituency: c, region: { name: region.name, slug: region.slug, reconciles: region.regionalVoteByConstituencyReconciles },
    parties: e.parties, sourcesElection: { sources: e.sources, asElected: e.asElected },
    discrepancies: e.discrepancies.filter((d) => d.scope === `constituency:${c.slug}`) };
}
