export interface Candidate {
  name: string;
  party: string;
  votes: number;
  elected: boolean;
  rank: number;
}

/** Voting system used for this race. FPTP covers single-member and
 *  bloc-vote multi-member English/Welsh wards; STV is Scotland (and
 *  any future Welsh STV adopters from 2027). The site's distortion /
 *  below-quota framing applies only to FPTP — STV races are surfaced
 *  separately as the contrast. */
export type VotingSystem = 'FPTP' | 'STV';

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
  /** Voting system this race used. Default 'FPTP' for legacy snapshots
   *  that pre-date the field. */
  system?: VotingSystem;
  seats: number;
  /** Null when the source doesn't report it (most pre-2025 LEH cycles
   *  omit it, DC 2026 leaves it blank for most wards). */
  electorate: number | null;
  /** Ballots cast as reported by the source. Null when the source
   *  doesn't publish it; in that case validBallots is approximated as
   *  votesSum / seats (the standard ERS bloc-vote adjustment). */
  ballots: number | null;
  /** Invalid / spoiled ballots; null when not reported. */
  invalidVotes: number | null;
  /** Voters who cast a valid ballot. From `ballots − invalidVotes`
   *  when both source-reported, otherwise approximated from
   *  votesSum / seats. */
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
  /** Voting system this council used. Default 'FPTP' for legacy
   *  snapshots that pre-date the field. */
  system?: VotingSystem;
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
  /** True when this snapshot was synthesised by the ETL rather than
   *  ingested from oncd. Currently only set on 2026 rows, derived from
   *  the oncd 2025 roster + the 2026 election winners (retain 2025
   *  incumbents whose Next Election ≠ 2026, replace the rest with the
   *  2026 results). Will be replaced by a real oncd row when oncd
   *  publishes its 2026 snapshot. */
  synthesised?: boolean;
  /** True when this is the latest oncd row for the council AND it is
   *  byte-identical to the previous year — almost always means oncd
   *  hasn't yet refreshed for this council and the row is a placeholder
   *  carry-forward. The data layer hides these from public views but
   *  keeps them available as a baseline for synthesise2026. */
  staleCopy?: boolean;
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

/**
 * Per (party, year) rollup powering /[party]/. Election-side numbers
 * (contestedSeats, seatsWon, voteShare, seatShare) come from the cycle's
 * partyView; chamber-side numbers (chamberSeats, chamberShare,
 * councilsLargest) sum the latest-known opencouncildata composition per
 * council ≤ year, so the chamber denominator is stable across years even
 * when one year's source coverage is partial.
 *
 * Cycle-pair note: cycleFamily = year % 4. Different councils poll in
 * different families, so year-on-year contestedSeats / seatsWon /
 * voteShare are NOT apples-to-apples across families. Chamber-side
 * numbers are comparable across all years.
 */
export interface PartyYearStats {
  party: string;
  year: number;
  cycleFamily: number;
  contestedSeats: number;
  seatsWon: number;
  votes: number;
  voteShare: number;
  seatShare: number;
  councilsContested: number;
  councilsWon: number;
  chamberSeats: number;
  chamberTotal: number;
  chamberShare: number;
  councilsLargest: number;
  councilsWithComposition: number;
}

/** One row per (party, year, council) where the party ran or held seats
 *  in that cycle's election. */
export interface PartyCouncilCycle {
  party: string;
  year: number;
  councilSlug: string;
  council: string;
  system: VotingSystem;
  contestedSeats: number;
  seatsWon: number;
  votes: number;
  voteShare: number;
  seatShare: number;
  dhondtSeats: number;
  /** fptpSeats − dhondtSeats; positive = over-represented by FPTP */
  seatDelta: number;
}

export interface PartyControlChange {
  party: string;
  year: number;
  councilsGained: {
    councilSlug: string;
    council: string;
    fromParty: string;
    yearFrom: number;
  }[];
  councilsLost: {
    councilSlug: string;
    council: string;
    toParty: string;
    yearFrom: number;
  }[];
}
