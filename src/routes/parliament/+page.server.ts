// Overview loader for /parliament. Reads the index of ingested years
// and pulls each year's national summary so we can render a one-line
// editorial headline ("N minority-mandate seats") per election without
// the browser fetching anything. All disk reads happen here in the
// loader so +page.svelte stays client-safe (NFR1, NFR3, AR7, AR20).

import {
  ingestedYears,
  nationalSummaryForYear,
  manifestForYear
} from '$lib/parliament/data';
import type { NationalSummary, SourceManifest } from '$lib/parliament/types';

export const prerender = true;

interface ElectionCard {
  year: number;
  minorityWinnerCount: number;
  totalSeats: number;
  href: string;
}

export function load(): {
  elections: ElectionCard[];
  manifests: { year: number; manifest: SourceManifest }[];
} {
  const years = ingestedYears();
  const elections: ElectionCard[] = years.map((year) => {
    const summary: NationalSummary = nationalSummaryForYear(year);
    return {
      year,
      minorityWinnerCount: summary.minorityWinnerCount,
      totalSeats: summary.totalSeats,
      href: `/parliament/${year}`
    };
  });
  const manifests = years.map((year) => ({
    year,
    manifest: manifestForYear(year)
  }));
  return { elections, manifests };
}
