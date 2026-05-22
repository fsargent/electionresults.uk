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
  // Andrew Teale's LEAP archive uses single-letter "C" for Conservative
  // and "Grn" for Green. LEH uses CON / GREEN. Map both shapes here so
  // the LEAP and LEH cycles share canonical party names downstream.
  C: 'Conservative Party',
  GRN: 'Green Party',
  SNP: 'Scottish National Party',
  PC: 'Plaid Cymru',
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
  'ASH IND': 'Ashfield Independents',
  // Additional abbreviations resolved against the LEH "Party names" sheets
  // (2021/2022/2023/2024/2025). The candidate rows in those workbooks carry
  // the upper-cased abbreviation rather than the long name, so without this
  // map labels like "KNOW CMTY" or "CIIP" reach the UI unchanged.
  AGS: 'Alliance for Green Socialism',
  'ASHT IND': 'Ashtead Independents',
  BDP: 'British Democratic Party',
  BIG: 'Broxtowe Independent Group',
  CCH: 'Community Campaign (Hart)',
  CCP: 'Coventry Citizens Party',
  CIIP: 'Canvey Island Independent Party',
  CONFEL: 'Confelicity',
  CPB: 'Communist Party of Britain',
  EDEM: 'English Democrats',
  FOUND: 'Foundation Party',
  FRAG: 'Formby Residents Action Group',
  FREE: 'Freedom Party',
  'G & S IND': 'Garforth and Swillington Independents',
  GGG: 'Guildford Greenbelt Group',
  HALL: 'Harlow Alliance',
  'HAMPS IND': 'Hampshire Independents',
  IBIS: 'Ingleby Barwick Independent Society',
  // Bristol Knowle split from the Lib Dems in late 2021. Source ships the
  // truncated "Knowle Community"; the registered party name is
  // "Knowle Community Party".
  'KNOW CMTY': 'Knowle Community Party',
  LIBER: 'Libertarian Party',
  'LINCS IND': 'Lincolnshire Independents',
  'MAN IND': 'Mansfield Independents',
  MRLP: 'The Official Monster Raving Loony Party',
  OMRL: 'The Official Monster Raving Loony Party',
  NEP: 'North East Party',
  'NEW IND': 'Newcastle Independents',
  'NEWC IND': 'Newcastle Independents',
  NF: 'National Front',
  NH: 'Northern Heart',
  NHP: 'National Housing Party United Kingdom',
  NIP: 'Northern Independence Party',
  OK: 'One Kearsley',
  OSAC: 'Old Swan Against the Cuts',
  PABAG: 'People Against Bureaucracy Action Group',
  PATRIA: 'Patria',
  PEACE: 'The Peace Party - Non-violence, Justice, Environment',
  PIP: "People's Independent Party",
  'PORT IND': 'Portsmouth Independent Party',
  PSYCH: 'Psychedelic Movement',
  SAVE: 'Save Us Now',
  SUN: 'Save Us Now',
  SGRA: "Swanscombe and Greenhithe Residents' Association",
  'SHEV IND': 'Shevington Independents',
  SPGB: 'The Socialist Party of Great Britain',
  SWFCTA: 'South Woodham Ferrers Council Taxpayers Association',
  'TH IND': 'Thurrock Independents',
  WEP: "Women's Equality Party",
  WFI: 'Westhoughton First Independents',
  'WICK IND': 'Wickford Independents',
  'WS IND': 'West Suffolk Independents',
  'WYC IND': 'Wycombe Independents',
  YESHUA: 'Yeshua'
};

// Long-form names some sources hand us that we collapse to a shorter
// canonical. Same rationale as the abbreviation map: Labour Co-op
// candidates take the Labour whip; "Conservative" is what everyone
// calls them. Scottish-source rows arrive with the regional party name
// (e.g. "Scottish National Party (SNP)", "Scottish Green Party") —
// collapse to the canonical site labels for cross-cycle consistency.
const LONG_FORM_REMAP = {
  'Labour and Co-operative Party': 'Labour Party',
  'Labour and Co-operative': 'Labour Party',
  'Conservative and Unionist Party': 'Conservative Party',
  'Scottish National Party (SNP)': 'Scottish National Party',
  'Scottish Green Party': 'Green Party',
  'Scottish Conservative and Unionist Party': 'Conservative Party',
  'Scottish Liberal Democrats': 'Liberal Democrats',
  'Scottish Labour Party': 'Labour Party',
  // Commons Library parliamentary-data labels — the GE source uses
  // the bare nominal ("Labour", "Conservative") and singular forms
  // ("Liberal Democrat") that the council LEH workbooks don't.
  // Mapping to the canonical site label keeps cross-domain party
  // colours and links consistent without forking the normalizer.
  Conservative: 'Conservative Party',
  Labour: 'Labour Party',
  'Liberal Democrat': 'Liberal Democrats',
  Green: 'Green Party',
  'Sinn Fein': 'Sinn Féin',
  // The Speaker stands as "Speaker seeking re-election" with no
  // party. Keep the source label as-is so the caveat-detection step
  // (scripts/lib/parliament-validate.mjs) recognises and tags the
  // Chorley seat; the metrics layer excludes Speaker from party
  // totals.
  Speaker: 'Speaker'
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
