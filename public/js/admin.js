function $(sel){return document.querySelector(sel)}
function create(el, attrs={}){const e=document.createElement(el);Object.assign(e, attrs);return e}
async function fetchJSON(url, opts){ const res = await fetch(url, opts); return res.json(); }

let CSRF_TOKEN = null;
async function ensureCSRF(){
  if (CSRF_TOKEN) return CSRF_TOKEN;
  const data = await fetchJSON('/api/csrf');
  CSRF_TOKEN = data.csrf;
  return CSRF_TOKEN;
}

// ==== 顶部显示登录状态 + Logout（若 admin.html 没有按钮也不报错）====
async function showLoginStatus(){
  try{
    const me = await fetchJSON('/api/me');
    const who = $('#who');
    if(who){
      who.textContent = me.loggedIn ? `Logged in as: ${me.email}${me.admin ? ' (admin)' : ''}` : 'Not logged in';
    }
  }catch{
    const who = $('#who');
    if(who) who.textContent = 'Not logged in';
  }
}
async function doLogout(){
  try{ await fetch('/api/logout', { method:'POST' }); }
  finally{ location.href = '/login.html'; }
}
document.addEventListener('DOMContentLoaded', ()=>{
  showLoginStatus();
  const btn = $('#logout-btn');
  if(btn) btn.addEventListener('click', doLogout);
});

// ====== 渲染分类与商品 ======
async function refreshCategories(){
  const cats = await fetchJSON('/api/categories');
  const catList = $('#cat-list');
  const delSel = $('#cat-delete-select');
  const prodSel = $('#prod-catid');
  const updSel  = $('#upd-catid');
  const filterSel = $('#filter-catid');

  if(catList) catList.innerHTML = '';
  if(delSel) delSel.innerHTML   = '';
  if(prodSel) prodSel.innerHTML = '';
  if(updSel)  updSel.innerHTML  = '<option value="">(no change)</option>';
  if(filterSel) filterSel.innerHTML = '<option value="">All</option>';

  for (const c of cats){
    if(catList) catList.appendChild(create('li', { innerText: `${c.catid}: ${c.name}` }));
    if(delSel)  delSel.appendChild(create('option', { value: c.catid, innerText: `${c.name} (#${c.catid})` }));
    if(prodSel) prodSel.appendChild(create('option', { value: c.catid, innerText: c.name }));
    if(updSel)  updSel.appendChild(create('option', { value: c.catid, innerText: c.name }));
    if(filterSel) filterSel.appendChild(create('option', { value: c.catid, innerText: c.name }));
  }
}

async function refreshProducts(){
  const catid = $('#filter-catid') ? $('#filter-catid').value : '';
  const url = catid ? `/api/products?catid=${catid}` : '/api/products';
  const items = await fetchJSON(url);
  const table = $('#prod-table');
  if(!table) return;
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
}

// ====== 事件：写操作都附带 CSRF ======
const formAddCat = $('#form-add-cat');
if(formAddCat) formAddCat.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const form = e.target;
  const data = new URLSearchParams(new FormData(form));
  data.append('csrf', await ensureCSRF());
  const res = await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body: data
  });
  if(!res.ok){ alert('Add category failed'); return; }
  form.reset();
  await refreshCategories();
});

const btnDelCat = $('#btn-del-cat');
if(btnDelCat) btnDelCat.addEventListener('click', async ()=>{
  const sel = $('#cat-delete-select');
  const id = sel ? sel.value : '';
  if(!id) return;
  const url = `/api/categories/${id}?csrf=${encodeURIComponent(await ensureCSRF())}`;
  await fetch(url, { method: 'DELETE' });
  await refreshCategories();
  await refreshProducts();
});

const formAddProd = $('#form-add-product');
if(formAddProd) formAddProd.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const data = new FormData(e.target);
  data.append('csrf', await ensureCSRF());
  const res = await fetch('/api/products', { method:'POST', body:data });
  const json = await res.json();
  if(json.errors) alert(JSON.stringify(json.errors));
  e.target.reset();
  await refreshProducts();
});

const formUpdProd = $('#form-update-product');
if(formUpdProd) formUpdProd.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const id = fd.get('id');
  fd.delete('id');
  for(const [k,v] of Array.from(fd.entries())){
    if(typeof v === 'string' && v.trim() === '') fd.delete(k);
  }
  fd.append('csrf', await ensureCSRF());
  const res = await fetch(`/api/products/${id}`, { method:'PUT', body:fd });
  const json = await res.json();
  if(json.errors){
    alert('Update failed:\n' + JSON.stringify(json.errors, null, 2));
  }else{
    await refreshProducts();
    e.target.reset();
  }
});

const formDelProd = $('#form-del-product');
if(formDelProd) formDelProd.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const id = fd.get('id');
  const url = `/api/products/${id}?csrf=${encodeURIComponent(await ensureCSRF())}`;
  await fetch(url, { method:'DELETE' });
  e.target.reset();
  await refreshProducts();
});

// ====== 启动渲染 ======
document.addEventListener('DOMContentLoaded', async ()=>{
  await refreshCategories();
  await refreshProducts();
});