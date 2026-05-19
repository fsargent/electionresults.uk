<script lang="ts">
  // Per-constituency candidate table. Same column shape as the
  // council-ward table on /councils/[council]/[year]:
  // Rank · Candidate · Party · Votes · Share of votes · Below quota ·
  // Elected. Westminster contests are always single-member, so the
  // proportional quota is fixed at 50% and the "Below quota" column
  // is populated only for the winner's row (signed pts vs 50%).

  import { num, pct, pts } from '$lib/format';
  import { partyColor } from '$lib/party-colors';
  import Tooltip from '$lib/components/Tooltip.svelte';
  import type { CandidateResult } from '../types';

  let {
    candidates,
    constituencyName: _constituencyName
  }: {
    candidates: CandidateResult[];
    constituencyName: string;
  } = $props();

  /**
   * Single-member quota = 1 / (seats + 1) = 0.5 for one seat. Hard-
   * coded here because every Westminster contest is single-member;
   * historical multi-member seats are filtered out of the audit
   * upstream (caveat: multi-member-historical).
   */
  const QUOTA = 0.5;

  /**
   * True when the source-data party label is just a shorter / longer
   * form of the canonical display name and would only add visual noise
   * if shown alongside it. We hide it in that case ("Labour Party
   * (Labour)" reads as redundant) and keep it only when it carries
   * genuinely distinct information (e.g. "Labour Party" vs source
   * "Labour and Co-operative", where the co-op suffix is editorial
   * signal worth preserving). Compare case-insensitively after
   * collapsing whitespace; either-direction prefix counts as a match.
   */
  function isNoisyDuplicate(source: string, display: string): boolean {
    const s = source.trim().toLowerCase();
    const d = display.trim().toLowerCase();
    if (!s || !d) return true;
    return s === d || d.startsWith(s) || s.startsWith(d);
  }
</script>

<table>
  <thead>
    <tr>
      <th scope="col" class="num">Rank</th>
      <th scope="col">Candidate</th>
      <th scope="col">Party</th>
      <th scope="col" class="num">Votes</th>
      <th scope="col" class="num">
        <Tooltip
          icon
          body="Candidate votes ÷ valid votes in this constituency. Matches the share the returning officer publishes."
        >
          Share of votes
        </Tooltip>
      </th>
      <th scope="col" class="num">
        <Tooltip
          icon
          body="Elected candidate's share of valid votes minus the proportional quota (50% for a single-member seat). Negative = won the seat below the quota; positive = cleared it."
        >
          Below quota
        </Tooltip>
      </th>
      <th scope="col">Elected</th>
    </tr>
  </thead>
  <tbody>
    {#each candidates as c (c.candidateName + c.partyId)}
      {@const drift = c.share == null ? null : c.share - QUOTA}
      <tr class:elected={c.isWinner}>
        <td class="num">{c.position}</td>
        <th scope="row">
          {c.candidateName}
          {#each c.caveats as token (token)}
            <span class="caveat" title={`Caveat: ${token}`}>{token}</span>
          {/each}
        </th>
        <td>
          <span
            class="swatch"
            style="background:{partyColor(c.partyDisplayName)}"
            aria-hidden="true"
          ></span>
          {c.partyDisplayName}
          {#if c.partySourceLabel && !isNoisyDuplicate(c.partySourceLabel, c.partyDisplayName)}
            <span class="muted source-label">({c.partySourceLabel})</span>
          {/if}
        </td>
        <td class="num">{num(c.votes)}</td>
        <td class="num pct">{c.share == null ? '—' : pct(c.share, 1)}</td>
        <td class="num pct" class:warn={c.isWinner && drift != null && drift < 0}>
          {#if c.isWinner && drift != null}
            {pts(drift)}
          {:else}
            <span class="muted">—</span>
          {/if}
        </td>
        <td>
          {#if c.isWinner}
            <span aria-label="Elected to seat" title="Elected to seat">Elected</span>
          {/if}
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  tr.elected td,
  tr.elected th {
    font-weight: 600;
  }

  .swatch {
    display: inline-block;
    width: 0.7rem;
    height: 0.7rem;
    margin-right: 0.35rem;
    border-radius: 2px;
    vertical-align: baseline;
  }

  .source-label {
    font-size: 0.85rem;
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
