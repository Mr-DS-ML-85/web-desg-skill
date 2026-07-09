# Scraping Guide

This guide covers the practical details of scraping websites for design cloning: handling SPAs, lazy-loaded content, authentication, iframes, dynamic CSS, and the framework detection rules used by `analyze-stack.mjs`.

## Why Playwright (not just curl)

Modern websites render most of their content client-side via JavaScript. A plain `curl` will give you the initial HTML shell — often just a `<div id="root"></div>` with a few script tags — and miss the actual rendered DOM, the computed CSS, the loaded fonts, and the lazy-loaded images. Playwright runs a real headless Chromium, executes the JS, and lets you inspect the result.

Use `curl` only as a fallback when Playwright is unavailable (e.g. sandboxed environments without Chromium). The `setup-playwright.mjs` script tries hard to install — including falling back to a China mirror — so this should be rare.

## Handling different site types

### Static sites (blogs, marketing pages, docs)

These work out of the box. `--wait-for load` is usually enough. The default `--wait-for networkidle` is also fine, just slower.

```bash
node scrape-site.mjs --url https://example.com --wait-for load
```

### Single-Page Apps (React/Vue/Svelte)

SPAs render everything client-side. After `page.goto()`, the DOM is initially empty. The scraper handles this by:

1. Waiting for `domcontentloaded` (initial HTML parsed)
2. Waiting for `networkidle` (no network requests for 500ms)
3. Adding a 1500ms grace period for late-rendered content

If you still see a blank or partial capture, try:

```bash
# Wait for a specific element that signals the page is fully rendered
node scrape-site.mjs --url https://app.example.com --wait-for "main"
# Or wait longer with a higher timeout
node scrape-site.mjs --url https://app.example.com --timeout 60000
```

### Authenticated sites

The scraper supports two forms of auth:

**HTTP Basic Auth:**
```bash
node scrape-site.mjs --url https://example.com --auth user:pass
# For capture-screenshot.mjs, same flag:
node capture-screenshot.mjs --url https://example.com --auth user:pass --full --out auth.png
```

**Cookie-based (session):**
```bash
# Pass a session cookie
node scrape-site.mjs --url https://example.com --cookie "session_id=abc123"
```

For complex auth (OAuth, login forms, CSRF), use `agent-browser` to log in interactively, save the state with `agent-browser state save auth.json`, then load it before scraping. You'll need to write a small wrapper script for this — see the agent-browser SKILL.md for the workflow.

### Sites with lazy-loaded images

Images below the fold may not have loaded by the time we capture. The scraper:

1. Captures all `<img>` src + srcset + currentSrc
2. Captures all `<picture><source>` srcset
3. Walks the DOM for CSS `background-image: url(...)`
4. Captures `<link rel="icon">` and `<link rel="apple-touch-icon">`

But it doesn't scroll the page to trigger lazy loading. To improve image coverage, you can:

```bash
# Increase the grace period — some lazy loaders fire on a timer
node scrape-site.mjs --url https://example.com --timeout 45000
```

Or pre-scroll the page using `agent-browser` before scraping (more involved — write a custom script).

### Iframes

Cross-origin iframes can't be inspected due to browser security. Same-origin iframes are included in the parent DOM capture. If the site embeds important content via cross-origin iframe (e.g. a YouTube video, a Typeform, a Discord widget), you'll see the `<iframe>` tag but not its contents. Note this in the analysis and consider scraping the iframe URL separately.

## Detection rules (framework)

`analyze-stack.mjs` uses these signals. If a site isn't detected correctly, check whether one of these markers is present.

### Next.js
- `<div id="__next">` — root mount point
- `__NEXT_DATA__` script tag (contains build ID, route, props)
- Network requests to `/_next/static/...`
- Confidence: very high (0.95)

### Nuxt (2 or 3)
- `<div id="__nuxt">` — root mount point
- `window.__NUXT__` (v2) or `__NUXT_DATA__` (v3) global
- Network requests to `/_nuxt/...`
- Confidence: very high (0.95)

### SvelteKit
- `<div id="svelte">` — root mount point
- Network requests to `/_app/immutable/...`
- Confidence: high (0.9)

### Astro
- `<astro-island>` component markers in HTML
- Network requests to `/_astro/...`
- Confidence: very high (0.95)

### Remix
- `window.__remixContext` global
- `__remixManifest` global
- Confidence: high (0.9)

### Gatsby
- `<div id="___gatsby">` (three underscores) — root mount point
- Network requests to `/static/<hash>/...`
- Confidence: high (0.85)

### Vue (SPA, no Nuxt)
- `<div id="app">` with a Vue script
- `data-v-<hash>` attributes (Vue scoped styles)
- `Vue.config` or `createApp(` in HTML
- Confidence: medium (0.7) — easy to confuse with other frameworks

### React (SPA, no Next/Remix/Gatsby)
- `<div id="root">` with a React asset
- React references in console
- Confidence: low (0.55) — many sites use `#root` for non-React reasons

### WordPress
- `<meta name="generator" content="WordPress x.x.x">`
- Network requests to `/wp-content/...` and `/wp-includes/...`
- Confidence: very high (0.95)

### Shopify
- Network requests to `cdn.shopify.com` and `/cdn/shop/...`
- Confidence: high (0.9)

### Webflow
- `<meta name="generator" content="Webflow">`
- `w-node-*` and `wf-*` class names
- Confidence: high (0.9)

### Squarespace
- `<style id="sq-...">` tags
- `static1.squarespace.com` in network
- Confidence: high (0.9)

### Wix
- `<meta name="generator" content="Wix">`
- `static.wixstatic.com` in network
- Confidence: very high (0.95)

### Framer
- `<meta name="generator" content="Framer">`
- `framerusercontent.com` in network
- Confidence: very high (0.95)

## Detection rules (CSS approach)

### Tailwind CSS
- Utility classes like `flex`, `grid`, `p-4`, `text-lg`, `bg-blue-500`, `rounded-md`
- `--tw-*` CSS variables
- `dark:` variant rules in CSS
- Confidence: high (0.9)

### CSS Modules
- Class names like `Button_primary__a1b2c` (name_element_hash)
- Confidence: high (0.85)

### styled-components / Emotion
- Class names like `css-<6+ char hash>` (e.g. `css-1abc23`)
- Confidence: medium-high (0.75)

### Stitches
- Class names like `c-<hash>` or `jsx-<hash>`
- `--stitches-*` CSS variables
- Confidence: high (0.8)

### Sass/SCSS
- `lighten()`, `darken()`, `@import`, `@mixin`, `@include` in compiled CSS (rare in production builds, but sometimes present)
- Confidence: medium (0.7)

## Detection rules (UI library)

### Material-UI (MUI)
- `MuiButton`, `MuiPaper`, `MuiContainer`, `MuiGrid` class prefixes
- `.Mui<PascalCase>` CSS rules
- Confidence: high (0.9)

### Ant Design
- `ant-btn`, `ant-card`, `ant-layout`, `ant-col` class prefixes
- `.ant-*` CSS rules
- Confidence: high (0.9)

### Chakra UI
- `css-<hash>` (emotion) + `chakra-*` class names
- Confidence: medium (0.7)

### Radix UI
- `data-radix-*` attributes (often 3+ on a page)
- `data-state="open|closed"` patterns
- Confidence: medium-high (0.75)

### shadcn/ui (Radix + Tailwind)
- Radix markers + Tailwind `dark:` variants
- `cn()` class merge patterns (hard to detect in HTML — usually compiled away)
- Confidence: medium (0.7)

### Bootstrap
- `btn-primary`, `navbar`, `row`, `col-md-*` class names
- `.container` + `.row` CSS rules
- Confidence: high (0.85)

### Bulma
- `button is-primary`, `is-large`, `is-*` class names
- Confidence: high (0.85)

## Detection rules (analytics & monitoring)

The analyzer checks for: Google Analytics 4, Universal Analytics (legacy), Plausible, Fathom, PostHog, Mixpanel, Segment, Hotjar, FullStory, Facebook Pixel, LinkedIn Insight, Clarity, Sentry, LogRocket. Detection is via script src patterns and known CDN domains.

## Detection rules (hosting)

Checks for: Vercel (`vercel.app`, `now.sh`), Netlify (`netlify.app`, `netlifycdn`), Cloudflare Pages (`pages.dev`), GitHub Pages (`github.io`), AWS (`cloudfront.net`, `amazonaws.com`), Azure, Google Cloud. Falls through to `null` if none match.

## Troubleshooting

**Blank or partial DOM**: Increase `--timeout`, switch to `--wait-for "<selector>"`, or check `console.log` for JS errors that may indicate a required feature is missing (e.g. the page requires WebGL or a specific browser API).

**Missing fonts**: Some sites use `@font-face` rules in cross-origin stylesheets that Playwright can't access via `cssRules`. The scraper compensates by parsing the CSS text directly with regex. If fonts are still missing, check `network.json` for `.woff2` / `.woff` / `.ttf` requests and download them manually.

**Colors look wrong**: The `colors.json` file ranks by frequency. The most frequent color is usually `#ffffff` (background) or `#000000` (text) — not the brand color. Use `design-tokens.mjs` which has heuristics to find the actual brand color (button backgrounds, link colors, saturated colors).

**Stack detection says "Unknown"**: Very minimal sites, custom frameworks, or sites with aggressive minification may not match. Inspect `dom.html` and `network.json` manually — look for `<meta name="generator">`, distinctive asset paths, or framework-specific globals.

**Rate-limited or blocked**: Some sites block Playwright's user agent. Override with `--user-agent "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"`. For aggressive blocking, you may need `agent-browser` with stealth plugins or a proxy.
