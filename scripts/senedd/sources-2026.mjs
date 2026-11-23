// Source registry for the 2026 Senedd general election. Shared by the
// fetcher and the importer so URLs and file names live in one place.

export const SOURCE_DIR = 'source-data/senedd/2026';

export const VOTE_WALES_BASE = 'https://vote.wales/election-results/';

/** vote.wales slugs, one per Senedd constituency (16). */
export const VOTE_WALES_SLUGS = [
  'afan-ogwr-rhondda',
  'bangor-conwy-mon',
  'blaenau-gwent-caerffili-rhymni',
  'brycheiniog-tawe-nedd',
  'caerdydd-ffynnon-taf',
  'caerdydd-penarth',
  'casnewydd-islwyn',
  'ceredigion-penfro',
  'clwyd',
  'fflint-wrecsam',
  'gwynedd-maldwyn',
  'gwyr-abertawe',
  'pen-y-bont-bro-morgannwg',
  'pontypridd-cynon-merthyr',
  'sir-fynwy-torfaen',
  'sir-gaerfyrddin'
];

export const COMMITTED_SOURCES = [
  {
    file: 'senedd-research-briefing-senedd-election-2026.pdf',
    url: 'https://research.senedd.wales/media/v4njg01m/senedd-election-2026.pdf',
    publisher: 'Senedd Research, Welsh Parliament',
    title: 'Senedd election 2026: Research Briefing (September 2026)',
    page: 'https://research.senedd.wales/research-articles/senedd-election-2026-analysis-of-the-results/',
    licence:
      '© Senedd Commission Copyright 2026. May be reproduced free of charge, accurately and not in a misleading context, acknowledging the Senedd Commission and the document title.',
    usedFor: 'Electorate, valid votes, rejected ballot papers, turnout and elected-member order per constituency'
  },
  {
    file: 'senedd-research-election_results_map.ods',
    url: 'https://research.senedd.wales/media/3jnp3wvb/election_results_map.ods',
    publisher: 'Senedd Research, Welsh Parliament',
    title: 'Senedd election: an initial analysis of the results — map data',
    page: 'https://research.senedd.wales/research-articles/senedd-election-an-initial-analysis-of-the-results/',
    licence: '© Senedd Commission Copyright 2026 (reproduction permitted with acknowledgement).',
    usedFor: 'Party winning each of seats 1–6 in every constituency (allocation order check)'
  },
  {
    file: 'senedd-research-election_results_table.ods',
    url: 'https://research.senedd.wales/media/4vrnwd1p/election_results_table.ods',
    publisher: 'Senedd Research, Welsh Parliament',
    title: 'Senedd election: an initial analysis of the results — votes table',
    page: 'https://research.senedd.wales/research-articles/senedd-election-an-initial-analysis-of-the-results/',
    licence: '© Senedd Commission Copyright 2026 (reproduction permitted with acknowledgement).',
    usedFor: 'National vote and seat totals for the six largest parties (reconciliation)'
  },
  {
    file: 'senedd-research-seats_won.ods',
    url: 'https://research.senedd.wales/media/q4tbrolq/seats_won.ods',
    publisher: 'Senedd Research, Welsh Parliament',
    title: 'Senedd election: an initial analysis of the results — seats won',
    page: 'https://research.senedd.wales/research-articles/senedd-election-an-initial-analysis-of-the-results/',
    licence: '© Senedd Commission Copyright 2026 (reproduction permitted with acknowledgement).',
    usedFor: 'National seat totals (reconciliation)'
  },
  {
    file: 'democracy-club-senedd-2026-candidates.csv',
    url: 'https://candidates.democracyclub.org.uk/data/export_csv/?election_date=2026-05-07&election_id=senedd&field_group=results&extra_fields=party_list_position&format=csv',
    publisher: 'Democracy Club',
    title: 'Candidates for senedd.2026-05-07 with list positions',
    page: 'https://candidates.democracyclub.org.uk/elections/senedd.2026-05-07/',
    licence: 'CC BY 4.0 (https://democracyclub.org.uk/copyright/)',
    usedFor:
      'Registered party identifiers and an independent check of list order. Its turnout fields are not used: several are copied from the wrong constituency.'
  }
];
