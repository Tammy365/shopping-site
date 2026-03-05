// public/js/product-page.js

function $(sel){ return document.querySelector(sel); }
function q(name){ return new URLSearchParams(location.search).get(name); }

function escapeHTML(s=''){
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
}

// 固定显示顺序（导航显示为 Home, Fruits, Drinks）
const NAV_ORDER = ['Fruits', 'Drinks'];

// 读取所有分类，返回 Map(name -> categoryObj)
async function fetchCategoriesMap(){
  const res = await fetch('/api/categories');
  const cats = await res.json();
  return new Map(cats.map(c => [c.name, c]));
}

// 渲染顶部导航（固定顺序，但数据从 DB 来）
async function renderNav(){
  const map = await fetchCategoriesMap();
  const ul  = $('#nav-categories');
  const html = [
    `<li><a href="/">Home</a></li>`,
    ...NAV_ORDER
      .filter(name => map.has(name))
      .map(name => {
        const c = map.get(name);
        return `<li><a href="/?catid=${c.catid}">${escapeHTML(c.name)}</a></li>`;
      })
  ];
  ul.innerHTML = html.join('');
  return map; // 返回供后续渲染面包屑使用
}

// 渲染商品详情
async function renderProduct(){
  const pid = q('pid');
  if(!pid){
    $('#product-details').innerText = 'No product id';
    return;
  }

  // 拉取单个产品数据
  const resp = await fetch(`/api/product?pid=${pid}`);
  const p    = await resp.json();
  if(p.error){
    $('#product-details').innerText = p.error;
    return;
  }

  // 解析图片字段（后端把 {big, small} 以 JSON 字符串存到 image）
  let img = null;
  if (p.image) {
    try { img = (typeof p.image === 'string') ? JSON.parse(p.image) : p.image; }
    catch { img = null; }
  }

  // 获取分类映射，找出该产品的分类对象（用于“返回分类”和面包屑显示）
  const map     = await fetchCategoriesMap();
  const catObj  = [...map.values()].find(c => String(c.catid) === String(p.catid));
  const catName = catObj ? catObj.name : 'Category';
  const catHref = catObj ? `/?catid=${catObj.catid}` : '/';

  // ✅ 使用 <img> 标签渲染大图；链接使用 <a href="..."> 标准写法
  $('#product-details').innerHTML = `
    <div class="product-image">
      ${img && img.big ? `<img src="${img.big}" alt="${escapeHTML(p.name)}">` : ''}
    </div>
    <div class="product-info">
      <h2>${escapeHTML(p.name)}</h2>
      <p class="price">HK$${Number(p.price).toFixed(2)}</p>
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

  // ✅ 面包屑（可点击）
  $('#breadcrumb').innerHTML = `
    <a href="/">Home</a> &gt;
    <a href="${catHref}">${escapeHTML(catName)}</a> &gt;
    <span>${escapeHTML(p.name)}</span>
  `;

  // 渲染完成后绑定 “Add to Cart” 按钮
  if (window.bindProductPageAdd) window.bindProductPageAdd(pid);
}

// 启动
(async function init(){
  await renderNav();
  await renderProduct();
})();