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

<table>
  <thead>
    <tr>
      <th scope="col" class="num">#</th>
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
        <td class="num">{pct(r.winningShare, 1)}</td>
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
</style>
