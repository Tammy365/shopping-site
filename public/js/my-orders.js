(function () {
  function escapeHTML(s = '') {
    return String(s).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  async function fetchJSON(url, opts) {
    const res = await fetch(url, opts);
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const msg = data?.error || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  let CSRF = null;
  async function ensureCSRF() {
    if (CSRF) return CSRF;
    const data = await fetchJSON('/api/csrf');
    CSRF = data?.csrf;
    return CSRF;
  }

  function statusLabel(s) {
    if (s === 'paid') return { text: 'Verified (paid)', color: '#2e7d32' };
    if (s === 'pending') return { text: 'Unpaid', color: '#ef6c00' };
    if (s === 'cancelled') return { text: 'Cancelled', color: '#546e7a' };
    if (s === 'failed') return { text: 'Failed', color: '#c62828' };
    return { text: String(s || 'unknown'), color: '#546e7a' };
  }

  function formatMoney(hk) {
    const n = Number(hk);
    return Number.isFinite(n) ? `HK$${n.toFixed(2)}` : 'HK$—';
  }

  function orderCardHTML(o) {
    const st = statusLabel(o.status);
    const unpaid = o.status !== 'paid' && o.status !== 'cancelled';
    const items = Array.isArray(o.items) ? o.items : [];

    const itemsHTML = items.map(i => {
      const name = i.name ? i.name : `#${i.pid}`;
      return `<li>${escapeHTML(name)} × ${Number(i.qty)} @ ${formatMoney(i.price)}</li>`;
    }).join('');

    const editRowsHTML = items.map(i => {
      const name = i.name ? i.name : `#${i.pid}`;
      return `
        <div class="edit-row" data-pid="${Number(i.pid)}">
          <div>${escapeHTML(name)} <span style="color:#777;">@ ${formatMoney(i.price)}</span></div>
          <input class="qty" type="number" min="0" value="${Number(i.qty)}">
        </div>
      `;
    }).join('');

    return `
      <div class="order-card" data-orderid="${Number(o.orderid)}">
        <div class="order-header">
          Order #${Number(o.orderid)} — <span style="color:${st.color};font-weight:700;">${st.text}</span> — ${formatMoney(o.total)}
        </div>
        <div class="order-meta">${escapeHTML(o.created_at || '')}</div>

        <div class="order-items-title">Items</div>
        <ul class="order-items">${itemsHTML}</ul>

        ${unpaid ? `
          <div class="order-actions">
            <button type="button" class="btn btn-primary btn-pay">Pay again</button>
            <button type="button" class="btn btn-primary btn-edit">Modify</button>
            <button type="button" class="btn btn-danger btn-cancel">Cancel</button>
          </div>
          <div class="edit-panel">
            ${editRowsHTML}
            <div class="order-actions">
              <button type="button" class="btn btn-primary btn-save">Save changes</button>
              <button type="button" class="btn btn-danger btn-close">Close</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  async function refresh() {
    const list = document.getElementById('my-order-list');
    if (!list) return;

    const orders = await fetchJSON('/api/my-orders');
    if (!Array.isArray(orders) || orders.length === 0) {
      list.innerHTML = `<div class="order-card"><div class="order-header">No orders yet.</div></div>`;
      return;
    }
    list.innerHTML = orders.map(orderCardHTML).join('');
  }

  async function cancelOrder(orderid) {
    await ensureCSRF();
    await fetchJSON(`/api/my-orders/${encodeURIComponent(orderid)}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csrf: CSRF })
    });
  }

  async function saveOrder(orderid, root) {
    await ensureCSRF();
    const rows = Array.from(root.querySelectorAll('.edit-row'));
    const items = [];
    for (const r of rows) {
      const pid = Number(r.dataset.pid);
      const qty = Number(r.querySelector('.qty')?.value || 0);
      if (!Number.isInteger(pid) || !Number.isFinite(qty)) continue;
      if (qty > 0) items.push({ pid, qty: Math.floor(qty) });
    }
    if (items.length === 0) throw new Error('Empty items');

    await fetchJSON(`/api/my-orders/${encodeURIComponent(orderid)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csrf: CSRF, items })
    });
  }

  document.addEventListener('click', async (e) => {
    const card = e.target.closest('.order-card');
    if (!card) return;
    const orderid = card.dataset.orderid;
    if (!orderid) return;

    if (e.target.closest('.btn-pay')) {
      location.href = `/pay.html?orderid=${encodeURIComponent(orderid)}`;
      return;
    }

    if (e.target.closest('.btn-edit')) {
      const panel = card.querySelector('.edit-panel');
      if (panel) panel.style.display = 'block';
      return;
    }

    if (e.target.closest('.btn-close')) {
      const panel = card.querySelector('.edit-panel');
      if (panel) panel.style.display = 'none';
      return;
    }

    if (e.target.closest('.btn-cancel')) {
      if (!confirm('Cancel this unpaid order?')) return;
      try {
        await cancelOrder(orderid);
        await refresh();
      } catch (err) {
        alert(err.message || 'Cancel failed');
      }
      return;
    }

    if (e.target.closest('.btn-save')) {
      try {
        await saveOrder(orderid, card);
        await refresh();
      } catch (err) {
        alert(err.message || 'Save failed');
      }
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    refresh().catch(() => {
      const list = document.getElementById('my-order-list');
      if (list) list.innerHTML = `<div class="order-card"><div class="order-header">Failed to load orders.</div></div>`;
    });
  });
})();
