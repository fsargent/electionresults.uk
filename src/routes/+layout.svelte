<script lang="ts">
  import '$lib/styles/global.css';
  let { children } = $props();
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
