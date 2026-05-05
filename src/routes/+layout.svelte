<script lang="ts">
  import '$lib/styles/global.css';
  let { children } = $props();
</script>

<nav class="site" aria-label="Primary">
  <a class="brand" href="/">electionresults.uk</a>
  <a href="/flips">Flips</a>
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
      Source data: House of Commons Library Local Election Handbooks,
      published under the Open Parliament Licence. Methodology and raw
      data are <a href="/data">open for inspection</a>; full source on
      <a href="https://github.com/fsargent/electionresults.uk">GitHub</a>.
      Errata:
      <a href="mailto:felix.sargent@gmail.com">felix.sargent@gmail.com</a>.
    </p>
    <p class="muted">
      <strong>Note on framing.</strong> Named winners on this site appear as
      evidence of how First-Past-the-Post elects representatives without
      majority support. The voting method is the subject; individuals are not.
      See <a href="/methodology">methodology</a> for the full editorial frame.
    </p>
    <p class="muted">
      Want a fix? Back the call for a
      <a href="https://www.open-britain.co.uk/ncer" rel="external noopener">National
      Commission on Electoral Representation</a>.
    </p>
  </div>
</footer>
