// One page: read-only for everyone; editing tools appear after admin login.
// Every change is also verified on the server, so the UI is not the security boundary.
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const state = { items: [], types: [], sections: [], channels: [], meta: {}, defaultSection: 'Public links', admin: false };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const size = (b) => !b ? '' : b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
const uniq = (list, k) => [...new Set(list.map((i) => i[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b));
const today = () => new Date().toISOString().slice(0, 10);
const chans = (i) => (Array.isArray(i.channels) ? i.channels : []);
const FILTERS = ['#q', '#from', '#to', '#fChannel'];
const NEW_SECTION = '__new__';

async function api(path, opts = {}) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', ...opts });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: r.status });
  return data;
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1600);
}

// ---------- in-page dialog (instead of browser prompt/confirm)
function ask({ title, message = '', value = null, ok = 'OK', danger = false }) {
  return new Promise((resolve) => {
    const dlg = $('#askDlg'), input = $('#askInput'), okBtn = $('#askOk');
    $('#askTitle').textContent = title;
    $('#askMsg').textContent = message;
    $('#askMsg').classList.toggle('hidden', !message);
    input.classList.toggle('hidden', value === null);
    input.value = value ?? '';
    okBtn.textContent = ok;
    okBtn.classList.toggle('danger-fill', danger);
    const done = (result) => { dlg.close(); $('#askForm').onsubmit = null; $('#askCancel').onclick = null; dlg.oncancel = null; resolve(result); };
    $('#askForm').onsubmit = (e) => { e.preventDefault(); done(value === null ? true : input.value.trim()); };
    $('#askCancel').onclick = () => done(null);
    dlg.oncancel = (e) => { e.preventDefault(); done(null); };
    dlg.showModal();
    if (value !== null) { input.focus(); input.select(); } else okBtn.focus();
  });
}

// ---------- data
async function load() {
  try { state.admin = (await api('/api/me')).admin; } catch { state.admin = false; }
  ['#newCampaignBtn', '#logoutBtn', '#adminBadge'].forEach((s) => $(s).classList.toggle('hidden', !state.admin));
  $('#loginBtn').classList.toggle('hidden', state.admin);

  const n = $('#notice');
  try {
    Object.assign(state, await api('/api/assets'));
    n.classList.add('hidden');
  } catch (e) {
    state.items = [];
    n.textContent = e.status === 401 ? 'This dashboard is private. Please log in.' : e.message;
    n.classList.remove('hidden');
  }
  fillFilters();
  render();
}

const allChannels = () => [...new Set([...state.channels, ...state.items.flatMap(chans).sort((a, b) => a.localeCompare(b))])];
const allSections = () => [...new Set([...state.sections, ...uniq(state.items, 'section')])];

function fillFilters() {
  const ch = $('#fChannel'), cur = ch.value, channels = allChannels();
  ch.innerHTML = '<option value="">All channels</option>' + channels.map((v) => `<option>${esc(v)}</option>`).join('');
  ch.value = channels.includes(cur) ? cur : '';
  $('#campaignList').innerHTML = uniq(state.items, 'campaign').map((v) => `<option value="${esc(v)}">`).join('');
}

function filtered() {
  const q = $('#q').value.trim().toLowerCase();
  const from = $('#from').value, to = $('#to').value, ch = $('#fChannel').value;
  return state.items.filter((i) =>
    (!q || (i.campaign || '').toLowerCase().includes(q)) &&
    (!ch || chans(i).includes(ch)) &&
    (!from || (i.publishedAt && i.publishedAt >= from)) &&
    (!to || (i.publishedAt && i.publishedAt <= to)));
}

// Section order: saved order for the campaign, then any new sections at the end (in the order they were created).
function sectionOrder(campaign, items) {
  const saved = state.meta[campaign]?.sections || [];
  const byCreated = [...items].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  return [...new Set([...saved, ...byCreated.map((i) => i.section || state.defaultSection)])];
}
const typeOrder = (t) => { const x = state.types.indexOf(t); return x < 0 ? 99 : x; };
const byTypeThenDate = (a, b) => typeOrder(a.type) - typeOrder(b.type) || (a.publishedAt || '').localeCompare(b.publishedAt || '');
const campItems = (c) => state.items.filter((i) => (i.campaign || '') === c);

function groupCampaigns(list) {
  const groups = new Map();
  for (const i of list) {
    const k = i.campaign || '';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(i);
  }
  return [...groups.entries()].map(([name, items]) => {
    const dates = items.map((i) => i.publishedAt).filter(Boolean).sort();
    const order = sectionOrder(name, campItems(name));
    const sections = order
      .map((s) => ({ name: s, items: items.filter((i) => (i.section || state.defaultSection) === s).sort(byTypeThenDate) }))
      .filter((s) => s.items.length);
    return { name, sections, order, first: dates[0], last: dates[dates.length - 1] };
  }).sort((a, b) => (b.last || '').localeCompare(a.last || ''));
}

// ---------- list rendering
function itemHTML(i) {
  const A = state.admin;
  const isFile = !!i.fileName;
  const details = isFile ? [chans(i).join(', '), i.fileName, size(i.fileSize), fmt(i.publishedAt)] : [chans(i).join(', '), fmt(i.publishedAt)];
  return `
    <li>
      <a href="${esc(i.url)}" target="_blank" rel="noopener noreferrer" title="${esc(i.url)}">
        <span class="tick">${isFile ? '▤' : '✓'}</span>
        <span class="what">${esc(i.type)}${i.title ? ` — ${esc(i.title)}` : ''}</span>
        <span class="sub">${details.filter(Boolean).map(esc).join(' · ')}</span>
      </a>
      ${A && i.visibility === 'admin' ? '<span class="lock" title="Only visible to you">only me</span>' : ''}
      ${A ? `<span class="item-admin">
        <button class="link-btn" data-edit="${esc(i.id)}">Edit</button>
        <button class="link-btn danger" data-del="${esc(i.id)}">Delete</button>
      </span>` : ''}
    </li>`;
}

function render() {
  const campaigns = groupCampaigns(filtered());
  const A = state.admin;
  $('#list').innerHTML = campaigns.map((c) => `
    <section class="campaign">
      <div>
        <div class="c-name">${esc(c.name || 'No campaign')}</div>
        <div class="c-dates">${c.first ? (c.first === c.last ? fmt(c.first) : `${fmt(c.first)} – ${fmt(c.last)}`) : ''}</div>
        ${A ? `<div class="c-admin">
          <button class="btn sm" data-open="${esc(c.name)}">Edit campaign</button>
        </div>` : ''}
      </div>
      <div class="sections">
        ${c.sections.map((s) => {
          const idx = c.order.indexOf(s.name);
          const attrs = `data-sec="${esc(s.name)}" data-camp="${esc(c.name)}"`;
          return `
          <div class="section">
            <div class="s-head">
              <span class="s-name">${esc(s.name)}</span>
              ${A ? `<span class="s-admin">
                <button class="link-btn" data-addsec ${attrs}>+ Add</button>
                <button class="link-btn" data-rensec ${attrs}>Rename</button>
                ${idx > 0 ? `<button class="link-btn" data-move="-1" ${attrs} title="Move up">↑</button>` : ''}
                ${idx < c.order.length - 1 ? `<button class="link-btn" data-move="1" ${attrs} title="Move down">↓</button>` : ''}
              </span>` : ''}
            </div>
            <ul class="checks">${s.items.map(itemHTML).join('')}</ul>
          </div>`;
        }).join('')}
      </div>
    </section>`).join('');

  const empty = $('#empty');
  empty.classList.toggle('hidden', campaigns.length > 0);
  empty.textContent = state.items.length ? 'No campaigns match these filters.'
    : (A ? 'No campaigns yet. Click “+ New campaign” to add the first one.' : 'No campaigns published yet.');
}

// ---------- logo = back to the full list
$('#homeLink').onclick = (e) => {
  e.preventDefault();
  FILTERS.forEach((s) => { $(s).value = ''; });
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ---------- filters & export
FILTERS.forEach((s) => $(s).addEventListener('input', render));
$('#clearBtn').onclick = () => { FILTERS.forEach((s) => { $(s).value = ''; }); render(); };
$('#exportBtn').onclick = () => {
  const cols = ['campaign', 'section', 'type', 'title', 'channels', 'publishedAt', 'fileName', 'url'];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...filtered().map((i) => cols.map((c) => cell(c === 'channels' ? chans(i).join(', ') : i[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
  a.download = `sportsbook-campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
};

// ---------- login / logout
$('#loginBtn').onclick = () => { $('#loginErr').textContent = ''; $('#loginDlg').showModal(); };
$('#loginCancel').onclick = () => $('#loginDlg').close();
$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  try {
    await api('/api/login', { method: 'POST', body: JSON.stringify({ username: f.username.value, password: f.password.value }) });
    e.target.reset(); $('#loginDlg').close(); toast('Logged in'); load();
  } catch (err) { $('#loginErr').textContent = err.message; }
};
$('#logoutBtn').onclick = async () => { await api('/api/logout', { method: 'POST' }); toast('Logged out'); load(); };

// =====================================================================
// Campaign window: one row per item (type + link/file + channels …)
// =====================================================================
const camp = { original: '', rowSeq: 0 };

function rowHTML(key, item = {}) {
  const isFile = !!item.fileName;
  const section = item.section || state.defaultSection;
  const sections = allSections();
  const known = sections.includes(section);
  const chosen = new Set(chans(item));
  const channels = allChannels();
  const other = chans(item).filter((c) => !channels.includes(c)).join(', ');
  return `
  <div class="row" data-key="${key}" data-id="${esc(item.id || '')}">
    <div class="row-grid">
      <label>Type<select data-f="type">${state.types.map((t) => `<option ${t === item.type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <label>Section
        <select data-f="sectionSelect">
          ${sections.map((s) => `<option value="${esc(s)}" ${s === section ? 'selected' : ''}>${esc(s)}</option>`).join('')}
          <option value="${NEW_SECTION}" ${known ? '' : 'selected'}>+ New section…</option>
        </select>
        <input data-f="sectionNew" class="${known ? 'hidden' : ''}" value="${known ? '' : esc(section)}" placeholder="New section name" maxlength="80" />
      </label>
      <label>Title <span class="opt">(optional)</span><input data-f="title" value="${esc(item.title || '')}" maxlength="200" /></label>
      <label>Date<input data-f="publishedAt" type="date" value="${esc(item.publishedAt || today())}" /></label>
      <label>Visible to<select data-f="visibility">
        <option value="everyone">Everyone</option>
        <option value="admin" ${item.visibility === 'admin' ? 'selected' : ''}>Only me</option>
      </select></label>
      <button type="button" class="row-del" data-rowdel title="Remove this item">✕</button>
    </div>

    <div class="row-src">
      <label class="radio"><input type="radio" name="src-${key}" value="link" ${isFile ? '' : 'checked'} /> Link</label>
      <label class="radio"><input type="radio" name="src-${key}" value="file" ${isFile ? 'checked' : ''} /> File upload</label>
      <input data-f="url" type="url" placeholder="https://…" value="${isFile ? '' : esc(item.url || '')}" class="${isFile ? 'hidden' : ''}" />
      <span class="file-wrap ${isFile ? '' : 'hidden'}">
        <input data-f="file" type="file" />
        ${isFile ? `<span class="sub">Current: <a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.fileName)}</a> (choose a file only to replace it)</span>` : ''}
      </span>
    </div>

    <div class="row-ch">
      ${channels.map((c) => `<label class="check"><input type="checkbox" value="${esc(c)}" ${chosen.has(c) ? 'checked' : ''}/> ${esc(c)}</label>`).join('')}
      <input data-f="otherChannels" value="${esc(other)}" placeholder="Other channels, comma separated" maxlength="200" />
    </div>
  </div>`;
}

function addRow(item = {}, { focus = false } = {}) {
  const key = `r${++camp.rowSeq}`;
  $('#rows').insertAdjacentHTML('beforeend', rowHTML(key, item));
  const row = $(`.row[data-key="${key}"]`);
  if (focus) { row.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('[data-f=type]', row).focus(); }
  return row;
}

function openCampaign(name = '', { focusId = null, newRowSection = null } = {}) {
  camp.original = name;
  $('#campName').value = name;
  $('#campErr').textContent = '';
  $('#campProgress').textContent = '';
  $('#rows').innerHTML = '';
  const items = campItems(name).slice();
  const order = sectionOrder(name, items);
  items.sort((a, b) => order.indexOf(a.section || state.defaultSection) - order.indexOf(b.section || state.defaultSection) || byTypeThenDate(a, b));
  if (name) items.forEach((i) => addRow(i));
  $('#campDlg').showModal();
  if (!name) { addRow(); $('#campName').focus(); }
  else if (newRowSection !== null) addRow({ section: newRowSection || state.defaultSection }, { focus: true });
  else if (focusId) {
    const row = $(`.row[data-id="${CSS.escape(focusId)}"]`);
    if (row) { row.classList.add('flash'); row.scrollIntoView({ block: 'center' }); }
  }
}

// row interactions (section "new", link/file switch, remove)
$('#rows').addEventListener('change', (e) => {
  const row = e.target.closest('.row'); if (!row) return;
  if (e.target.dataset.f === 'sectionSelect') {
    const isNew = e.target.value === NEW_SECTION;
    $('[data-f=sectionNew]', row).classList.toggle('hidden', !isNew);
    if (isNew) $('[data-f=sectionNew]', row).focus();
  }
  if (e.target.type === 'radio') {
    const file = e.target.value === 'file';
    $('[data-f=url]', row).classList.toggle('hidden', file);
    $('.file-wrap', row).classList.toggle('hidden', !file);
  }
});
$('#rows').addEventListener('click', async (e) => {
  if (!e.target.closest('[data-rowdel]')) return;
  const row = e.target.closest('.row');
  const id = row.dataset.id;
  if (id) {
    const i = state.items.find((x) => x.id === id);
    if (!await ask({ title: 'Delete item?', message: `${i.type}${i.title ? ' — ' + i.title : ''}${i.fileName ? ' (the file will be deleted too)' : ''}`, ok: 'Delete', danger: true })) return;
    try { await api('/api/assets', { method: 'DELETE', body: JSON.stringify({ id }) }); toast('Deleted'); await load(); }
    catch (err) { $('#campErr').textContent = err.message; return; }
  }
  row.remove();
});

$('#addRowBtn').onclick = () => {
  const last = $$('#rows .row').pop();
  const section = last ? readRow(last).section : state.defaultSection;
  addRow({ section }, { focus: true });
};

function readRow(row) {
  const v = (f) => ($(`[data-f=${f}]`, row)?.value || '').trim();
  const sectionSel = v('sectionSelect');
  return {
    id: row.dataset.id || '',
    type: v('type'),
    section: sectionSel === NEW_SECTION ? v('sectionNew') : sectionSel,
    title: v('title'),
    publishedAt: v('publishedAt'),
    visibility: v('visibility'),
    source: $('input[type=radio]:checked', row).value,
    url: v('url'),
    file: $('[data-f=file]', row).files[0] || null,
    channels: [...$$('.row-ch input[type=checkbox]:checked', row).map((c) => c.value),
      ...v('otherChannels').split(',').map((c) => c.trim()).filter(Boolean)],
  };
}

async function uploadFile(file, campaign, onPct) {
  const { upload } = await import('/vendor/blob-upload.js');
  const safe = (s) => String(s).toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '') || 'file';
  const blob = await upload(`campaigns/${safe(campaign)}/${safe(file.name)}`, file, {
    access: 'public',
    handleUploadUrl: '/api/upload',
    multipart: file.size > 20 * 1024 * 1024,
    onUploadProgress: ({ percentage }) => onPct(Math.round(percentage)),
  });
  return blob.url;
}

const sameItem = (a, b) => JSON.stringify(a) === JSON.stringify(b);

$('#campForm').onsubmit = async (e) => {
  e.preventDefault();
  const name = $('#campName').value.trim();
  const err = $('#campErr'), prog = $('#campProgress'), btn = $('#campSave');
  err.textContent = '';
  if (!name) { err.textContent = 'Campaign name is required'; return; }
  const rows = $$('#rows .row');
  const renamed = camp.original && camp.original !== name;

  // validate first
  for (const [n, row] of rows.entries()) {
    const r = readRow(row);
    const existing = r.id && state.items.find((x) => x.id === r.id);
    const blank = !r.id && !r.url && !r.file && !r.title;
    if (blank) continue;
    if (!r.section) { err.textContent = `Item ${n + 1}: please name the new section`; return; }
    if (r.source === 'link' && !/^https?:\/\//i.test(r.url)) { err.textContent = `Item ${n + 1}: please add a link starting with https://`; return; }
    if (r.source === 'file' && !r.file && !existing?.fileName) { err.textContent = `Item ${n + 1}: please choose a file`; return; }
  }

  btn.disabled = true;
  let saved = 0;
  try {
    for (const [n, row] of rows.entries()) {
      const r = readRow(row);
      const existing = r.id ? state.items.find((x) => x.id === r.id) : null;
      if (!r.id && !r.url && !r.file && !r.title) continue; // empty new row

      const data = {
        id: r.id || undefined, campaign: name, section: r.section, type: r.type, title: r.title,
        publishedAt: r.publishedAt, visibility: r.visibility, channels: r.channels,
        url: r.url, fileName: '', fileSize: 0,
      };
      if (r.source === 'file') {
        if (r.file) {
          data.url = await uploadFile(r.file, name, (p) => { prog.textContent = `Uploading item ${n + 1}… ${p}%`; });
          data.fileName = r.file.name; data.fileSize = r.file.size;
        } else { data.url = existing.url; data.fileName = existing.fileName; data.fileSize = existing.fileSize; }
      }

      if (existing) {
        const before = { campaign: existing.campaign, section: existing.section || state.defaultSection, type: existing.type, title: existing.title || '',
          publishedAt: existing.publishedAt || '', visibility: existing.visibility || 'everyone', channels: chans(existing),
          url: existing.url, fileName: existing.fileName || '', fileSize: existing.fileSize || 0 };
        const { id, ...after } = data;
        if (sameItem(before, after)) continue;
        prog.textContent = `Saving item ${n + 1}…`;
        await api('/api/assets', { method: 'PUT', body: JSON.stringify(data) });
      } else {
        prog.textContent = `Saving item ${n + 1}…`;
        await api('/api/assets', { method: 'POST', body: JSON.stringify(data) });
      }
      saved++;
    }
    if (renamed) await api('/api/meta', { method: 'PUT', body: JSON.stringify({ campaign: name, sections: sectionOrder(camp.original, campItems(camp.original)), renameFrom: camp.original }) });
    $('#campDlg').close();
    toast(saved || renamed ? 'Campaign saved' : 'No changes');
    await load();
  } catch (ex) {
    prog.textContent = '';
    err.textContent = ex.status === 401 ? 'Session expired. Please log in again (your rows are still here).' : ex.message;
    await load(); // refresh what was saved so far
  } finally { btn.disabled = false; }
};

async function closeCampaign() {
  const dirty = $$('#rows .row').some((row) => { const r = readRow(row); return !r.id && (r.url || r.file || r.title); });
  if (dirty && !await ask({ title: 'Discard unsaved items?', message: 'New items you added in this window will be lost.', ok: 'Discard', danger: true })) return;
  $('#campDlg').close();
}
$('#campClose').onclick = closeCampaign;
$('#campCancel').onclick = closeCampaign;
$('#campDlg').oncancel = (e) => { e.preventDefault(); closeCampaign(); };
$('#newCampaignBtn').onclick = () => openCampaign('');

// ---------- list actions
const saveOrder = (campaign, sections, renameFrom) =>
  api('/api/meta', { method: 'PUT', body: JSON.stringify({ campaign, sections, renameFrom }) });

$('#list').addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b || !state.admin) return;
  const d = b.dataset;
  try {
    if (d.open !== undefined) openCampaign(d.open);

    if (d.edit) { const i = state.items.find((x) => x.id === d.edit); openCampaign(i.campaign || '', { focusId: i.id }); }

    if ('addsec' in d) openCampaign(d.camp, { newRowSection: d.sec });

    if (d.del) {
      const i = state.items.find((x) => x.id === d.del);
      if (!await ask({ title: 'Delete item?', message: `${i.type}${i.title ? ' — ' + i.title : ''}${i.fileName ? ' (the file will be deleted too)' : ''}`, ok: 'Delete', danger: true })) return;
      await api('/api/assets', { method: 'DELETE', body: JSON.stringify({ id: i.id }) });
      toast('Deleted'); load();
    }

    if ('rensec' in d) {
      const old = d.sec;
      const name = await ask({ title: 'Rename section', value: old, ok: 'Rename' });
      if (!name || name === old) return;
      const order = sectionOrder(d.camp, campItems(d.camp)).map((s) => (s === old ? name : s));
      for (const i of campItems(d.camp).filter((x) => (x.section || state.defaultSection) === old)) {
        await api('/api/assets', { method: 'PUT', body: JSON.stringify({ ...i, section: name }) });
      }
      await saveOrder(d.camp, order);
      toast('Section renamed'); load();
    }

    if (d.move) {
      const order = sectionOrder(d.camp, campItems(d.camp));
      const from = order.indexOf(d.sec), to = from + Number(d.move);
      if (from < 0 || to < 0 || to >= order.length) return;
      [order[from], order[to]] = [order[to], order[from]];
      await saveOrder(d.camp, order);
      load();
    }
  } catch (err) { await ask({ title: 'Something went wrong', message: err.message, ok: 'Close' }); }
});

load();
