# Ethics & Legal Guidance for Website Cloning

Cloning a website's *design patterns* for learning, prototyping, and inspiration is generally acceptable and is how the web design field has always evolved. Cloning a website's *proprietary content, trademarks, or copyrighted assets* and shipping them as your own is not. This guide helps you tell the difference.

## The short version

**OK:**
- Studying how a site is built and applying the same patterns to your own project
- Extracting a color palette, type scale, or spacing system from a site and adapting it
- Building a "in the style of [Site X]" clone for a portfolio piece, clearly labeled as inspired-by
- Reverse-engineering a UI interaction to learn the technique
- Taking a full-page screenshot for design reference

**Not OK:**
- Copying a site's logo, brand name, or trademarked imagery
- Reproducing copyrighted marketing copy verbatim
- Scraping and redistributing a site's content (articles, product data, user data)
- Cloning a site to deceive users into thinking your site IS the original (phishing)
- Bypassing paywalls, login walls, or anti-scraping measures
- Violating a site's Terms of Service

When in doubt, ask the user. If they're unsure, advise them to consult a lawyer for commercial projects.

## What is protected vs. not

### Not protected (free to learn from and adapt)

- **Layout patterns** — sticky nav, hero section, feature card grid, etc. These are functional patterns, not creative expression.
- **Color palettes** — Colors and color combinations are generally not copyrightable. (Specific combinations associated with a brand *can* be trademarked in limited contexts, e.g. UPS brown.)
- **Type scale and spacing systems** — Mathematical relationships between font sizes are functional.
- **CSS techniques** — How to implement a sticky header, a flexbox layout, a CSS gradient. These are techniques, not expressions.
- **Interaction patterns** — Hover states, modal dialogs, accordion expansions. Functional.
- **Information architecture** — How content is organized (top nav items, footer structure). Functional.

### Protected (do not copy verbatim)

- **Logos and brand marks** — Trademarked. Use placeholders in clones.
- **Marketing copy** — Copyrighted. Use `Lorem ipsum` or write your own.
- **Product names and taglines** — Trademarked. Use `[Product Name]`.
- **Photographs and illustrations** — Copyrighted. Use `picsum.photos` or generate your own.
- **Custom iconography** — Often trademarked or copyrighted. Use open icon sets (Lucide, Heroicons, Tabler).
- **Article content / blog posts** — Copyrighted. Don't scrape and republish.
- **Source code (JS bundles)** — Often licensed (MIT, Apache, proprietary). Don't redistribute minified bundles.

### Gray area (depends on context)

- **Distinctive visual combinations** — If a site has a very specific combination of layout + colors + typography + imagery that is strongly associated with their brand (e.g. Apple's product pages), cloning it too closely can risk "trade dress" claims even without copying any single asset. Add your own spin.
- **Custom illustrations / hero artwork** — Even if you redraw them in a similar style, you're in murky territory. Generate your own with `image-generation`.
- **Animations and micro-interactions** — The specific code is copyrighted, but the *idea* of e.g. "card lifts on hover with a shadow" is not. Reimplement, don't copy.

## Checking robots.txt and Terms of Service

Before scraping a site, check:

1. **`https://example.com/robots.txt`** — Tells crawlers what they can and can't access. If a path is `Disallow: /`, don't scrape. If it allows `/` but disallows `/admin/`, scrape only the public pages. Note: `robots.txt` is a voluntary standard, not a legal contract, but respecting it is good citizenship and reduces legal risk.

2. **Terms of Service** — Look for a "Terms of Service" or "Terms of Use" link in the footer. Some sites explicitly prohibit scraping in their ToS. Violating ToS can be a breach of contract claim even when the underlying activity is otherwise legal. If the ToS prohibits scraping, ask the user whether they have permission or want to proceed at their own risk.

3. **`<meta name="robots">` tags** — Per-page directives. `noindex` means don't index in search, `nofollow` means don't follow links. Not directly about scraping, but a signal of intent.

4. **Rate limiting** — Even if a site allows scraping, don't hammer it. The scraper makes ~1 request per page plus asset downloads. If you're scraping many pages, add delays (`--delay 5000`).

## Fair use and learning

In many jurisdictions (including the US), there's a "fair use" doctrine that allows limited use of copyrighted material for purposes like criticism, comment, teaching, scholarship, and research. Cloning a site's design for personal learning is more likely to be fair use than cloning it for commercial use.

Factors that weigh toward fair use:
- **Purpose**: educational, non-commercial, transformative (you're learning, not redistributing)
- **Nature**: factual/functional elements (layout, spacing) get less protection than creative ones (custom illustrations)
- **Amount**: you're extracting patterns, not the whole creative work
- **Effect**: your clone doesn't substitute for the original in the market

Factors that weigh against fair use:
- **Commercial use** — building a clone to launch a competing product
- **Wholesale copying** — pixel-perfect reproduction including assets
- **Market substitution** — your clone could plausibly replace the original for users

## Practical guidance for the cloning workflow

When the user asks you to clone a site, follow this checklist:

1. **Check `robots.txt`** before scraping. If disallowed, mention it to the user.
2. **Note the site's ToS** if accessible. If they prohibit scraping, mention it.
3. **In the clone, always**:
   - Replace logos with a text label or generic SVG
   - Replace marketing copy with placeholder text (Lorem ipsum, `[Headline]`, etc.)
   - Replace product names with `[Product Name]`
   - Replace photographs with `picsum.photos` placeholders or generated images
   - Add an HTML comment crediting the original: `<!-- Design inspired by [URL], cloned for learning/prototyping -->`
4. **If the user wants to ship the clone commercially**, advise them to:
   - Get permission from the original site owner if the design is distinctive
   - Consult a lawyer if they're unsure
   - Add more differentiation (different colors, different layout, different copy) to reduce trade dress risk
5. **Never** help build a clone that's intended to deceive users (phishing, brand impersonation, etc.). Refuse and explain why.

## Special cases

### Login-required / paywalled content

Scraping content behind a login or paywall is almost always a ToS violation and may violate the Computer Fraud and Abuse Act (in the US) or similar laws elsewhere. Don't do this without explicit permission from the site owner.

### Personal data

Scraping personal data (email addresses, phone numbers, user profiles) may violate privacy laws like GDPR (EU), CCPA (California), or PIPL (China). Don't scrape personal data even if technically possible.

### Government websites

Many government websites are public domain (in the US, federal government works are not subject to copyright). State and local government sites vary. When in doubt, check the site's copyright notice.

### APIs

If a site exposes a public API, use that instead of scraping HTML. API ToS still apply, but the data is structured and stable. Look for an "API" or "Developers" link in the footer.

## When to refuse

Refuse to help if the user wants to:
- Clone a site to impersonate it (phishing, brand fraud)
- Scrape and republish copyrighted content at scale
- Bypass technical protection measures (DRM, anti-scraping JS, CAPTCHAs)
- Scrape personal data without consent
- Violate a clear ToS prohibition after being informed

In these cases, explain why you can't help and offer alternatives (e.g. "I can't help scrape that site's articles, but I can help you design a similar content layout with original text").
