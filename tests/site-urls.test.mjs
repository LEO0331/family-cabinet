import test from 'node:test';
import assert from 'node:assert/strict';
import { auditHtmlLinks } from '../scripts/site-urls.mjs';

const paths = new Set(['index.html', 'made/index.html', 'favicon.svg', '_astro/site.css', '_astro/photo.svg']);
const exists = (path) => paths.has(path);

test('generated links, images, canonical and Open Graph URLs resolve under the Pages base', () => {
  const html = '<a href="/family-cabinet/made/">Made</a><link rel="icon" href="/family-cabinet/favicon.svg"><link rel="canonical" href="https://leo0331.github.io/family-cabinet/"><meta property="og:image" content="https://leo0331.github.io/family-cabinet/_astro/photo.svg"><img src="/family-cabinet/_astro/photo.svg" srcset="/family-cabinet/_astro/photo.svg 1x"><script src="/family-cabinet/_astro/site.css"></script>';
  assert.doesNotThrow(() => auditHtmlLinks(html, 'index.html', exists));
});

test('generated root-relative links outside the project base are rejected', () => {
  assert.throws(() => auditHtmlLinks('<a href="/amazon-app/made/">Old base</a>', 'index.html', exists), /outside \/family-cabinet\//);
  assert.throws(() => auditHtmlLinks('<a href="/made/">Made</a>', 'index.html', exists), /outside \/family-cabinet\//);
  assert.throws(() => auditHtmlLinks('<meta property="og:url" content="https://leo0331.github.io/made/">', 'index.html', exists), /outside \/family-cabinet\//);
});

test('base-prefixed paths must exist in the generated output', () => {
  assert.throws(() => auditHtmlLinks('<img src="/family-cabinet/_astro/missing.svg">', 'index.html', exists), /Broken local path/);
});

test('rejects scriptable and unsafe schemes in generated hyperlinks and resources', () => {
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://example.com/id',
  ]) {
    assert.throws(
      () => auditHtmlLinks(`<a href="${url}">Link</a>`, 'index.html', exists),
      /Unsafe URL protocol/,
      url,
    );
  }
  assert.throws(
    () => auditHtmlLinks('<img src="data:image/svg+xml,%3Csvg%3E">', 'index.html', exists),
    /Unsafe URL protocol/,
  );
});

test('allows safe mailto and tel navigation, but not as resource URLs', () => {
  assert.doesNotThrow(() => auditHtmlLinks('<a href="mailto:someone@example.com">Email</a><a href="tel:+18005550100">Phone</a>', 'index.html', exists));
  assert.throws(
    () => auditHtmlLinks('<img src="mailto:someone@example.com">', 'index.html', exists),
    /Unsupported resource URL protocol/,
  );
  assert.throws(
    () => auditHtmlLinks('<img src="http://example.com/insecure.png">', 'index.html', exists),
    /Insecure resource URL/,
  );
});
