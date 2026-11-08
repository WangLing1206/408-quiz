'use strict';
/* 基础工具：DOM、存储、路由、提示、Markdown 渲染 */

export const $ = (s, r) => (r || document).querySelector(s);
export const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export const norm = s => String(s || '')
  .replace(/[①②③④⑤⑥⑦⑧]/g, c => ({ '①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5', '⑥': '6', '⑦': '7', '⑧': '8' }[c]))
  .replace(/[\s、，,。.．·（）()【】\[\]“”"']/g, '').toUpperCase();

export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

export const fmtDate = ts => {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
export const fmtDay = ts => {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
export const daysAgo = (n) => {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d.getTime();
};

/* ---------- 本地存储 ---------- */
export function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch (e) { return fallback; }
}
export function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch (e) { toast('本地存储写入失败：' + e.message, 'bad'); return false; }
}
export function lsDel(key) { try { localStorage.removeItem(key); } catch (e) {} }

/* ---------- IndexedDB（题库覆盖层） ---------- */
const DB_NAME = 'q408.bank';
const DB_VER = 1;
let dbPromise = null;
export function db() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('当前浏览器不支持 IndexedDB')); return; }
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('files')) d.createObjectStore('files');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB 打开失败'));
  });
  return dbPromise;
}
export async function idbGet(key) {
  try {
    const d = await db();
    return await new Promise((res, rej) => {
      const tx = d.transaction('files', 'readonly');
      const r = tx.objectStore('files').get(key);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  } catch (e) { return undefined; }
}
export async function idbSet(key, val) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction('files', 'readwrite');
    tx.objectStore('files').put(val, key);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}
export async function idbDelete(key) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction('files', 'readwrite');
    tx.objectStore('files').delete(key);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}
export async function idbKeys() {
  try {
    const d = await db();
    return await new Promise((res, rej) => {
      const tx = d.transaction('files', 'readonly');
      const r = tx.objectStore('files').getAllKeys();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  } catch (e) { return []; }
}
export async function idbClear() {
  try {
    const d = await db();
    await new Promise((res, rej) => {
      const tx = d.transaction('files', 'readwrite');
      tx.objectStore('files').clear();
      tx.oncomplete = res; tx.onerror = () => rej(tx.error);
    });
    return true;
  } catch (e) { return false; }
}

/* ---------- 提示 / 弹窗 ---------- */
let toastTimer = null;
export function toast(msg, kind) {
  const el = $('#toast');
  if (!el) { console[console.error ? 'error' : 'log'](msg); return; }
  el.textContent = msg;
  el.className = 'toast show' + (kind ? ' ' + kind : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
}

export function confirmDialog(title, text, okText) {
  return new Promise(resolve => {
    const host = $('#modal');
    host.innerHTML = `<div class="modal-card">
      <h3>${esc(title)}</h3><p class="modal-text">${esc(text)}</p>
      <div class="modal-actions"><button class="btn" data-a="cancel">取消</button>
      <button class="btn danger" data-a="ok">${esc(okText || '确定')}</button></div></div>`;
    host.classList.remove('hidden');
    const close = v => { host.classList.add('hidden'); host.innerHTML = ''; resolve(v); };
    host.querySelector('[data-a=cancel]').onclick = () => close(false);
    host.querySelector('[data-a=ok]').onclick = () => close(true);
    host.onclick = e => { if (e.target === host) close(false); };
  });
}

/* 底部抽屉，返回关闭函数 */
export function sheet(html, opts) {
  const host = $('#modal');
  host.innerHTML = `<div class="sheet"><div class="sheet-handle"></div>${html}</div>`;
  host.classList.remove('hidden');
  const close = () => { host.classList.add('hidden'); host.innerHTML = ''; host.onclick = null; };
  host.onclick = e => { if (e.target === host) close(); };
  const btn = host.querySelector('[data-close]');
  if (btn) btn.onclick = close;
  if (opts && opts.onMount) opts.onMount(host.querySelector('.sheet'), close);
  return close;
}

/* ---------- 路由 ---------- */
const routes = {};
let currentView = '';
export function route(path, fn) { routes[path] = fn; }
export function navigate(hash) { if (location.hash === hash) render(); else location.hash = hash; }
export function getQuery() {
  const i = location.hash.indexOf('?');
  return new URLSearchParams(i >= 0 ? location.hash.slice(i + 1) : '');
}
export function currentPath() {
  const h = location.hash.replace(/^#\/?/, '');
  return h.split('?')[0];
}
export function render() {
  const path = currentPath();
  const view = routes[path] ? path : '';
  currentView = view;
  $$('#tabbar a, #deskNav a').forEach(a => {
    const group = (a.dataset.group || '').split(/\s+/).filter(Boolean);
    const on = a.dataset.v === view || group.includes(view) || (view === '' && a.dataset.v === 'home');
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const main = $('#app');
  main.classList.remove('view-in');
  main.innerHTML = '';
  const modal = $('#modal');
  if (modal && !modal.classList.contains('hidden')) { modal.classList.add('hidden'); modal.innerHTML = ''; modal.onclick = null; }
  // 触发重排让动画可重复
  void main.offsetWidth;
  routes[view]();
  main.classList.add('view-in');
  window.scrollTo(0, 0);
}
export function startRouter() {
  window.addEventListener('hashchange', render);
  if (!location.hash) location.hash = '#/';
  render();
}
export function activeView() { return currentView; }

/* ---------- Markdown（先转义，安全渲染；支持标题/列表/表格/引用/代码） ---------- */
function inlineMd(text) {
  let s = text;
  const codes = [];
  s = s.replace(/`([^`\n]+)`/g, (m, c) => {
    codes.push('<code>' + c + '</code>');
    return '\u0001C' + (codes.length - 1) + '\u0001';
  });
  s = s.replace(/!?\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
  s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  s = s.replace(/(^|[\s(（【])\*([^*\n]+)\*(?=[\s)）】,.，。:：;；!?！？、]|$)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[\s(（【])_([^_\n]+)_(?=[\s)）】,.，。:：;；!?！？、]|$)/g, '$1<em>$2</em>');
  s = s.replace(/\u0001C(\d+)\u0001/g, (m, i) => codes[Number(i)]);
  return s;
}

const MD_TABLE_SEP = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;
const mdSplitRow = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim());

export function md(src) {
  let raw = esc(String(src == null ? '' : src)).replace(/\r\n?/g, '\n');
  const codeBlocks = [];
  // 同时兼容流式输出中尚未闭合的代码块
  raw = raw.replace(/```([^\n`]*)\n?([\s\S]*?)(?:```|$)/g, (m, lang, code) => {
    const l = (lang || '').trim().slice(0, 24);
    codeBlocks.push('<div class="code-block"><div class="code-head"><span class="code-lang">' +
      (l || 'code') + '</span><button type="button" class="code-copy">复制</button></div>' +
      '<pre class="code"><code>' + code.replace(/\n$/, '') + '</code></pre></div>');
    return '\u0000CB' + (codeBlocks.length - 1) + '\u0000';
  });

  const lines = raw.split('\n');
  const out = [];
  let i = 0;

  const isListLine = s => /^(\s*)([-*•]|\d+[.)])\s+/.test(s);
  const isTableStart = idx => {
    const l = lines[idx];
    return l && l.includes('|') && idx + 1 < lines.length && MD_TABLE_SEP.test(lines[idx + 1]);
  };
  const isBlockStart = idx => {
    const l = lines[idx];
    if (!l || !l.trim()) return true;
    return /^\u0000CB\d+\u0000$/.test(l.trim())
      || /^#{1,6}\s+/.test(l)
      || /^&gt;\s?/.test(l)
      || isListLine(l)
      || /^\s*(---|\*\*\*|___)\s*$/.test(l)
      || isTableStart(idx);
  };

  const listBlock = () => {
    const first = lines[i];
    const baseIndent = first.match(/^\s*/)[0].length;
    const ordered = /^\s*\d+[.)]\s+/.test(first);
    const startNo = ordered ? parseInt((first.match(/^\s*(\d+)/) || [])[1], 10) || 1 : 1;
    const tag = ordered ? 'ol' : 'ul';
    let html = '<' + tag + (ordered && startNo > 1 ? ' start="' + startNo + '"' : '') + '>';
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) break;
      const m = line.match(/^(\s*)([-*•]|\d+[.)])\s+(.*)$/);
      if (!m) break;
      const indent = m[1].length;
      if (indent < baseIndent) break;
      const itemOrdered = /\d/.test(m[2]);
      if (indent === baseIndent && itemOrdered !== ordered) break;
      if (indent > baseIndent) {
        const nested = listBlock();
        html = html.replace(/<\/li>$/, nested + '</li>');
        continue;
      }
      i++;
      let text = m[3];
      while (i < lines.length) {
        const next = lines[i];
        if (!next.trim()) break;
        const nextIndent = next.match(/^\s*/)[0].length;
        if (isListLine(next) || nextIndent <= baseIndent) break;
        text += '<br>' + next.trim();
        i++;
      }
      html += '<li>' + inlineMd(text) + '</li>';
    }
    html += '</' + tag + '>';
    return html;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (/^\u0000CB\d+\u0000$/.test(line.trim())) { out.push(line.trim()); i++; continue; }

    let m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      const lvl = m[1].length;
      out.push('<h' + lvl + '>' + inlineMd(m[2]) + '</h' + lvl + '>');
      i++;
      continue;
    }

    if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    if (/^&gt;\s?/.test(line)) {
      const parts = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i])) {
        parts.push(lines[i].replace(/^&gt;\s?/, ''));
        i++;
      }
      out.push('<blockquote>' + parts.map(inlineMd).join('<br>') + '</blockquote>');
      continue;
    }

    if (isTableStart(i)) {
      const head = mdSplitRow(line);
      const sep = mdSplitRow(lines[i + 1]);
      const align = sep.map(c => c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : c.startsWith(':') ? 'left' : '');
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(mdSplitRow(lines[i]));
        i++;
      }
      const th = head.map((c, k) => '<th' + (align[k] ? ' style="text-align:' + align[k] + '"' : '') + '>' + inlineMd(c) + '</th>').join('');
      const trs = rows.map(r => '<tr>' + head.map((_, k) => '<td' + (align[k] ? ' style="text-align:' + align[k] + '"' : '') + '>' + inlineMd(r[k] || '') + '</td>').join('') + '</tr>').join('');
      out.push('<div class="table-wrap"><table><thead><tr>' + th + '</tr></thead><tbody>' + trs + '</tbody></table></div>');
      continue;
    }

    if (isListLine(line)) {
      out.push(listBlock());
      continue;
    }

    const buf = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(i)) {
      buf.push(lines[i]);
      i++;
    }
    if (buf.length) out.push('<p>' + buf.map(inlineMd).join('<br>') + '</p>');
  }

  return out.join('\n').replace(/\u0000CB(\d+)\u0000/g, (m, idx) => codeBlocks[Number(idx)]);
}

/* 代码块复制（事件委托，兼容非安全上下文） */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fallthrough */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) { return false; }
}

document.addEventListener('click', async e => {
  const btn = e.target.closest && e.target.closest('.code-copy');
  if (!btn) return;
  const code = btn.closest('.code-block') && btn.closest('.code-block').querySelector('code');
  if (!code) return;
  const ok = await copyText(code.innerText);
  const old = btn.textContent;
  btn.textContent = ok ? '已复制' : '复制失败';
  setTimeout(() => { btn.textContent = old; }, 1500);
});

export function debounce(fn, ms) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function subjectClass(name) {
  return { '数据结构': 'ds', '操作系统': 'os', '计组': 'co', '计网': 'cn' }[name] || 'ds';
}
