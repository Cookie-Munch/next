import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { hasConsent, onConsentChange, CookieMunchScript, cookieMunchCsp, cookieMunchHeaders, mergePolicy, policyString } from '../src/index.js';

describe('<CookieMunchScript>', () => {
  it('renders the install snippet: a plain tag, blocking on, the culture and test env when asked', () => {
    expect(renderToStaticMarkup(<CookieMunchScript cbid="acme" />)).toBe('<script id="CookieMunch" src="https://cdn.cookiemunch.net/consent.js" data-cbid="acme" data-blockingmode="auto"></script>');
    const t = renderToStaticMarkup(<CookieMunchScript cbid="acme" culture="de" env="test" blockingMode="manual" />);
    expect(t).toContain('data-culture="de"');
    expect(t).toContain('data-env="test"');
    expect(t).toContain('data-blockingmode="manual"');
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
