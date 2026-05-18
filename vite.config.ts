import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: [
      'src/**/*.{test,spec}.ts',
      // Build-tool scripts ship as .mjs so they can run under bun
      // without a Vite/TypeScript build step. Tests live alongside
      // them and use the same extension so vitest picks them up.
      'scripts/**/*.{test,spec}.mjs'
    ]
  }
});
