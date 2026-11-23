// Party identities for the 2026 Scottish Parliament import.
//
// Each source spells parties differently (EMB upper case, SPICe with
// typos, Democracy Club with registered names and joint descriptions).
// Every spelling we accept is listed explicitly. An unknown spelling
// makes the importer fail rather than guess.

export const PARTIES = [
  { id: 'snp', name: 'Scottish National Party', shortName: 'SNP', color: '#FDF38E' },
  { id: 'lab', name: 'Scottish Labour', shortName: 'Labour', color: '#E4003B' },
  { id: 'con', name: 'Scottish Conservatives', shortName: 'Conservative', color: '#0087DC' },
  { id: 'ld', name: 'Scottish Liberal Democrats', shortName: 'Lib Dem', color: '#FAA61A' },
  { id: 'grn', name: 'Scottish Greens', shortName: 'Green', color: '#00A651' },
  { id: 'ref', name: 'Reform UK', shortName: 'Reform', color: '#12B6CF' },
  { id: 'alsco', name: 'Alliance to Liberate Scotland', shortName: 'Liberate Scotland', color: '#7A5C99' },
  { id: 'ifs', name: 'Independence for Scotland Party', shortName: 'ISP', color: '#5B7DB1' },
  { id: 'igv', name: 'Independent Green Voice', shortName: 'IGV', color: '#8CB369' },
  { id: 'family', name: 'Scottish Family Party', shortName: 'Family', color: '#9A8C73' },
  { id: 'ssp', name: 'Scottish Socialist Party', shortName: 'SSP', color: '#C41E3A' },
  { id: 'tusc', name: 'Trade Unionist and Socialist Coalition', shortName: 'TUSC', color: '#B5303F' },
  { id: 'workers', name: 'Workers Party of Britain', shortName: 'Workers', color: '#8E1B2B' },
  { id: 'slp', name: 'Socialist Labour Party', shortName: 'Socialist Labour', color: '#A3122A' },
  { id: 'cpb', name: 'Communist Party of Britain', shortName: 'Communist', color: '#9E0B0F' },
  { id: 'ukip', name: 'UK Independence Party (UKIP)', shortName: 'UKIP', color: '#70147A' },
  { id: 'advance', name: 'Advance UK', shortName: 'Advance UK', color: '#2C3E73' },
  { id: 'adf', name: 'Alliance for Democracy and Freedom', shortName: 'ADF', color: '#B8A040' },
  { id: 'freedom', name: 'Freedom Alliance', shortName: 'Freedom Alliance', color: '#C2A850' },
  { id: 'libertarian', name: 'Scottish Libertarian Party', shortName: 'Libertarian', color: '#D9B300' },
  { id: 'common', name: 'Scottish Common Party', shortName: 'Common', color: '#6E8B8B' },
  { id: 'heritage', name: 'Scottish Heritage Party', shortName: 'Heritage', color: '#5C4033' },
  { id: 'christian', name: 'Scottish Christian Party', shortName: 'Christian', color: '#8B7D3A' },
  { id: 'rural', name: 'Scottish Rural Party', shortName: 'Rural', color: '#6B8E23' },
  { id: 'liberal', name: 'The Scottish Liberal Party', shortName: 'Liberal', color: '#E8A33D' },
  { id: 'animal', name: 'Animal Welfare Party', shortName: 'Animal Welfare', color: '#7DAF53' },
  { id: 'equality', name: 'Equality Party', shortName: 'Equality', color: '#A07AAE' },
  { id: 'eelp', name: 'Edinburgh & East Lothian People', shortName: 'EELP', color: '#7F7F9F' },
  { id: 'abolish', name: 'Abolish the Scottish Parliament Party', shortName: 'Abolish', color: '#4A4A6A' },
  { id: 'bup', name: 'British Unionist Party', shortName: 'British Unionist', color: '#3B4A7A' }
];

export const PARTY_IDS = new Set(PARTIES.map((p) => p.id));

const norm = (s) => s.toLowerCase().replace(/[“”"’']/g, '').replace(/\s+/g, ' ').trim();

// EMB workbook column / row labels.
const EMB = {
  'reform uk': 'ref',
  'scottish conservative and unionist party': 'con',
  'scottish green party': 'grn',
  'scottish labour party': 'lab',
  'scottish liberal democrats': 'ld',
  'scottish national party (snp)': 'snp',
  'abolish the scottish parliament': 'abolish',
  'advance uk': 'advance',
  'alliance for democracy and freedom': 'adf',
  'scottish alliance for democracy and freedom': 'adf',
  'alliance to liberate scotland': 'alsco',
  'animal welfare party': 'animal',
  'communist party of britain': 'cpb',
  'edinburgh & east lothian people': 'eelp',
  'equality party': 'equality',
  'independence for scotland party': 'ifs',
  'independent green voice': 'igv',
  'scottish christian party proclaiming christs lordship': 'christian',
  'scottish common party': 'common',
  'scottish family party': 'family',
  'scottish heritage party': 'heritage',
  'scottish libertarian party': 'libertarian',
  'scottish rural party': 'rural',
  'scottish socialist party': 'ssp',
  'scottish workers party of britain': 'workers',
  'socialist labour party': 'slp',
  'the scottish liberal party': 'liberal',
  'uk independence party (ukip)': 'ukip',
  'british unionist party and abolish the scottish parliament party': 'bup',
  'freedom alliance': 'freedom',
  'scottish trade unionist and socialist coalition': 'tusc'
};

// Democracy Club party_id values.
const DC = {
  PP102: 'snp',
  PP53: 'lab',
  'joint-party:53-119': 'lab',
  PP52: 'con',
  PP90: 'ld',
  PP130: 'grn',
  PP7931: 'ref',
  PP18280: 'alsco',
  'joint-party:12666-18280': 'alsco',
  PP17976: 'common',
  PP804: 'tusc',
  PP11382: 'workers',
  PP18211: 'advance',
  PP10288: 'adf',
  PP2834: 'bup',
  PP15208: 'libertarian',
  PP18303: 'eelp',
  PP17509: 'freedom',
  PP6380: 'family',
  PP46: 'ssp',
  PP85: 'ukip',
  PP293: 'igv',
  PP11433: 'ifs',
  PP73: 'slp',
  PP616: 'animal',
  PP12550: 'heritage',
  PP17964: 'equality',
  PP2893: 'christian',
  PP18194: 'rural',
  PP54: 'liberal',
  PP6673: 'abolish',
  PP78: 'cpb'
};

// SPICe "Tool 4 Regional data" party labels (regional votes by constituency).
const SPICE_REGIONAL = {
  'reform uk': 'ref',
  'scottish conservative & unionist party': 'con',
  'scottish green party': 'grn',
  'scottish labour party': 'lab',
  'scottish liberal democrats': 'ld',
  'scottish national party': 'snp',
  'advance uk': 'advance',
  'alliance to liberate scotland': 'alsco',
  'independence for scotland party': 'ifs',
  'independent green voice': 'igv',
  'scottish family party': 'family',
  'scottish socialist party': 'ssp',
  'workers of britain': 'workers',
  'abolish the scottish parliament party': 'abolish',
  'scottish libertarian party': 'libertarian',
  'uk independence party (ukip)': 'ukip',
  'scottish christian party': 'christian',
  'scottish rural party': 'rural',
  'alliance for democracy and freedom': 'adf',
  'scottish common party': 'common',
  'scottish heritage party': 'heritage',
  'socialist labour': 'slp',
  'the scottish liberal party': 'liberal',
  'animal welfare party': 'animal',
  'communist party of britain': 'cpb',
  'edinburgh & east lothian people': 'eelp',
  'equality party': 'equality'
};

function lookup(table, label, source) {
  const id = table[norm(label)] ?? table[label];
  if (!id) throw new Error(`[holyrood] unmapped ${source} party label: ${JSON.stringify(label)}`);
  return id;
}

export const embParty = (label) => lookup(EMB, label, 'EMB');
export const dcParty = (partyId) => lookup(DC, partyId, 'Democracy Club');
export const spiceRegionalParty = (label) => lookup(SPICE_REGIONAL, label, 'SPICe');

/** Stable id for an individual (non-party) candidate. */
export function independentId(name) {
  return (
    'ind-' +
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
}
