export interface Candidate {
  name: string;
  party: string;
  partyAbbrev: string | null;
  votes: number;
  elected: boolean;
  rank: number;
}

export interface Race {
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
  /** quota − winningPct; positive = below par */
  underPar: number;
  /** convenience flag: true when underPar > 0 */
  isBelowQuota: boolean;
}

export interface CouncilSummary {
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

