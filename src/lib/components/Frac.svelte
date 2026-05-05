<script lang="ts">
  let {
    num,
    denom,
    label
  }: { num: string; denom: string; label?: string } = $props();
</script>

<span
  class="frac"
  role="math"
  aria-label={label ?? `${num} divided by ${denom}`}
>
  <span class="num">{num}</span>
  <span class="denom">{denom}</span>
</span>

<style>
  .frac {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    vertical-align: -0.4em;
    margin: 0 0.15em;
    font-style: italic;
    line-height: 1.05;
    font-size: 0.95em;
  }
  .num,
  .denom {
    padding: 0 0.4em;
    font-variant-numeric: tabular-nums;
  }
  .num {
    border-bottom: 1px solid currentColor;
  }
</style>
