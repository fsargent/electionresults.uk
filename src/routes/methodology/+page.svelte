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
    We deliberately avoid the words "majority" and "minority" as system
    labels. They imply that FPTP and bloc vote have a numerical threshold
    a winner must clear &mdash; which they do not. A candidate wins
    under these methods by being top of the poll, full stop, regardless
    of share. Instead we report each elected candidate's share against
    the <strong>proportional quota</strong> &mdash; the share that would
    be needed to be guaranteed that seat under a voting method that
    allocates seats in proportion to votes &mdash; and call out the gap.
  </p>
  <p>
    Where seats are allocated proportionally to votes, results like the
    ones on this site do not occur: the proportional quota is the floor
    that any common proportional method requires. The contrast between
    First-Past-the-Post / bloc vote and a proportional alternative is
    the rhetorical hook of the project, and the editorial frame
    throughout.
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
    each voter may cast up to N votes &mdash; so a candidate's
    <code>candidate_votes / valid_ballots</code> ratio understates the
    share of voters who supported them, sometimes by a lot. We report the
    ratio anyway, with the same denominator as single-member wards,
    because (a) it is the figure used by the source workbook and
    consistently comparable across ward types, and (b) any other choice
    would require speculating about how voters distributed their second
    and third votes. Readers interpreting multi-member percentages should
    treat them as a lower bound on candidate support, not an upper one.
    The proportional quota framing (above) is calibrated to this same
    denominator, so the comparison stays apples-to-apples.
  </p>

  <h2>Proportional quota and "under par"</h2>
  <p>
    The <strong>Droop quota</strong> is the share of valid ballots a
    candidate would need to be guaranteed a seat under any common
    proportional voting method:
    <code>quota = 1 / (seats + 1)</code>. For a 1-seat ward this
    collapses to 50% (a true majority); for 2 seats it is 33.3%; for 3
    seats, 25%. The name comes from H.&nbsp;R.&nbsp;Droop's 1869 paper
    on proportional election methods; the figure is used, in the same
    or near-identical form, by every preferential and party-list system
    we are aware of.
  </p>
  <p>
    For each race we compute <code>under_par = quota − winning_pct</code>.
    A positive value means the marginal elected candidate won less of the
    valid ballots than the quota &mdash; the seat would not have been
    guaranteed under a proportional count. We surface this as
    <em>"X.X points below quota"</em> and treat it as the editorial
    indictment of the voting method, not the candidate. Above-quota
    results are mathematically clean and pass without comment.
  </p>
  <p>
    This is a deliberate departure from the older "minority winner"
    framing (winning_pct &lt; 50%). The 50% threshold is not a rule of
    FPTP or bloc vote &mdash; calling someone a "minority winner"
    implies they fell short of a standard the system never required of
    them. The quota framing is the standard a proportional system
    <em>does</em> require, and the gap is the loss attributable to the
    method.
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
