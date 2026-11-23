<script lang="ts">
  import { num } from '$lib/format';
  import { partyColor } from '$lib/party-colors';
  import type { SeneddConstituency } from '$lib/senedd/types';

  let { c }: { c: SeneddConstituency } = $props();

  const fig = (v: number) =>
    Number.isInteger(v) ? num(v) : v.toLocaleString('en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

  const entryById = $derived(new Map(c.entries.map((e) => [e.id, e])));
  // Every list and individual candidate, highest vote first.
  const rows = $derived(
    c.entries.map((e) => ({ e, q: c.quotients.find((q) => q.entryId === e.id)! }))
  );
  const columns = $derived(Array.from({ length: c.seats }, (_, i) => i + 1));
  const nextEntry = $derived(entryById.get(c.lastSeat.nextEntryId));
  const lastEntry = $derived(entryById.get(c.lastSeat.entryId));
</script>

<div class="table-scroll">
  <table class="alloc">
    <caption class="muted">
      Seat allocation figures: each list's votes divided by 1, 2, 3 … Numbered cells won a seat, in
      the order shown. Independent candidates' votes are not divided.
    </caption>
    <thead>
      <tr>
        <th scope="col">List</th>
        <th scope="col" class="num">Votes</th>
        {#each columns as d (d)}
          <th scope="col" class="num">÷ {d}</th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as { e, q } (e.id)}
        <tr>
          <th scope="row">
            <span class="swatch" style:background-color={partyColor(e.party)}></span>
            {e.displayName}
          </th>
          <td class="num">{num(e.votes)}</td>
          {#each columns as d (d)}
            {@const cell = q.figures.find((f) => f.divisor === d)}
            {#if cell}
              <td class="num" class:won={cell.seat > 0}>
                {#if cell.seat > 0}<span class="seat-no" style:background-color={partyColor(e.party)}>{cell.seat}</span>{/if}
                {fig(cell.figure)}
              </td>
            {:else}
              <td class="num muted na" title={e.kind === 'individual' ? 'Independent: one seat at most, votes not divided' : 'List exhausted'}>·</td>
            {/if}
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<ol class="rounds">
  {#each c.elected as m (m.seat)}
    {@const e = entryById.get(m.entryId)}
    <li>
      <strong>Seat {m.seat}:</strong>
      {m.displayName}, highest figure {fig(m.figure)}
      {#if e?.kind === 'party'}({num(e.votes)} ÷ {m.divisor}){/if}
      → {m.name} (list position {m.listPosition})
    </li>
  {/each}
</ol>

{#if nextEntry && lastEntry}
  <p class="muted small">
    Hypothetical seventh seat (not part of the recorded result):
    {nextEntry.displayName} at {fig(c.lastSeat.nextFigure)}{#if nextEntry.kind === 'party'}
      ({num(nextEntry.votes)} ÷ {c.lastSeat.nextDivisor}){/if}{#if c.lastSeat.nextCandidate}, which would have elected {c.lastSeat.nextCandidate}{/if}.
    The sixth seat went to {lastEntry.displayName} at {fig(c.lastSeat.figure)}{#if nextEntry.id !== lastEntry.id}, a margin of
      {fig(c.lastSeat.figure - c.lastSeat.nextFigure)} on the figure{#if nextEntry.kind === 'party'}:
        {nextEntry.displayName} would have needed roughly
        {num(Math.floor((c.lastSeat.figure - c.lastSeat.nextFigure) * c.lastSeat.nextDivisor) + 1)} more votes
        to take that seat, with every other list's votes unchanged{/if}{/if}.
  </p>
{/if}

<style>
  .table-scroll {
    overflow-x: auto;
  }
  table.alloc {
    font-size: 0.88rem;
  }
  caption {
    caption-side: top;
    text-align: left;
    font-size: 0.85rem;
    padding-bottom: 0.3rem;
  }
  th[scope='row'] {
    font-weight: 500;
    white-space: nowrap;
  }
  .swatch {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 2px;
    margin-right: 0.3rem;
    vertical-align: -1px;
  }
  td.won {
    font-weight: 700;
  }
  td.na {
    text-align: center;
  }
  .seat-no {
    display: inline-block;
    min-width: 1.2rem;
    padding: 0 0.2rem;
    margin-right: 0.25rem;
    border-radius: 3px;
    color: #fff;
    text-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
    text-align: center;
    font-size: 0.78rem;
  }
  ol.rounds {
    padding-left: 1.2rem;
    font-size: 0.92rem;
  }
  .small {
    font-size: 0.88rem;
  }
</style>
