// public/js/cart.js

class Cart {
  constructor() {
    this.key = 'shopping_cart_v1';
    this.items = this.load();        // { pid: qty, ... }
    this.cache = new Map();          // meta 缓存：{ pid: {name, price} }

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

  // ---------- 存取 ----------
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

  // ---------- 修改购物车 ----------
  async add(pid, delta = 1) {
    const n = this.qty(pid) + Number(delta || 1);
    if (n <= 0) delete this.items[pid];
    else this.items[pid] = n;
    this.save();
    await this.render();
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
      this.$total.textContent = 'HK$0.00';
      return;
    }

    let html = '';
    let total = 0;

    for (const pid of pids) {
      const { name, price } = await this.fetchMeta(pid);
      const qty = this.items[pid];
      const line = price * qty;
      total += line;

      html += `
        <div class="cart-item" data-pid="${this.escapeHTML(pid)}">
          <div class="line">
            <span class="name">${this.escapeHTML(name)}</span>
            <input type="number" class="item-quantity" min="1" value="${qty}">
            <span class="line-price">HK$${line.toFixed(2)}</span>
            <button type="button" class="remove" title="Remove">×</button>
          </div>
        </div>
      `;
    }

    this.$items.innerHTML = html;
    this.$total.textContent = `HK$${total.toFixed(2)}`;

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
}

// 单例（挂到 window，供其它脚本调用）
window.cart = new Cart();

/** 给商品列表上的 “Add to Cart” 绑定事件（主页/分类页用） */
window.bindAddToCartButtons = function (root = document) {
  root.querySelectorAll('.product .add-to-cart').forEach(btn => {
    btn.addEventListener('click', e => {
      const card = e.target.closest('.product');
      if (!card) return;
      const link = card.querySelector('h3 a');        // /product.html?pid=...
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
``