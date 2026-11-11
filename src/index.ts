// @cookiemunch/next: the tag, the CSP, and the React hooks, for the Next.js App Router.
// No directive here: the tag and the CSP are server code; the hooks carry their own client boundary.
export { CookieMunchScript, storedBlockingMode, type CookieMunchScriptProps } from './script.js';
export { CookieDeclarationServer, getCookieDeclaration, declarationHtml, type CookieDeclarationServerProps } from './declaration.js';
export { hasConsent, onConsentChange, onConsentCategory, type ConsentTransition } from './consent.js';
export { cookieMunchCsp, cookieMunchHeaders, cookieMunchOrigins, cookieMunchCspDirectives, mergePolicy, policyString, type CspOptions } from './csp.js';
export {
  ConsentProvider,
  type ConsentProviderProps,
  useConsent,
  useBannerInset,
  useConsentTransition,
  ConsentGate,
  type ConsentGateProps,
  CookieSettingsLink,
  type CookieSettingsLinkProps,
  ConsentIdentity,
  type ConsentIdentityProps,
  isGranted,
  consentCookie,
  parseConsentCookie,
  CONSENT_COOKIE_NAME,
} from '@cookiemunch/react';
