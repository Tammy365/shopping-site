function $(sel){return document.querySelector(sel)}
function create(el, attrs={}){const e=document.createElement(el);Object.assign(e, attrs);return e}
async function fetchJSON(url, opts){ const res = await fetch(url, opts); return res.json(); }

// ====== 新增：顶部显示登录状态，并提供 Logout ======
async function showLoginStatus(){
  try{
    const me = await fetchJSON('/api/me');
    const who = $('#who');
    if(me.loggedIn){
      who.textContent = `Logged in as: ${me.email}${me.admin ? ' (admin)' : ''}`;
    }else{
      who.textContent = 'Not logged in';
    }
  }catch{
    const who = $('#who');
    if(who) who.textContent = 'Not logged in';
  }
}
async function doLogout(){
  try{
    await fetch('/api/logout', { method:'POST' });
  }finally{
    location.href = '/login.html';
  }
}
document.addEventListener('DOMContentLoaded', ()=>{
  showLoginStatus();
  const btn = $('#logout-btn');
  if(btn) btn.addEventListener('click', doLogout);
});

// ====== 你原有的 Admin 逻辑 ======
async function refreshCategories(){
  const cats = await fetchJSON('/api/categories');
  const catList = $('#cat-list');
  const delSel = $('#cat-delete-select');
  const prodSel = $('#prod-catid');
  const updSel = $('#upd-catid');
  const filterSel = $('#filter-catid');

  catList.innerHTML = '';
  delSel.innerHTML = '';
  prodSel.innerHTML = '';
  updSel.innerHTML = '<option value="">(no change)</option>';
  filterSel.innerHTML = '<option value="">All</option>';

  for (const c of cats){
    catList.appendChild(create('li', { innerText: `${c.catid}: ${c.name}` }));
    delSel.appendChild(create('option', { value: c.catid, innerText: `${c.name} (#${c.catid})` }));
    prodSel.appendChild(create('option', { value: c.catid, innerText: c.name }));
    updSel.appendChild(create('option', { value: c.catid, innerText: c.name }));
    filterSel.appendChild(create('option', { value: c.catid, innerText: c.name }));
  }
}

async function refreshProducts(){
  const catid = $('#filter-catid').value;
  const url = catid ? `/api/products?catid=${catid}` : '/api/products';
  const items = await fetchJSON(url);
  const table = $('#prod-table');

  // 画一个简单表格
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

// 事件绑定
$('#form-add-cat').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const form = e.target;
  const data = new URLSearchParams(new FormData(form));
  const res = await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type':'application/x-www-form-urlencoded' },
    body: data
  });
  if(!res.ok){ alert('Add category failed'); return; }
  form.reset();
  await refreshCategories();
});

$('#btn-del-cat').addEventListener('click', async ()=>{
  const id = $('#cat-delete-select').value;
  if(!id) return;
  await fetch(`/api/categories/${id}`, { method: 'DELETE' });
  await refreshCategories();
  await refreshProducts();
});

$('#form-add-product').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const data = new FormData(e.target);
  const res = await fetch('/api/products', { method:'POST', body:data });
  const json = await res.json();
  if(json.errors) alert(JSON.stringify(json.errors));
  e.target.reset();
  await refreshProducts();
});

$('#form-update-product').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const id = fd.get('id');
  fd.delete('id');
  // 删除空字符串字段，避免触发后端校验
  for(const [k,v] of Array.from(fd.entries())){
    if(typeof v === 'string' && v.trim() === '') fd.delete(k);
  }
  const res = await fetch(`/api/products/${id}`, { method:'PUT', body:fd });
  const json = await res.json();
  if(json.errors){
    alert('Update failed:\n' + JSON.stringify(json.errors, null, 2));
  }else{
    await refreshProducts();
    e.target.reset();
  }
});

$('#form-del-product').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const fd = new FormData(e.target);
  const id = fd.get('id');
  await fetch(`/api/products/${id}`, { method:'DELETE' });
  e.target.reset();
  await refreshProducts();
});

document.addEventListener('DOMContentLoaded', async ()=>{
  await refreshCategories();
  await refreshProducts();
});
