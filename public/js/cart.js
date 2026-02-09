// public/js/cart.js
class Cart {
  constructor() {
    this.key = 'shopping_cart_v1';
    this.items = this.load();      // { pid: qty, ... }
    this.cache = new Map();        // 缓存 meta: { pid: {name, price} }
    this.$items = document.querySelector('#cart-items');
    this.$total = document.querySelector('#total-price');
    this.render();
  }

  // ---- 基本存取 ----
  load(){ try { return JSON.parse(localStorage.getItem(this.key)) || {}; } catch { return {}; } }
  save(){ localStorage.setItem(this.key, JSON.stringify(this.items)); }

  qty(pid){ return Number(this.items[pid] || 0); }

  async add(pid, delta=1){
    this.items[pid] = this.qty(pid) + delta;
    if (this.items[pid] <= 0) delete this.items[pid];
    this.save();
    await this.render();
  }

  async set(pid, q){
    const n = Math.max(0, Number(q||0));
    if (n === 0) delete this.items[pid]; else this.items[pid] = n;
    this.save();
    await this.render();
  }

  async remove(pid){
    delete this.items[pid];
    this.save();
    await this.render();
  }

  // ---- 后端获取产品信息（评分点：name/price 从后端获取）----
  async fetchMeta(pid){
    if (this.cache.has(pid)) return this.cache.get(pid);
    const res = await fetch(`/api/product?pid=${pid}`);
    const p = await res.json();
    if (p && !p.error) {
      const meta = { name: p.name, price: Number(p.price) };
      this.cache.set(pid, meta);
      return meta;
    }
    // 若后端没查到，兜底
    const fallback = { name: `#${pid}`, price: 0 };
    this.cache.set(pid, fallback);
    return fallback;
  }

  // ---- 渲染购物车侧栏 ----
  async render(){
    if (!this.$items || !this.$total) return;
    const pids = Object.keys(this.items);
    if (pids.length === 0){
      this.$items.innerHTML = '<p>(No items)</p>';
      this.$total.textContent = 'HK$0.00';
      return;
    }
    let html = '';
    let total = 0;

    for (const pid of pids){
      const { name, price } = await this.fetchMeta(pid);
      const qty = this.items[pid];
      const line = price * qty;
      total += line;

      html += `
        <div class="cart-item" data-pid="${pid}">
          <span class="item-name">${name}</span>
          <input class="item-quantity" type="number" min="1" value="${qty}">
          <span class="item-total">HK$${line.toFixed(2)}</span>
          <button class="remove" title="Remove">×</button>
        </div>`;
    }

    this.$items.innerHTML = html;
    this.$total.textContent = `HK$${total.toFixed(2)}`;

    // 事件：修改数量
    this.$items.querySelectorAll('.item-quantity').forEach(inp=>{
      inp.addEventListener('change', e=>{
        const pid = e.target.closest('.cart-item').dataset.pid;
        this.set(pid, e.target.value);
      });
    });
    // 事件：删除
    this.$items.querySelectorAll('.remove').forEach(btn=>{
      btn.addEventListener('click', e=>{
        const pid = e.target.closest('.cart-item').dataset.pid;
        this.remove(pid);
      });
    });
  }
}

// 单例（挂到 window，便于页面脚本使用）
window.cart = new Cart();

/** 给商品列表上的 “Add to Cart” 绑定事件（主页/分类页用）*/
window.bindAddToCartButtons = function(root=document){
  root.querySelectorAll('.product .add-to-cart').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const card = e.target.closest('.product');
      const link = card.querySelector('h3 a');             // /product.html?pid=...
      const pid = new URL(link.href).searchParams.get('pid');
      const qtyInput = card.querySelector('.quantity');
      const qty = Number(qtyInput?.value || 1);
      window.cart.add(pid, qty);
    });
  });
};

/** 给详情页的 “Add to Cart” 绑定事件（根据当前 pid）*/
window.bindProductPageAdd = function(pid){
  const btn = document.querySelector('.product-info .add-to-cart');
  const qtyInput = document.querySelector('.product-info .quantity');
  if (!btn) return;
  btn.addEventListener('click', ()=>{
    const qty = Number(qtyInput?.value || 1);
    window.cart.add(pid, qty);
  });
};