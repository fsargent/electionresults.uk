// Per-constituency drill-down loader. Enumerated at build time off
// the ingested constituencies for each ingested year, so the prerender
// set is exactly the data we shipped — no silent empty pages.
//
// The whole result (contest meta + candidate list) is read in one
// disk hit per request; that's <5 MB per year (AR22 budget). Per AR8
// the loader does no metric maths — it just returns what's on disk.

import { error } from '@sveltejs/kit';
import {
  constituenciesForYear,
  ingestedYears,
  manifestForYear
} from '$lib/parliament/data';
import type {
  IngestedConstituency,
  SourceManifest
} from '$lib/parliament/types';

export const prerender = true;

export function entries() {
  const out: { year: string; constituency: string }[] = [];
  for (const year of ingestedYears()) {
    for (const c of constituenciesForYear(year)) {
      out.push({ year: String(year), constituency: c.constituencySlug });
    }
  }
  return out;
}

export function load({
  params
}: {
  params: { year: string; constituency: string };
}): {
  year: number;
  contest: IngestedConstituency;
  manifest: SourceManifest;
} {
  const year = Number(params.year);
  if (!Number.isFinite(year) || !ingestedYears().includes(year)) {
    throw error(404, `No ingested parliamentary election for year ${params.year}`);
  }
  const contest = constituenciesForYear(year).find(
    (c) => c.constituencySlug === params.constituency
  );
  if (!contest) {
    throw error(
      404,
      `No constituency "${params.constituency}" in the ${year} general election`
    );
  }
  return { year, contest, manifest: manifestForYear(year) };
}
