# Security Report (Web Programming & Security)

Project: Shopping Site (Node.js + Express + SQLite)

This report describes the system design and the security defenses implemented in this codebase, why they improve security, and what to keep updated when the project evolves.

## 1) System Design (Step-by-step)

### Step 1 — Choose a simple, auditable architecture
- Backend: Express server with a small set of JSON APIs.
- Frontend: Static HTML + JavaScript served from `/public`.
- Database: SQLite (`db/shop.db`) accessed via parameterized queries.
- Files: Image uploads stored under `/uploads` and served via a static route.

Security value:
- Fewer moving parts makes it easier to reason about trust boundaries and to audit attack surface.
- A single backend entry point allows centralized validation, authentication, authorization, and security headers.

### Step 2 — Define trust boundaries and threat model
Key attacker capabilities considered:
- Unauthenticated user trying to access privileged endpoints.
- Authenticated user attempting privilege escalation (user → admin).
- Web attacker attempting XSS, CSRF, SQL injection, file upload abuse.
- Tampering with payment/cart data coming from the browser.

Key protected assets:
- User credentials and login session tokens.
- Admin-only management actions (create/update/delete categories/products).
- Orders and payment status integrity.
- Uploaded files and server filesystem.

### Step 3 — Implement data storage with relational constraints
- SQLite foreign keys enabled (`PRAGMA foreign_keys=ON`).
- Tables: `users`, `sessions`, `categories`, `products`, `orders`, `order_items`.

Security value:
- Referential integrity reduces orphaned data and some classes of logic bugs that can become security issues.

## 2) Implemented Security Defenses

### 2.1 Password storage: adaptive hashing (bcrypt)
Implementation:
- Passwords are stored as bcrypt hashes (cost factor 12) during registration and password changes.
- Login verifies by bcrypt compare (no plaintext password stored).

Security value:
- Bcrypt is deliberately slow and includes salt, which defends against rainbow tables and increases the cost of offline cracking if the database leaks.

Where:
- Backend auth endpoints: `POST /api/register`, `POST /api/login`, `POST /api/change-password` in `server.js`.
- Utility wrapper exists in `utils/hash.js` (bcrypt with 12 rounds).

### 2.2 Session management: server-side sessions + secure cookies
Implementation:
- After a successful login, the server generates a cryptographically strong random session token (`crypto.randomBytes(32)`), stores it in `sessions`, and sets it in a cookie named `auth`.
- Cookies are set with:
  - `httpOnly: true` (prevents JavaScript from reading the session token)
  - `sameSite: 'Strict'` (prevents cookie from being sent on cross-site requests, mitigating CSRF)
  - `secure: IS_PROD` (cookie is sent only over HTTPS in production)
  - `maxAge` is set (client-side expiry)
- Session fixation mitigation:
  - On login, old sessions for the user are deleted before a new token is issued.
- On password change, all sessions for that user are deleted and the cookie is cleared (forces re-login).

Security value:
- Server-side session store allows invalidation (logout, password change).
- Random tokens prevent guessing attacks.
- HttpOnly + Secure + SameSite reduces session theft and CSRF risk.
- Clearing existing sessions prevents session fixation and reduces the value of stolen/old tokens.

Where:
- `requireLogin`, `requireAdmin`, and the auth endpoints in `server.js`.

### 2.2.1 HTTPS / Transport security (deployment expectation)
Implementation:
- The server is proxy-aware (`app.set('trust proxy', true)`), which is the common setup when TLS is terminated by a reverse proxy (e.g., Nginx / a cloud load balancer).
- Session and CSRF cookies use `secure: IS_PROD`, so in production (`NODE_ENV=production`) cookies are only sent over HTTPS.

Security value:
- HTTPS prevents passive network attackers from reading credentials, session tokens, and order/payment traffic in transit.
- Secure cookies reduce the chance of session leakage over accidental HTTP links.

Operational requirement:
- For production, deploy behind HTTPS and set `NODE_ENV=production`.

### 2.3 Authorization (Access Control): explicit admin guard
Implementation:
- Admin-only APIs require `requireAdmin` middleware which checks `users.is_admin = 1` via a session lookup.
- The admin HTML page is protected by explicit routes (`/admin`, `/admin.html`) defined before static serving.

Security value:
- Prevents unauthenticated access and privilege escalation to admin functions.
- Protecting the admin page itself reduces accidental exposure even if users know the URL.

Where:
- `requireAdmin` middleware and admin routes in `server.js`.
- Admin-protected APIs: categories/products CRUD, orders listing.

### 2.4 CSRF protection for state-changing admin actions
Implementation:
- `GET /api/csrf` issues a CSRF token and sets a `csrf_token` cookie (HttpOnly, Secure in prod, SameSite Strict).
- State-changing admin endpoints (`POST/PUT/DELETE` for categories and products) require `validateCSRF`.
- Frontend admin code fetches `/api/csrf` once, then includes the token in request body or query string.

Security value:
- Cross-site requests cannot read the token due to Same-Origin Policy, and cookies are not sent cross-site due to SameSite Strict.
- Even if a browser sends a cross-site form submission, it will not contain the correct CSRF token, so the server rejects it.

Where:
- `GET /api/csrf` and `validateCSRF` in `server.js`.
- Token usage in `public/js/admin.js`.

Note:
- This is essentially a “token + cookie match” approach. It is effective for this architecture, but should be paired with strong XSS defenses because XSS can bypass CSRF by making same-origin requests.

### 2.5 SQL injection prevention: parameterized queries
Implementation:
- Database access uses SQLite parameter placeholders (`?`) with separate parameter arrays.
- Even dynamic updates (products update endpoint) still use prepared parameters for user-supplied values.

Security value:
- Separates code from data; prevents attackers from injecting SQL syntax through input fields.

Where:
- Most DB calls in `server.js` use `db.get/db.all/db.run` with `?` parameters.

### 2.6 Input validation and normalization
Implementation:
- Uses `express-validator`:
  - Email validation + normalization
  - Password length checks
  - Integer checks for IDs (`catid`, `pid`, route params)
  - Float checks for `price`
  - Length limits for `description`
- Validation failures return HTTP 400 with structured errors.

Security value:
- Reduces attack surface for injection and logic abuse (e.g., negative quantities, non-integer IDs).
- Prevents oversized or malformed data from reaching sensitive logic.

Where:
- Validators around endpoints in `server.js`.

### 2.7 XSS mitigation: output encoding + restrictive CSP
Implementation (encoding):
- Server escapes product/category text when returning JSON (`escapeHTML` + `sanitizeProduct`).
- Some frontend rendering uses `textContent` (safer) and also applies `escapeHTML` before writing into `innerHTML`.

Implementation (browser policy):
- Content Security Policy header is set for all responses:
  - `default-src 'self'`
  - `script-src 'self'`
  - `img-src 'self' data: blob:`
  - `object-src 'none'`
  - `base-uri 'self'`
  - `frame-ancestors 'none'`
  - `style-src 'self' 'unsafe-inline'`

Security value:
- Output encoding prevents untrusted data from becoming executable HTML/JS.
- CSP reduces the impact of XSS by blocking third-party scripts and disallowing dangerous resource types.
- `frame-ancestors 'none'` helps prevent clickjacking.

Where:
- `escapeHTML` and `sanitizeProduct` in `server.js`.
- CSP and security headers middleware in `server.js`.

Important note about inline CSS:
- `style-src` includes `'unsafe-inline'` because some pages generate inline styles via HTML strings (e.g., in admin UI).
- Allowing inline styles weakens CSP slightly (mostly relevant for style injection), but it is still better than allowing inline scripts.
- A stronger future improvement is moving all inline styles into `/public/css/styles.css` and then removing `'unsafe-inline'`.

### 2.8 Security headers beyond CSP
Implementation:
- `X-Content-Type-Options: nosniff` (prevents MIME sniffing)
- `Referrer-Policy: no-referrer` (reduces sensitive URL leakage)
- `X-Frame-Options: DENY` (defense-in-depth for clickjacking)
- `X-Powered-By` is disabled (reduces fingerprinting)

Security value:
- Hardens the browser environment and reduces information disclosure.

Where:
- Security headers middleware in `server.js`.

### 2.9 File upload hardening: size limit + re-encoding images
Implementation:
- Upload size limit is enforced by Multer (≤ 10MB).
- Uploaded images are re-processed by `sharp` and re-encoded into JPEG thumbnails:
  - `/uploads/big/{pid}_big.jpg`
  - `/uploads/small/{pid}_small.jpg`
- Temporary upload file is deleted after processing.

Security value:
- File size limit reduces DoS risk and storage abuse.
- Re-encoding to JPEG helps neutralize some polyglot-file tricks and strips active content that may exist in original file formats.
- Storing images outside `/public` and serving from a controlled static mount simplifies resource isolation.

Where:
- Multer config and `saveResizedImages` in `server.js`.

### 2.10 Payment / order integrity: server-side total + digest
Implementation:
- Checkout accepts cart items but always re-reads current prices from the database and computes total server-side.
- A SHA-256 digest is computed over currency, merchant id, salt, line items, and total, then stored with the order.
- On PayPal return, the digest is recomputed from stored order + items and compared; mismatch blocks completion.

Security value:
- Prevents client-side cart tampering (changing price/total in the browser).
- Digest acts as a tamper-evident checksum for critical order fields.

Where:
- `/api/checkout`, `/api/paypal/capture` in `server.js`.

### 2.11 Error handling: avoid leaking internals
Implementation:
- Most API failures return generic messages like `DB error` or `Internal error`.
- Central error handler returns `500` with a generic JSON error.

Security value:
- Reduces information disclosure that could help attackers (e.g., SQL details, stack traces).

Where:
- Endpoint handlers and final `app.use((err,...))` in `server.js`.

## 3) Frontend Security Design Notes (CSS / JS)

### External vs inline CSS (and why it matters)
Current state:
- Main CSS is served as an external file: `/public/css/styles.css`.
- Some UI blocks use inline `style=""` inside HTML strings, which required enabling `'unsafe-inline'` for `style-src` in CSP.

Security value:
- External CSS allows a stricter CSP (ideally `style-src 'self'` only), which reduces the impact of injection.
- Minimizing inline styles avoids needing `'unsafe-inline'`, which is a common CSP weakening.

Recommendation:
- Move inline styles from JS-generated HTML to the CSS file, then remove `'unsafe-inline'` from CSP.

### External vs inline JS
Current state:
- JavaScript is loaded from `/public/js/*.js` (same origin).
- CSP includes `script-src 'self'` and does not allow inline scripts.

Security value:
- Blocks injected `<script>` tags and prevents loading third-party scripts by default.

## 4) Known Gaps / Improvements to Consider (Security Course Focus)

These are not fully implemented yet, but are important in a security-focused course.

### 4.1 Secrets management (critical)
Issue:
- PayPal client id and secret are hard-coded in `server.js`.

Risk:
- Secrets in source code are easily leaked (Git history, screenshots, shared zip files).
- Leaked credentials can be abused to impersonate the merchant or drain sandbox quotas.

Recommendation:
- Move secrets to environment variables (e.g., `PAYPAL_CLIENT`, `PAYPAL_SECRET`) and fail fast if missing in production.
- Never commit real keys; use `.env` locally (not committed) or deployment secret storage.

### 4.2 Session expiration and cleanup
Issue:
- `sessions` records do not currently expire server-side (cookie expires on the client only).

Recommendation:
- Add `expires_at` to sessions and validate it in `requireLogin/requireAdmin`, or delete sessions older than a threshold.

### 4.3 Rate limiting and brute-force defenses
Issue:
- No rate limiting on `/api/login` or other sensitive endpoints.

Recommendation:
- Add IP-based and/or account-based rate limits for login and password change.
- Consider progressive delays or temporary lockouts after repeated failures.

### 4.4 Stronger upload validation
Issue:
- Upload flow relies primarily on size limit and `sharp` processing; explicit MIME/type validation is limited.

Recommendation:
- Validate `mimetype` and/or magic bytes; reject non-image formats early.
- Consider limiting dimensions to reduce CPU usage during image processing.

### 4.5 Hardened headers (production)
Recommendation:
- Add `Strict-Transport-Security` (HSTS) when deployed behind HTTPS.
- Consider `Permissions-Policy` to reduce unnecessary browser features.

## 5) Update Checklist (when code changes)

Whenever you update the project, also update this report to reflect:
- New endpoints: authentication requirements, authorization rules, and CSRF coverage.
- Any new user input: validation rules and output-encoding strategy.
- Any new database queries: verify parameter binding (no string concatenation with user input).
- Any new client-side `innerHTML`: ensure values are properly escaped or use DOM APIs (`textContent`, `createElement`).
- Any new third-party integration: how secrets are stored, how callbacks are validated, and how integrity is checked.
- Any new static resources: confirm CSP and security headers still allow only what is necessary.
- Any new file upload: size/type limits, re-encoding, path safety, and storage layout.
