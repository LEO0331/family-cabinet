import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { assertPublicContent } from './scripts/publication-policy.mjs';
import { assertPublicAssets } from './scripts/public-assets.mjs';

assertPublicContent(fileURLToPath(new URL('./src/content/objects/', import.meta.url)));
assertPublicAssets({
  contentDirectory: fileURLToPath(new URL('./src/content/objects/', import.meta.url)),
  assetDirectory: fileURLToPath(new URL('./src/assets/items/', import.meta.url)),
  publicDirectory: fileURLToPath(new URL('./public/', import.meta.url)),
});

export default defineConfig({
  site: 'https://leo0331.github.io',
  base: '/family-cabinet',
  output: 'static',
  trailingSlash: 'always',
  // Astro generates per-page hashes for its scripts and styles in the static HTML.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-src 'none'",
        "form-action 'self'",
        "img-src 'self' data:",
        "connect-src 'self'",
      ],
    },
  },
  i18n: {
    locales: ['en', 'zh'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },
});
