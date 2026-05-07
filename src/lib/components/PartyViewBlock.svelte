<script lang="ts">
  import { pct, num } from '$lib/format';
  import Party from './Party.svelte';
  import PartyBars from './PartyBars.svelte';
  import SeatChart from './SeatChart.svelte';
  import type { PartyView } from '$lib/types';

  let { view }: { view: PartyView } = $props();
</script>

<table class="party-view">
  <thead>
    <tr>
      <th>Party</th>
      <th class="num">Votes</th>
      <th class="num">Vote %</th>
      <th class="num">Seats won</th>
      <th class="num">% of seats</th>
      <th class="num">Proportional seats</th>
      <th class="num">Proportional %</th>
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

<h3 class="bars-heading">Vote share vs seats won</h3>
<p class="muted">
  The top bar is each party's share of votes cast in this council.
  Below, one square per seat, coloured by the party that won it &mdash;
  first the actual First-Past-the-Post result, then what a
  proportional method would have produced from the same vote totals.
  Divergence between the bar and the actual grid is the indictment
  of the method.
</p>
<div class="bars" aria-label="Vote share, actual seats and proportional seats by party">
  <PartyBars
    label="Vote share"
    segments={view.rows.map((r) => ({
      party: r.party,
      share: r.voteShare,
      count: r.votes,
      total: view.totalVotes,
      unit: 'votes'
    }))}
  />
  <SeatChart
    label="Actual seats"
    segments={view.rows
      .filter((r) => r.fptpSeats > 0)
      .map((r) => ({ party: r.party, seats: r.fptpSeats }))}
  />
  <SeatChart
    label="Proportional seats"
    segments={view.rows
      .filter((r) => r.dhondtSeats > 0)
      .map((r) => ({ party: r.party, seats: r.dhondtSeats }))}
  />
</div>

<style>
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
</style>
