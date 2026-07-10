## ✅ Proof

This isn't a toy demo. Both artifacts below came from running this skill's full pipeline — screenshot → scrape → stack analysis → design tokens — against a live, unfamiliar production site: [moltbook.com](https://moltbook.com), a Reddit-style social network built for AI agents. No manual cleanup of the extracted data, no cherry-picked output.

### The scans

| Artifact | Model | Scope |
|---|---|---|
| [`proofs/Moltbook_Design_Architecture_Report_GLM-5.pdf`](proofs/Moltbook_Design_Architecture_Report_GLM-5.pdf) | GLM 5 | 10-section report: tech stack, color/type/spacing tokens, layout grid, component vocabulary, animation & motion, z-index layering, information architecture |
| [`proofs/Minimax_M3_Moltbook.md`](proofs/Minimax_M3_Moltbook.md) | MiniMax M3 | Independent scan of the same target — goes further into page-composition trees, working HTML for the clickable-card pattern, and a "what NOT to copy" IP-boundary section |
| [`proofs/minimax-m3-security_and_feature.md`](proofs/minimax-m3-security_and_feature.md) | MiniMax M3 | Independent scan of the same target — goes deepdive into security and architecture analysis
| [`proofs/agentbook_audit.md`](proofs/agentbook_audit.md) | Deepseek v4 flash  | Audit conducted on my vibe coding platform

### What the raw scrape output let both models correctly identify — independently (Minimax and GLM 5)

- **Framework:** Next.js App Router + Turbopack, detected from `/_next/static/` asset paths, the `next-size-adjust` meta tag, and the `/_next/image?url=...&w=...&q=` optimization signature (both reports: 0.90–0.95 confidence)
- **CSS approach:** Tailwind CSS via arbitrary-value syntax (`bg-[#1a1a1b]`, `text-[#e01b24]`) — no CSS Modules or CSS-in-JS hashes present
- **Font system:** IBM Plex Mono as the sole body font, loaded via `next/font`, with 4 preloaded `.woff2` weights
- **Brand palette:** both independently landed on the same three anchor colors — dark background `#1a1a1b`, brand red `#e01b24`, accent teal `#00d4aa` — despite scanning the site at different moments (moltbook's live counters mean exact byte-for-byte DOM state differs run to run)
- **Layout pattern:** dark sticky header with a 4px colored bottom border, transitioning to a light card-based feed — both reports named this independently
- **Component-level detail:** the nested clickable-card technique (`<a class="absolute inset-0 z-0">` wrapping the row, with `relative z-10` on inner links) was reconstructed as literal, working markup — not a vague description

### Why two independent models agreeing matters (Minimax and GLM 5)

Any single AI-generated report could be a fluent-sounding hallucination. Two different models, run separately, converging on the same framework ID, the same three brand colors, the same layout grammar, and the same component markup is a much stronger signal that the *scrape output itself* — the actual `dom.html`, `styles.css`, `colors.json` this skill produces — is accurate. The models aren't inventing a story; they're both reading the same real extracted data and reporting it consistently.

### Known limitation (documented, not hidden)

Exact frequency counts differ between the two reports (e.g. teal color occurrence counts, exact agent/post stats) — expected, since moltbook.com's stats and content update live between scans. Treat qualitative findings (stack, palette, layout, component patterns) as reliable; treat raw counts as a snapshot of that specific scan, not a fixed constant. Always cross-check exact hex/spacing values against your own generated `colors.json` / `design-tokens.json` before hardcoding them downstream.
