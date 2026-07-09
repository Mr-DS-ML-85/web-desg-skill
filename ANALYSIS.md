# moltbook.com — Design & Architecture Scan

**Scan date:** 2026-07-09
**Source:** https://moltbook.com
**Tagline:** *"the front page of the agent internet"*
**What it is:** A Reddit-style social network built exclusively for AI agents. Humans can observe but not post. Submolts = subreddits. Posts are written by agents, verified by their human owners via X/Twitter.

---

## TL;DR

moltbook.com is a **Next.js + Tailwind** social-news site that deliberately clones Reddit's visual grammar (dark header, up/down vote columns, comment counts, OP-style posts) and overlays a **terminal / developer-aesthetic** layer (IBM Plex Mono, code-block CTAs, lobster mascot, teal/red duotone). It's a great reference for "social platform + dev-tool aesthetic" — you can steal the layout grammar without stealing their IP.

---

## 1. Tech stack (auto-detected)

| Layer | Choice | Confidence |
|---|---|---|
| Framework | **Next.js** (App Router, Turbopack) | 0.95 |
| CSS approach | **Tailwind CSS** (heavy use of arbitrary values `bg-[#1a1a1b]`) | 0.90 |
| UI library | None detected (raw Tailwind + inline styles) | — |
| Fonts | **IBM Plex Mono** (all weights) + Verdana for the logo wordmark | — |
| Hosting | Next.js self-host hints (likely Vercel, not confirmed in `network.json`) | — |
| Analytics | None detected | — |
| Image pipeline | `/_next/image?url=...&w=...&q=75` — Next.js Image Optimization | — |
| Build artifacts | 16 JS chunks via `/_next/static/chunks/*` (Turbopack-split) | — |

**Key signals:**
- Body class: `ibm_plex_mono_973e1757-module__8DqIaW__variable antialiased flex flex-col min-h-screen` — IBM Plex Mono loaded via Next.js `next/font` (CSS variable).
- Preloaded fonts: 4 woff2 weights via `/_next/static/media/*-s.p.*.woff2`.
- Heavy use of `bg-[#hex]`, `text-[#hex]`, `border-[#hex]` Tailwind arbitrary values — confirms the design system uses Tailwind config but with one-off brand colors per component.
- Class names like `animate-ping`, `animate-pulse`, `animate-fadeIn`, `animate-shimmer` — Tailwind's built-in animations plus custom keyframes.
- `style="scrollbar-width:none;-ms-overflow-style:none"` and `scrollbar-hide` — horizontal scroll containers with hidden scrollbars.

---

## 2. Design tokens (extracted)

### Colors

| Role | Hex | Notes |
|---|---|---|
| **Brand / Accent (teal)** | `#00d4aa` | Verified-checkmark, live indicator, links, "Humans welcome" copy, focus rings. 58 occurrences. |
| **Primary CTA (red)** | `#e01b24` | Logo wordmark, "I'm a Human" button, Notify-me button, upvote arrows, hot-pill borders. 39 occurrences. |
| **Header background** | `#1a1a1b` | Sticky nav bg + post-section dark card. 25 occurrences. |
| **Hover surface** | `#272729` | Input fields, nav hover bg. 10 occurrences. |
| **Border (dark)** | `#343536` | Subtle separators on dark. 19 occurrences. |
| **Text secondary** | `#7c7c7c` / `#818384` / `#888` | Muted text on dark surfaces. |
| **Body bg (light)** | `#fafafa` | Outer page background under hero. |
| **Card bg (white)** | `#ffffff` | Post cards, trending agent cards. |
| **Stat: agents (red)** | `#e01b24` | "208,592 Human-Verified AI Agents" |
| **Stat: submolts (teal)** | `#00d4aa` | "32,499 submolts" |
| **Stat: posts (blue)** | `#4a9eff` | "3,585,912 posts" |
| **Stat: comments (gold)** | `#ffd700` | "19,123,851 comments" |
| **Hot-pill orange** | `#ff6b35` | "Hot Right Now" gradient + "10 in 5m" badges |
| **Karma scale (Reddit-style)** | `#ff4500` upvote / `#1da1f2` comment / `#cd7f32` bronze / `#c0c0c0` silver / `#ffd700` gold | Vote arrows, badges |

### Gradients (used liberally)
- `from-[#e01b24] to-[#ff6b35]` — announcement banner, avatar fallback, hot pill borders
- `from-[#1a1a1b] to-[#2d2d2e]` — hero section background
- `from-[#fafafa] to-white` — trending agent card bg
- `from-[#00d4aa] to-[#00b894]` — active "Realtime" tab pill
- `from-[#fff8f0] to-[#fff3e8]` — "Hot Right Now" section bg

### Typography
- **Headings & body:** `IBM Plex Mono` — 13px base, 22px h1, 20px h2, 18px h3
- **Logo wordmark:** `Verdana, sans-serif` (bold, red, the lobster-mascot sibling)
- **Line-height:** 1.5 throughout
- **Tracking:** `tracking-tight` on logo and h1

### Spacing
- Mostly px-based: `4, 8, 12, 16, 24, 32, 40`
- Container max-widths: `max-w-4xl` (hero), `max-w-6xl` (header + main feed), `max-w-md` (CTA card)

### Radii
- `4px` and `.25rem` for inputs
- `rounded-full` for pills and search inputs
- `rounded-lg` for cards
- Custom `--radius-2xl` variable present but inconsistently applied

### Shadows
- `0 0 20px #00d4aa66` — teal glow on hovered agent cards
- `0 0 0 2px #00d4aa33` — focus ring style
- `0 0 20px #e01b2466` — red glow variant
- `0 0 40px #00d4aab3` — strong teal "shimmer" line on the trending agents panel

---

## 3. UI patterns (component vocabulary)

### 3.1 Header (sticky, 2-row)
- **Row 1:** Logo (32×32 PNG + red "moltbook" wordmark in Verdana) → search input (rounded-full, dark) → nav links (Submolts, login icon)
- **Row 2:** Dismissible gradient announcement bar `from-[#e01b24] to-[#ff6b35]` with ToS/Privacy links
- `sticky top-0 z-50` + `border-b-4 border-[#e01b24]` — the red bottom border is the strong brand signature
- Mobile pattern: search collapses to icon, "Submolts" text collapses to grid icon

### 3.2 Hero (centered, dark gradient, terminal CTA)
- Dark gradient bg `from-[#1a1a1b] to-[#2d2d2e]`
- Centered mascot (160×160 PNG)
- H1 with split coloring: white text + red span on "AI Agents"
- Subtext with teal span on "Humans welcome to observe"
- Two-button row: filled red primary ("👤 I'm a Human") + ghost-outline secondary ("🤖 I'm an Agent")
- **Code-block CTA card:** dark `#2d2d2e` panel with inner `#1a1a1b` code well, teal monospace copy, then numbered 1/2/3 onboarding steps with red numerals
- Email signup form (terms checkbox + Notify me button) at the bottom of the hero — split by a thin `#333` border

### 3.3 Stats strip
- 4-column flex row with brand-colored counts and gray labels
- Tooltip on first stat (the verification methodology hint) — uses absolute-positioned tooltip card with `opacity-0 group-hover:opacity-100`

### 3.4 Trending Agents (horizontal scroll rail)
- Dark header (`bg-[#1a1a1b]`) with `🔥` + animated ping dot + label "Trending Agents"
- Right side: "last 24h" + "208592 verified" live counter + "View All →" link
- Body: white card with horizontal scroll row of 224px-wide cards
- Each card: gradient avatar circle + verified badge (teal ✓) + name + karma badge (yellow pill with ⚡) + stats row (▲ upvotes / 💬 comments / 📝 posts)
- Edge fades: `bg-gradient-to-r from-white to-transparent` on left and right edges
- Top edge: animated teal `via-[#00d4aa]` shimmer line via `animate-shimmer`

### 3.5 Live Posts feed (sticky toolbar + cards)
- **Sticky sub-header** `top-[52px] z-40` with `📝 Posts` + LIVE pulse + sort tabs (Realtime / Random / New / Top / Discussed)
- Active tab uses `bg-gradient-to-r from-[#00d4aa] to-[#00b894] text-[#1a1a1b]` — pill with teal gradient
- Inactive tabs: gray text, no fill, `hover:text-white`
- **Two-tier body:**
  - Top section: orange/peach gradient "🔥 Hot Right Now — most active in the last 5 min"
  - Bottom section: regular white card list with dividers
- Each post row:
  - Vote column on left (▲ count ▼ in #1a1a1b bold)
  - Content column: ranking badge (#3 in teal pill) + submolt link + author + timestamp + title (semibold, hover→red) + line-clamp-2 excerpt + top-comment preview card + meta row (💬 count, hot-pill if applicable)
  - The whole row is clickable via an absolute `<a class="absolute inset-0 z-0">` overlay (clickable card pattern)
  - Left accent border `border-l-[3px] border-l-[#ff6b35]` marks hot posts
- Comment preview uses `bg-[#f8f9fa] border-l-2 border-[#00d4aa]` — the teal accent line is a strong visual motif

### 3.6 Avatar / karma badge system
- Avatars: circular, gradient `from-[#e01b24] to-[#ff6b35]`, white initial letter fallback
- Verified: `bg-[#00d4aa]` ✓ badge anchored to bottom-right with white border
- Karma: `bg-[#fff3cd] text-[#856404] px-1.5 py-0.5 rounded-full` yellow pill with ⚡ icon — clear Reddit-karma homage
- Hover: `hover:border-[#00d4aa] hover:shadow-md` — entire card lightens with teal accent

### 3.7 Animations (micro-interactions)
- `animate-pulse` — LIVE dots, "Be the first to know" indicator
- `animate-ping` — secondary ring around the LIVE dot for a sonar effect
- `animate-fadeIn` — staggered card entry (`animation-delay: 0ms, 50ms, 100ms, 150ms, 200ms`)
- `animate-shimmer` — teal gradient line sweeping across the trending panel header
- `group-hover:scale-110 transition-transform` — logo + emoji CTAs pop on hover
- `transition-all duration-500 ease-in-out` — hot-post list re-orders with a smooth shuffle animation

### 3.8 Responsive strategy
- Hero: `text-2xl sm:text-3xl`, `py-10 sm:py-14`
- Nav: `hidden md:block` for search, `hidden sm:block` for "Submolts" text
- Stat strip: `flex flex-wrap gap-6 sm:gap-8`
- Post card: `gap-2 sm:gap-4 p-3 sm:p-4`, `text-xs sm:text-sm`, vote col `min-w-[32px] sm:min-w-[40px]`
- Sort tabs: collapse icon-only on mobile (`hidden sm:inline` on the labels)

---

## 4. Architectural patterns

### 4.1 Page composition
```
<body class="flex flex-col min-h-screen">
  <div class="sticky top-0 z-50">              ← header + announcement
    <header>…</header>
    <div class="bg-gradient-to-r…">…</div>     ← ToS banner
  </div>
  <div class="flex-1">
    <div class="min-h-screen flex flex-col bg-[#fafafa]">
      <section class="bg-gradient-to-b from-[#1a1a1b] to-[#2d2d2e]">  ← hero
        <div class="max-w-4xl mx-auto text-center">…</div>
      </section>
      <main class="flex-1 px-4 py-8">
        <div class="max-w-6xl mx-auto">
          stats strip
          trending agents rail
          <div class="grid lg:grid-cols-4 gap-6">
            <div class="lg:col-span-3">  ← post feed
              sticky sort toolbar
              hot section + main list
            </div>
            <aside class="lg:col-span-1">  ← sidebar (likely submolts/communities)
            </aside>
          </div>
        </div>
      </main>
    </div>
  </div>
</body>
```
- Outer sticky shell (`z-50`) holds header + announcement together
- Page-level flex column with `min-h-screen` so footer (if any) sticks to bottom
- Two-column main feed switches from 3-col content + 1-col sidebar at `lg` breakpoint

### 4.2 Component patterns

**Clickable card with internal links** (very Reddit-y):
```html
<a class="absolute inset-0 z-0" href="/post/..."></a>      ← the wrapper link
<a class="relative z-10" href="/u/neo_konsi_s2bw">author</a>  ← nested links with z-index
```
Used throughout — lets the whole row be clickable while still letting inner metadata links work.

**Sticky sub-header with offset**:
```html
<div class="sticky top-[52px] z-40">  ← sits below the 52px main header
```
Pattern: stack two sticky elements with explicit top offsets when nesting.

**Glass-y dark header + light content** split:
- Dark sticky shell for nav (`bg-[#1a1a1b]`)
- Dark hero (gradient from header color to slightly lighter)
- Light content area (`bg-[#fafafa]`) with white cards
This is the classic "dark nav, light body" SaaS pattern — they execute it well.

### 4.3 Data shape (inferred from DOM)
- Posts have: ranking number, submolt slug (`/m/general`, `/m/agents`, `/m/introductions`), author slug, relative timestamp, title, excerpt (line-clamped), top-comment preview (author + relative time + line-clamped), comment count, hot-indicator count
- Submolts are URL-addressable: `/m/<slug>` mirrors Reddit's `/r/<slug>`
- Users are URL-addressable: `/u/<slug>`
- Posts use UUID slugs: `/post/<uuid>` — typical for SPA-friendly routing
- Avatars fall back to colored circles with initial letter when no image is set — gradient color encoded from username hash (likely)
- Karma scores shown as integers with comma separators (1,029,257 format)

### 4.4 Real-time / live indicators
- "LIVE" label with pulse + ping animations everywhere
- "just now" relative timestamps
- "10 in 5m" hot badges with pulse
- "208592 verified" live counter on the trending panel header
- Animated shuffle on the hot section every ~5s (`transition-all duration-500`)
- The "Realtime" sort tab is the default — implies a WebSocket / SSE feed in the background

### 4.5 Verification pattern (creative)
- Every agent post links to a `/u/<slug>` author page
- "Human-Verified AI Agents" stat with hover tooltip explaining: *"AI agents verified by their human owners via X. 2,901,689 total registered on the platform."*
- Onboarding flow (hero CTA): 1) Send the URL to your agent → 2) Agent signs up + sends you a claim link → 3) Tweet to verify ownership
- This is **identity-as-onboarding**: the humans own the agents, the agents post. Clever trust model.

---

## 5. Brand voice & content design

- **Voice:** irreverent, opinionated, technical, lowercase-leaning
- **Headlines are bold claims**, not benefits:
  - *"Coordination failures in agents are timeout bugs pretending to be judgment"*
  - *"Agent memory is a garbage collector problem pretending to be reasoning"*
  - *"Inference burn is mostly a scheduler bug wearing an intelligence badge"*
- This is the "Postel-quote-as-title" pattern from Hacker News / lobste.rs / r/programming — the post title IS the thesis.
- Body copy is dense, line-clamp-2/3, with key phrases bolded
- Lots of em-dashes, code-switched vocabulary (`p95`, `GC`, `lease checks`, `IPoDWDM`), and a `🦞` lobster emoji signature

---

## 6. Reusable design heuristics (steal-worthy, not the IP)

1. **Duotone palette + one signal color**: pick two brand colors (here red/teal), use them as the only saturated hues, let gray do the rest. The single `#ffd700` for gold stats and `#ff6b35` for hot-state are the only deviations.
2. **Dark sticky header + red bottom border**: 4px solid brand-color border at the bottom of a dark header is a strong brand fingerprint. Used by Stripe, Linear, and now moltbook.
3. **Code-block as CTA**: for dev-tool audiences, putting the call-to-action *as a code snippet* (in monospace, in a dark inset box, with teal accent text) converts better than a "Get Started" button. The copyable URL is the onboarding.
4. **Clickable card with nested links**: `<a class="absolute inset-0 z-0">` + inner links with `relative z-10` lets you keep semantic nav without JS.
5. **Pulse + ping two-layer animation**: `<span class="animate-ping"><span class="animate-pulse">` gives a "live sonar" feel for free.
6. **Edge-fade gradients on horizontal scroll rails**: `from-{color} to-transparent` on both edges signals "there's more, scroll" without arrows.
7. **Animated gradient line on panel headers**: `via-{brand}` shimmer keyframe is a strong "this is live" indicator with one line of CSS.
8. **Verification badge as identity**: a small `bg-{brand}` ✓ anchored bottom-right of an avatar is the cheapest visual way to signal trust.
9. **Ranking pill in front of submolt link**: `#3 in teal pill` followed by submolt name normalizes "what rank is this post in this sub" as the primary metadata.
10. **Hot vs Normal sections**: separate visual treatment (peach gradient + left orange accent border) for "Hot Right Now" makes the realtime-ness obvious at a glance.

---

## 7. What NOT to copy

- The lobster mascot (their trademark).
- The IBM Plex Mono + Verdana combo as a *signature* — fine to use IBM Plex Mono, but pick your own wordmark font.
- The exact hex codes of the brand colors — they're identifiable; tweak the hue 5–10° to differentiate.
- The "agent internet" / "AI Agents" positioning language — that's their thesis.
- Their social-agent / verification-by-X flow — it's literally the product.

---

## 8. Files captured

```
moltbook-scan/
├── moltbook-full.png            ← full-page screenshot (1440×900 viewport, full scroll)
├── moltbook-viewport.png        ← above-the-fold (1440×900)
├── moltbook-mobile.png          ← mobile (390×844)
└── scrape/
    ├── dom.html                 ← 35KB rendered DOM
    ├── styles.css               ← all computed CSS
    ├── inline-styles.css
    ├── colors.json              ← 385 colors with frequency
    ├── meta.json                ← title, OG tags, body classes
    ├── network.json             ← 38 network requests (fonts, JS chunks, images)
    ├── stack-analysis.json      ← framework + library detection
    ├── design-tokens.json       ← structured tokens + CSS variables
    ├── assets-manifest.json
    ├── console.log
    ├── fonts/                   ← 4 IBM Plex Mono woff2 files
    └── images/                  ← mascot + favicon variants
```