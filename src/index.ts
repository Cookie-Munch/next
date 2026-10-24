// @cookiemunch/next: the tag, the CSP, and the React hooks, for the Next.js App Router.
// No directive here: the tag and the CSP are server code; the hooks carry their own client boundary.
export { CookieMunchScript, type CookieMunchScriptProps } from './script.js';
export { cookieMunchCsp, cookieMunchHeaders, mergePolicy, policyString, type CspOptions } from './csp.js';
export {
  ConsentProvider,
  type ConsentProviderProps,
  useConsent,
  useBannerInset,
  ConsentGate,
  type ConsentGateProps,
  CookieSettingsLink,
  type CookieSettingsLinkProps,
  isGranted,
  consentCookie,
  parseConsentCookie,
  CONSENT_COOKIE_NAME,
} from '@cookiemunch/react';
