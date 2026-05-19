<script lang="ts">
  // Leaderboard of constituencies where the winner took less than half
  // the valid votes — the headline "minority mandate" list. Mirrors
  // the column shape of the per-constituency drill-down table so the
  // jump from leaderboard row to full result feels continuous: same
  // Votes + Share of votes + Below quota framing, scoped down to the
  // winning candidate per row.

  import { num, pct, pts } from '$lib/format';
  import { partyColor } from '$lib/party-colors';
  import Tooltip from '$lib/components/Tooltip.svelte';
  import type { LowWinningShareRow } from '../types';

  let {
    rows,
    year
  }: {
    rows: LowWinningShareRow[];
    year: number;
  } = $props();

  // Single-member quota is fixed at 50% — every Westminster contest
  // is single-seat (historical multi-member contests are excluded
  // from this leaderboard upstream).
  const QUOTA = 0.5;
</script>

<table>
  <thead>
    <tr>
      <th scope="col" class="num">#</th>
      <th scope="col">Constituency</th>
      <th scope="col">Winning party</th>
      <th scope="col">Winning candidate</th>
      <th scope="col" class="num">Votes</th>
      <th scope="col" class="num">
        <Tooltip
          icon
          body="Winning candidate's votes ÷ valid votes in the constituency."
        >
          Share of votes
        </Tooltip>
      </th>
      <th scope="col" class="num">
        <Tooltip
          icon
          body="Winner's share minus the proportional quota (50% for a single-member seat). Negative = won the seat below the quota."
        >
          Below quota
        </Tooltip>
      </th>
      <th scope="col" class="num">Runner-up share</th>
    </tr>
  </thead>
  <tbody>
    {#each rows as r, i (r.constituencyId)}
      {@const drift = r.winningShare - QUOTA}
      <tr>
        <td class="num">{i + 1}</td>
        <th scope="row">
          <a href={`/parliament/${year}/${r.constituencySlug}`}
            >{r.constituencyName}</a>
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
        <td class="num">{num(r.winningVotes)}</td>
        <td class="num">{pct(r.winningShare, 1)}</td>
        <td class="num" class:warn={drift < 0}>{pts(drift)}</td>
        <td class="num">
          {r.runnerUpShare == null ? '—' : pct(r.runnerUpShare, 1)}
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
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
    padding: 0 0.35rem;
    font-size: 0.75rem;
    color: var(--warn);
    border: 1px solid var(--warn);
    border-radius: 2px;
  }

  .warn {
    color: var(--warn);
  }
</style>
