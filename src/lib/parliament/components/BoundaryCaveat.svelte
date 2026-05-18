<script lang="ts">
  let { boundarySet }: { boundarySet?: string } = $props();
</script>

<aside class="boundary-caveat" role="note" aria-label="Boundary comparability">
  <p>
    <strong>Boundary change caveat.</strong>
    {#if boundarySet}
      This constituency was contested under the
      <em>{boundarySet}</em> boundaries.
    {/if}
    Comparisons with earlier elections under different boundaries are
    limited &mdash; the same constituency name can map to a different
    geography across reviews.
    <a href="/parliament/methodology#caveats">More on data caveats.</a>
  </p>
</aside>

<style>
  .boundary-caveat {
    margin: 1.25rem 0;
    padding: 0.75rem 1rem;
    border: 1px solid var(--warn);
    border-left-width: 4px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--warn) 6%, transparent);
  }

  .boundary-caveat p {
    margin: 0;
    font-size: 0.95rem;
  }
</style>
