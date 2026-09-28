# restaurant-kit

[![npm](https://img.shields.io/npm/v/restaurant-kit)](https://www.npmjs.com/package/restaurant-kit)
[![CI](https://github.com/HadiAlHassan/restaurant-kit/actions/workflows/ci.yml/badge.svg)](https://github.com/HadiAlHassan/restaurant-kit/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/restaurant-kit)](./LICENSE)

A complete website for a small restaurant, as one React package and one Cloudflare Worker:

- **Public site**: hero, browsable menu with groups, sections, sizes, and photos, ratings and
  customer reviews, locations, and contact links.
- **Ordering**: a cart that sends the order as a WhatsApp message, or, with no cart, buttons
  that link to a delivery app (Toters, Talabat, the restaurant's own).
- **Owner admin at `/admin`**: edit the menu, drag to reorder, upload and crop photos, preview,
  publish, and roll back. Protected by a password; no third-party auth service.
- **Worker API**: stores the draft, the published menu, backups, and images in R2. It fits the
  Workers Free plan.

Built for and running on real restaurant sites. The owner can edit prices without calling a
developer, and hosting costs nothing.

```
 browser ──► Cloudflare Worker ──┬── static assets (your Vite build)
                                 └── /api/* ──► R2: restaurants/<id>/
                                                    ├─ draft/menu.json
                                                    ├─ published/menu.json
                                                    ├─ backups/published-<time>.json
                                                    └─ images/menu/*
```

## Install

```bash
npm install restaurant-kit react react-dom react-router-dom
```

Peer dependencies: `react@^19.1`, `react-dom@^19.1`, `react-router-dom@^7.18`. Node 20+.

## Quick start

```tsx
// src/main.tsx
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { RestaurantSite, type DynamicMenu, type RestaurantSiteConfig } from "restaurant-kit";
import "restaurant-kit/styles.css";

const config: RestaurantSiteConfig = {
  restaurantId: "demo", // must match the Worker's RESTAURANT_ID
  brandName: "Demo Grill",
  tagline: "Savor The Flavor",
  locationLabel: "Demo City",
  address: "1 Demo Street",
  mapsUrl: "https://maps.google.com/?q=Demo+Grill",
  phoneDisplay: "+1 555 000 0000",
  phoneHref: "tel:+15550000000",
  whatsappNumber: "15550000000",
  orderGreeting: "Hi Demo Grill, I'd like to order:",
  instagramHandle: "@demogrill",
  instagramUrl: "https://www.instagram.com/demogrill/",
  logoSrc: "/logo.jpg",
  rating: "4.7",
  ratingLabel: "4.7 out of 5 stars",
  reviewCount: "320 reviews",
  cuisineSummary: "Burgers & wraps",
  localBadge: "Local favorite",
  highlights: ["Burgers", "Wraps", "Sides"],
  heroEyebrow: "Demo City / 1 Demo Street",
  heroSubline: "Delicious taste with every bite.",
  ratingHeadline: "Trusted for flavor.",
  ratingCopy: "Average rating from customers across Google reviews.",
  footerNote: "Demo City · 1 Demo Street",
};

// Shown until the owner publishes from /admin, and used as the local-dev menu.
const seedMenu: DynamicMenu = {
  schemaVersion: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  restaurant: { id: "demo", name: "Demo Grill", tagline: "Savor The Flavor", phone: "+1 555 000 0000", whatsapp: "15550000000", address: "1 Demo Street" },
  groups: [{ id: "mains", label: "Mains", icon: "burger", order: 0, isVisible: true }],
  categories: [{ id: "burgers", groupId: "mains", title: "Burgers", order: 0, isVisible: true }],
  items: [
    {
      id: "classic", categoryId: "burgers", title: "Classic Burger", description: "Beef, cheddar, pickles.",
      image: "/menu/classic.jpg", order: 0, isVisible: true, pricingMode: "single", price: "8", sizes: [],
    },
  ],
};

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <RestaurantSite
      config={config}
      seedMenu={seedMenu}
      api={{ baseUrl: import.meta.env.VITE_MENU_API_BASE_URL, publicMenuUrl: import.meta.env.VITE_MENU_API_URL }}
    />
  </BrowserRouter>,
);
```

```ts
// worker/index.ts
export { default } from "restaurant-kit/worker";
```

Run `vite` and open `/admin`. On `localhost` the kit uses a browser-local API that stores
drafts in `localStorage`, so you can try the whole editor before you deploy anything. To go
live, follow [Deploy as one Worker](#deploy-as-one-worker-recommended).

`RestaurantSite` mounts the toaster and these routes: `/` (public site),
`/admin` (menu editor), `/admin/preview`, and a catch-all redirect to `/`.
Bring your own `BrowserRouter` so the kit can live inside a larger app. The admin routes are
lazy-loaded: customers get about 110 kB of gzipped JS, and the editor's chunk is fetched only
when someone opens `/admin`.

### Validating seed data

At runtime the kit tolerates orphans: it keeps a category whose group was deleted and hides
an item whose category is gone. To catch those mistakes early, check the seed menu in a test
or build step:

```ts
import { assertValidMenu, validateMenu } from "restaurant-kit";

assertValidMenu(seedMenu); // throws, listing every issue (duplicate ids, orphan references, bad icons, …)
validateMenu(seedMenu);    // or get the issues as [{ path, message }]
```

### Composing your own routes

```tsx
import { RestaurantKitProvider, MenuSite, AdminMenuEditor } from "restaurant-kit";

<RestaurantKitProvider config={config} seedMenu={seedMenu}>
  <Routes>
    <Route path="/" element={<MenuSite />} />
    <Route path="/owner" element={<AdminMenuEditor />} />
  </Routes>
</RestaurantKitProvider>
```

Individual sections (`Header`, `Hero`, `Marquee`, `MenuBrowser`, `RatingSection`,
`TestimonialsSection`, `LocationsSection`, `Footer`) are exported if you want a custom page layout.

When consuming the kit through `file:` or `npm link`, dedupe React so the linked package
doesn't bring its own copy:

```ts
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ["react", "react-dom", "react-router-dom"] },
});
```

## Configuration

`RestaurantSiteConfig` — every field is required except `ordering`:

| Field | Purpose |
| --- | --- |
| `restaurantId` | Namespaces the local draft key (`<id>:menu-draft:v1`); must match the worker's `RESTAURANT_ID` |
| `brandName`, `tagline`, `cuisineSummary`, `localBadge` | Branding copy |
| `locationLabel`, `address`, `mapsUrl` | Locations section |
| `phoneDisplay`, `phoneHref` | Call button |
| `whatsappNumber`, `orderGreeting` | WhatsApp order link (number in international form, no `+`). Set `whatsappNumber: ""` to hide every WhatsApp link |
| `instagramHandle`, `instagramUrl` | Social links |
| `logoSrc` | Header/footer logo URL |
| `rating`, `ratingLabel`, `reviewCount` | Rating badge |
| `highlights` | Marquee strip entries |
| `heroEyebrow`, `heroSubline` | Hero copy |
| `ratingHeadline`, `ratingCopy` | Rating section copy |
| `footerNote` | Footer line under the address |
| `footer` | Optional. `legal` replaces the "© {year} brand. All rights reserved." line (`{year}` is filled in); `notices` adds extra lines, each a list of strings and `{ label, href }` links |
| `ordering` | Optional. How customers order — see [Ordering modes](#ordering-modes) |

### Testimonials

An optional section of owner-curated customer reviews (typically copied from Google Maps, with
the photo the customer posted). It is **data, not config**: reviews live in the menu JSON as
`testimonials`, so they ride the same draft → publish → backup flow as the menu, and the owner
manages them under **Reviews** in `/admin` (add, edit, star rating, photo upload, link to the
original review, show/hide, reorder). Photos are downscaled to 1400px JPEG in the browser
before upload.

`MenuSite` has one "what customers say" slot. With no visible testimonial it shows the plain
`<RatingSection />` exactly as before; once a testimonial is visible and has text,
`<TestimonialsSection />` takes the slot (and the `#restaurant` anchor) and folds the score —
`rating`, `reviewCount`, `ratingCopy` — into its header above a carousel of review cards. Copy is optional config:

```ts
testimonialsEyebrow: "Straight from Google Maps",          // small label above; omitted by default
testimonialsHeadline: "Our customers' cameras don't lie.", // default
```

There is no Google Places integration on purpose: the API needs a billed key, returns at most
five reviews, and its terms forbid storing them. Only add reviews that are already public, and
keep the link back to the original.

### Ordering modes

Not every restaurant takes orders over WhatsApp. `ordering` switches the whole cart feature:

```ts
// Default (omit the field): cart + "Add to cart" everywhere, order sent as a WhatsApp message.
ordering: { mode: "whatsapp" }

// Cart off. Browse-only menu; every order button opens the delivery app / site instead.
ordering: { mode: "external", url: "https://example.com/order", label: "Order on Toters", shortLabel: "Order", iconSrc: "/assets/brand/toters-mark.svg" }
```

| | `whatsapp` | `external` |
| --- | --- | --- |
| Header pill, hero button | `wa.me/<whatsappNumber>` | `url`, labelled `shortLabel` / `label` |
| Menu cards and rows | "Add to cart" + quantity stepper | no cart controls; tap opens a detail sheet |
| Item sheet | sizes, remove ingredients, note, add to cart | photo, description, sizes and prices, one `label` button to `url` |
| Cart drawer + floating cart button | mounted | not rendered |

The external buttons take the app's brand from two tokens (default: your primary color) and show
`iconSrc` inside the button, or an arrow when it is omitted:

```css
:root {
  --restaurant-order-bg: #00b393;   /* Toters green */
  --restaurant-order-text: #ffffff;
}
```

In `external` mode `orderGreeting` is unused, and removable ingredients stay in the menu data
(and the admin editor) but are not shown to customers. The contact card keeps its
"Message on WhatsApp" link while `whatsappNumber` is set — a restaurant can order through an
app and still chat on WhatsApp; set it to `""` to drop WhatsApp entirely.

`useOrdering()` returns the resolved `{ cartEnabled, isWhatsApp, href, label, shortLabel }` for
custom layouts. When composing your own page, skip `<MenuCartDrawer />` when `cartEnabled` is false.

### Admin draft across routes

`RestaurantSite` mounts an `AdminDraftProvider` above `/admin` and `/admin/preview`, so the
draft (unsaved edits included) survives navigating between editor and preview, and the
browser warns before a reload with unsaved work. When composing your own routes, wrap both
admin routes in `<AdminDraftProvider>`; `AdminMenuEditor` falls back to a local draft when
no provider is mounted.

All restaurant identity flows through `RestaurantKitProvider`: config, seed menu, the API
client (remote, or the browser-local adapter on `localhost`), and the draft storage key.
Nothing is read from module scope, so two providers on one page cannot bleed into each other.
`useRestaurantKit()`, `useSiteConfig()`, `useSeedMenu()`, `useMenuApi()` read from the
nearest provider and throw outside one.

## Theming

All colors are CSS custom properties on `:root`, prefixed `--restaurant-`. Override any
of them after importing `restaurant-kit/styles.css`. The hero background image has no
default — set it or the hero renders on the flat background color. The kit blurs and dims it
as a backdrop; for a real photo worth showing, relax `--restaurant-hero-filter` (and the
`--restaurant-hero-overlay-*` gradients), and aim it with `--restaurant-hero-position`:

```css
:root {
  --restaurant-hero-image: url("/hero.jpg");
  --restaurant-hero-filter: blur(1px) brightness(0.9); /* default: blur(7px) saturate(0.88) brightness(0.78) */
  --restaurant-hero-position: center 60%;               /* default: center */
  --restaurant-primary: #4c602b;
  --restaurant-accent: #08743a;
}
```

Notable groups: surfaces (`--restaurant-bg`, `--restaurant-surface*`), text
(`--restaurant-text*`, `--restaurant-muted`), brand (`--restaurant-primary*`,
`--restaurant-accent*`, `--restaurant-on-primary` for text on a primary fill — override it when
the primary is a light color), hero overlays (`--restaurant-hero-overlay-*`), state
(`--restaurant-danger*`, `--restaurant-warning-*`), and WhatsApp
(`--restaurant-whatsapp*`).

## Worker

```ts
// worker/src/index.ts
export { default } from "restaurant-kit/worker";
```

### Deploy as one Worker (recommended)

Serve the built site and the API from a single Worker with static assets. There is no
Pages-vs-Worker route precedence to get wrong, `/api/*` is same-origin with `/admin`, and
the whole thing fits the Workers Free plan (static asset requests are not billed as
invocations).

```toml
# wrangler.toml (site root)
name = "demo-restaurant"
main = "worker/src/index.ts"
compatibility_date = "2026-07-02"
workers_dev = false
preview_urls = false

[assets]
directory = "./dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = ["/api/*"]

routes = [
  { pattern = "demo-restaurant.com", custom_domain = true },
  { pattern = "www.demo-restaurant.com", custom_domain = true },
]

[[r2_buckets]]
binding = "MENU_BUCKET"
bucket_name = "demo-restaurant-menu"

[vars]
RESTAURANT_ID = "demo"
ALLOWED_ORIGINS = "http://localhost:5173,https://demo-restaurant.com,https://www.demo-restaurant.com"

# Optional but recommended: throttle password guesses per IP (5 per minute).
[[ratelimits]]
name = "LOGIN_RATE_LIMITER"
namespace_id = "1001"
simple = { limit = 5, period = 60 }
```

Then `vite build && wrangler deploy --env=""`. Secrets are set once, never in the toml:

```bash
npx restaurant-kit-hash-password        # prints the ADMIN_PASSWORD_HASH value
wrangler secret put ADMIN_PASSWORD_HASH
openssl rand -base64 32 | wrangler secret put ADMIN_SESSION_SECRET
```

If your wrangler version rejects `[[ratelimits]]`, the older spelling is
`[[unsafe.bindings]]` with `type = "ratelimit"` and the same fields. Without the binding
login still works, just unthrottled.

### Bindings and vars

| Name | Type | Notes |
| --- | --- | --- |
| `MENU_BUCKET` | R2 bucket | Stores draft/published menu JSON and uploaded images |
| `ASSETS` | assets | Optional. When present, every non-`/api/` request is served from static assets |
| `RESTAURANT_ID` | var | Key prefix in R2 |
| `ALLOWED_ORIGINS` | var | Comma-separated origins for CORS and the CSRF origin check; the first non-staging `https://` origin is the default admin redirect target |
| `ADMIN_PASSWORD_HASH` | secret | Enables the **password** strategy. Output of `restaurant-kit-hash-password` |
| `ADMIN_SESSION_SECRET` | secret | HMAC key for session cookies (min 16 chars; 32 random bytes recommended) |
| `ADMIN_SESSION_TTL_HOURS` | var | Optional session lifetime, default 336 (14 days) |
| `LOGIN_RATE_LIMITER` | rate limit | Optional. Login attempts per client IP |
| `ADMIN_EMAILS` | var | Enables the legacy **access** strategy (Cloudflare Access emails) |
| `ADMIN_AUTH` | var | Optional override: `password`, `access`, or `none` |

### Admin auth strategies

The Worker picks a strategy from its env: `ADMIN_AUTH` if set, else `password` when
`ADMIN_PASSWORD_HASH` exists, else `access` when `ADMIN_EMAILS` is non-empty, else `none`
(every admin request is denied). `GET /api/admin/session` reports the active strategy and
the editor renders the matching sign-in UI.

**password** (default for new sites): the owner enters a password on `/admin`; the Worker
verifies it against the PBKDF2-SHA256 hash and sets an `HttpOnly; SameSite=Lax; Secure`
cookie (`rk_admin_session`) holding an HMAC-signed token. No Zero Trust, no Access
applications, no extra Cloudflare product. See
[Changing the admin password](#changing-the-admin-password) for rotation.

**access** (legacy): trusts the `cf-access-authenticated-user-email` header. Only safe when
a Cloudflare Access application fronts every route that reaches the Worker, which is why
`workers_dev = false` / `preview_urls = false` matter here. Keep it if you already pay for
or run Zero Trust; otherwise prefer password.

Every state-changing `/api/admin/*` request (login included) must carry an `Origin` equal
to the request origin or one of `ALLOWED_ORIGINS`; anything else is rejected with 403.

Routes: `GET /api/menu` (published), `GET /api/assets/*` (only keys under the restaurant's
image prefix; served with a content type from the image allowlist or as an opaque download),
`GET /api/admin/session`, `POST /api/admin/login`, `POST /api/admin/logout`,
`GET /api/admin/sign-in` (Access redirect), `GET|PUT /api/admin/menu/draft`,
`POST /api/admin/menu/publish`, `POST|DELETE /api/admin/images`.

Publishing runs the same `validateMenu` check as your seed data and refuses (400, listing the
first issues) a draft that would break the public site, e.g. an unknown icon or a "sizes" item
with no sizes. Draft saves only get a shallow shape check, so half-finished edits still save.

`GET /api/menu` is cached at the edge for up to 60 seconds (custom domains only; `workers.dev`
has no edge cache) and carries an `ETag`, so returning visitors get a `304`. Publishing purges
the cache in the data center that handled the publish; others catch up within the minute.
Cached hits still count as Worker requests, so caching alone does not stop someone looping
on the menu URL to burn through the Workers free plan (100k requests/day). A WAF
rate-limiting rule does: it blocks at Cloudflare's edge before the Worker runs, and blocked
requests are not billed as Worker requests.

#### Security headers for the site

API responses (`/api/*`) get `nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, a
lock-down CSP and HSTS from the Worker. The site's own pages and files are served by
Cloudflare straight from static assets, without running the Worker, so they need a
`_headers` file. Create `public/_headers` in your site (Vite copies it into `dist/`):

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
  Strict-Transport-Security: max-age=31536000
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Cross-Origin-Opener-Policy: same-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Adjust the CSP to what your site loads:

- Drop the two Google Fonts origins if you self-host fonts.
- `style-src 'unsafe-inline'` is needed because the toast library injects a `<style>` tag.
- `img-src https:` allows menu photos from any HTTPS host. Narrow it if all images come
  from your own domain.
- If uploaded images live on another host (e.g. an `api.` subdomain), add that origin to
  `connect-src`: the editor fetches an existing photo to re-crop it.
- Cloudflare Web Analytics or other injected scripts need their origin in `script-src`.

Also turn on **SSL/TLS** > **Edge Certificates** > **Always Use HTTPS** for the zone, so
`http://` requests redirect before reaching the site. Load the admin and a menu page with
the browser console open after deploying; any CSP violation is logged there.

#### Rate-limit `/api/menu` with a WAF rule

Needs the site on a custom domain in a Cloudflare zone; `workers.dev` hosts have no WAF.
The Free plan allows one rate-limiting rule, counted per IP over 10 seconds.

1. In the Cloudflare dashboard, open your site's zone and go to **Security rules**.
2. Select **Create rule** > **Rate limiting rules**.
3. **Rule name:** `menu api flood`.
4. **If incoming requests match:** Field `URI Path`, Operator `equals`, Value `/api/menu`.
   (Or use the expression editor: `(http.request.uri.path eq "/api/menu")`.)
5. **With the same characteristics:** `IP` (the only option on Free).
6. **When rate exceeds:** `20` requests per `10 seconds`. A real visitor loads the menu
   once per page view, so this leaves plenty of headroom, including several people behind
   one restaurant Wi-Fi or mobile-carrier IP.
7. **Then take action:** `Block`, **Duration** `10 seconds` (the Free plan maximum).
8. Select **Deploy**.

To check it, run a quick loop against the menu URL and watch for `429` responses, then see
**Security** > **Events** for the matches:

```bash
for i in $(seq 1 40); do curl -s -o /dev/null -w "%{http_code}\n" https://your-domain.com/api/menu; done
```

Paid plans allow longer periods and block durations; the steps are the same.

`GET /api/admin/menu/backups` lists the copies written on each publish (newest first);
`POST /api/admin/menu/restore` with `{ source: "published" }` or `{ source: "backup", key }`
overwrites the draft from that copy. The editor exposes these as *Discard unsaved changes*,
*Restore last published*, and *Roll back to a backup…*; nothing goes live until you publish.

`GET /api/admin/menu/draft` returns the draft's `etag`; the editor sends it back as
`If-Match` on `PUT`, and the Worker answers `412` when the draft changed in between (two
tabs, two admins). Uploads accept JPEG/PNG/WebP/AVIF/GIF up to 5 MB (`415` / `413`
otherwise). Validation failures are JSON `4xx` responses; unexpected failures are a JSON
`500`.

In local dev the provider uses `createLocalMenuApiClient(seedMenu, storageKey)`, which
persists drafts to `localStorage` and reports the `local` strategy — no worker required.
To exercise the real Worker locally instead, set `VITE_MENU_API_BASE_URL` (and
`VITE_MENU_API_URL`) to the `wrangler dev` origin; that overrides the localhost rule.

The kit itself never reads `import.meta.env` (Vite would bake the library's empty env at
build time). Your site forwards its env through the `api` prop:

```tsx
<RestaurantSite
  config={config}
  seedMenu={seedMenu}
  api={{ baseUrl: import.meta.env.VITE_MENU_API_BASE_URL, publicMenuUrl: import.meta.env.VITE_MENU_API_URL }}
/>
```

`api.mode` can force `"local"` or `"remote"` regardless of hostname.
`wrangler dev` reads its secrets from `.dev.vars` — generate one with
`npx restaurant-kit-bootstrap --dev-vars`.

### Environments

One `wrangler.toml` per site, with production at the top level and a `[env.staging]`
block that points at **its own bucket and secrets**. Staging never touches production data;
seed it once from production's published menu:

```bash
npx restaurant-kit-bootstrap --bucket <site>-menu-staging --env staging --seed-from <site>-menu
npx wrangler deploy --env staging
```

`restaurant-kit-bootstrap` creates the bucket, seeds it, prompts for the admin password and
stores both secrets on the right env, then dry-runs the deploy and prints the DNS checklist.
Same command without `--env` provisions a brand-new production site. Keep `preview_urls`
off: version previews inherit production bindings, so they would edit the production draft.

Once a `[env.staging]` block exists, a bare `wrangler deploy` warns that no target
environment was specified. Name production explicitly with an empty env — the site's
`deploy` script should read `wrangler deploy --env=""` (the bootstrap dry run does the same).

### Changing the admin password

There is no "forgot password" flow — the password only exists as a hash in the Worker's
secrets, so recovery and rotation are the same operation. Run from the site directory:

```bash
npx restaurant-kit-bootstrap --bucket <site>-menu --skip-bucket --skip-seed
```

It prompts for the new password (hidden input) and stores a fresh `ADMIN_PASSWORD_HASH`
**and** a fresh `ADMIN_SESSION_SECRET`. No redeploy: secrets apply within seconds. Add
`--env staging` for staging — each env has its own password.

To change only the password and keep the session secret:

```bash
npx restaurant-kit-hash-password                      # prints the hash
npx wrangler secret put ADMIN_PASSWORD_HASH --env=""  # paste it; --env staging for staging
```

Either way **every device is signed out**, because the session signing key is derived from
the session secret *and* the password hash. To sign everyone out without changing the
password, rotate only the session secret:

```bash
openssl rand -base64 32 | npx wrangler secret put ADMIN_SESSION_SECRET --env=""
```

Picking the password: generate it (`openssl rand -base64 18`, or 4–5 random words if the
owner types it on a phone), at least 16 characters, unique per site, nothing derived from
the brand, phone number or handle. Keep a copy in a password manager and hand the owner
theirs out of band; it never belongs in the repo, `wrangler.toml` or chat logs. The login
rate limiter (5 attempts per IP per minute) slows guessing but does not excuse a weak one.

### Migrating a site off Cloudflare Access

1. Move to the single-Worker layout above (or keep your API Worker and just add the
   secrets — the auth change is independent of the routing change).
2. `npx restaurant-kit-hash-password`, then `wrangler secret put ADMIN_PASSWORD_HASH` and
   `wrangler secret put ADMIN_SESSION_SECRET`.
3. Remove `ADMIN_EMAILS` from `wrangler.toml` (or set `ADMIN_AUTH = "password"`).
4. Deploy. Verify `curl -s https://<site>/api/admin/session` returns
   `{"authenticated":false,"strategy":"password","user":null}` — if you get HTML instead,
   `/api/*` is not reaching the Worker.
5. Delete the Access applications for `/admin*` and `/api/admin/*` in Zero Trust.
   Until you do, Access still gates `/admin` in front of the password form.

## Development

```bash
npm install --legacy-peer-deps   # works around an npm arborist peer-set bug
npm run typecheck
npm run lint
npm test
npm run build     # dist/index.js, dist/worker.js, dist/restaurant-kit.css, dist/types/
```

`npm run dev` runs the library build in watch mode for linked consumers.

## License

[MIT](./LICENSE) © Hadi Al Hassan
