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
  // Case-folded display name → slug, for matching free-text council
  // input against the canonical name from the dataset.
  const nameToSlug = $derived(
    new Map(councilSlugs.map((c) => [c.council.toLowerCase(), c.councilSlug]))
  );

  let query = $state('');
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
   * Resolve a free-text council name to a slug. Tries:
   *   1. Exact (case-insensitive) match against the canonical display name.
   *   2. Slugified match — handles users typing "City of London" /
   *      "city-of-london" / "CITY OF LONDON" alike.
   * Returns null if nothing matches.
   */
  function matchCouncilName(raw: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const exact = nameToSlug.get(trimmed.toLowerCase());
    if (exact) return exact;
    const slug = slugifyDistrict(trimmed);
    if (slug && slugSet.has(slug)) return slug;
    return null;
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

  async function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (busy) return;
    const raw = query.trim();
    if (!raw) return;
    // If it parses as a postcode, route to the postcodes.io path.
    // Otherwise try to resolve as a council name. We check name FIRST
    // when the input clearly isn't postcode-shaped so users typing
    // "Tamworth" don't see a "doesn't look like a UK postcode" error.
    if (POSTCODE_RE.test(raw.toUpperCase())) {
      await lookupPostcode(raw);
      return;
    }
    const slug = matchCouncilName(raw);
    if (slug) {
      error = null;
      await goto(`/${slug}`);
      return;
    }
    error = `No council matching "${raw}". Try a postcode, or pick from the suggestions.`;
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
      autocomplete="off"
      spellcheck="false"
      list="council-suggestions"
      placeholder="Postcode or council name"
      bind:value={query}
      disabled={busy}
      aria-describedby={error ? 'lookup-error' : undefined}
    />
    <button
      type="submit"
      class="primary"
      disabled={busy || query.trim().length === 0}
    >
      {busy ? '…' : 'Go'}
    </button>
  </div>
  <datalist id="council-suggestions">
    {#each councilSlugs as c (c.councilSlug)}
      <option value={c.council}></option>
    {/each}
  </datalist>
  <button
    type="button"
    class="locate"
    onclick={useMyLocation}
    disabled={busy}
  >
    <svg
      class="pin"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M8 0a5 5 0 0 0-5 5c0 4 5 11 5 11s5-7 5-11a5 5 0 0 0-5-5Zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"
      />
    </svg>
    or use my current location
  </button>
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
    gap: 0.4rem;
    align-items: stretch;
  }
  input {
    flex: 1 1 auto;
    min-width: 0;
    height: 44px;
    box-sizing: border-box;
    padding: 0 0.7rem;
    font: inherit;
    color: var(--fg);
    background: var(--bg);
    border: 1px solid var(--rule);
    border-radius: 4px;
  }
  input::placeholder {
    color: var(--muted);
    letter-spacing: 0.02em;
  }
  input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
    border-color: var(--accent);
  }
  button.primary {
    flex: 0 0 auto;
    height: 44px;
    padding: 0 1.1rem;
    font: inherit;
    font-weight: 600;
    color: var(--accent-fg);
    background: var(--accent);
    border: 1px solid var(--accent);
    border-radius: 4px;
    cursor: pointer;
  }
  button.locate {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-top: 0.5rem;
    padding: 0.25rem 0;
    font: inherit;
    font-size: 0.9rem;
    color: var(--accent);
    background: transparent;
    border: 0;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .pin {
    flex: 0 0 auto;
  }
  .lookup-error {
    margin: 0.5rem 0 0;
    color: var(--warn);
    font-size: 0.9rem;
  }
</style>
