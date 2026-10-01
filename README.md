# TRIBES GitHub + Firebase Starter

## Local checkout setup

1. Copy `.env.example` to `.env`.
2. Set a unique `ADMIN_LOGIN_ID` and a strong `ADMIN_PASSWORD` in `.env`; these are server-only credentials and are not committed to the frontend.
3. Add your Razorpay **Test** API key ID and secret to `.env`.
4. Run `npm start` and open `http://localhost:5500/cart.html`.
5. Open `http://localhost:5500/admin/index.html`; unauthenticated requests are sent to the Admin sign-in page.
6. Use Razorpay test payment details while testing. Never commit `.env` or production secrets.

The Admin session is held in an HTTP-only cookie and expires after eight hours. The Express server protects `/admin` and provides Admin sign-in, session, and sign-out endpoints. Host the Admin pages and server on the same origin for server-enforced route protection. GitHub Pages is static hosting and cannot protect the Admin route; do not use it to host a production Admin portal. If hosting the Admin UI on a different origin, set `ADMIN_ALLOWED_ORIGIN` to its exact origin, set `window.TRIBES_API_BASE_URL` in `js/api-config.js` to the backend HTTPS URL, and run the backend with `NODE_ENV=production`.

Publish `firestore.rules` in Firebase Console → Firestore Database → Rules and `storage.rules` in Firebase Console → Storage → Rules for the `tribes-c55f4` project before adding products. The Merchant workspace reports whether a failed upload was denied by Storage or whether Firestore denied the product listing. Storage accepts image files smaller than 5 MB; product writes are limited to the required catalog fields and, if provided, a GST rate from 0 to 100 percent.

## Merchant portal

Merchants sign in at `merchant-login.html` and are routed to the separate `merchant-portal.html` catalog workspace, not the Admin dashboard. The portal lists products tagged with that merchant ID and allows adding products with a photo, price, discount, per-product GST percentage, and stock. GSTIN is optional at registration. GST percentage is stored and displayed as listing information; it does not change the listed price or checkout total. The merchant shop photo is saved in that browser's local storage and can also be added or changed from the Merchant workspace; existing registrations without a saved photo must add one there. Existing Firestore rules deny product updates and deletes, so the portal does not offer those actions. Merchant accounts and sessions currently use browser `localStorage`; this is a demo flow, not secure authentication or production-grade merchant data isolation. Run the app at one stable origin such as `http://localhost:5500` (or the same HTTPS host). Do not open individual HTML files using `file://`: browsers may isolate storage by file, making a registration appear successful on one page while sign-in cannot find it on another. Accounts created from `file://` must be registered again through the served site. Use Firebase Authentication and rules tied to authenticated merchant identities before production.

## Free GitHub Pages hosting

1. Create or open a GitHub repository and upload this project.
2. In GitHub, open **Settings → Pages** and choose **GitHub Actions** as the source.
3. Push to `master` or `main`; `.github/workflows/pages.yml` deploys the static storefront automatically.
4. Your free URL will be `https://YOUR-USERNAME.github.io/REPOSITORY-NAME/`.

The storefront market-photo carousel uses photographs from Wikimedia Commons of weekly markets in Araku Valley, Andhra Pradesh. Each photo links to its source and lists its artist and Creative Commons license.

GitHub Pages cannot run the Node/Razorpay server. Deploy `server.js` separately, then put its public HTTPS URL in `js/api-config.js` as `window.TRIBES_API_BASE_URL`. Leave it empty for a static catalog without checkout payments.

The checkout uses `/api/orders` to create an order and `/api/payments/verify` to verify the payment signature. Before production, validate cart prices and quantities against a trusted server-side catalog and add webhook handling for final payment status.

## Local GPS order tracking

Customer and Delivery Partner GPS sharing is opt-in from their order pages. Admins can share the Admin device's GPS as the Merchant pickup point from **Live Tracking**. Order and location updates use this browser's `localStorage`, so the relevant Customer, Delivery Partner, and Admin pages must be open in tabs in the same browser profile; updates are not shared across phones or devices. Sharing stops when the user stops it, leaves the page, or the order is marked delivered. The route graphic is a straight-line preview, not road navigation. Catalog pickup coordinates are area-level estimates unless a live pickup location is shared. Browser geolocation requires permission and a secure context such as `localhost` or HTTPS.

This local-only implementation is a demo, not production live tracking. Cross-device operation requires moving account/order data to an authenticated shared backend and adding access-control rules before storing GPS coordinates remotely.

1. Create Firebase project, Firestore and Storage.
2. Put Firebase Web App configuration in js/firebase-config.js.
3. Configure Authentication and Firebase Security Rules before production.
4. Upload this folder to GitHub and enable GitHub Pages.
5. Connect your owned www.tribes.info domain in GitHub Pages.
6. Razorpay secret keys must NEVER be placed in frontend/GitHub. Use a secure backend (Cloud Functions/Cloud Run/server) to create Razorpay orders and verify signatures/webhooks.
Fields: Product Name, UOM, Quantity, AVLB Stk, Price, Image URL.
