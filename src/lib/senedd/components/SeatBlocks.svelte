<script lang="ts">
  import { partyColor } from '$lib/party-colors';

  export interface SeatBlock {
    /** Canonical party name for colour lookup. */
    party: string;
    /** Accessible / hover description of this seat. */
    title: string;
    /** Optional short text drawn inside the block (e.g. seat number). */
    mark?: string;
  }

  let {
    seats,
    label,
    size = 18
  }: { seats: SeatBlock[]; label: string; size?: number } = $props();
</script>

<div class="seat-blocks" role="list" aria-label={label} style:--seat-size={`${size}px`}>
  {#each seats as s, i (i)}
    <span
      class="seat"
      role="listitem"
      title={s.title}
      aria-label={s.title}
      style:background-color={partyColor(s.party)}
    >{#if s.mark}<span class="mark">{s.mark}</span>{/if}</span>
  {/each}
</div>

<style>
  .seat-blocks {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    margin: 0.4rem 0 0.8rem;
  }
  .seat {
    width: var(--seat-size);
    height: var(--seat-size);
    border-radius: 3px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
  }
  .mark {
    font-size: calc(var(--seat-size) * 0.5);
    font-weight: 700;
    color: #fff;
    text-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
    font-variant-numeric: tabular-nums;
  }
</style>
