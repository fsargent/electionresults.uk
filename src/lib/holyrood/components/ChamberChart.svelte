<script lang="ts">
  // One square per MSP, grouped by party. Constituency MSPs are solid;
  // regional (list) MSPs are outlined, so the reader can see how each
  // party's seats were made up.
  import type { HolyroodParty, SeatRow } from '../types';
  let {
    seats,
    party,
    label
  }: { seats: SeatRow[]; party: (id: string) => HolyroodParty; label: string } = $props();
  const cells = $derived(
    seats.flatMap((s) => [
      ...Array.from({ length: s.constituency }, () => ({ partyId: s.partyId, kind: 'constituency' as const })),
      ...Array.from({ length: s.regional }, () => ({ partyId: s.partyId, kind: 'regional' as const }))
    ])
  );
</script>

<figure class="chamber">
  <div class="grid" role="img" aria-label={label}>
    {#each cells as c, i (i)}
      <span
        class="seat {c.kind}"
        style:--c={party(c.partyId).color}
        title={`${party(c.partyId).name}: ${c.kind} MSP`}
      ></span>
    {/each}
  </div>
  <figcaption>
    <span class="key"><span class="seat constituency" style:--c="#777"></span> constituency MSP</span>
    <span class="key"><span class="seat regional" style:--c="#777"></span> regional (list) MSP</span>
  </figcaption>
</figure>

<style>
  .chamber { margin: 1rem 0 1.5rem; }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(14px, 1fr));
    gap: 3px;
    max-width: 60rem;
  }
  .seat {
    display: inline-block;
    aspect-ratio: 1;
    min-width: 12px;
    border-radius: 2px;
    border: 2px solid var(--c);
    box-sizing: border-box;
  }
  .seat.constituency { background: var(--c); }
  .seat.regional {
    background: repeating-linear-gradient(45deg, var(--c) 0 2px, transparent 2px 5px);
  }
  figcaption {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin-top: 0.6rem;
    font-size: 0.85rem;
    color: var(--muted);
  }
  .key { display: inline-flex; align-items: center; gap: 0.4rem; }
  .key .seat { width: 14px; height: 14px; }
</style>
