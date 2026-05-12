<script lang="ts">
  import { num } from '$lib/format';
  let { data } = $props();
  const generatedAt = $derived(data.generatedAt);
  const sourceLabel = $derived(data.sourceLabel);
  const totals = $derived(data.totals);

  // Vendored Datasette Lite at /explorer/ (see static/explorer/) — themed
  // and same-origin so the worker can fetch /data/results.sqlite without
  // cross-origin overhead.
  const datasetteUrl =
    '/explorer/?url=/data/results.sqlite#/results/races?_sort_desc=under_par';
  let explorerOpen = $state(false);
</script>

<svelte:head>
  <title>Data — electionresults.uk</title>
  <meta
    name="description"
    content="Download the full results database (SQLite) and per-table CSVs underlying every figure on electionresults.uk. Schema documented inline."
  />
  <link rel="canonical" href="https://electionresults.uk/data" />
</svelte:head>

<main>
  <h1>Data</h1>
  <p class="lede">
    The full database underlying every figure on this site, in two formats. No
    signup, no rate limit, no abridged view.
  </p>

  <p class="muted">
    Snapshot generated <code>{generatedAt}</code> · source
    <code>{sourceLabel}</code> · {num(totals.cycles)} election cycles,
    {num(totals.races)} races, {num(totals.seats)} elected seats across
    {num(totals.councils)} council&times;cycle pairs.
  </p>

  <h2>Downloads</h2>
  <ul>
    <li><a href="/data/results.sqlite" download>results.sqlite</a> — full database for all cycles (open in DBeaver, sqlite3, DuckDB CLI, Python, R, or any SQLite-compatible tool)</li>
    <li><a href="/data/cycles.csv" download>cycles.csv</a> — one row per election cycle</li>
    <li><a href="/data/councils.csv" download>councils.csv</a> — one row per (year, council) pair</li>
    <li><a href="/data/races.csv" download>races.csv</a> — one row per ward race</li>
    <li><a href="/data/candidates.csv" download>candidates.csv</a> — one row per candidacy</li>
  </ul>

  <h2>Browse in your browser</h2>
  <p>
    Run SQL against the database without installing anything, via
    <a href="https://lite.datasette.io" rel="external noopener">Datasette Lite</a>
    (Simon Willison's <a href="https://datasette.io" rel="external noopener">Datasette</a>
    compiled to WebAssembly). Once loaded, every query runs locally in
    your browser — nothing is sent to a server.
  </p>
  {#if explorerOpen}
    <iframe
      src={datasetteUrl}
      title="Datasette Lite — electionresults.uk database explorer"
      referrerpolicy="no-referrer"
    ></iframe>
    <p class="muted">
      <a href={datasetteUrl} rel="external noopener">Open in a new tab</a>
      for more room.
    </p>
  {:else}
    <p>
      <button type="button" class="loader" onclick={() => (explorerOpen = true)}>
        Load explorer (downloads ~32&nbsp;MB)
      </button>
    </p>
    <p class="muted">
      Click to fetch the SQLite file. Skipped by default so visitors on
      metered connections aren't charged for it.
    </p>
  {/if}

  <h2>Schema</h2>

  <p class="muted">
    All tables are keyed by <code>year</code> as the leading column;
    everything else joins on <code>(year, council_slug)</code> and
    <code>(year, council_slug, ward_slug)</code>.
  </p>

  <h3><code>cycles</code></h3>
  <table>
    <tbody>
      <tr><th><code>year</code></th><td>Election year (primary key)</td></tr>
      <tr><th><code>election_date</code></th><td>ISO date the polls were held</td></tr>
      <tr><th><code>council_count, race_count, seat_count</code></th><td>Volumetrics for the cycle</td></tr>
      <tr><th><code>below_quota_seat_count, below_quota_share</code></th><td>Seats whose marginal candidate share fell below the proportional quota</td></tr>
    </tbody>
  </table>

  <h3><code>councils</code></h3>
  <table>
    <tbody>
      <tr><th><code>year, council_slug</code></th><td>Composite primary key</td></tr>
      <tr><th><code>council</code></th><td>Display name (Lower-tier authority)</td></tr>
      <tr><th><code>authority_type</code></th><td>UC / MD / LB / SD / etc.</td></tr>
      <tr><th><code>race_count</code></th><td>Ward races in this council in this cycle</td></tr>
      <tr><th><code>total_seats, below_quota_seats, below_quota_share</code></th><td>Per-(year, council) aggregates</td></tr>
    </tbody>
  </table>

  <h3><code>races</code></h3>
  <table>
    <tbody>
      <tr><th><code>year, council_slug, ward_slug</code></th><td>Composite primary key</td></tr>
      <tr><th><code>ec_code</code></th><td>Electoral Commission ward code where the source provides one (null for 2023)</td></tr>
      <tr><th><code>ward_name, council</code></th><td>Display labels</td></tr>
      <tr><th><code>seats</code></th><td>Seats contested in this ward</td></tr>
      <tr><th><code>electorate, ballots, invalid_votes</code></th><td>Source figures (some null in earlier years)</td></tr>
      <tr><th><code>valid_ballots</code></th><td>Sum of candidate votes — the LEH "Valid vote turnout (HoC method)" denominator</td></tr>
      <tr><th><code>winning_pct</code></th><td>Marginal-elected-candidate share of valid ballots</td></tr>
      <tr><th><code>quota</code></th><td>Proportional quota: <code>1.0 / (seats + 1)</code></td></tr>
      <tr><th><code>under_par</code></th><td><code>winning_pct − quota</code> — signed gap (negative = below quota, positive = above). Field name kept for schema compatibility; the convention is signed-gap.</td></tr>
      <tr><th><code>is_below_quota</code></th><td><code>1</code> when <code>winning_pct &lt; quota</code></td></tr>
    </tbody>
  </table>

  <h3><code>candidates</code></h3>
  <table>
    <tbody>
      <tr><th><code>year, council_slug, ward_slug</code></th><td>Joins <code>races</code></td></tr>
      <tr><th><code>candidate_name, party</code></th><td>Public election record (party normalised to canonical full name)</td></tr>
      <tr><th><code>votes</code></th><td>Votes cast for this candidate</td></tr>
      <tr><th><code>elected</code></th><td><code>1</code> if elected — recomputed as top-N-by-votes (see methodology)</td></tr>
      <tr><th><code>elected_source</code></th><td>The LEH source <code>Elected</code> flag, before our correction; differs on a small number of candidacies where the workbook is internally inconsistent</td></tr>
      <tr><th><code>rank</code></th><td>1 = highest-vote candidate in the ward</td></tr>
    </tbody>
  </table>

  <h2>Licensing &amp; sources</h2>
  <p>
    <strong>Election results</strong> &mdash; published by the House of
    Commons Library under the Open Parliament Licence; ingested from the
    annual Local Election Handbook for each cycle.
  </p>
  <p>
    <strong>Council composition snapshots</strong> &mdash; per-council
    per-party seat counts by year, sourced from
    <a href="https://opencouncildata.co.uk" rel="external noopener">opencouncildata</a>
    under
    <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="external noopener">CC&nbsp;BY-SA&nbsp;4.0</a>
    (attribution: opencouncildata.co.uk). Used for the truth-set running
    composition on each council page and for the council-control flip
    definition.
  </p>
  <p>
    Our derived columns (<code>winning_pct</code>, <code>quota</code>,
    <code>under_par</code>, the <code>below_quota_*</code> aggregates,
    and the council-flip computation) are released under
    <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="external noopener">CC&nbsp;BY-SA&nbsp;4.0</a>.
    Attribution: "electionresults.uk".
  </p>
</main>

<style>
  .lede { font-size: 1.1rem; }
  iframe {
    width: 100%;
    height: 720px;
    border: 1px solid var(--rule, #ddd);
    border-radius: 4px;
    background: #fff;
  }
  .loader {
    font: inherit;
    padding: 0.6rem 1rem;
    border: 1px solid var(--rule, #ddd);
    border-radius: 4px;
    background: var(--bg, #f6f5ee);
    cursor: pointer;
  }
  .loader:hover { background: rgba(0, 0, 0, 0.05); }
  code {
    background: rgba(0, 0, 0, 0.05);
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
    font-size: 0.9em;
  }
  th { white-space: nowrap; }
  @media (prefers-color-scheme: dark) {
    code { background: rgba(255, 255, 255, 0.08); }
  }
</style>
