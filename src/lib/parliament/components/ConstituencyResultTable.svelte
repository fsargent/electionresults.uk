<script lang="ts">
  import { num, pct } from '$lib/format';
  import { partyColor } from '$lib/party-colors';
  import type { CandidateResult } from '../types';

  let {
    candidates,
    constituencyName
  }: {
    candidates: CandidateResult[];
    constituencyName: string;
  } = $props();
</script>

<div class="table-scroll">
  <table class="result">
    <caption class="visually-hidden">
      Candidate-by-candidate result for {constituencyName}: name, party,
      votes received, share of valid votes, finishing position, and
      whether they were elected.
    </caption>
    <thead>
      <tr>
        <th scope="col" class="pos">Pos</th>
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
          <td class="pos">{c.position}</td>
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
              <span class="source-label" title="Source-data label">
                ({c.partySourceLabel})
              </span>
            {/if}
          </td>
          <td class="num">{num(c.votes)}</td>
          <td class="num">
            {#if c.share == null}
              &mdash;
            {:else}
              {pct(c.share, 1)}
            {/if}
          </td>
          <td>
            {#if c.isWinner}
              <span class="elected-mark" aria-label="Elected">Yes</span>
            {:else}
              <span class="muted">No</span>
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

  table.result {
    width: 100%;
    border-collapse: collapse;
    margin: 0.75rem 0;
    font-size: 0.95rem;
  }

  table.result th,
  table.result td {
    padding: 0.55rem 0.6rem;
    border-bottom: 1px solid var(--rule);
    vertical-align: top;
    text-align: left;
  }

  table.result thead th {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--muted);
    border-bottom: 2px solid var(--rule);
    white-space: nowrap;
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .pos {
    text-align: right;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    width: 2.5rem;
  }

  th[scope='row'] {
    font-weight: 500;
  }

  tr.winner th[scope='row'] {
    font-weight: 700;
  }

  tr.winner {
    background: color-mix(in srgb, var(--accent) 6%, transparent);
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
    color: var(--muted);
    font-size: 0.85rem;
  }

  /* "Elected" cell carries the affirmative text. The row tint is
     decorative; sighted users get the bold name + tint, screen
     readers get the explicit "Yes"/"No" so colour is never the only
     signal (NFR10). */
  .elected-mark {
    font-weight: 600;
    color: var(--accent);
  }

  .muted {
    color: var(--muted);
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
