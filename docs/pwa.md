# Progressive web app

The app uses Next.js manifest metadata, static PNG icons, and a small service worker. No additional runtime dependencies are required.

Run `npm run build` and `npm start` to test installation on localhost. Deployed installations require HTTPS. Service worker registration is intentionally disabled in development. In supported Chromium browsers the footer displays an install button after the browser fires `beforeinstallprompt`. On iPhone, open in Safari and use Share → Add to Home Screen. Embedded webviews may require opening the site in the system browser.

The service worker caches only the dedicated offline document and app icons. Pages always use the network; failed document navigations display the offline page. Registration, payments, APIs, and React Server Component payloads are never cached or queued. Tools and course pages require connectivity. Increment the cache version in `public/sw.js` when changing offline assets; updates activate after existing app tabs close.

Release checks: open the production site online, confirm the manifest and active service worker in browser developer tools, install it, then disconnect and navigate to confirm the offline fallback. Reconnect and retry. Check 320px, 390px, 768px, and desktop layouts, menu keyboard behavior, and reduced-motion preferences.
