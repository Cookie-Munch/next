/**
 * The Content-Security-Policy a Next.js site needs for Cookie Munch, from the site's own embed manifest
 * (`GET /v1/embed?cbid=`, public): every origin the banner, the API and anything the site's config adds
 * are served from. Merged with your own directives, `'self'` first.
 *
 *   // next.config.mjs
 *   import { cookieMunchHeaders } from '@cookiemunch/next';
 *   export default { headers: () => cookieMunchHeaders({ cbid: 'your-site-id', extra: { 'img-src': ['https://images.example.com'] } }) };
 */

export interface CspOptions {
  cbid: string;
  /** Your own directives, merged in (e.g. `{ 'script-src': ['https://js.stripe.com'] }`). */
  extra?: Record<string, string[]>;
  /** The API origin. Default `https://api.cookiemunch.net`. */
  apiBase?: string;
  fetch?: typeof fetch;
}

interface Manifest {
  surfaces?: Record<string, { csp?: Record<string, unknown>; requires?: Record<string, unknown> }>;
}

const ORIGIN = /^(https|wss):\/\/[^\s*'"{]+$/;
// A hash source ('sha256-…') is a keyword here: copied verbatim, never read as an origin.
const KEYWORD = /^('self'|'unsafe-inline'|'unsafe-eval'|'wasm-unsafe-eval'|'unsafe-hashes'|data:|blob:|'sha(256|384|512)-[A-Za-z0-9+/_-]+={0,2}')$/;
const DIRECTIVE = /^[a-z-]+-src$|^form-action$/;

/** The policy as a map, directive → sources (`'self'` first); exported for tests and custom headers. */
export function mergePolicy(manifest: Manifest, extra: Record<string, string[]> = {}): Map<string, string[]> {
  const by = new Map<string, Set<string>>();
  const add = (d: string, list: unknown, keywords: boolean) => {
    if (!DIRECTIVE.test(d) || !Array.isArray(list)) return;
    const set = by.get(d) ?? new Set<string>();
    by.set(d, set);
    for (const s of list) if (typeof s === 'string' && (ORIGIN.test(s) || (keywords && KEYWORD.test(s)))) set.add(s);
  };
  for (const s of Object.values(manifest.surfaces ?? {})) {
    for (const [d, l] of Object.entries(s.csp ?? {})) add(d, l, false);
    for (const [d, l] of Object.entries(s.requires ?? {})) add(d, l, true);
  }
  for (const [d, l] of Object.entries(extra)) add(d, l, true);
  const out = new Map<string, string[]>([['default-src', ["'self'"]]]);
  for (const [d, set] of [...by.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const rest = [...set].filter((s) => s !== "'self'");
    out.set(d, ["'self'", ...rest.filter((s) => !ORIGIN.test(s)).sort(), ...rest.filter((s) => ORIGIN.test(s)).sort()]);
  }
  return out;
}

export function policyString(policy: Map<string, string[]>): string {
  return [...policy.entries()].map(([d, l]) => `${d} ${l.join(' ')}`).join('; ');
}

/** The `Content-Security-Policy` value for the site. Throws when the manifest cannot be read (a build should fail loudly). */
export async function cookieMunchCsp(o: CspOptions): Promise<string> {
  const base = (o.apiBase ?? 'https://api.cookiemunch.net').replace(/\/+$/, '');
  const res = await (o.fetch ?? fetch)(`${base}/v1/embed?cbid=${encodeURIComponent(o.cbid)}`, { headers: { Accept: 'application/json', 'User-Agent': 'cookiemunch-next/0.1.0' } });
  if (!res.ok) throw new Error(`Cookie Munch: the embed manifest for ${o.cbid} answered ${res.status}`);
  return policyString(mergePolicy((await res.json()) as Manifest, o.extra));
}

/** `next.config` `headers()`: the policy on every path. */
export async function cookieMunchHeaders(o: CspOptions & { source?: string }): Promise<Array<{ source: string; headers: Array<{ key: string; value: string }> }>> {
  return [{ source: o.source ?? '/(.*)', headers: [{ key: 'Content-Security-Policy', value: await cookieMunchCsp(o) }] }];
}
