import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

// A public GitHub repository cannot be a secure home for private source data.
// This guard catches unintended publishable files and common image metadata.
// It is NOT a substitute for editorial privacy review before committing.
const imageExtensions = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp']);
const maxImageBytes = 10 * 1024 * 1024;

function walk(root) {
  if (!existsSync(root)) throw new Error(`Missing public asset directory: ${root}`);
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Public asset symlinks are forbidden: ${path}`);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Unsupported public asset entry: ${path}`);
  }
  return files;
}

function inside(root, path) {
  const relativePath = relative(root, path);
  return relativePath && !relativePath.startsWith(`..${sep}`) && relativePath !== '..' && !isAbsolute(relativePath);
}

function hasPngMetadata(bytes) {
  const magic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!bytes.subarray(0, 8).equals(magic)) throw new Error('Invalid PNG image header');
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    if (length > bytes.length - offset - 12) throw new Error('Invalid PNG chunk length');
    const kind = bytes.toString('ascii', offset + 4, offset + 8);
    if (['eXIf', 'iTXt', 'tEXt', 'zTXt'].includes(kind)) return true;
    offset += length + 12;
    if (kind === 'IEND') break;
  }
  return false;
}

function inspectImage(file) {
  const extension = extname(file).toLowerCase();
  if (!imageExtensions.has(extension)) throw new Error(`Unsupported public asset type: ${file}`);
  if (statSync(file).size > maxImageBytes) throw new Error(`Image exceeds 10 MB: ${file}`);
  const bytes = readFileSync(file);

  if (extension === '.svg') {
    const source = bytes.toString('utf8');
    if (/<\s*(?:script|foreignObject|iframe|object|embed)\b/i.test(source) ||
        /\bon[a-z]+\s*=/i.test(source) ||
        /(?:xlink:)?href\s*=\s*["']\s*(?:https?:|data:|javascript:|\/\/)/i.test(source) ||
        /@import\b/i.test(source) ||
        /url\(\s*["']?\s*(?:https?:|data:|javascript:|\/\/)/i.test(source)) {
      throw new Error(`Active or remote SVG content is not allowed: ${file}`);
    }
  } else if (extension === '.png') {
    if (hasPngMetadata(bytes)) throw new Error(`Remove PNG metadata before publication: ${file}`);
  } else if (extension === '.jpg' || extension === '.jpeg') {
    if (bytes.subarray(0, 2).toString('hex') !== 'ffd8') throw new Error(`Invalid JPEG header: ${file}`);
    if (bytes.includes(Buffer.from('Exif\0\0')) || bytes.includes(Buffer.from('http://ns.adobe.com/xap/1.0/')) ||
        bytes.includes(Buffer.from('Photoshop 3.0'))) {
      throw new Error(`Remove JPEG metadata before publication: ${file}`);
    }
  } else if (extension === '.webp') {
    if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
      throw new Error(`Invalid WebP header: ${file}`);
    }
    // EXIF and XMP WebP chunks can disclose camera and location information.
    if (bytes.includes(Buffer.from('EXIF')) || bytes.includes(Buffer.from('XMP '))) {
      throw new Error(`Remove WebP metadata before publication: ${file}`);
    }
  }
}

export function assertPublicAssets({ contentDirectory, assetDirectory, publicDirectory }) {
  const referenced = new Set();
  for (const markdown of walk(contentDirectory).filter((file) => /\.mdx?$/i.test(file))) {
    const source = readFileSync(markdown, 'utf8');
    // The current collection uses single-line "- src: ../../assets/items/..." values.
    for (const match of source.matchAll(/^\s*-\s*src:\s*['"]?([^\s'"#]+)['"]?\s*$/gm)) {
      const path = resolve(dirname(markdown), match[1]);
      if (!inside(assetDirectory, path)) throw new Error(`Image reference outside approved asset directory: ${markdown}`);
      if (!existsSync(path)) throw new Error(`Missing image referenced by ${markdown}: ${path}`);
      referenced.add(path);
    }
  }

  const images = walk(assetDirectory);
  for (const image of images) {
    if (!referenced.has(image)) throw new Error(`Unreferenced asset in public repository: ${image}`);
    inspectImage(image);
  }
  // Public/ files are copied to the live site regardless of content collection visibility.
  // Keep this directory limited to approved static images (currently favicon.svg).
  for (const file of walk(publicDirectory)) inspectImage(file);
}
