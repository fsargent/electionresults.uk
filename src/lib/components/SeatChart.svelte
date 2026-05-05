<script lang="ts">
  import { partyColor } from '$lib/party-colors';

  export interface SeatGroup {
    party: string;
    seats: number;
  }

  let {
    segments,
    label,
    /** Seat-square edge length in CSS pixels. */
    size = 16
  }: { segments: SeatGroup[]; label?: string; size?: number } = $props();

  // Flatten into one entry per seat with its position-within-party and
  // party-total baked in, so the tooltip lookup is O(1) and the render
  // is a flat loop.
  const seats = $derived(
    segments.flatMap((s) =>
      Array.from({ length: s.seats }, (_, i) => ({
        party: s.party,
        positionInParty: i + 1,
        partyTotal: s.seats
      }))
    )
  );
  const totalSeats = $derived(seats.length);

  type Tooltip = { x: number; y: number; primary: string; secondary: string };
  let tooltip: Tooltip | null = $state(null);

  function findSeat(target: EventTarget | null) {
    if (!(target instanceof Element)) return null;
    const el = target.closest('[data-seat-idx]');
    if (!el) return null;
    const idx = Number(el.getAttribute('data-seat-idx'));
    return seats[idx] ?? null;
  }

  function onMove(event: PointerEvent) {
    const seat = findSeat(event.target);
    if (!seat) {
      tooltip = null;
      return;
    }
    const partyShare = totalSeats > 0 ? seat.partyTotal / totalSeats : 0;
    tooltip = {
      x: event.clientX + window.scrollX,
      y: event.clientY + window.scrollY,
      primary: seat.party,
      secondary: `Seat ${seat.positionInParty} of ${seat.partyTotal} · ${(partyShare * 100).toFixed(1)}% of council`
    };
  }

  function onLeave() {
    tooltip = null;
  }
</script>

{#if label}
  <span class="bar-label">{label}</span>
{/if}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="seat-grid"
  style:--seat-size={`${size}px`}
  onpointermove={onMove}
  onpointerleave={onLeave}
  role="img"
  aria-label={(label ?? 'Seat allocation') +
    ': ' +
    segments
      .filter((s) => s.seats > 0)
      .map((s) => `${s.party} ${s.seats}`)
      .join(', ')}
>
  {#each seats as seat, i (i)}
    <span
      class="seat"
      data-seat-idx={i}
      style:background-color={partyColor(seat.party)}
    ></span>
  {/each}
</div>

{#if tooltip}
  <div
    class="seat-tooltip"
    style:left={`${tooltip.x}px`}
    style:top={`${tooltip.y}px`}
    role="tooltip"
  >
    <div class="primary">{tooltip.primary}</div>
    <div class="secondary">{tooltip.secondary}</div>
  </div>
{/if}

<style>
  .bar-label {
    font-size: 0.78rem;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    display: block;
    margin-bottom: 0.4rem;
  }
  .seat-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    margin-bottom: 1rem;
  }
  .seat {
    display: block;
    width: var(--seat-size, 16px);
    height: var(--seat-size, 16px);
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.18);
    transition: transform 0.08s, box-shadow 0.08s;
  }
  @media (prefers-color-scheme: dark) {
    .seat { border-color: rgba(255, 255, 255, 0.25); }
  }
  .seat-grid:hover .seat { opacity: 0.55; }
  .seat-grid:hover .seat:hover {
    opacity: 1;
    transform: scale(1.18);
    box-shadow: 0 0 0 1px var(--fg);
  }
  .seat-tooltip {
    position: absolute;
    pointer-events: none;
    transform: translate(0.9rem, -100%);
    margin-top: -0.4rem;
    background: var(--fg);
    color: var(--bg);
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    font-size: 0.85rem;
    line-height: 1.25;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10;
    max-width: 18rem;
  }
  .seat-tooltip .primary { font-weight: 600; }
  .seat-tooltip .secondary {
    opacity: 0.85;
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
  }
  @media (hover: none) { .seat-tooltip { display: none; } }
</style>
