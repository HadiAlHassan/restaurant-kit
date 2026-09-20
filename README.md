# restaurant-kit

Shared restaurant site kit extracted from the Soubras / SweetMeat / Munchease builds:
public menu browser, WhatsApp cart, admin menu CMS, and the Cloudflare Worker API.

Soubras was the canonical base (its refactor history is a superset of SweetMeat's).
SweetMeat's parameterized draft-storage key and generic worker origin detection were
ported on top; its permissive `ADMIN_EMAILS` fallback was **not** — the kit denies by
default when no auth strategy is configured.

Admin auth no longer depends on Cloudflare Access: the Worker ships a password + signed
session cookie strategy (see [Admin auth strategies](#admin-auth-strategies)).

## Install

```bash
npm install restaurant-kit
```

Peer dependencies: `react@^19.1`, `react-dom@^19.1`, `react-router-dom@^7.18`.

> If npm errors with `Cannot read properties of null (reading 'edgesOut')`, rerun with
> `--legacy-peer-deps`. It is an arborist peer-set bug, not a kit dependency conflict.

When consuming via `file:` / `npm link`, add a dedupe so the linked package does not
pull a second copy of React:

```ts
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ["react", "react-dom", "react-router-dom"] },
});
```

## Quick start

```tsx
import { RestaurantSite, type DynamicMenu, type RestaurantSiteConfig } from "restaurant-kit";
import "restaurant-kit/styles.css";

const config: RestaurantSiteConfig = { /* see below */ };
const seedMenu: DynamicMenu = { schemaVersion: 1, groups: [], categories: [], items: [] };

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <RestaurantSite config={config} seedMenu={seedMenu} />
  </BrowserRouter>,
);
```

`RestaurantSite` mounts the toaster and these routes: `/` (public site),
`/admin` (menu editor), `/admin/preview`, and a catch-all redirect to `/`.
Bring your own `BrowserRouter` so the kit can live under a larger app.

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
`LocationsSection`, `Footer`) are exported if you want a custom page layout.

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
| `ordering` | Optional. How customers order — see [Ordering modes](#ordering-modes) |

### Ordering modes

Not every restaurant takes orders over WhatsApp. `ordering` switches the whole cart feature:

```ts
// Default (omit the field): cart + "Add to cart" everywhere, order sent as a WhatsApp message.
ordering: { mode: "whatsapp" }

// Cart off. Browse-only menu; every order button opens the delivery app / site instead.
ordering: { mode: "external", url: "https://link.totersapp.com/…", label: "Order on Toters", shortLabel: "Order", iconSrc: "/assets/brand/toters-mark.svg" }
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
npm install --legacy-peer-deps
npm run typecheck
npm run lint
npm test
npm run build     # dist/index.js, dist/worker.js, dist/restaurant-kit.css, dist/types/
```

`npm run dev` runs the library build in watch mode for linked consumers.
