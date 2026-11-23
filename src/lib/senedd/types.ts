// Shape of src/lib/data/senedd/2026.json, written by
// scripts/senedd/import-2026.mjs. Plain strings and numbers only.

export interface SeneddCandidate {
  /** 1-based position on the list as printed on the ballot paper. */
  position: number;
  name: string;
  /** Democracy Club person id ('' if unmatched). */
  dcPersonId: string;
  /** Original status in the official elected-candidates summary. */
  electedSource: boolean;
  elected: boolean;
  /** Seat number (1–6) in the constituency allocation order; 0 if not elected. */
  seat: number;
}

export interface SeneddEntry {
  /** Party slug, or `individual-<name>` for an independent candidate. */
  id: string;
  kind: 'party' | 'individual';
  /** Exactly as printed on vote.wales (registered ballot description). */
  ballotLabel: string;
  /** Democracy Club / Electoral Commission party id ('ynmp-party:2' for independents). */
  partyId: string;
  /** Canonical name for $lib/party-colors (e.g. 'Labour Party'). */
  party: string;
  /** Name the party campaigned under (e.g. 'Welsh Labour'). */
  displayName: string;
  /** Votes for the list (one total per list, never per candidate). */
  votes: number;
  /** votes ÷ valid votes in the constituency. */
  share: number;
  seatsWon: number;
  seatsWonSource: number;
  candidates: SeneddCandidate[];
}

export interface SeneddElectedMember {
  seat: number;
  entryId: string;
  name: string;
  listPosition: number;
  party: string;
  displayName: string;
  /** Seat allocation figure (votes ÷ divisor) that won the seat. */
  figure: number;
  divisor: number;
}

export interface SeneddQuotientRow {
  entryId: string;
  figures: { divisor: number; figure: number; seat: number }[];
}

export interface SeneddConstituency {
  slug: string;
  name: string;
  voteWalesUrl: string;
  seats: number;
  electorate: number;
  validVotes: number;
  rejectedBallots: number;
  /** validVotes + rejectedBallots. */
  ballotsAtCount: number;
  /** validVotes ÷ electorate (the briefing's stated basis). */
  turnoutValid: number;
  /** ballotsAtCount ÷ electorate. */
  turnoutBallotsAtCount: number;
  /** Turnout as printed in the Senedd Research briefing, in percent. */
  turnoutPublishedPct: number;
  /** Which basis the printed figure matches. */
  turnoutPublishedBasis: 'valid-votes' | 'ballots-at-count' | 'unexplained';
  entries: SeneddEntry[];
  elected: SeneddElectedMember[];
  quotients: SeneddQuotientRow[];
  lastSeat: {
    figure: number;
    entryId: string;
    nextEntryId: string;
    nextFigure: number;
    nextDivisor: number;
    nextCandidate: string;
  };
  tiesInAllocation: number;
}

export interface SeneddNationalParty {
  id: string;
  party: string;
  displayName: string;
  partyId: string;
  votes: number;
  seats: number;
  share: number;
  seatShare: number;
  constituenciesContested: number;
  candidates: number;
}

export interface SeneddSource {
  file: string;
  url: string;
  publisher: string;
  title: string;
  licence: string;
  usedFor: string;
  sha256: string;
}

export interface SeneddElection {
  id: string;
  year: number;
  date: string;
  name: string;
  nation: string;
  system: string;
  seats: number;
  manifest: {
    etlVersion: string;
    generatedAt: string;
    sources: SeneddSource[];
    checks: string[];
  };
  national: {
    electorate: number;
    validVotes: number;
    rejectedBallots: number;
    ballotsAtCount: number;
    turnoutValid: number;
    turnoutPublishedPct: number;
    seats: number;
    parties: SeneddNationalParty[];
  };
  constituencies: SeneddConstituency[];
}

export interface SeneddCatalogEntry {
  id: string;
  year: number;
  date: string;
  name: string;
  href: string;
  nation: string;
  system: string;
  seats: number;
  contests: number;
  coverage: string;
}
