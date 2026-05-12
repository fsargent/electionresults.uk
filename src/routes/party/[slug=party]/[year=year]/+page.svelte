<script lang="ts">
  import { num, pct, pts } from '$lib/format';
  import { partyColor, partyDisplayName } from '$lib/party-colors';

  let { data } = $props();
  const partyHex = $derived(partyColor(data.partyName));
  const summary = $derived(data.summary);
</script>

<svelte:head>
  <title>{data.partyName} in {data.year} — electionresults.uk</title>
  <meta
    name="description"
    content="{data.partyName} performance in the {data.year} UK local elections: seats won, councils gained and lost, where the seats came from and went to."
  />
  <link
    rel="canonical"
    href="https://electionresults.uk/{data.partySlug}/{data.year}"
  />
</svelte:head>

<main class="wide">
  <p class="crumbs">
    <a href="/{data.partySlug}">{data.partyName}</a> &rsaquo; {data.year}
  </p>
  <h1>
    <span class="swatch" style:background={partyHex} aria-hidden="true"></span>
    {data.partyName} in {data.year}
  </h1>

  {#if data.cycle}
    <p class="muted">
      Polling day: {data.cycle.electionDateLabel}.
      {num(data.cycle.councilCount)} councils held elections.
    </p>
  {/if}

  <h2>Summary</h2>
  <ul class="headline">
    <li>
      Contested in <strong>{num(summary.councilsContested)}</strong> of
      {num(data.cycle?.councilCount ?? summary.councilsContested)} councils;
      ran for <strong>{num(summary.contestedSeats)}</strong> seats.
    </li>
    <li>
      Won <strong>{num(summary.seatsWon)}</strong> seats
      ({pct(summary.seatShare)} of seats up) on
      <strong>{pct(summary.voteShare)}</strong> of the vote.
    </li>
    <li>
      Net change vs each council's last appearance in this dataset:
      <strong>{data.totalNet > 0 ? '+' : ''}{num(data.totalNet)} seats</strong>
      across {num(data.gained.length)} councils up,
      {num(data.lost.length)} councils down,
      {num(data.flat.length)} flat,
      {num(data.debut.length)} new to the window.
    </li>
    {#if data.controls}
      <li>
        Council-control change: <strong>{num(data.controls.councilsGained.length)}</strong>
        gained, <strong>{num(data.controls.councilsLost.length)}</strong> lost.
      </li>
    {/if}
  </ul>

  {#if data.controls && (data.controls.councilsGained.length > 0 || data.controls.councilsLost.length > 0)}
    <h2>Council-control changes</h2>
    <p class="muted">
      Councils where the largest party in the running composition
      changed at this election.
      <a href="/methodology#flips">How a flip is defined &rarr;</a>
    </p>

    {#if data.controls.councilsGained.length > 0}
      <h3>Gained ({data.controls.councilsGained.length})</h3>
      <ul class="flips">
        {#each data.controls.councilsGained as g}
          <li>
            <a href="/{g.councilSlug}">{g.council}</a>
            <span class="muted">
              from <span class="party-pill" style:background={partyColor(g.fromParty)}>
                {partyDisplayName(g.fromParty)}
              </span>
            </span>
          </li>
        {/each}
      </ul>
    {/if}

    {#if data.controls.councilsLost.length > 0}
      <h3>Lost ({data.controls.councilsLost.length})</h3>
      <ul class="flips">
        {#each data.controls.councilsLost as l}
          <li>
            <a href="/{l.councilSlug}">{l.council}</a>
            <span class="muted">
              to <span class="party-pill" style:background={partyColor(l.toParty)}>
                {partyDisplayName(l.toParty)}
              </span>
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}

  <h2>Where the seats came from</h2>
  <p class="muted">
    Per-council net seat change vs each council's prior appearance in
    our dataset (typically that council's previous all-out election or
    its last by-thirds slice). "Debut" rows are councils whose first
    cycle in our window is {data.year} &mdash; usually the result of a
    boundary reorganisation or being a county outside our 2021 LEH
    coverage.
  </p>

  <details open>
    <summary><strong>Seats gained</strong> ({data.gained.length} councils)</summary>
    {#if data.gained.length > 0}
      <table>
        <thead>
          <tr>
            <th>Council</th>
            <th class="r">Won</th>
            <th class="r">Last cycle</th>
            <th class="r">Net</th>
            <th class="r">Vote share</th>
            <th class="r">Seat share</th>
          </tr>
        </thead>
        <tbody>
          {#each data.gained as r}
            <tr>
              <td><a href="/{r.councilSlug}">{r.council}</a></td>
              <td class="r">{num(r.seatsWon)}</td>
              <td class="r">
                {r.prevSeatsWon != null ? `${num(r.prevSeatsWon)} (${r.prevYear})` : '—'}
              </td>
              <td class="r pos">+{num(r.netChange ?? 0)}</td>
              <td class="r">{pct(r.voteShare)}</td>
              <td class="r">{pct(r.seatShare)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="muted">No councils where seat count rose vs prior cycle.</p>
    {/if}
  </details>

  <details open>
    <summary><strong>Seats lost</strong> ({data.lost.length} councils)</summary>
    {#if data.lost.length > 0}
      <table>
        <thead>
          <tr>
            <th>Council</th>
            <th class="r">Won</th>
            <th class="r">Last cycle</th>
            <th class="r">Net</th>
            <th class="r">Vote share</th>
            <th class="r">Seat share</th>
          </tr>
        </thead>
        <tbody>
          {#each data.lost as r}
            <tr>
              <td><a href="/{r.councilSlug}">{r.council}</a></td>
              <td class="r">{num(r.seatsWon)}</td>
              <td class="r">
                {r.prevSeatsWon != null ? `${num(r.prevSeatsWon)} (${r.prevYear})` : '—'}
              </td>
              <td class="r neg">{num(r.netChange ?? 0)}</td>
              <td class="r">{pct(r.voteShare)}</td>
              <td class="r">{pct(r.seatShare)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="muted">No councils where seat count fell vs prior cycle.</p>
    {/if}
  </details>

  {#if data.debut.length > 0}
    <details>
      <summary><strong>Debut councils</strong> ({data.debut.length})</summary>
      <table>
        <thead>
          <tr>
            <th>Council</th>
            <th class="r">Won</th>
            <th class="r">Vote share</th>
            <th class="r">Seat share</th>
          </tr>
        </thead>
        <tbody>
          {#each data.debut as r}
            <tr>
              <td><a href="/{r.councilSlug}">{r.council}</a></td>
              <td class="r">{num(r.seatsWon)}</td>
              <td class="r">{pct(r.voteShare)}</td>
              <td class="r">{pct(r.seatShare)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </details>
  {/if}

  {#if data.flat.length > 0}
    <details>
      <summary><strong>No change</strong> ({data.flat.length})</summary>
      <ul class="flat-list">
        {#each data.flat as r}
          <li>
            <a href="/{r.councilSlug}">{r.council}</a>
            <span class="muted">{num(r.seatsWon)} seats (unchanged from {r.prevYear})</span>
          </li>
        {/each}
      </ul>
    </details>
  {/if}

  <p class="muted">
    Net-change comparisons are versus each council's most recent
    appearance in our dataset (2021&ndash;2026). For all-out councils
    that's the previous all-out cycle (typically four years prior); for
    by-thirds councils it's last year's slice. Cross-cycle ward boundary
    changes can produce small artefacts &mdash; see
    <a href="/methodology">methodology</a>.
  </p>
</main>

<style>
  .crumbs {
    margin: 0.4rem 0 -0.6rem;
    font-size: 0.9rem;
    color: var(--muted);
  }
  h1 .swatch {
    display: inline-block;
    width: 0.9em;
    height: 0.9em;
    border-radius: 3px;
    margin-right: 0.4em;
    vertical-align: -0.05em;
  }
  ul.headline {
    list-style: disc;
    padding-left: 1.2rem;
  }
  ul.headline li {
    margin: 0.4em 0;
  }
  ul.flips,
  ul.flat-list {
    list-style: none;
    padding: 0;
    margin: 0.6rem 0 1.2rem;
  }
  ul.flips li,
  ul.flat-list li {
    padding: 0.3rem 0;
    border-bottom: 1px solid var(--rule);
  }
  .party-pill {
    display: inline-block;
    padding: 0 0.4rem;
    border-radius: 3px;
    color: white;
    font-size: 0.85rem;
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.25);
  }
  details {
    margin: 1rem 0;
  }
  details summary {
    cursor: pointer;
    padding: 0.4rem 0;
  }
  th.r,
  td.r {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  td.r.pos {
    color: #1c7a3a;
  }
  td.r.neg {
    color: var(--warn);
  }
</style>
