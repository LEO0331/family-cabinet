const origin = 'https://leo0331.github.io';
const base = '/family-cabinet/';

// Check every generated link and resource against supported schemes before resolving it.
// An off-origin URL is not inherently unsafe; a javascript:, data: or file: URL is.
function assertSiteUrl(raw, page, exists, attribute = 'href') {
  const value = raw.trim();
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new Error(`Unsafe URL control character: ${raw}`);
  const url = new URL(value, new URL(page.replace(/index\.html$/, ''), `${origin}${base}`));

  if (url.protocol === 'mailto:' || url.protocol === 'tel:') {
    if (attribute !== 'href') throw new Error(`Unsupported resource URL protocol: ${raw}`);
    return;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Unsafe URL protocol: ${raw}`);
  }
  // HTTP links may be navigated to, but mixed-content images/scripts/styles must not load.
  if (url.protocol === 'http:' && attribute !== 'href') {
    throw new Error(`Insecure resource URL: ${raw}`);
  }
  if (url.origin !== origin) return;
  if (!url.pathname.startsWith(base)) throw new Error(`Local URL outside ${base}: ${raw}`);
  const path = decodeURIComponent(url.pathname.slice(base.length));
  if (path.includes('..') || path.includes('\\')) throw new Error(`Unsafe local path: ${raw}`);
  if (!exists(path || 'index.html') && !exists(`${path}index.html`)) throw new Error(`Broken local path: ${raw}`);
}

export function auditHtmlLinks(html, page, exists) {
  for (const tag of html.match(/<(?:a|link|img|script|source)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi) ?? []) {
    for (const [, attribute, value] of tag.matchAll(/\b(href|src|srcset)="([^"]*)"/gi)) {
      const kind = attribute.toLowerCase();
      if (kind === 'srcset') {
        for (const candidate of value.split(',')) {
          assertSiteUrl(candidate.trim().split(/\s+/)[0], page, exists, kind);
        }
      } else {
        assertSiteUrl(value, page, exists, kind);
      }
    }
  }
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (!/\bproperty="og:(?:url|image)"/i.test(tag)) continue;
    const value = tag.match(/\bcontent="([^"]*)"/i)?.[1];
    if (value) assertSiteUrl(value, page, exists, 'src');
  }
}
