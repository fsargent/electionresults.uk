<script lang="ts">
  import { partyColor } from '$lib/party-colors';
  import { pct } from '$lib/format';

  export interface ShareRow {
    party: string;
    displayName: string;
    voteShare: number;
    seatShare: number;
  }

  let { rows, caption }: { rows: ShareRow[]; caption: string } = $props();
  const max = $derived(Math.max(0.0001, ...rows.flatMap((r) => [r.voteShare, r.seatShare])));
</script>

<figure class="share-bars">
  <figcaption class="muted">{caption}</figcaption>
  <div class="key muted" aria-hidden="true">
    <span><span class="swatch votes"></span>Vote share</span>
    <span><span class="swatch seats"></span>Seat share</span>
  </div>
  {#each rows as r (r.displayName)}
    <div class="row">
      <span class="name">{r.displayName}</span>
      <span class="bars">
        <span class="bar-line">
          <span
            class="bar votes"
            style:width={`${(r.voteShare / max) * 100}%`}
            style:background-color={partyColor(r.party)}
          ></span>
          <span class="val">{pct(r.voteShare, 1)} of votes</span>
        </span>
        <span class="bar-line">
          <span
            class="bar seats"
            style:width={`${(r.seatShare / max) * 100}%`}
            style:border-color={partyColor(r.party)}
          ></span>
          <span class="val">{pct(r.seatShare, 1)} of seats</span>
        </span>
      </span>
    </div>
  {/each}
</figure>

<style>
  .share-bars {
    margin: 0.6rem 0 1.2rem;
  }
  figcaption {
    font-size: 0.9rem;
    margin-bottom: 0.3rem;
  }
  .key {
    display: flex;
    gap: 1rem;
    font-size: 0.8rem;
    margin-bottom: 0.4rem;
  }
  .swatch {
    display: inline-block;
    width: 0.9rem;
    height: 0.6rem;
    margin-right: 0.3rem;
    vertical-align: middle;
  }
  .swatch.votes {
    background: var(--muted);
  }
  .swatch.seats {
    border: 2px solid var(--muted);
  }
  .row {
    display: grid;
    grid-template-columns: minmax(8rem, 13rem) 1fr;
    gap: 0.6rem;
    align-items: center;
    padding: 0.25rem 0;
    border-bottom: 1px solid var(--rule);
  }
  .name {
    font-size: 0.92rem;
  }
  .bars {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .bar-line {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .bar {
    display: inline-block;
    height: 0.7rem;
    min-width: 2px;
  }
  .bar.seats {
    border: 2px solid;
    background: transparent;
  }
  .val {
    font-size: 0.78rem;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  @media (max-width: 560px) {
    .row {
      grid-template-columns: 1fr;
    }
  }
</style>
