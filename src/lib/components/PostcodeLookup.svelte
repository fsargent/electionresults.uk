<script lang="ts">
  import { goto } from '$app/navigation';

  interface Props {
    /** Set of valid council slugs from `distinctCouncilSlugs()`. */
    councilSlugs: { councilSlug: string; council: string }[];
  }

  let { councilSlugs }: Props = $props();

  // Lowercase set for O(1) match against slugified admin_district /
  // admin_county. $derived so Svelte 5 doesn't warn about a prop being
  // captured by a top-level constant.
  const slugSet = $derived(new Set(councilSlugs.map((c) => c.councilSlug)));

  let postcode = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  // postcodes.io accepts whitespace anywhere; we still validate loosely
  // before the network round-trip so obviously-wrong input fails fast.
  // Pattern is the canonical BS7666 form, deliberately permissive on
  // case and spacing.
  const POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

  function slugifyDistrict(name: string): string {
    return name
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[''']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Try admin_district first (the Local Authority District, which is
   * what we publish per-council). Fall back to admin_county for
   * two-tier areas where postcodes.io has surprised us, then to
   * european_electoral_region as a last resort. Returns the matched
   * council slug, or null if none of the candidates exist in our data.
   */
  function matchSlug(result: {
    admin_district?: string | null;
    admin_county?: string | null;
  }): string | null {
    const candidates = [result.admin_district, result.admin_county].filter(
      (v): v is string => Boolean(v)
    );
    const set = slugSet;
    for (const name of candidates) {
      const slug = slugifyDistrict(name);
      if (set.has(slug)) return slug;
    }
    return null;
  }

  async function lookupPostcode(raw: string) {
    const cleaned = raw.trim().toUpperCase();
    if (!POSTCODE_RE.test(cleaned)) {
      error = 'That doesn’t look like a UK postcode.';
      return;
    }
    busy = true;
    error = null;
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}`
      );
      if (res.status === 404) {
        error = 'Postcode not found.';
        return;
      }
      if (!res.ok) {
        error = 'Lookup failed. Try again in a moment.';
        return;
      }
      const json = (await res.json()) as {
        result: { admin_district?: string | null; admin_county?: string | null };
      };
      const slug = matchSlug(json.result);
      if (!slug) {
        const place = json.result.admin_district ?? json.result.admin_county ?? 'your area';
        error = `${place} isn’t in our dataset yet.`;
        return;
      }
      await goto(`/${slug}`);
    } catch {
      error = 'Lookup failed. Check your connection.';
    } finally {
      busy = false;
    }
  }

  function useMyLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      error = 'Your browser doesn’t support geolocation.';
      return;
    }
    busy = true;
    error = null;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.postcodes.io/postcodes?lon=${longitude}&lat=${latitude}&limit=1`
          );
          if (!res.ok) {
            error = 'Couldn’t find a council near you.';
            return;
          }
          const json = (await res.json()) as {
            result:
              | { admin_district?: string | null; admin_county?: string | null }[]
              | null;
          };
          const first = json.result?.[0];
          if (!first) {
            error = 'No council found near your location.';
            return;
          }
          const slug = matchSlug(first);
          if (!slug) {
            const place = first.admin_district ?? first.admin_county ?? 'your area';
            error = `${place} isn’t in our dataset yet.`;
            return;
          }
          await goto(`/${slug}`);
        } catch {
          error = 'Lookup failed. Check your connection.';
        } finally {
          busy = false;
        }
      },
      (geoErr) => {
        busy = false;
        error =
          geoErr.code === geoErr.PERMISSION_DENIED
            ? 'Location permission denied.'
            : 'Couldn’t read your location.';
      },
      { timeout: 10_000, maximumAge: 60_000 }
    );
  }

  function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!busy) lookupPostcode(postcode);
  }
</script>

<form class="lookup" onsubmit={onSubmit} aria-label="Find your council">
  <label for="postcode-lookup" class="lookup-label">
    Find your council
  </label>
  <div class="lookup-row">
    <input
      id="postcode-lookup"
      type="text"
      inputmode="text"
      autocomplete="postal-code"
      placeholder="e.g. SW1A 1AA"
      bind:value={postcode}
      disabled={busy}
      aria-describedby={error ? 'lookup-error' : undefined}
    />
    <button type="submit" disabled={busy || postcode.trim().length === 0}>
      {busy ? 'Looking up…' : 'Go'}
    </button>
    <button
      type="button"
      class="locate"
      onclick={useMyLocation}
      disabled={busy}
      title="Use my current location"
    >
      Use my location
    </button>
  </div>
  {#if error}
    <p id="lookup-error" class="lookup-error" role="alert">{error}</p>
  {/if}
</form>

<style>
  .lookup {
    margin: 1.25rem 0 1.5rem;
    padding: 0.85rem 1rem;
    background: var(--bg);
    border: 1px solid var(--rule);
    border-radius: 6px;
  }
  .lookup-label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.4rem;
    color: var(--fg);
  }
  .lookup-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: stretch;
  }
  input {
    flex: 1 1 12rem;
    min-width: 0;
    padding: 0.55rem 0.7rem;
    font: inherit;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--rule);
    border-radius: 4px;
    text-transform: uppercase;
  }
  input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
    border-color: var(--accent);
  }
  button {
    padding: 0.55rem 0.9rem;
    font: inherit;
    font-weight: 600;
    color: var(--accent-fg);
    background: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 4px;
    cursor: pointer;
    min-height: 44px;
  }
  button.locate {
    color: var(--accent);
    background: transparent;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .lookup-error {
    margin: 0.5rem 0 0;
    color: var(--warn);
    font-size: 0.9rem;
  }
  @media (max-width: 480px) {
    .lookup-row {
      flex-direction: column;
    }
    button {
      width: 100%;
    }
  }
</style>
