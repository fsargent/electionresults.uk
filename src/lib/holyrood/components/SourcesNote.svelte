<script lang="ts">
  import type { HolyroodElection } from '../types';
  let { election }: { election: Pick<HolyroodElection, 'sources' | 'asElected'> } = $props();
</script>

<section class="sources" id="sources">
  <h2>Sources</h2>
  <ul>
    {#each election.sources as s (s.file)}
      <li>
        <a href={s.landingPage} rel="external noopener">{s.publisher}</a>:
        <a href={s.url} rel="external noopener">{s.title}</a>. {s.role}
        <span class="muted">Retrieved {s.retrievedAt}. {s.licence}</span>
      <details><summary>SHA-256 checksum</summary><code class="checksum">{s.sha256}</code></details>
      </li>
    {/each}
  </ul>
  <p class="muted">
    The original files are kept unchanged in the site’s repository under
    <code>source-data/holyrood/2026/</code> with SHA-256 checksums, and the
    importer that builds these pages is <code>scripts/etl-holyrood.mjs</code>.
    {election.asElected}
  </p>
</section>

<style>.checksum { overflow-wrap: anywhere; }</style>
