<script lang="ts">
  import '$lib/styles/global.css';
  let { children } = $props();
</script>

<svelte:head>
  <!-- Site-wide social-share preview. Per-page <title> and meta
       description are set in each route's own <svelte:head>; scrapers
       fall back to those when og:title / og:description are absent. -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="electionresults.uk" />
  <meta property="og:image" content="https://electionresults.uk/og/flip-map.png" />
  <meta property="og:image:width" content="1016" />
  <meta property="og:image:height" content="841" />
  <meta
    property="og:image:alt"
    content="Hex cartogram of UK councils, coloured by the party that took the lead in the most recent flip between consecutive election cycles."
  />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://electionresults.uk/og/flip-map.png" />
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
