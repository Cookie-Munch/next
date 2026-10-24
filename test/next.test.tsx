import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CookieMunchScript, cookieMunchCsp, cookieMunchHeaders, mergePolicy, policyString } from '../src/index.js';

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
