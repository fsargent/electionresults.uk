import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // Workers Static Assets routes via the [assets] block in
      // wrangler.toml, not _routes.json — but the adapter still emits
      // _routes.json for Pages compatibility, and its default exclude
      // list (every prerendered path) blows past the 100-rule cap and
      // logs a noisy warning at build time. Empty exclude here keeps
      // the file under cap and silences the warning. Behaviour is
      // unchanged because Workers ignores _routes.json entirely.
      routes: { include: ['/*'], exclude: [] }
    }),
    prerender: {
      handleHttpError: 'fail',
      handleMissingId: 'fail'
    }
  }
};

export default config;
