/** The Cookie Munch tag for `app/layout.tsx`, first in `<head>`: a Server Component, nothing runs on the client. */

export interface CookieMunchScriptProps {
  /** Your site's id (`data-cbid`), or `"auto"` to find it from the page's host (one app serving many customers' domains). */
  cbid: string;
  /** The banner's language, e.g. `de` (`data-culture`). Default: the visitor's. */
  culture?: string;
  /**
   * `auto` blocks third-party scripts until consent; `manual` honours `data-cookieconsent` markup only.
   * Left out, the site's stored `blocking.mode` is used (read from the public config, cached five minutes).
   * The tag decides: the stored mode never reaches the embed on its own.
   */
  blockingMode?: 'auto' | 'manual';
  /** `test` on development and preview origins: the banner shows to headless browsers and nothing reaches your log. */
  env?: 'test';
  /** The embed's origin. Default `https://cdn.cookiemunch.net`. */
  src?: string;
  /** Your per-request CSP nonce: the tag carries it, and so does every script and style the embed creates. */
  nonce?: string;
  /** Paths the embed leaves entirely alone, e.g. `['/embed/', '/f/']` (`data-exclude-paths`). */
  excludePaths?: string[];
  /** The API origin the stored mode is read from. Default `https://api.cookiemunch.net`. */
  apiBase?: string;
}

/** The site's stored blocking mode, or undefined when it cannot be read (the tag then leaves the attribute out: manual). */
export async function storedBlockingMode(cbid: string, apiBase = 'https://api.cookiemunch.net'): Promise<'auto' | 'manual' | undefined> {
  // "auto" names no site until the browser knows its host: there is nothing to read here. Pass blockingMode instead.
  if (cbid === 'auto') return undefined;
  try {
    // `next.revalidate` is Next's fetch cache; anywhere else the option is ignored.
    const init = { headers: { Accept: 'application/json' }, next: { revalidate: 300 } } as RequestInit;
    const res = await fetch(`${apiBase.replace(/\/+$/, '')}/config/${encodeURIComponent(cbid)}`, init);
    if (!res.ok) return undefined;
    const mode = ((await res.json()) as { blocking?: { mode?: unknown } } | null)?.blocking?.mode;
    return mode === 'auto' || mode === 'manual' ? mode : undefined;
  } catch {
    return undefined;
  }
}

export async function CookieMunchScript({ cbid, culture, blockingMode, env, src = 'https://cdn.cookiemunch.net', nonce, excludePaths, apiBase }: CookieMunchScriptProps) {
  const stored = await storedBlockingMode(cbid, apiBase);
  if (blockingMode && stored && blockingMode !== stored) {
    console.warn(`Cookie Munch: <CookieMunchScript blockingMode="${blockingMode}"> overrides ${cbid}'s stored blocking.mode "${stored}". Drop the prop to follow the stored setting.`);
  }
  const mode = blockingMode ?? stored;
  const exclude = excludePaths?.map((p) => p.trim()).filter((p) => p && !p.includes(','));
  // A plain tag, as the install snippet is: prior-blocking needs it parsed before other scripts, so no
  // next/script strategy (they all load later).
  return (
    <script
      id="CookieMunch"
      src={`${src.replace(/\/+$/, '')}/consent.js`}
      data-cbid={cbid}
      {...(mode ? { 'data-blockingmode': mode } : {})}
      {...(culture ? { 'data-culture': culture } : {})}
      {...(env ? { 'data-env': env } : {})}
      {...(exclude?.length ? { 'data-exclude-paths': exclude.join(',') } : {})}
      {...(nonce ? { nonce } : {})}
    />
  );
}
