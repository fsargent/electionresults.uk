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

  const votePct = $derived(Math.min(100, party.voteShare * 100));
  const seatPct = $derived(Math.min(100, party.seatShare * 100));
  const gapPp = $derived((party.seatShare - party.voteShare) * 100);
  const colour = $derived(partyColor(party.partyDisplayName));

  // Plain-language outcome label so the over/under-representation
  // signal carries independently of the colour bars (NFR10). Threshold
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
    {party.partyDisplayName}
  </th>
  <td>
    <div class="bars" aria-hidden="true">
      <div class="track">
        <div class="bar vote" style="width:{votePct}%; background:{colour}"></div>
      </div>
      <div class="track">
        <div class="bar seat" style="width:{seatPct}%; border-color:{colour}"></div>
      </div>
    </div>
    <div class="summary">
      {pct(party.voteShare, 1)} of votes,
      {pct(party.seatShare, 1)} of seats &mdash;
      <strong>{outcome}</strong>
    </div>
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
  .swatch {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    margin-right: 0.4rem;
    border-radius: 2px;
    vertical-align: baseline;
  }

  .bars {
    display: grid;
    gap: 0.2rem;
    min-width: 8rem;
  }

  .track {
    width: 100%;
    height: 0.55rem;
    background: rgba(0, 0, 0, 0.04);
    border-radius: 2px;
    overflow: hidden;
  }

  .bar {
    height: 100%;
    border-radius: 2px;
  }

  .bar.seat {
    background: transparent;
    border: 2px solid;
    /* Outlined — distinguishes seat share from vote share without
       relying on colour alone. */
  }

  .summary {
    margin-top: 0.3rem;
    font-size: 0.92rem;
  }
</style>
