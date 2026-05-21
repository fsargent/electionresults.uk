<script lang="ts">
  import { pct, num } from '$lib/format';
  import { gallagherIndex } from '$lib/distortion';
  import { gallagherDescriptor } from '$lib/gallagher-descriptor';
  import Party from './Party.svelte';
  import PartyBars from './PartyBars.svelte';
  import SeatChart from './SeatChart.svelte';
  import type { PartyView } from '$lib/types';

  let { view }: { view: PartyView } = $props();

  const gallagher = $derived(gallagherIndex(view.rows));
  // Band drives only the left-border colour; the descriptor itself
  // does the editorial work.
  const gallagherBand = $derived(
    !Number.isFinite(gallagher)
      ? null
      : gallagher < 5
        ? 'low'
        : gallagher < 10
          ? 'moderate'
          : gallagher < 15
            ? 'noticeable'
            : 'severe'
  );
  const gallagherLabel = $derived(
    Number.isFinite(gallagher) ? gallagherDescriptor(gallagher) : null
  );
</script>

{#if Number.isFinite(gallagher) && gallagherLabel}
  <aside class="gallagher" class:low={gallagherBand === 'low'} class:moderate={gallagherBand === 'moderate'} class:noticeable={gallagherBand === 'noticeable'} class:severe={gallagherBand === 'severe'}>
    <div class="value">
      <span class="num">{gallagherLabel}</span>
      <span class="label">
        overall vote-to-seat distortion
      </span>
    </div>
    <p class="gloss">
      How far the seat allocation diverged from the vote shares across
      all parties &mdash; the
      <a href="/councils/methodology#gallagher">Gallagher index</a>
      summarises the gap as a single qualitative band.
    </p>
  </aside>
{/if}

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

  aside.gallagher {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0 1rem;
    align-items: center;
    margin: 1rem 0 1.2rem;
    padding: 0.8rem 1rem;
    border: 1px solid var(--rule);
    border-left-width: 4px;
    border-radius: 4px;
    background: var(--card-bg, transparent);
  }
  aside.gallagher.low { border-left-color: #2a7f4f; }
  aside.gallagher.moderate { border-left-color: #c8a32a; }
  aside.gallagher.noticeable { border-left-color: #d97706; }
  aside.gallagher.severe { border-left-color: var(--warn); }
  aside.gallagher .value {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    line-height: 1.15;
    min-width: 9rem;
  }
  aside.gallagher .value .num {
    font-size: 1.25rem;
    font-weight: 700;
  }
  aside.gallagher.severe .value .num { color: var(--warn); }
  aside.gallagher .value .label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin-top: 0.2rem;
  }
  aside.gallagher .gloss {
    margin: 0;
    font-size: 0.92rem;
  }
</style>
