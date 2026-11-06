window.__TARONYANG_CONFIG__ = window.__TARONYANG_CONFIG__ || {};

/**
 * Cloudflare Web Analytics token.
 * Get it from Cloudflare dashboard → Web Analytics → Add a site.
 * Set to empty string to disable the beacon (custom event tracking still works).
 */
window.__TARONYANG_CONFIG__.analyticsToken = window.__TARONYANG_CONFIG__.analyticsToken || '';

/**
 * Social login (Kakao/Naver/Google) UI visibility — ZEMA-3418.
 * Hidden by default until OAuth provider credentials are configured server-side.
 * Set to true to re-enable the social login section on /login.
 */
window.__TARONYANG_CONFIG__.socialLoginEnabled = window.__TARONYANG_CONFIG__.socialLoginEnabled === true;
