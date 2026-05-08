# Final Report — Shopping Site (Web Programming & Security)

Student Name: **[TODO: fill]**  
Student ID: **[TODO: fill]**  
Course: Web Programming and Security  
Project: Shopping Site (Node.js + Express + SQLite)  
Repository/Submission: **[TODO: fill link or submission package name]**

This report documents the completion of the required phases (Phase 1–5) and implemented extensions (Phase 6). It uses concrete examples from my current codebase and includes placeholders where manual screenshots are required.

Deployed domain used in the screenshot instructions below:
- https://s61.iems5718.iecuhk.cc/

---

## 1) Phase 1 — Cloud/VM & Networking (AWS/Azure/Cloud)

### 1A. Cloud dashboard + URL accessibility
My backend is an Express server (`server.js`) serving both static pages and JSON APIs on port **3000** by default.

- Public URL: https://s61.iems5718.iecuhk.cc/ (**[TODO: confirm this is the final URL you submit]**)
- VM/Cloud provider: **[TODO: AWS / Azure / GCP / other]**
- VM instance details: **[TODO: instance name / region / OS]**

**[TODO: Screenshot]** Cloud dashboard showing:
- the VM instance running
- virtual network / security group (or firewall) rules
- inbound rules allowing HTTP/HTTPS to the site

中文截图指引（Phase 1A）：
- 截图 1：云平台“VM/Instance 列表”页面，能看到你的实例处于 running 状态（建议截图包含实例名称/ID、region、public IP）。
- 截图 2：安全组/防火墙入站规则（Inbound rules），至少显示允许 80/443（或你的平台要求的端口）访问。
- 如果你用反向代理（Nginx）或负载均衡（LB/Ingress），再补一张对应配置页面（可选但强烈建议）。
- 额外验证截图（可选）：浏览器打开 https://s61.iems5718.iecuhk.cc/ 成功展示首页（显示地址栏 URL）。

### 1B. Response headers do not expose server language/version; directory index disabled
In the backend, I disable Express’ fingerprinting header:
- `app.disable('x-powered-by');` in `server.js`

**How to verify**
- Run this command against your deployed URL:

```bash
curl -I https://s61.iems5718.iecuhk.cc/
```

**[TODO: paste the output of the curl command here]**

中文填写指引（Phase 1B - headers）：
- 你可以在本机 Terminal 运行上面的 `curl -I`，把输出整段复制粘贴到这里即可。
- 检查点：
  - 不应出现 `X-Powered-By: Express`（因为已在 `server.js` 里 `app.disable('x-powered-by')`）。
  - 建议同时截图浏览器 DevTools → Network → 选中 `/` → Response Headers 页面（可选，但老师容易查验）。

**Directory listing**
- The site serves static files via `express.static(...)` and does **not** enable directory listing. By default, Express does not provide an index-of-files view for a folder.
- Static mount points:
  - `app.use(express.static(path.join(__dirname, 'public')));`
  - `app.use('/uploads', express.static(path.join(__dirname, 'uploads')));`

**[TODO: Screenshot]** Browser showing that visiting a folder path does not show a directory listing (e.g., `/public/` should not be listable).

中文截图指引（Phase 1B - directory index / autoindex）：
- 重点不是一定要访问 `/public/`，而是要证明“访问一个目录路径时，不会列出目录文件清单（index of / ...）”。
- 对于本项目，建议你用下面这些“目录 URL”在浏览器打开，然后截图结果（任选 1–2 个即可，能证明没有目录列表）：
  - https://s61.iems5718.iecuhk.cc/css/
  - https://s61.iems5718.iecuhk.cc/js/
  - https://s61.iems5718.iecuhk.cc/uploads/
  - https://s61.iems5718.iecuhk.cc/uploads/big/
- 预期截图效果：
  - 页面显示 404/403/Not Found/Access Denied 等都可以；关键是“不要出现文件列表页面”（例如列出 `styles.css`, `main.js` 等等的目录索引）。
- 如果你的部署前面有 Nginx/Apache，确保没有开启 autoindex（截图出现 403/404 更能证明未开启目录列表）。

### 1C. Web server architecture explanation
High-level architecture:
- **Browser** loads HTML/CSS/JS from `/public/*`.
- **Express (Node.js)** serves:
  - static pages: `/`, `/product.html`, `/admin.html`, etc.
  - JSON APIs under `/api/*` (products, auth, orders, checkout)
- **SQLite** stores data in `db/shop.db` with tables such as `users`, `sessions`, `products`, `orders`.
- **Uploads** are stored under `/uploads` and served from `/uploads/...`.

Concrete code locations:
- Server entry: `server.js`
- Database schema example: `db/setup.sql`
- DB initializer (Phase 5 tables): `scripts/init-db.js`

**[TODO: Screenshot]** (Optional but recommended) a simple diagram (can be drawn) showing Browser → Express → SQLite, and the `/uploads` storage.

中文截图指引（可选架构图）：
- 可以用手画/绘图工具画一个框图，然后截图/导出贴在这里。
- 最少包含：Browser → (HTTPS) → Nginx/LB(如有) → Node/Express → SQLite(db/shop.db)；以及 Upload → /uploads → /uploads/big & /uploads/small。

---

## 2) Phase 2 (&4) — Products, Categories, Admin CRUD, Images, and Authorization

### 2A. Main page with products and categories
Main page:
- `public/index.html` loads the product list and category navigation.
- Frontend rendering is **client-side** using JavaScript:
  - Categories: `/api/categories`
  - Products list: `/api/products` (optionally `?catid=...`)

Concrete examples:
- API endpoint: `GET /api/categories` returns rows like `{ catid, name }` from SQLite.
- API endpoint: `GET /api/products?catid=2` returns products under one category.

Where it is implemented:
- Backend: product/category APIs in `server.js`
- Frontend: `public/js/main.js` renders:
  - the navigation bar (categories)
  - product “cards” and “Add to Cart” buttons

**[TODO: Screenshot]** Home page showing:
- category navigation (e.g., Fruits, Drinks)
- product cards and Add-to-Cart UI

中文截图指引：
- 直接访问 https://s61.iems5718.iecuhk.cc/ 截图一张。
- 画面里要包含：顶部类别导航、至少 1–2 个商品卡片、以及 Add to Cart 按钮（购物车侧栏露出更好）。

#### 2A(i). Display products under a specific category
Category browsing is supported via SEO-friendly paths:
- Example: `/1-Fruits/` (category page)

Implementation details:
- Backend routes map category SEO URLs to the same HTML page:
  - `GET /:catid-:catName` → serves `public/index.html` (in `server.js`)
- Frontend reads category from the URL and calls:
  - `GET /api/products?catid=CATID`

**[TODO: Screenshot]** Category page URL like `/1-Fruits/` showing only products in that category.

中文截图指引：
- 打开一个类别页 URL（例如把 “Fruits” 的 catid 替换成你实际看到的数字）：
  - https://s61.iems5718.iecuhk.cc/1-Fruits/
- 截图要求：地址栏里要看到 `/1-Fruits/`，页面里商品数量/内容明显与 Home 的全量商品不同（只剩该分类）。

#### 2A(ii). Products have a detailed page
Product details page:
- Example (SEO URL): `/1-Fruits/1-Apple`
- The page fetches details from:
  - `GET /api/product?pid=1`

Frontend rendering:
- `public/js/product-page.js` dynamically builds the product detail UI (name, description, image, price).

**[TODO: Screenshot]** Product detail page showing:
- large product image
- name/price/description
- Add-to-Cart button

中文截图指引：
- 在分类页/首页点击某个商品进入详情页（SEO URL 形如 `/1-Fruits/1-Apple`）。
- 截图要求：地址栏包含该 SEO URL；页面里能看到大图、价格、描述、Add to Cart 按钮。

#### 2A(iii). Explain frontend rendering method
This project uses **client-side rendering**:
- HTML pages provide containers (e.g., `#product-list`, `#product-details`).
- JavaScript fetches JSON from `/api/*` and renders DOM.

Concrete examples:
- `main.js` uses `fetch('/api/products...')` and then appends DOM nodes for each product.
- `product-page.js` fetches `/api/product?pid=...` and injects the detail layout.

### 2B. Admin can create/delete products and categories
Admin panel:
- Page: `/admin.html` (served only to admin users)
- Admin operations call protected APIs:
  - Categories:
    - `POST /api/categories`
    - `DELETE /api/categories/:id`
  - Products:
    - `POST /api/products`
    - `PUT /api/products/:id`
    - `DELETE /api/products/:id`

Where it is implemented:
- Backend authorization middleware: `requireAdmin` in `server.js`
- Admin UI logic: `public/js/admin.js`

**[TODO: Screenshot]** Admin page showing category/product management forms and current product table.

中文截图指引：
- 先用管理员账号登录（例如 `admin@example.com`，密码按你的初始化设置）。
- 访问：https://s61.iems5718.iecuhk.cc/admin.html
- 截图要求：页面里能看到 Manage Categories、Manage Products、当前 Products 表格。

#### 2B(i). Automatic image resizing is performed
Image pipeline:
- Upload size limit enforced by Multer:
  - `limits: { fileSize: 10 * 1024 * 1024 }` (≤ 10MB)
- Server re-processes uploaded image using `sharp`:
  - “big” thumbnail: width **1200px**
  - “small” thumbnail: width **300px**
  - re-encoded to JPEG
- Saved paths:
  - `/uploads/big/{pid}_big.jpg`
  - `/uploads/small/{pid}_small.jpg`

Concrete code example:
- `saveResizedImages(tmpPath, pid)` in `server.js` creates the two thumbnails and deletes the temp file.

**[TODO: Screenshot]** Admin uploading a large image; then product detail page showing the resized big image.

中文截图指引：
- 截图 1（Admin 上传）：在 Admin 的 Insert Product 中上传一张“明显较大尺寸”的图片（例如手机原图），并提交创建商品；截图要看到你选了图片（有缩略图预览更好）。
- 截图 2（商品详情展示）：打开刚创建商品的详情页，截图大图正常显示（说明服务器已生成 big thumbnail）。

#### 2B(ii). New product/category is shown on the website
After creating a category/product from admin:
- Category list updates via `GET /api/categories`
- Product list updates via `GET /api/products`

**[TODO: Screenshot]** Add a new category/product in admin, then show it appears on the Home/Category page.

中文截图指引：
- 截图 1：Admin 新增 Category（或 Product）成功后的页面（能看到列表/表格里出现新项）。
- 截图 2：回到首页或对应分类页，能看到新 Category 出现在导航栏，或新 Product 出现在商品列表。

#### 2B(iii). Admin-panel paths are authorized users only
Protection mechanism:
- `/admin` and `/admin.html` are protected routes that run `requireAdmin` before serving the static file.
- If not logged in or not admin, the server redirects to `/login.html` (HTML flow) or returns JSON 403 (API flow).

Concrete example:
- Trying to open `/admin.html` in an incognito window should redirect to the login page.

**[TODO: Screenshot]** Access `/admin.html` without login → redirected/blocked.  
**[TODO: Screenshot]** Login as normal user → still blocked.  
**[TODO: Screenshot]** Login as admin → allowed.

中文截图指引（非常关键，老师会重点看）：
- 截图 A（未登录）：用浏览器无痕窗口访问 https://s61.iems5718.iecuhk.cc/admin.html  
  - 预期：被重定向到 `/login.html` 或显示无权限/Forbidden。
- 截图 B（普通用户）：注册/登录一个普通用户后，再访问 `/admin.html`  
  - 预期：仍然被阻止（403 或跳回 login）。
- 截图 C（管理员）：用管理员登录后访问 `/admin.html`  
  - 预期：正常进入 Admin Panel。

---

## 3) Phase 3 — Shopping Cart (No Page Reload)

Cart design:
- Implemented fully in the browser using `localStorage` and dynamic DOM updates.
- Storage key: `shopping_cart_v1` (see `public/js/cart.js`)

### 3A. Add product to cart; hover/side panel updates without reload
User action:
- Click “Add to Cart” on Home/Category product cards or on Product Detail page.

Concrete implementation:
- The `Cart` class updates localStorage and calls `render()` to re-render `#cart-items` and `#total-price` (in `cart.js`).
- After my fix, product detail page add-to-cart also works by extracting pid from either:
  - query string `?pid=...` or
  - SEO path `/CATID-name/PID-name`

**[TODO: Screenshot]** Add an item from Home → cart sidebar updates (no reload).  
**[TODO: Screenshot]** Add an item from Product Detail → cart sidebar updates (no reload).

中文截图指引：
- 截图 1（Home）：首页点击某商品 Add to Cart 后，右侧购物车栏出现该商品（地址栏不刷新/不跳转）。
- 截图 2（Detail）：进入某商品详情页点击 Add to Cart，同样右侧购物车栏更新（地址栏保持详情页 URL）。

### 3B. Change quantity and total updates without reload
Concrete implementation:
- Quantity inputs in the cart sidebar call `Cart.set(pid, qty)` on change.
- Total is recalculated and updated in-place (`#total-price`).

**[TODO: Screenshot]** Change quantity from 1 → 3 and show total changes instantly.

中文截图指引：
- 在右侧购物车栏把数量输入框从 1 改成 3，截图中同时包含“数量=3”和“Total 变化后的金额”。

### 3C. Decrease quantity to 0 removes the product
Concrete implementation:
- Setting quantity <= 0 removes the item entry and re-renders.
- A remove button “×” also exists per cart row.

**[TODO: Screenshot]** Set qty to 0 or click remove → item disappears from cart.

中文截图指引：
- 方式 1：把数量改成 0（如果 UI 不允许 0，就用 remove 按钮 “×”）。
- 截图要求：操作后该商品行从购物车列表消失。

---

## 4) Phase 4 — Authentication for Admin Panel + Security Defenses

### 4A. Security defenses: XSS, CSRF, SQLi, session fixation, etc.

#### Password hashing (bcrypt)
- Registration hashes password with bcrypt (cost factor 12).
- Login verifies with bcrypt compare.

Concrete endpoints:
- `POST /api/register` → `bcrypt.hash(password, 12)`
- `POST /api/login` → `bcrypt.compare(...)`

#### Server-side sessions + secure cookies
- Session token generated by `crypto.randomBytes(32)` and stored in `sessions` table.
- Cookie settings for `auth`:
  - `httpOnly: true`
  - `sameSite: 'Strict'`
  - `secure: IS_PROD` (HTTPS-only in production)

Session fixation mitigation:
- On login, the server deletes existing sessions for the user before issuing a new token.

Concrete code:
- Login flow in `server.js` deletes old sessions then inserts a new token.

#### CSRF protection (admin state-changing actions)
- `GET /api/csrf` sets a `csrf_token` cookie and also returns the token.
- Admin requests include the token; server validates cookie token matches request token.

Concrete examples:
- Admin JS fetches `/api/csrf` and appends `csrf` to POST/PUT and `?csrf=` to DELETE.
- Server middleware `validateCSRF` blocks mismatches with HTTP 403.

#### SQL injection prevention
- All SQLite queries use parameter placeholders `?` with separate parameters array.

Concrete example:
- `db.get('SELECT * FROM users WHERE email=?', [email], ...)`

#### XSS mitigation: encoding + CSP/security headers
- The backend escapes product/category names and descriptions when returning JSON (server-side output encoding).
- Security headers include (set in `server.js`):
  - Content-Security-Policy (CSP)
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
  - `X-Frame-Options: DENY`
  - Disable `X-Powered-By`

**[TODO: Screenshot]** Demonstrate:
- successful login/logout
- admin page cannot be accessed by non-admin
- (optional) browser devtools showing CSP/security headers on responses

中文截图指引：
- 建议用 2–3 张截图串起来：
  - 登录后首页右上角 authbar 显示 “Hello, email … Logout”
  - 点击 Logout 后变回 Login/Register
  - 非 admin 访问 `/admin.html` 被挡住（可复用前面 admin 授权截图）
  - 可选：DevTools → Network → 主页响应头里能看到 CSP 等安全头

### 4B. User can register, change password, and logout
Implemented pages:
- Register: `public/register.html` + `public/js/register.js`
- Login: `public/login.html` + `public/js/login.js`
- Change password: `public/change-password.html` + `public/js/change-password.js`
- Global auth bar (Home + Category + Product detail):
  - `public/js/authbar.js` calls `GET /api/me` and renders:
    - Login/Register links when not logged in
    - Hello/email + My Orders + Change Password + Logout (and Admin link if admin)

Concrete endpoints:
- `POST /api/login`
- `POST /api/register`
- `POST /api/change-password` (requires login; clears sessions afterward)
- `POST /api/logout`
- `GET /api/me`

**[TODO: Screenshot]** Register a new user, then login, then change password, then login again with the new password.

中文截图指引：
- 最少 3 张：
  - 注册成功（register 页成功跳转或提示）
  - 登录成功（首页 authbar 显示已登录）
  - 修改密码成功提示（change-password 页提示/跳转），然后用新密码再次登录成功

---

## 5) Phase 5 — Checkout Workflow (PayPal)

### 5A. Perform checkout on cart products
Checkout is initiated from the cart sidebar button “Checkout”:
- Frontend function `window.checkout()` in `public/js/cart.js` builds:
  - `items = [{ pid, qty }, ...]`
- Backend endpoint `POST /api/checkout`:
  - validates items
  - re-reads product prices from the database (server-side total)
  - creates an order in `orders` + `order_items`
  - returns a redirect URL to `/pay.html?orderid=...`

**[TODO: Screenshot]** Cart with items → click Checkout → redirected to pay page.

中文截图指引：
- 截图 1：购物车内有商品、Total 非 0
- 点击 Checkout 后截图 2：浏览器地址栏变为 `/pay.html?orderid=...`

### 5B. Admin can track orders in admin panel
Admin orders view:
- Admin page calls `GET /api/orders` and shows paid orders.
- Implementation in `public/js/admin.js` function `loadOrders()`.

**[TODO: Screenshot]** Admin panel showing Orders list after a successful payment.

中文截图指引：
- 完成一次 PayPal Sandbox 支付后，打开 `/admin.html`，在 Orders 区域截图能看到新订单（状态 paid、total、items）。

### 5C. Order verification after user completes payment
PayPal flow:
- `public/pay.html` loads `public/js/pay.js`
- `pay.js` calls `POST /api/paypal/create` to create a PayPal order, then redirects the user to PayPal approval URL.
- After approval, PayPal returns to:
  - `GET /api/paypal/capture?orderid=...&token=...`
- The server recomputes a SHA-256 digest over order integrity fields and compares it with stored digest before marking it paid.

Concrete server-side integrity check:
- `POST /api/checkout` computes a digest and stores it in the `orders` table.
- `GET /api/paypal/capture` recomputes and compares; mismatch blocks completion.

**[TODO: Screenshot]** PayPal sandbox approval screen.  
**[TODO: Screenshot]** After approval, show order status becomes `paid` in admin.

中文截图指引：
- 截图 1：PayPal Sandbox 的 approve/confirm 页面（显示金额与币种）
- 截图 2：支付完成回跳后，到 `/admin.html` 截图订单状态变成 `paid`

### 5D. User can check last orders; admin can check all orders
User “My Orders”:
- Page: `public/my-orders.html`
- Frontend: `public/js/my-orders.js` calls `GET /api/my-orders` and renders the latest orders.

Admin “All Orders”:
- API: `GET /api/orders` (admin-only)
- Admin UI displays paid orders in the Orders section.

**[TODO: Screenshot]** User account → My Orders page showing recent orders.  
**[TODO: Screenshot]** Admin panel → Orders section showing paid orders.

中文截图指引：
- 用普通用户登录后访问：https://s61.iems5718.iecuhk.cc/my-orders.html 截图最近订单列表
- Admin 端访问：https://s61.iems5718.iecuhk.cc/admin.html 截图 Orders 区域（paid orders）

---

## 6) Phase 6 — Extensions Implemented (Bonus)

### 6A. Extension 1 — SEO-friendly URLs (Category & Product)
Feature:
- Category browsing URL includes category name:
  - Example: `/2-Drinks/`
- Product detail URL includes category and product name:
  - Example: `/2-Drinks/3-Cola`

Backend mapping:
- `GET /:catid-:catName` → serves `public/index.html`
- `GET /:catid-:catName/:pid-:prodName` → serves `public/product.html`

Frontend:
- `public/js/main.js` generates SEO links for category nav and product cards.
- `public/js/product-page.js` parses pid from the SEO path and calls `/api/product?pid=...`.

**[TODO: Screenshot]** Show `/2-Drinks/` and `/2-Drinks/3-Cola` URLs working.

中文截图指引：
- 截图 1：打开一个分类 SEO URL（把数字/name 换成你实际的）例如：
  - https://s61.iems5718.iecuhk.cc/2-Drinks/
- 截图 2：从该分类点击进入商品详情 SEO URL，例如：
  - https://s61.iems5718.iecuhk.cc/2-Drinks/3-Cola

### 6A. Extension 2 — HTML5 Drag-and-drop upload in Admin + thumbnail preview + reject non-images
Feature:
- In admin panel (insert/update product), the Image field supports:
  - drag & drop image file
  - click to choose file
  - immediate thumbnail preview
  - reject non-image files
  - reject images > 10MB
  - remove/cancel selected image via “×” button on the preview (top-right)

Where:
- UI in `public/admin.html`:
  - dropzone: `#add-image-drop`, `#upd-image-drop`
  - preview: `#add-image-preview`, `#upd-image-preview`
  - remove button: `#add-image-remove`, `#upd-image-remove`
- Logic in `public/js/admin.js`:
  - `setupImageDrop(...)` handles drag/drop, preview, validation, and remove/cancel.

**[TODO: Screenshot]** Drag an image into the dropzone → preview appears.  
**[TODO: Screenshot]** Drag a non-image file → rejected.  
**[TODO: Screenshot]** Click “×” on the preview → preview clears and the image is not uploaded.

中文截图指引：
- 截图 1：Admin 页面里把图片拖进 dropzone 后，出现缩略图预览（右上角有 ×）
- 截图 2：拖一个非图片（如 .txt/.pdf）进 dropzone，弹出提示并被拒绝
- 截图 3：点击预览右上角 ×，预览消失（可再截图提交表单后服务器未更新图片作为佐证，选做）

### 6A. Extension 3 — Complete Order Management for Users (View / Pay again / Modify / Cancel)
Feature:
- The user can view **all** his/her orders (not only the latest few).
- For **unpaid** orders, the user can:
  - Pay again (resume payment for the same order)
  - Modify the order items/quantities
  - Cancel the order

User experience (concrete examples in this project):
- My Orders page: `/my-orders.html` shows all orders and renders action buttons for unpaid orders:
  - “Pay again” → redirects to `/pay.html?orderid=...`
  - “Modify” → opens an inline edit panel to adjust item quantities
  - “Cancel” → marks the order as `cancelled`

Backend APIs (concrete endpoints):
- `GET /api/my-orders` (requires login)
  - returns all orders of the current user, each with its `items`
- `PUT /api/my-orders/:orderid` (requires login + CSRF)
  - updates an unpaid order’s items and quantities
  - server re-computes total using live DB prices, and re-generates `(salt, digest)` for integrity
- `POST /api/my-orders/:orderid/cancel` (requires login + CSRF)
  - cancels an unpaid order (paid orders cannot be cancelled)

Security/consistency notes:
- Authorization: user can only modify/cancel orders where `orders.userid` equals the logged-in user.
- Integrity: after modification, the server recalculates totals from DB and updates digest fields to prevent client-side tampering.
- CSRF: modify/cancel endpoints require the existing CSRF token mechanism (`/api/csrf` + `validateCSRF`).

Where it is implemented:
- Frontend:
  - `public/my-orders.html` (UI + buttons)
  - `public/js/my-orders.js` (fetch, render, modify, cancel, pay again)
- Backend:
  - `GET /api/my-orders`, `PUT /api/my-orders/:orderid`, `POST /api/my-orders/:orderid/cancel` in `server.js`

**[TODO: Screenshot]** My Orders page showing multiple orders (paid + unpaid) and the action buttons on an unpaid order.  
**[TODO: Screenshot]** Click “Modify” → edit panel appears; change qty and “Save changes” → order total/items update after refresh.  
**[TODO: Screenshot]** Click “Cancel” on an unpaid order → status becomes `cancelled` (and buttons disappear).  
**[TODO: Screenshot]** Click “Pay again” on an unpaid order → redirected to `/pay.html?orderid=...` and can complete PayPal payment.

中文截图指引：
- 截图 1：登录普通用户后访问 https://s61.iems5718.iecuhk.cc/my-orders.html
  - 要求：页面里至少能看到 2 笔订单（建议一笔 paid、一笔 pending），并且 pending 订单卡片上有 Pay again / Modify / Cancel 三个按钮。
- 截图 2：点击 Modify 后截图（能看到编辑面板展开、每个商品旁边有数量输入框），修改数量后点击 Save changes，再刷新页面截一张证明 items/total 已更新。
- 截图 3：点击 Cancel 后截图（该订单状态变为 cancelled；并且该订单不再显示 Modify/Pay again 按钮）。
- 截图 4：点击 Pay again 后截图（地址栏跳到 `/pay.html?orderid=...`），以及完成 PayPal 后回到站点再截图订单变成 paid（可与 Phase 5 截图复用）。

---

## Appendix — Notes / Known Limitations (if any)

1) PayPal credentials
- The PayPal sandbox client/secret currently exist in `server.js`.
- **[TODO: If you moved them to environment variables, describe how; otherwise, note this as a security improvement to do before real deployment.]**

2) Deployment notes
- This codebase supports HTTPS cookie hardening in production via `NODE_ENV=production` (cookies set with `secure: true`).
- **[TODO: Describe your HTTPS termination setup (e.g., Nginx/Load Balancer) and include a screenshot of HTTPS lock icon.]**
