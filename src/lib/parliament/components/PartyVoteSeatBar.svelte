<script lang="ts">
  import { pct, num } from '$lib/format';
  import { partyColor } from '$lib/party-colors';
  import type { NationalPartyTotal } from '../types';

  let {
    party,
    votesPerSeat
  }: {
    party: NationalPartyTotal;
    /** Precomputed by the loader via metrics.partyEfficiency. Null when seats === 0. */
    votesPerSeat: number | null;
  } = $props();

  // Bars share a 0–100% axis. Visible width is capped at 100% via CSS,
  // but we clamp here too as a defense against bad data (>100 share is
  // a data bug, not a UX scenario worth styling for).
  const votePct = $derived(Math.min(100, party.voteShare * 100));
  const seatPct = $derived(Math.min(100, party.seatShare * 100));
  const gapPp = $derived((party.seatShare - party.voteShare) * 100);
  const colour = $derived(partyColor(party.partyDisplayName));

  // Plain-language outcome label that conveys over/under independently
  // of the bar visual (NFR10 — colour is not the only signal). Threshold
  // of 0.5pp avoids labelling rounding noise as "over-represented".
  const outcome = $derived.by(() => {
    if (Math.abs(gapPp) < 0.5) return 'Proportionally represented';
    if (gapPp > 0) return `Over-represented by ${gapPp.toFixed(1)} pp`;
    return `Under-represented by ${Math.abs(gapPp).toFixed(1)} pp`;
  });
</script>

<tr>
  <th scope="row">
    <span class="swatch" style="background:{colour}" aria-hidden="true"></span>
    <span class="name">{party.partyDisplayName}</span>
  </th>
  <td>
    <div class="bars" aria-hidden="true">
      <div class="track">
        <div class="bar vote" style="width:{votePct}%; background:{colour}"></div>
      </div>
      <div class="track">
        <div
          class="bar seat"
          style="width:{seatPct}%; border-color:{colour}"
        ></div>
      </div>
    </div>
    <p class="summary">
      {pct(party.voteShare, 1)} of votes,
      {pct(party.seatShare, 1)} of seats &mdash;
      <strong>{outcome}</strong>
    </p>
  </td>
  <td class="num">
    {#if votesPerSeat == null}
      <span class="muted">no seats won</span>
    {:else}
      {num(Math.round(votesPerSeat))}
    {/if}
  </td>
</tr>

<style>
  th[scope='row'] {
    text-align: left;
    font-weight: 500;
    vertical-align: top;
    padding-right: 0.6rem;
    white-space: nowrap;
  }

  .swatch {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    margin-right: 0.4rem;
    border-radius: 2px;
    vertical-align: baseline;
  }

  td {
    vertical-align: top;
  }

  .bars {
    display: grid;
    gap: 0.25rem;
    min-width: 8rem;
  }

  .track {
    width: 100%;
    height: 0.55rem;
    background: var(--bg);
    border-radius: 2px;
    overflow: hidden;
    position: relative;
  }

  .bar {
    height: 100%;
    border-radius: 2px;
  }

  /* .bar.vote is filled with the party colour set inline; no extra
     style needed beyond .bar's height + radius. */

  .bar.seat {
    background: transparent;
    border: 2px solid;
    /* Hatched outline conveys seat share independently of colour. */
  }

  .summary {
    margin: 0.35rem 0 0;
    font-size: 0.92rem;
  }

  .muted {
    color: var(--muted);
  }
</style>
