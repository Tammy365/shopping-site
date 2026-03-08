// public/js/product-page.js
function $(sel){ return document.querySelector(sel); }
function q(name){ return new URLSearchParams(location.search).get(name); }

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
  return await res.json();
}
async function renderNav(){
  const ul = $('#nav-categories');
  const cats = await fetchCategories();

  const byName = new Map(cats.map(c => [c.name, c]));
  const ORDER_FIRST = ['Fruits','Drinks'];
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

// ---- Render product (redirect home on invalid pid) ----
async function renderProduct(){
  const pid = q('pid');

  // 1) 非整数 → 跳首页
  if (!pid || !isIntLike(pid)) { location.replace('/'); return; }

  // 2) 拉取商品；非 2xx/错误 JSON → 跳首页
  let p;
  try{
    const resp = await fetch(`/api/product?pid=${encodeURIComponent(pid)}`);
    if (!resp.ok){ location.replace('/'); return; }
    p = await resp.json();
    if (p && p.error) { location.replace('/'); return; }
  }catch{
    location.replace('/'); return;
  }

  // 3) 解析 image
  let img = null;
  try{
    img = p.image ? (typeof p.image === 'string' ? JSON.parse(p.image) : p.image) : null;
  }catch{ img = null; }

  // 4) 渲染导航并构建面包屑与“Back to Category”
  let catsMap = null;
  try{ catsMap = await renderNav(); }catch{}

  const catObj  = catsMap ? catsMap.get(String(p.catid)) : null;
  const catName = catObj ? catObj.name : 'Category';
  const catHref = catObj ? `/?catid=${catObj.catid}` : '/';

  const priceNum = Number(p.price);
  const priceHTML = Number.isFinite(priceNum) ? `HK$${priceNum.toFixed(2)}` : 'HK$—';

  const mount = $('#product-details');
  const breadcrumb = $('#breadcrumb');
  if (!mount) { location.replace('/'); return; }

  mount.innerHTML = `
    <div class="product-image">
      ${img && img.big ? `<img src="${img.big}" alt="${escapeHTML(p.name || '')}" />` : ''}
    </div>
    <div class="product-info">
      <h2>${escapeHTML(p.name || '')}</h2>
      <p class="price">${priceHTML}</p>
      <p class="description">${escapeHTML(p.description || '')}</p>
      <div class="quantity-controls">
        <input type="number" min="1" value="1" class="quantity">
        <button class="add-to-cart">Add to Cart</button>
      </div>
      <p class="category">Back to Category:
        <a href="${catHref}">${escapeHTML(catName)}</a>
      </p>
    </div>
  `;

  if (breadcrumb) {
    breadcrumb.innerHTML =
      `<a href="/">Home</a> &gt; <a href="${catHref}">${escapeHTML(catName)}</a> &gt; <span>${escapeHTML(p.name || '')}</span>`;
  }

  if (window.bindProductPageAdd) window.bindProductPageAdd(pid);
}

// ---- bootstrap ----
(async function init(){
  try{ await renderNav(); }catch{}
  await renderProduct();
})();