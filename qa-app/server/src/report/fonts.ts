/**
 * Font loading for the report renderers.
 *
 * The same files the browser uses live in `public/fonts/` (and are copied to `dist/fonts/`
 * by the Vite build). The HTML report embeds them as base64 so the exported file works
 * offline; the PDF embeds the TrueType versions directly with pdf-lib.
 *
 * Nothing is fetched over the network at export time.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
// server/src/report -> qa-app
const appRoot = path.resolve(here, '../../..');

const candidates = [
  process.env.QA_FONT_DIR,
  path.join(appRoot, 'public', 'fonts'),
  path.join(appRoot, 'dist', 'fonts'),
].filter((entry): entry is string => Boolean(entry));

const cache = new Map<string, Buffer>();

export function fontPath(name: string): string {
  for (const dir of candidates) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Report font not found: ${name} (looked in ${candidates.join(', ')})`);
}

export function readFont(name: string): Buffer {
  const cached = cache.get(name);
  if (cached) return cached;
  const buffer = fs.readFileSync(fontPath(name));
  cache.set(name, buffer);
  return buffer;
}

export function fontBase64(name: string): string {
  return readFont(name).toString('base64');
}

export const REPORT_FONTS = {
  heading: 'Poppins-Bold.ttf',
  body: 'DM-Sans-Regular.ttf',
  bodyMedium: 'DM-Sans-Medium.ttf',
  /** Used by the HTML report, matching the app's own @font-face. */
  bodyWeb: 'dm-sans-latin.woff2',
} as const;
