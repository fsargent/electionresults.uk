<script lang="ts">
  let { data } = $props();
  const sourceLabel = $derived(data.sourceLabel);
  const cycleLabel = $derived(data.cycleLabel);
</script>

<svelte:head>
  <title>Methodology — electionresults.uk</title>
  <meta
    name="description"
    content="How every figure on electionresults.uk is computed, where the source data comes from, and the editorial frame that names the voting method (not individual candidates) as the subject."
  />
  <link rel="canonical" href="https://electionresults.uk/methodology" />
</svelte:head>

<main>
  <h1>Methodology</h1>

  <p class="lede">
    This page documents every formula, source, and editorial choice on the
    site. Read it before you cite us. If you find an error, mail
    <a href="mailto:errata@electionresults.uk">errata@electionresults.uk</a>
    and we will publish a correction with date, diff, and impact.
  </p>

  <h2>Editorial frame</h2>
  <p>
    Every page on this site is structured to make
    <strong>the voting method the subject of the observation</strong>, not the
    individual elected on it. We name candidates because the public election
    record names them; we make no claim about any individual candidate's
    conduct, fitness for office, or character. The factual claim — "won X% of
    valid ballots" — is verifiable from the source data linked on
    <a href="/data">/data</a>.
  </p>
  <p>
    Scotland's councils elect their councillors by Single Transferable Vote.
    Scottish council results do not produce minority-mandate winners in the
    way the figures on this site do. The contrast is the rhetorical hook of
    the project, and the editorial frame throughout.
  </p>

  <h2>Winning percentage</h2>
  <p>
    For a single-member ward,
    <code>winning_pct = winner_votes / valid_ballots</code>.
  </p>
  <p>
    For a multi-member ward (electing N councillors at once under bloc vote),
    each elected candidate has their own
    <code>candidate_votes / valid_ballots</code>. We headline the
    <strong>most-marginal of the elected candidates</strong> — the seat-holder
    with the thinnest mandate in that ward — because that figure shows how
    little support the weakest seat-winner actually attracted. Per-candidate
    shares are also visible in the candidate table on every council page.
  </p>
  <p>
    <code>valid_ballots = ballots_cast − invalid_votes</code>. This matches
    the House of Commons Library "Valid vote turnout (HoC method)" definition
    in the source workbook.
  </p>

  <h3>A note on multi-member wards</h3>
  <p>
    In a multi-member ward (electing N councillors at once under bloc vote),
    each voter may cast up to N votes — so a candidate's
    <code>candidate_votes / valid_ballots</code> ratio understates the share
    of voters who supported them, sometimes by a lot. We report the ratio
    anyway, with the same denominator as single-member wards, because (a) it
    is the figure used by the source workbook and consistently comparable
    across ward types, and (b) any other choice would require speculating
    about how voters distributed their second and third votes. Readers
    interpreting multi-member percentages should treat them as a lower bound
    on candidate support, not an upper one. The Single Transferable Vote, as
    used in Scottish council elections, removes this ambiguity by counting
    preferences explicitly.
  </p>

  <h2>Minority mandate</h2>
  <p>
    A seat is flagged as a minority-mandate seat when its winning percentage,
    computed as above, is strictly less than 50%. A seat won on exactly 50%
    is not flagged.
  </p>

  <h2>Sources</h2>
  <ul>
    <li>
      <strong>{cycleLabel}</strong> · House of Commons Library,
      Local Election Handbook (Open Parliament Licence). File in the repo:
      <code>{sourceLabel}</code>.
    </li>
    <li>
      For the 2026-05-07 cycle (when published): <em>Democracy Club</em> CSV
      ingest under their published redistribution licence (attribution
      required), and the eventual Commons Library 2026 Local Election
      Handbook as the canonical re-baseline.
    </li>
    <li>
      Cycle-comparator data for 2022 (London Boroughs), 2023 (halves
      councils), and 2024 (thirds councils): Commons Library briefings
      CBP-9558, CBP-9858, CBP-9966 respectively. Not yet ingested in this
      preview build.
    </li>
  </ul>

  <h2>Reproducibility</h2>
  <p>
    Every number on the published site is derivable from the SQLite database
    on <a href="/data">/data</a> using standard SQL. The schema documentation
    on that page lists every table and column. The site build is
    deterministic: the same git commit and the same source data produce the
    same published bytes.
  </p>

  <h2>What is <em>not</em> in this v1</h2>
  <ul>
    <li>An in-page SQL console (<em>datasette-lite</em>) — deferred.</li>
    <li>DuckDB-WASM widgets for live-querying tables — deferred.</li>
    <li>Cycle-over-cycle comparison views — pending the prior-cycle ingest.</li>
    <li>System-anomalies lens (smallest winning vote count, vote-to-seat
      inversions, etc.) — pending the next iteration.</li>
    <li>Per-candidate pages and biographies — explicitly excluded by editorial
      design (race-as-noun discipline).</li>
  </ul>

  <h2>Errata</h2>
  <p>
    No errata recorded yet. When a methodological correction is required, an
    entry will be published here with a date, a one-paragraph explanation,
    the diff (what number changed, by how much), and the affected pages.
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
  @media (prefers-color-scheme: dark) {
    code { background: rgba(255, 255, 255, 0.08); }
  }
</style>
