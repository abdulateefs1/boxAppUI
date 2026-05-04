// app.js — AND BILLUR Box Sistema v3 frontend
'use strict';

const SIZES = [98, 104, 110, 116, 122, 128, 134, 140, 146, 152, 158, 164, 170, 176];

let me = null;
let currentTab = 'home';
let token = null;

const Storage = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} }
};

async function api(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'include' };
  if (token) opts.headers['x-session-token'] = token;
  if (body !== undefined) opts.body = JSON.stringify(body);
  let r;
  try { r = await fetch(url, opts); }
  catch (e) { throw new Error('Tarmoq xatosi: ' + e.message); }
  let data;
  try { data = await r.json(); } catch { data = {}; }
  if (!r.ok) {
    if (r.status === 401) { Storage.del('token'); token = null; showLogin(); }
    throw new Error(data.error || 'Server xatosi');
  }
  return data;
}

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModals() { document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')); }

function showInfo(msg) {
  document.getElementById('m-info-txt').textContent = msg;
  openModal('m-info');
}

function showConfirm(title, msg, onOk) {
  document.getElementById('m-confirm-title').textContent = title;
  document.getElementById('m-confirm-msg').textContent = msg;
  document.getElementById('m-confirm-ok').onclick = () => { closeModals(); onOk(); };
  openModal('m-confirm');
}

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ============== LOGIN ==============
async function doLogin() {
  const u = document.getElementById('inp-user').value.trim();
  const p = document.getElementById('inp-pass').value;
  const err = document.getElementById('login-error');
  err.style.display = 'none';
  if (!u || !p) { err.textContent = 'Login va parol kerak'; err.style.display = 'block'; return; }
  try {
    const r = await api('POST', '/api/login', { username: u, password: p });
    token = r.token;
    Storage.set('token', token);
    me = r.user;
    showApp();
  } catch (e) { err.textContent = e.message; err.style.display = 'block'; }
}

async function doLogout() {
  try { await api('POST', '/api/logout'); } catch {}
  Storage.del('token');
  token = null;
  me = null;
  showLogin();
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
  document.getElementById('inp-user').value = '';
  document.getElementById('inp-pass').value = '';
  document.getElementById('login-error').style.display = 'none';
  setTimeout(() => document.getElementById('inp-user')?.focus(), 100);
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('sb-uname').textContent = me.name;
  document.getElementById('sb-urole').textContent = roleLabel(me.role);
  document.getElementById('sb-av').textContent = (me.name || me.username).charAt(0).toUpperCase();
  document.getElementById('tb-user').textContent = me.name;
  document.getElementById('tb-date').textContent = new Date().toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' });
  buildNav();
  goTab('home');
}

function roleLabel(r) {
  return { admin: '👑 Admin', storekeeper: '🏭 Omborchi', worker: '👷 Ishchi' }[r] || r;
}

function buildNav() {
  const nav = document.getElementById('sb-nav');
  const tabs = [
    { id: 'home', icon: '🏠', label: 'Bosh sahifa' },
    { id: 'barcode', icon: '📲', label: 'Barcode skan', roles: ['worker', 'storekeeper', 'admin'] },
    { id: 'boxes', icon: '📦', label: 'Boxlar' },
    { id: 'detalniy', icon: '📋', label: 'Detalniy', roles: ['storekeeper', 'admin'] },
    { id: 'shipments', icon: '🚛', label: 'Shipmentlar', roles: ['storekeeper', 'admin'] },
    { id: 'orders', icon: '📝', label: 'Orderlar', roles: ['admin'] },
    { id: 'users', icon: '👥', label: 'Foydalanuvchilar', roles: ['admin'] },
    { id: 'audit', icon: '📜', label: 'Audit log', roles: ['admin'] },
    { id: 'profile', icon: '⚙️', label: 'Profil' }
  ];
  nav.innerHTML = '';
  tabs.forEach(t => {
    if (t.roles && !t.roles.includes(me.role)) return;
    const d = document.createElement('div');
    d.className = 'nav-tab' + (t.id === currentTab ? ' active' : '');
    d.innerHTML = `
      <span class="nav-tab-icon">${t.icon}</span>
      <span class="nav-tab-label">${esc(t.label)}</span>
      <span class="nav-tab-dot"></span>
      <span class="nav-tab-caret">›</span>`;
    d.dataset.tab = t.id;
    d.addEventListener('click', () => goTab(t.id));
    nav.appendChild(d);
  });
}

function goTab(t) {
  currentTab = t;
  document.querySelectorAll('.nav-tab').forEach(x => x.classList.toggle('active', x.dataset.tab === t));
  document.getElementById('sidebar').classList.remove('open');
  const titles = {
    home: 'Bosh sahifa', barcode: '📲 Barcode skan', boxes: 'Boxlar',
    detalniy: 'Detalniy', shipments: 'Shipmentlar', orders: 'Orderlar',
    users: 'Foydalanuvchilar', audit: 'Audit log', profile: 'Profil'
  };
  document.getElementById('tb-title').textContent = titles[t] || t;
  const renderers = {
    home: renderHome, barcode: renderBarcode, boxes: renderBoxes,
    detalniy: renderDetalniy, shipments: renderShipments, orders: renderOrders,
    users: renderUsers, audit: renderAudit, profile: renderProfile
  };
  (renderers[t] || renderHome)();
}

// ============== HOME ==============
async function renderHome() {
  const c = document.getElementById('page-content');
  c.innerHTML = `
    <div class="brand-hero">
      <div class="brand-hero-top">
        <div>
          <div class="brand-hero-title">Salom, ${esc(me.name)}!</div>
          <div class="brand-hero-sub">AND BILLUR TEXTILE — Box Sistema v3</div>
        </div>
        <div class="brand-chip">${roleLabel(me.role)}</div>
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-icon">📦</div><div class="stat-val" id="st-packed">0</div><div class="stat-lbl">Qadoqlandi</div></div>
      <div class="stat-card blue"><div class="stat-icon">🏭</div><div class="stat-val" id="st-warehouse">0</div><div class="stat-lbl">Omborda</div></div>
      <div class="stat-card amber"><div class="stat-icon">🚛</div><div class="stat-val" id="st-shipping">0</div><div class="stat-lbl">Shipmentda</div></div>
      <div class="stat-card teal"><div class="stat-icon">✅</div><div class="stat-val" id="st-shipped">0</div><div class="stat-lbl">Yuborilgan</div></div>
    </div>
    <div class="card">
      <div class="section-hdr"><div class="section-title">🏆 Bugungi reyting</div></div>
      <div id="rank-list">Yuklanmoqda...</div>
    </div>`;
  try {
    const boxes = await api('GET', '/api/boxes');
    const cnt = { packed: 0, warehouse: 0, shipping: 0, shipped: 0 };
    boxes.forEach(b => { if (cnt[b.status] !== undefined) cnt[b.status]++; });
    document.getElementById('st-packed').textContent = cnt.packed;
    document.getElementById('st-warehouse').textContent = cnt.warehouse;
    document.getElementById('st-shipping').textContent = cnt.shipping;
    document.getElementById('st-shipped').textContent = cnt.shipped;

    const r = await api('GET', '/api/ranking');
    const div = document.getElementById('rank-list');
    if (!r.ranking.length) {
      div.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px">Bugun hali box yo\'q</p>';
      return;
    }
    div.innerHTML = '';
    r.ranking.slice(0, 10).forEach((u, i) => {
      const isMe = u.username === me.username;
      const medal = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-n';
      const icon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
      const row = document.createElement('div');
      row.className = 'rank-row' + (isMe ? ' me' : '');
      row.innerHTML = `
        <div class="rank-medal ${medal}">${icon}</div>
        <div class="rank-info">
          <div class="rank-name">${esc(u.name)}${isMe ? ' (siz)' : ''}</div>
          <div class="rank-sub">@${esc(u.username)}</div>
        </div>
        <div style="text-align:right">
          <div class="rank-count">${u.count}</div>
          <div class="rank-dona">${u.total} dona</div>
        </div>`;
      div.appendChild(row);
    });
  } catch (e) { toast(e.message); }
}

// ============== BARCODE FLOW ==============
let scannedOrder = null;
let mixSecondOrder = null;

async function renderBarcode() {
  const c = document.getElementById('page-content');
  c.innerHTML = `
    <div class="card">
      <div class="section-title" style="margin-bottom:12px">📲 Barcode skanerlash</div>
      <div class="alert alert-green" style="margin-bottom:14px">
        Skanerni ulang yoki barcode'ni yozib <strong>Enter</strong> bosing. Order avtomatik topiladi.
      </div>
      <input type="text" id="bc-input" class="bc-input" placeholder="Barcode..." autocomplete="off">
      <div id="bc-status" style="margin-top:10px"></div>
    </div>`;
  const input = document.getElementById('bc-input');
  input.focus();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = input.value.trim();
      if (v) startBarcodeFlow(v);
    }
  });
}

async function startBarcodeFlow(bc) {
  const status = document.getElementById('bc-status');
  status.innerHTML = '<div class="alert alert-amber">Qidirilmoqda...</div>';
  try {
    const order = await api('GET', '/api/orders/by-barcode/' + encodeURIComponent(bc));
    scannedOrder = order;
    status.innerHTML = `<div class="alert alert-green">✓ Topildi: <strong>${esc(order.model)} / ${esc(order.color)}</strong></div>`;
    document.getElementById('m-type-bc').textContent = order.model + ' / ' + order.color;
    openModal('m-type');
  } catch (e) {
    if (me.role === 'admin') {
      status.innerHTML = `<div class="alert alert-amber">Bunday barcode topilmadi. <a href="#" id="bc-create" style="color:#16a34a;font-weight:700">Yangi order yaratish →</a></div>`;
      document.getElementById('bc-create').addEventListener('click', (ev) => {
        ev.preventDefault();
        openOrderEdit({ barcode: bc });
      });
    } else {
      status.innerHTML = `<div class="alert alert-amber">Bunday barcode topilmadi. Adminga aytsangiz orderni qo'shadi.</div>`;
    }
  }
}

function chooseSimple() {
  closeModals();
  document.getElementById('m-s-lbl').textContent = scannedOrder.model + ' / ' + scannedOrder.color;
  document.getElementById('s-boxnum').value = '';
  document.getElementById('s-zakaz').value = '';
  document.getElementById('s-kg').value = '';
  const grid = document.getElementById('s-sizes');
  grid.innerHTML = '';
  SIZES.forEach(sz => {
    const row = document.createElement('div');
    row.className = 'si-row';
    row.innerHTML = `<span class="si-label">${sz}</span><input type="number" class="si-input s-sz" data-size="${sz}" min="0" inputmode="numeric" placeholder="0">`;
    grid.appendChild(row);
  });
  grid.addEventListener('input', updateSimpleTotal);
  updateSimpleTotal();
  openModal('m-simple');
  setTimeout(() => document.getElementById('s-boxnum').focus(), 100);
}

function updateSimpleTotal() {
  let t = 0;
  document.querySelectorAll('.s-sz').forEach(i => { t += parseInt(i.value) || 0; });
  document.getElementById('s-total').textContent = t + ' dona';
}

async function saveSimple() {
  const boxnum = document.getElementById('s-boxnum').value.trim();
  const zakaz = document.getElementById('s-zakaz').value.trim();
  const kg = parseFloat(document.getElementById('s-kg').value);
  if (!boxnum || !zakaz) return showInfo('Box raqami va zakaz kerak');
  if (!kg || kg <= 0) return showInfo('Og\'irlik kerak');
  const sizes = {};
  let total = 0;
  document.querySelectorAll('.s-sz').forEach(i => {
    const v = parseInt(i.value) || 0;
    if (v > 0) { sizes[i.dataset.size] = v; total += v; }
  });
  if (!total) return showInfo('Hech bo\'lmaganda 1 ta razmer kiriting');
  try {
    await api('POST', '/api/boxes', {
      id: boxnum, type: 'simple', zakaz, kg,
      model: scannedOrder.model, color: scannedOrder.color, sizes
    });
    closeModals();
    toast('✓ Box yaratildi');
    document.getElementById('bc-input').value = '';
    document.getElementById('bc-status').innerHTML = '';
    document.getElementById('bc-input').focus();
  } catch (e) { showInfo(e.message); }
}

function chooseMix() {
  closeModals();
  document.getElementById('mix-bc1').value = scannedOrder.barcode || '';
  document.getElementById('mix-scan1-result').className = 'scan-result show';
  document.getElementById('mix-scan1-result').textContent = '✓ 1-model: ' + scannedOrder.model + ' / ' + scannedOrder.color;
  openModal('m-mix-scan1');
}

function mixScan1Done() {
  closeModals();
  document.getElementById('mix-bc2').value = '';
  document.getElementById('mix-scan2-result').className = 'scan-result';
  document.getElementById('mix-scan2-result').textContent = '';
  openModal('m-mix-scan2');
  setTimeout(() => document.getElementById('mix-bc2').focus(), 150);
}

function mixBack1() { closeModals(); openModal('m-mix-scan1'); }

async function mixScan2Done() {
  const bc = document.getElementById('mix-bc2').value.trim();
  const res = document.getElementById('mix-scan2-result');
  if (!bc) { res.className = 'scan-result error show'; res.textContent = 'Barcode kerak'; return; }
  try {
    const order = await api('GET', '/api/orders/by-barcode/' + encodeURIComponent(bc));
    if (order.id === scannedOrder.id) {
      res.className = 'scan-result error show';
      res.textContent = 'Bu 1-model bilan bir xil! Boshqa modelni skanerlang.';
      return;
    }
    mixSecondOrder = order;
    res.className = 'scan-result show';
    res.textContent = '✓ 2-model: ' + order.model + ' / ' + order.color;
    setTimeout(() => openMixSizesModal(), 500);
  } catch (e) {
    res.className = 'scan-result error show';
    res.textContent = e.message;
  }
}

function openMixSizesModal() {
  closeModals();
  document.getElementById('mx-boxnum').value = '';
  document.getElementById('mx-zakaz').value = '';
  document.getElementById('mx-kg').value = '';
  const cont = document.getElementById('mx-sizes-cont');
  cont.innerHTML = '';
  [scannedOrder, mixSecondOrder].forEach((ord, idx) => {
    const block = document.createElement('div');
    block.innerHTML = `
      <div class="section-divider">📐 ${idx + 1}-model: ${esc(ord.model)} / ${esc(ord.color)}</div>
      <div class="sizes-grid">
      ${SIZES.map(sz => `<div class="si-row"><span class="si-label">${sz}</span><input type="number" class="si-input mx-sz" data-mi="${idx}" data-size="${sz}" min="0" inputmode="numeric" placeholder="0"></div>`).join('')}
      </div>`;
    cont.appendChild(block);
  });
  cont.addEventListener('input', updateMixTotal);
  updateMixTotal();
  openModal('m-mix-sizes');
}

function updateMixTotal() {
  let t = 0;
  document.querySelectorAll('.mx-sz').forEach(i => { t += parseInt(i.value) || 0; });
  document.getElementById('mx-total').textContent = t + ' dona';
}

async function saveMix() {
  const boxnum = document.getElementById('mx-boxnum').value.trim();
  const zakaz = document.getElementById('mx-zakaz').value.trim();
  const kg = parseFloat(document.getElementById('mx-kg').value);
  if (!boxnum || !zakaz) return showInfo('Box raqami va zakaz kerak');
  if (!kg || kg <= 0) return showInfo('Og\'irlik kerak');

  const items = [scannedOrder, mixSecondOrder].map((ord, idx) => {
    const sizes = {};
    document.querySelectorAll(`.mx-sz[data-mi="${idx}"]`).forEach(i => {
      const v = parseInt(i.value) || 0;
      if (v > 0) sizes[i.dataset.size] = v;
    });
    return { model: ord.model, color: ord.color, orderId: ord.id, sizes };
  });
  const total = items.reduce((s, it) => s + Object.values(it.sizes).reduce((a, b) => a + b, 0), 0);
  if (!total) return showInfo('Hech bo\'lmaganda 1 ta razmer kiriting');

  try {
    await api('POST', '/api/boxes', { id: boxnum, type: 'mix', zakaz, kg, items });
    closeModals();
    toast('✓ Mix box yaratildi');
    scannedOrder = null;
    mixSecondOrder = null;
    document.getElementById('bc-input').value = '';
    document.getElementById('bc-status').innerHTML = '';
    document.getElementById('bc-input').focus();
  } catch (e) { showInfo(e.message); }
}

// ============== BOXES ==============
let boxesSelectedZakaz = '';
let editingBox = null;

async function renderBoxes() {
  const c = document.getElementById('page-content');
  c.innerHTML = `
    <div class="card">
      <div class="section-hdr"><div class="section-title">📦 Boxlar</div></div>
      <div class="row2" style="margin-bottom:12px">
        <select id="f-status">
          <option value="all">Barcha statuslar</option>
          <option value="packed">Qadoqlandi</option>
          <option value="warehouse">Omborda</option>
          <option value="shipping">Shipmentda</option>
          <option value="shipped">Yuborilgan</option>
        </select>
        <input type="text" id="f-zakaz" placeholder="Zakaz (masalan: 600)">
      </div>
      <div id="boxes-zakaz-nav" style="margin-bottom:12px"></div>
      <div id="boxes-list">Yuklanmoqda...</div>
    </div>`;
  document.getElementById('f-status').addEventListener('change', loadBoxes);
  document.getElementById('f-zakaz').addEventListener('input', () => {
    boxesSelectedZakaz = '';
    loadBoxes();
  });
  boxesSelectedZakaz = '';
  loadBoxes();
}

function renderZakazChips(boxes) {
  const nav = document.getElementById('boxes-zakaz-nav');
  const byZakaz = {};
  boxes.forEach(b => {
    const z = String(b.zakaz || '').trim();
    if (!z) return;
    if (!byZakaz[z]) byZakaz[z] = { cnt: 0, pieces: 0 };
    byZakaz[z].cnt += 1;
    byZakaz[z].pieces += getBoxTotalPieces(b);
  });
  const keys = Object.keys(byZakaz).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!keys.length) {
    nav.innerHTML = '';
    return;
  }
  nav.innerHTML = keys.map(z => {
    const item = byZakaz[z];
    const active = boxesSelectedZakaz === z ? 'btn-primary' : 'btn-ghost';
    return `<button class="btn btn-sm ${active}" data-act="open-zakaz" data-zakaz="${esc(z)}" style="margin:0 6px 6px 0">Zakaz ${esc(z)} · ${item.cnt} box · ${item.pieces} dona</button>`;
  }).join('');
}

async function loadBoxes() {
  try {
    const all = await api('GET', '/api/boxes');
    const st = document.getElementById('f-status').value;
    const zk = document.getElementById('f-zakaz').value.trim();
    let list = all;
    if (st !== 'all') list = list.filter(b => b.status === st);
    if (zk) list = list.filter(b => String(b.zakaz).includes(zk));
    renderZakazChips(list);
    if (boxesSelectedZakaz) list = list.filter(b => String(b.zakaz) === boxesSelectedZakaz);
    const cont = document.getElementById('boxes-list');
    if (!list.length) { cont.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px">Box topilmadi</p>'; return; }
    cont.innerHTML = '';
    if (boxesSelectedZakaz) {
      const top = document.createElement('div');
      top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px';
      top.innerHTML = `<div style="font-size:13px;color:#334155;font-weight:700">Zakaz ${esc(boxesSelectedZakaz)} ichidagi boxlar: ${list.length} ta</div>
        <button class="btn btn-ghost btn-sm" data-act="clear-zakaz">← Barchasi</button>`;
      cont.appendChild(top);
    }
    const max = boxesSelectedZakaz ? list.length : 100;
    list.slice(0, max).forEach(b => cont.appendChild(renderBoxCard(b)));
    if (!boxesSelectedZakaz && list.length > 100) {
      const note = document.createElement('p');
      note.style.cssText = 'text-align:center;color:#94a3b8;padding:10px';
      note.textContent = list.length + ' tadan birinchi 100tasi ko\'rsatilgan';
      cont.appendChild(note);
    }
  } catch (e) { toast(e.message); }
}

function statusBadge(s) {
  const m = {
    packed: ['b-amber', 'Qadoqlandi'],
    warehouse: ['b-blue', 'Omborda'],
    shipping: ['b-indigo', 'Shipmentda'],
    shipped: ['b-green', 'Yuborilgan']
  };
  const [cls, lbl] = m[s] || ['b-gray', s];
  return `<span class="badge ${cls}">${lbl}</span>`;
}

function getBoxTotalPieces(b) {
  if (b.type === 'mix') {
    return (b.items || []).reduce((sum, it) => {
      return sum + Object.values(it.sizes || {}).reduce((s, q) => s + (parseInt(q, 10) || 0), 0);
    }, 0);
  }
  return Object.values(b.sizes || {}).reduce((s, q) => s + (parseInt(q, 10) || 0), 0);
}

function formatSizesText(sizes) {
  if (!sizes || typeof sizes !== 'object') return '';
  const keys = Object.keys(sizes);
  if (!keys.length) return '';
  const sorted = keys.sort((a, b) => {
    const an = parseInt(a, 10);
    const bn = parseInt(b, 10);
    if (Number.isNaN(an) || Number.isNaN(bn)) return String(a).localeCompare(String(b));
    return an - bn;
  });
  return sorted
    .filter(k => (parseInt(sizes[k], 10) || 0) > 0)
    .map(k => `${esc(k)}:${parseInt(sizes[k], 10) || 0}`)
    .join(' · ');
}

function renderBoxSizeDetails(b) {
  if (b.type === 'mix') {
    const rows = (b.items || []).map(it => {
      const t = Object.values(it.sizes || {}).reduce((s, q) => s + (parseInt(q, 10) || 0), 0);
      return `<div class="box-size-line"><strong>${esc(it.model)} / ${esc(it.color)}</strong> — ${formatSizesText(it.sizes)} <span class="muted">(${t} dona)</span></div>`;
    }).filter(Boolean);
    return rows.length ? `<div class="box-size-wrap">${rows.join('')}</div>` : '';
  }
  const txt = formatSizesText(b.sizes);
  return txt ? `<div class="box-size-wrap"><div class="box-size-line"><strong>Razmerlar:</strong> ${txt}</div></div>` : '';
}

function renderBoxCard(b) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.marginBottom = '10px';
  let modelLine = '';
  const total = getBoxTotalPieces(b);
  if (b.type === 'mix') {
    modelLine = (b.items || []).map(it => esc(it.model) + ' (' + Object.values(it.sizes || {}).reduce((a, c) => a + c, 0) + ')').join(', ');
  } else {
    modelLine = esc(b.model || '') + ' / ' + esc(b.color || '');
  }
  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
      <div style="flex:1;min-width:0">
        <div style="font-size:16px;font-weight:800;color:#0f172a">
          ${esc(b.zakaz)}/${esc(b.id)}${b.type === 'mix' ? '<span class="mix-tag">MIX</span>' : ''}
        </div>
        <div style="font-size:12px;color:#475569;margin-top:2px">
          ${modelLine}
        </div>
        <div style="font-size:11px;color:#94a3b8;margin-top:6px">
          ${b.kg} kg · ${total} dona · ${esc(b.createdByName || '')}
        </div>
        ${renderBoxSizeDetails(b)}
      </div>
      <div>${statusBadge(b.status)}</div>
    </div>
    ${(me.role === 'admin' || me.role === 'storekeeper') ? renderBoxActions(b) : ''}`;
  return card;
}

function renderBoxActions(b) {
  const editBtn = (me.role === 'admin' || me.role === 'storekeeper')
    ? `<button class="btn btn-primary btn-sm" data-act="edit-box" data-uid="${esc(b.uid)}" style="margin-top:10px">✏️ Tahrirlash</button>`
    : '';
  const delBtn = (me.role === 'admin' || me.role === 'storekeeper')
    ? `<button class="btn btn-danger btn-sm" data-act="del-box" data-uid="${esc(b.uid)}" style="margin-top:10px;margin-left:6px">🗑 O'chirish</button>`
    : '';
  if (b.status === 'packed') {
    return `${editBtn}<button class="btn btn-success btn-sm" data-act="to-warehouse" data-uid="${esc(b.uid)}" style="margin-top:10px;margin-left:6px">→ Omborga</button>${delBtn}`;
  }
  if (b.status === 'warehouse') {
    return `${editBtn}<button class="btn btn-ghost btn-sm" data-act="to-packed" data-uid="${esc(b.uid)}" style="margin-top:10px;margin-left:6px">← Qaytarish</button>${delBtn}`;
  }
  return `${editBtn}${delBtn}`;
}

function openBoxEdit(box) {
  editingBox = box;
  document.getElementById('be-uid').value = box.uid;
  document.getElementById('be-boxnum').value = box.id;
  document.getElementById('be-zakaz').value = box.zakaz || '';
  document.getElementById('be-kg').value = box.kg || '';
  document.getElementById('be-model-lbl').textContent = box.type === 'mix' ? '🎨 MIX box razmerlari' : `📐 ${box.model || ''} / ${box.color || ''}`;
  const cont = document.getElementById('be-sizes');
  cont.innerHTML = '';
  if (box.type === 'mix') {
    const first = (box.items || [])[0];
    const itemSizes = first?.sizes || {};
    SIZES.forEach(sz => {
      const row = document.createElement('div');
      row.className = 'si-row';
      row.innerHTML = `<span class="si-label">${sz}</span><input type="number" class="si-input be-sz" data-size="${sz}" min="0" value="${itemSizes[sz] || ''}" inputmode="numeric" placeholder="0">`;
      cont.appendChild(row);
    });
  } else {
    SIZES.forEach(sz => {
      const row = document.createElement('div');
      row.className = 'si-row';
      row.innerHTML = `<span class="si-label">${sz}</span><input type="number" class="si-input be-sz" data-size="${sz}" min="0" value="${(box.sizes || {})[sz] || ''}" inputmode="numeric" placeholder="0">`;
      cont.appendChild(row);
    });
  }
  const recalc = () => {
    let t = 0;
    document.querySelectorAll('.be-sz').forEach(i => { t += parseInt(i.value, 10) || 0; });
    document.getElementById('be-total').textContent = `${t} dona`;
  };
  cont.oninput = recalc;
  recalc();
  openModal('m-box-edit');
}

async function saveBoxEdit() {
  if (!editingBox) return;
  const uid = document.getElementById('be-uid').value;
  const zakaz = document.getElementById('be-zakaz').value.trim();
  const kg = parseFloat(document.getElementById('be-kg').value);
  if (!zakaz) return showInfo('Zakaz kerak');
  if (!kg || kg <= 0) return showInfo('Og\'irlik kerak');
  const sizes = {};
  document.querySelectorAll('.be-sz').forEach(i => {
    const v = parseInt(i.value, 10) || 0;
    if (v > 0) sizes[i.dataset.size] = v;
  });
  if (!Object.keys(sizes).length) return showInfo('Kamida 1 ta razmer kiriting');
  const body = { uid, zakaz, kg };
  if (editingBox.type === 'mix') {
    const first = (editingBox.items || [])[0];
    body.items = [{ model: first?.model || '', color: first?.color || '', sizes }];
  } else {
    body.sizes = sizes;
  }
  try {
    await api('PUT', '/api/boxes/_', body);
    closeModals();
    toast('✓ Box tahrirlandi');
    if (currentTab === 'boxes') loadBoxes();
    if (currentTab === 'shipments') renderShipments();
  } catch (e) { showInfo(e.message); }
}

// ============== STATIC HTML BUTTON HANDLERS (CSP-safe, data-action) ==============
const ACTIONS = {
  'login': doLogin,
  'logout': doLogout,
  'toggle-sidebar': () => document.getElementById('sidebar').classList.toggle('open'),
  'close-modals': closeModals,
  'choose-simple': chooseSimple,
  'choose-mix': chooseMix,
  'save-simple': saveSimple,
  'save-mix': saveMix,
  'mix-scan1-done': mixScan1Done,
  'mix-scan2-done': mixScan2Done,
  'mix-back1': mixBack1,
  'save-order': saveOrderEdit,
  'save-user': saveUser,
  'save-box-edit': saveBoxEdit
};

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const fn = ACTIONS[btn.dataset.action];
  if (fn) { e.preventDefault(); fn(); }
});

// Enter key on inputs with data-enter="<action-name>"
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const inp = e.target.closest('[data-enter]');
  if (!inp) return;
  const fn = ACTIONS[inp.dataset.enter];
  if (fn) { e.preventDefault(); fn(); }
});

// Login form: Enter on password field
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'inp-pass' || e.target.id === 'inp-user') {
    e.preventDefault();
    doLogin();
  }
});

// ============== DYNAMIC EVENT DELEGATION (data-act) ==============
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  const uid = btn.dataset.uid;
  try {
    if (act === 'to-warehouse') {
      await api('PUT', '/api/boxes/_/status', { uid, status: 'warehouse' });
      toast('✓ Omborga'); loadBoxes();
    } else if (act === 'to-packed') {
      await api('PUT', '/api/boxes/_/status', { uid, status: 'packed' });
      toast('✓ Qaytarildi'); loadBoxes();
    } else if (act === 'edit-order') {
      const order = JSON.parse(btn.dataset.order);
      openOrderEdit(order);
    } else if (act === 'del-order') {
      const id = btn.dataset.id;
      showConfirm('O\'chirish', 'Orderni o\'chirishni tasdiqlaysizmi?', async () => {
        try { await api('DELETE', '/api/orders/' + id); toast('✓ O\'chirildi'); renderOrders(); }
        catch (e) { showInfo(e.message); }
      });
    } else if (act === 'del-user') {
      const id = btn.dataset.id;
      showConfirm('O\'chirish', 'Foydalanuvchini o\'chirishni tasdiqlaysizmi?', async () => {
        try { await api('DELETE', '/api/users/' + id); toast('✓ O\'chirildi'); renderUsers(); }
        catch (e) { showInfo(e.message); }
      });
    } else if (act === 'reset-pass') {
      const id = btn.dataset.id;
      const np = prompt('Yangi parol (kamida 6 belgi):');
      if (!np) return;
      try { await api('PUT', '/api/users/' + id + '/password', { password: np }); toast('✓ Parol o\'zgardi'); }
      catch (e) { showInfo(e.message); }
    } else if (act === 'add-shp-box') {
      await api('POST', '/api/shipments/open/boxes', { boxUid: uid, action: 'add' });
      toast('✓ Qo\'shildi'); renderShipments();
    } else if (act === 'rm-shp-box') {
      await api('POST', '/api/shipments/open/boxes', { boxUid: uid, action: 'remove' });
      toast('✓ Qaytarildi'); renderShipments();
    } else if (act === 'open-zakaz') {
      boxesSelectedZakaz = btn.dataset.zakaz || '';
      loadBoxes();
    } else if (act === 'clear-zakaz') {
      boxesSelectedZakaz = '';
      loadBoxes();
    } else if (act === 'del-shipment') {
      const id = btn.dataset.id;
      const st = btn.dataset.shipmentStatus || '';
      const body = st === 'closed'
        ? `${id}: tarix yozuvini o\'chirasizmi? Yuborilgan boxlar holati o\'zgarmaydi.`
        : `${id}: ochiq shipment o\'chiriladi; shipmentdagi boxlar omborga qaytadi.`;
      showConfirm('Shipmentni o\'chirish', body, async () => {
        try { await api('DELETE', '/api/shipments/' + encodeURIComponent(id)); toast('✓ Shipment o\'chirildi'); renderShipments(); }
        catch (e) { showInfo(e.message); }
      });
    } else if (act === 'del-box') {
      showConfirm('Boxni o\'chirish', 'Boxni o\'chirishni tasdiqlaysizmi?', async () => {
        try {
          await api('DELETE', '/api/boxes/_?uid=' + encodeURIComponent(uid));
          toast('✓ Box o\'chirildi');
          if (currentTab === 'boxes') loadBoxes();
          if (currentTab === 'shipments') renderShipments();
        } catch (e) { showInfo(e.message); }
      });
    } else if (act === 'edit-box') {
      const all = await api('GET', '/api/boxes');
      const box = all.find(x => x.uid === uid);
      if (!box) return showInfo('Box topilmadi');
      openBoxEdit(box);
    } else if (act === 'toggle-shp-hist') {
      const key = btn.dataset.key;
      const el = document.getElementById('shp-det-' + key);
      if (!el) return;
      const open = el.style.display === 'block';
      el.style.display = open ? 'none' : 'block';
      btn.textContent = open ? 'Ko\'rish' : 'Yopish';
    }
  } catch (err) { showInfo(err.message); }
});

// ============== DETALNIY ==============
async function renderDetalniy() {
  const c = document.getElementById('page-content');
  c.innerHTML = `
    <div class="card">
      <div class="section-hdr">
        <div class="section-title">📋 Detalniy (Ombor hisoboti)</div>
        <button class="btn btn-success btn-sm" id="d-excel">⬇ Excel</button>
      </div>
      <div class="row2" style="margin-bottom:12px">
        <input type="text" id="d-zakaz" placeholder="Zakaz (masalan: 600)">
        <input type="text" id="d-model" placeholder="Model (LRTT084)">
      </div>
      <div id="det-table">Yuklanmoqda...</div>
    </div>`;
  document.getElementById('d-zakaz').addEventListener('input', loadDetalniy);
  document.getElementById('d-model').addEventListener('input', loadDetalniy);
  document.getElementById('d-excel').addEventListener('click', downloadDetalniyExcel);
  loadDetalniy();
}

async function loadDetalniy() {
  const zk = document.getElementById('d-zakaz').value.trim();
  const md = document.getElementById('d-model').value.trim();
  const qs = new URLSearchParams();
  if (zk) qs.set('zakaz', zk);
  if (md) qs.set('model', md);
  try {
    const [groups, allBoxes] = await Promise.all([
      api('GET', '/api/detalniy?' + qs),
      api('GET', '/api/boxes')
    ]);
    const div = document.getElementById('det-table');
    if (!groups.length) { div.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px">Ombor bo\'sh</p>'; return; }
    const whBoxes = allBoxes.filter(b => b.status === 'warehouse');
    const whPieces = whBoxes.reduce((s, b) => s + getBoxTotalPieces(b), 0);
    let html = '<div style="overflow-x:auto"><table class="detalniy-xl"><thead>';
    html = `<div class="info-row" style="margin-bottom:10px">
      <span class="info-lbl">Omborda jami karobka</span>
      <span class="info-val">${whBoxes.length} ta (${whPieces} dona)</span>
    </div>` + html;
    html += '<tr>';
    html += '<th rowspan="2">Model #</th><th rowspan="2">Color</th><th rowspan="2">Номер</th><th rowspan="2">Специфика</th><th colspan="' + SIZES.length + '">Размеры</th>';
    html += '</tr><tr>';
    SIZES.forEach(s => html += '<th>' + s + '</th>');
    html += '</tr></thead><tbody>';
    groups.forEach(g => {
      const rows = (g.boxes || []).map(b => {
        if (b.type === 'mix') {
          const item = (b.items || []).find(it =>
            String(it.model || '').trim().toLowerCase() === String(g.model || '').trim().toLowerCase() &&
            String(it.color || '').trim().toLowerCase() === String(g.color || '').trim().toLowerCase()
          );
          return item?.sizes || {};
        }
        return b.sizes || {};
      });
      const spec = rows.length;
      rows.forEach((rs, idx) => {
        html += '<tr>';
        if (idx === 0) {
          html += `<td class="td-bold" rowspan="${spec}">${esc(g.model)}</td>`;
          html += `<td class="td-bold" rowspan="${spec}">${esc(g.color)}</td>`;
          html += `<td class="td-bold" rowspan="${spec}">${esc(g.zakaz)}</td>`;
          html += `<td class="td-bold" rowspan="${spec}">${spec}</td>`;
        }
        SIZES.forEach(sz => html += `<td>${rs[sz] || ''}</td>`);
        html += '</tr>';
      });
    });
    html += '</tbody></table></div>';
    div.innerHTML = html;
  } catch (e) { toast(e.message); }
}

async function downloadDetalniyExcel() {
  const zk = document.getElementById('d-zakaz').value.trim();
  const md = document.getElementById('d-model').value.trim();
  const qs = new URLSearchParams();
  if (zk) qs.set('zakaz', zk);
  if (md) qs.set('model', md);
  try {
    const r = await fetch('/api/detalniy/excel?' + qs, {
      headers: token ? { 'x-session-token': token } : {},
      credentials: 'include'
    });
    if (!r.ok) { showInfo('Yuklab bo\'lmadi'); return; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Detalniy_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (e) { showInfo(e.message); }
}

// ============== SHIPMENTS ==============
function aggregateShipmentSnapshot(snapshot) {
  const groups = {};
  const add = (model, color, boxUid, sizes) => {
    const key = `${String(model || '').trim().toLowerCase()}|${String(color || '').trim().toLowerCase()}`;
    if (!groups[key]) groups[key] = { model: String(model || '').trim(), color: String(color || '').trim(), boxMap: {}, sizes: {} };
    groups[key].boxMap[String(boxUid || '')] = true;
    Object.entries(sizes || {}).forEach(([sz, q]) => {
      const v = parseInt(q, 10) || 0;
      if (v > 0) groups[key].sizes[sz] = (groups[key].sizes[sz] || 0) + v;
    });
  };
  (snapshot || []).forEach(b => {
    if (b.type === 'mix') {
      (b.items || []).forEach(it => add(it.model, it.color, b.uid || `${b.zakaz}-${b.id}`, it.sizes));
    } else {
      add(b.model, b.color, b.uid || `${b.zakaz}-${b.id}`, b.sizes);
    }
  });
  return Object.values(groups).map(g => {
    const sizesTxt = Object.keys(g.sizes)
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
      .map(sz => `${sz}:${g.sizes[sz]}`)
      .join(' · ');
    const total = Object.values(g.sizes).reduce((s, q) => s + q, 0);
    return { model: g.model, color: g.color, boxCount: Object.keys(g.boxMap).length, total, sizesTxt };
  });
}

async function renderShipments() {
  const c = document.getElementById('page-content');
  c.innerHTML = `<div id="shp-content">Yuklanmoqda...</div>`;
  try {
    const [open, allBoxes, allShipments] = await Promise.all([
      api('GET', '/api/shipments/open'),
      api('GET', '/api/boxes'),
      api('GET', '/api/shipments')
    ]);
    const closedShipments = (allShipments || []).filter(s => s.status === 'closed');
    const historyHtml = `
      <div class="card">
        <div class="section-title">🕓 Shipment tarixi (${closedShipments.length})</div>
        <div id="shp-history" style="margin-top:10px">
          ${closedShipments.length ? closedShipments.map((s, i) => {
            const snap = Array.isArray(s.snapshot) ? s.snapshot : [];
            const pcs = snap.reduce((sum, b) => {
              const t = b.type === 'mix'
                ? (b.items || []).reduce((a, it) => a + Object.values(it.sizes || {}).reduce((x, y) => x + (parseInt(y, 10) || 0), 0), 0)
                : Object.values(b.sizes || {}).reduce((x, y) => x + (parseInt(y, 10) || 0), 0);
              return sum + t;
            }, 0);
            const kg = snap.reduce((sum, b) => sum + (parseFloat(b.kg) || 0), 0);
            const dt = s.closedAt ? new Date(s.closedAt).toLocaleString('uz-UZ') : '—';
            const rows = aggregateShipmentSnapshot(snap);
            const details = rows.length
              ? rows.map(r => `<div class="ship-history-item"><div><strong>${esc(r.model)} / ${esc(r.color)}</strong> — ${r.boxCount} box · ${r.total} dona</div><div class="ship-history-sizes">${esc(r.sizesTxt || '—')}</div></div>`).join('')
              : `<div class="ship-history-item">Ma'lumot yo'q</div>`;
            const histBtns = `<div class="ship-history-actions">
                <button type="button" class="btn btn-ghost btn-sm" data-act="toggle-shp-hist" data-key="${i}">Ko'rish</button>
                ${me.role === 'admin' ? `<button type="button" class="btn btn-danger btn-sm" data-act="del-shipment" data-id="${esc(s.id)}" data-shipment-status="closed" title="Tarixdan o'chirish">🗑</button>` : ''}
              </div>`;
            return `<div class="ship-history-row">
              <div>
                <div class="ship-history-title">${esc(s.id)} · ${snap.length} box</div>
                <div class="ship-history-sub">${dt} · ${kg.toFixed(1)} kg · ${pcs} dona</div>
                <div id="shp-det-${i}" class="ship-history-details">${details}</div>
              </div>
              ${histBtns}
            </div>`;
          }).join('') : '<p style="text-align:center;color:#94a3b8;padding:14px">Hali yopilgan shipment yo\'q</p>'}
        </div>
      </div>`;

    if (!open) {
      document.getElementById('shp-content').innerHTML = `
        <div class="card">
          <div class="section-title">🚛 Yangi shipment ochish</div>
          <div class="form-group" style="margin-top:12px"><label>Mashina ma'lumoti</label><input type="text" id="shp-truck" placeholder="DAF / 01 A 123 BB"></div>
          <div class="form-group"><label>Izoh</label><input type="text" id="shp-note" placeholder="Ixtiyoriy"></div>
          <button class="btn btn-primary btn-block" id="open-shp">🚛 Ochish</button>
        </div>
        ${historyHtml}`;
      document.getElementById('open-shp').addEventListener('click', async () => {
        try {
          await api('POST', '/api/shipments/open', {
            truckInfo: document.getElementById('shp-truck').value,
            note: document.getElementById('shp-note').value
          });
          toast('✓ Shipment ochildi'); renderShipments();
        } catch (e) { showInfo(e.message); }
      });
      return;
    }

    const inShp = allBoxes.filter(b => open.boxUids.includes(b.uid));
    const wh = allBoxes.filter(b => b.status === 'warehouse');
    const total = inShp.reduce((s, b) => s + (b.kg || 0), 0);

    document.getElementById('shp-content').innerHTML = `
      <div class="card">
        <div class="section-hdr">
          <div>
            <div style="font-size:11px;color:#94a3b8;font-weight:700;letter-spacing:.06em">OCHIQ SHIPMENT</div>
            <div style="font-size:18px;font-weight:800">${esc(open.id)}</div>
          </div>
          <span class="badge b-amber">OCHIQ</span>
        </div>
        <div class="info-row"><span class="info-lbl">Mashina</span><span class="info-val">${esc(open.truckInfo || '—')}</span></div>
        <div class="info-row"><span class="info-lbl">Boxlar</span><span class="info-val">${inShp.length} ta</span></div>
        <div class="info-row"><span class="info-lbl">Og'irlik</span><span class="info-val">${total.toFixed(1)} kg</span></div>
        <button class="btn btn-success btn-block" id="close-shp" style="margin-top:12px">✓ Shipmentni yopish</button>
        ${me.role === 'admin' ? `<button class="btn btn-danger btn-block" data-act="del-shipment" data-id="${esc(open.id)}" data-shipment-status="open" style="margin-top:8px">🗑 Shipmentni o'chirish (Admin)</button>` : ''}
      </div>
      <div class="card">
        <div class="section-title">📦 Shipmentdagi boxlar (${inShp.length})</div>
        <input type="text" id="shp-search" placeholder="Qidiruv: zakaz, box, model..." style="margin-top:10px">
        <div id="shp-in-list" style="margin-top:10px">${inShp.length ? '' : '<p style="text-align:center;color:#94a3b8;padding:14px">Box yo\'q</p>'}</div>
      </div>
      <div class="card">
        <div class="section-title">🏭 Ombordagi boxlar (${wh.length})</div>
        <div id="shp-wh-list" style="margin-top:10px">${wh.length ? '' : '<p style="text-align:center;color:#94a3b8;padding:14px">Bo\'sh</p>'}</div>
      </div>
      ${historyHtml}`;

    const inList = document.getElementById('shp-in-list');
    const whList = document.getElementById('shp-wh-list');
    const searchInp = document.getElementById('shp-search');
    const renderLists = () => {
      const q = (searchInp.value || '').trim().toLowerCase();
      const hasQ = Boolean(q);
      const byQuery = (b) => {
        if (!hasQ) return true;
        const modelTxt = b.type === 'mix'
          ? (b.items || []).map(it => `${it.model || ''} ${it.color || ''}`).join(' ')
          : `${b.model || ''} ${b.color || ''}`;
        const hay = `${b.zakaz || ''} ${b.id || ''} ${modelTxt}`.toLowerCase();
        return hay.includes(q);
      };
      const inFiltered = inShp.filter(byQuery);
      const whFiltered = wh.filter(byQuery);
      inList.innerHTML = inFiltered.length ? '' : '<p style="text-align:center;color:#94a3b8;padding:14px">Mos box topilmadi</p>';
      whList.innerHTML = whFiltered.length ? '' : '<p style="text-align:center;color:#94a3b8;padding:14px">Mos box topilmadi</p>';
      inFiltered.forEach(b => inList.appendChild(makeShpRow(b, 'rm-shp-box', 'Qaytarish')));
      whFiltered.forEach(b => whList.appendChild(makeShpRow(b, 'add-shp-box', '+ Qo\'shish')));
    };
    searchInp.addEventListener('input', renderLists);
    renderLists();
    document.getElementById('close-shp').addEventListener('click', () => {
      showConfirm('Shipment yopish', 'Bu amalni qaytarib bo\'lmaydi.', async () => {
        try { await api('POST', '/api/shipments/open/close', {}); toast('✓ Yopildi'); renderShipments(); }
        catch (e) { showInfo(e.message); }
      });
    });
  } catch (e) { toast(e.message); }
}

function makeShpRow(b, act, lbl) {
  const r = document.createElement('div');
  r.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9';
  const total = b.type === 'mix'
    ? (b.items || []).reduce((s, it) => s + Object.values(it.sizes || {}).reduce((a, c) => a + c, 0), 0)
    : Object.values(b.sizes || {}).reduce((a, c) => a + c, 0);
  r.innerHTML = `
    <div style="flex:1;min-width:0">
      <div style="font-weight:700;color:#0f172a">${esc(b.zakaz)}/${esc(b.id)}${b.type === 'mix' ? '<span class="mix-tag">MIX</span>' : ''}</div>
      <div style="font-size:12px;color:#64748b">${b.kg} kg · ${total} dona</div>
    </div>
    <button class="btn btn-${act === 'add-shp-box' ? 'primary' : 'ghost'} btn-sm" data-act="${act}" data-uid="${esc(b.uid)}">${lbl}</button>`;
  return r;
}

// ============== ORDERS ==============
async function renderOrders() {
  const c = document.getElementById('page-content');
  c.innerHTML = `
    <div class="card">
      <div class="section-hdr">
        <div class="section-title">📝 Orderlar</div>
        <button class="btn btn-primary btn-sm" id="add-order">+ Yangi</button>
      </div>
      <div id="orders-list">Yuklanmoqda...</div>
    </div>`;
  document.getElementById('add-order').addEventListener('click', () => openOrderEdit({}));
  try {
    const [list, boxes] = await Promise.all([
      api('GET', '/api/orders'),
      api('GET', '/api/boxes')
    ]);
    const div = document.getElementById('orders-list');
    if (!list.length) { div.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px">Order yo\'q</p>'; return; }
    const statsByKey = {};
    const makeKey = (m, c) => `${String(m || '').trim().toLowerCase()}|${String(c || '').trim().toLowerCase()}`;
    boxes.forEach(b => {
      if (b.type === 'mix') {
        (b.items || []).forEach(it => {
          const key = makeKey(it.model, it.color);
          if (!statsByKey[key]) statsByKey[key] = { packed: 0, shipped: 0 };
          const pcs = Object.values(it.sizes || {}).reduce((s, q) => s + (parseInt(q, 10) || 0), 0);
          if (['packed', 'warehouse', 'shipping', 'shipped'].includes(b.status)) statsByKey[key].packed += pcs;
          if (b.status === 'shipped') statsByKey[key].shipped += pcs;
        });
      } else {
        const key = makeKey(b.model, b.color);
        if (!statsByKey[key]) statsByKey[key] = { packed: 0, shipped: 0 };
        const pcs = Object.values(b.sizes || {}).reduce((s, q) => s + (parseInt(q, 10) || 0), 0);
        if (['packed', 'warehouse', 'shipping', 'shipped'].includes(b.status)) statsByKey[key].packed += pcs;
        if (b.status === 'shipped') statsByKey[key].shipped += pcs;
      }
    });
    let html = '<div style="overflow-x:auto"><table><thead><tr><th>Model</th><th>Rang</th><th>Barcode</th><th>Buyurtma</th><th>Tayyor</th><th>Yuborildi</th><th>Progress</th><th></th></tr></thead><tbody>';
    list.forEach(o => {
      const st = statsByKey[makeKey(o.model, o.color)] || { packed: 0, shipped: 0 };
      const progress = o.total > 0 ? Math.min(100, (st.packed / o.total) * 100) : 0;
      html += `<tr>
        <td class="td-bold">${esc(o.model)}</td>
        <td>${esc(o.color)}</td>
        <td style="font-family:monospace">${esc(o.barcode || '—')}</td>
        <td>${o.total}</td>
        <td>${st.packed}</td>
        <td>${st.shipped}</td>
        <td style="min-width:150px">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden">
              <div style="height:100%;width:${progress.toFixed(1)}%;background:#16a34a"></div>
            </div>
            <span style="font-size:11px;font-weight:700;color:#0f766e">${progress.toFixed(1)}%</span>
          </div>
        </td>
        <td>
          <button class="btn btn-ghost btn-sm" data-act="edit-order" data-order='${esc(JSON.stringify(o))}'>✎</button>
          <button class="btn btn-ghost btn-sm" data-act="del-order" data-id="${esc(o.id)}">🗑</button>
        </td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    div.innerHTML = html;
  } catch (e) { toast(e.message); }
}

function openOrderEdit(o) {
  document.getElementById('m-oe-title').textContent = o.id ? 'Orderni tahrirlash' : 'Yangi order';
  document.getElementById('edit-order-id').value = o.id || '';
  document.getElementById('edit-barcode').value = o.barcode || '';
  document.getElementById('edit-model').value = o.model || '';
  document.getElementById('edit-color').value = o.color || '';
  document.getElementById('edit-total').value = o.total || '';
  openModal('m-order-edit');
  setTimeout(() => document.getElementById('edit-barcode').focus(), 100);
}

async function saveOrderEdit() {
  const id = document.getElementById('edit-order-id').value;
  const body = {
    barcode: document.getElementById('edit-barcode').value.trim(),
    model: document.getElementById('edit-model').value.trim(),
    color: document.getElementById('edit-color').value.trim(),
    total: parseInt(document.getElementById('edit-total').value) || 0
  };
  if (!body.model || !body.color || !body.total) return showInfo('Model, rang va miqdor kerak');
  try {
    if (id) await api('PUT', '/api/orders/' + id, body);
    else await api('POST', '/api/orders', body);
    closeModals();
    toast('✓ Saqlandi');
    if (currentTab === 'orders') renderOrders();
  } catch (e) { showInfo(e.message); }
}

// ============== USERS ==============
async function renderUsers() {
  const c = document.getElementById('page-content');
  c.innerHTML = `
    <div class="card">
      <div class="section-hdr">
        <div class="section-title">👥 Foydalanuvchilar</div>
        <button class="btn btn-primary btn-sm" id="add-user">+ Yangi</button>
      </div>
      <div id="users-list">Yuklanmoqda...</div>
    </div>`;
  document.getElementById('add-user').addEventListener('click', () => openUserEdit());
  try {
    const list = await api('GET', '/api/users');
    const div = document.getElementById('users-list');
    let html = '<div style="overflow-x:auto"><table><thead><tr><th>Ism</th><th>Login</th><th>Rol</th><th></th></tr></thead><tbody>';
    list.forEach(u => {
      html += `<tr>
        <td class="td-bold">${esc(u.name)}</td>
        <td>${esc(u.username)}</td>
        <td>${roleLabel(u.role)}</td>
        <td>
          <button class="btn btn-ghost btn-sm" data-act="reset-pass" data-id="${esc(u.id)}">🔑</button>
          ${u.username !== 'admin' ? `<button class="btn btn-ghost btn-sm" data-act="del-user" data-id="${esc(u.id)}">🗑</button>` : ''}
        </td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    div.innerHTML = html;
  } catch (e) { toast(e.message); }
}

function openUserEdit() {
  document.getElementById('m-u-title').textContent = 'Yangi foydalanuvchi';
  document.getElementById('u-name').value = '';
  document.getElementById('u-username').value = '';
  document.getElementById('u-password').value = '';
  document.getElementById('u-role').value = 'worker';
  openModal('m-user');
}

async function saveUser() {
  const body = {
    name: document.getElementById('u-name').value.trim(),
    username: document.getElementById('u-username').value.trim(),
    password: document.getElementById('u-password').value,
    role: document.getElementById('u-role').value
  };
  if (!body.username || !body.password) return showInfo('Login va parol kerak');
  if (body.password.length < 6) return showInfo('Parol kamida 6 belgi');
  try {
    await api('POST', '/api/users', body);
    closeModals();
    toast('✓ Saqlandi');
    renderUsers();
  } catch (e) { showInfo(e.message); }
}

// ============== AUDIT ==============
async function renderAudit() {
  const c = document.getElementById('page-content');
  c.innerHTML = `<div class="card">
    <div class="section-title">📜 Audit log</div>
    <div class="row2" style="margin-top:12px">
      <input type="text" id="a-user" placeholder="Qidiruv user">
      <input type="text" id="a-action" placeholder="Qidiruv action">
    </div>
    <div id="audit-list" style="margin-top:10px">Yuklanmoqda...</div>
  </div>`;
  try {
    const list = await api('GET', '/api/audit-logs');
    const div = document.getElementById('audit-list');
    const renderList = () => {
      const uq = (document.getElementById('a-user').value || '').trim().toLowerCase();
      const aq = (document.getElementById('a-action').value || '').trim().toLowerCase();
      const filtered = list.filter(l => {
        const byTxt = `${l.by_name || ''} ${l.by_user || ''}`.toLowerCase();
        const actTxt = String(l.type || '').toLowerCase();
        return (!uq || byTxt.includes(uq)) && (!aq || actTxt.includes(aq));
      });
      if (!filtered.length) { div.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px">Mos audit topilmadi</p>'; return; }
      let html = '<div style="overflow-x:auto"><table><thead><tr><th>Vaqt</th><th>Amal</th><th>Kim</th><th>IP</th><th>Detal</th></tr></thead><tbody>';
      filtered.forEach(l => {
        const dt = new Date(l.at).toLocaleString('uz-UZ');
        html += '<tr><td style="font-size:11px">' + esc(dt) + '</td><td><span class="badge b-blue">' + esc(l.type) + '</span></td><td>' + esc(l.by_name || l.by_user) + '</td><td style="font-family:monospace;font-size:11px">' + esc(l.ip || '—') + '</td><td style="font-size:11px;color:#64748b">' + esc(JSON.stringify(l.details || {})) + '</td></tr>';
      });
      html += '</tbody></table></div>';
      div.innerHTML = html;
    };
    document.getElementById('a-user').addEventListener('input', renderList);
    document.getElementById('a-action').addEventListener('input', renderList);
    renderList();
  } catch (e) { toast(e.message); }
}

// ============== PROFILE ==============
async function renderProfile() {
  const c = document.getElementById('page-content');
  c.innerHTML = `
    <div class="card">
      <div class="section-title">⚙️ Mening profilim</div>
      <div class="info-row"><span class="info-lbl">Ism</span><span class="info-val">${esc(me.name)}</span></div>
      <div class="info-row"><span class="info-lbl">Login</span><span class="info-val">${esc(me.username)}</span></div>
      <div class="info-row"><span class="info-lbl">Rol</span><span class="info-val">${roleLabel(me.role)}</span></div>
    </div>
    <div class="card">
      <div class="section-title">🔒 Parolni o'zgartirish</div>
      <div class="form-group" style="margin-top:12px"><label>Eski parol</label><input type="password" id="p-old"></div>
      <div class="form-group"><label>Yangi parol (kamida 6 belgi)</label><input type="password" id="p-new"></div>
      <div class="form-group"><label>Yangi parolni takrorlang</label><input type="password" id="p-new2"></div>
      <button class="btn btn-primary btn-block" id="p-save">✓ Saqlash</button>
      <div class="hint" style="margin-top:8px">Parol o'zgartirilgach, boshqa qurilmalardagi sessionlar yopiladi.</div>
    </div>`;
  document.getElementById('p-save').addEventListener('click', async () => {
    const oldP = document.getElementById('p-old').value;
    const newP = document.getElementById('p-new').value;
    const newP2 = document.getElementById('p-new2').value;
    if (!oldP || !newP) return showInfo('Eski va yangi parolni kiriting');
    if (newP.length < 6) return showInfo('Yangi parol kamida 6 belgi');
    if (newP !== newP2) return showInfo('Parollar mos kelmadi');
    try {
      await api('POST', '/api/me/password', { oldPassword: oldP, newPassword: newP });
      toast('✓ Parol o\'zgardi');
      document.getElementById('p-old').value = '';
      document.getElementById('p-new').value = '';
      document.getElementById('p-new2').value = '';
    } catch (e) { showInfo(e.message); }
  });
}

// ============== INIT ==============
(async function init() {
  token = Storage.get('token');
  if (token) {
    try {
      const r = await api('GET', '/api/me');
      if (r.user) { me = r.user; showApp(); return; }
    } catch {}
  }
  showLogin();
})();
