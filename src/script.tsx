/** The Cookie Munch tag for `app/layout.tsx`, first in `<head>`: a Server Component, nothing runs on the client. */

export interface CookieMunchScriptProps {
  /** Your site's id (`data-cbid`). */
  cbid: string;
  /** The banner's language, e.g. `de` (`data-culture`). Default: the visitor's. */
  culture?: string;
  /** `auto` (the default) blocks third-party scripts until consent; `manual` honours `data-cookieconsent` markup only. */
  blockingMode?: 'auto' | 'manual';
  /** `test` on development and preview origins: the banner shows to headless browsers and nothing reaches your log. */
  env?: 'test';
  /** The embed's origin. Default `https://cdn.cookiemunch.net`. */
  src?: string;
}

export function CookieMunchScript({ cbid, culture, blockingMode = 'auto', env, src = 'https://cdn.cookiemunch.net' }: CookieMunchScriptProps) {
  // A plain tag, as the install snippet is: prior-blocking needs it parsed before other scripts, so no
  // next/script strategy (they all load later).
  return (
    <script
      id="CookieMunch"
      src={`${src.replace(/\/+$/, '')}/consent.js`}
      data-cbid={cbid}
      data-blockingmode={blockingMode}
      {...(culture ? { 'data-culture': culture } : {})}
      {...(env ? { 'data-env': env } : {})}
    />
  );
}
