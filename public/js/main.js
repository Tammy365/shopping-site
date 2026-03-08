// public/js/main.js
function $(sel){ return document.querySelector(sel); }
function getQuery(name){ const u = new URLSearchParams(location.search); return u.get(name); }

function escapeHTML(s=''){
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}
function isIntLike(v){ return /^[0-9]+$/.test(String(v)); }

// ---- Categories & Navigation ----
async function fetchCategories(){
  const res = await fetch('/api/categories');
  if (!res.ok) throw new Error('Failed to load categories');
  return await res.json(); // [{catid, name}]
}

/**
 * Render top nav:
 * Home + Fruits/Drinks first (if exist) + others (alphabetically)
 * Returns: Map(catid(string) -> categoryObj)
 */
async function renderNav(){
  const ul = $('#nav-categories');
  const cats = await fetchCategories();

  const byName = new Map(cats.map(c => [c.name, c]));
  const ORDER_FIRST = ['Fruits', 'Drinks'];
  const first = ORDER_FIRST.filter(n => byName.has(n)).map(n => byName.get(n));
  const others = cats.filter(c => !ORDER_FIRST.includes(c.name))
                     .sort((a,b)=> a.name.localeCompare(b.name));
  const all = first.concat(others);

  if (ul){
    ul.innerHTML = [
      `<li><a href="/">Home</a></li>`,
      ...all.map(c => `<li><a href="/?catid=${c.catid}">${escapeHTML(c.name)}</a></li>`)
    ].join('');
  }
  return new Map(cats.map(c => [String(c.catid), c]));
}

// ---- Product card ----
function productCardNode(p){
  // image is a JSON string {small,big}
  let imgJson = null;
  try{ imgJson = p.image ? JSON.parse(p.image) : null; }catch{ imgJson = null; }

  const href = `/product.html?pid=${p.pid}`;
  const card = document.createElement('div');
  card.className = 'product';

  if (imgJson && imgJson.small) {
    const aImg = document.createElement('a');
    aImg.href = href;
    const wrapper = document.createElement('div');
    wrapper.className = 'product-image';
    const img = document.createElement('img');
    img.src = imgJson.small;
    img.alt = p.name || '';
    wrapper.appendChild(img);
    aImg.appendChild(wrapper);
    card.appendChild(aImg);
  }

  const h3 = document.createElement('h3');
  const aTitle = document.createElement('a');
  aTitle.href = href;
  aTitle.textContent = p.name || '';
  h3.appendChild(aTitle);
  card.appendChild(h3);

  const price = document.createElement('p');
  const num = Number(p.price);
  price.textContent = Number.isFinite(num) ? `HK$${num.toFixed(2)}` : 'HK$—';
  card.appendChild(price);

  const qc = document.createElement('div');
  qc.className = 'quantity-controls';
  const input = document.createElement('input');
  input.type = 'number'; input.min = '1'; input.value = '1'; input.className = 'quantity';
  const btn = document.createElement('button');
  btn.className = 'add-to-cart'; btn.textContent = 'Add to Cart';
  qc.appendChild(input); qc.appendChild(btn);
  card.appendChild(qc);

  return card;
}

// ---- Render product list (redirect home on invalid catid) ----
async function renderProducts(){
  const list = $('#product-list'); if (!list) return;

  const catidParam = getQuery('catid');

  // 1) 非整数 → 跳首页
  if (catidParam != null && catidParam !== '' && !isIntLike(catidParam)) {
    location.replace('/'); return;
  }

  // 2) 整数但不存在 → 跳首页（解决 catid=3 被删后的情况）
  let url = '/api/products';
  try{
    const catsMap = await renderNav(); // 同时渲染导航
    if (catidParam != null && catidParam !== '') {
      const exists = catsMap && catsMap.has(String(catidParam));
      if (!exists) { location.replace('/'); return; }
      url = `/api/products?catid=${encodeURIComponent(catidParam)}`;
    }
  }catch{
    location.replace('/'); return;
  }

  // 3) 拉取产品；失败也跳首页（严谨按你的要求）
  try{
    const res = await fetch(url);
    if (!res.ok) { location.replace('/'); return; }
    const items = await res.json();
    if (!Array.isArray(items)) { location.replace('/'); return; }

    list.innerHTML = '';
    items.forEach(p => list.appendChild(productCardNode(p)));
    if (window.bindAddToCartButtons) window.bindAddToCartButtons(list);
  }catch{
    location.replace('/');
  }
}

// ---- bootstrap ----
(async function init(){
  try{ await renderNav(); }catch{}
  await renderProducts();
})();