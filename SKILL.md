---
name: web-desg
description: |
  Capture, scrape, and clone any website's visual design. Takes screenshots (full-page, viewport, mobile, desktop, multi-viewport), extracts the full asset stack (HTML, CSS, fonts, colors, images, JS bundles), reverse-engineers the tech stack and design tokens, and produces a standalone HTML/CSS clone that recreates the original look.
  Use this skill whenever the user wants to: copy or clone a website's design, replicate a webpage's look, screenshot a site for design reference, extract a site's color palette / fonts / spacing / CSS, reverse-engineer how a website is built, understand a competitor's UI, "make my site look like X", reverse-engineer a landing page, or build a design system from an existing site. Trigger on phrases like "copy this website", "clone the design of", "screenshot this site", "how is this site built", "extract the styles from", "replicate this page", "steal this site's look", "what fonts does X use", "what's the color palette of X".
---

# web-desg — Website Design Capture & Cloner

Capture any website's look (screenshots), extract how it's built (HTML/CSS/fonts/colors/stack), and rebuild it as a standalone clone. The three phases are independent — you can stop after screenshots, or run the full pipeline through to a cloned project.

## When to use this skill

Trigger this skill whenever the user mentions any of: copying/cloning a website's design, taking a website screenshot (especially full-page or multi-device), extracting a site's CSS/fonts/colors, reverse-engineering how a site is built, replicating a webpage, or building a design system inspired by an existing site.

Do **not** trigger for: pure content extraction (use `web-reader`), WebGL/shader extraction (use `web-shader-extractor`), browser interaction automation (use `agent-browser`), or designing a fresh UI from scratch (use `design`).

## Ethics & legality (read before cloning)

Cloning a site's *visual style and patterns* for learning, prototyping, or inspiration is generally fine. Copying a site's *trademarks, copyrighted assets, proprietary copy, or logos* and shipping them as your own is not. Always check the site's `robots.txt` and Terms of Service before scraping. See `references/ethics.md` for the full guidance — read it the first time you clone a site, and any time the user is uncertain about whether something is OK to copy.

## Phase 0: Environment setup (one-time, auto)

Before any capture, ensure Playwright + Chromium are installed. Run the bootstrap once per machine:

```bash
node /home/z/my-project/skills/web-desg/scripts/setup-playwright.mjs
```

This is idempotent — safe to run every time. It installs to `~/.cache/web-desg-runner/` so it doesn't pollute the user's global Node modules. If install fails (no network, sandbox), the scripts will fall back to a `curl`-only mode that still extracts static HTML+CSS but skips JS-rendered content and screenshots.

## Phase 1: Screenshot capture

The fastest way to understand a site is to look at it. Screenshots also serve as the visual reference for the clone later.

```bash
# Full-page screenshot (scrolls the entire page, stitches it together)
node /home/z/my-project/skills/web-desg/scripts/capture-screenshot.mjs \
  --url "https://example.com" \
  --full \
  --out /home/z/my-project/download/example-full.png

# Viewport-only screenshot (what a user sees without scrolling)
node /home/z/my-project/skills/web-desg/scripts/capture-screenshot.mjs \
  --url "https://example.com" \
  --viewport 1440x900 \
  --out /home/z/my-project/download/example-viewport.png

# Mobile + desktop multi-viewport (great for responsive design study)
node /home/z/my-project/skills/web-desg/scripts/capture-screenshot.mjs \
  --url "https://example.com" \
  --devices "iphone-14,iphone-14-pro,ipad,desktop-1080,desktop-1440" \
  --out-dir /home/z/my-project/download/example-devices/

# Wait for a specific element or network idle before capturing
node /home/z/my-project/skills/web-desg/scripts/capture-screenshot.mjs \
  --url "https://example.com" \
  --wait-for "main hero" \
  --full --out /home/z/my-project/download/example.png
```

Outputs go to `/home/z/my-project/download/` by default so the user can grab them. Screenshots are PNG, optimized for size with `pngquant` if available.

When capturing: pass `--dark` to force dark mode, `--auth user:pass` for HTTP basic auth, `--cookie "name=value"` for sessions, `--timeout 30000` for slow sites. Full options are documented in `scripts/capture-screenshot.mjs` (run with `--help`).

## Phase 2: Scrape the site (understand how it works)

This phase produces a structured snapshot of the site's building blocks. It runs *after* JS rendering so SPA content is captured too.

```bash
node /home/z/my-project/skills/web-desg/scripts/scrape-site.mjs \
  --url "https://example.com" \
  --out-dir /home/z/my-project/download/example-scrape/
```

This produces:

| File | What's in it |
|------|--------------|
| `dom.html` | The fully rendered DOM (post-JS) |
| `styles.css` | All computed CSS rules, deduped and organized by selector |
| `inline-styles.css` | CSS extracted from `<style>` tags and inlined `style=` attributes |
| `fonts/` | Downloaded font files (woff2/woff/ttf) with a `fonts-manifest.json` listing family, weight, style, source URL |
| `images/` | Downloaded images (img src, CSS background-image, srcset candidates) with a `images-manifest.json` |
| `colors.json` | Every color used on the page, with frequency count and where (text/bg/border) |
| `assets-manifest.json` | All JS bundles, CSS files, fonts, images — with URLs, sizes, and types |
| `network.json` | Network request log (URL, method, status, type, size) — useful for finding API endpoints and lazy-loaded chunks |
| `meta.json` | Page title, description, OG tags, viewport, lang, favicon, theme-color |
| `console.log` | Browser console output (errors/warnings often reveal framework versions) |

For large sites, pass `--max-images 50` to cap downloads. Pass `--download-js` to also fetch JS bundles (off by default since they're often minified and huge).

## Phase 3: Analyze the tech stack

Detects the framework, UI library, CSS approach, and design system the site uses. This is critical context for the clone — you can't recreate a Next.js + Tailwind site the same way you'd recreate a WordPress + jQuery site.

```bash
node /home/z/my-project/skills/web-desg/scripts/analyze-stack.mjs \
  --scrape-dir /home/z/my-project/download/example-scrape/ \
  --out /home/z/my-project/download/example-scrape/stack-analysis.json
```

Returns a JSON report:

```json
{
  "framework": { "name": "Next.js", "version": "14.x", "confidence": 0.95, "evidence": [...] },
  "ui_library": { "name": "Radix UI", "confidence": 0.8, "evidence": [...] },
  "css_approach": { "name": "Tailwind CSS", "version": "3.x", "confidence": 0.9, "evidence": [...] },
  "fonts": ["Inter", "GT America"],
  "analytics": ["Google Analytics 4", "PostHog"],
  "cms": null,
  "hosting": "Vercel",
  "image_optimization": "next/image",
  "patterns": ["feature-card-grid", "centered-hero", "sticky-nav"]
}
```

The detector uses multiple signals: HTML structure (`__NEXT_DATA__`, `__NUXT__`), global variables (`window.React`, `window.Vue`), script src patterns, CSS class naming conventions, meta generator tags, response headers, and bundle content scanning. See `references/scraping-guide.md` for the full detection rule set.

## Phase 4: Extract design tokens

Convert the site's design language into structured tokens you can use directly in a rebuild.

```bash
node /home/z/my-project/skills/web-desg/scripts/design-tokens.mjs \
  --scrape-dir /home/z/my-project/download/example-scrape/ \
  --out /home/z/my-project/download/example-scrape/design-tokens.json
```

Produces:

```json
{
  "colors": {
    "primary": "#3B82F6",
    "background": { "default": "#FFFFFF", "muted": "#F9FAFB" },
    "text": { "primary": "#111827", "secondary": "#6B7280" },
    "border": "#E5E7EB",
    "accent": "#10B981",
    "palette": [ { "hex": "#3B82F6", "frequency": 142, "usage": ["button-bg", "link"] }, ... ]
  },
  "typography": {
    "heading": { "family": "Inter", "weights": [600, 700], "scale": { "h1": "3rem", "h2": "2.25rem", ... } },
    "body": { "family": "Inter", "weight": 400, "size": "1rem", "lineHeight": "1.6" },
    "mono": { "family": "JetBrains Mono" }
  },
  "spacing": { "scale": ["0", "0.25rem", "0.5rem", "1rem", "1.5rem", "2rem", "3rem", "4rem", "6rem", "8rem"], "unit": "rem" },
  "radii": { "sm": "0.25rem", "md": "0.5rem", "lg": "0.75rem", "full": "9999px" },
  "shadows": [ { "name": "sm", "value": "0 1px 2px rgba(0,0,0,0.05)" }, ... ],
  "breakpoints": { "sm": "640px", "md": "768px", "lg": "1024px", "xl": "1280px" },
  "container": { "maxWidth": "1200px", "padding": "1.5rem" }
}
```

These tokens are the bridge between "what the site looks like" and "how to rebuild it". They become CSS custom properties in the clone.

## Phase 5: Build the clone

This phase is done by you (the agent), not a script — cloning requires judgment about which sections matter, how to handle proprietary content, and how to adapt the design to the user's actual use case.

**Workflow:**

1. Read `design-tokens.json`, `stack-analysis.json`, `colors.json`, and the screenshot from Phase 1.
2. Pick a clone strategy based on the site type — see `references/clone-patterns.md` for landing page / dashboard / blog / marketing site patterns.
3. Generate a standalone project at `/home/z/my-project/download/<site-name>-clone/`:
   - `index.html` — semantic structure using the original's sectioning
   - `styles.css` — tokens as CSS custom properties at `:root`, then component styles
   - `assets/` — fonts (from Phase 2) and any images that are safe to reuse (logos and brand imagery should be placeholders)
4. Open the clone with `agent-browser` and screenshot it side-by-side with the original to verify fidelity.
5. Iterate on differences until the clone is visually close (aim for "same vibe" not "pixel-perfect" — the goal is learning/adaptation, not forgery).

**Always:**
- Replace proprietary copy (marketing headlines, product names) with placeholder text
- Replace logos and brand imagery with neutral placeholders (e.g. `Logo` text or a generic SVG)
- Keep the *structure, hierarchy, spacing, color logic, typography* — those are the reusable insights
- Credit the original in a comment in the HTML: `<!-- Design inspired by example.com, cloned for learning/prototyping -->`

## Quick decision guide

| User said | Run |
|-----------|-----|
| "Take a screenshot of X" | Phase 1 only |
| "What fonts/colors does X use?" | Phase 1 + 2 + 4 |
| "How is X built?" / "What stack does X use?" | Phase 1 + 2 + 3 |
| "Clone X" / "Copy X's design" / "Make my site look like X" | Phase 1 + 2 + 3 + 4 + 5 |
| "Get me everything from X" | All phases |

## Output locations

All artifacts go to `/home/z/my-project/download/`:
- Screenshots: `download/<site-name>-*.png`
- Scrape bundle: `download/<site-name>-scrape/`
- Clone project: `download/<site-name>-clone/`

Use descriptive names — `stripe-pricing-clone/`, not `clone1/`.

## Reference index

Read these when you hit the corresponding situation:

| When | Read |
|------|------|
| Site is a SPA, content lazy-loads, or has auth | `references/scraping-guide.md` |
| Building the clone (Phase 5) — patterns for landing pages, dashboards, blogs | `references/clone-patterns.md` |
| User is unsure if cloning is OK, or site has restrictive ToS | `references/ethics.md` |
| Need to detect a specific framework or library | `references/scraping-guide.md` § "Detection rules" |

## Common pitfalls

- **Blank screenshots on SPAs**: pass `--wait-for networkidle` or `--wait-for "<selector>"` so JS has time to render.
- **Missing fonts in clone**: check `fonts-manifest.json` — some sites use `@font-face` with relative URLs that need rewriting.
- **Wrong colors in clone**: the most frequent color in `colors.json` is often the body background, not the brand color. Look at button/link backgrounds specifically — those reveal the brand palette.
- **Stack detection says "Unknown"**: very minimal sites, custom frameworks, or sites with aggressive minification may not match. Fall back to manual inspection of `dom.html` and `network.json`.
- **Cloned site looks off**: 90% of the time it's a spacing or line-height mismatch, not a color mismatch. Re-extract tokens and double check the spacing scale.
