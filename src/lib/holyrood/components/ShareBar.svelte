<script lang="ts">
  // Horizontal bar of shares for a single ballot. Never mixes ballots.
  import type { HolyroodParty } from '../types';
  let {
    rows,
    party,
    label
  }: {
    rows: { partyId: string; share: number }[];
    party: (id: string) => HolyroodParty;
    label: string;
  } = $props();
</script>

<div class="bar" role="img" aria-label={label}>
  {#each rows.filter((r) => r.share > 0) as r (r.partyId)}
    <span
      style:width={`${r.share * 100}%`}
      style:background={party(r.partyId).color}
      title={`${party(r.partyId).name}: ${(r.share * 100).toFixed(1)}%`}
    ></span>
  {/each}
</div>

<style>
  .bar {
    display: flex;
    height: 1.3rem;
    border: 1px solid var(--rule);
    border-radius: 3px;
    overflow: hidden;
    margin: 0.3rem 0 0.8rem;
  }
  .bar span { display: block; height: 100%; }
</style>
