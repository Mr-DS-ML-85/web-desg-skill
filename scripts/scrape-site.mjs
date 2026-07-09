#!/usr/bin/env node
// scrape-site.mjs — Scrape a website's full asset stack.
// Produces: dom.html, styles.css, inline-styles.css, fonts/, images/,
// colors.json, assets-manifest.json, network.json, meta.json, console.log

import { existsSync, mkdirSync, writeFileSync, createWriteStream, readdirSync } from 'node:fs';
import { join, basename, extname, dirname } from 'node:path';
import { homedir } from 'node:os';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const RUNNER_DIR = join(homedir(), '.cache', 'web-desg-runner');
const MS_PLAYWRIGHT_DIR = join(homedir(), '.cache', 'ms-playwright');

// Reuse Python playwright's Chromium if present
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(MS_PLAYWRIGHT_DIR)) {
  const dirs = readdirSync(MS_PLAYWRIGHT_DIR).filter(d => d.startsWith('chromium-'));
  if (dirs.length > 0) process.env.PLAYWRIGHT_BROWSERS_PATH = MS_PLAYWRIGHT_DIR;
}

// ---------- CLI ----------
function parseArgs(argv) {
  const args = {
    url: null,
    outDir: null,
    maxImages: 100,
    downloadJs: false,
    downloadFonts: true,
    waitFor: 'networkidle',
    timeout: 30000,
    userAgent: 'Mozilla/5.0 (compatible; web-desg/1.0; +https://github.com/)',
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--url': args.url = next(); break;
      case '--out-dir': args.outDir = next(); break;
      case '--max-images': args.maxImages = parseInt(next(), 10); break;
      case '--download-js': args.downloadJs = true; break;
      case '--no-fonts': args.downloadFonts = false; break;
      case '--wait-for': args.waitFor = next(); break;
      case '--timeout': args.timeout = parseInt(next(), 10); break;
      case '--user-agent': args.userAgent = next(); break;
      case '--help':
      case '-h': args.help = true; break;
      default:
        if (a.startsWith('--')) { console.error(`Unknown: ${a}`); process.exit(2); }
        if (!args.url) args.url = a;
    }
  }
  return args;
}

function help() {
  console.log(`Usage: scrape-site.mjs --url <url> [options]

Options:
  --url <url>            URL to scrape (required)
  --out-dir <dir>        Output directory (default: ./<hostname>-scrape/)
  --max-images <n>       Max images to download (default: 100)
  --download-js          Also download JS bundles (off by default)
  --no-fonts             Skip font downloads
  --wait-for <mode|sel>  Wait mode: networkidle (default), load, or CSS selector
  --timeout <ms>         Navigation timeout (default: 30000)
  --user-agent <ua>      Custom user agent

Outputs (in --out-dir):
  dom.html               Fully rendered DOM (post-JS)
  styles.css             All computed CSS rules, deduped
  inline-styles.css      CSS from <style> tags and style= attributes
  fonts/                 Downloaded font files + fonts-manifest.json
  images/                Downloaded images + images-manifest.json
  colors.json            Color usage report
  assets-manifest.json   All assets discovered
  network.json           Network request log
  meta.json              Page metadata (title, description, OG, etc.)
  console.log            Browser console output
`);
}

// ---------- Utilities ----------
function sanitizeFilename(s) {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

function resolveUrl(maybeRel, baseUrl) {
  try {
    return new URL(maybeRel, baseUrl).href;
  } catch {
    return null;
  }
}

async function downloadFile(url, destPath) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; web-desg/1.0)' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const { writeFileSync } = await import('node:fs');
    writeFileSync(destPath, buf);
    return { size: buf.length, status: res.status, contentType: res.headers.get('content-type') };
  } catch (e) {
    return null;
  }
}

// Extract colors from a CSS string
function extractColors(css) {
  const colors = new Map();
  const addColor = (c) => {
    c = c.toLowerCase().trim();
    // Filter out non-color keywords that show up in CSS
    if (['transparent', 'inherit', 'initial', 'currentcolor', 'unset', 'revert'].includes(c)) return;
    colors.set(c, (colors.get(c) || 0) + 1);
  };

  // Hex colors (most reliable)
  const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
  for (const m of css.matchAll(hexRe)) addColor(m[0]);

  // rgb/rgba/hsl/hsla function calls
  const funcRe = /\b(?:rgb|rgba|hsl|hsla)\([^)]+\)/gi;
  for (const m of css.matchAll(funcRe)) addColor(m[0]);

  // Named colors — but only in `color:` / `background:` / `border-color:` value
  // contexts, NOT bare word matches (which would catch CSS variable names like
  // --vp-c-red-1). This is much slower but far more accurate.
  const namedColors = new Set([
    'red', 'green', 'blue', 'black', 'white', 'gray', 'grey', 'yellow',
    'orange', 'purple', 'pink', 'brown', 'cyan', 'magenta', 'silver', 'gold',
    'navy', 'teal', 'olive', 'maroon', 'aqua', 'fuchsia', 'lime',
  ]);
  // Match: (color|background|background-color|border|border-color|fill|stroke)\s*:\s*(\w+)
  const valueRe = /(?:color|background|background-color|border|border-color|border-top-color|border-right-color|border-bottom-color|border-left-color|fill|stroke|outline|outline-color|box-shadow|text-shadow|caret-color)\s*:\s*([a-z]+)/gi;
  let m;
  while ((m = valueRe.exec(css)) !== null) {
    const candidate = m[1].toLowerCase();
    if (namedColors.has(candidate)) addColor(candidate);
  }

  return [...colors.entries()]
    .map(([hex, frequency]) => ({ hex, frequency }))
    .sort((a, b) => b.frequency - a.frequency);
}

// ---------- Main scrape ----------
async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.url) {
    help();
    process.exit(args.help ? 0 : 1);
  }

  if (!existsSync(join(RUNNER_DIR, 'node_modules', 'playwright'))) {
    console.error('Playwright not installed. Run setup-playwright.mjs first.');
    process.exit(3);
  }

  const { chromium } = await import(join(RUNNER_DIR, 'node_modules', 'playwright', 'index.mjs'));

  const url = new URL(args.url);
  const outDir = args.outDir || `./${url.hostname}-scrape`;
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, 'fonts'), { recursive: true });
  mkdirSync(join(outDir, 'images'), { recursive: true });

  const assetsManifest = {
    sourceUrl: args.url,
    scrapedAt: new Date().toISOString(),
    fonts: [],
    images: [],
    css: [],
    js: [],
    other: [],
  };

  const networkLog = [];
  const consoleLines = [];

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--proxy-server=direct://'],
  });
  const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  try {
    const context = await browser.newContext({
      userAgent: args.userAgent || DEFAULT_UA,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    // Network logging
    page.on('request', req => {
      networkLog.push({
        url: req.url(),
        method: req.method(),
        type: req.resourceType(),
        headers: req.headers(),
      });
    });
    page.on('response', async res => {
      const entry = networkLog.find(n => n.url === res.url());
      if (entry) {
        entry.status = res.status();
        entry.contentType = res.headers()['content-type'] || '';
        try { entry.size = (await res.body()).length; } catch {}
      }
    });
    page.on('console', msg => {
      consoleLines.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', err => {
      consoleLines.push(`[error] ${err.message}`);
    });

    // Navigate
    page.setDefaultNavigationTimeout(args.timeout);
    await page.goto(args.url, { waitUntil: 'domcontentloaded' });
    if (args.waitFor === 'networkidle') {
      await page.waitForLoadState('networkidle', { timeout: args.timeout }).catch(() => {});
    } else if (args.waitFor === 'load') {
      await page.waitForLoadState('load', { timeout: args.timeout }).catch(() => {});
    } else if (args.waitFor) {
      await page.waitForSelector(args.waitFor, { timeout: args.timeout }).catch(() => {});
    }
    // Small grace period for late-rendered content
    await page.waitForTimeout(1500);

    // --- 1. Rendered DOM ---
    const html = await page.content();
    writeFileSync(join(outDir, 'dom.html'), html);

    // --- 2. Metadata ---
    const meta = await page.evaluate(() => {
      const get = sel => document.querySelector(sel)?.content || document.querySelector(sel)?.href || null;
      return {
        url: location.href,
        title: document.title,
        description: get('meta[name="description"]'),
        ogTitle: get('meta[property="og:title"]'),
        ogDescription: get('meta[property="og:description"]'),
        ogImage: get('meta[property="og:image"]'),
        ogType: get('meta[property="og:type"]'),
        twitterCard: get('meta[name="twitter:card"]'),
        twitterImage: get('meta[name="twitter:image"]'),
        viewport: get('meta[name="viewport"]'),
        lang: document.documentElement.lang,
        charset: document.characterSet,
        favicon: document.querySelector('link[rel="icon"]')?.href ||
                 document.querySelector('link[rel="shortcut icon"]')?.href,
        themeColor: get('meta[name="theme-color"]'),
        generator: get('meta[name="generator"]'),
        manifest: get('link[rel="manifest"]'),
        canonical: get('link[rel="canonical"]'),
        bodyClasses: document.body.className,
        htmlClasses: document.documentElement.className,
      };
    });
    writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));

    // --- 3. Extract all stylesheets (linked + inline + network-loaded) ---
    const stylesheetUrls = await page.evaluate(() => {
      const links = [...document.querySelectorAll('link[rel="stylesheet"]')];
      return links.map(l => ({ href: l.href, media: l.media || 'all' }));
    });

    // Also pick up CSS files from the network log that weren't in <link> tags
    // (handles JS-injected <link>, CSS-in-JS, adoptedStyleSheets, etc.)
    const seenCssUrls = new Set(stylesheetUrls.map(s => s.href));
    for (const n of networkLog) {
      if (n.contentType && n.contentType.includes('text/css') && !seenCssUrls.has(n.url)) {
        stylesheetUrls.push({ href: n.url, media: 'all' });
        seenCssUrls.add(n.url);
      }
    }

    let combinedCss = '';
    for (const link of stylesheetUrls) {
      try {
        const res = await fetch(link.href, {
          headers: { 'User-Agent': args.userAgent },
        });
        const css = await res.text();
        combinedCss += `\n/* === ${link.href} (media: ${link.media}) === */\n${css}\n`;
        assetsManifest.css.push({ url: link.href, media: link.media, size: css.length });
      } catch (e) {
        consoleLines.push(`[warn] Failed to fetch stylesheet ${link.href}: ${e.message}`);
      }
    }
    writeFileSync(join(outDir, 'styles.css'), combinedCss);

    // Inline styles (<style> tags + style= attributes)
    // Also walk document.styleSheets to catch CSS-in-JS injected <style> tags
    const inlineCss = await page.evaluate(() => {
      const chunks = [];
      // <style> tags (including JS-injected ones)
      const styles = document.querySelectorAll('style');
      styles.forEach((s, i) => {
        const text = s.textContent;
        if (text && text.trim()) chunks.push(`/* <style> #${i} */\n${text}\n`);
      });
      // Constructable/adopted stylesheets (some modern frameworks use these)
      try {
        for (const sheet of document.adoptedStyleSheets || []) {
          const rules = [...sheet.cssRules].map(r => r.cssText).join('\n');
          if (rules) chunks.push(`/* adoptedStyleSheet */\n${rules}\n`);
        }
      } catch {}
      // style= attributes (collect a sample, not every element — can be huge)
      const styled = document.querySelectorAll('[style]');
      const sample = [...styled].slice(0, 200);
      for (const el of sample) {
        const sel = el.id ? `#${el.id}` :
                    el.className && typeof el.className === 'string' ?
                      '.' + el.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.') :
                    el.tagName.toLowerCase();
        const styleVal = el.getAttribute('style');
        if (styleVal) chunks.push(`/* inline on ${sel} */\n${sel} { ${styleVal} }`);
      }
      return chunks.join('\n\n');
    });
    writeFileSync(join(outDir, 'inline-styles.css'), inlineCss);

    // --- 4. Font extraction ---
    if (args.downloadFonts) {
      const fontFaces = await page.evaluate((baseUrl) => {
        // Walk all document.styleSheets, including cross-origin ones if accessible
        const faces = [];
        const extractFromCss = (css, srcUrl) => {
          const re = /@font-face\s*\{([^}]*)\}/g;
          let m;
          while ((m = re.exec(css)) !== null) {
            const body = m[1];
            const family = body.match(/font-family\s*:\s*['"]?([^'";]+?)['"]?\s*;/)?.[1]?.trim();
            const weight = body.match(/font-weight\s*:\s*([^;]+?)\s*;/)?.[1]?.trim();
            const style = body.match(/font-style\s*:\s*([^;]+?)\s*;/)?.[1]?.trim();
            const srcMatch = body.match(/src\s*:\s*([^;]+?)\s*;/)?.[1];
            const urls = [];
            if (srcMatch) {
              const urlRe = /url\(['"]?([^'")]+?)['"]?\)\s*(?:format\(['"]?([^'")]+?)['"]?\))?/g;
              let u;
              while ((u = urlRe.exec(srcMatch)) !== null) {
                urls.push({ url: u[1], format: u[2] || null });
              }
            }
            faces.push({ family, weight, style, sources: urls, sourceSheet: srcUrl });
          }
        };

        // Try document.styleSheets first
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules || []) {
              if (rule instanceof CSSFontFaceRule) {
                const body = rule.cssText.match(/\{([^}]*)\}/)?.[1] || '';
                extractFromCss(`@font-face { ${body} }`, sheet.href || 'inline');
              }
            }
          } catch {
            // Cross-origin stylesheet — cssRules access throws. We'll catch via the CSS text fetch.
            if (sheet.href) extractFromCss('', sheet.href);
          }
        }
        return faces;
      }, args.url);

      // Walk the @font-face rules found in fetched CSS too (cross-origin safe path)
      const fontFaceRe = /@font-face\s*\{([^}]*)\}/g;
      const cssToScan = combinedCss + '\n' + inlineCss;
      const fontFacesFromCss = [];
      let m;
      while ((m = fontFaceRe.exec(cssToScan)) !== null) {
        const body = m[1];
        const family = body.match(/font-family\s*:\s*['"]?([^'";]+?)['"]?\s*;/)?.[1]?.trim();
        const weight = body.match(/font-weight\s*:\s*([^;]+?)\s*;/)?.[1]?.trim();
        const style = body.match(/font-style\s*:\s*([^;]+?)\s*;/)?.[1]?.trim();
        const srcMatch = body.match(/src\s*:\s*([^;]+?)\s*;/)?.[1];
        const sources = [];
        if (srcMatch) {
          const urlRe = /url\(['"]?([^'")]+?)['"]?\)\s*(?:format\(['"]?([^'")]+?)['"]?\))?/g;
          let u;
          while ((u = urlRe.exec(srcMatch)) !== null) {
            const abs = resolveUrl(u[1], args.url);
            if (abs) sources.push({ url: abs, format: u[2] || null });
          }
        }
        fontFacesFromCss.push({ family, weight, style, sources });
      }

      // Merge
      const allFaces = [...fontFaces, ...fontFacesFromCss];
      const fontManifest = [];
      for (const face of allFaces) {
        // Pick the best source: woff2 > woff > ttf > otf
        const ranked = face.sources.sort((a, b) => {
          const score = f => ({ woff2: 4, woff: 3, ttf: 2, otf: 1 }[f?.toLowerCase()] || 0);
          return score(b.format) - score(a.format);
        });
        const best = ranked[0];
        if (!best) continue;
        const ext = (best.url.match(/\.([a-z0-9]+)(\?|$)/i)?.[1] || 'font').toLowerCase();
        const safeName = sanitizeFilename(`${face.family || 'font'}-${face.weight || '400'}-${face.style || 'normal'}.${ext}`);
        const dest = join(outDir, 'fonts', safeName);
        const info = await downloadFile(best.url, dest);
        if (info) {
          const entry = {
            family: face.family,
            weight: face.weight,
            style: face.style,
            file: `fonts/${safeName}`,
            sourceUrl: best.url,
            format: best.format,
            size: info.size,
            contentType: info.contentType,
          };
          fontManifest.push(entry);
          assetsManifest.fonts.push(entry);
        }
      }
      writeFileSync(join(outDir, 'fonts', 'fonts-manifest.json'), JSON.stringify(fontManifest, null, 2));
    }

    // --- 5. Image extraction ---
    const imageCandidates = await page.evaluate((baseUrl) => {
      const set = new Set();
      // <img> src + srcset
      document.querySelectorAll('img').forEach(img => {
        if (img.src) set.add(img.src);
        if (img.currentSrc) set.add(img.currentSrc);
        if (img.srcset) {
          img.srcset.split(',').forEach(s => {
            const u = s.trim().split(/\s+/)[0];
            if (u) set.add(u);
          });
        }
      });
      // <source> in <picture>
      document.querySelectorAll('picture source').forEach(src => {
        if (src.srcset) {
          src.srcset.split(',').forEach(s => {
            const u = s.trim().split(/\s+/)[0];
            if (u) set.add(u);
          });
        }
      });
      // CSS background-image
      document.querySelectorAll('*').forEach(el => {
        const bg = getComputedStyle(el).backgroundImage;
        if (bg && bg !== 'none') {
          const re = /url\(['"]?([^'")]+?)['"]?\)/g;
          let m;
          while ((m = re.exec(bg)) !== null) set.add(m[1]);
        }
      });
      // <link rel="icon"> etc.
      document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(l => {
        if (l.href) set.add(l.href);
      });
      return [...set].map(u => {
        try { return new URL(u, baseUrl).href; } catch { return null; }
      }).filter(Boolean);
    }, args.url);

    const imageManifest = [];
    let imageCount = 0;
    for (const imgUrl of imageCandidates) {
      if (imageCount >= args.maxImages) break;
      // Skip data: URLs (already inline)
      if (imgUrl.startsWith('data:')) continue;
      const urlPath = new URL(imgUrl).pathname;
      const ext = extname(urlPath) || '.bin';
      const safeName = sanitizeFilename(basename(urlPath) || `image-${imageCount}`) || `image-${imageCount}${ext}`;
      const dest = join(outDir, 'images', `${imageCount.toString().padStart(3, '0')}-${safeName}`);
      const info = await downloadFile(imgUrl, dest);
      if (info) {
        const entry = {
          file: `images/${imageCount.toString().padStart(3, '0')}-${safeName}`,
          sourceUrl: imgUrl,
          size: info.size,
          contentType: info.contentType,
        };
        imageManifest.push(entry);
        assetsManifest.images.push(entry);
        imageCount++;
      }
    }
    writeFileSync(join(outDir, 'images', 'images-manifest.json'), JSON.stringify(imageManifest, null, 2));

    // --- 6. JS bundles (optional) ---
    if (args.downloadJs) {
      const scriptUrls = await page.evaluate(() => {
        return [...document.querySelectorAll('script[src]')].map(s => s.src).filter(Boolean);
      });
      mkdirSync(join(outDir, 'js'), { recursive: true });
      let jsCount = 0;
      for (const jsUrl of scriptUrls) {
        const urlPath = new URL(jsUrl).pathname;
        const safeName = sanitizeFilename(basename(urlPath) || `script-${jsCount}.js`);
        const dest = join(outDir, 'js', `${jsCount.toString().padStart(3, '0')}-${safeName}`);
        const info = await downloadFile(jsUrl, dest);
        if (info) {
          assetsManifest.js.push({
            file: `js/${jsCount.toString().padStart(3, '0')}-${safeName}`,
            sourceUrl: jsUrl,
            size: info.size,
            contentType: info.contentType,
          });
          jsCount++;
        }
      }
    } else {
      // Still record JS URLs in the manifest, just don't download
      const scriptUrls = await page.evaluate(() => {
        return [...document.querySelectorAll('script[src]')].map(s => s.src).filter(Boolean);
      });
      for (const u of scriptUrls) {
        const urlPath = new URL(u).pathname;
        assetsManifest.js.push({ sourceUrl: u, file: null, size: null, contentType: 'application/javascript' });
      }
    }

    // --- 7. Color extraction from all CSS ---
    const allCss = combinedCss + '\n' + inlineCss;
    const colors = extractColors(allCss);
    writeFileSync(join(outDir, 'colors.json'), JSON.stringify({
      total: colors.length,
      colors,
      topTen: colors.slice(0, 10),
    }, null, 2));

    // --- 8. Write manifests & logs ---
    writeFileSync(join(outDir, 'assets-manifest.json'), JSON.stringify(assetsManifest, null, 2));
    writeFileSync(join(outDir, 'network.json'), JSON.stringify(networkLog, null, 2));
    writeFileSync(join(outDir, 'console.log'), consoleLines.join('\n'));

    console.log(JSON.stringify({
      ok: true,
      outDir,
      stats: {
        fonts: assetsManifest.fonts.length,
        images: assetsManifest.images.length,
        cssFiles: assetsManifest.css.length,
        jsUrls: assetsManifest.js.length,
        colors: colors.length,
        networkRequests: networkLog.length,
        consoleErrors: consoleLines.filter(l => l.includes('[error]')).length,
      },
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(`Error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
