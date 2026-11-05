# Changelog: @cookiemunch/next

Every published release, newest first. Dates are the day the version was cut.

## 0.2.1 (2026-11-05)

- `hasConsent` and `onConsentChange` now come from `@cookiemunch/react`. Nothing changes for callers.

## 0.2.0 (2026-11-05)

- `hasConsent(category)` and `onConsentChange(fn)`, which replays a decision made before it subscribed.

## 0.1.1 (2026-10-30)

- Fixed: `cookieMunchCsp` keeps a manifest's `'sha256-…'` / `'sha384-…'` / `'sha512-…'` hash sources as written instead of treating them as origins.

## 0.1.0 (2026-10-24)

- Added: `<CookieMunchScript cbid culture? blockingMode? env? />`, `cookieMunchCsp({ cbid, extra? })` and `cookieMunchHeaders()` for `next.config`, and the `@cookiemunch/react` hooks re-exported.
