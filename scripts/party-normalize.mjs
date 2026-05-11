// Map LEH workbook party tokens (abbreviations or full names, per year)
// to the canonical full name used across the site.
// All abbreviations are upper-case-stripped before lookup.

// Labour and Co-operative Party candidates stand on a joint ticket with
// Labour and take the Labour whip in council; we collapse them to
// 'Labour Party' so the party-view tables don't double-count what is
// effectively one bloc. The 'Conservative and Unionist Party' is the
// party's full registered name; 'Conservative Party' is the everyday
// label and what we use throughout the site.
const ABBREV_TO_FULL = {
  LAB: 'Labour Party',
  'LAB CO-OP': 'Labour Party',
  'LAB CO OP': 'Labour Party',
  'LAB COOP': 'Labour Party',
  CON: 'Conservative Party',
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

// Long-form names some sources hand us that we collapse to a shorter
// canonical. Same rationale as the abbreviation map: Labour Co-op
// candidates take the Labour whip; "Conservative" is what everyone
// calls them. Scottish-source rows arrive with the regional party name
// (e.g. "Scottish National Party (SNP)", "Scottish Green Party") —
// collapse to the canonical site labels for cross-cycle consistency.
const LONG_FORM_REMAP = {
  'Labour and Co-operative Party': 'Labour Party',
  'Conservative and Unionist Party': 'Conservative Party',
  'Scottish National Party (SNP)': 'Scottish National Party',
  'Scottish Green Party': 'Green Party',
  'Scottish Conservative and Unionist Party': 'Conservative Party',
  'Scottish Liberal Democrats': 'Liberal Democrats',
  'Scottish Labour Party': 'Labour Party'
};

export function normalizeParty(raw) {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (ABBREV_TO_FULL[upper]) return ABBREV_TO_FULL[upper];
  if (LONG_FORM_REMAP[trimmed]) return LONG_FORM_REMAP[trimmed];
  // If the source already gave us a long-form name (it contains a space and
  // is mixed case), pass it through unchanged.
  if (trimmed.length > 6 || /\s/.test(trimmed)) return trimmed;
  // Short uppercase token that we don't recognise — keep as-is, the UI
  // will render and our colour map's heuristics will fall through to grey.
  return trimmed;
}
