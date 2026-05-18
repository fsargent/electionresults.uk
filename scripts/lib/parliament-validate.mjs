// Pure validation helpers for the parliamentary ETL. No I/O. Pure
// functions take in parsed rows (already JSON.parse'd or xlsx-parsed
// JS objects) and return new structures — never mutate inputs.
//
// Imported by:
//   - scripts/etl-parliament.mjs (Story 2.5)
//   - any future unit tests for the validation logic

/**
 * @typedef {Object} SchemaValidationResult
 * @property {boolean} ok        — true when every expected column is present
 * @property {string[]} missing  — columns that were expected but not in the source
 * @property {string[]} unexpected — columns present in the source but not expected
 *                                 (informational; doesn't fail ok)
 */

/**
 * @typedef {Object} BoundarySet
 * @property {string} id
 * @property {string} name
 * @property {string} inForceFrom        — ISO 8601 date
 * @property {string} [inForceTo]        — ISO 8601 date; absent while in force
 * @property {string} [notes]
 * @property {string[]} [comparableTo]   — other boundary set IDs that are
 *                                          considered directly comparable
 *                                          (e.g. minor adjustments). When a
 *                                          constituency's set is NOT in this
 *                                          list, boundaryCaveatFor returns
 *                                          'boundary-comparability-limited'
 *                                          against any pair outside it.
 */

/**
 * Validate that every expected column is present in the source rows.
 * Returns a structured result rather than throwing so the ETL can
 * format an actionable error message before exiting.
 *
 * @param {Record<string, unknown>[]} rows
 * @param {string[]} expectedColumns
 * @returns {SchemaValidationResult}
 */
export function validateSchema(rows, expectedColumns) {
  // Defensive: empty input is not necessarily wrong (an unfiltered
  // sheet with header only would land here), but with nothing to
  // inspect we can't confirm column presence — report every expected
  // column as missing.
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, missing: [...expectedColumns], unexpected: [] };
  }
  // Union of keys across all rows so we don't false-negative on
  // sparse sheets where the first row happens to be missing an
  // optional column that other rows carry.
  const present = new Set();
  for (const row of rows) {
    if (row && typeof row === 'object') {
      for (const k of Object.keys(row)) present.add(k);
    }
  }
  const missing = expectedColumns.filter((c) => !present.has(c));
  const unexpected = [...present].filter((c) => !expectedColumns.includes(c));
  return { ok: missing.length === 0, missing, unexpected };
}

// Hand-curated list of Speaker constituency seats. The Speaker stands
// as "Speaker seeking re-election" with no party allegiance — listing
// them under a real party would distort national party totals. Updated
// when a new Speaker is elected.
const SPEAKER_CONSTITUENCY_SLUGS = new Set([
  'chorley' // 2019, 2024 — Lindsay Hoyle
]);

/**
 * @typedef {Object} SourceRow
 * @property {string} [constituencySlug]
 * @property {string} [constituencyName]
 * @property {number|null} [validVotes]
 * @property {number|null} [electorate]
 * @property {number} [candidateCount]
 * @property {string} [contestType]              — 'single-member' | 'multi-member-historical'
 * @property {boolean} [sourceDiscrepancy]       — opt-in flag set during ETL when a row's
 *                                                  source-vs-source delta exceeds tolerance
 */

/**
 * Inspect a parsed source row and return zero or more canonical
 * caveat tokens. Pure — does not mutate the input, does not consult
 * disk or network.
 *
 * @param {SourceRow} row
 * @returns {string[]}
 */
export function detectCaveats(row) {
  const caveats = [];
  if (!row || typeof row !== 'object') return caveats;

  if (typeof row.candidateCount === 'number' && row.candidateCount === 1) {
    caveats.push('uncontested');
  }

  if (
    row.constituencySlug &&
    SPEAKER_CONSTITUENCY_SLUGS.has(row.constituencySlug)
  ) {
    caveats.push('speaker');
  }

  // Missing turnout: either the electorate or the valid-votes count
  // was not in the source for this row. We don't require both fields
  // — either being missing breaks the turnout fraction.
  const missingElectorate =
    row.electorate === null || row.electorate === undefined;
  const missingValidVotes =
    row.validVotes === null || row.validVotes === undefined;
  if (missingElectorate || missingValidVotes) {
    caveats.push('missing-turnout');
  }

  if (row.contestType === 'multi-member-historical') {
    caveats.push('multi-member-historical');
  }

  if (row.sourceDiscrepancy === true) {
    caveats.push('source-discrepancy');
  }

  return caveats;
}

/**
 * Decide whether a constituency's boundary set is comparable with
 * the prior/subsequent set the caller cares about. When the
 * constituency's boundary set is not in the `comparableTo` list of
 * any neighbouring set, return the caveat. Returns null when
 * comparable.
 *
 * Pure — accepts the boundary-set table as an explicit argument so
 * the ETL can pass in `source-data/parliament/boundary-sets.json`
 * without coupling this helper to disk I/O.
 *
 * @param {Object} args
 * @param {{boundarySet: string}} args.constituency
 * @param {string[]} args.compareAgainst — boundary-set IDs we want to
 *                                         compare this constituency against
 * @param {BoundarySet[]} args.boundarySets — full boundary-set table
 * @returns {'boundary-comparability-limited' | null}
 */
export function boundaryCaveatFor({ constituency, compareAgainst, boundarySets }) {
  if (
    !constituency ||
    !Array.isArray(compareAgainst) ||
    compareAgainst.length === 0 ||
    !Array.isArray(boundarySets)
  ) {
    return null;
  }
  const cSet = boundarySets.find((b) => b.id === constituency.boundarySet);
  if (!cSet) {
    // Unknown boundary set — that itself is a comparability problem.
    return 'boundary-comparability-limited';
  }
  const comparable = new Set(cSet.comparableTo ?? []);
  comparable.add(cSet.id); // Trivially comparable with itself.
  for (const other of compareAgainst) {
    if (!comparable.has(other)) {
      return 'boundary-comparability-limited';
    }
  }
  return null;
}
