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
  /** true when winningPct < 0.5 */
  isMinority: boolean;
}

export interface CouncilSummary {
  council: string;
  councilSlug: string;
  authorityType: string;
  raceCount: number;
  minorityWinnerSeatCount: number;
  totalSeatCount: number;
  minorityShare: number;
}

