#!/usr/bin/env node
// capture-screenshot.mjs — Capture website screenshots with Playwright.
// Supports: full-page, viewport-only, multi-device, dark mode, auth, cookies,
// wait-for-selector, wait-for-networkidle, custom user agent.

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

const RUNNER_DIR = join(homedir(), '.cache', 'web-desg-runner');
const MS_PLAYWRIGHT_DIR = join(homedir(), '.cache', 'ms-playwright');

// Reuse Python playwright's Chromium if present (saves ~200MB)
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(MS_PLAYWRIGHT_DIR)) {
  const dirs = readdirSync(MS_PLAYWRIGHT_DIR).filter(d => d.startsWith('chromium-'));
  if (dirs.length > 0) process.env.PLAYWRIGHT_BROWSERS_PATH = MS_PLAYWRIGHT_DIR;
}

// ---------- CLI parsing ----------
function parseArgs(argv) {
  const args = {
    url: null,
    full: false,
    viewport: null,        // "WxH" e.g. "1440x900"
    devices: null,         // comma-separated device keys
    out: null,             // single output path
    outDir: null,          // directory for multi-device
    dark: false,
    auth: null,            // "user:pass"
    cookie: null,          // "name=value"
    userAgent: null,
    waitFor: null,         // selector OR "networkidle"
    timeout: 30000,
    delay: 0,              // ms to wait after load before screenshot
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--url': args.url = next(); break;
      case '--full': args.full = true; break;
      case '--viewport': args.viewport = next(); break;
      case '--devices': args.devices = next(); break;
      case '--out': args.out = next(); break;
      case '--out-dir': args.outDir = next(); break;
      case '--dark': args.dark = true; break;
      case '--auth': args.auth = next(); break;
      case '--cookie': args.cookie = next(); break;
      case '--user-agent': args.userAgent = next(); break;
      case '--wait-for': args.waitFor = next(); break;
      case '--timeout': args.timeout = parseInt(next(), 10); break;
      case '--delay': args.delay = parseInt(next(), 10); break;
      case '--help':
      case '-h': args.help = true; break;
      default:
        if (a.startsWith('--')) {
          console.error(`Unknown option: ${a}`);
          process.exit(2);
        }
        if (!args.url) args.url = a;
    }
  }
  return args;
}

function help() {
  console.log(`Usage: capture-screenshot.mjs --url <url> [options]

Options:
  --url <url>              URL to capture (required)
  --full                   Capture full page (scrolls and stitches)
  --viewport <WxH>         Viewport size, e.g. 1440x900 (default: 1440x900)
  --devices <list>         Comma-separated device keys, e.g. "iphone-14,desktop-1080"
                           (see DEVICE_PRESETS below). Uses --out-dir.
  --out <path>             Output PNG path (single-capture mode)
  --out-dir <dir>          Output directory (multi-device mode)
  --dark                   Force dark color scheme
  --auth <user:pass>       HTTP basic auth
  --cookie <name=value>    Set a cookie on the URL's domain
  --user-agent <ua>        Override user agent
  --wait-for <sel|mode>    Wait for: a CSS selector, or "networkidle"
  --timeout <ms>           Navigation timeout (default: 30000)
  --delay <ms>             Extra wait after load before screenshot (default: 0)

Device presets:
  iphone-14, iphone-14-pro, iphone-se, ipad, ipad-pro,
  pixel-7, galaxy-s22, desktop-1080, desktop-1440, desktop-1920

Examples:
  # Full-page screenshot
  capture-screenshot.mjs --url https://example.com --full --out out.png

  # Multi-device capture for responsive study
  capture-screenshot.mjs --url https://example.com \\
    --devices "iphone-14,ipad,desktop-1080,desktop-1440" --out-dir ./devices/

  # Wait for SPA to finish rendering
  capture-screenshot.mjs --url https://app.example.com \\
    --wait-for "main" --full --out app.png
`);
}

// ---------- Device presets ----------
// (viewport widths/heights and device scale factor, inspired by Playwright's
// built-in device descriptors but trimmed to what we need)
const DEVICE_PRESETS = {
  'iphone-14':       { width: 390,  height: 844,  deviceScaleFactor: 3, isMobile: true,  hasTouch: true,  userAgent: 'iPhone' },
  'iphone-14-pro':   { width: 393,  height: 852,  deviceScaleFactor: 3, isMobile: true,  hasTouch: true,  userAgent: 'iPhone' },
  'iphone-se':       { width: 375,  height: 667,  deviceScaleFactor: 2, isMobile: true,  hasTouch: true,  userAgent: 'iPhone' },
  'ipad':            { width: 810,  height: 1080, deviceScaleFactor: 2, isMobile: true,  hasTouch: true,  userAgent: 'iPad' },
  'ipad-pro':        { width: 1024, height: 1366, deviceScaleFactor: 2, isMobile: true,  hasTouch: true,  userAgent: 'iPad' },
  'pixel-7':         { width: 412,  height: 915,  deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, userAgent: 'Android' },
  'galaxy-s22':      { width: 360,  height: 800,  deviceScaleFactor: 3, isMobile: true,  hasTouch: true,  userAgent: 'Android' },
  'desktop-1080':    { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  'desktop-1440':    { width: 2560, height: 1440, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  'desktop-1920':    { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};

// ---------- Main ----------
async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.url) {
    help();
    process.exit(args.help ? 0 : 1);
  }

  // Verify playwright is installed
  if (!existsSync(join(RUNNER_DIR, 'node_modules', 'playwright'))) {
    console.error('Playwright is not installed. Run setup-playwright.mjs first.');
    process.exit(3);
  }

  const { chromium } = await import(join(RUNNER_DIR, 'node_modules', 'playwright', 'index.mjs'));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--proxy-server=direct://'],
  });
  const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  try {
    // Build context options
    const contextOpts = { userAgent: DEFAULT_UA };
    if (args.dark) contextOpts.colorScheme = 'dark';
    if (args.userAgent) contextOpts.userAgent = args.userAgent;
    if (args.auth) {
      const [user, pass] = args.auth.split(':');
      const url = new URL(args.url);
      contextOpts.httpCredentials = { username: user, password: pass, origin: url.origin };
    }
    if (args.viewport) {
      const [w, h] = args.viewport.split('x').map(n => parseInt(n, 10));
      contextOpts.viewport = { width: w, height: h };
    }

    // Multi-device mode
    if (args.devices) {
      const outDir = args.outDir || './screenshots';
      mkdirSync(outDir, { recursive: true });
      const devices = args.devices.split(',').map(s => s.trim()).filter(Boolean);
      const results = [];
      for (const key of devices) {
        const preset = DEVICE_PRESETS[key];
        if (!preset) {
          console.error(`Unknown device: ${key}. Available: ${Object.keys(DEVICE_PRESETS).join(', ')}`);
          continue;
        }
        const ctx = await browser.newContext({
          ...contextOpts,
          viewport: { width: preset.width, height: preset.height },
          deviceScaleFactor: preset.deviceScaleFactor,
          isMobile: preset.isMobile,
          hasTouch: preset.hasTouch,
          userAgent: preset.userAgent || contextOpts.userAgent,
        });
        if (args.cookie) applyCookie(ctx, args.cookie, args.url);
        const page = await ctx.newPage();
        const outPath = join(outDir, `${key}.png`);
        await capture(page, args, outPath);
        await ctx.close();
        results.push({ device: key, path: outPath });
      }
      console.log(JSON.stringify({ ok: true, mode: 'multi-device', results }));
      return;
    }

    // Single-capture mode
    const outPath = args.out || './screenshot.png';
    mkdirSync(dirname(outPath), { recursive: true });
    const ctx = await browser.newContext(contextOpts);
    if (args.cookie) applyCookie(ctx, args.cookie, args.url);
    const page = await ctx.newPage();
    await capture(page, args, outPath);
    await ctx.close();
    console.log(JSON.stringify({ ok: true, mode: 'single', path: outPath }));
  } finally {
    await browser.close();
  }
}

function applyCookie(context, cookieStr, urlStr) {
  const u = new URL(urlStr);
  const [name, value] = cookieStr.split('=');
  context.addCookies([{
    name, value: value || '',
    domain: u.hostname,
    path: '/',
    httpOnly: false,
    secure: u.protocol === 'https:',
    sameSite: 'Lax',
  }]);
}

async function capture(page, args, outPath) {
  page.setDefaultNavigationTimeout(args.timeout);
  await page.goto(args.url, { waitUntil: 'domcontentloaded' });

  // Wait strategy
  if (args.waitFor === 'networkidle') {
    await page.waitForLoadState('networkidle', { timeout: args.timeout }).catch(() => {});
  } else if (args.waitFor) {
    await page.waitForSelector(args.waitFor, { timeout: args.timeout }).catch(() => {});
  } else {
    await page.waitForLoadState('load', { timeout: args.timeout }).catch(() => {});
  }

  if (args.delay > 0) await page.waitForTimeout(args.delay);

  await page.screenshot({
    path: outPath,
    fullPage: args.full,
    type: 'png',
    // Slightly higher quality for design reference
    omitBackground: false,
  });
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
