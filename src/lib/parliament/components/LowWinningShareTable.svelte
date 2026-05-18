<script lang="ts">
  import { pct } from '$lib/format';
  import { partyColor } from '$lib/party-colors';
  import type { LowWinningShareRow } from '../types';

  let {
    rows,
    year
  }: {
    rows: LowWinningShareRow[];
    year: number;
  } = $props();
</script>

<div class="table-scroll">
  <table class="leaderboard">
    <caption class="visually-hidden">
      Constituencies in the {year} UK general election won on the
      lowest shares of valid votes, ranked ascending. Includes winning
      party, winning candidate, runner-up share, and any data caveats.
    </caption>
    <thead>
      <tr>
        <th scope="col" class="rank">#</th>
        <th scope="col">Constituency</th>
        <th scope="col">Winning party</th>
        <th scope="col">Winning candidate</th>
        <th scope="col" class="num">Winning share</th>
        <th scope="col" class="num">Runner-up share</th>
      </tr>
    </thead>
    <tbody>
      {#each rows as r, i (r.constituencyId)}
        <tr>
          <td class="rank">{i + 1}</td>
          <th scope="row">
            <a href={`/parliament/${year}/${r.constituencySlug}`}>
              {r.constituencyName}
            </a>
            {#each r.caveats as c (c)}
              <span class="caveat" title={`Caveat: ${c}`}>{c}</span>
            {/each}
          </th>
          <td>
            <span
              class="swatch"
              style="background:{partyColor(r.winningPartyDisplayName)}"
              aria-hidden="true"
            ></span>
            {r.winningPartyDisplayName}
          </td>
          <td>{r.winningCandidateName}</td>
          <td class="num">{pct(r.winningShare, 1)}</td>
          <td class="num">
            {#if r.runnerUpShare == null}
              &mdash;
            {:else}
              {pct(r.runnerUpShare, 1)}
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table-scroll {
    overflow-x: auto;
  }

  table.leaderboard {
    width: 100%;
    border-collapse: collapse;
    margin: 0.75rem 0;
    font-size: 0.95rem;
  }

  table.leaderboard th,
  table.leaderboard td {
    padding: 0.5rem 0.6rem;
    border-bottom: 1px solid var(--rule);
    vertical-align: top;
    text-align: left;
  }

  table.leaderboard thead th {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--muted);
    border-bottom: 2px solid var(--rule);
    white-space: nowrap;
  }

  .rank {
    text-align: right;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    width: 2.5rem;
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  th[scope='row'] {
    font-weight: 500;
  }

  th[scope='row'] a {
    text-decoration: none;
    color: var(--accent);
    border-bottom: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  }

  th[scope='row'] a:hover,
  th[scope='row'] a:focus-visible {
    border-bottom-color: var(--accent);
  }

  th[scope='row'] a:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .swatch {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    margin-right: 0.35rem;
    border-radius: 2px;
    vertical-align: baseline;
  }

  .caveat {
    display: inline-block;
    margin-left: 0.35rem;
    padding: 0.05rem 0.4rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--warn);
    border: 1px solid var(--warn);
    border-radius: 3px;
    white-space: nowrap;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
