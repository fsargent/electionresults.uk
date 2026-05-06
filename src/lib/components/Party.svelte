<script lang="ts">
  import { partyColor, partyDisplayName } from '$lib/party-colors';
  let { name }: { name: string | null | undefined } = $props();
  const colour = $derived(partyColor(name));
  const display = $derived(partyDisplayName(name));
</script>

<span class="party">
  <span
    class="party-swatch"
    aria-hidden="true"
    style:background-color={colour}
  ></span>{display}
</span>

<style>
  .party {
    white-space: nowrap;
  }
  .party-swatch {
    display: inline-block;
    width: 0.7em;
    height: 0.7em;
    border-radius: 2px;
    margin-right: 0.4em;
    vertical-align: -0.05em;
    border: 1px solid rgba(0, 0, 0, 0.18);
  }
  @media (prefers-color-scheme: dark) {
    .party-swatch {
      border-color: rgba(255, 255, 255, 0.25);
    }
  }
</style>
