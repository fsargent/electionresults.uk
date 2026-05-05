<script lang="ts">
  import '$lib/styles/global.css';
  let { children } = $props();
</script>

<nav class="site" aria-label="Primary">
  <a class="brand" href="/">electionresults.uk</a>
  <a href="/minority-winners">Minority winners</a>
  <a href="/methodology">Methodology</a>
  <a href="/data">Data</a>
</nav>

{@render children?.()}

<footer>
  <div class="inner">
    <p>
      A volunteer audit of UK local elections, built in partnership with
      <a href="https://www.makevotesmatter.co.uk/">Make Votes Matter</a>.
      Source data published under Open Parliament Licence (House of Commons
      Library) and Democracy Club's redistribution licence. Methodology and
      raw data are <a href="/data">open for inspection</a>.
    </p>
    <p class="muted">
      <strong>Note on framing.</strong> Named winners on this site appear as
      evidence of how First-Past-the-Post elects representatives without
      majority support. The voting method is the subject; individuals are not.
      See <a href="/methodology">methodology</a> for the full editorial frame.
    </p>
  </div>
</footer>
