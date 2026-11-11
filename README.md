# @cookiemunch/next

Cookie Munch for the Next.js App Router: the tag, the Content-Security-Policy, and the React hooks.

```tsx
// app/layout.tsx
import { CookieMunchScript } from '@cookiemunch/next';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <CookieMunchScript cbid="your-site-id" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

```js
// next.config.mjs
import { cookieMunchHeaders } from '@cookiemunch/next';

export default {
  headers: () => cookieMunchHeaders({ cbid: 'your-site-id', extra: { 'script-src': ['https://js.stripe.com'] } }),
};
```

Without `blockingMode`, the tag follows your site's stored `blocking.mode`. Pass `nonce` for a
per-request CSP. For `proxy.ts`, save `cookieMunchOrigins({ cbid })` in a build step and build each
request's policy with `cookieMunchCspDirectives(origins, { nonce })`. See
[the Next.js guide](https://cookiemunch.net/docs/nextjs).

`useConsent()`, `useBannerInset()`, `<ConsentGate>` and `<CookieSettingsLink>` are re-exported from
[`@cookiemunch/react`](https://www.npmjs.com/package/@cookiemunch/react). `useConsent()` tells "not decided
yet" apart from "refused". Docs: [cookiemunch.net/docs/nextjs](https://cookiemunch.net/docs/nextjs).
