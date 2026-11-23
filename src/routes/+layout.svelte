<script lang="ts">
  import '$lib/styles/global.css';
  import { page } from '$app/state';
  import { councilYears, electionNavigation } from '$lib/election-navigation';
  let { children } = $props();

  const selectedYear = $derived(page.params.year ?? '2026');
  const councilYear = $derived(councilYears.includes(Number(selectedYear)) ? selectedYear : String(councilYears[0]));
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
    { label: 'By-elections', councils: '/councils/by-elections', parliament: null },
    { label: 'Parties', councils: '/councils/parties', parliament: '/parliament/parties' },
    { label: 'Methodology', councils: '/councils/methodology', parliament: '/parliament/methodology' },
    { label: 'Data', councils: '/councils/data', parliament: '/parliament/data' }
  ];
  const visibleNav = $derived(
    navItems.filter((i) => (onParliament ? i.parliament : onCouncils ? i.councils : null) != null)
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
</nav>

<nav class="nation-nav" aria-label="Election sections">
  <a href="/elections">All elections</a> · <a href={`/councils/${councilYear}`}>Councils {councilYear}</a> · <a href="/parliament">Westminster</a>
  {#each electionNavigation as item} · <a href={item.href}>{item.label}</a>{/each}
</nav>
{#if onCouncils}
<nav class="nation-nav" aria-label="Council results by nation">
  <a href={`/councils/${selectedYear}`}>All councils {selectedYear}</a> ·
  <a href={`/councils/england/${selectedYear}`}>England</a> ·
  <a href={`/councils/scotland/${selectedYear}`}>Scotland</a> ·
  <a href={`/councils/wales/${selectedYear}`}>Wales</a> ·
  <a href={`/councils/northern-ireland/${selectedYear}`}>Northern Ireland</a> ·
  <a href="/">Council audit</a>
</nav>
{/if}
{@render children?.()}
<style>.nation-nav { max-width: 96ch; margin: 0 auto; padding: 0.75rem 1.25rem; }</style>

<footer>
  <div class="inner">
    <p>
      Built by <a href="https://felixsargent.com">Felix Sargent</a> in
      partnership with
      <a href="https://www.makevotesmatter.co.uk/">Make Votes Matter</a>.
      Council source data: House of Commons Library Local Election Handbooks
      (2021&ndash;2025), published under the Open Parliament Licence;
      pre-2021 ward results from
      <a href="https://www.andrewteale.me.uk/leap/" rel="external noopener">Andrew Teale's
      Local Elections Archive Project</a>
      (CC&nbsp;BY-SA&nbsp;3.0); 2026 results from
      <a href="https://democracyclub.org.uk" rel="external noopener">Democracy Club</a>
      (CC&nbsp;BY&nbsp;4.0).
      Parliamentary sources are documented on each election’s results page.
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
      Want a fix? See what a proportional system could look like at
      <a href="https://proportional.uk" rel="external noopener">proportional.uk</a>.
    </p>
  </div>
</footer>
