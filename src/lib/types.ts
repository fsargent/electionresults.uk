export interface Candidate {
  name: string;
  party: string;
  votes: number;
  elected: boolean;
  rank: number;
}

export interface Race {
  year: number;
  electionDate: string;
  wardName: string;
  wardSlug: string;
  wardCode: string;
  council: string;
  councilSlug: string;
  authorityType: string;
  electionType: string;
  seats: number;
  electorate: number;
  ballots: number;
  invalidVotes: number;
  /** ballots cast minus spoiled / invalid ballots */
  validBallots: number;
  candidates: Candidate[];
  /** marginal-elected-candidate share of valid ballots; computed by ETL */
  winningPct: number;
  /** Droop quota — share needed under a proportional method: 1 / (seats + 1) */
  quota: number;
  /** winningPct − quota; signed gap (negative = below quota, positive = above) */
  underPar: number;
  /** convenience flag: true when underPar < 0 */
  isBelowQuota: boolean;
}

export interface CouncilSummary {
  year: number;
  electionDate: string;
  council: string;
  councilSlug: string;
  authorityType: string;
  raceCount: number;
  totalSeatCount: number;
  /** seats won where the marginal winning share fell below the Droop quota */
  belowQuotaSeatCount: number;
  /** belowQuotaSeatCount / totalSeatCount */
  belowQuotaShare: number;
}

export interface PartyViewRow {
  party: string;
  votes: number;
  voteShare: number;
  fptpSeats: number;
  fptpSeatShare: number;
  dhondtSeats: number;
  dhondtSeatShare: number;
  /** fptpSeats − dhondtSeats; positive = over-represented by FPTP */
  seatDelta: number;
}

export interface PartyView {
  year: number;
  council: string;
  councilSlug: string;
  totalSeats: number;
  totalVotes: number;
  rows: PartyViewRow[];
}

export interface CouncilReorganisation {
  councilSlug: string;
  councilName: string;
  event: 'created' | 'abolished';
  date: string;
  year: number;
  counterparts: string[];
}

/**
 * Annual snapshot of a council's actual running composition (per-party
 * seat counts), sourced from opencouncildata.co.uk. Reflects the council
 * as of the given year, including by-elections and defections — not
 * just the LEH cycle results. Used to define flips honestly (largest
 * party of the running composition changing, not just the cycle leader).
 */
export interface CompositionSnapshot {
  councilSlug: string;
  council: string;
  year: number;
  totalSeats: number;
  /** Canonical-party-name → seat count, for the 8 named parties oncd
   *  breaks out (Con/Lab/LD/Green/UKIP/Reform/PC/SNP). */
  parties: Record<string, number>;
  /** Catch-all bucket from the summary CSV — Independents and any
   *  party not in oncd's named columns, lumped into one count. */
  otherSeats: number;
  /** Per-councillor breakdown (party-name → seat count) sourced from
   *  the per-councillor CSVs. Includes the named parties AND the
   *  individual local parties (Ashfield Independents, Aspire,
   *  Havering Residents Association, etc.) that the summary CSV
   *  rolls into Other. Sum should match totalSeats but can differ
   *  by 1-2 seats due to Vacant seats / data drift between the two
   *  oncd products. Null when no per-councillor snapshot exists for
   *  this (council, year). */
  partiesDetailed: Record<string, number> | null;
  /** Largest single named party (ignores `otherSeats`); null if no data. */
  largestParty: string | null;
  largestPartySeats: number;
  /** True when the catch-all 'other' bucket exceeds every named party. */
  largestIsOtherDominant: boolean;
  /** Original `majority` text from opencouncildata for transparency. */
  sourceMajority: string;
}

export interface CouncilFlip {
  councilSlug: string;
  council: string;
  yearFrom: number;
  yearTo: number;
  fromParty: string;
  toParty: string;
  newPartyVoteFrom: number;
  newPartyVoteTo: number;
  newPartySeatFrom: number;
  newPartySeatTo: number;
  oldPartyVoteFrom: number;
  oldPartyVoteTo: number;
  oldPartySeatFrom: number;
  oldPartySeatTo: number;
  voteSwingNew: number;
  seatSwingNew: number;
  /** seat swing − vote swing in fraction units; positive = FPTP-amplified */
  disproportionScore: number;
}

export interface CycleSummary {
  year: number;
  electionDate: string;
  electionDateLabel: string;
  raceCount: number;
  seatCount: number;
  belowQuotaSeatCount: number;
  belowQuotaShare: number;
  councilCount: number;
}
