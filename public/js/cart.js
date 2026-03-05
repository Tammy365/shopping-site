// public/js/cart.js
class Cart {
  constructor() {
    this.key = 'shopping_cart_v1';
    this.items = this.load();                // { pid: qty, ... }
    this.cache = new Map();                  // { pid: {name, price} }

    this.$items = document.querySelector('#cart-items');
    this.$total = document.querySelector('#total-price');

    this.render();
  }

  // ---------- 工具 ----------
  escapeHTML(s = '') {
    return String(s).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }
  formatMoney(value) {
    try {
      return new Intl.NumberFormat('en-HK', {
        style: 'currency',
        currency: 'HKD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Number(value || 0));
    } catch {
      const v = Number(value || 0);
      return `HK$${v.toFixed(2)}`;
    }
  }

  // ---------- 存取 ----------
  load() {
    try { return JSON.parse(localStorage.getItem(this.key)) || {}; }
    catch { return {}; }
  }
  save() { localStorage.setItem(this.key, JSON.stringify(this.items)); }
  qty(pid) { return Number(this.items[pid] || 0); }

  // ---------- 修改购物车 ----------
  async add(pid, delta = 1) {
    const n = this.qty(pid) + Number(delta || 1);
    if (n <= 0) delete this.items[pid];
    else this.items[pid] = n;

    this.save();
    await this.render();
    await this._notifyAdded(pid, Number(delta || 1)); // 动效 & 提示
  }
  async set(pid, q) {
    const n = Math.max(0, Number(q || 0));
    if (n === 0) delete this.items[pid];
    else this.items[pid] = n;

    this.save();
    await this.render();
  }
  async remove(pid) {
    delete this.items[pid];
    this.save();
    await this.render();
  }

  // ---------- 后端取产品信息 ----------
  async fetchMeta(pid) {
    if (this.cache.has(pid)) return this.cache.get(pid);
    const res = await fetch(`/api/product?pid=${pid}`);
    const p = await res.json();
    if (p && !p.error) {
      const meta = { name: p.name, price: Number(p.price) };
      this.cache.set(pid, meta);
      return meta;
    }
    const fallback = { name: `#${pid}`, price: 0 };
    this.cache.set(pid, fallback);
    return fallback;
  }

  // ---------- 渲染侧栏 ----------
  async render() {
    if (!this.$items || !this.$total) return;

    const pids = Object.keys(this.items);
    if (pids.length === 0) {
      this.$items.innerHTML = '<div class="cart-empty">(No items)</div>';
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
        <div class="cart-item" data-pid="${this.escapeHTML(pid)}">
          <span class="item-name">${this.escapeHTML(name)}</span>
          <input type="number" class="item-quantity" min="1" value="${qty}">
          <span class="item-total">${this.formatMoney(line)}</span>
          <button type="button" class="remove" title="Remove">×</button>
        </div>
      `;
    }

    this.$items.innerHTML = html;
    this.$total.textContent = this.formatMoney(total);

    // 事件：修改数量
    this.$items.querySelectorAll('.item-quantity').forEach(inp => {
      inp.addEventListener('change', e => {
        const wrap = e.target.closest('.cart-item');
        if (!wrap) return;
        const pid = wrap.dataset.pid;
        const val = Number(e.target.value || 0);
        if (Number.isFinite(val) && val >= 0) this.set(pid, val);
      });
    });

    // 事件：删除
    this.$items.querySelectorAll('.remove').forEach(btn => {
      btn.addEventListener('click', e => {
        const wrap = e.target.closest('.cart-item');
        if (!wrap) return;
        const pid = wrap.dataset.pid;
        this.remove(pid);
      });
    });
  }

  // ---------- 加入购物车动效 & 提示 ----------
  async _notifyAdded(pid, delta) {
    try {
      const meta = await this.fetchMeta(pid);
      this._toast(`Added to cart: ${this.escapeHTML(meta.name)} × ${delta}`);
    } catch {
      this._toast(`Added to cart`);
    }
    this._bumpCartIcon();
  }
  _toast(msg = '') {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 1200);
  }
  _bumpCartIcon() {
    const icon = document.querySelector('.cart-icon');
    if (!icon) return;
    icon.classList.remove('bump'); // 允许短时间内重复触发
    void icon.offsetWidth;         // 触发 reflow 以重启动画
    icon.classList.add('bump');
    setTimeout(() => icon.classList.remove('bump'), 400);
  }
}

// 单例（挂到 window，供其它脚本调用）
window.cart = new Cart();

/** 给商品列表上的 “Add to Cart” 绑定事件（主页/分类页用） */
window.bindAddToCartButtons = function (root = document) {
  root.querySelectorAll('.product .add-to-cart').forEach(btn => {
    btn.addEventListener('click', e => {
      const card = e.target.closest('.product');
      if (!card) return;
      const link = card.querySelector('h3 a');    // /product.html?pid=...
      if (!link) return;
      const pid = new URL(link.href).searchParams.get('pid');
      const qtyInput = card.querySelector('.quantity');
      const qty = Number(qtyInput?.value || 1);
      window.cart.add(pid, qty);
    });
  });
};

/** 给详情页的 “Add to Cart” 绑定事件（根据当前 pid） */
window.bindProductPageAdd = function (pid) {
  const btn = document.querySelector('.product-info .add-to-cart');
  const qtyInput = document.querySelector('.product-info .quantity');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const qty = Number(qtyInput?.value || 1);
    window.cart.add(pid, qty);
  });
};