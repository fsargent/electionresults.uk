<script lang="ts">
  import '$lib/styles/global.css';
  import { page } from '$app/state';
  let { children } = $props();

  const onParliament = $derived(
    (page.url?.pathname ?? '').startsWith('/parliament')
  );
  // The homepage `/` IS the council audit — most recent local
  // election cycle, council-product hero. Treating it as on-council
  // for the brand suffix and nav-target logic means the section
  // identity is editorial-truthful even when the URL is just `/`.
  const onCouncils = $derived(
    (page.url?.pathname ?? '') === '/' ||
      (page.url?.pathname ?? '').startsWith('/councils')
  );
  const brandSection = $derived(
    onParliament ? '/parliament' : onCouncils ? '/councils' : ''
  );

  // Nav items have a per-domain target — when the reader is browsing
  // the parliament side of the site, the same labels jump to the
  // parliament equivalent of each lens rather than the council one.
  // Items with parliament=null are council-only (no Westminster
  // counterpart yet) and are hidden from the nav when onParliament.
  const navItems: {
    label: string;
    councils: string | null;
    parliament: string | null;
  }[] = [
    { label: 'Flips', councils: '/councils/flips', parliament: null },
    { label: 'Distortion', councils: '/councils/distortion', parliament: null },
    { label: 'Below quota', councils: '/councils/below-quota', parliament: null },
    { label: 'Parties', councils: '/councils/parties', parliament: '/parliament/parties' },
    { label: 'Methodology', councils: '/councils/methodology', parliament: '/parliament/methodology' },
    { label: 'Data', councils: '/councils/data', parliament: '/parliament/data' }
  ];
  const visibleNav = $derived(
    navItems.filter((i) => (onParliament ? i.parliament : i.councils) != null)
  );
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
  <a class="brand" href={onParliament ? '/parliament' : '/'}>
    electionresults.uk{#if brandSection}<span class="brand-section">{brandSection}</span>{/if}
  </a>
  {#each visibleNav as item (item.label)}
    <a href={(onParliament ? item.parliament : item.councils) ?? '#'}>{item.label}</a>
  {/each}
  {#if onParliament}
    <a class="cross-domain" href="/">Council&nbsp;&rarr;</a>
  {:else}
    <a class="cross-domain" href="/parliament">Parliament&nbsp;&rarr;</a>
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
      Methodology and raw data are <a href="/councils/data">open for inspection</a>;
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
