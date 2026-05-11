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
  <a href="/flips">Flips</a>
  <a href="/distortion">Distortion</a>
  <a href="/below-quota">Below quota</a>
  <a href="/methodology">Methodology</a>
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
      preliminary 2026 results from
      <a href="https://democracyclub.org.uk" rel="external noopener">Democracy Club</a>,
      reused under
      <a href="https://creativecommons.org/licenses/by/4.0/" rel="external noopener">CC&nbsp;BY&nbsp;4.0</a>.
      Methodology and raw data are <a href="/data">open for inspection</a>;
      full source on
      <a href="https://github.com/fsargent/electionresults.uk">GitHub</a>.
      Errata:
      <a href="mailto:felix.sargent@gmail.com">felix.sargent@gmail.com</a>.
    </p>
    <p class="muted">
      <strong>Note on framing.</strong> Named winners on this site appear as
      evidence of how First-Past-the-Post elects representatives when most
      voters in a ward chose someone else. The voting method is the subject;
      individuals are not. See <a href="/methodology">methodology</a> for the
      full editorial frame.
    </p>
    <p class="muted">
      Want a fix? Back the call for a
      <a href="https://www.open-britain.co.uk/ncer" rel="external noopener">National
      Commission on Electoral Representation</a>.
    </p>
  </div>
</footer>
