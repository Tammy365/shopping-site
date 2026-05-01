// =======================
// public/js/cart.js
// 最终干净版本（无 HTML 实体，无污染）
// =======================

class Cart {
  constructor() {
    this.key = 'shopping_cart_v1';
    this.items = this.load();        // { pid: qty }
    this.cache = new Map();          // pid -> {name, price}

    this.$items = document.querySelector('#cart-items');
    this.$total = document.querySelector('#total-price');

    this.render();
  }

  // ----- 工具 -----
  escapeHTML(str = '') {
    return String(str).replace(/[&<>\"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[m]));
  }

  formatMoney(hk) {
    return `HK$${Number(hk || 0).toFixed(2)}`;
  }

  // ----- 本地存取 -----
  load() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) || {};
    } catch {
      return {};
    }
  }

  save() {
    localStorage.setItem(this.key, JSON.stringify(this.items));
  }

  qty(pid) {
    return Number(this.items[pid] || 0);
  }

  // ----- 修改购物车 -----
  async add(pid, delta = 1) {
    const n = this.qty(pid) + Number(delta || 1);
    if (n <= 0) delete this.items[pid];
    else this.items[pid] = n;

    this.save();
    await this.render();
    this.toast(`Added to cart`);
  }

  async set(pid, qty) {
    qty = Number(qty || 0);
    if (qty <= 0) delete this.items[pid];
    else this.items[pid] = qty;

    this.save();
    await this.render();
  }

  async remove(pid) {
    delete this.items[pid];
    this.save();
    await this.render();
  }

  // ----- 取产品信息 -----
  async fetchMeta(pid) {
    if (this.cache.has(pid)) return this.cache.get(pid);

    const res = await fetch(`/api/product?pid=${pid}`);
    const p = await res.json();
    const meta = (!p || p.error)
      ? { name: `#${pid}`, price: 0 }
      : { name: p.name, price: Number(p.price) };

    this.cache.set(pid, meta);
    return meta;
  }

  // ----- 渲染侧边栏 -----
  async render() {
    if (!this.$items || !this.$total) return;

    const pids = Object.keys(this.items);
    if (pids.length === 0) {
      this.$items.innerHTML = `<div class="cart-empty">(No items)</div>`;
      this.$total.textContent = this.formatMoney(0);
      return;
    }

    let html = '';
    let total = 0;

    for (const pid of pids) {
      const { name, price } = await this.fetchMeta(pid);
      const qty = this.items[pid];
      const line = Number(price) * Number(qty);
      total += line;

      html += `
        <div class="cart-item" data-pid="${pid}">
          <span class="item-name">${this.escapeHTML(name)}</span>
          <input type="number" class="item-quantity" min="1" value="${qty}">
          <span class="item-total">${this.formatMoney(line)}</span>
          <button type="button" class="remove" title="Remove">×</button>
        </div>`;
    }

    this.$items.innerHTML = html;
    this.$total.textContent = this.formatMoney(total);

    // 修改数量
    this.$items.querySelectorAll('.item-quantity').forEach(inp => {
      inp.addEventListener('change', e => {
        const wrap = e.target.closest('.cart-item');
        if (!wrap) return;
        const pid = wrap.dataset.pid;
        this.set(pid, Number(e.target.value));
      });
    });

    // 删除商品
    this.$items.querySelectorAll('.remove').forEach(btn => {
      btn.addEventListener('click', e => {
        const wrap = e.target.closest('.cart-item');
        if (!wrap) return;
        const pid = wrap.dataset.pid;
        this.remove(pid);
      });
    });
  }

  // ----- 提示 -----
  toast(text) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(this._timer);
    this._timer = setTimeout(() => t.classList.remove('show'), 1000);
  }
}

// 初始化购物车实例
window.cart = new Cart();

function extractPidFromPathname(pathname = '') {
  const m = String(pathname).match(/^\/\d+-[^/]+\/(\d+)-[^/]+\/?$/);
  return m ? m[1] : null;
}
function extractPidFromURL(urlStr = '') {
  try {
    const u = new URL(urlStr, location.origin);
    const pidQ = u.searchParams.get('pid');
    if (pidQ && /^[0-9]+$/.test(pidQ)) return pidQ;
    const pidP = extractPidFromPathname(u.pathname);
    if (pidP && /^[0-9]+$/.test(pidP)) return pidP;
    return null;
  } catch {
    return null;
  }
}
function extractPidFromLocation() {
  const pidQ = new URLSearchParams(location.search).get('pid');
  if (pidQ && /^[0-9]+$/.test(pidQ)) return pidQ;
  const pidP = extractPidFromPathname(location.pathname);
  if (pidP && /^[0-9]+$/.test(pidP)) return pidP;
  return null;
}

window.bindProductPageAdd = function(pid) {
  const root = document.getElementById('product-details');
  if (!root) return;
  if (root.__boundAddToCart) return;
  root.__boundAddToCart = true;

  const btn = root.querySelector('.add-to-cart');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const p = pid && /^[0-9]+$/.test(String(pid)) ? String(pid) : extractPidFromLocation();
    if (!p) return;
    const qtyInput = root.querySelector('.quantity');
    const qty = Number(qtyInput?.value || 1);
    window.cart.add(p, qty);
  });
};


// ==========================
// Checkout 功能（完全干净）
// ==========================
window.checkout = async function () {
  const items = window.cart.items;  // <--- 正确使用实例

  const payload = { items: [] };
  for (const pid in items) {
    payload.items.push({ pid: Number(pid), qty: items[pid] });
  }

  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const json = await res.json();
  if (!res.ok) {
    alert(json.error || 'Checkout failed');
    return;
  }

  // 清空购物车
  window.cart.items = {};
  window.cart.save();
  window.cart.render();

  // 跳转 PayPal
  location.href = json.redirect;
};


// 绑定 Checkout 按钮
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('.checkout');
  if (btn) {
    btn.addEventListener('click', window.checkout);
  }
});

// Add to Cart
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.add-to-cart');
  if (!btn) return;

  const card = btn.closest('.product');
  if (card) {
    const link = card.querySelector('h3 a');
    if (!link) return;
    const pid = extractPidFromURL(link.href);
    if (!pid) return;
    const qtyInput = card.querySelector('.quantity');
    const qty = Number(qtyInput?.value || 1);
    window.cart.add(pid, qty);
    return;
  }

  const root = btn.closest('#product-details') || document.getElementById('product-details');
  const pid = extractPidFromLocation();
  if (!root || !pid) return;
  const qtyInput = root.querySelector('.quantity');
  const qty = Number(qtyInput?.value || 1);
  window.cart.add(pid, qty);
});
