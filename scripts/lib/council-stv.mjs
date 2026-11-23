// Council STV coverage: Scotland 2022 gap-fill and Northern Ireland 2023.
//
// Two outputs:
//  1. Contested STV contests as ordinary `Race` records (first preferences as
//     `votes`, official elected flags). These feed the existing council pages
//     and nation summaries. STV races stay out of every below-quota view.
//  2. A domain dataset per election (src/lib/data/council-stv/*.json) that
//     also holds the no-poll wards (vote fields null, never 0), seat/vacancy
//     reconciliation, quotas, official count stages where reliable, and
//     per-contest source provenance.
//
// Nothing here simulates an STV count. Winners come from official
// declarations; first preferences come from official count sheets. Scottish
// preference-profile tallies provide a separate audit, never elected flags.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export const SCOTLAND_PROFILE_FILE = 'source-data/council/scotland-2022-profile-first-preferences.csv';
export const NI_2023_DIR = 'source-data/council/northern-ireland-2023';

export const SCOTLAND_SOURCES = {
  indylive: {
    label: 'IndyLive / Gerry Mulvenna Scottish council results 2022 (incl. Democracy Club candidate data)',
    url: 'https://election.indylive.radio/',
    licence: 'CC BY-SA 4.0'
  },
  profiles: {
    label: 'First preferences counted from council-published ballot preference profiles, compiled by Denis Mollison (Heriot-Watt)',
    url: 'https://www.macs.hw.ac.uk/~denis/stv_elections/SC2022/',
    licence: 'Aggregate counts only; profiles not redistributed (compilation states no licence)'
  }
};

export const NI_SOURCE = {
  label: 'Electoral Office for Northern Ireland, Local council elections 2023 results',
  url: 'https://www.eoni.org.uk/results-data/local-council-elections-2023-results/',
  licence: 'Crown copyright. EONI links to general Crown copyright guidance; no asset-specific licence statement is supplied'
};

/** Read the derived profile tally, keyed by IndyLive candidate id. */
export function loadScottishProfileFirstPrefs(root, parseCsv) {
  const file = resolve(root, SCOTLAND_PROFILE_FILE);
  if (!existsSync(file)) return new Map();
  const rows = parseCsv(readFileSync(file, 'utf8'));
  return new Map(rows.map((r) => [String(r.indylive_candidate_id), {
    firstPrefs: Number(r.first_prefs),
    validBallots: Number(r.profile_valid_ballots),
    check: r.check,
    file: r.profile_file
  }]));
}

// --- Northern Ireland ------------------------------------------------------

const NI_COUNCILS = {
  'Antrim and Newtownabbey Borough Council': ['antrim-and-newtownabbey', 'Antrim and Newtownabbey'],
  'Ards and North Down Borough Council': ['ards-and-north-down', 'Ards and North Down'],
  'Armagh City, Banbridge and Craigavon Borough Council': ['armagh-city-banbridge-and-craigavon', 'Armagh City, Banbridge and Craigavon'],
  'Belfast City Council': ['belfast', 'Belfast'],
  'Causeway Coast and Glens Borough Council': ['causeway-coast-and-glens', 'Causeway Coast and Glens'],
  'Derry City and Strabane District Council': ['derry-city-and-strabane', 'Derry City and Strabane'],
  'Fermanagh and Omagh District Council': ['fermanagh-and-omagh', 'Fermanagh and Omagh'],
  'Lisburn and Castlereagh City Council': ['lisburn-and-castlereagh', 'Lisburn and Castlereagh'],
  'Mid and East Antrim Borough Council': ['mid-and-east-antrim', 'Mid and East Antrim'],
  'Mid Ulster District Council': ['mid-ulster', 'Mid Ulster'],
  'Newry, Mourne and Down District Council': ['newry-mourne-and-down', 'Newry, Mourne and Down']
};
export function niCouncil(name) {
  const hit = NI_COUNCILS[name] ?? Object.entries(NI_COUNCILS)
    .find(([k, [, short]]) => k.toLowerCase().startsWith(name.toLowerCase()) || short.toLowerCase() === name.toLowerCase())?.[1];
  if (!hit) throw new Error(`[etl NI] unknown council "${name}"`);
  return { slug: hit[0], name: hit[1] };
}

// Canonical labels match the Westminster dataset (party-colors.ts).
const NI_PARTY_RULES = [
  [/^(sf|sinn f[eé]in)/i, 'Sinn Féin'],
  [/d\.?u\.?p|^democratic unionist|^democratic ulster unionist/i, 'Democratic Unionist Party'],
  [/^(all|alliance)( party)?$|^alliance party/i, 'Alliance'],
  [/^(uup|ulster unionist)/i, 'Ulster Unionist Party'],
  [/^sdlp|social democratic (and|&) labour/i, 'Social Democratic and Labour Party'],
  [/^tuv|traditional unionist/i, 'Traditional Unionist Voice'],
  [/^(grn|green)/i, 'Green Party Northern Ireland'],
  [/^people before profit|^pbp/i, 'People Before Profit Alliance'],
  [/^aont[uú]/i, 'Aontú'],
  [/workers.? party/i, "Workers' Party"],
  [/^(con|conservative)/i, 'Conservative Party'],
  [/^(pup|progressive unionist)/i, 'Progressive Unionist Party'],
  [/^irsp/i, 'Irish Republican Socialist Party'],
  [/^socialist party/i, 'Socialist Party'],
  [/^(ind|indep|indepdendent)/i, 'Independent'],
  [/^not stated$|^$/i, '']
];
export function normalizeNiParty(raw) {
  const s = String(raw ?? '').trim();
  for (const [re, name] of NI_PARTY_RULES) if (re.test(s)) return name;
  return s;
}

/** Load whichever normalized EONI count files are present. Each file is an
 *  array of {council, dea, seats, quota, validBallots, invalidBallots,
 *  electorate, votesPolled, candidates[], stages[], source{}, notes[]}. */
export function loadNiCounts(root) {
  const dir = resolve(root, NI_2023_DIR);
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith('-counts.json')).sort()) {
    for (const rec of JSON.parse(readFileSync(resolve(dir, f), 'utf8'))) out.push({ ...rec, sourceFile: f });
  }
  return out;
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Build Race records + domain contests for NI 2023. */
export function ingestNi2023(root, { slugify }) {
  const recs = loadNiCounts(root);
  const races = [];
  const contests = [];
  const seen = new Set();
  for (const rec of recs) {
    const key = `${rec.council}|${rec.dea}`;
    if (seen.has(key)) throw new Error(`[etl NI] duplicate area ${key}`);
    seen.add(key);
    const { slug: councilSlug, name: council } = niCouncil(rec.council);
    const deaName = String(rec.dea).trim();
    const wardSlug = slugify(deaName);
    const seats = Number(rec.seats);
    const cands = rec.candidates.map((c) => ({
      name: c.name,
      party: normalizeNiParty(c.party),
      sourceParty: c.party,
      firstPreferences: c.firstPreferences == null ? null : Number(c.firstPreferences),
      elected: c.elected === true,
      sourceStatus: c.sourceStatus ?? null
    }));
    const fpSum = cands.reduce((a, c) => a + (c.firstPreferences ?? 0), 0);
    const validBallots = rec.validBallots != null ? Number(rec.validBallots) : null;
    const notes = [...(rec.notes ?? [])];
    if (validBallots != null && Math.abs(fpSum - validBallots) > 0.5)
      notes.push(`First preferences sum to ${fpSum}, compared with ${validBallots} valid ballots as published.`);
    const elected = cands.filter((c) => c.elected).length;
    if (elected !== seats) notes.push(`${elected} candidates marked elected for ${seats} seats.`);
    const source = {
      label: `${NI_SOURCE.label}: ${deaName}`,
      url: rec.source?.url ?? NI_SOURCE.url,
      licence: NI_SOURCE.licence,
      file: rec.source?.filename ?? null,
      sheet: rec.source?.sheet ?? null,
      sha256: rec.source?.sha256 ?? null,
      format: rec.sourceFile.replace(/-counts\.json$/, '')
    };
    contests.push({
      councilSlug, council, area: deaName, areaType: 'DEA', areaSlug: wardSlug, areaCode: null,
      seats, contested: cands.length > seats, seatsFilled: elected, vacancies: Math.max(0, seats - elected),
      electorate: rec.electorate ?? null, validBallots, invalidBallots: rec.invalidBallots ?? null,
      quota: rec.quota ?? null,
      candidates: cands,
      stages: Array.isArray(rec.stages) && rec.stages.length
        ? rec.stages.map((s) => ({
            number: s.number, action: s.action, incomplete: s.incomplete === true,
            totals: s.totals.map((v) => (v == null ? null : round2(Number(v)))),
            changes: (s.changes ?? []).map((v) => (v == null ? null : round2(Number(v)))),
            nonTransferable: s.nonTransferable == null ? null : round2(Number(s.nonTransferable))
          }))
        : null,
      firstPreferenceSource: 'official count sheet',
      sources: [source, ...(rec.relatedSources ?? []).map(s => ({ label: s.title, url: s.url, sha256: s.sha256 ?? null, file: s.filename ?? null, licence: 'Council declaration; see publisher reuse terms' }))], notes
    });
    if (!(validBallots > 0) || cands.some((c) => c.firstPreferences == null)) continue;
    const ranked = [...cands].sort((a, b) => b.firstPreferences - a.firstPreferences);
    races.push(stvRace({
      year: 2023, electionDate: '2023-05-18', key: `${councilSlug}::${wardSlug}`,
      wardCode: `NI-DEA-${wardSlug}`, wardName: deaName, wardSlug, council, councilSlug,
      authorityType: 'Northern Ireland district council', seats,
      electorate: rec.electorate ?? null, ballots: rec.votesPolled ?? null,
      invalidVotes: rec.invalidBallots ?? null, validBallots,
      candidates: ranked.map((c, i) => ({ name: c.name, party: c.party, votes: c.firstPreferences, elected: c.elected, rank: i + 1 }))
    }));
  }
  return { races, contests };
}

/** Fill the computed Race fields the same way the Scottish adapter does.
 *  winningPct/underPar are informational only for STV. */
export function stvRace(r) {
  const quota = 1 / (r.seats + 1);
  const pcts = r.candidates.filter((c) => c.elected).map((c) => c.votes / r.validBallots);
  const winningPct = pcts.length ? Math.min(...pcts) : 0;
  return { ...r, electionType: '', system: 'STV', winningPct, quota, underPar: winningPct - quota, isBelowQuota: winningPct - quota < 0 };
}

// --- Domain dataset --------------------------------------------------------

/** Summarise contests into the domain payload written to council-stv/. */
export function buildStvDomain({ id, nation, year, date, name, href, contests, sources }) {
  const councils = new Map();
  for (const c of contests) {
    const row = councils.get(c.councilSlug) ?? { slug: c.councilSlug, name: c.council, contests: 0, contested: 0, noPoll: 0, seats: 0, seatsFilled: 0, vacancies: 0 };
    row.contests++; row.seats += c.seats; row.seatsFilled += c.seatsFilled; row.vacancies += c.vacancies;
    if (c.contested) row.contested++; else row.noPoll++;
    councils.set(c.councilSlug, row);
  }
  const sum = (k) => contests.reduce((a, c) => a + (c[k] ?? 0), 0);
  const parties = new Map();
  for (const c of contests) for (const cand of c.candidates) {
    const p = cand.party || 'Independent';
    const row = parties.get(p) ?? { party: p, firstPreferences: 0, seats: 0, unopposedSeats: 0 };
    if (cand.firstPreferences != null) row.firstPreferences += cand.firstPreferences;
    if (cand.elected) { row.seats++; if (!c.contested) row.unopposedSeats++; }
    parties.set(p, row);
  }
  return {
    id, nation, year, date, name, href, system: 'STV',
    summary: {
      councils: councils.size, contests: contests.length,
      contested: contests.filter((c) => c.contested).length,
      noPoll: contests.filter((c) => !c.contested).length,
      seats: sum('seats'), seatsFilled: sum('seatsFilled'), vacancies: sum('vacancies'),
      validBallots: contests.reduce((a, c) => a + (c.contested ? c.validBallots ?? 0 : 0), 0),
      withStages: contests.filter((c) => c.stages).length
    },
    councils: [...councils.values()].sort((a, b) => a.name.localeCompare(b.name)),
    parties: [...parties.values()].map((p) => ({ ...p, firstPreferences: Math.round(p.firstPreferences * 100) / 100 }))
      .sort((a, b) => b.seats - a.seats || b.firstPreferences - a.firstPreferences),
    sources,
    contests: [...contests].sort((a, b) => a.council.localeCompare(b.council) || a.area.localeCompare(b.area))
  };
}

/** Catalog row for the coordinator's all-elections hub. */
export function catalogEntry(domain) {
  const s = domain.summary;
  const pending = s.noPoll ? `, ${s.noPoll} uncontested` : '';
  return {
    id: domain.id, year: domain.year, date: domain.date, name: domain.name, href: domain.href,
    nation: domain.nation, system: 'STV', seats: s.seats, contests: s.contests,
    coverage: `${s.councils} councils, ${s.contests} ${domain.nation === 'northern-ireland' ? 'District Electoral Areas' : 'wards'}${pending}; ` +
      `${s.seatsFilled} of ${s.seats} seats filled${s.vacancies ? ` (${s.vacancies} left vacant)` : ''}`
  };
}
