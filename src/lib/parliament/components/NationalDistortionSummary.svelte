<script lang="ts">
  import { num, pct } from '$lib/format';
  import type { NationalSummary } from '../types';

  let { summary }: { summary: NationalSummary } = $props();

  const minorityShare = $derived(summary.minorityWinnerCount / summary.totalSeats);
  const mostOver = $derived(
    [...summary.voteVsSeatGap].sort((a, b) => b.gap - a.gap)[0] ?? null
  );
  const mostUnder = $derived(
    [...summary.voteVsSeatGap].sort((a, b) => a.gap - b.gap)[0] ?? null
  );
</script>

<h2>National FPTP audit</h2>

<table>
  <tbody>
    <tr>
      <th scope="row">Seats won without majority support</th>
      <td class="num">
        {num(summary.minorityWinnerCount)} of {num(summary.totalSeats)}
        ({pct(minorityShare, 0)})
      </td>
    </tr>
    <tr>
      <th scope="row">
        Disproportionality (<a href="/parliament/methodology#gallagher"
          >Gallagher index</a>)
      </th>
      <td class="num">
        {summary.gallagher.toFixed(1)}
        <span class="muted">/ 0 = perfectly proportional</span>
      </td>
    </tr>
    {#if mostOver && mostOver.gap > 0}
      <tr>
        <th scope="row">Largest over-representation</th>
        <td class="num">
          {mostOver.partyDisplayName}
          <span class="muted">+{pct(mostOver.gap, 1)} seat-share gap</span>
        </td>
      </tr>
    {/if}
    {#if mostUnder && mostUnder.gap < 0}
      <tr>
        <th scope="row">Largest under-representation</th>
        <td class="num">
          {mostUnder.partyDisplayName}
          <span class="muted">{pct(mostUnder.gap, 1)} seat-share gap</span>
        </td>
      </tr>
    {/if}
    <tr>
      <th scope="row">Total seats audited</th>
      <td class="num">
        {num(summary.totalSeats)}
        <span class="muted">across {num(summary.totalVotes)} valid votes</span>
      </td>
    </tr>
  </tbody>
</table>

{#if summary.excludedFromMetrics.length > 0}
  <p class="muted">
    Excluded from headline metrics:
    {#each summary.excludedFromMetrics as ex, i (ex.caveat)}
      {num(ex.count)} {ex.caveat}{i < summary.excludedFromMetrics.length - 1
        ? ', '
        : ''}
    {/each}.
    <a href="/parliament/methodology#caveats">What these tokens mean.</a>
  </p>
{/if}
