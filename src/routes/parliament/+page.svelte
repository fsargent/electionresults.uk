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
    Westminster. It is distinct from the council audit, which lives at
    <a href="/councils/distortion">/councils</a>. The voting method, not
    any individual candidate, is the subject of the analysis on every
    page here.
  </p>

  {#if data.elections.length === 0}
    <p class="muted">
      No general elections have been ingested yet. Check back once the
      first dataset is wired in.
    </p>
  {:else}
    <h2>Ingested elections</h2>
    <ul class="elections">
      {#each data.elections as e (e.year)}
        <li>
          <a class="card" href={e.href}>
            <span class="year">{e.year}</span>
            <span class="headline">
              {num(e.minorityWinnerCount)} of {num(e.totalSeats)} seats
              won without majority support
            </span>
          </a>
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

  <footer class="page-footer">
    <p class="muted">
      How these numbers are computed:
      <a href="/parliament/methodology">methodology</a>. Source data:
      {#each data.manifests as m (m.year)}
        <a href={m.manifest.sourceUrl} rel="external noopener"
          >{m.manifest.sourceName}</a
        >{#if m !== data.manifests[data.manifests.length - 1]}; {/if}
      {/each}.
    </p>
  </footer>
</main>

<style>
  ul.elections {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0 1rem;
    display: grid;
    gap: 0.6rem;
  }

  .card {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.4rem 0.9rem;
    padding: 0.85rem 1rem;
    border: 1px solid var(--rule);
    border-radius: 6px;
    text-decoration: none;
    color: var(--fg);
    background: transparent;
  }

  .card:hover,
  .card:focus-visible {
    border-color: var(--accent);
    text-decoration: none;
  }

  .card:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .year {
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1.6rem;
    font-weight: 600;
    color: var(--accent);
  }

  .headline {
    font-size: 1rem;
    color: var(--fg);
  }

  .page-footer {
    margin-top: 2.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--rule);
  }
</style>
