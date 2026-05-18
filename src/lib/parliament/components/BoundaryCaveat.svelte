<script lang="ts">
  let { boundarySet }: { boundarySet?: string } = $props();
</script>

<aside class="system-note" role="note" aria-label="Boundary comparability">
  <strong>Boundary change caveat.</strong>
  {#if boundarySet}
    This constituency was contested under the
    <em>{boundarySet}</em> boundaries.
  {/if}
  Comparisons with earlier elections under different boundaries are
  limited &mdash; the same constituency name can map to a different
  geography across reviews.
  <a href="/parliament/methodology#caveats">More on data caveats.</a>
</aside>
