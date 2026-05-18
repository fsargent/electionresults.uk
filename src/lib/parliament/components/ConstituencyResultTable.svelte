<script lang="ts">
  import { num, pct } from '$lib/format';
  import { partyColor } from '$lib/party-colors';
  import type { CandidateResult } from '../types';

  let {
    candidates,
    constituencyName: _constituencyName
  }: {
    candidates: CandidateResult[];
    constituencyName: string;
  } = $props();
</script>

<table>
  <thead>
    <tr>
      <th scope="col" class="num">Pos</th>
      <th scope="col">Candidate</th>
      <th scope="col">Party</th>
      <th scope="col" class="num">Votes</th>
      <th scope="col" class="num">Share</th>
      <th scope="col">Elected</th>
    </tr>
  </thead>
  <tbody>
    {#each candidates as c (c.candidateName + c.partyId)}
      <tr class:winner={c.isWinner}>
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
          {#if c.partySourceLabel && c.partySourceLabel !== c.partyDisplayName}
            <span class="muted source-label">({c.partySourceLabel})</span>
          {/if}
        </td>
        <td class="num">{num(c.votes)}</td>
        <td class="num">{c.share == null ? '—' : pct(c.share, 1)}</td>
        <td>
          {#if c.isWinner}
            <strong>Yes</strong>
          {:else}
            <span class="muted">No</span>
          {/if}
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  tr.winner {
    background: rgba(11, 61, 46, 0.06);
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
</style>
