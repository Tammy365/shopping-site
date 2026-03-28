// public/js/admin.js

function $(sel){ return document.querySelector(sel); }
function create(el, attrs={}){ const e=document.createElement(el); Object.assign(e, attrs); return e; }

async function fetchJSON(url, opts){
  const res = await fetch(url, opts);
  let data = null;
  try{ data = await res.json(); }catch{}
  if (!res.ok){
    const msg = data?.error || (Array.isArray(data?.errors) ? JSON.stringify(data.errors) : `HTTP ${res.status}`);
    const err = new Error(msg); err.status = res.status; err.data = data; throw err;
  }
  return data;
}

let CSRF_TOKEN = null;
async function ensureCSRF(){
  if (CSRF_TOKEN) return CSRF_TOKEN;
  const data = await fetchJSON('/api/csrf'); // set-cookie: csrf_token=...
  CSRF_TOKEN = data?.csrf;
  return CSRF_TOKEN;
}

// 顶部状态 + Logout 
async function showLoginStatus(){
  try{
    const me = await fetchJSON('/api/me');
    const who = $('#who');
    if (who) who.textContent = me.loggedIn ? `Logged in as: ${me.email}${me.admin?' (admin)':''}` : 'Not logged in';
  }catch{
    const who = $('#who'); if (who) who.textContent = 'Not logged in';
  }
}
async function doLogout(){
  try{ await fetch('/api/logout', { method:'POST' }); }
  finally{ location.href = '/login.html'; }
}
document.addEventListener('DOMContentLoaded', ()=>{
  showLoginStatus();
  const btn = $('#logout-btn'); if (btn) btn.addEventListener('click', doLogout);
});

// 渲染分类与商品
async function refreshCategories(){
  const cats = await fetchJSON('/api/categories');
  const catList   = $('#cat-list');
  const delSel    = $('#cat-delete-select');
  const prodSel   = $('#prod-catid');
  const updSel    = $('#upd-catid');
  const filterSel = $('#filter-catid');

  if (catList)   catList.innerHTML   = '';
  if (delSel)    delSel.innerHTML    = '';
  if (prodSel)   prodSel.innerHTML   = '';
  if (updSel)    updSel.innerHTML    = '<option value="">(no change)</option>';
  if (filterSel) filterSel.innerHTML = '<option value="">All</option>';

  for (const c of cats){
    if (catList)  catList.appendChild(create('li', { innerText: `${c.catid}: ${c.name}` }));
    if (delSel)   delSel.appendChild(create('option', { value: c.catid, innerText: `${c.name} (#${c.catid})` }));
    if (prodSel)  prodSel.appendChild(create('option', { value: c.catid, innerText: c.name }));
    if (updSel)   updSel.appendChild(create('option', { value: c.catid, innerText: c.name }));
    if (filterSel)filterSel.appendChild(create('option', { value: c.catid, innerText: c.name }));
  }

  // 只绑定一次
  if (filterSel && !filterSel.__bound){
    filterSel.addEventListener('change', refreshProducts);
    filterSel.__bound = true;
  }
}

async function refreshProducts(){
  const table = $('#prod-table'); if (!table) return;
  try{
    const catid = $('#filter-catid') ? $('#filter-catid').value : '';
    const url = catid ? `/api/products?catid=${encodeURIComponent(catid)}` : '/api/products';
    const items = await fetchJSON(url);
    table.innerHTML = `
      <tr>
        <th>PID</th><th>Cat</th><th>Name</th><th>Price</th><th>Has Image</th>
      </tr>
      ${items.map(p => `
        <tr>
          <td>${p.pid}</td>
          <td>${p.catid ?? ''}</td>
          <td>${p.name}</td>
          <td>${p.price}</td>
          <td>${p.image ? '✔️' : ''}</td>
        </tr>
      `).join('')}
    `;
  }catch(err){
    table.innerHTML = `<tr><td colspan="5" style="color:#e74c3c;font-weight:600;">${err.message || 'Failed to load products'}</td></tr>`;
  }
}


// Add Category
const formAddCat = $('#form-add-cat');
if (formAddCat) formAddCat.addEventListener('submit', async (e)=>{
  e.preventDefault();
  try{
    const body = new URLSearchParams(new FormData(e.target));
    body.append('csrf', await ensureCSRF());
    await fetchJSON('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type':'application/x-www-form-urlencoded' },
      body
    });
    e.target.reset();
    await refreshCategories();
  }catch(err){ alert('Add category failed:\n' + (err.message||'')); }
});

// Delete Category
const btnDelCat = $('#btn-del-cat');
if (btnDelCat) btnDelCat.addEventListener('click', async ()=>{
  const sel = $('#cat-delete-select'); const id = sel ? sel.value : '';
  if (!id) return;
  try{
    await fetchJSON(`/api/categories/${encodeURIComponent(id)}?csrf=${encodeURIComponent(await ensureCSRF())}`, { method: 'DELETE' });
    await refreshCategories();
    await refreshProducts();
  }catch(err){ alert('Delete category failed:\n' + (err.message||'')); }
});

// Add Product.把 csrf 也放到 URL query，避免 validateCSRF 先于 multer 时拿不到 body.csrf
const formAddProd = $('#form-add-product');
if (formAddProd) formAddProd.addEventListener('submit', async (e)=>{
  e.preventDefault();
  try{
    const fd = new FormData(e.target);
    fd.append('csrf', await ensureCSRF()); // 保留
    const url = `/api/products?csrf=${encodeURIComponent(await ensureCSRF())}`; 
    const res = await fetch(url, { method:'POST', body: fd });
    let json = null; try{ json = await res.json(); }catch{}
    if (!res.ok) throw new Error(json?.error || (Array.isArray(json?.errors) ? JSON.stringify(json.errors) : `HTTP ${res.status}`));
    e.target.reset();
    await refreshProducts();
  }catch(err){ alert('Add product failed:\n' + (err.message||'')); }
});

// Update Product 
const formUpdProd = $('#form-update-product');
if (formUpdProd) formUpdProd.addEventListener('submit', async (e)=>{
  e.preventDefault();
  try{
    const fd = new FormData(e.target);
    const id = fd.get('id'); fd.delete('id');
    for (const [k,v] of Array.from(fd.entries())){
      if (typeof v === 'string' && v.trim() === '') fd.delete(k);
    }
    fd.append('csrf', await ensureCSRF());
    const url = `/api/products/${encodeURIComponent(id)}?csrf=${encodeURIComponent(await ensureCSRF())}`;
    const res = await fetch(url, { method:'PUT', body: fd });
    let json = null; try{ json = await res.json(); }catch{}
    if (!res.ok) throw new Error(json?.error || (Array.isArray(json?.errors) ? JSON.stringify(json.errors) : `HTTP ${res.status}`));
    await refreshProducts();
    e.target.reset();
  }catch(err){ alert('Update failed:\n' + (err.message||'')); }
});

// Delete Product
const formDelProd = $('#form-del-product');
if (formDelProd) formDelProd.addEventListener('submit', async (e)=>{
  e.preventDefault();
  try{
    const fd = new FormData(e.target);
    const id = fd.get('id');
    await fetchJSON(`/api/products/${encodeURIComponent(id)}?csrf=${encodeURIComponent(await ensureCSRF())}`, { method:'DELETE' });
    e.target.reset();
    await refreshProducts();
  }catch(err){ alert('Delete failed:\n' + (err.message||'')); }
});




async function loadOrders(){
  const container = document.getElementById('admin-orders');
  if (!container) return;

  try{
    const orders = await fetchJSON('/api/orders');

    // 只显示已支付订单
    const paidOrders = orders.filter(o => o.status === 'paid');

    if (paidOrders.length === 0){
      container.innerHTML = '<p style="color:#777;">No paid orders yet.</p>';
      return;
    }

    container.innerHTML = paidOrders.map(o => `
      <div style="padding:10px;margin-bottom:12px;border:1px solid #ddd;border-radius:6px;">
        <strong>Order #${o.orderid}</strong><br>
        Total: HK$${o.total}<br>
        Status: ${o.status}<br>
        Created: ${o.created_at}
        <ul>
          ${o.items.map(i =>
            `<li>${i.name} × ${i.qty} @ HK$${i.price}</li>`
          ).join('')}
        </ul>
      </div>
    `).join('');
  }catch(err){
    container.innerHTML = `<p style="color:#e74c3c;">Failed to load orders</p>`;
  }
}

// 页面加载时统一初始化
document.addEventListener('DOMContentLoaded', async ()=>{
  await ensureCSRF();
  await refreshCategories();
  await refreshProducts();
  await loadOrders();          
});