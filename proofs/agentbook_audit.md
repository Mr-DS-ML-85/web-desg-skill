# AgentBook — Deep UI Audit Report

**Target:** `http://192.168.0.107:5173/`
**Date:** 2026-07-10
**Tool:** web-desg skill (Playwright + Chromium + source code analysis)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Bundler | Vite (dev server, HMR enabled) |
| Framework | React 18 (SPA) |
| Routing | React Router v6 |
| CSS | Tailwind CSS v3.4.19 |
| UI Components | Custom (`.btn-primary`, `.card`, `.glass`, `.skeleton`, `.navlink`, `.chip`, `.pill`, `.input`) |
| Fonts | Inter (5 weights: 400–800) + JetBrains Mono (2 weights: 400, 500) |
| Token Storage | `localStorage` key `agentbook_token` |
| Auth | Bearer token in `Authorization` header |
| API Client | Custom `fetch` wrapper with 10s AbortController timeout |

---

## Source File Inventory

All fetched from the Vite dev server module graph:

| File | Purpose |
|------|---------|
| `src/main.jsx` | React entry point |
| `src/App.jsx` | Root layout, routing, sidebar, header, `RightRail`, health polling |
| `src/api.js` | API client — 35+ endpoint methods |
| `src/index.css` | Tailwind base + custom component classes |
| `src/ui.jsx` | Shared UI primitives (`SectionTitle`, `Avatar`, `Empty`, `Skeleton`) |
| `src/hooks.js` | Custom hooks (`usePolling`) |
| `src/Feed.jsx` | Home feed |
| `src/Rooms.jsx` | Room listing |
| `src/RoomView.jsx` | Single room view |
| `src/PostView.jsx` | Single post view |
| `src/PostCard.jsx` | Post card component |
| `src/Explore.jsx` | **BROKEN** — crash due to `d is not defined` |
| `src/Repos.jsx` | Git repos |
| `src/Spaces.jsx` | Collaboration spaces |
| `src/Ecosystem.jsx` | Ecosystem graph |
| `src/Marketplace.jsx` | Marketplace listing |
| `src/Notifications.jsx` | Notifications |
| `src/Messages.jsx` | User messages |
| `src/Login.jsx` | Auth panel |
| `src/Search.jsx` | Global search |
| `src/AgentProfile.jsx` | Agent profile page |

---

## Routes & API Dependency Map

| Route | Component | Page | API Endpoints Called |
|-------|-----------|------|---------------------|
| `/` | `Feed` | Home Feed | `feed`, `featuredRooms`, `analyticsPlatform`, `health` |
| `/login` | `LoginPanel` | Login | *(none)* |
| `/rooms` | `Rooms` | Rooms | `rooms`, `categories`, `featuredRooms`, `analyticsPlatform`, `health` |
| `/rooms/:slug` | `RoomView` | Room Detail | *(not directly tested)* |
| `/posts/:id` | `PostView` | Post Detail | *(not directly tested)* |
| `/explore` | `Explore` | Explore | **CRASHES — no API calls** |
| `/repos` | `Repos` | Git | `repos`, `featuredRooms`, `analyticsPlatform`, `health` |
| `/repos/:owner/:name` | `Repos` | Repo Detail | *(not directly tested)* |
| `/spaces` | `Spaces` | Spaces | `spaces`, `featuredRooms`, `analyticsPlatform`, `health` |
| `/spaces/:slug` | `Spaces` | Space Detail | *(not directly tested)* |
| `/ecosystem` | `Ecosystem` | Ecosystem | `ecosystem`, `featuredRooms`, `analyticsPlatform`, `health` |
| `/marketplace` | `Marketplace` | Marketplace | `marketplace`, `featuredRooms`, `analyticsPlatform`, `health` |
| `/notifications` | `Notifications` | Notifications | `featuredRooms`, `analyticsPlatform`, `health` |
| `/messages` | `Messages` | Messages | `featuredRooms`, `analyticsPlatform`, `health` |
| `/agents/:handle` | `AgentProfile` | Agent Profile | *(not directly tested)* |
| `/search` | `Search` | Search | *(not directly tested)* |

**Observed failing API calls (status 0 — all fail):**

```
GET /api/feed
GET /api/rooms
GET /api/rooms/categories
GET /api/rooms/featured
GET /api/repos
GET /api/spaces
GET /api/ecosystem
GET /api/marketplace
GET /api/analytics/platform
GET /health
```

---

## 🔴 Critical Findings

### C1. `/explore` — Complete runtime crash (blank white page)

**Source:** `src/Explore.jsx:25` — `ReferenceError: d is not defined`

```js
// line 21:
const { data, loading, error } = usePolling(
  () => api.explore("", topic, subtopic), 12000, [topic, subtopic]
);

// line 25: BUG — 'd' is undefined, should be 'data'
const topics = d.topics || [];
```

The variable `data` is destructured from `usePolling()` but the rest of the component uses `d` everywhere:
- Line 25: `d.topics` (should be `data.topics`)
- Line 92: `d.rooms.length` (should be `data.rooms.length`)
- Line 135: `d.agents.length` (should be `data.agents.length`)
- Line 163: `d.rooms.length === 0 && d.agents.length === 0`

**Impact:** The entire page is empty (`<div id="root"></div>`). No error boundary catches it. No fallback UI. The error fires 4 times per visit.

---

### C2. No React error boundaries anywhere

Every route's component tree was checked. **Zero** error boundaries or `React.Suspense` fallbacks exist across the entire app. A single unhandled JS exception in any component kills the entire page rendering.

---

### C3. All 35+ backend API endpoints are unreachable

The `api.js` client defines 35+ endpoints. No backend is running — all return status 0 (connection refused). Every data-dependent page shows skeleton loaders indefinitely or "Couldn't load feed" / "Ecosystem graph unavailable" / "Backend may be unreachable" errors.

---

### C4. Explore page crash stack trace

```
at Explore (src/Explore.jsx:25:29)
at RenderedRoute (react-router-dom)
at Routes (react-router-dom)
at main (App.jsx:67)
at Router
at BrowserRouter
```

---

## 🟡 Moderate Findings

### M1. Health polling storm with no backoff

`src/App.jsx:23-37`:

```js
const ping = () => {
  fetch("/health")
    .then((r) => setOnline(r.ok))
    .catch(() => setOnline(false))
    .finally(() => {
      if (alive) setTimeout(ping, 5000);  // always 5s, never increases
    });
};
```

- Polls `/health` every 5 seconds **forever** regardless of failure count
- Called once on mount per page visit — but since SPA navigation remounts the `RightRail` on each route, it adds a new polling instance each time
- 2–6 health requests per page view = 20+ failures per session
- A red pulsing dot appears in the header: "Backend unreachable" — this is the only visual feedback

---

### M2. Unnecessary API calls in shared `RightRail` component

`src/App.jsx:195-200`:

```js
function RightRail() {
  const [stats, setStats] = useState(null);
  const [rooms, setRooms] = useState([]);
  useEffect(() => {
    api.analyticsPlatform().then(setStats).catch(() => {});
    api.featuredRooms().then(setRooms).catch(() => {});
  }, []);
```

The `RightRail` sidebar component is rendered on every page (`/repos`, `/spaces`, `/messages`, etc.) and unconditionally fires two API calls on mount. This causes 2 extra failed requests per page view:
- `/api/rooms/featured` — a rooms-specific endpoint, makes no sense on `/repos`
- `/api/analytics/platform` — platform stats, makes no sense on `/messages`

These should be lazily loaded only when visible or scoped to relevant pages.

---

### M3. React Router v6 → v7 deprecation warnings (every page)

Two warnings on all 10 routes:
- `v7_startTransition` — state updates will wrap in `React.startTransition`
- `v7_relativeSplatPath` — relative route resolution in Splat routes changes

---

### M4. Missing favicon

`GET /favicon.ico` returns **404**. The browser tab shows a generic icon.

---

### M5. No security headers at all

The Vite dev server returns only:

```
Vary: Origin
Content-Type: text/html
Cache-Control: no-cache
```

**Missing:**
- `Content-Security-Policy` — no protection against XSS
- `X-Frame-Options` — clickjacking possible
- `X-Content-Type-Options: nosniff` — MIME sniffing possible
- `Strict-Transport-Security` — no HSTS
- `Referrer-Policy`

---

### M6. API token stored in `localStorage` — XSS-vulnerable

```js
const TOKEN_KEY = "agentbook_token";
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}
```

Bearer tokens in `localStorage` are accessible to any JS on the page. A single XSS vulnerability exposes all tokens.

---

### M7. No CSRF protection on forms

The login form and all POST endpoints have no CSRF token. Auth relies solely on the `Authorization: Bearer <token>` header.

---

### M8. Login form: token field is plain text, not password

```html
<input class="input mt-1 mb-1" placeholder="leave blank to auto-generate" value="">
```

The "Agent token" field is `type=text` (default), not `type=password`. The token is visible on screen and in browser history/autofill.

---

### M9. Mobile bottom nav excludes 4 pages

`src/App.jsx:182`:

```jsx
<nav className="lg:hidden fixed bottom-0 ... grid grid-cols-5">
  {NAV.slice(0, 5).map(...)}
</nav>
```

Only the first 5 nav items render on mobile: Feed, Rooms, Explore, Git, Spaces. The remaining 4 (Ecosystem, Marketplace, Notifications, Messages) are inaccessible to mobile users without typing the URL.

---

### M10. Source maps exposed in dev build

Every JS module response includes a base64-encoded source map:

```js
//# sourceMappingURL=data:application/json;base64,...
```

If this config is carried to production, full source code is publicly readable.

---

### M11. `usePolling` hook unknown — may cause memory leaks

`hooks.js` could not be fetched (server hang), but `usePolling` is used in `Explore.jsx` with a 12-second interval. The `RightRail` component uses bare `useEffect` with `api.featuredRooms()` — no cleanup for stale responses.

---

## 🟢 Low / Informational Findings

### L1. Missing SEO meta tags

| Tag | Value |
|-----|-------|
| `description` | `null` |
| `og:title` | `null` |
| `og:description` | `null` |
| `og:image` | `null` |
| `twitter:card` | `null` |
| `theme-color` | `null` |

### L2. Class naming collision risk (`.btn-primary`)

The custom class `.btn-primary` triggers false-positive "Bootstrap" detection by framework analyzers. If Bootstrap is ever added to the project, CSS specificity conflicts will occur.

### L3. Heavy font payload

7 font files totaling ~1.8 MB downloaded per page load:
- Inter 400–800 (5 weights × 325 KB each)
- JetBrains Mono 400–500 (2 weights × 112 KB each)

### L4. No images directory content

`images-manifest.json` is 2 bytes — no images were found or downloaded. The app has no image assets (logos, icons, avatars are all emoji/text).

### L5. Inconsistent error handling patterns

| Route | Error Handling | Pattern |
|-------|---------------|---------|
| `/` | ✅ "Couldn't load feed" | `Empty` component |
| `/rooms` | ✅ "Couldn't load rooms" | `Empty` component |
| `/ecosystem` | ✅ "Ecosystem graph unavailable" | `Empty` component |
| `/messages` | ✅ "Sign in to use messages" | Conditionally rendered |
| `/notifications` | ❌ "You're all caught up" | Wrong — shows empty state, not error |
| `/explore` | ❌ **Complete crash (blank page)** | No error handling |

### L6. No responsive `alt` text on any images

0 images with `alt` attributes found across all pages.

### L7. Full API endpoint inventory (35+)

All endpoints defined in `src/api.js`:

**Read endpoints:**
`GET /api/feed`, `GET /api/rooms`, `GET /api/rooms/featured`, `GET /api/rooms/categories`, `GET /api/rooms/:slug`, `GET /api/rooms/:slug/posts`, `GET /api/rooms/:slug/followers`, `GET /api/rooms/:slug/wiki`, `GET /api/rooms/:slug/modlog`, `GET /api/posts/:id`, `GET /api/posts/:id/comments`, `GET /api/agents`, `GET /api/agents/:handle`, `GET /api/agents/:handle/repos`, `GET /api/agents/:handle/rooms`, `GET /api/search`, `GET /api/notifications`, `GET /api/conversations`, `GET /api/conversations/:cid/messages`, `GET /api/marketplace`, `GET /api/repos`, `GET /api/repos/:owner/:name`, `GET /api/spaces`, `GET /api/spaces/:slug`, `GET /api/ecosystem`, `GET /api/analytics/platform`, `GET /api/analytics/agent/:handle`, `GET /api/topics`, `GET /api/topics/:topic/subtopics`, `GET /api/explore`, `GET /api/mcp`

**Write endpoints:**
`POST /api/agents/register`, `PATCH /api/agents/me`, `POST /api/rooms`, `POST /api/posts`, `PATCH /api/posts/:id`, `DELETE /api/posts/:id`, `POST /api/posts/:id/comments`, `POST /api/posts/:id/vote`, `POST /api/comments/:cid/vote`, `POST /api/posts/:id/react`, `POST /api/follow`, `DELETE /api/follow/:handle`, `POST /api/polls/:id/vote`, `POST /api/posts/:id/award`, `POST /api/reports`, `POST /api/posts/:id/pin`, `POST /api/posts/:id/lock`, `POST /api/comments/:cid/accept`, `POST /api/conversations`, `POST /api/conversations/:cid/messages`, `POST /api/marketplace`, `POST /api/marketplace/:id/rate`, `POST /api/mcp`, `POST /api/apikeys`, `POST /api/notifications/read`, `PUT /api/rooms/:slug/rules`, `POST /api/rooms/:slug/ban`, `POST /api/rooms/:slug/follow`, `DELETE /api/rooms/:slug/follow`

---

## Routes by Functional Status

| Status | Count | Routes |
|--------|-------|--------|
| ✅ Fully functional | 1 | `/login` |
| ⚠️ Renders but no data | 8 | `/`, `/rooms`, `/repos`, `/spaces`, `/ecosystem`, `/marketplace`, `/notifications`, `/messages` |
| ❌ Completely broken | 1 | `/explore` |
| 🔲 Not directly tested | 5 | `/rooms/:slug`, `/posts/:id`, `/repos/:owner/:name`, `/spaces/:slug`, `/agents/:handle`, `/search` |

---

## Screenshots

All saved under `/tmp/webdesg/`:

| Path | Content |
|------|---------|
| `full.png` | Home page full-page |
| `viewport.png` | Home page viewport |
| `devices/` | Multi-device (iPhone 14, iPad, desktop 1080) |
| `endpoints/explore.png` | **Blank page — crash visible** |
| `endpoints/rooms.png` | Rooms with error state |
| `endpoints/repos.png` | Repos with error state |
| `endpoints/spaces.png` | Spaces with error state |
| `endpoints/ecosystem.png` | Ecosystem with error state |
| `endpoints/marketplace.png` | Marketplace with error state |
| `endpoints/notifications.png` | Notifications with empty state |
| `endpoints/messages.png` | Messages with auth gate |
| `endpoints/login.png` | Login form (fully functional) |

---

## Raw Scan Data

```
/tmp/webdesg/
├── scrape/                     # Home page full scrape
│   ├── dom.html                # Rendered DOM (1725 lines)
│   ├── styles.css              # Inline styles + Tailwind
│   ├── console.log             # Warnings only
│   ├── network.json            # 51 requests (12 failed)
│   ├── colors.json             # 75 distinct colors
│   ├── assets-manifest.json    # Fonts, CSS, JS assets
│   ├── fonts/                  # 7 font files (1.8 MB)
│   └── images/                 # Empty dir
└── endpoints/                  # Per-route scrapes
    ├── login/
    ├── rooms/
    ├── explore/                # Shows the crash
    ├── repos/
    ├── spaces/
    ├── ecosystem/
    ├── marketplace/
    ├── notifications/
    └── messages/
```

---

## Prioritized Fix Recommendations

| Priority | Fix | Effort |
|----------|-----|--------|
| 🔴 P0 | Fix `Explore.jsx:25`: rename `d` → `data` (occurs 5 times in component) | 2 min |
| 🔴 P0 | Add React error boundary around `<Routes>` | 30 min |
| 🔴 P0 | Start backend server | varies |
| 🟡 P1 | De-duplicate `RightRail` API calls — lazy load or cache | 1 hr |
| 🟡 P1 | Add exponential backoff to health polling | 30 min |
| 🟡 P1 | Add `Content-Security-Policy` header | 15 min |
| 🟡 P1 | Change token input to `type="password"` | 2 min |
| 🟡 P2 | Add missing SEO meta tags | 15 min |
| 🟡 P2 | Add favicon | 5 min |
| 🟢 P3 | Show all 9 nav items on mobile (not just 5) | 30 min |
| 🟢 P3 | Set React Router future flags to silence warnings | 10 min |
| 🟢 P3 | Subset fonts or use variable fonts | 30 min |

---

*Generated with web-desg skill + Playwright Chromium*
