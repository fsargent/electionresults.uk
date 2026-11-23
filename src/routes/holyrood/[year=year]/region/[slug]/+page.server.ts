import { error } from '@sveltejs/kit';
import { holyroodElection, holyroodYears } from '$lib/holyrood/data';
export const prerender = true;
export function entries() {
  return holyroodYears().flatMap((year) => holyroodElection(year)!.regions.map((r) => ({ year: String(year), slug: r.slug })));
}
export function load({ params }: { params: { year: string; slug: string } }) {
  const e = holyroodElection(Number(params.year));
  const r = e?.regions.find((r) => r.slug === params.slug);
  if (!e || !r) error(404, 'Region result not found');
  return { year: e.year, region: r, parties: e.parties,
    constituencies: e.constituencies.filter((c) => c.regionSlug === r.slug).map((c) => ({ slug: c.slug, name: c.name, winner: c.winner })),
    sourcesElection: { sources: e.sources, asElected: e.asElected },
    discrepancies: e.discrepancies.filter((d) => d.scope === `region:${r.slug}`) };
}
