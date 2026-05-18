// Parliament downloads index. Reads the ingested-years list and each
// year's manifest via the parliament accessor (AR20 — never imports
// JSON directly), and stats every CSV under static/data/parliament/
// at build time so the UI can render file sizes without runtime I/O.

import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ingestedYears,
  manifestForYear
} from '$lib/parliament/data';
import type { SourceManifest } from '$lib/parliament/types';

export const prerender = true;

export interface DownloadFile {
  filename: string;
  href: string;
  bytes: number | null;
  description: string;
}

export interface YearDownloads {
  year: number;
  manifest: SourceManifest;
  csvs: DownloadFile[];
}

const CSV_DIR = 'static/data/parliament';

const CSV_FILES = [
  {
    suffix: 'constituencies.csv',
    description:
      'One row per contest, with winner / runner-up / majority denormalised in.'
  },
  {
    suffix: 'candidates.csv',
    description: 'One row per candidate. The full unpivoted result set.'
  },
  {
    suffix: 'national-totals.csv',
    description:
      'One row per party — national vote share, seat share, and seat-delta.'
  }
];

function statOrNull(path: string): number | null {
  try {
    return statSync(path).size;
  } catch {
    return null;
  }
}

function csvsForYear(year: number): DownloadFile[] {
  return CSV_FILES.map(({ suffix, description }) => {
    const filename = `parliament-${year}-${suffix}`;
    const relative = `${CSV_DIR}/${year}/${filename}`;
    return {
      filename,
      // Static files under `static/` are served from the site root,
      // so `/data/parliament/<year>/<file>` is the public URL.
      href: `/data/parliament/${year}/${filename}`,
      bytes: statOrNull(resolve(process.cwd(), relative)),
      description
    };
  });
}

export function load(): { years: YearDownloads[] } {
  const years: YearDownloads[] = ingestedYears().map((year) => ({
    year,
    manifest: manifestForYear(year),
    csvs: csvsForYear(year)
  }));
  return { years };
}
