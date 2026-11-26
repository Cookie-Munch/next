// @cookiemunch/next: the tag, the CSP, and the React hooks, for the Next.js App Router.
// No directive here: the tag and the CSP are server code; the hooks carry their own client boundary.
export { CookieMunchScript, CookieMunchTag, storedBlockingMode, storedPinnedEmbed, type CookieMunchScriptProps } from './script.js';
export { CookieDeclarationServer, getCookieDeclaration, declarationHtml, type CookieDeclarationServerProps } from './declaration.js';
export { hasConsent, onConsentChange, onConsentCategory, type ConsentTransition } from './consent.js';
export { cookieMunchCsp, cookieMunchHeaders, cookieMunchOrigins, cookieMunchCspDirectives, mergePolicy, policyString, type CspOptions } from './csp.js';
// Everything @cookiemunch/react exports (RightsLink, CookieDeclaration, useConsentValue, …), so a Next app
// needs no second dependency (LinkHub CM-L7e). The names exported above win over React's same-named helpers.
export * from '@cookiemunch/react';
