#!/usr/bin/env node
// analyze-stack.mjs — Detect framework, UI library, CSS approach, analytics,
// hosting, and structural patterns from a scrape directory.

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

function parseArgs(argv) {
  const args = { scrapeDir: null, out: null, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--scrape-dir': args.scrapeDir = next(); break;
      case '--out': args.out = next(); break;
      case '--help':
      case '-h': args.help = true; break;
      default:
        if (a.startsWith('--')) { console.error(`Unknown: ${a}`); process.exit(2); }
        if (!args.scrapeDir) args.scrapeDir = a;
    }
  }
  return args;
}

function help() {
  console.log(`Usage: analyze-stack.mjs --scrape-dir <dir> [--out <file>]

Reads dom.html, styles.css, network.json, meta.json, console.log from <dir>
and produces a JSON report of the detected tech stack.

Outputs to stdout, or to --out <file> if given.
`);
}

// ---------- Detection rules ----------
// Each rule returns null if no match, or { name, version?, confidence, evidence }
// Confidence is 0..1; we take the highest-scoring match in each category.

function detectFramework({ html, meta, network, consoleLog }) {
  // First: check explicit meta generator tags (most reliable signal)
  if (meta.generator) {
    const gen = meta.generator.toLowerCase();
    const fromMeta = [
      { re: /vitepress\s*v?([\d.]+)/, name: 'VitePress', versionGrp: 1 },
      { re: /wordpress\s*v?([\d.]+)/, name: 'WordPress', versionGrp: 1 },
      { re: /ghost\s*v?([\d.]+)/, name: 'Ghost', versionGrp: 1 },
      { re: /webflow/, name: 'Webflow' },
      { re: /squarespace/, name: 'Squarespace' },
      { re: /wix/, name: 'Wix' },
      { re: /framer/, name: 'Framer' },
      { re: /hubspot/, name: 'HubSpot CMS' },
      { re: /drupal/, name: 'Drupal' },
      { re: /joomla/, name: 'Joomla' },
      { re: /gatsbyjs/, name: 'Gatsby' },
      { re: /hexo/, name: 'Hexo' },
      { re: /jekyll/, name: 'Jekyll' },
      { re: /eleventy/, name: 'Eleventy' },
      { re: /docusaurus/, name: 'Docusaurus' },
      { re: /mkdocs/, name: 'MkDocs' },
    ];
    for (const m of fromMeta) {
      const match = gen.match(m.re);
      if (match) {
        return {
          name: m.name,
          version: m.versionGrp ? match[m.versionGrp] : null,
          confidence: 0.98,
          evidence: [`meta generator: ${meta.generator}`],
        };
      }
    }
  }

  const rules = [
    // Next.js
    () => {
      const evid = [];
      if (/<div\s+id="__next"/.test(html) || /id=["']__next["']/.test(html)) evid.push('__next root div');
      if (/__NEXT_DATA__/.test(html)) evid.push('__NEXT_DATA__ script');
      if (network.some(n => /\/_next\//.test(n.url))) evid.push('/_next/ asset paths');
      if (meta.head?.includes?.('next')) evid.push('next head meta');
      if (!evid.length) return null;
      const ver = html.match(/__NEXT_DATA__.*?"buildId":"([^"]+)"/);
      return { name: 'Next.js', version: ver ? `build ${ver[1].slice(0, 8)}` : null, confidence: 0.95, evidence: evid };
    },
    // Nuxt
    () => {
      const evid = [];
      if (/<div\s+id="__nuxt"/.test(html) || /id=["']__nuxt["']/.test(html)) evid.push('__nuxt root div');
      if (/window\.__NUXT__/.test(html)) evid.push('window.__NUXT__');
      if (/__NUXT_DATA__/.test(html)) evid.push('__NUXT_DATA__');
      if (network.some(n => /\/_nuxt\//.test(n.url))) evid.push('/_nuxt/ asset paths');
      if (!evid.length) return null;
      return { name: 'Nuxt', version: null, confidence: 0.95, evidence: evid };
    },
    // SvelteKit
    () => {
      const evid = [];
      if (/<div\s+id="svelte"/.test(html)) evid.push('svelte root');
      if (network.some(n => /\/_app\/immutable\//.test(n.url))) evid.push('/_app/immutable/ paths');
      if (/<svelte:/.test(html)) evid.push('svelte: tags');
      if (!evid.length) return null;
      return { name: 'SvelteKit', version: null, confidence: 0.9, evidence: evid };
    },
    // Astro
    () => {
      const evid = [];
      if (/<astro-island/.test(html)) evid.push('<astro-island> component');
      if (network.some(n => /\/_astro\//.test(n.url))) evid.push('/_astro/ paths');
      if (!evid.length) return null;
      return { name: 'Astro', version: null, confidence: 0.95, evidence: evid };
    },
    // Remix
    () => {
      const evid = [];
      if (/window\.__remixContext/.test(html)) evid.push('window.__remixContext');
      if (/__remixManifest/.test(html)) evid.push('__remixManifest');
      if (!evid.length) return null;
      return { name: 'Remix', version: null, confidence: 0.9, evidence: evid };
    },
    // Gatsby
    () => {
      const evid = [];
      if (/<div\s+id="___gatsby"/.test(html)) evid.push('___gatsby root div');
      if (/window\.___gatsby/.test(html)) evid.push('window.___gatsby');
      if (network.some(n => /\/static\/[a-f0-9]+\//.test(n.url)) && /gatsby/.test(html)) evid.push('static hashed paths + gatsby markers');
      if (!evid.length) return null;
      return { name: 'Gatsby', version: null, confidence: 0.85, evidence: evid };
    },
    // Vue (SPA, no Nuxt)
    () => {
      const evid = [];
      if (/<div\s+id="app"[^>]*>[\s\S]*?<\/div>\s*<script[^>]*>[\s\S]*?Vue/.test(html)) evid.push('#app root + Vue script');
      if (/data-v-[a-f0-9]+/.test(html)) evid.push('data-v-* scoped style attrs');
      if (/Vue\.config|createApp\(/.test(html)) evid.push('Vue global markers');
      if (!evid.length) return null;
      return { name: 'Vue', version: null, confidence: 0.7, evidence: evid };
    },
    // React (SPA, no Next/Remix/Gatsby)
    () => {
      const evid = [];
      if (/<div\s+id="root"/.test(html) && /react/i.test(html + network.map(n => n.url).join(' '))) evid.push('#root + react asset');
      if (consoleLog.some(l => /react/i.test(l))) evid.push('react in console');
      if (!evid.length) return null;
      return { name: 'React (SPA)', version: null, confidence: 0.55, evidence: evid };
    },
    // WordPress
    () => {
      const evid = [];
      if (meta.generator && /wordpress/i.test(meta.generator)) evid.push(`generator: ${meta.generator}`);
      if (network.some(n => /\/wp-content\//.test(n.url))) evid.push('/wp-content/ paths');
      if (network.some(n => /\/wp-includes\//.test(n.url))) evid.push('/wp-includes/ paths');
      if (!evid.length) return null;
      return { name: 'WordPress', version: null, confidence: 0.95, evidence: evid };
    },
    // Shopify
    () => {
      const evid = [];
      if (network.some(n => /cdn\.shopify\.com/.test(n.url))) evid.push('cdn.shopify.com');
      if (/<form[^>]*cart/.test(html) && /shopify/i.test(html)) evid.push('cart form + shopify markers');
      if (network.some(n => /\/cdn\/shop\//.test(n.url))) evid.push('/cdn/shop/ paths');
      if (!evid.length) return null;
      return { name: 'Shopify', version: null, confidence: 0.9, evidence: evid };
    },
    // Webflow
    () => {
      const evid = [];
      if (meta.generator && /webflow/i.test(meta.generator)) evid.push(`generator: ${meta.generator}`);
      if (/w-node-|wf-/.test(html)) evid.push('wf-/w-node- class markers');
      if (!evid.length) return null;
      return { name: 'Webflow', version: null, confidence: 0.9, evidence: evid };
    },
    // Squarespace
    () => {
      const evid = [];
      if (/<style id="sq-/.test(html)) evid.push('sq-* style tags');
      if (network.some(n => /static1\.squarespace\.com/.test(n.url))) evid.push('squarespace.com CDN');
      if (meta.generator && /squarespace/i.test(meta.generator)) evid.push(`generator: ${meta.generator}`);
      if (!evid.length) return null;
      return { name: 'Squarespace', version: null, confidence: 0.9, evidence: evid };
    },
    // Wix
    () => {
      const evid = [];
      if (/<meta name="generator" content="Wix/i.test(html)) evid.push('Wix generator meta');
      if (/static\.wixstatic\.com/.test(html)) evid.push('wixstatic.com');
      if (!evid.length) return null;
      return { name: 'Wix', version: null, confidence: 0.95, evidence: evid };
    },
    // Framer
    () => {
      const evid = [];
      if (/<meta name="generator" content="Framer/i.test(html)) evid.push('Framer generator meta');
      if (/framerusercontent\.com/.test(html)) evid.push('framerusercontent.com');
      if (!evid.length) return null;
      return { name: 'Framer', version: null, confidence: 0.95, evidence: evid };
    },
  ];
  for (const r of rules) {
    const hit = r();
    if (hit) return hit;
  }
  return { name: 'Unknown', confidence: 0, evidence: ['No framework markers found'] };
}

function detectUiLibrary({ html, css, network }) {
  const rules = [
    () => {
      // MUI
      const evid = [];
      if (/MuiButton|MuiPaper|MuiContainer|MuiGrid/.test(html)) evid.push('Mui* class names');
      if (css && /\.Mui[A-Z]/.test(css)) evid.push('.Mui* CSS rules');
      if (network.some(n => /mui/.test(n.url.toLowerCase()))) evid.push('mui in asset URL');
      if (!evid.length) return null;
      return { name: 'Material-UI (MUI)', confidence: 0.9, evidence: evid };
    },
    () => {
      // Chakra
      const evid = [];
      if (/css-[a-z0-9]{6,}/.test(html)) evid.push('css-<hash> class names (emotion)');
      if (/chakra-/.test(html.toLowerCase())) evid.push('chakra-* classes');
      if (!evid.length) return null;
      return { name: 'Chakra UI', confidence: 0.7, evidence: evid };
    },
    () => {
      // Ant Design
      const evid = [];
      if (/ant-btn|ant-card|ant-layout|ant-col/.test(html)) evid.push('ant-* class names');
      if (css && /\.ant-/.test(css)) evid.push('.ant-* CSS rules');
      if (!evid.length) return null;
      return { name: 'Ant Design', confidence: 0.9, evidence: evid };
    },
    () => {
      // Radix UI (often used with shadcn/ui)
      const evid = [];
      if (html.match(/data-radix-/g)?.length > 3) evid.push('data-radix-* attributes');
      if (/data-state=["']open|closed/.test(html)) evid.push('data-state (Radix pattern)');
      if (!evid.length) return null;
      return { name: 'Radix UI', confidence: 0.75, evidence: evid };
    },
    () => {
      // shadcn/ui (Radix + Tailwind)
      const evid = [];
      if (html.match(/data-radix-/g)?.length > 3 && /\.dark:|dark\\:/.test(css || '')) evid.push('Radix + Tailwind dark: variants');
      if (/cn\(\s*\[/.test(html)) evid.push('cn() class merge pattern');
      if (!evid.length) return null;
      return { name: 'shadcn/ui (Radix + Tailwind)', confidence: 0.7, evidence: evid };
    },
    () => {
      // Bootstrap — require multiple specific class names to avoid false positives
      // (e.g. "row" and "container" alone are too generic)
      const evid = [];
      const bsSpecific = /\b(btn-primary|btn-secondary|btn-danger|navbar-expand|navbar-light|navbar-dark|card-header|card-body|alert-dismissible|breadcrumb-item|dropdown-toggle|input-group-text|badge-pill|col-lg-|col-md-|col-sm-|col-xl-)\b/g;
      const matches = (html.match(bsSpecific) || []).slice(0, 5);
      if (matches.length >= 2) evid.push(`Bootstrap-specific classes: ${matches.join(', ')}`);
      if (css && /\.btn-primary[\s.{,]/.test(css) && /\.navbar[\s.{,]/.test(css)) evid.push('.btn-primary + .navbar CSS rules');
      if (!evid.length) return null;
      return { name: 'Bootstrap', confidence: 0.9, evidence: evid };
    },
    () => {
      // Bulma
      const evid = [];
      if (/\bbutton is-|\bis-primary|\bis-large/.test(html)) evid.push('is-* Bulma classes');
      if (!evid.length) return null;
      return { name: 'Bulma', confidence: 0.85, evidence: evid };
    },
  ];
  for (const r of rules) {
    const hit = r();
    if (hit) return hit;
  }
  return null;
}

function detectCssApproach({ html, css }) {
  const rules = [
    () => {
      // Tailwind
      const evid = [];
      const tailwindClasses = /\b(flex|grid|p-[0-9]|px-[0-9]|py-[0-9]|m-[0-9]|mx-auto|text-(xs|sm|lg|xl)|bg-(red|blue|green|gray|slate)-[0-9]+|rounded-(sm|md|lg|full))\b/g;
      const matches = (html.match(tailwindClasses) || []).slice(0, 5);
      if (matches.length >= 3) evid.push(`utility classes: ${matches.join(', ')}, ...`);
      if (css && /--tw-/.test(css)) evid.push('--tw-* CSS variables');
      if (css && /\.dark\\:|dark\\:[a-z-]+/.test(css)) evid.push('dark: variant rules');
      if (!evid.length) return null;
      return { name: 'Tailwind CSS', version: null, confidence: 0.9, evidence: evid };
    },
    () => {
      // CSS Modules
      const evid = [];
      if (/class=["'][a-zA-Z]+__[a-zA-Z]+_[a-f0-9]{5,}/.test(html)) evid.push('name__element_hash pattern');
      if (css && /\.[a-zA-Z]+__[a-zA-Z]+_[a-f0-9]{5,}/.test(css)) evid.push('CSS Modules class selectors');
      if (!evid.length) return null;
      return { name: 'CSS Modules', version: null, confidence: 0.85, evidence: evid };
    },
    () => {
      // styled-components / emotion (css-<hash>)
      const evid = [];
      if (/class=["']css-[a-z0-9]{6,}/.test(html)) evid.push('css-<hash> class names');
      if (css && /\.css-[a-z0-9]{6,}/.test(css)) evid.push('.css-<hash> rules');
      if (!evid.length) return null;
      return { name: 'styled-components / Emotion', version: null, confidence: 0.75, evidence: evid };
    },
    () => {
      // Stitches
      const evid = [];
      if (/class=["']c-[a-z0-9]{6,}/.test(html) || /class=["']jsx-[a-f0-9]+/.test(html)) evid.push('c-<hash> / jsx-* class names');
      if (css && /--stitches-/.test(css)) evid.push('--stitches-* variables');
      if (!evid.length) return null;
      return { name: 'Stitches', version: null, confidence: 0.8, evidence: evid };
    },
    () => {
      // SCSS / Sass
      const evid = [];
      if (css && /color: .*lighten\(|darken\(|@import|@mixin|@include/.test(css)) evid.push('Sass function/mixin usage');
      if (!evid.length) return null;
      return { name: 'Sass/SCSS', version: null, confidence: 0.7, evidence: evid };
    },
    () => {
      // Plain CSS — fall-through
      return { name: 'Plain CSS', version: null, confidence: 0.3, evidence: ['No framework-specific CSS markers found'] };
    },
  ];
  for (const r of rules) {
    const hit = r();
    if (hit) return hit;
  }
  return { name: 'Unknown', confidence: 0, evidence: [] };
}

function detectAnalytics({ html, network }) {
  const found = [];
  const checks = [
    { name: 'Google Analytics 4', test: () => /gtag\(|googletagmanager\.com\/gtag\/js/.test(html) || network.some(n => /googletagmanager\.com/.test(n.url)) },
    { name: 'Universal Analytics', test: () => /google-analytics\.com\/analytics\.js/.test(html) || network.some(n => /google-analytics\.com\/analytics\.js/.test(n.url)) },
    { name: 'Plausible', test: () => /plausible\.io\/js/.test(html) || network.some(n => /plausible\.io/.test(n.url)) },
    { name: 'Fathom', test: () => /cdn\.usefathom\.com/.test(html) || network.some(n => /usefathom\.com/.test(n.url)) },
    { name: 'PostHog', test: () => /posthog\.com|app\.posthog\.com/.test(html) || network.some(n => /posthog\.com/.test(n.url)) },
    { name: 'Mixpanel', test: () => /cdn\.mxpnl\.com|mixpanel\.com/.test(html) || network.some(n => /mxpnl\.com/.test(n.url)) },
    { name: 'Segment', test: () => /cdn\.segment\.com|analytics\.snplow\.net/.test(html) || network.some(n => /segment\.com|segment\.io/.test(n.url)) },
    { name: 'Hotjar', test: () => /static\.hotjar\.com/.test(html) || network.some(n => /hotjar\.com/.test(n.url)) },
    { name: 'FullStory', test: () => /fullstory\.com/.test(html) || network.some(n => /fullstory\.com/.test(n.url)) },
    { name: 'Facebook Pixel', test: () => /connect\.facebook\.net.*fbevents/.test(html) || network.some(n => /fbevents\.js/.test(n.url)) },
    { name: 'LinkedIn Insight', test: () => /snap\.licdn\.com/.test(html) || network.some(n => /licdn\.com/.test(n.url)) },
    { name: 'Clarity', test: () => /clarity\.ms/.test(html) || network.some(n => /clarity\.ms/.test(n.url)) },
    { name: 'Sentry', test: () => /sentry-cdn|sentry\.io/.test(html) || network.some(n => /sentry\.io/.test(n.url)) },
    { name: 'LogRocket', test: () => /cdn\.logrocket\.com|lr\.ingest/.test(html) || network.some(n => /logrocket/.test(n.url)) },
  ];
  for (const c of checks) {
    try {
      if (c.test()) found.push(c.name);
    } catch {}
  }
  return found;
}

function detectHosting({ network, html, meta }) {
  // Note: avoid matching "vercel.com" in HTML — many sites link to Vercel
  // as a sponsor. Look for actual infrastructure signals instead.
  const checks = [
    { name: 'Vercel', test: () => {
      // Vercel hosts on *.vercel.app or *.now.sh, and sets x-vercel-id header
      return network.some(n => /vercel\.app|now\.sh/.test(n.url)) ||
             network.some(n => /vercel/i.test(n.headers?.['x-vercel-id'] || n.headers?.['X-Vercel-Id'] || '')) ||
             /vercel\.app|now\.sh/.test(meta.url || '');
    }},
    { name: 'Netlify', test: () => network.some(n => /netlify\.app|netlifycdn/.test(n.url)) || /netlify\.app/.test(meta.url || '') },
    { name: 'Cloudflare Pages', test: () => network.some(n => /pages\.dev|cloudflarepages/.test(n.url)) || /pages\.dev/.test(meta.url || '') },
    { name: 'GitHub Pages', test: () => network.some(n => /github\.io/.test(n.url)) || /github\.io/.test(meta.url || '') },
    { name: 'AWS (CloudFront/S3)', test: () => network.some(n => /cloudfront\.net|amazonaws\.com/.test(n.url)) },
    { name: 'Azure', test: () => network.some(n => /azureedge\.net|azurewebsites\.net/.test(n.url)) },
    { name: 'Firebase Hosting', test: () => network.some(n => /web\.app|firebaseapp\.com/.test(n.url)) || /web\.app/.test(meta.url || '') },
    // Note: googleapis.com alone is NOT a hosting signal — it's used by Google Fonts,
    // Firebase, and many other Google services. Skip generic Google Cloud detection.
  ];
  for (const c of checks) {
    try { if (c.test()) return c.name; } catch {}
  }
  return null;
}

function detectPatterns({ html }) {
  const patterns = [];
  if (/<header[^>]*>[\s\S]*?<nav/.test(html)) patterns.push('sticky-nav');
  if (/<section[^>]*hero|class=["'][^"']*hero/.test(html)) patterns.push('hero-section');
  if (/class=["'][^"']*grid[^"']*\b(grid-cols-3|grid-cols-4|3-col|4-col)\b/.test(html)) patterns.push('feature-card-grid');
  if (/<form[^>]*subscribe|newsletter/.test(html)) patterns.push('newsletter-signup');
  if (/pricing|price-table/.test(html.toLowerCase())) patterns.push('pricing-table');
  if (/<footer[^>]*>/.test(html) && html.toLowerCase().includes('copyright')) patterns.push('footer-with-copyright');
  if (/testimonial|review|quote/.test(html.toLowerCase())) patterns.push('testimonials');
  if (/faq|accordion/.test(html.toLowerCase())) patterns.push('faq-section');
  if (/<video|<source/.test(html)) patterns.push('video-background');
  if (/class=["'][^"']*\bgradient\b/.test(html)) patterns.push('gradient-accents');
  if (/parallax|data-parallax/.test(html)) patterns.push('parallax-scroll');
  return patterns;
}

// ---------- Main ----------
function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.scrapeDir) {
    help();
    process.exit(args.help ? 0 : 1);
  }

  const dir = resolve(args.scrapeDir);
  const read = (name) => {
    const p = join(dir, name);
    return existsSync(p) ? readFileSync(p, 'utf8') : '';
  };

  const html = read('dom.html');
  const css = read('styles.css') + '\n' + read('inline-styles.css');
  const network = (() => { try { return JSON.parse(read('network.json') || '[]'); } catch { return []; } })();
  const meta = (() => { try { return JSON.parse(read('meta.json') || '{}'); } catch { return {}; } })();
  const consoleLog = read('console.log').split('\n')

  const report = {
    sourceUrl: meta.url || args.scrapeDir,
    analyzedAt: new Date().toISOString(),
    framework: detectFramework({ html, meta, network, consoleLog }),
    ui_library: detectUiLibrary({ html, css, network }),
    css_approach: detectCssApproach({ html, css }),
    analytics: detectAnalytics({ html, network }),
    hosting: detectHosting({ network, html, meta }),
    patterns: detectPatterns({ html }),
    meta: {
      title: meta.title,
      lang: meta.lang,
      generator: meta.generator,
    },
  };

  const out = JSON.stringify(report, null, 2);
  if (args.out) {
    writeFileSync(args.out, out);
    console.log(`Wrote ${args.out}`);
  } else {
    console.log(out);
  }
}

main();
