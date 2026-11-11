/**
 * The cookie declaration, rendered on the server (FormFlow CM-11).
 *
 * `<CookieDeclaration>` from @cookiemunch/react is an empty mount the embed draws into in the browser,
 * so a crawler, a reader without JavaScript, a print or a regulator's scanner saw no cookies at all.
 * This Server Component reads the same public feed the embed reads (`/api/v1/{cbid}/cookies?lang=`),
 * in the page's language, and puts the table in the HTML. The element is still a
 * `data-cc="declaration"` mount: once the embed loads it draws the live table over it.
 *
 * The rows go in as one escaped HTML string (`dangerouslySetInnerHTML`), so React never owns the
 * children and the embed may replace them without React reconciling against nodes it no longer has.
 */

export interface CookieDeclarationServerProps {
  cbid: string;
  /** The page's language (BCP 47): rows, headings and column names in it. Default `en`. */
  lang?: string;
  /** Seconds Next may cache the feed. Default 300. */
  revalidate?: number;
  /** Shown when the site has no cookies, or the feed could not be read. */
  emptyText?: string;
  className?: string;
  id?: string;
  apiBase?: string;
}

interface FeedRow { name: string; category: string; provider?: string; purpose?: string; expiry?: string }
interface Feed {
  cookies: FeedRow[];
  strings?: { categories?: Record<string, string>; cols?: { name: string; provider: string; purpose: string; expiry: string }; empty?: string };
}

const ORDER = ['necessary', 'preferences', 'statistics', 'marketing'];
const esc = (v: string): string => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The feed, or null when it cannot be read (the mount then falls back to the embed). */
export async function getCookieDeclaration(cbid: string, opts: { lang?: string; revalidate?: number; apiBase?: string } = {}): Promise<Feed | null> {
  try {
    const base = (opts.apiBase ?? 'https://api.cookiemunch.net').replace(/\/+$/, '');
    const qs = opts.lang ? `?lang=${encodeURIComponent(opts.lang)}` : '?lang=en';
    // `next.revalidate` is Next's fetch cache; anywhere else the option is ignored.
    const init = { headers: { Accept: 'application/json' }, next: { revalidate: opts.revalidate ?? 300 } } as RequestInit;
    const res = await fetch(`${base}/api/v1/${encodeURIComponent(cbid)}/cookies${qs}`, init);
    if (!res.ok) return null;
    const feed = (await res.json()) as Feed;
    return Array.isArray(feed?.cookies) ? feed : null;
  } catch {
    return null;
  }
}

/** The table markup for a feed: a heading and a table per category, in the banner's order. */
export function declarationHtml(feed: Feed, emptyText?: string): string {
  const cols = feed.strings?.cols ?? { name: 'Name', provider: 'Provider', purpose: 'Purpose', expiry: 'Expiry' };
  if (!feed.cookies.length) return `<p>${esc(emptyText ?? feed.strings?.empty ?? 'No cookies are declared.')}</p>`;
  const seen = [...new Set(feed.cookies.map((c) => c.category))];
  const cats = [...ORDER.filter((c) => seen.includes(c)), ...seen.filter((c) => !ORDER.includes(c) && c !== 'unclassified'), ...(seen.includes('unclassified') ? ['unclassified'] : [])];
  return cats.map((cat) => {
    const rows = feed.cookies.filter((c) => c.category === cat).map((c) =>
      `<tr><td>${esc(c.name)}</td><td>${esc(c.provider ?? '')}</td><td>${esc(c.purpose ?? '')}</td><td>${esc(c.expiry ?? '')}</td></tr>`).join('');
    return `<section data-cc-category="${esc(cat)}"><h3>${esc(feed.strings?.categories?.[cat] ?? cat)}</h3>`
      + `<table><thead><tr><th>${esc(cols.name)}</th><th>${esc(cols.provider)}</th><th>${esc(cols.purpose)}</th><th>${esc(cols.expiry)}</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  }).join('');
}

export async function CookieDeclarationServer({ cbid, lang, revalidate, emptyText, className, id, apiBase }: CookieDeclarationServerProps) {
  const feed = await getCookieDeclaration(cbid, { ...(lang ? { lang } : {}), ...(revalidate !== undefined ? { revalidate } : {}), ...(apiBase ? { apiBase } : {}) });
  return (
    <div
      data-cc="declaration"
      {...(emptyText ? { 'data-empty': emptyText } : {})}
      {...(id ? { id } : {})}
      {...(className ? { className } : {})}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: feed ? declarationHtml(feed, emptyText) : '' }}
    />
  );
}
