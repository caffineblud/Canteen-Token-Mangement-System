/* Canteen Token Management System
 * Modules: 1 Menu & price list · 2 Token generation · 3 Order queue · 4 Billing · 5 Daily sales report
 * Data lives in the browser (localStorage). Open the app in two tabs to see the queue sync live.
 */
'use strict';

/* ------------------------------------------------------------------ *
 * Core (no DOM) — models, token generation, queue, billing, reports
 * ------------------------------------------------------------------ */
const Core = (() => {
  const GST_RATE = 0.05;
  const CATEGORIES = ['Snacks', 'Meals', 'Beverages', 'Desserts'];
  const STATUS_FLOW = ['queued', 'preparing', 'ready', 'served'];

  class InvalidTokenError extends Error {
    constructor(message) { super(message); this.name = 'InvalidTokenError'; }
  }

  const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const seedMenu = () => [
    ['Samosa (2 pcs)', 'Snacks', 20], ['Veg Sandwich', 'Snacks', 40], ['Veg Burger', 'Snacks', 50],
    ['French Fries', 'Snacks', 50], ['Maggi', 'Snacks', 40], ['Paneer Roll', 'Snacks', 70],
    ['Poha', 'Meals', 30], ['Idli Sambar', 'Meals', 40], ['Masala Dosa', 'Meals', 60],
    ['Chole Bhature', 'Meals', 70], ['Veg Fried Rice', 'Meals', 80], ['Veg Thali', 'Meals', 90],
    ['Tea', 'Beverages', 10], ['Coffee', 'Beverages', 20], ['Cold Coffee', 'Beverages', 50],
    ['Lemon Soda', 'Beverages', 25], ['Lassi', 'Beverages', 30], ['Cold Drink', 'Beverages', 30],
    ['Brownie', 'Desserts', 40], ['Ice Cream Cup', 'Desserts', 30], ['Gulab Jamun (2 pcs)', 'Desserts', 30],
  ].map(([name, category, price], i) => ({ id: 'm' + (i + 1), name, category, price, available: true }));

  /* Module 2 — token generation. Sequence resets each day: T-001, T-002 ... */
  const TokenGenerator = {
    next(state, today = dateKey()) {
      if (state.counter.date !== today) state.counter = { date: today, n: 0 };
      state.counter.n += 1;
      return { seq: state.counter.n, token: 'T-' + pad(state.counter.n, 3) };
    },
  };

  /* Module 4 — billing */
  function computeBill(menu, cart, discountPct = 0) {
    const pct = Math.min(100, Math.max(0, Number(discountPct) || 0));
    const items = [];
    for (const line of cart) {
      const m = menu.find(x => x.id === line.id);
      if (!m || line.qty < 1) continue;
      items.push({ id: m.id, name: m.name, price: m.price, qty: line.qty });
    }
    const subtotal = round2(items.reduce((s, i) => s + i.price * i.qty, 0));
    const discount = round2(subtotal * pct / 100);
    const gst = round2((subtotal - discount) * GST_RATE);
    const total = round2(subtotal - discount + gst);
    return { items, subtotal, discountPct: pct, discount, gst, total };
  }

  /* Modules 2+4 — create the order, issue a token and enqueue it */
  function placeOrder(state, cart, opts = {}) {
    const bill = computeBill(state.menu, cart, opts.discountPct);
    if (!bill.items.length) throw new InvalidTokenError('Add at least one item before generating a token.');
    const unavailable = bill.items.find(i => !state.menu.find(m => m.id === i.id).available);
    if (unavailable) throw new InvalidTokenError(unavailable.name + ' is no longer available.');
    const { seq, token } = TokenGenerator.next(state);
    const now = Date.now();
    const order = {
      id: uid(), token, seq, date: dateKey(), ts: now,
      customer: (opts.customer || '').trim().slice(0, 30),
      payment: opts.payment || 'Cash',
      ...bill,
      status: 'queued',
      times: { queued: now },
    };
    state.orders.push(order);
    return order;
  }

  /* Module 3 — FIFO counter queue */
  const queueOf = (state, status) =>
    state.orders.filter(o => o.status === status && o.date === dateKey()).sort((a, b) => a.ts - b.ts);

  function advance(state, id) {
    const o = state.orders.find(x => x.id === id);
    if (!o) throw new InvalidTokenError('Order not found.');
    const i = STATUS_FLOW.indexOf(o.status);
    if (i < 0 || i === STATUS_FLOW.length - 1) return o;
    o.status = STATUS_FLOW[i + 1];
    o.times[o.status] = Date.now();
    return o;
  }

  function callNext(state) {
    const next = queueOf(state, 'queued')[0];
    return next ? advance(state, next.id) : null;
  }

  function cancel(state, id) {
    const o = state.orders.find(x => x.id === id);
    if (!o) throw new InvalidTokenError('Order not found.');
    if (o.status !== 'queued') throw new InvalidTokenError('Only queued orders can be cancelled.');
    o.status = 'cancelled';
    o.times.cancelled = Date.now();
    return o;
  }

  function findToken(state, input) {
    const raw = String(input || '').trim().toUpperCase();
    const m = raw.match(/^T?-?(\d{1,4})$/);
    if (!m) throw new InvalidTokenError('That is not a valid token. Try something like T-007.');
    const tok = 'T-' + pad(Number(m[1]), 3);
    const o = state.orders.filter(x => x.token === tok && x.date === dateKey()).pop();
    if (!o) throw new InvalidTokenError('No order found for ' + tok + ' today.');
    return o;
  }

  /* Module 5 — daily sales */
  function dailyReport(state, day) {
    const sales = state.orders.filter(o => o.date === day && o.status !== 'cancelled').sort((a, b) => a.ts - b.ts);
    const revenue = round2(sales.reduce((s, o) => s + o.total, 0));
    const itemsSold = sales.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
    const byItem = {};
    const byHour = {};
    const byPayment = {};
    for (const o of sales) {
      for (const i of o.items) {
        byItem[i.name] = byItem[i.name] || { qty: 0, amount: 0 };
        byItem[i.name].qty += i.qty;
        byItem[i.name].amount = round2(byItem[i.name].amount + i.price * i.qty);
      }
      const h = new Date(o.ts).getHours();
      byHour[h] = (byHour[h] || 0) + 1;
      byPayment[o.payment] = round2((byPayment[o.payment] || 0) + o.total);
    }
    const top = Object.entries(byItem).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.amount - a.amount);
    return {
      sales, revenue, itemsSold, orders: sales.length,
      avg: sales.length ? round2(revenue / sales.length) : 0,
      cancelled: state.orders.filter(o => o.date === day && o.status === 'cancelled').length,
      top, byHour, byPayment,
    };
  }

  function toCSV(report, day) {
    const q = v => '"' + String(v).replace(/"/g, '""') + '"';
    const rows = [['Date', 'Time', 'Token', 'Customer', 'Items', 'Subtotal', 'Discount', 'GST', 'Total', 'Payment', 'Status']];
    for (const o of report.sales) {
      const t = new Date(o.ts);
      rows.push([day, `${pad(t.getHours())}:${pad(t.getMinutes())}`, o.token, o.customer,
        o.items.map(i => `${i.name} x${i.qty}`).join('; '),
        o.subtotal.toFixed(2), o.discount.toFixed(2), o.gst.toFixed(2), o.total.toFixed(2), o.payment, o.status]);
    }
    rows.push([], ['Orders', report.orders], ['Items sold', report.itemsSold], ['Revenue', report.revenue.toFixed(2)]);
    return rows.map(r => r.map(q).join(',')).join('\r\n');
  }

  return {
    GST_RATE, CATEGORIES, STATUS_FLOW, InvalidTokenError, TokenGenerator,
    seedMenu, computeBill, placeOrder, queueOf, advance, callNext, cancel, findToken, dailyReport, toCSV, dateKey, round2,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Core;

/* ------------------------------------------------------------------ *
 * UI
 * ------------------------------------------------------------------ */
if (typeof document !== 'undefined') (() => {
  const KEY = 'canteen.v1';
  const ADMIN_USER = 'admin', ADMIN_PASS = 'admin123';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '₹' + Number(n).toFixed(2);
  const timeStr = ts => new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  /* ---------- state ---------- */
  let state = load();
  let cart = [];                       // [{id, qty}]
  let view = 'menu';
  let filters = { menu: 'All', order: 'All', menuQ: '', orderQ: '' };
  let editingId = null;
  let trackedId = null;
  let isAdmin = sessionStorage.getItem('canteen.admin') === '1';
  const opts = { discountPct: 0, payment: 'Cash', customer: '' };

  function fresh() { return { menu: Core.seedMenu(), orders: [], counter: { date: '', n: 0 } }; }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.menu) && Array.isArray(s.orders) && s.counter) return s;
    } catch (e) { /* fall through */ }
    return fresh();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save — browser storage is full or blocked.', true); }
  }

  /* ---------- helpers ---------- */
  function toast(msg, err = false) {
    const el = document.createElement('div');
    el.className = 'toast' + (err ? ' err' : '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
  const cartQty = id => (cart.find(l => l.id === id) || { qty: 0 }).qty;
  const catDot = c => `<span class="dot c-${c}"></span>`;

  /* ---------- routing / admin ---------- */
  function go(v) {
    view = v;
    $$('.view').forEach(s => (s.hidden = s.id !== 'view-' + v));
    $$('.tab').forEach(t => t.setAttribute('aria-current', t.dataset.view === v ? 'page' : 'false'));
    if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v);
    render();
    window.scrollTo({ top: 0 });
  }
  function syncAdminUI() {
    $$('.admin-only').forEach(el => (el.hidden = !isAdmin));
    $('#adminBtn').textContent = isAdmin ? 'Log out' : 'Admin login';
    $('#reportLock').hidden = isAdmin;
  }
  function requireAdmin() {
    if (isAdmin) return true;
    $('#loginErr').hidden = true;
    $('#loginDlg').showModal();
    $('#loginUser').focus();
    return false;
  }

  /* ---------- renderers ---------- */
  function chipsHTML(active) {
    return ['All', ...Core.CATEGORIES]
      .map(c => `<button class="chip" data-chip="${c}" aria-pressed="${c === active}">${c}</button>`).join('');
  }
  const matches = (m, cat, q) => (cat === 'All' || m.category === cat) && m.name.toLowerCase().includes(q.toLowerCase());

  function renderMenu() {
    $('#menuChips').innerHTML = chipsHTML(filters.menu);
    const items = state.menu.filter(m => matches(m, filters.menu, filters.menuQ));
    if (!items.length) { $('#menuList').innerHTML = '<div class="empty">No items match your search.</div>'; return; }
    $('#menuList').innerHTML = Core.CATEGORIES.map(cat => {
      const rows = items.filter(m => m.category === cat);
      if (!rows.length) return '';
      return `<div class="cat-block"><h3 class="cat-title">${cat}</h3><div class="menu-rows">${rows.map(m => `
        <div class="menu-row ${m.available ? '' : 'off'}">
          ${catDot(m.category)}
          <div class="menu-name">${esc(m.name)}${m.available ? '' : '<small>Sold out</small>'}</div>
          <div class="price">${money(m.price)}</div>
          ${isAdmin ? `<div class="row-tools">
            <button class="btn btn-sm" data-act="toggle" data-id="${m.id}">${m.available ? 'Sold out' : 'Restock'}</button>
            <button class="btn btn-sm" data-act="edit" data-id="${m.id}">Edit</button>
            <button class="btn btn-sm btn-danger" data-act="del" data-id="${m.id}">Delete</button></div>` : ''}
        </div>`).join('')}</div></div>`;
    }).join('');
  }

  function renderOrder() {
    $('#orderChips').innerHTML = chipsHTML(filters.order);
    const items = state.menu.filter(m => matches(m, filters.order, filters.orderQ));
    $('#orderGrid').innerHTML = items.length ? items.map(m => {
      const q = cartQty(m.id);
      return `<button class="tile" data-act="add" data-id="${m.id}" ${m.available ? '' : 'disabled'}>
        <div class="tile-top">${catDot(m.category)}${m.category}${q ? `<span class="qty-badge" style="margin-left:auto">${q} in order</span>` : ''}</div>
        <div class="tile-name">${esc(m.name)}</div>
        <div class="tile-foot"><span class="price">${m.available ? money(m.price) : 'Sold out'}</span>${m.available ? '<span class="add" aria-hidden="true">+</span>' : ''}</div>
      </button>`;
    }).join('') : '<div class="empty">No items match your search.</div>';
    renderCart();
  }

  function renderCart() {
    const bill = Core.computeBill(state.menu, cart, opts.discountPct);
    const count = bill.items.reduce((s, i) => s + i.qty, 0);
    const badge = $('#cartBadge');
    badge.hidden = !count; badge.textContent = count;

    if (!bill.items.length) {
      $('#cart').innerHTML = `<h2>Your order</h2><div class="cart-empty">Your order is empty.<br>Tap an item to add it.</div>`;
      return;
    }
    $('#cart').innerHTML = `
      <h2>Your order <button class="btn btn-sm btn-ghost" data-act="clear">Clear</button></h2>
      <div class="cart-lines">${bill.items.map(i => `
        <div class="line">
          <div class="line-name">${esc(i.name)}<small>${money(i.price)} each</small></div>
          <div class="stepper"><button data-act="dec" data-id="${i.id}" aria-label="Decrease ${esc(i.name)}">−</button><span>${i.qty}</span><button data-act="inc" data-id="${i.id}" aria-label="Increase ${esc(i.name)}">+</button></div>
          <div class="line-total">${money(i.price * i.qty)}</div>
        </div>`).join('')}</div>
      <div class="cart-opts">
        <label class="field"><span>Name (optional)</span><input class="input" id="custName" maxlength="30" value="${esc(opts.customer)}" placeholder="For the slip"></label>
        <label class="field"><span>Payment</span><select class="input" id="payMode">${['Cash', 'UPI', 'Card'].map(p => `<option ${p === opts.payment ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
      </div>
      ${isAdmin ? `<label class="field" style="margin:10px 0 0"><span>Discount % (admin)</span><input class="input" id="discPct" type="number" min="0" max="100" value="${opts.discountPct}"></label>` : ''}
      <div class="totals">
        <div><span>Subtotal</span><span>${money(bill.subtotal)}</span></div>
        ${bill.discount ? `<div><span>Discount (${bill.discountPct}%)</span><span>−${money(bill.discount)}</span></div>` : ''}
        <div><span>GST (5%)</span><span>${money(bill.gst)}</span></div>
        <div class="grand"><span>Total</span><span>${money(bill.total)}</span></div>
      </div>
      <button class="btn btn-primary" data-act="place">Pay &amp; generate token</button>`;
  }

  function orderCard(o, { actions = false, hl = false } = {}) {
    const next = { queued: 'Start preparing', preparing: 'Mark ready', ready: 'Mark served' }[o.status];
    return `<div class="order-card ${hl ? 'hl' : ''}">
      <div class="order-top"><span class="tok">${o.token}</span><span class="badge b-${o.status}">${o.status}</span></div>
      <div class="order-items">${o.items.map(i => `${esc(i.name)} ×${i.qty}`).join(', ')}</div>
      <div class="order-meta"><span>${timeStr(o.ts)}${o.customer ? ' · ' + esc(o.customer) : ''}</span><span class="price">${money(o.total)}</span></div>
      ${actions && next ? `<div class="order-actions">
        <button class="btn btn-sm btn-primary" data-act="advance" data-id="${o.id}">${next}</button>
        ${o.status === 'queued' ? `<button class="btn btn-sm btn-danger" data-act="cancel" data-id="${o.id}">Cancel</button>` : ''}
        <button class="btn btn-sm" data-act="slip" data-id="${o.id}">Slip</button></div>` : ''}
    </div>`;
  }

  function renderQueue() {
    const queued = Core.queueOf(state, 'queued');
    const prep = Core.queueOf(state, 'preparing');
    const ready = Core.queueOf(state, 'ready');
    const badge = $('#queueBadge');
    const waiting = queued.length + prep.length;
    badge.hidden = !waiting; badge.textContent = waiting;

    const now = prep[0] || ready[0];
    $('#serving').innerHTML = `
      <div><div class="label">${prep.length ? 'Now preparing' : 'Now serving'}</div>
        <div class="big">${now ? now.token : '—'}</div>
        <div class="muted">${queued.length} waiting in line</div></div>
      <div><div class="label" style="text-align:right;margin-bottom:8px">Ready for pickup</div>
        <div class="ready-list">${ready.length ? ready.map(o => `<span class="token-pill">${o.token}</span>`).join('') : '<span class="muted">Nothing ready yet</span>'}</div></div>`;

    $('#callNextBtn').disabled = !queued.length;
    const col = (title, list) => `<div class="col"><div class="col-head"><span>${title}</span><span class="count">${list.length}</span></div>
      ${list.length ? list.map(o => orderCard(o, { actions: isAdmin, hl: o.id === trackedId })).join('') : '<div class="empty">Empty</div>'}</div>`;
    $('#board').innerHTML = col('Queued', queued) + col('Preparing', prep) + col('Ready', ready);
  }

  function renderReport() {
    const body = $('#reportBody');
    if (!isAdmin) {
      body.innerHTML = `<div class="card locked"><h2>Sales are for staff</h2><p class="muted">Log in as admin to see revenue and export reports.</p><button class="btn btn-primary" data-act="login">Admin login</button></div>`;
      $('#csvBtn').disabled = true; $('#resetBtn').disabled = true; return;
    }
    $('#csvBtn').disabled = false; $('#resetBtn').disabled = false;
    const day = $('#reportDate').value || Core.dateKey();
    const r = Core.dailyReport(state, day);

    const maxAmt = Math.max(1, ...r.top.slice(0, 8).map(t => t.amount));
    const hours = Object.keys(r.byHour).map(Number);
    const lo = hours.length ? Math.min(8, ...hours) : 8, hi = hours.length ? Math.max(18, ...hours) : 18;
    const hrs = []; for (let h = lo; h <= hi; h++) hrs.push(h);
    const maxH = Math.max(1, ...hrs.map(h => r.byHour[h] || 0));

    body.innerHTML = `
      <div class="kpis">
        <div class="card kpi"><div class="k">Revenue</div><div class="v">${money(r.revenue)}</div></div>
        <div class="card kpi"><div class="k">Orders</div><div class="v">${r.orders}</div></div>
        <div class="card kpi"><div class="k">Items sold</div><div class="v">${r.itemsSold}</div></div>
        <div class="card kpi"><div class="k">Avg. order</div><div class="v">${money(r.avg)}</div></div>
      </div>
      <div class="charts">
        <div class="card chart"><h3>Top items by revenue</h3>
          ${r.top.length ? r.top.slice(0, 8).map(t => `<div class="hbar"><span class="nm" title="${esc(t.name)}">${esc(t.name)}</span>
            <div class="track-bar"><div class="fill" style="width:${(t.amount / maxAmt * 100).toFixed(1)}%"></div></div>
            <span class="val">${money(t.amount)} · ${t.qty}</span></div>`).join('') : '<div class="empty">No sales on this day.</div>'}
        </div>
        <div class="card chart"><h3>Orders by hour</h3>
          <div class="vbars">${hrs.map(h => { const c = r.byHour[h] || 0; return `<div class="vbar"><span class="cnt">${c || ''}</span>
            <div class="col-fill" style="height:${(c / maxH * 100).toFixed(1)}%"></div><span class="hr">${h % 12 || 12}${h < 12 ? 'a' : 'p'}</span></div>`; }).join('')}</div>
          ${Object.keys(r.byPayment).length ? `<div class="muted" style="margin-top:12px;font-size:13px">${Object.entries(r.byPayment).map(([k, v]) => `${k}: <b>${money(v)}</b>`).join(' &nbsp;·&nbsp; ')}</div>` : ''}
        </div>
      </div>
      <div class="card table-card"><h3>Orders${r.cancelled ? ` <span class="muted" style="font-weight:500">(${r.cancelled} cancelled, not counted)</span>` : ''}</h3>
        <div class="tbl-wrap"><table><thead><tr><th>Token</th><th>Time</th><th>Items</th><th>Payment</th><th>Status</th><th class="num">Total</th><th></th></tr></thead><tbody>
          ${r.sales.length ? r.sales.map(o => `<tr><td><b>${o.token}</b></td><td>${timeStr(o.ts)}</td>
            <td class="items">${o.items.map(i => `${esc(i.name)} ×${i.qty}`).join(', ')}</td><td>${o.payment}</td>
            <td><span class="badge b-${o.status}">${o.status}</span></td><td class="num">${money(o.total)}</td>
            <td><button class="btn btn-sm" data-act="slip" data-id="${o.id}">Slip</button></td></tr>`).join('')
            : '<tr><td colspan="7" class="empty">No orders on this day.</td></tr>'}
        </tbody></table></div></div>`;
  }

  function render() {
    syncAdminUI();
    if (view === 'menu') renderMenu();
    if (view === 'order') renderOrder();
    if (view === 'queue') renderQueue();
    if (view === 'report') renderReport();
    // keep badges fresh on every view
    const count = cart.reduce((s, l) => s + l.qty, 0);
    $('#cartBadge').hidden = !count; $('#cartBadge').textContent = count;
    const w = state.orders.filter(o => o.date === Core.dateKey() && (o.status === 'queued' || o.status === 'preparing')).length;
    $('#queueBadge').hidden = !w; $('#queueBadge').textContent = w;
  }

  /* ---------- slip ---------- */
  function showSlip(o) {
    $('#slip').innerHTML = `
      <div class="s-head"><div class="s-title">CANTEEN TOKEN SLIP</div><div>${new Date(o.ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div></div>
      <div class="s-token"><small>YOUR TOKEN</small><b>${o.token}</b></div>
      ${o.customer ? `<div class="s-row"><span>Name</span><span>${esc(o.customer)}</span></div>` : ''}
      <div class="s-row"><span>Payment</span><span>${o.payment}</span></div>
      <div class="s-items">${o.items.map(i => `<div class="s-row"><span>${esc(i.name)} ×${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join('')}</div>
      <div class="s-row"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
      ${o.discount ? `<div class="s-row"><span>Discount (${o.discountPct}%)</span><span>−${money(o.discount)}</span></div>` : ''}
      <div class="s-row"><span>GST (5%)</span><span>${money(o.gst)}</span></div>
      <div class="s-row s-total"><span>TOTAL</span><span>${money(o.total)}</span></div>
      <div class="s-foot">Wait for your token on the Queue screen.<br>Thank you!</div>`;
    $('#billDlg').showModal();
  }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const chip = e.target.closest('[data-chip]');
    if (chip) { filters[view === 'menu' ? 'menu' : 'order'] = chip.dataset.chip; render(); return; }

    const t = e.target.closest('[data-act]');
    if (!t) return;
    const id = t.dataset.id;
    try {
      switch (t.dataset.act) {
        case 'add': {
          const l = cart.find(x => x.id === id);
          l ? l.qty++ : cart.push({ id, qty: 1 });
          renderOrder(); render(); break;
        }
        case 'inc': cart.find(x => x.id === id).qty++; renderOrder(); render(); break;
        case 'dec': {
          const l = cart.find(x => x.id === id);
          if (--l.qty < 1) cart = cart.filter(x => x.id !== id);
          renderOrder(); render(); break;
        }
        case 'clear': cart = []; renderOrder(); render(); break;
        case 'place': {
          const order = Core.placeOrder(state, cart, opts);
          save();
          cart = []; opts.customer = ''; opts.discountPct = 0;
          renderOrder(); render();
          showSlip(order);
          toast(`Token ${order.token} generated`);
          break;
        }
        case 'advance': {
          if (!requireAdmin()) break;
          const o = Core.advance(state, id); save(); render();
          toast(`${o.token} is now ${o.status}`); break;
        }
        case 'cancel': {
          if (!requireAdmin()) break;
          if (!confirm('Cancel this order? It will not count in sales.')) break;
          Core.cancel(state, id); save(); render(); break;
        }
        case 'slip': showSlip(state.orders.find(o => o.id === id)); break;
        case 'toggle': {
          const m = state.menu.find(x => x.id === id); m.available = !m.available; save(); render(); break;
        }
        case 'edit': openItemDlg(id); break;
        case 'del': {
          const m = state.menu.find(x => x.id === id);
          if (!confirm(`Delete "${m.name}" from the menu?`)) break;
          state.menu = state.menu.filter(x => x.id !== id);
          cart = cart.filter(l => l.id !== id);
          save(); render(); break;
        }
        case 'login': requireAdmin(); break;
      }
    } catch (err) {
      if (err instanceof Core.InvalidTokenError) toast(err.message, true);
      else { console.error(err); toast('Something went wrong.', true); }
    }
  });

  document.addEventListener('input', e => {
    if (e.target.id === 'custName') opts.customer = e.target.value;
    if (e.target.id === 'discPct') { opts.discountPct = e.target.value; refreshTotalsOnly(); }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'payMode') opts.payment = e.target.value;
    if (e.target.id === 'reportDate') renderReport();
  });
  // Re-render only the totals so typing a discount does not steal focus
  function refreshTotalsOnly() {
    const bill = Core.computeBill(state.menu, cart, opts.discountPct);
    const el = $('#cart .totals'); if (!el) return;
    el.innerHTML = `<div><span>Subtotal</span><span>${money(bill.subtotal)}</span></div>
      ${bill.discount ? `<div><span>Discount (${bill.discountPct}%)</span><span>−${money(bill.discount)}</span></div>` : ''}
      <div><span>GST (5%)</span><span>${money(bill.gst)}</span></div>
      <div class="grand"><span>Total</span><span>${money(bill.total)}</span></div>`;
  }

  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('.tab'); if (!b) return;
    go(b.dataset.view);
  });
  $('#menuSearch').addEventListener('input', e => { filters.menuQ = e.target.value; renderMenu(); });
  $('#orderSearch').addEventListener('input', e => { filters.orderQ = e.target.value; renderOrder(); });

  $('#themeBtn').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('canteen.theme', next); } catch (e) { /* ignore */ }
  });

  $('#adminBtn').addEventListener('click', () => {
    if (isAdmin) {
      isAdmin = false; sessionStorage.removeItem('canteen.admin'); opts.discountPct = 0;
      toast('Logged out'); render();
    } else requireAdmin();
  });
  $('#loginForm').addEventListener('submit', e => {
    const ok = $('#loginUser').value.trim() === ADMIN_USER && $('#loginPass').value === ADMIN_PASS;
    if (!ok) { e.preventDefault(); $('#loginErr').hidden = false; return; }
    isAdmin = true; sessionStorage.setItem('canteen.admin', '1');
    $('#loginPass').value = '';
    toast('Welcome, admin'); render();
  });

  // item editor
  function openItemDlg(id) {
    editingId = id || null;
    const m = id ? state.menu.find(x => x.id === id) : null;
    $('#itemDlgTitle').textContent = m ? 'Edit item' : 'Add item';
    $('#itemCat').innerHTML = Core.CATEGORIES.map(c => `<option>${c}</option>`).join('');
    $('#itemName').value = m ? m.name : '';
    $('#itemCat').value = m ? m.category : Core.CATEGORIES[0];
    $('#itemPrice').value = m ? m.price : '';
    $('#itemAvail').checked = m ? m.available : true;
    $('#itemDlg').showModal();
    $('#itemName').focus();
  }
  $('#addItemBtn').addEventListener('click', () => requireAdmin() && openItemDlg());
  $('#itemForm').addEventListener('submit', () => {
    const name = $('#itemName').value.trim();
    const price = Math.round(Number($('#itemPrice').value));
    if (!name || !(price > 0)) return;
    const data = { name, category: $('#itemCat').value, price, available: $('#itemAvail').checked };
    if (editingId) Object.assign(state.menu.find(x => x.id === editingId), data);
    else state.menu.push({ id: 'm' + Date.now().toString(36), ...data });
    save(); render(); toast(editingId ? 'Item updated' : 'Item added');
  });

  // queue
  $('#callNextBtn').addEventListener('click', () => {
    if (!requireAdmin()) return;
    const o = Core.callNext(state);
    if (o) { save(); render(); toast(`Calling ${o.token}`); } else toast('No orders waiting', true);
  });
  $('#trackForm').addEventListener('submit', e => {
    e.preventDefault();
    const box = $('#trackResult');
    try {
      const o = Core.findToken(state, $('#trackInput').value);
      trackedId = o.id;
      box.innerHTML = `<div class="track">${orderCard(o)}</div>`;
    } catch (err) {
      trackedId = null;
      box.innerHTML = `<div class="track error">${esc(err.message)}</div>`;
    }
    renderQueue();
  });

  // report
  $('#reportDate').value = Core.dateKey();
  $('#csvBtn').addEventListener('click', () => {
    if (!requireAdmin()) return;
    const day = $('#reportDate').value || Core.dateKey();
    const csv = Core.toCSV(Core.dailyReport(state, day), day);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `canteen-sales-${day}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!requireAdmin()) return;
    if (!confirm('Delete ALL orders and reset token numbering? The menu is kept.')) return;
    state.orders = []; state.counter = { date: '', n: 0 }; trackedId = null; save(); render(); toast('Orders cleared');
  });

  // dialogs
  $('#printBtn').addEventListener('click', () => window.print());
  document.addEventListener('click', e => {
    if (e.target.matches('[data-close]')) e.target.closest('dialog').close();
    if (e.target.tagName === 'DIALOG') e.target.close();   // click on backdrop
  });

  // cross-tab live sync + midnight rollover
  window.addEventListener('storage', e => { if (e.key === KEY) { state = load(); render(); } });
  setInterval(() => { if (view === 'queue' || view === 'report') render(); }, 30000);

  /* ---------- boot ---------- */
  const start = location.hash.slice(1);
  go(['menu', 'order', 'queue', 'report'].includes(start) ? start : 'menu');
})();
