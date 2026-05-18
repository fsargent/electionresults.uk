// Parliamentary data types — the canonical TS contract shared by
// scripts/etl-parliament.mjs (writer) and every +page.server.ts under
// src/routes/parliament/ (reader). Match the architecture's data-model
// section verbatim; field naming is camelCase per AR16.
//
// `partyDisplayName` (canonical, post-normalization) and
// `partySourceLabel` (raw source string) both ride along on every
// candidate/national row so a downstream user can verify what we
// normalized away. `caveats: string[]` is present on every contest
// and candidate row — possibly empty, never omitted, never null.

export type ParliamentaryElectionType = 'general';

export interface Election {
  /** Stable identifier; convention: `ge-<year>` (e.g. `ge-2024`). */
  id: string;
  type: ParliamentaryElectionType;
  /** ISO 8601 date of polling day. */
  date: string;
  /** BoundarySet.id this election was contested under. */
  boundarySet: string;
  /** SourceManifest.id used to ingest this election's data. */
  sourceManifestId: string;
  /** Free-form notes on the election (cross-domain caveats, etc.). */
  notes?: string;
}

export interface BoundarySet {
  /** Stable identifier; convention: `<year>-review` (e.g. `2023-review`). */
  id: string;
  name: string;
  /** ISO 8601 date — first election this boundary set was in force for. */
  inForceFrom: string;
  /** ISO 8601 date — null/undefined while still in force. */
  inForceTo?: string;
  notes?: string;
}

export interface Constituency {
  /** Composite key: `${boundarySet}:${slug}`. Name alone is NOT stable
   *  across boundary reviews — same name can refer to different
   *  geographies in different reviews. */
  id: string;
  /** Canonical display name. */
  name: string;
  /** URL slug (lowercase kebab-case, AR18). */
  slug: string;
  /** Original source label, preserved for verification (NFR14). */
  sourceLabel: string;
  /** BoundarySet.id this constituency belongs to. */
  boundarySet: string;
  /** Country code: 'england' | 'scotland' | 'wales' | 'northern-ireland'. */
  country: 'england' | 'scotland' | 'wales' | 'northern-ireland';
}

export type ContestType = 'single-member' | 'multi-member-historical';

export type CaveatToken =
  | 'uncontested'
  | 'speaker'
  | 'missing-turnout'
  | 'multi-member-historical'
  | 'boundary-comparability-limited'
  | 'source-discrepancy';

export interface ConstituencyContest {
  /** Election.id this contest belongs to. */
  electionId: string;
  /** Constituency.id this contest was held in. */
  constituencyId: string;
  /** For convenience in UI loaders; derived from Constituency.slug. */
  constituencySlug: string;
  /** For convenience in UI loaders; mirrors Constituency.name. */
  constituencyName: string;
  contestType: ContestType;
  /** Registered electorate; null when source does not report it. */
  electorate: number | null;
  /** Valid votes cast (sum of candidate votes for single-member contests). */
  validVotes: number | null;
  /** Turnout as a fraction in [0, 1]; null when electorate or validVotes is null. */
  turnout: number | null;
  /** Always present, possibly empty. Never null, never omitted. */
  caveats: CaveatToken[];
}

export interface CandidateResult {
  /** Composite contest key: `${electionId}:${constituencyId}`. */
  contestId: string;
  candidateName: string;
  /** Canonical party slug (lower-case kebab) post normalization. */
  partyId: string;
  /** Canonical display name (e.g. "Labour Party"). */
  partyDisplayName: string;
  /** Raw source label (e.g. "Lab", "Labour Co-op"). Preserved per NFR14. */
  partySourceLabel: string;
  votes: number;
  /** Share of valid votes in the contest, in [0, 1]. Null when validVotes is null. */
  share: number | null;
  /** 1-based finishing position in the contest. */
  position: number;
  isWinner: boolean;
  /** Always present, possibly empty. */
  caveats: CaveatToken[];
}

export interface NationalPartyTotal {
  electionId: string;
  partyId: string;
  partyDisplayName: string;
  partySourceLabel: string;
  votes: number;
  /** National vote share in [0, 1]. */
  voteShare: number;
  seats: number;
  /** National seat share in [0, 1]. */
  seatShare: number;
  /** seatShare - voteShare; positive = over-represented. */
  seatDelta: number;
}

export interface LowWinningShareRow {
  electionId: string;
  constituencyId: string;
  constituencySlug: string;
  constituencyName: string;
  /** Winner-share within [0, 1]. */
  winningShare: number;
  winningPartyId: string;
  winningPartyDisplayName: string;
  winningCandidateName: string;
  /** Runner-up share within [0, 1]; null if contest had no runner-up. */
  runnerUpShare: number | null;
  caveats: CaveatToken[];
}

export interface ExcludedFromMetrics {
  caveat: CaveatToken;
  count: number;
}

export interface NationalSummary {
  electionId: string;
  totalVotes: number;
  totalSeats: number;
  /** Gallagher index (least-squares disproportionality), 0 = perfect, higher = worse. */
  gallagher: number;
  minorityWinnerCount: number;
  /** Per-party {partyId, gap} where gap = seatShare - voteShare. */
  voteVsSeatGap: { partyId: string; partyDisplayName: string; gap: number }[];
  lowWinningShareLeaderboard: LowWinningShareRow[];
  /** Breakdown of rows excluded from headline metrics, by caveat token. */
  excludedFromMetrics: ExcludedFromMetrics[];
}

export interface SourceManifest {
  /** Stable identifier; convention: `parliament-<election>-<source>`. */
  id: string;
  sourceName: string;
  sourceUrl: string;
  licence: string;
  /** ISO 8601 date — when the file was downloaded. */
  retrievalDate: string;
  /** ISO 8601 date — when the source publisher dated the file. */
  publicationDate: string;
  /** ISO 8601 timestamp — when the ETL ran. */
  generatedAt: string;
  /** ETL version string, e.g. "parliament-etl@1". */
  etlVersion: string;
  /** Free-form caveats applying to the entire dataset (not row-level). */
  caveats: string[];
}

/**
 * Envelope used for every generated parliament JSON file. Loaders
 * destructure `_manifest` + `data` so caveats and source provenance
 * travel together with the payload (AR3, NFR13).
 */
export interface ParliamentSplit<T> {
  _manifest: SourceManifest;
  data: T;
}

/** Top-level enumeration written to `src/lib/data/parliament/index.json`. */
export interface ParliamentIndex {
  generatedAt: string;
  years: number[];
}
