# Known bugs — restaurant-kit

Review date: 2026-09-20. Fix pass completed the same day; every item below is closed and
covered by a test (suite: 272 green). Kept as a changelog of what was wrong and how it was
resolved, so the reasoning survives.

Severity: **S1** exploitable or silently destroys data · **S2** wrong behaviour users
will hit · **S3** cosmetic or defensive.

---

## 1. Worker — security

| # | Bug | Fix |
| --- | --- | --- |
| 1.1 S1 | `/api/assets/*` served any bucket key (draft menu, other tenants) | `getAsset` rejects keys outside `restaurants/<id>/images/menu/`; 404 either way |
| 1.2 S1 | `try`/`catch` in `fetch` caught nothing — handlers were returned un-awaited, so validation and R2 failures surfaced as Cloudflare 1101 | `return await` on every branch; `RequestError(status)` for client errors (400/413/415/412), JSON 500 for the rest |
| 1.3 S1 | Image upload unbounded and untyped; a `text/html` upload was stored XSS on the admin origin | MIME allowlist (JPEG/PNG/WebP/AVIF/GIF), 5 MB cap, stored type = validated type; `/api/assets/*` serves non-allowlisted objects as `application/octet-stream; attachment` with `nosniff` |
| 1.4 S2 | `vary: Origin` missing on the non-matching CORS branch → a shared cache could pin one origin's header on an immutable asset | `getCorsHeaders` always returns `vary: Origin` |

## 2. Worker — auth

| # | Bug | Fix |
| --- | --- | --- |
| 2.1 S2 | Changing the password did not invalidate sessions | Session signing key = `ADMIN_SESSION_SECRET` + `ADMIN_PASSWORD_HASH`; a password rotation is a global sign-out |
| 2.2 S3 | Rate-limit key fell back to spoofable `x-forwarded-for` | `cf-connecting-ip` only, else `"unknown"` |

## 3. Admin draft state

| # | Bug | Fix |
| --- | --- | --- |
| 3.1 S1 | Edit during an in-flight save was marked "synced"; publish then skipped its own save | Draft state is `{ menu, revision, savedRevision }`; `hasUnsavedChanges` is derived. Saves snapshot at call time and are serialized on one chain |
| 3.2 S2 | `applyCommand` checked rejections against a stale closure | The ref is the source of truth and updated synchronously; commands read it, not the render closure |
| 3.3 S3 | Every no-op dirtied the draft | Mutations return the input menu when nothing matched; the hook only commits on identity change |
| 3.4 S1 | Preview link unmounted the editor and dropped unsaved edits | `AdminDraftProvider` above both admin routes; `AdminPreview` renders the in-memory draft; `beforeunload` guard while dirty |
| 3.5 S2 | No optimistic concurrency on the draft | `GET` returns `etag`, `PUT` sends `If-Match`, R2 `onlyIf.etagMatches`, `412` on conflict; the editor keeps the draft dirty and shows the reload message |

## 4. Correctness

| # | Bug | Fix |
| --- | --- | --- |
| 4.1 S2 | Size order differed between admin and customer | `sortedSizes` sorts by `order` only; S/M/L is a display label |
| 4.2 S2 | `imageSource` mangled `data:`/`blob:` URLs; duplicate implementation | One `imageSrc` in `menuItemDisplay`, re-exported for admin |
| 4.3 S2 | Categories with a dangling `groupId` were dropped on unrelated edits | `renumberSections` keeps orphans at the end untouched |
| 4.4 S2 | Module-scope runtime (`kitRuntime`) fought the provider | Deleted. `RestaurantKitProvider` owns config, seed, API client, and draft key; consumers inject explicitly; hooks throw outside a provider |
| 4.5 S3 | `useParkedSheet` leaked history entries | Token-tagged entries; close/unmount only pop their own entry |

## 5. Smaller

All ten closed: `uniqueId` uses `crypto.randomUUID()`; `priceInputValue` keeps the current
currency (and the admin `PriceField` remembers it); `formatPriceTotal` keeps separators;
`addSection` toasts when there is no group; singular "item"; stars follow `config.rating`;
delete item/section/group confirm first; cart drawer is `inert` while closed; `replace` can
clear a note with `null`/`""`; the local branch of `useRemoteMenuData` honours `enabled`.

---

## Still worth doing (not bugs)

- `validateMenu()` for consumers, so orphan references in seed data fail at build time
  rather than being tolerated at runtime.
- Cache the published menu with `ETag`/`If-None-Match` instead of `no-store` once traffic
  justifies it.
