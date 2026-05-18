<script lang="ts">
  import '$lib/styles/global.css';
  import { page } from '$app/state';
  let { children } = $props();

  // Domain badge driven by URL path so the layout owns it (UX-G4).
  // Individual pages no longer ship their own badges. The badge is
  // strictly limited to the two audit-product subtrees — homepage
  // and /data are neutral so the council-launch hero isn't visually
  // re-themed on the front page.
  const domain = $derived.by<'parliament' | 'councils' | null>(() => {
    const p = page.url?.pathname ?? '';
    if (p.startsWith('/parliament')) return 'parliament';
    if (p.startsWith('/councils')) return 'councils';
    return null;
  });
</script>

<svelte:head>
  <!-- Site identity only. og:image lives on each route's own
       <svelte:head> so per-page social previews override cleanly
       (duplicate og:image tags are handled inconsistently across
       Twitter / Facebook / LinkedIn). The homepage and leaderboard
       pages set the flip-map cartogram; per-council pages set their
       own vote-share-vs-seats card from /og/<councilSlug>.png. -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="electionresults.uk" />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<nav class="site" aria-label="Primary">
  <a class="brand" href="/">electionresults.uk</a>
  <a href="/councils/flips">Flips</a>
  <a href="/councils/distortion">Distortion</a>
  <a href="/councils/below-quota">Below quota</a>
  <a href="/councils/parties">Parties</a>
  <a href="/councils/methodology">Methodology</a>
  <a href="/data">Data</a>
  {#if domain === 'parliament'}
    <a class="secondary current" href="/parliament" aria-current="page"
      >Parliament</a>
  {:else}
    <a class="secondary" href="/parliament">Parliament</a>
  {/if}
  {#if domain}
    <span
      class="domain-badge"
      class:parliament={domain === 'parliament'}
      class:councils={domain === 'councils'}
      aria-label={`Currently viewing: ${domain === 'parliament' ? 'Parliament' : 'Councils'}`}
    >
      {domain === 'parliament' ? 'Parliament' : 'Councils'}
    </span>
  {/if}
</nav>

{@render children?.()}

<footer>
  <div class="inner">
    <p>
      Built by <a href="https://felixsargent.com">Felix Sargent</a> in
      partnership with
      <a href="https://www.makevotesmatter.co.uk/">Make Votes Matter</a>.
      Source data: House of Commons Library Local Election Handbooks
      (2021&ndash;2025), published under the Open Parliament Licence;
      pre-2021 ward results from
      <a href="https://www.andrewteale.me.uk/leap/" rel="external noopener">Andrew Teale's
      Local Elections Archive Project</a>
      (CC&nbsp;BY-SA&nbsp;3.0); preliminary 2026 results from
      <a href="https://democracyclub.org.uk" rel="external noopener">Democracy Club</a>
      (CC&nbsp;BY&nbsp;4.0).
      Site released under
      <a href="https://creativecommons.org/licenses/by/4.0/" rel="external noopener">CC&nbsp;BY&nbsp;4.0</a>;
      LEAP-derived data downloads under
      <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="external noopener">CC&nbsp;BY-SA&nbsp;4.0</a>.
      Methodology and raw data are <a href="/data">open for inspection</a>;
      full source on
      <a href="https://github.com/fsargent/electionresults.uk">GitHub</a>.
      Errata:
      <a href="mailto:felix.sargent@gmail.com">felix.sargent@gmail.com</a>.
    </p>
    <p class="muted">
      Want a fix? Back the call for a
      <a href="https://www.open-britain.co.uk/ncer" rel="external noopener">National
      Commission on Electoral Representation</a>.
    </p>
  </div>
</footer>

<style>
  /* Secondary nav item — visually distinct from the primary council
     links so the homepage hero isn't taken over by Parliament. Reads
     as "and there's also this audit surface" rather than a peer link. */
  nav.site :global(a.secondary) {
    padding: 0.05rem 0.55rem;
    border: 1px solid var(--rule);
    border-radius: 999px;
    text-decoration: none;
    color: var(--fg);
    /* ≥44×44 tap target on mobile */
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }

  nav.site :global(a.secondary:hover),
  nav.site :global(a.secondary:focus-visible) {
    border-color: var(--accent);
    color: var(--accent);
  }

  nav.site :global(a.secondary.current) {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    border-color: var(--accent);
    color: var(--accent);
  }

  /* Persistent domain badge so a reader always knows which surface
     they're on, even after deep-linking past the page-level <h1>.
     Margin-left:auto pushes it to the right of the nav row on wide
     viewports; it stays visible inline on narrow viewports (the nav
     wraps gracefully via flex-wrap). */
  .domain-badge {
    margin-left: auto;
    padding: 0.2rem 0.6rem;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border-radius: 3px;
    color: var(--accent-fg);
    background: var(--accent);
    align-self: center;
  }

  /* .domain-badge.parliament / .domain-badge.councils share the same
     accent today — site identity stays consistent. Class hooks are
     present on the element so a follow-up design tweak can
     differentiate them without touching this layout. */
</style>
