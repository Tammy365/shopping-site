// public/js/main.js
function $(sel){ return document.querySelector(sel); }
function getQuery(name){ const u = new URLSearchParams(location.search); return u.get(name); }

// 固定顺序：Home → Fruits → Drinks
const NAV_ORDER = ['Fruits', 'Drinks'];

/** 拉取分类并返回 Map(name -> {catid, name}) */
async function fetchCategoriesMap(){
  const res = await fetch('/api/categories');
  const cats = await res.json();
  return new Map(cats.map(c => [c.name, c]));
}

/** DOM方式渲染导航避免转义 */
async function renderNav(){
  const map = await fetchCategoriesMap();
  const ul = $('#nav-categories');
  ul.innerHTML = ''; // 清空

  // Home
  const liHome = document.createElement('li');
  const aHome = document.createElement('a');
  aHome.href = '/';
  aHome.textContent = 'Home';
  liHome.appendChild(aHome);
  ul.appendChild(liHome);

  // 按固定顺序添加 Fruits / Drinks（仅当DB里存在时）
  for (const name of NAV_ORDER) {
    const c = map.get(name);
    if (!c) continue;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `/?catid=${c.catid}`;
    a.textContent = c.name;
    li.appendChild(a);
    ul.appendChild(li);
  }
}

/** 构建一个产品卡片（DOM 节点） */
function productCardNode(p){
  const imgJson = p.image ? JSON.parse(p.image) : null; // {small, big?}
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
    img.alt = p.name;

    wrapper.appendChild(img);
    aImg.appendChild(wrapper);
    card.appendChild(aImg);
  }

  const h3 = document.createElement('h3');
  const aTitle = document.createElement('a');
  aTitle.href = href;
  aTitle.textContent = p.name;
  h3.appendChild(aTitle);
  card.appendChild(h3);

  const price = document.createElement('p');
  price.textContent = `HK$${Number(p.price).toFixed(2)}`;
  card.appendChild(price);

  const qc = document.createElement('div');
  qc.className = 'quantity-controls';

  const input = document.createElement('input');
  input.type = 'number';
  input.min = '1';
  input.value = '1';
  input.className = 'quantity';

  const btn = document.createElement('button');
  btn.className = 'add-to-cart';
  btn.textContent = 'Add to Cart';

  qc.appendChild(input);
  qc.appendChild(btn);
  card.appendChild(qc);

  return card;
}

/** 渲染产品列表（DOM 追加） */
async function renderProducts(){
  const catid = getQuery('catid');
  const url = catid ? `/api/products?catid=${catid}` : '/api/products';
  const res = await fetch(url);
  const items = await res.json();

  const list = $('#product-list');
  list.innerHTML = '';
  items.forEach(p => list.appendChild(productCardNode(p)));
  if (window.bindAddToCartButtons) window.bindAddToCartButtons(list);
}


// 启动
(async function init(){
  await renderNav();
  await renderProducts();
})();
