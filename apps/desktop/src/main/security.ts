/**
 * Main-process security hardening.
 *
 * Centralises the Electron security baseline recommended by the official
 * checklist: a strict Content-Security-Policy, blocking of in-app navigation
 * to untrusted origins, denial of arbitrary window creation, and refusal of
 * all renderer permission requests (camera, geolocation, etc.) which the app
 * does not use.
 *
 * These guards are applied process-wide via `app.on('web-contents-created')`
 * and the session header hook, so they protect every `WebContents`, not just
 * the main window.
 */
import { app, session, shell, type WebContents } from 'electron';

/**
 * Content-Security-Policy applied to renderer responses.
 *
 * `script-src 'self'` forbids inline/eval scripts; `style-src` allows the inline
 * styles Vite/Tailwind inject during development and at runtime; images allow
 * `data:` URIs for inlined assets. No remote origins are permitted.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: mas-img:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join('; ');

/** Origins the renderer is permitted to navigate to in development. */
function isAllowedNavigation(targetUrl: string): boolean {
  const devServer = process.env.ELECTRON_RENDERER_URL;
  if (devServer !== undefined && targetUrl.startsWith(devServer)) {
    return true;
  }
  // Production loads the renderer from the file system.
  return targetUrl.startsWith('file://');
}

/** Attach the CSP header to every renderer response. */
function applyContentSecurityPolicy(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [CSP],
      },
    });
  });

  // Deny all permission prompts — the app requires none of them.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false);
  });
  session.defaultSession.setPermissionCheckHandler(() => false);
}

/** Harden a single `WebContents`: block navigation, popups and webview attach. */
function hardenWebContents(contents: WebContents): void {
  // Block navigation away from the app to untrusted origins.
  contents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  // Never open new Electron windows; route external links to the OS browser.
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Disallow attaching <webview> tags entirely.
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}

/**
 * Install all process-wide security policies. Must be called once, before any
 * window is created (typically right after `app.whenReady()`).
 */
export function installSecurityPolicies(): void {
  applyContentSecurityPolicy();
  app.on('web-contents-created', (_event, contents) => {
    hardenWebContents(contents);
  });
}

export const CONTENT_SECURITY_POLICY = CSP;
