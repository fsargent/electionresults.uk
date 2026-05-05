// Map LEH workbook party tokens (abbreviations or full names, per year)
// to the canonical full name used across the site.
// All abbreviations are upper-case-stripped before lookup.

const ABBREV_TO_FULL = {
  LAB: 'Labour Party',
  'LAB CO-OP': 'Labour and Co-operative Party',
  'LAB CO OP': 'Labour and Co-operative Party',
  'LAB COOP': 'Labour and Co-operative Party',
  CON: 'Conservative and Unionist Party',
  LD: 'Liberal Democrats',
  GREEN: 'Green Party',
  REF: 'Reform UK',
  UKIP: 'UK Independence Party (UKIP)',
  IND: 'Independent',
  TUSC: 'Trade Unionist and Socialist Coalition',
  HER: 'Heritage Party',
  HERITAGE: 'Heritage Party',
  HOME: 'Homeland Party',
  ED: 'English Democrats',
  SDP: 'Social Democratic Party',
  WPB: 'Workers Party of Britain',
  COMM: 'Communist Party of Britain',
  CPA: 'Christian Peoples Alliance',
  AWP: 'Animal Welfare Party',
  POW: 'Party Of Women',
  ADF: 'Alliance for Democracy and Freedom',
  LIB: 'The Liberal Party',
  MK: 'Mebyon Kernow - The Party for Cornwall',
  YORKS: 'Yorkshire Party',
  WP: 'Workers Party of Britain',
  BNP: 'British National Party',
  'BRIT DEM': 'British Democratic Party',
  'BRIT 1ST': 'Britain First',
  'SOC LAB': 'Socialist Labour Party',
  WALSOC: 'Welsh Socialist Republican Party',
  // Local groupings — keep short labels readable rather than coining a "full
  // name" we can't substantiate
  'IND NET': 'Independent Network',
  IOA: 'Independent Oxford Alliance',
  ITW: 'Independents for Tunbridge Wells',
  TWA: 'Tunbridge Wells Alliance',
  CANDI: 'Chesterfield And North Derbyshire Independents (CANDI)',
  OWL: 'Our West Lancashire',
  ASH: 'Ashfield Independents',
  'ASH IND': 'Ashfield Independents'
};

export function normalizeParty(raw) {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (ABBREV_TO_FULL[upper]) return ABBREV_TO_FULL[upper];
  // If the source already gave us a long-form name (it contains a space and
  // is mixed case), pass it through unchanged.
  if (trimmed.length > 6 || /\s/.test(trimmed)) return trimmed;
  // Short uppercase token that we don't recognise — keep as-is, the UI
  // will render and our colour map's heuristics will fall through to grey.
  return trimmed;
}
