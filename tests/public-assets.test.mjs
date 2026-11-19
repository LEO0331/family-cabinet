import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertPublicAssets } from '../scripts/public-assets.mjs';

const picture = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
const record = (source = '../../assets/items/example/primary.svg') =>
  `---\ntitle: Public demo\nvisibility: public\nimages:\n  - src: ${source}\n---\nFictional content.\n`;

function withAssets(verify, { image = picture, source, extra = {} } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'family-cabinet-assets-'));
  const contentDirectory = join(root, 'src/content/objects');
  const assetDirectory = join(root, 'src/assets/items');
  const publicDirectory = join(root, 'public');
  try {
    mkdirSync(contentDirectory, { recursive: true });
    mkdirSync(join(assetDirectory, 'example'), { recursive: true });
    mkdirSync(publicDirectory, { recursive: true });
    writeFileSync(join(contentDirectory, 'example.md'), record(source));
    writeFileSync(join(assetDirectory, 'example/primary.svg'), image);
    writeFileSync(join(publicDirectory, 'favicon.svg'), picture);
    for (const [name, data] of Object.entries(extra)) {
      const path = join(root, name);
      mkdirSync(join(path, '..'), { recursive: true });
      writeFileSync(path, data);
    }
    verify({ contentDirectory, assetDirectory, publicDirectory });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('public image guard accepts referenced clean illustrations', () => {
  withAssets((paths) => assert.doesNotThrow(() => assertPublicAssets(paths)));
});

test('public image guard rejects unreferenced files and unexpected public assets', () => {
  withAssets((paths) => assert.throws(() => assertPublicAssets(paths), /Unreferenced asset/), {
    extra: { 'src/assets/items/example/unapproved.svg': picture },
  });
  withAssets((paths) => assert.throws(() => assertPublicAssets(paths), /Unsupported public asset type/), {
    extra: { 'public/private-notes.txt': 'Not meant for publication' },
  });
});

test('public image guard rejects active SVG content and external references', () => {
  withAssets((paths) => assert.throws(() => assertPublicAssets(paths), /Active or remote SVG/), {
    image: '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
  });
  withAssets((paths) => assert.throws(() => assertPublicAssets(paths), /Active or remote SVG/), {
    image: '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://external.example/icon.svg"/></svg>',
  });
});

test('public image guard rejects image references outside the approved items directory', () => {
  withAssets((paths) => assert.throws(() => assertPublicAssets(paths), /outside approved asset directory/), {
    source: '../../../../outside.jpg',
  });
});

test('public image guard rejects photos with EXIF metadata before publication', () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1]), Buffer.from('Exif\\0\\0Private location')]);
  withAssets((paths) => assert.throws(() => assertPublicAssets(paths), /Remove JPEG metadata/), {
    extra: { 'public/portrait.jpg': jpeg },
  });
});
