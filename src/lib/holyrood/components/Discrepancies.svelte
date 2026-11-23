<script lang="ts">
  import type { Discrepancy } from '../types';
  let { rows }: { rows: Discrepancy[] } = $props();
</script>
{#if rows.length}
<section>
  <h2>Where the sources differ</h2>
  <p>These differences are retained for audit. Each entry states which value these pages use.
    EMB means the Electoral Management Board for Scotland; SPICe means the Scottish Parliament Information Centre.</p>
  {#each rows as row}
    <details><summary>{row.scope}: {row.field}</summary>
      <p>Used: {row.used} ({row.usedSource}). {row.note}</p>
      <ul>{#each row.others as other}<li>{other.source}: {other.value}</li>{/each}</ul>
    </details>
  {/each}
</section>
{/if}
