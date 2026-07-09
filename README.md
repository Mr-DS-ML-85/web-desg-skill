<div align="center">

# 🎨 web-desg

### Website Design Capture & Cloner for AI Agents

Capture any website's look → extract how it's built → rebuild it as a standalone clone.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Mr-DS-ML-85/web-desg)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![Playwright](https://img.shields.io/badge/Playwright-required-orange.svg)](https://playwright.dev)
[![WebUI Debugging](https://img.shields.io/badge/WebUI-Debugging-red.svg)](#-debugging-webui-errors)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-ff69b4.svg)](CONTRIBUTING.md)
[![Stars](https://img.shields.io/github/stars/Mr-DS-ML-85/web-desg?style=social)](https://github.com/Mr-DS-ML-85/web-desg-skill)

</div>

---

## ✨ Features

| | Feature | What it does |
|---|---|---|
| 📸 | **Screenshot Capture** | Full-page, viewport, or multi-device (iPhone/iPad/desktop) screenshots with dark mode, auth, cookies, and wait-for options |
| 🕷️ | **Site Scraping** | Extracts rendered DOM, all CSS (linked + JS-injected + adopted stylesheets), fonts, images, colors, network log, and metadata |
| 🔍 | **Stack Analysis** | Detects framework (Next.js/Nuxt/VitePress/WordPress/16+ others), UI library, CSS approach, analytics, hosting, structural patterns |
| 🎨 | **Design Tokens** | Extracts palette, typography (with CSS variable resolution), spacing, radii, shadows, breakpoints as JSON + ready-to-use CSS custom properties |
| 🏗️ | **Clone Builder** | Rebuilds the design as a standalone HTML/CSS project with placeholder content |
| 🐛 | **WebUI Debugger** | Detects runtime errors, broken assets, layout issues, and hydration failures that source-code-only agents cannot see |

---

## 🐛 Debugging WebUI Errors

> **The killer feature:** Regular AI agents read source code and reason about what *should* happen. `web-desg` actually renders the page in a real browser and captures what *is* happening — closing the gap between "code looks right" and "site works."

### What it catches that source-code agents miss

| Symptom | How web-desg reveals it |
|---------|-------------------------|
| **JavaScript runtime errors** | `console.log` captures every `pageerror` event — the actual exception message and stack, not a guess |
| **Failed network requests** | `network.json` shows 4xx/5xx responses, timeouts, and CORS errors with exact URLs |
| **Hydration mismatches** (React/Next.js) | Console log captures `Hydration failed` warnings — invisible in source code |
| **Font loading failures** | `fonts-manifest.json` shows what was requested; `console.log` shows `Failed to load resource` for what failed |
| **Mixed content warnings** | Console + network log flag HTTP assets on HTTPS pages |
| **CORS errors** | Console captures `Access-Control-Allow-Origin` violations |
| **CSS specificity wars** | `styles.css` + `inline-styles.css` show the actual cascaded rules at runtime, including CSS-in-JS injected styles |
| **Adopted stylesheets missing** | `inline-styles.css` walks `document.adoptedStyleSheets` — most scrapers miss this entirely |
| **Lazy-loaded content missing** | Compare screenshots with `--delay 0` vs `--delay 3000` to see what never loads |
| **Layout shift (CLS)** | Multi-delay screenshots reveal content jumping as late resources arrive |
| **Mobile responsiveness breaks** | Multi-device screenshots show exactly which breakpoint fails |
| **Dark mode broken** | `--dark` flag forces `prefers-color-scheme: dark` and shows missing dark tokens |
| **Z-index / stacking issues** | Screenshots reveal overlap problems invisible in source |
| **WebFont FOUT/FOIT** | `--delay 0` captures the unstyled flash; `--delay 2000` captures the final state |
| **Web Component shadow DOM issues** | Rendered DOM includes shadow roots where applicable |
| **SPA route rendering failures** | `--wait-for "<selector>"` reveals whether the target element ever mounts |

### Quick debugging workflow

```bash
# 1. Capture the actual rendered state with console + network logs
node scripts/scrape-site.mjs \
  --url https://your-broken-app.com \
  --out-dir ./debug/ \
  --download-js

# 2. Check for runtime errors
cat ./debug/console.log | grep -E "\[error\]|\[warning\]"

# 3. Check for failed requests
python3 -c "
import json
for n in json.load(open('./debug/network.json')):
    if n.get('status', 0) >= 400:
        print(f\"{n['status']} {n['url'][:120]}\")
"

# 4. Capture before/after delay to spot layout shift
node scripts/capture-screenshot.mjs --url https://your-broken-app.com --delay 0    --out before.png
node scripts/capture-screenshot.mjs --url https://your-broken-app.com --delay 3000 --out after.png

# 5. Capture multiple breakpoints to find where layout breaks
node scripts/capture-screenshot.mjs --url https://your-broken-app.com \
  --devices "iphone-14,ipad,desktop-1080,desktop-1440" --out-dir ./breakpoints/
```

### Why this beats reading source code

A source-code-only agent can tell you "this `useEffect` looks suspicious" or "this CSS selector might conflict." It cannot tell you:

- That the actual error thrown at runtime is `TypeError: Cannot read property 'map' of undefined` from line 47 of `chunk-a1b2c.js`
- That `https://api.example.com/users` is returning 502s in production
- That your dark mode is broken because `--color-text` isn't defined in the `:root[data-theme="dark"]` block
- That the mobile layout shoves the sidebar off-screen at exactly 412px wide
- That the hero image hasn't loaded by the time the user sees the page

`web-desg` captures all of this. Pair it with a coding agent for the actual fixes and you have a complete debugging loop: **see the bug → understand the bug → fix the bug → verify the fix**.

---

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/Mr-DS-ML-85/web-desg-skill.git
cd web-desg-skill

# 2. One-time setup (installs Playwright + Chromium)
node scripts/setup-playwright.mjs

# 3. Capture a screenshot
node scripts/capture-screenshot.mjs \
  --url https://stripe.com \
  --full \
  --out screenshot.png

# 4. Scrape the site
node scripts/scrape-site.mjs \
  --url https://stripe.com \
  --out-dir ./stripe-scrape/

# 5. Analyze the stack
node scripts/analyze-stack.mjs \
  --scrape-dir ./stripe-scrape/ \
  --out ./stripe-scrape/stack-analysis.json

# 6. Extract design tokens
node scripts/design-tokens.mjs \
  --scrape-dir ./stripe-scrape/ \
  --out ./stripe-scrape/design-tokens.json
```

---

## 📦 Installation

### As an AI Agent Skill

Drop the `web-desg/` folder into your skills directory:

```bash
# Claude Code / Cursor / similar
mv web-desg-skill  ~/.claude/skills/

# Or for any agent that supports the SKILL.md format
cp -r web-desg-skill /path/to/your/skills/
```

### As a Standalone CLI

```bash
git clone https://github.com/Mr-DS-ML-85/web-desg-skill.git
cd web-desg
node scripts/setup-playwright.mjs
```

**Requirements:**
- Node.js ≥ 18
- ~200MB disk space (for Playwright + Chromium)
- Internet access (for scraping)

---

## 🎯 Usage Examples

### Screenshot Capture

```bash
# Full-page screenshot
node scripts/capture-screenshot.mjs \
  --url https://example.com --full --out full.png

# Multi-device capture (responsive design study)
node scripts/capture-screenshot.mjs \
  --url https://example.com \
  --devices "iphone-14,ipad,desktop-1080,desktop-1440" \
  --out-dir ./devices/

# Authenticated / dark mode
node scripts/capture-screenshot.mjs \
  --url https://app.example.com \
  --auth user:pass --dark --wait-for "main" --out app.png
```

**Available device presets:** `iphone-14`, `iphone-14-pro`, `iphone-se`, `ipad`, `ipad-pro`, `pixel-7`, `galaxy-s22`, `desktop-1080`, `desktop-1440`, `desktop-1920`

### Site Scraping

```bash
node scripts/scrape-site.mjs \
  --url https://example.com \
  --out-dir ./scrape/ \
  --max-images 50 \
  --download-js
```

**Produces:**

| File | Description |
|------|-------------|
| `dom.html` | Fully rendered DOM (post-JS) |
| `styles.css` | All CSS rules, deduped and organized |
| `inline-styles.css` | CSS from `<style>` tags and `style=` attributes |
| `fonts/` | Downloaded font files + `fonts-manifest.json` |
| `images/` | Downloaded images + `images-manifest.json` |
| `colors.json` | Every color used, with frequency count |
| `assets-manifest.json` | All assets discovered with URLs/sizes/types |
| `network.json` | Network request log |
| `meta.json` | Page metadata (title, OG tags, favicon, etc.) |
| `console.log` | Browser console output |

### Stack Analysis

```bash
node scripts/analyze-stack.mjs --scrape-dir ./scrape/ --out stack.json
```

```json
{
  "framework": { "name": "VitePress", "version": "2.0.0", "confidence": 0.98 },
  "css_approach": { "name": "Tailwind CSS", "confidence": 0.9 },
  "analytics": ["Fathom"],
  "patterns": ["sticky-nav", "hero-section", "feature-card-grid"]
}
```

### Design Tokens

```bash
node scripts/design-tokens.mjs --scrape-dir ./scrape/ --out tokens.json
```

```json
{
  "colors": {
    "brand": "#008039",
    "background": { "default": "#f6f6f7", "muted": "#f5f5fa" },
    "text": { "primary": "#16171d", "secondary": "#222325" }
  },
  "typography": {
    "heading": { "family": "APK Protocol" },
    "body": { "family": "Inter", "size": "16px" }
  },
  "cssVariables": ":root { --color-brand: #008039; ... }"
}
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     web-desg Pipeline                         │
└──────────────────────────────────────────────────────────────┘

   ┌─────────────┐
   │   Phase 1   │  capture-screenshot.mjs
   │ Screenshot  │  → PNG (full / viewport / multi-device)
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐
   │   Phase 2   │  scrape-site.mjs
   │   Scrape    │  → dom.html, styles.css, fonts/, images/, network.json
   └──────┬──────┘
          │
          ▼
   ┌─────────────┐    ┌─────────────┐
   │   Phase 3   │    │   Phase 4   │
   │   Stack     │    │   Design    │
   │  Analysis   │    │   Tokens    │
   └──────┬──────┘    └──────┬──────┘
          │                  │
          └────────┬─────────┘
                   │
                   ▼
           ┌─────────────┐
           │   Phase 5   │  (agent-driven)
           │    Clone    │  → standalone HTML/CSS project
           └─────────────┘
```

---

## 📁 Skill Structure

```
web-desg/
├── SKILL.md                       # Skill metadata + workflow (read by agent)
├── README.md                      # This file
├── README.html                    # Standalone HTML version
├── scripts/
│   ├── setup-playwright.mjs       # One-time env bootstrap
│   ├── capture-screenshot.mjs     # Screenshot capture (full/viewport/multi-device)
│   ├── scrape-site.mjs            # Full asset stack scraper
│   ├── analyze-stack.mjs          # Framework/lib/hosting detector
│   └── design-tokens.mjs          # Design token extractor
├── references/
│   ├── scraping-guide.md          # SPAs, lazy-load, auth, iframes, detection rules
│   ├── clone-patterns.md          # Patterns for landing/dashboard/blog/e-commerce
│   └── ethics.md                  # IP, robots.txt, ToS, fair use
└── assets/
    └── clone-template.html        # Starter HTML skeleton for clones
```

---

## 🆚 Comparison with Related Skills

| Skill | Best for |
|-------|----------|
| **web-desg** (this) | Capture + scrape + analyze + clone a site's full design |
| `agent-browser` | Interactive browser automation (click, type, navigate) |
| `web-shader-extractor` | Extracting WebGL/Canvas shader code |
| `web-reader` | Extracting article content as text |
| `design` | Designing fresh UIs from scratch with style presets |

---

## ⚖️ Ethics & Legal

Cloning a site's **design patterns** for learning, prototyping, and inspiration is generally fine. Cloning a site's **trademarks, copyrighted assets, or proprietary copy** and shipping them as your own is not.

**Always:**
- Check `robots.txt` and Terms of Service before scraping
- Replace logos, marketing copy, and product names with placeholders in clones
- Credit the original site in a comment: `<!-- Design inspired by [URL] -->`

See [`references/ethics.md`](references/ethics.md) for the full guidance.

---

## ✅ Proof

This isn't a toy demo. Both artifacts below came from running this skill's full pipeline — screenshot → scrape → stack analysis → design tokens — against a live, unfamiliar production site: [moltbook.com](https://moltbook.com), a Reddit-style social network built for AI agents. No manual cleanup of the extracted data, no cherry-picked output.

### The scans

| Artifact | Model | Scope |
|---|---|---|
| [`proof/Moltbook_Design_Architecture_Report_GLM-5.pdf`](proof/Moltbook_Design_Architecture_Report_GLM-5.pdf) | GLM 5 | 10-section report: tech stack, color/type/spacing tokens, layout grid, component vocabulary, animation & motion, z-index layering, information architecture |
| [`proof/Minimax_M3_Moltbook.md`](proof/proof/Minimax_M3_Moltbook.md) | MiniMax M3 | Independent scan of the same target — goes further into page-composition trees, working HTML for the clickable-card pattern, and a "what NOT to copy" IP-boundary section |

### What the raw scrape output let both models correctly identify — independently

- **Framework:** Next.js App Router + Turbopack, detected from `/_next/static/` asset paths, the `next-size-adjust` meta tag, and the `/_next/image?url=...&w=...&q=` optimization signature (both reports: 0.90–0.95 confidence)
- **CSS approach:** Tailwind CSS via arbitrary-value syntax (`bg-[#1a1a1b]`, `text-[#e01b24]`) — no CSS Modules or CSS-in-JS hashes present
- **Font system:** IBM Plex Mono as the sole body font, loaded via `next/font`, with 4 preloaded `.woff2` weights
- **Brand palette:** both independently landed on the same three anchor colors — dark background `#1a1a1b`, brand red `#e01b24`, accent teal `#00d4aa` — despite scanning the site at different moments (moltbook's live counters mean exact byte-for-byte DOM state differs run to run)
- **Layout pattern:** dark sticky header with a 4px colored bottom border, transitioning to a light card-based feed — both reports named this independently
- **Component-level detail:** the nested clickable-card technique (`<a class="absolute inset-0 z-0">` wrapping the row, with `relative z-10` on inner links) was reconstructed as literal, working markup — not a vague description

### Why two independent models agreeing matters

Any single AI-generated report could be a fluent-sounding hallucination. Two different models, run separately, converging on the same framework ID, the same three brand colors, the same layout grammar, and the same component markup is a much stronger signal that the *scrape output itself* — the actual `dom.html`, `styles.css`, `colors.json` this skill produces — is accurate. The models aren't inventing a story; they're both reading the same real extracted data and reporting it consistently.

### Known limitation (documented, not hidden)

Exact frequency counts differ between the two reports (e.g. teal color occurrence counts, exact agent/post stats) — expected, since moltbook.com's stats and content update live between scans. Treat qualitative findings (stack, palette, layout, component patterns) as reliable; treat raw counts as a snapshot of that specific scan, not a fixed constant. Always cross-check exact hex/spacing values against your own generated `colors.json` / `design-tokens.json` before hardcoding them downstream.


## 🤝 Contributing

Contributions are welcome! Especially valuable:

- **New framework detectors** in `analyze-stack.mjs` (see `references/scraping-guide.md` for the rule format)
- **New device presets** in `capture-screenshot.mjs`
- **New clone patterns** in `references/clone-patterns.md`
- **Test cases** — run the pipeline on sites you know and report mismatches

```bash
# Fork → Branch → PR
git checkout -b feat/new-detector
# Make changes
npm test  # (if added)
git commit -m "feat: detect SolidStart"
git push origin feat/new-detector
# Open PR
```

---

## 📜 License

MIT © 2026

Powered by [Playwright](https://playwright.dev)

---

<div align="center">

**[⬆ Back to top](#-web-desg)**

If this skill saved you time, consider ⭐ starring the repo.

</div>
