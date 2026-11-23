// Shape of src/lib/data/holyrood/<year>.json, written by
// scripts/etl-holyrood.mjs. The constituency ballot and the regional
// ballot are separate objects throughout; there is deliberately no
// field that adds them together.

export interface HolyroodSource {
  file: string;
  url: string;
  landingPage: string;
  publisher: string;
  title: string;
  role: string;
  licence: string;
  retrievedAt: string;
  sha256: string;
}

export interface HolyroodParty {
  id: string;
  name: string;
  shortName: string;
  color: string;
  kind: 'party' | 'individual';
}

export interface SeatRow {
  partyId: string;
  constituency: number;
  regional: number;
  total: number;
}

export interface BallotPartyRow {
  partyId: string;
  votes: number;
  /** Share of valid votes on this ballot. */
  share: number;
  /** Seats won on this ballot (constituency seats or regional seats). */
  seats: number;
}

export interface BallotSummary {
  electorate: number;
  validVotes: number;
  rejected: number;
  ballotsCounted: number;
  /** ballotsCounted / electorate. */
  turnout: number;
  parties: BallotPartyRow[];
}

export interface ConstituencyCandidate {
  name: string;
  partyId: string;
  votes: number;
  share: number;
  rank: number;
  elected: boolean;
}

export interface Constituency {
  slug: string;
  name: string;
  regionSlug: string;
  electorate: number;
  validVotes: number;
  rejected: number;
  ballotsCounted: number;
  turnout: number;
  majority: number;
  winner: { name: string; partyId: string };
  candidates: ConstituencyCandidate[];
  /** Regional list votes counted in this constituency (SPICe). */
  regionalVote: {
    validVotes: number;
    parties: { partyId: string; votes: number; share: number }[];
  } | null;
}

export interface AllocationFigure {
  id: string;
  votes: number;
  constituencySeats: number;
  listSeatsBefore: number;
  divisor: number;
  quotient: number;
}

export interface AllocationRound {
  round: number;
  winner: string;
  memberName: string;
  /** All eligible figures in this round, highest first. */
  figures: AllocationFigure[];
}

export interface RegionPartyRow {
  partyId: string;
  votes: number;
  share: number;
  constituencySeats: number;
  regionalSeats: number;
}

export interface ListCandidate {
  name: string;
  position: number;
  outcome: 'regional' | 'constituency' | 'not-elected';
  constituencySlug: string | null;
}

export interface Region {
  slug: string;
  name: string;
  constituencySlugs: string[];
  electorate: number;
  validVotes: number;
  rejected: number;
  ballotsCounted: number;
  turnout: number;
  parties: RegionPartyRow[];
  allocation: AllocationRound[];
  members: { name: string; partyId: string; listPosition: number | null; round: number }[];
  lists: { partyId: string; candidates: ListCandidate[] }[];
  individualCandidates: { partyId: string; name: string; votes: number }[];
  regionalVoteByConstituencyReconciles: boolean;
}

export interface Msp {
  name: string;
  partyId: string;
  seatType: 'constituency' | 'regional';
  constituencySlug: string | null;
  regionSlug: string;
  listPosition: number | null;
}

export interface Discrepancy {
  scope: string;
  field: string;
  used: number | string;
  usedSource: string;
  others: { source: string; value: number | string }[];
  note: string;
}

export interface HolyroodElection {
  id: string;
  year: number;
  date: string;
  name: string;
  nation: string;
  system: string;
  boundaries: string;
  asElected: string;
  generatedAt: string;
  etlVersion: string;
  sources: HolyroodSource[];
  members: { total: number; constituency: number; regional: number; seatsPerRegion: number };
  parties: HolyroodParty[];
  seats: SeatRow[];
  constituencyVote: BallotSummary;
  regionalVote: BallotSummary;
  regions: Region[];
  constituencies: Constituency[];
  msps: Msp[];
  discrepancies: Discrepancy[];
}

/** Integration contract for the all-elections hub. */
export interface CatalogEntry {
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
