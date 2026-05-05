<script lang="ts">
  import { num } from '$lib/format';
  let { data } = $props();
  const generatedAt = $derived(data.generatedAt);
  const sourceLabel = $derived(data.sourceLabel);
  const totals = $derived(data.totals);
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
    <code>{sourceLabel}</code> · {num(totals.races)} races,
    {num(totals.seats)} elected seats across {num(totals.councils)} councils.
  </p>

  <h2>Downloads</h2>
  <ul>
    <li><a href="/data/results.sqlite" download>results.sqlite</a> — full database (open in DBeaver, sqlite3, DuckDB CLI, Python, R, or any SQLite-compatible tool)</li>
    <li><a href="/data/councils.csv" download>councils.csv</a> — one row per council</li>
    <li><a href="/data/races.csv" download>races.csv</a> — one row per ward race</li>
    <li><a href="/data/candidates.csv" download>candidates.csv</a> — one row per candidacy</li>
  </ul>

  <h2>Schema</h2>

  <h3><code>councils</code></h3>
  <table>
    <tbody>
      <tr><th><code>council_slug</code></th><td>URL slug (primary key, e.g. <code>birmingham</code>)</td></tr>
      <tr><th><code>council</code></th><td>Display name (Lower-tier authority)</td></tr>
      <tr><th><code>authority_type</code></th><td>UC / MD / LB / MB / etc.</td></tr>
      <tr><th><code>race_count</code></th><td>Ward races published for this council</td></tr>
      <tr><th><code>total_seats</code></th><td>Elected seats across all races</td></tr>
      <tr><th><code>minority_winner_seats</code></th><td>Seats won on &lt;50% of valid ballots</td></tr>
      <tr><th><code>minority_share</code></th><td><code>minority_winner_seats / total_seats</code></td></tr>
    </tbody>
  </table>

  <h3><code>races</code></h3>
  <table>
    <tbody>
      <tr><th><code>ec_code</code></th><td>Electoral Commission ward code (primary key)</td></tr>
      <tr><th><code>ward_code</code></th><td>ONS ward code (GSS)</td></tr>
      <tr><th><code>ward_name, ward_slug</code></th><td>Display name and URL fragment</td></tr>
      <tr><th><code>council_slug, council</code></th><td>Joins <code>councils</code></td></tr>
      <tr><th><code>seats</code></th><td>Seats contested in this ward</td></tr>
      <tr><th><code>electorate, ballots, invalid_votes</code></th><td>Source figures</td></tr>
      <tr><th><code>valid_ballots</code></th><td><code>ballots − invalid_votes</code></td></tr>
      <tr><th><code>winning_pct</code></th><td>Marginal-elected-candidate share of valid ballots</td></tr>
      <tr><th><code>is_minority</code></th><td><code>1</code> if <code>winning_pct &lt; 0.5</code></td></tr>
    </tbody>
  </table>

  <h3><code>candidates</code></h3>
  <table>
    <tbody>
      <tr><th><code>ec_code</code></th><td>Joins <code>races</code></td></tr>
      <tr><th><code>candidate_name, party, party_abbrev</code></th><td>Public election record</td></tr>
      <tr><th><code>votes</code></th><td>Votes cast for this candidate</td></tr>
      <tr><th><code>elected</code></th><td><code>1</code> if elected to a seat in this ward</td></tr>
      <tr><th><code>rank</code></th><td>1 = highest-vote candidate</td></tr>
      <tr><th><code>gender</code></th><td>From the source workbook (included for fidelity; not surfaced in the editorial UI)</td></tr>
    </tbody>
  </table>

  <h2>Licensing</h2>
  <p>
    Source data is published by the House of Commons Library under the Open
    Parliament Licence. Our derived tables (the <code>winning_pct</code>,
    <code>minority_share</code> aggregates and any other computed columns) are
    released under <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.
    Attribution: "electionresults.uk".
  </p>
</main>

<style>
  .lede { font-size: 1.1rem; }
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
