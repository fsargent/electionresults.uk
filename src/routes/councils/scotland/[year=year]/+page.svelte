<script lang="ts">
import NationResults from '$lib/components/NationResults.svelte';
let { data } = $props();
</script>
<NationResults {data} />
