<script lang="ts">
  import { num } from '$lib/format';
  let { data } = $props();
</script>

<svelte:head>
  <title>UK general elections — Parliament audit — electionresults.uk</title>
  <meta
    name="description"
    content="Audit pages for UK general elections under First Past the Post. Constituency winners, vote-share vs seat-share, and disproportionality, computed from the House of Commons Library general-election dataset."
  />
  <link rel="canonical" href="https://electionresults.uk/parliament" />
</svelte:head>

<main>
  <h1>UK general elections</h1>
  <p>
    This section is a First-Past-the-Post audit of UK general elections
    &mdash; the same scrutiny we apply to council elections, applied to
    Westminster. It is distinct from the
    <a href="/councils/distortion">council audit</a>. The voting method,
    not any individual candidate, is the subject of the analysis on
    every page here.
  </p>

  {#if data.elections.length === 0}
    <p class="muted">
      No general elections have been ingested yet. Check back once the
      first dataset is wired in.
    </p>
  {:else}
    <h2>Ingested elections</h2>
    <ul>
      {#each data.elections as e (e.year)}
        <li>
          <a href={e.href}>{e.year}</a> &mdash;
          {num(e.minorityWinnerCount)} of {num(e.totalSeats)} seats won
          without majority support
        </li>
      {/each}
    </ul>
    <p class="muted">
      A &ldquo;minority-mandate&rdquo; seat is one where the winning
      candidate took less than 50% of valid votes in their constituency
      &mdash; First Past the Post awards the seat anyway. Click an
      election year to see the full per-constituency record.
    </p>
  {/if}

  <p class="muted">
    How these numbers are computed:
    <a href="/parliament/methodology">methodology</a>. Source data:
    {#each data.manifests as m (m.year)}
      <a href={m.manifest.sourceUrl} rel="external noopener"
        >{m.manifest.sourceName}</a>{#if m !== data.manifests[data.manifests.length - 1]};
      {/if}
    {/each}.
  </p>
</main>
