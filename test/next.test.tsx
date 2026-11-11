import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { hasConsent, onConsentChange, CookieMunchScript, cookieMunchCsp, cookieMunchHeaders, cookieMunchOrigins, cookieMunchCspDirectives, mergePolicy, policyString } from '../src/index.js';

describe('<CookieMunchScript>', () => {
  const config = (mode: unknown, status = 200) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ blocking: { mode } }), { status })));
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  const html = async (p: Parameters<typeof CookieMunchScript>[0]) => renderToStaticMarkup(await CookieMunchScript(p));

  it('without a prop, follows the site\'s stored blocking mode (FormFlow CM-09)', async () => {
    config('manual');
    expect(await html({ cbid: 'acme' })).toBe('<script id="CookieMunch" src="https://cdn.cookiemunch.net/consent.js" data-cbid="acme" data-blockingmode="manual"></script>');
    config('auto');
    expect(await html({ cbid: 'acme' })).toContain('data-blockingmode="auto"');
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('https://api.cookiemunch.net/config/acme');
  });

  it('an unreadable config leaves the attribute out (manual, as the embed treats it)', async () => {
    config(undefined, 503);
    expect(await html({ cbid: 'acme' })).not.toContain('data-blockingmode');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await html({ cbid: 'acme' })).not.toContain('data-blockingmode');
  });

  it('cbid "auto" reads nothing (no site is known until the browser has its host); the prop decides (CM-23)', async () => {
    config('auto');
    expect(await html({ cbid: 'auto', blockingMode: 'auto' })).toContain('data-cbid="auto" data-blockingmode="auto"');
    expect(await html({ cbid: 'auto' })).not.toContain('data-blockingmode');
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('a prop wins, and says so when it disagrees with the stored mode', async () => {
    config('manual');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t = await html({ cbid: 'acme', culture: 'de', env: 'test', blockingMode: 'auto' });
    expect(t).toContain('data-blockingmode="auto"');
    expect(t).toContain('data-culture="de"');
    expect(t).toContain('data-env="test"');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('carries the nonce and the excluded paths', async () => {
    config('manual');
    const t = await html({ cbid: 'acme', nonce: 'bm9uY2UxMjM0', excludePaths: ['/embed/', ' /f/ ', 'a,b'] });
    expect(t).toContain('nonce="bm9uY2UxMjM0"');
    expect(t).toContain('data-exclude-paths="/embed/,/f/"');
  });
});

const MANIFEST = {
  surfaces: {
    banner: {
      csp: { 'script-src': ['https://cdn.cookiemunch.net'], 'connect-src': ['https://api.cookiemunch.net', 'https://{tenant}.example'] },
      requires: { 'style-src': ["'unsafe-inline'"] },
    },
  },
};

describe('the Content-Security-Policy', () => {
  it('merges the manifest and your own directives, self first, placeholders dropped', () => {
    const p = mergePolicy(MANIFEST, { 'script-src': ['https://js.stripe.com'], 'img-src': ['data:'] });
    expect(policyString(p)).toBe(
      "default-src 'self'; connect-src 'self' https://api.cookiemunch.net; img-src 'self' data:; script-src 'self' https://cdn.cookiemunch.net https://js.stripe.com; style-src 'self' 'unsafe-inline'",
    );
  });

  it('a hash source under requires is kept verbatim, before the origins, never as an origin (CMU-PM-04)', () => {
    const hash = `'sha256-${'A'.repeat(43)}='`;
    const p = mergePolicy({ surfaces: { widget: { csp: { 'script-src': ['https://widget.chatlychat.com', hash] }, requires: { 'script-src': [hash, "'nonce-x'"] } } } });
    expect(p.get('script-src')).toEqual(["'self'", hash, 'https://widget.chatlychat.com']);
  });

  it('reads the site manifest and gives next.config headers; a failed read throws', async () => {
    const seen: string[] = [];
    const ok = (async (url: string) => { seen.push(url); return new Response(JSON.stringify(MANIFEST), { status: 200 }); }) as unknown as typeof fetch;
    const headers = await cookieMunchHeaders({ cbid: 'acme site', fetch: ok });
    expect(seen[0]).toBe('https://api.cookiemunch.net/v1/embed?cbid=acme%20site');
    expect(headers[0]).toMatchObject({ source: '/(.*)', headers: [{ key: 'Content-Security-Policy' }] });
    const bad = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
    await expect(cookieMunchCsp({ cbid: 'nope', fetch: bad })).rejects.toThrow(/404/);
  });
});

describe('hasConsent and onConsentChange', () => {
  const stub = (cm: unknown) => {
    const target = new EventTarget();
    (globalThis as { window?: unknown }).window = Object.assign(target, { CookieMunch: cm });
    return target;
  };
  const change = (consent: unknown) => new (class extends Event { detail = { consent }; })('CookieMunchOnChange');

  it('on the server: only necessary, and a no-op listener', () => {
    delete (globalThis as { window?: unknown }).window;
    expect(hasConsent('necessary')).toBe(true);
    expect(hasConsent('statistics')).toBe(false);
    expect(onConsentChange(() => {})).toBeTypeOf('function');
  });

  it('replays a decision made before it subscribed, fires on change, and unsubscribes', async () => {
    const seen: unknown[] = [];
    const w = stub({ hasResponse: true, consent: { statistics: true, marketing: false } });
    expect(hasConsent('statistics')).toBe(true);
    expect(hasConsent('marketing')).toBe(false);
    const stop = onConsentChange((c) => seen.push(c));
    await Promise.resolve();
    expect(seen).toEqual([{ statistics: true, marketing: false }]);
    w.dispatchEvent(change({ statistics: false }));
    expect(seen).toHaveLength(2);
    stop();
    w.dispatchEvent(change({ statistics: true }));
    expect(seen).toHaveLength(2);
    delete (globalThis as { window?: unknown }).window;
  });

  it('no decision yet: nothing is replayed', async () => {
    const seen: unknown[] = [];
    stub({ hasResponse: false, consent: {} });
    expect(hasConsent('statistics')).toBe(false);
    onConsentChange((c) => seen.push(c));
    await Promise.resolve();
    expect(seen).toEqual([]);
    delete (globalThis as { window?: unknown }).window;
  });
});

describe('CSP for proxy.ts (FormFlow CM-09)', () => {
  it('origins are fetched once as JSON; each request\'s policy is built synchronously with its nonce', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(MANIFEST)));
    const origins = await cookieMunchOrigins({ cbid: 'acme', fetch: f as unknown as typeof fetch });
    expect(JSON.parse(JSON.stringify(origins))).toEqual(origins);
    expect(origins['script-src']).toEqual(["'self'", 'https://cdn.cookiemunch.net']);
    const p = cookieMunchCspDirectives(origins, { nonce: 'bm9uY2UxMjM0', extra: { 'img-src': ['data:'] } });
    expect(p).toContain("script-src 'self' https://cdn.cookiemunch.net 'nonce-bm9uY2UxMjM0'");
    expect(p).toContain("img-src 'self' data:");
    expect(p).toContain("style-src 'self' 'unsafe-inline'");
    expect(() => cookieMunchCspDirectives(origins, { nonce: "x'; script-src *" })).toThrow();
  });
});

describe('<CookieDeclarationServer> (CM-11)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  const feed = {
    cookies: [
      { name: 'lc_vid', category: 'statistics', provider: 'Lucida', purpose: 'Counts <visits>', expiry: '1 year' },
      { name: 'ff_aid', category: 'necessary', provider: 'FormFlow', purpose: 'Signs you in', expiry: 'Session' },
    ],
    strings: { categories: { necessary: 'Notwendig', statistics: 'Statistik' }, cols: { name: 'Name', provider: 'Anbieter', purpose: 'Zweck', expiry: 'Ablauf' }, empty: 'Keine' },
  };

  it('puts every declared cookie into the server HTML, escaped, in the asked language, necessary first', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(feed))));
    const { CookieDeclarationServer } = await import('../src/index.js');
    const out = renderToStaticMarkup(await CookieDeclarationServer({ cbid: 'acme', lang: 'de' }));
    expect(vi.mocked(fetch).mock.calls[0]![0]).toBe('https://api.cookiemunch.net/api/v1/acme/cookies?lang=de');
    expect(out).toContain('data-cc="declaration"');
    expect(out).toContain('<td>ff_aid</td>');
    expect(out).toContain('Counts &#60;visits&#62;');
    expect(out.indexOf('Notwendig')).toBeLessThan(out.indexOf('Statistik'));
    expect(out).toContain('<th>Anbieter</th>');
  });

  it('leaves an empty mount for the embed when the feed cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    const { CookieDeclarationServer } = await import('../src/index.js');
    expect(renderToStaticMarkup(await CookieDeclarationServer({ cbid: 'acme', emptyText: 'Loads with the banner' }))).toBe('<div data-cc="declaration" data-empty="Loads with the banner"></div>');
  });
});
