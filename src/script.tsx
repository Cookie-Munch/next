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
  /** The API origin the stored mode and embed channel are read from. Default `https://api.cookiemunch.net`. */
  apiBase?: string;
  /**
   * Pin one embed release from code: `version` with its `integrity` (both from `GET /v1/embed?cbid=…`,
   * `tenant.embed`). Left out, the site's stored `embedChannel` decides: a pinned site gets that
   * release's immutable `/v/<version>/consent.js` with `integrity` and `crossorigin`, a stable one the
   * floating `/consent.js` (which changes with every release, so it has no fixed hash).
   */
  version?: string;
  integrity?: string;
}

/** The pinned tag the site's stored `embedChannel` asks for, or undefined for a stable site (or when it cannot be read). */
export async function storedPinnedEmbed(cbid: string, apiBase = 'https://api.cookiemunch.net'): Promise<{ version: string; integrity: string } | undefined> {
  if (cbid === 'auto') return undefined;
  try {
    const init = { headers: { Accept: 'application/json' }, next: { revalidate: 300 } } as RequestInit;
    const res = await fetch(`${apiBase.replace(/\/+$/, '')}/v1/embed?cbid=${encodeURIComponent(cbid)}`, init);
    if (!res.ok) return undefined;
    const e = ((await res.json()) as { tenant?: { embed?: { channel?: unknown; version?: unknown; integrity?: unknown } } } | null)?.tenant?.embed;
    if (typeof e?.channel !== 'string' || !e.channel.startsWith('pinned:')) return undefined;
    return typeof e.version === 'string' && typeof e.integrity === 'string' ? { version: e.version, integrity: e.integrity } : undefined;
  } catch {
    return undefined;
  }
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

export async function CookieMunchScript({ cbid, culture, blockingMode, env, src = 'https://cdn.cookiemunch.net', nonce, excludePaths, apiBase, version, integrity }: CookieMunchScriptProps) {
  if ((version === undefined) !== (integrity === undefined)) throw new Error('Cookie Munch: <CookieMunchScript> takes version and integrity together (both from GET /v1/embed?cbid=…)');
  if (version !== undefined && !/^[A-Za-z0-9._-]+$/.test(version)) throw new Error(`Cookie Munch: <CookieMunchScript version="${version}"> is not a release version`);
  const [stored, pinned] = await Promise.all([storedBlockingMode(cbid, apiBase), version ? undefined : storedPinnedEmbed(cbid, apiBase)]);
  const pin = version && integrity ? { version, integrity } : pinned;
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
      src={`${src.replace(/\/+$/, '')}${pin ? `/v/${pin.version}` : ''}/consent.js`}
      {...(pin ? { integrity: pin.integrity, crossOrigin: 'anonymous' as const } : {})}
      data-cbid={cbid}
      {...(mode ? { 'data-blockingmode': mode } : {})}
      {...(culture ? { 'data-culture': culture } : {})}
      {...(env ? { 'data-env': env } : {})}
      {...(exclude?.length ? { 'data-exclude-paths': exclude.join(',') } : {})}
      {...(nonce ? { nonce } : {})}
    />
  );
}
