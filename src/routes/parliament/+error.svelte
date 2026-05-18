<script lang="ts">
  import { page } from '$app/state';

  // SvelteKit fills these in from the route subtree that errored. We
  // surface a year-specific link only when the URL actually carried a
  // year segment, so /parliament/1066 sends you back to /parliament
  // (no such year ever existed in our data) but
  // /parliament/2024/badslug offers the 2024 overview too.
  const status = $derived(page.status);
  const year = $derived(page.params.year);
  const message = $derived(page.error?.message ?? 'Page not found.');
</script>

<svelte:head>
  <title>{status} &mdash; Parliament &mdash; electionresults.uk</title>
</svelte:head>

<main>
  <h1>{status} &mdash; this parliamentary page isn&rsquo;t here</h1>
  <p>{message}</p>

  <p>
    We may not have ingested the requested year, or a constituency slug
    has changed since the link was created. Try one of these:
  </p>
  <ul>
    <li>
      <a href="/parliament">All ingested UK general elections</a>
    </li>
    {#if year}
      <li>
        <a href={`/parliament/${year}`}>{year} general election overview</a>
      </li>
    {/if}
    <li>
      <a href="/parliament/methodology">Methodology &amp; data caveats</a>
    </li>
  </ul>
</main>

<style>
  ul {
    padding-left: 1.5rem;
  }

  ul li {
    margin: 0.4rem 0;
  }

  a:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
</style>
