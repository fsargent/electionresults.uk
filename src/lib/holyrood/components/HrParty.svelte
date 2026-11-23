<script lang="ts">
  import type { HolyroodParty } from '../types';
  let { party, short = false }: { party: HolyroodParty; short?: boolean } = $props();
</script>

<span class="hr-party"><span class="swatch" aria-hidden="true" style:background-color={party.color}
  ></span>{short ? party.shortName : party.name}</span>

<style>
  .hr-party { white-space: nowrap; }
  .swatch {
    display: inline-block;
    width: 0.7em;
    height: 0.7em;
    border-radius: 2px;
    margin-right: 0.4em;
    vertical-align: -0.05em;
    border: 1px solid rgba(0, 0, 0, 0.18);
  }
</style>
