# Changelog

## 0.2.1 — 2026-09-28

- Worker: request bodies are size-capped before parsing (2 MB menu JSON, 5 MB image upload,
  4 KB login), counting streamed bytes so a missing Content-Length can't bypass it. Oversized
  requests get 413.
- Worker: malformed percent-encoding in `/api/assets/…` returns 404 instead of 500.
- Site: an unknown group icon falls back to the plate icon, and an error boundary shows a
  "reload" page instead of a blank screen if rendering fails.
- `restaurant-kit-bootstrap`: `--dev-vars` adds `.dev.vars` to `.gitignore` if missing; wrangler
  is pinned to `wrangler@4`; `--help` warns that `--password` lands in shell history.

## 0.2.0 — 2026-09-26

- Footer: optional `footer` config. `footer.legal` replaces the default copyright line
  (`{year}` is filled in) and `footer.notices` adds lines of text and links, e.g. a
  disclaimer or credits.

## 0.1.0 — 2026-09-24

First public release.

- Public site: hero, menu browser (groups, sections, sizes, photos), rating, testimonials,
  locations, footer. Theming through `--restaurant-*` CSS custom properties.
- Ordering: WhatsApp cart, or `ordering: { mode: "external" }` to turn the cart off and link
  to a delivery app.
- Admin at `/admin`: draft editing with drag-and-drop ordering, image upload and crop,
  preview, publish, restore from published or from a backup, optimistic concurrency.
- Worker (`restaurant-kit/worker`): R2-backed menu and image API, password auth with signed
  session cookies, origin checks, login rate limiting.
- CLIs: `restaurant-kit-bootstrap` (provision bucket, seed, secrets) and
  `restaurant-kit-hash-password`.
- The admin is lazy-loaded and the build keeps one file per module, so public visitors never
  download the editor (about 44% less JS on the public page).
- `validateMenu()` / `assertValidMenu()` to check seed data before it ships.

The pre-release security and correctness review is recorded in [BUGS.md](./BUGS.md).
