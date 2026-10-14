// Rasterize scripts/icon-source.svg into the PWA/apple-touch PNGs using a local headless Chrome/Edge.
// Dev-time only; the generated PNGs are committed so builds need no browser.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'public', 'icons');
const svg = fs.readFileSync(path.join(here, 'icon-source.svg'), 'utf8');
const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const chrome = candidates.find((p) => fs.existsSync(p));
if (!chrome) throw new Error('No Chrome/Edge found; set CHROME_PATH');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-'));
fs.mkdirSync(out, { recursive: true });
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512], ['icon-maskable-512.png', 512]]) {
  const html = path.join(tmp, `${size}.html`);
  fs.writeFileSync(html, `<html><body style="margin:0;overflow:hidden">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${path.join(tmp, 'profile')}`, `--window-size=${size},${size}`, `--screenshot=${path.join(out, name)}`, pathToFileURL(html).href], { stdio: 'ignore' });
  console.log('wrote', name);
}
fs.rmSync(tmp, { recursive: true, force: true });
