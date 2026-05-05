<script lang="ts">
  import { pct, num, pts } from '$lib/format';
  import Party from '$lib/components/Party.svelte';
  import Frac from '$lib/components/Frac.svelte';
  import { partyColor } from '$lib/party-colors';
  const partyColorOf = (name: string) => partyColor(name);
  let { data } = $props();
  const council = $derived(data.council);
  const races = $derived(data.races);
  const cycle = $derived(data.cycle);
  const belowQuotaRaces = $derived(races.filter((r) => r.race.isBelowQuota).length);
</script>

<svelte:head>
  <title>{council.council} {cycle.year} — election results audit | electionresults.uk</title>
  <meta
    name="description"
    content={`${council.council}, ${cycle.electionDateLabel}: ${belowQuotaRaces} of ${council.raceCount} ward races elected councillors below the proportional quota.`}
  />
  <link
    rel="canonical"
    href={`https://electionresults.uk/${cycle.year}/${council.councilSlug}`}
  />
</svelte:head>

<main class="wide">
  <p class="muted">
    <a href="/{cycle.year}">← {cycle.electionDateLabel} cohort</a>
    · <a href="/">All cycles</a>
  </p>
  <h1>{council.council} <span class="year-badge">{cycle.year}</span></h1>
  <p class="muted election-date">
    Local elections held <strong>{cycle.electionDateLabel}</strong>.
  </p>

  <div class="summary">
    <div class="kpi">
      <span class="figure">{num(council.raceCount)}</span>
      <span class="label">ward races</span>
    </div>
    <div class="kpi">
      <span class="figure">{num(council.totalSeatCount)}</span>
      <span class="label">seats</span>
    </div>
    <div class="kpi">
      <span class="figure warn">{num(council.belowQuotaSeatCount)}</span>
      <span class="label">elected below the proportional quota</span>
    </div>
    <div class="kpi">
      <span class="figure pct">{pct(council.belowQuotaShare)}</span>
      <span class="label">of seats below quota</span>
    </div>
  </div>

  <section class="frame">
    <h2>How to read this page</h2>
    <p>
      Each race below shows the share of valid ballots the marginal
      elected candidate actually won, and compares it to the
      <strong>proportional quota</strong>: the share that would be needed
      to be guaranteed that seat under any proportional voting method
      (the Droop quota, <Frac num="1" denom="seats + 1" />). For a 1-seat ward
      the quota is 50%; for 2 seats, 33.3%; for 3 seats, 25%.
    </p>
    <p>
      Where the actual winning share fell below the quota, we show the gap as
      <strong>points under par</strong> &mdash; the editorial indictment.
      Above-par results are just majority mandates and pass without comment.
      The voting method is the subject of every observation here. Named
      candidates appear as the public election record requires; the cause
      being audited is the voting method, not the individuals. See the
      <a href="/methodology">methodology page</a> for derivations.
    </p>
  </section>

  {#if data.partyView && data.partyView.rows.length > 1}
    {@const view = data.partyView}
    <h2 id="party-view">If votes were counted by party</h2>
    <p>
      Across the {data.council.raceCount} ward{data.council.raceCount === 1 ? '' : 's'} in
      this cycle, parties received the vote totals below. The
      <strong>D'Hondt</strong> column shows what each party would have won
      if the {view.totalSeats} seat{view.totalSeats === 1 ? '' : 's'} had
      been allocated to the same total votes proportionally
      (<a href="/methodology">methodology, with caveats</a>). The
      <strong>Δ</strong> column is the FPTP minus D'Hondt seat count
      &mdash; positive numbers are parties FPTP over-represented in this
      council, negative are parties FPTP under-represented.
    </p>

    <table class="party-view" aria-describedby="party-view">
      <thead>
        <tr>
          <th>Party</th>
          <th class="num">Votes</th>
          <th class="num">Vote %</th>
          <th class="num">FPTP seats</th>
          <th class="num">FPTP %</th>
          <th class="num">D'Hondt seats</th>
          <th class="num">D'Hondt %</th>
          <th class="num">Δ</th>
        </tr>
      </thead>
      <tbody>
        {#each view.rows as row (row.party)}
          <tr>
            <td><Party name={row.party} /></td>
            <td class="num">{num(row.votes)}</td>
            <td class="num pct">{pct(row.voteShare)}</td>
            <td class="num">{row.fptpSeats}</td>
            <td class="num pct">{pct(row.fptpSeatShare)}</td>
            <td class="num">{row.dhondtSeats}</td>
            <td class="num pct">{pct(row.dhondtSeatShare)}</td>
            <td
              class="num delta"
              class:over={row.seatDelta > 0}
              class:under={row.seatDelta < 0}
            >{row.seatDelta > 0 ? `+${row.seatDelta}` : row.seatDelta}</td>
          </tr>
        {/each}
        <tr class="totals">
          <td>Total</td>
          <td class="num">{num(view.totalVotes)}</td>
          <td class="num pct">100.0%</td>
          <td class="num">{view.totalSeats}</td>
          <td class="num pct">100.0%</td>
          <td class="num">{view.totalSeats}</td>
          <td class="num pct">100.0%</td>
          <td class="num">0</td>
        </tr>
      </tbody>
    </table>

    <h3 class="bars-heading">Vote share vs seat share</h3>
    <p class="muted">
      Two horizontal bars: the top stack is each party's share of votes
      cast in this council; the bottom is each party's share of seats won
      under FPTP. A divergence between the two is the indictment of the
      method.
    </p>
    <div class="bars" aria-label="Vote share vs FPTP seat share by party">
      <div class="bar-row">
        <span class="bar-label">Vote share</span>
        <div class="bar">
          {#each view.rows.filter((r) => r.voteShare > 0) as r (r.party)}
            <span
              class="seg"
              style:width={`${r.voteShare * 100}%`}
              style:background-color={partyColorOf(r.party)}
              title={`${r.party}: ${pct(r.voteShare)} of votes`}
            ></span>
          {/each}
        </div>
      </div>
      <div class="bar-row">
        <span class="bar-label">Seat share (FPTP)</span>
        <div class="bar">
          {#each view.rows.filter((r) => r.fptpSeats > 0) as r (r.party)}
            <span
              class="seg"
              style:width={`${r.fptpSeatShare * 100}%`}
              style:background-color={partyColorOf(r.party)}
              title={`${r.party}: ${r.fptpSeats} of ${view.totalSeats} seats`}
            ></span>
          {/each}
        </div>
      </div>
      <div class="bar-row">
        <span class="bar-label">Seat share (D'Hondt)</span>
        <div class="bar">
          {#each view.rows.filter((r) => r.dhondtSeats > 0) as r (r.party)}
            <span
              class="seg"
              style:width={`${r.dhondtSeatShare * 100}%`}
              style:background-color={partyColorOf(r.party)}
              title={`${r.party}: ${r.dhondtSeats} of ${view.totalSeats} seats`}
            ></span>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <h2 id="wards">Wards in this council</h2>
  <p class="muted">
    Sorted with the largest gap below the quota first. Click any ward to jump
    to its full result.
  </p>
  <ul class="toc">
    {#each races as { race } (race.wardSlug)}
      <li>
        <a href={`#${race.wardSlug}`}>{race.wardName}</a>
        <span class="muted">
          · {race.seats === 1 ? '1 seat' : `${race.seats} seats`}
          · won at <span class="pct">{pct(race.winningPct)}</span>
          {#if race.underPar > 0}
            · <span class="warn">{pts(race.underPar)} below quota</span>
          {:else}
            · <span class="muted">above quota</span>
          {/if}
        </span>
      </li>
    {/each}
  </ul>

  <h2>Race results</h2>

  {#each races as { race } (race.wardSlug)}
    <section class="race" id={race.wardSlug}>
      <h3>
        {race.wardName}
        <span class="muted ward-type">
          · {race.seats === 1 ? 'single-seat' : `${race.seats}-seat (bloc vote)`}
        </span>
      </h3>

      <p class="race-stats">
        <span class="stat">
          <span class="stat-label">Marginal winner</span>
          <span class="stat-value pct" class:warn={race.isBelowQuota}>
            {pct(race.winningPct)}
          </span>
        </span>
        <span class="stat">
          <span class="stat-label">Proportional quota</span>
          <span class="stat-value pct">{pct(race.quota)}</span>
        </span>
        <span class="stat">
          <span class="stat-label">Difference</span>
          <span class="stat-value pct" class:warn={race.isBelowQuota}>
            {pts(race.underPar)}
            {#if race.isBelowQuota}<span class="muted"> below quota</span>{/if}
          </span>
        </span>
        <span class="stat">
          <span class="stat-label">Valid ballots</span>
          <span class="stat-value">{num(race.validBallots)}</span>
        </span>
      </p>

      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Candidate</th>
            <th>Party</th>
            <th class="num">Votes</th>
            <th class="num">Share</th>
            <th>Elected</th>
          </tr>
        </thead>
        <tbody>
          {#each race.candidates as c (race.wardSlug + ':' + c.rank)}
            <tr class:elected={c.elected}>
              <td class="num">{c.rank}</td>
              <td>{c.name}</td>
              <td><Party name={c.party} /></td>
              <td class="num">{num(c.votes)}</td>
              <td class="num pct">{pct(race.validBallots > 0 ? c.votes / race.validBallots : 0)}</td>
              <td>{#if c.elected}<span aria-label="Elected to seat" title="Elected to seat">Elected</span>{/if}</td>
            </tr>
          {/each}
        </tbody>
      </table>

      <p class="muted small race-meta">
        Electorate {num(race.electorate)} · Ballots cast {num(race.ballots)}
        {#if race.invalidVotes > 0}· Invalid {num(race.invalidVotes)}{/if}
        {#if race.wardCode}· EC ward code {race.wardCode}{/if}
        · <a href="#wards">Back to ward index</a>
      </p>
    </section>
  {/each}
</main>

<style>
  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 0.75rem;
    margin: 1rem 0 1.5rem;
  }
  .kpi {
    border: 1px solid var(--rule);
    padding: 0.75rem 0.9rem;
    border-radius: 6px;
    display: flex;
    flex-direction: column;
  }
  .kpi .figure {
    font-size: 1.6rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .kpi .figure.warn { color: var(--warn); }
  .kpi .label {
    font-size: 0.85rem;
    color: var(--muted);
  }
  .frame {
    background: rgba(11, 61, 46, 0.05);
    padding: 0.75rem 1.1rem;
    border-left: 3px solid var(--accent);
    font-size: 0.95rem;
    margin: 1rem 0 1.5rem;
  }
  .frame h2 {
    font-size: 1.05rem;
    margin: 0.2rem 0 0.4rem;
  }
  .frame p { margin: 0.4em 0; }
  .toc {
    columns: 22rem 2;
    gap: 1.5rem;
    padding-left: 1.2rem;
    font-size: 0.92rem;
  }
  .toc li {
    margin-bottom: 0.35rem;
    break-inside: avoid;
  }
  section.race {
    border-top: 1px solid var(--rule);
    padding-top: 1rem;
    margin-top: 1.5rem;
    scroll-margin-top: 1rem;
  }
  section.race h3 { margin-top: 0; }
  .ward-type { font-size: 0.9rem; font-weight: 400; }
  .race-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.6rem;
    margin: 0.5rem 0 0.8rem;
  }
  .stat {
    display: flex;
    flex-direction: column;
  }
  .stat-label {
    font-size: 0.78rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .stat-value {
    font-size: 1.05rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .stat-value.warn { color: var(--warn); }
  .warn { color: var(--warn); }
  tr.elected td { font-weight: 600; }
  .small { font-size: 0.82rem; }
  .election-date {
    margin-top: -0.5rem;
    font-size: 0.95rem;
  }
  .race-meta { margin: 0.6rem 0 0; }

  table.party-view td.delta.over { color: var(--warn); font-weight: 700; }
  table.party-view td.delta.under { color: #2a7f4f; }
  @media (prefers-color-scheme: dark) {
    table.party-view td.delta.under { color: #6dbb9d; }
  }
  table.party-view tr.totals td {
    border-top: 2px solid var(--rule);
    font-weight: 600;
  }

  .bars-heading { margin-top: 1.5rem; }
  .bars {
    display: grid;
    gap: 0.4rem;
    margin: 0.8rem 0 1.5rem;
  }
  .bar-row {
    display: grid;
    grid-template-columns: 11rem 1fr;
    gap: 0.6rem;
    align-items: center;
  }
  .bar-label {
    font-size: 0.85rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .bar {
    display: flex;
    height: 1.4rem;
    border: 1px solid var(--rule);
    border-radius: 3px;
    overflow: hidden;
  }
  .bar .seg {
    display: block;
    height: 100%;
    transition: filter 0.1s;
  }
  .bar .seg:hover { filter: brightness(1.15); }
  @media (max-width: 600px) {
    .bar-row { grid-template-columns: 1fr; }
  }

  .year-badge {
    font-size: 0.65em;
    font-weight: 500;
    padding: 0.15em 0.5em;
    background: var(--accent);
    color: var(--accent-fg);
    border-radius: 4px;
    vertical-align: 0.3em;
    margin-left: 0.3em;
  }
</style>
