# Clone Patterns

This reference covers how to actually rebuild a website once you have the design tokens, screenshots, and DOM snapshot. Different site types have different patterns — a SaaS landing page is not the same as a dashboard is not the same as a blog.

The goal of cloning is **learning and adaptation**, not forgery. The output should look like "a site in the same style" rather than "an exact copy." Replace proprietary copy, logos, and brand imagery with neutral placeholders; keep the structural, spatial, and color logic.

## General principles

1. **Tokens first, then components.** Convert `design-tokens.json` into `:root` CSS custom properties before writing any component CSS. This makes the clone maintainable — change a token, the whole site updates.
2. **Match the layout grid, not the pixel positions.** Most sites use a 12-column grid at desktop, stacked at mobile. Get the breakpoints and container width right first.
3. **Type scale matters more than colors.** If your clone looks "off," it's almost always because the heading sizes or line heights are wrong, not because the colors are wrong.
4. **Use semantic HTML.** `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>`. The original may use `<div>` everywhere — you should be better.
5. **Replace proprietary content visibly.** Use `Lorem ipsum` for body copy, `[Product Name]` for product names, a generic SVG logo. The user should immediately see what's placeholder.

## Site type: SaaS / product landing page

**Structure:**
```
<header> Sticky nav (logo, links, CTA button)
<main>
  <section class="hero"> Big headline, subhead, primary+secondary CTAs, hero image/video
  <section class="logos"> "Trusted by" logo strip
  <section class="features"> 3-column or 4-column feature card grid
  <section class="showcase"> Alternating image+text rows
  <section class="testimonials"> 1 big quote or 3-up cards
  <section class="pricing"> 3-tier pricing cards
  <section class="faq"> Accordion
  <section class="cta"> Final call-to-action banner
<footer> Multi-column with links, social, copyright
```

**Common patterns to look for in the original:**
- Hero is usually `min-height: 80vh` with content vertically centered
- Logo strip is grayscale, often `opacity: 0.5`
- Feature cards use `gap: 2rem` and equal-height rows
- Pricing tier "highlighted" plan is scaled up 1.05x with a different border color
- FAQ uses `<details>` or a JS accordion

**Implementation tips:**
- For the hero image, use a placeholder from `https://picsum.photos/seed/<name>/1200/600`
- For feature card icons, use Lucide (https://lucide.dev) or Heroicons — both have CDN includes
- Implement the sticky nav with `position: sticky; top: 0;` and a `backdrop-filter: blur()` background

## Site type: Dashboard / web app

**Structure:**
```
<div class="app-shell">           CSS grid: sidebar + main
  <aside class="sidebar">          Logo, nav items, user menu at bottom
  <div class="main">
    <header class="topbar">         Breadcrumb, search, notifications, avatar
    <main class="content">
      <section class="page-header"> Title, subtitle, actions
      <section class="stats">       4-up KPI cards (number + delta)
      <section class="chart-row">   2-column: main chart + side panel
      <section class="table-card">  Data table with filters
    </main>
  </div>
</div>
```

**Common patterns:**
- Sidebar is `width: 240px` collapsed to `64px` (icons only) on small screens
- KPI cards have a number, a delta (with up/down arrow), and a tiny sparkline
- Tables use zebra striping, hover states, sticky headers
- Charts are usually Chart.js, Recharts, or Apache ECharts — for the clone, use Chart.js from CDN

**Implementation tips:**
- Build the sidebar nav with `<nav>` + `<a>` tags, use `aria-current="page"` for the active link
- KPI cards: 4-column grid on desktop, 2-column on tablet, 1-column on mobile
- For charts, use a Chart.js line chart with the brand color as the primary series color
- Mock data: hardcode realistic-looking numbers, don't try to wire up real state

## Site type: Blog / content site

**Structure:**
```
<header> Logo, nav, search, subscribe CTA
<main class="container">
  <article class="post">
    <header class="post-header">  Title, author, date, reading time, cover image
    <div class="post-content">    Long-form prose with headings, images, code blocks
    <footer class="post-footer">  Tags, share buttons, author bio
  </article>
  <section class="related">       3-up related posts
</main>
<footer>
```

**Common patterns:**
- Content column is `max-width: 680px` (optimal reading width)
- Body text is `font-size: 18-20px`, `line-height: 1.6-1.7`
- Headings use a different font family (often a serif) than the body
- Code blocks have a dark background even on light themes
- Pull quotes break up long sections

**Implementation tips:**
- Use real prose from `https://loripsum.net/` for placeholder content (it generates semantic Latin-like text)
- For the cover image, use `https://picsum.photos/seed/<post-title>/1200/630`
- Style `pre`/`code` with a mono font token, dark bg, light text, padding
- Make sure headings have `scroll-margin-top: 5rem` so anchored links don't hide under sticky headers

## Site type: Marketing / agency site

**Structure:**
```
<header> Minimal nav
<main>
  <section class="hero">        Big bold headline, often with a video bg
  <section class="manifesto">   Long-form statement of philosophy
  <section class="work">        Case study grid (image + title + tag)
  <section class="services">    Service offerings, often as a numbered list
  <section class="clients">     Client logo wall
  <section class="contact">     Big CTA with email form
<footer>
```

**Common patterns:**
- Typography is huge — hero headlines are often `clamp(3rem, 8vw, 8rem)`
- Lots of whitespace, sections are `padding: 8rem 0`
- Smooth scroll, scroll-triggered animations (Intersection Observer)
- Custom cursor or hover effects on the work grid

**Implementation tips:**
- For scroll animations, use a small Intersection Observer hook that adds `.in-view` class
- Use `clamp()` for fluid typography: `font-size: clamp(2rem, 5vw, 5rem)`
- For the work grid, use CSS Grid with `aspect-ratio: 4/3` on each card
- Implement smooth scroll with `html { scroll-behavior: smooth; }`

## Site type: E-commerce product page

**Structure:**
```
<header> Nav with cart icon
<main class="product">
  <section class="gallery">       Image carousel + thumbnails
  <section class="details">       Title, price, description, variant selector, qty, add-to-cart
  <section class="description">   Tabbed: description / specs / reviews
  <section class="related">       "You may also like" 4-up grid
<footer>
```

**Common patterns:**
- Two-column layout on desktop: gallery left, details right
- Gallery uses a main image + thumbnail strip below or beside
- Price is large, with original (strikethrough) + sale price if discounted
- Variant selector: buttons for color, dropdown for size
- Sticky add-to-cart bar appears on scroll

**Implementation tips:**
- Use `<form>` for the product details — accessible and submission-ready
- Gallery: main image is `aspect-ratio: 1/1`, thumbnails are `60x60`
- For placeholder product images, use `https://picsum.photos/seed/<product>/800/800`
- Add-to-cart should be a real button that triggers a `cart` state in JS (don't actually persist)

## Verification checklist

After building the clone:

1. **Open both side by side.** Use `agent-browser` to open the clone, screenshot it, and compare with the original screenshot from Phase 1.
2. **Check breakpoints.** Resize the browser across each breakpoint in `design-tokens.json` and verify the layout adapts similarly.
3. **Check the type scale.** Compare heading sizes — `h1` should match within ~10%.
4. **Check the color palette.** The brand color and background should match. Text contrast should be similar.
5. **Check spacing.** Sections should breathe the same way. If the original has `padding: 6rem 0` per section, yours should too.
6. **Check hover/focus states.** Often forgotten but very visible. Links should underline on hover, buttons should darken slightly.
7. **Check accessibility.** Run Lighthouse or axe-core. The clone should score 90+ on accessibility (the original may not, but you can do better).

## Common pitfalls

- **Cloning the JS bundle.** Don't. Reverse-engineer the *interaction* in plain JS. The goal is to learn how the site works, not to redistribute their minified React.
- **Cloning the images.** Don't ship the original's images. Use `picsum.photos` or generate your own with the `image-generation` skill.
- **Pixel-perfect obsession.** Aim for "same vibe." If the original has a subtle 1px border that you can't quite get right, that's fine — pick a close color and move on.
- **Forgetting mobile.** The original probably has a mobile nav (hamburger menu). Implement it. The screenshot from `--devices "iphone-14"` is your reference.
- **Skipping the dark mode.** If the original supports dark mode (check the screenshot with `--dark`), the clone should too. Use `prefers-color-scheme` media query with the inverted tokens.
