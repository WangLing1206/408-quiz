'use strict';
/* 题库练习 · 应用主入口：首页 / 刷题 / 大题 / 错题本 / 统计 / 知识图谱 / AI / 我的 */

import {
  $, $$, esc, norm, toast, confirmDialog, sheet, route, startRouter, navigate,
  getQuery, md, fmtDate, fmtDay, subjectClass, clamp, currentPath, copyText,
} from './core.js';
import * as store from './store.js';
import {
  SUBJECTS, loadBank, loadAllBanks, loadKG, loadManifest, figure, bankCounts, resetMem,
} from './bank.js';
import {
  buildIndex, computeStats, chapterStats, diagnose, kpDetail, kpQuestions, subjectSummary,
} from './kg.js';
import { streamChat, messagesForQuestion, messagesForBigq, messagesForKp } from './ai.js';
import * as sync from './sync.js';

/* ---------- 全局状态 ---------- */
const S = {
  xzt: { subject: null, sec: null, num: null, list: null },
  dt: { subject: null, sec: null, num: null },
  ct: { subject: '全部' },
  kg: { subject: '数据结构', mode: 'graph' },
  ai: { busy: false, controller: null, pending: null },
  practice: null,
  update: null,
};
let KG = null;
let deferredPrompt = null;

const ICONS = {
  home: '<path d="M3 10.6 12 3l9 7.6V21a1 1 0 0 1-1 1h-5.5v-7h-5v7H4a1 1 0 0 1-1-1z"/>',
  quiz: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  graph: '<circle cx="6" cy="7" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="12" cy="17" r="2.4"/><path d="M8.2 8.3l6.2 6.6M16.6 7.6l-3.4 7.2M8.1 7.4l7.5-.8"/>',
  ai: '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  me: '<circle cx="12" cy="8" r="3.4"/><path d="M4.5 20.5c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 8.9 4.6h.08A1.7 1.7 0 0 0 10 3.04V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 8.9v.08A1.7 1.7 0 0 0 20.96 10H21a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 15z"/>',
  arrow: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v5M14 11v5"/>',
  download: '<path d="M12 4v11m0 0l4-4m-4 4l-4-4M5 20h14"/>',
  upload: '<path d="M12 20V9m0 0l-4 4m4-4l4 4M4 4h16"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/>',
  brain: '<path d="M9.5 4.5a3 3 0 0 0-3 3 3 3 0 0 0-1.5 5.5 3 3 0 0 0 2 5 3 3 0 0 0 4.5 2.2V4.9a2.5 2.5 0 0 0-2-2.4zM14.5 4.5a3 3 0 0 1 3 3 3 3 0 0 1 1.5 5.5 3 3 0 0 1-2 5 3 3 0 0 1-4.5 2.2V4.9a2.5 2.5 0 0 1 2-2.4z"/>',
};
const icon = (name, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

/* ---------- 通用 ---------- */
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const APP_VERSION = 'v2.3.0-beta1';
const shortVer = v => !v || v === '内置' ? '内置' : (/^[0-9a-f]{8,}$/i.test(v) ? 'v' + v.slice(0, 8) : v);

function monthHeatmap() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const log = store.getActivityLog();
  const totalDays = new Date(y, m + 1, 0).getDate();
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // 周一 = 0
  const pad2 = n => String(n).padStart(2, '0');
  const cells = [];
  let total = 0, active = 0;
  for (let i = 0; i < firstDow; i++) cells.push('<span class="heat-cell blank"></span>');
  for (let d = 1; d <= totalDays; d++) {
    const count = log[`${y}-${pad2(m + 1)}-${pad2(d)}`] || 0;
    total += count;
    if (count > 0) active++;
    const lvl = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4;
    const today = d === now.getDate() ? ' today' : '';
    cells.push(`<span class="heat-cell l${lvl}${today}" title="${y}年${m + 1}月${d}日 · ${count} 题"><i>${d}</i></span>`);
  }
  return { cells: cells.join(''), total, active, month: m + 1, totalDays };
}
const fmtDateOnly = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const subjectOfSection = () => SUBJECTS;
const sortSecs = secs => secs.slice().sort((a, b) => a.localeCompare(b, 'zh', { numeric: true }));

function ring(value, size = 64, label) {
  const v = clamp(Math.round(value), 0, 100);
  return `<div class="ring-wrap" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 36 36" class="ring"><path class="ring-bg" d="M18 2.0845a15.9155 15.9155 0 1 1 0 31.831 15.9155 15.9155 0 1 1 0-31.831"/>
    <path class="ring-fg" stroke-dasharray="${v},100" ${v === 0 ? 'style="stroke-linecap:butt"' : ''} d="M18 2.0845a15.9155 15.9155 0 1 1 0 31.831 15.9155 15.9155 0 1 1 0-31.831"/></svg>
    <span class="ring-txt">${label != null ? label : v + '%'}</span></div>`;
}

function subjTabs(active, extra) {
  return `<div class="seg" role="tablist">${SUBJECTS.map(s =>
    `<button type="button" class="seg-btn ${s === active ? 'on' : ''}" data-subj="${esc(s)}" role="tab" aria-selected="${s === active}">${esc(s)}</button>`
  ).join('')}${extra || ''}</div>`;
}
function bindSubjTabs(root, cb) {
  $$('[data-subj]', root).forEach(b => { b.onclick = () => cb(b.dataset.subj); });
}

function pageHead(title, sub, right) {
  return `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div>${right || ''}</div>`;
}
const skeleton = (n = 3) => `<div class="skel-list">${Array.from({ length: n }).map(() => '<div class="skel-row"><i class="skel-a"></i><i class="skel-b"></i></div>').join('')}</div>`;
const emptyBox = (text, action) => `<div class="empty"><div class="empty-ic">${icon('book')}</div><p>${esc(text)}</p>${action || ''}</div>`;

function updateBadge() {
  const n = store.getMistakes().length;
  $$('#ct-badge').forEach(b => { b.textContent = n > 99 ? '99+' : n; b.classList.toggle('hidden', !n); });
  const meBadge = $('#me-mistake-count');
  if (meBadge) meBadge.textContent = n;
}

function setUpdateHint(available) {
  S.update = available;
  const dot = $('#update-dot');
  if (dot) dot.classList.toggle('hidden', !available);
}

/* ---------- 知识图谱缓存 ---------- */
async function getKG() {
  if (KG) return KG;
  const kg = await loadKG();
  KG = { kg, index: buildIndex(kg), stats: null };
  KG.stats = computeStats(kg, KG.index);
  return KG;
}
function dropKGCache() { KG = null; }

async function kpNamesOf(subject, sec, num, type = 'qs') {
  try {
    const g = await getKG();
    const tags = g.kg.tags?.[subject]?.[sec]?.[type]?.[String(num)] || [];
    return tags.map(id => g.index.kpById[id]).filter(Boolean);
  } catch (e) { return []; }
}
const kpChipsHtml = kps => kps.length
  ? `<div class="kp-chips">${kps.map(k => `<button type="button" class="kp-chip" data-kp="${esc(k.id)}">${esc(k.name)}</button>`).join('')}</div>` : '';

async function openKpSheet(kid) {
  try {
    const g = await getKG();
    const d = kpDetail(g.kg, g.index, kid, g.stats);
    if (!d) { toast('知识点不存在'); return; }
    const s = d.stat;
    const tone = s.status;
    const close = sheet(`<div class="sheet-head"><div><div class="small">${esc(d.subject)} · ${esc(d.chapter.name)}</div>
      <h2>${esc(d.kp.name)}</h2></div><button class="icon-btn" data-close aria-label="关闭">${icon('close')}</button></div>
      <div class="kp-stats">
        <div><b>${s.attempts}</b><span>作答</span></div>
        <div><b>${s.attempts ? Math.round(s.acc * 100) + '%' : '—'}</b><span>正确率</span></div>
        <div><b>${d.count}</b><span>关联题</span></div>
        <div class="kp-state ${tone}">${toneLabel(tone)}</div>
      </div>
      ${d.pre.length ? `<div class="sheet-sec"><h4>前置知识</h4><div class="kp-chips">${d.pre.map(k => `<button class="kp-chip" data-kp="${esc(k.id)}">${esc(k.name)}</button>`).join('')}</div></div>` : ''}
      ${d.dependents.length ? `<div class="sheet-sec"><h4>后续知识</h4><div class="kp-chips">${d.dependents.map(k => `<button class="kp-chip" data-kp="${esc(k.id)}">${esc(k.name)}</button>`).join('')}</div></div>` : ''}
      <div class="sheet-actions">
        ${d.xztCount ? `<button class="btn primary" data-act="practice">专项练习 ${d.xztCount} 题</button>` : ''}
        <button class="btn" data-act="ai">${icon('ai')} AI 讲解</button>
      </div>`, {
      onMount(el, done) {
        $$('[data-kp]', el).forEach(b => b.onclick = () => { done(); openKpSheet(b.dataset.kp); });
        const pp = el.querySelector('[data-act=practice]');
        if (pp) pp.onclick = () => { done(); startPractice(kid); };
        const ab = el.querySelector('[data-act=ai]');
        if (ab) ab.onclick = () => {
          done();
          S.ai.pending = { kind: 'kp', subject: d.subject, chapter: d.chapter.name, name: d.kp.name, preNames: d.pre.map(x => x.name), dependents: d.dependents.map(x => x.name) };
          navigate('#/ai');
        };
      },
    });
  } catch (e) { toast(e.message); }
}

function toneLabel(t) { return { good: '已掌握', mid: '待巩固', weak: '薄弱', new: '未练习' }[t] || '未练习'; }

function bindKpChips(root) {
  $$('[data-kp]', root).forEach(b => {
    if (!b.dataset.bound) { b.dataset.bound = '1'; b.onclick = () => openKpSheet(b.dataset.kp); }
  });
}

async function startPractice(kid) {
  const g = await getKG();
  const kp = g.index.kpById[kid];
  if (!kp) return;
  navigate('#/xzt?kp=' + encodeURIComponent(kid));
}

async function ensurePractice(kpId, mix) {
  if (mix === '__mistakes__') {
    if (S.practice && S.practice.name === '错题重练') return;
    const ms = store.getMistakes();
    S.practice = { mix: true, name: '错题重练', items: ms.map(m => ({ subject: m.subject, sec: m.sec, num: m.num })) };
    return;
  }
  const g = await getKG();
  if (kpId) {
    const kp = g.index.kpById[kpId];
    if (!kp) { S.practice = null; return; }
    const items = kpQuestions(g.kg, kpId).filter(x => x.type === 'xzt');
    S.practice = { kpId, name: kp.name, items };
    return;
  }
  if (mix) {
    const ids = mix.split(',').filter(Boolean);
    const seen = new Set();
    const items = [];
    ids.forEach(id => kpQuestions(g.kg, id).filter(x => x.type === 'xzt').forEach(it => {
      const k = `${it.subject}|${it.sec}|${it.num}`;
      if (!seen.has(k)) { seen.add(k); items.push(it); }
    }));
    S.practice = { mix: true, name: '补短板综合练习', items, kpIds: ids };
  }
}

/* =====================================================================
   首页
   ===================================================================== */
async function viewHome() {
  const app = $('#app');
  app.innerHTML = pageHead('今日练习', '保持节奏，稳步提升') + skeleton(2);
  try {
    const manifest = await loadManifest();
    const synced = store.getSyncState();
    let files = Object.keys(synced.files || {}).length ? synced.files : (manifest.files || {});
    if (!Object.keys(files).length) {
      // 清单缺失时退回题库本体，保证首页仍可用
      const ds = await loadAllBanks();
      files = {};
      ds.forEach((d, i) => {
        files[SUBJECTS[i] + '.json'] = { qs: bankCounts(d).qs };
      });
    }
    const p = store.getProgress();
    let tDone = 0, tOk = 0, tTot = 0;
    const rows = SUBJECTS.map(key => {
      const tot = (files[key + '.json'] && files[key + '.json'].qs) || 0;
      let done = 0, ok = 0;
      Object.values(p[key] || {}).forEach(sp => {
        done += Object.keys(sp).length;
        ok += Object.values(sp).filter(x => x.ok).length;
      });
      tDone += done; tOk += ok; tTot += tot;
      const shortLabel = { '计组': '组成原理', '计网': '计算机网络' }[key];
      return { key, label: shortLabel || key, tot, done, ok, acc: pct(ok, done), comp: pct(done, tot) };
    });
    const overall = pct(tOk, tDone);
    const completePct = pct(tDone, tTot);
    const last = store.getLast();
    const streak = (() => { let n = 0; for (const d of store.activitySeries(30).reverse()) { if (d.count > 0) n++; else break; } return n; })();
    const hour = new Date().getHours();
    const greet = hour < 6 ? '夜深了' : hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好';
    const mistakes = store.getMistakes().length;

    app.innerHTML = pageHead('今日练习', '保持节奏，稳步提升') + `
      <section class="hero">
        <div class="hero-main">
          <div class="hero-greet">${greet} · ${new Date().getMonth() + 1} 月 ${new Date().getDate()} 日 <span class="beta-pill">BETA</span></div>
          <h2>${tDone ? `已刷 ${tDone} 题，正确率 ${overall}%` : '今天，从一道题开始'}</h2>
          <p>${tDone ? `还有 ${tTot - tDone} 道题待练习` : `题库共 ${tTot} 道，覆盖四科全部章节`}</p>
          <div class="hero-actions">
            ${last ? `<button class="btn primary" id="h-continue">${icon('clock')} 继续：${esc(last.subject)} ${esc(last.sec)}</button>` : `<button class="btn primary" id="h-start">开始刷题</button>`}
            <button class="btn ghost" id="h-kg">${icon('graph')} 看知识图谱</button>
          </div>
        </div>
        <div class="hero-side">
          ${ring(completePct, 86)}
          <div class="ring-label">完成度</div>
          <div class="hero-streak">${streak ? `🔥 连续 ${streak} 天` : '今天开始打卡'}</div>
        </div>
      </section>

      <div class="section-title"><h2>按科目练习</h2><span class="small">${tTot} 题</span></div>
      <div class="subj-grid">
        ${rows.map(r => `<button class="subj-card ${subjectClass(r.key)}" data-home-subj="${esc(r.key)}">
          <div class="subj-top"><span class="subj-dot"></span><b>${esc(r.label)}</b><span class="subj-acc">${r.done ? r.comp + '%' : '未开始'}</span></div>
          <div class="subj-nums">已做 ${r.done}/${r.tot}${r.done ? ` · 正确 ${r.acc}%` : ''}</div>
          <div class="bar"><i style="width:${r.comp}%"></i></div>
        </button>`).join('')}
      </div>

      <div class="section-title"><h2>快捷入口</h2></div>
      <div class="quick-grid">
        <button class="quick" data-go="#/dt">${icon('book')}<b>综合大题</b><span>思路引导</span></button>
        <button class="quick" data-go="#/ct">${icon('check')}<b>错题本</b><span>${mistakes} 道待复习</span></button>
        <button class="quick" data-go="#/kg">${icon('graph')}<b>知识图谱</b><span>定位薄弱点</span></button>
        <button class="quick" data-go="#/ai">${icon('ai')}<b>AI 问答</b><span>随时提问</span></button>
        <button class="quick" data-go="#/stats">${icon('chart')}<b>学习统计</b><span>进度与趋势</span></button>
        <button class="quick" data-go="#/sync">${icon('download')}<b>题库更新</b><span>GitHub 同步</span></button>
      </div>

      <p class="foot-note">题库数据仅供个人学习</p>`;

    $('#h-start')?.addEventListener('click', () => { S.xzt = { subject: SUBJECTS[0], sec: null, num: null, list: null }; navigate('#/xzt'); });
    $('#h-continue')?.addEventListener('click', () => {
      navigate(qHash(last.subject, last.sec, last.num));
    });
    $('#h-kg')?.addEventListener('click', () => navigate('#/kg'));
    $$('[data-home-subj]').forEach(b => b.onclick = () => navigate(qHash(b.dataset.homeSubj)));
    $$('[data-go]').forEach(b => b.onclick = () => navigate(b.dataset.go));
    updateBadge();
  } catch (e) {
    app.innerHTML = pageHead('练习') + `<div class="empty"><p>题库加载失败：${esc(e.message)}</p><button class="btn" onclick="location.reload()">重新加载</button></div>`;
  }
}

/* =====================================================================
   选择题：科目 → 章节 → 答题
   ===================================================================== */
const SUBJECT_LABEL = { '数据结构': '数据结构', '操作系统': '操作系统', '计组': '计算机组成原理', '计网': '计算机网络' };
const SUBJECT_MARK = { '数据结构': '数', '操作系统': '操', '计组': '组', '计网': '网' };
const SUBJECT_DESC = {
  '数据结构': '线性表 · 栈队列 · 树 · 图 · 查找 · 排序',
  '操作系统': '进程线程 · 内存 · 文件 · I/O 管理',
  '计组': '数据表示 · 存储系统 · 指令 · CPU · 总线',
  '计网': '体系结构 · 链路层 · 网络层 · 传输层 · 应用层',
};
const subjectLabel = key => SUBJECT_LABEL[key] || key;
const qHash = (subject, sec, num) => {
  let h = '#/xzt?subject=' + encodeURIComponent(subject);
  if (sec) h += '&sec=' + encodeURIComponent(sec);
  if (num != null) h += '&num=' + encodeURIComponent(num);
  return h;
};

async function subjectTotalsMap() {
  const manifest = await loadManifest();
  const synced = store.getSyncState();
  let files = Object.keys(synced.files || {}).length ? synced.files : (manifest.files || {});
  if (!Object.keys(files).length) {
    const ds = await loadAllBanks();
    files = {};
    ds.forEach((d, i) => { files[SUBJECTS[i] + '.json'] = { qs: bankCounts(d).qs }; });
  }
  const out = {};
  SUBJECTS.forEach(k => { out[k] = (files[k + '.json'] && files[k + '.json'].qs) || 0; });
  return out;
}

function subjectProgress(key) {
  const p = store.getProgress();
  let done = 0, ok = 0;
  Object.values(p[key] || {}).forEach(sp => {
    done += Object.keys(sp).length;
    ok += Object.values(sp).filter(x => x.ok).length;
  });
  return { done, ok, acc: pct(ok, done) };
}

async function viewXzt() {
  updateBadge();
  const q = getQuery();
  const kpId = q.get('kp');
  const mix = q.get('mix');
  if (kpId || mix) return viewPractice(kpId, mix);
  const subject = q.get('subject');
  const sec = q.get('sec');
  if (subject && !SUBJECTS.includes(subject)) { navigate('#/xzt'); return; }
  if (subject && sec) return viewChapterQuiz(subject, sec, q.get('num'));
  if (subject) return viewChapters(subject);
  return viewSubjects();
}

async function viewSubjects() {
  const app = $('#app');
  app.innerHTML = pageHead('刷题', '选择科目，按章节循序渐进') + skeleton(4);
  try {
    S.practice = null;
    S.xzt = { subject: null, sec: null, num: null, list: null };
    const totals = await subjectTotalsMap();
    const rows = SUBJECTS.map(key => {
      const st = subjectProgress(key);
      const tot = totals[key] || 0;
      return { key, label: subjectLabel(key), mark: SUBJECT_MARK[key], desc: SUBJECT_DESC[key], tot, ...st, comp: pct(st.done, tot) };
    });
    const totalDone = rows.reduce((a, r) => a + r.done, 0);
    const total = rows.reduce((a, r) => a + r.tot, 0);
    app.innerHTML = pageHead('刷题', '选择科目，按章节循序渐进') + `
      <div class="section-title"><h2>四大学科</h2><span class="small">已完成 ${totalDone}/${total} 题</span></div>
      <div class="subject-list">
        ${rows.map(r => `<button class="subject-row ${subjectClass(r.key)}" data-subject="${esc(r.key)}">
          <span class="subject-mark">${esc(r.mark)}</span>
          <span class="subject-main">
            <span class="subject-row-top"><span class="subject-name">${esc(r.label)}</span><span class="subject-count">${r.done}/${r.tot}</span></span>
            <p>${esc(r.desc)}</p>
            <span class="bar"><i style="width:${r.comp}%"></i></span>
            <span class="subject-meta"><span>完成 ${r.comp}%</span><span>正确率 ${r.done ? r.acc + '%' : '—'}</span></span>
          </span>
          ${icon('arrow', 'subject-arrow')}
        </button>`).join('')}
      </div>
      <div class="section-title"><h2>快捷入口</h2></div>
      <div class="quick-grid">
        <button class="quick" data-go="#/dt">${icon('book')}<b>综合大题</b><span>思路引导</span></button>
        <button class="quick" data-go="#/ct">${icon('check')}<b>错题本</b><span>${store.getMistakes().length} 道待复习</span></button>
        <button class="quick" data-go="#/kg">${icon('graph')}<b>知识图谱</b><span>定位薄弱点</span></button>
      </div>
      <p class="foot-note">点击科目查看章节，再进入具体题目</p>`;
    $$('[data-subject]').forEach(b => b.onclick = () => {
      S.practice = null;
      S.xzt = { subject: b.dataset.subject, sec: null, num: null, list: null };
      navigate(qHash(b.dataset.subject));
    });
    $$('[data-go]').forEach(b => b.onclick = () => navigate(b.dataset.go));
    updateBadge();
  } catch (e) {
    app.innerHTML = pageHead('刷题') + `<div class="empty"><p>题库加载失败：${esc(e.message)}</p></div>`;
  }
}

async function viewChapters(subject) {
  const app = $('#app');
  S.practice = null;
  S.xzt = { subject, sec: null, num: null, list: null };
  app.innerHTML = `<div class="crumb-row"><button class="link-btn" id="back-subj">${icon('back')} 科目</button><span class="small">${esc(subjectLabel(subject))}</span></div>`
    + pageHead(subjectLabel(subject), '选择章节开始练习', `<button class="btn small" id="ch-dt">${icon('book')} 综合大题</button>`)
    + skeleton(6);
  $('#back-subj').onclick = () => navigate('#/xzt');
  $('#ch-dt').onclick = () => { S.dt.subject = subject; navigate('#/dt'); };
  try {
    const d = await loadBank(subject);
    const p = store.getProgress();
    const mode = store.getAnswerMode();
    const secs = sortSecs(Object.keys(d.sections));
    let total = 0, done = 0, ok = 0;
    const rows = secs.map(sec => {
      const v = d.sections[sec];
      const prog = (p[subject] && p[subject][sec]) || {};
      const sd = Object.keys(prog).length;
      const so = Object.values(prog).filter(x => x.ok).length;
      const allDone = sd >= v.qs.length;
      total += v.qs.length; done += sd; ok += so;
      return {
        sec, title: v.title || '', count: v.qs.length, done: sd, ok: so,
        comp: pct(sd, v.qs.length), allDone,
        showAcc: mode === 'instant' || allDone,
      };
    });
    const comp = pct(done, total);
    app.innerHTML = `<div class="crumb-row"><button class="link-btn" id="back-subj">${icon('back')} 科目</button><span class="small">${esc(subjectLabel(subject))}</span></div>`
      + pageHead(subjectLabel(subject), `${secs.length} 个章节 · 共 ${total} 题`, `<button class="btn small" id="ch-dt">${icon('book')} 综合大题</button>`)
      + `<div class="panel">
          <div class="panel-head"><h3>章节总览</h3><span class="small">${done}/${total} 题 · 完成 ${comp}%</span></div>
          <div class="bar lg"><i style="width:${comp}%"></i></div>
          <div class="subject-meta"><span>完成度 ${comp}%</span><span>正确率 ${mode === 'instant' || done === total ? (done ? pct(ok, done) + '%' : '—') : '统一判分'}</span></div>
        </div>
        <div class="chapter-cards">
          ${rows.map(r => {
            const noChoice = r.count === 0;
            return `<button class="chapter-card ${noChoice ? 'no-choice' : ''}" data-sec="${esc(r.sec)}" ${noChoice ? 'data-dt="1"' : ''}>
            <span class="chapter-num">${esc(r.sec)}</span>
            <span class="chapter-main">
              <span class="chapter-title">${esc(r.title || (noChoice ? '综合应用题' : '未命名章节'))}</span>
              <span class="small">${noChoice ? '暂无选择题 · 去做综合大题' : `${r.count} 题 · 已答 ${r.done}${r.showAcc && r.done ? ` · 正确率 ${pct(r.ok, r.done)}%` : ''}`}</span>
              <span class="bar"><i style="width:${r.comp}%"></i></span>
            </span>
            <span class="chapter-side"><b>${noChoice ? '大题' : r.comp + '%'}</b><span>${noChoice ? '前往' : '完成'}</span></span>
            ${icon('arrow')}
          </button>`; }).join('')}
        </div>
        <p class="foot-note">${mode === 'section' ? '当前为小节统一判分模式' : '当前为即时判分模式'} · 可在设置中切换</p>`;
    $('#back-subj').onclick = () => navigate('#/xzt');
    $('#ch-dt').onclick = () => { S.dt.subject = subject; navigate('#/dt'); };
    $$('[data-sec]').forEach(b => b.onclick = () => {
      if (b.dataset.dt) { S.dt.subject = subject; navigate('#/dt'); return; }
      navigate(qHash(subject, b.dataset.sec));
    });
    window.scrollTo(0, 0);
  } catch (e) {
    app.innerHTML = `<div class="empty"><p>加载失败：${esc(e.message)}</p></div>`;
  }
}

async function viewChapterQuiz(subject, sec, num) {
  const app = $('#app');
  S.practice = null;
  S.xzt = { subject, sec, num: null, list: null };
  try {
    const d = await loadBank(subject);
    const v = d.sections[sec];
    if (!v) { toast('章节不存在，可能题库已更新'); navigate(qHash(subject)); return; }
    const mode = store.getAnswerMode();
    app.innerHTML = `<div class="quiz-top">
        <button class="link-btn" id="back-ch">${icon('back')} 章节</button>
        <button class="mode-pill ${mode === 'section' ? 'section' : ''}" id="mode-link">${mode === 'section' ? '小节统一判分' : '即时判分'}</button>
      </div>`
      + pageHead(`${sec} ${v.title || ''}`, `${subjectLabel(subject)} · 共 ${v.qs.length} 题`, `<button class="btn small" id="to-dt">${icon('book')} 大题</button>`)
      + `<div id="xzt-body">${skeleton(4)}</div>`;
    $('#back-ch').onclick = () => navigate(qHash(subject));
    $('#mode-link').onclick = () => navigate('#/settings');
    $('#to-dt').onclick = () => { S.dt.subject = subject; navigate('#/dt'); };
    await renderXztList(subject, sec);
    if (num != null && num !== '') {
      history.replaceState(null, '', qHash(subject, sec));
      const list = S.xzt.list;
      S.xzt.num = null;
      const n = Number(num);
      if (!Number.isNaN(n)) openQuestion(subject, sec, n, list);
    }
  } catch (e) {
    app.innerHTML = `<div class="empty"><p>加载失败：${esc(e.message)}</p></div>`;
  }
}

async function renderXztList(subject, sec) {
  S.xzt.num = null;
  const d = await loadBank(subject);
  const v = d.sections[sec];
  if (!v) return;
  const p = store.getProgress();
  const prog = (p[subject] && p[subject][sec]) || {};
  const done = Object.keys(prog).length;
  const ok = Object.values(prog).filter(x => x.ok).length;
  const allDone = done >= v.qs.length;
  const mode = store.getAnswerMode();
  const showAcc = mode === 'instant' || allDone;
  const items = v.qs.map(q => ({ subject, sec, num: q[0] }));
  S.xzt.list = items;
  S.xzt.subject = subject; S.xzt.sec = sec;
  const body = $('#xzt-body');
  body.innerHTML = `${done ? `<button class="section-done-card" id="view-summary">
      <span>${allDone ? '本节已完成' : `已答 ${done}/${v.qs.length}`} · 查看本节结果</span>
      ${icon('arrow')}
    </button>` : ''}
    <div class="list-head">
      <div><b>本节进度</b><div class="small">共 ${v.qs.length} 题 · 已答 ${done}${showAcc && done ? ` · 正确率 ${pct(ok, done)}%` : (done && mode === 'section' ? ' · 待本节结束判分' : '')}</div></div>
      <div class="list-tools">
        ${done ? `<button class="link-btn danger-text" id="clear-sec" title="清除本章全部作答与错题">清除本章</button>` : ''}
        <div class="mini-ring" title="完成度">${ring(pct(done, v.qs.length), 46)}</div>
      </div>
    </div>
    <div class="qlist">${v.qs.map(q => questionRow(q, prog[q[0]], mode, allDone)).join('')}</div>`;
  $$('#xzt-body .q-row').forEach(r => r.onclick = () => openQuestion(subject, sec, Number(r.dataset.num), items));
  $('#view-summary')?.addEventListener('click', () => showSectionSummary(subject, sec));
  $('#clear-sec')?.addEventListener('click', async () => {
    const okClear = await confirmDialog(
      '清除本章作答',
      `将删除「${sec} ${v.title || ''}」下全部作答记录与本章错题。做题热力图统计会保留。`,
      '清除'
    );
    if (!okClear) return;
    store.clearSection(subject, sec);
    updateBadge();
    toast('已清除本章作答');
    renderXztList(subject, sec);
  });
  window.scrollTo(0, 0);
}

function questionRow(q, st, mode, allDone) {
  const multi = /^[A-D]{1,4}$/.test(q[1]) && q[1].length > 1;
  const reveal = mode === 'instant' || allDone;
  let tag = '';
  if (st) {
    tag = reveal
      ? `<span class="tag ${st.ok ? 'ok' : 'bad'}">${st.ok ? '✓' : '✗'}</span>`
      : '<span class="tag">已答</span>';
  }
  return `<button class="q-row" data-num="${q[0]}">
    <span class="q-no">${q[0]}</span>
    <span class="q-stem">${esc(q[2])}</span>
    ${multi ? '<span class="tag">多选</span>' : ''}${tag}
  </button>`;
}

async function viewPractice(kpId, mix) {
  const app = $('#app');
  await ensurePractice(kpId, mix);
  const practice = S.practice;
  const headSub = practice ? `${practice.items.length} 道题 · 专项突破（即时判分）` : '专项突破';
  app.innerHTML = pageHead('专项练习', headSub)
    + (practice ? `<div class="practice-banner">
        <div><div class="small">${practice.mix ? 'AI 建议' : '知识点专项'}</div><b>${esc(practice.name)}</b></div>
        <button class="btn small" id="exit-practice">退出</button>
      </div>` : '')
    + `<div id="xzt-body">${skeleton(4)}</div>`;
  $('#exit-practice')?.addEventListener('click', () => navigate('#/xzt'));
  if (!practice || !practice.items.length) {
    $('#xzt-body').innerHTML = emptyBox('这个知识点暂时没有选择题，试试大题或 AI 讲解。');
    return;
  }
  await renderPracticeList(practice);
}

async function renderPracticeList(practice) {
  S.xzt.num = null;
  const body = $('#xzt-body');
  const p = store.getProgress();
  const rows = [];
  const cache = {};
  for (const it of practice.items) {
    if (!cache[it.subject]) cache[it.subject] = await loadBank(it.subject);
    const v = cache[it.subject].sections[it.sec];
    const q = v && v.qs.find(x => x[0] === it.num);
    if (!q) continue;
    const st = p[it.subject]?.[it.sec]?.[it.num];
    rows.push(`<button class="q-row with-meta" data-key="${esc(it.subject)}|${esc(it.sec)}|${it.num}">
      <span class="q-no">${it.num}</span>
      <span class="q-stem"><span class="q-meta">${esc(it.subject)} · ${esc(it.sec)}</span>${esc(q[2])}</span>
      ${st ? `<span class="tag ${st.ok ? 'ok' : 'bad'}">${st.ok ? '✓' : '✗'}</span>` : ''}
    </button>`);
  }
  body.innerHTML = `<div class="list-head"><div><b>${esc(practice.name)}</b><div class="small">共 ${practice.items.length} 题 · 点击选项即时判分</div></div>
    ${practice.mix ? `<span class="tag warn">AI 建议</span>` : ''}</div>
    <div class="qlist">${rows.join('') || emptyBox('暂无题目')}</div>`;
  $$('#xzt-body .q-row').forEach(r => r.onclick = () => {
    const [sub, sec, num] = r.dataset.key.split('|');
    openQuestion(sub, sec, Number(num), practice.items);
  });
  window.scrollTo(0, 0);
}

async function openQuestion(subject, sec, num, list) {
  S.xzt.subject = subject; S.xzt.sec = sec; S.xzt.num = num; S.xzt.list = list;
  store.setLast({ subject, sec, num, type: 'xzt' });
  const body = $('#xzt-body');
  if (!body) return;
  body.innerHTML = skeleton(3);
  try {
    const [d, kps] = await Promise.all([loadBank(subject), kpNamesOf(subject, sec, num)]);
    const v = d.sections[sec];
    const qs = v.qs;
    const idx = qs.findIndex(x => x[0] === num);
    const q = qs[idx];
    if (!q) { body.innerHTML = emptyBox('题目不存在，可能题库已更新'); return; }
    const isOpts = /^[A-D]{1,4}$/.test(q[1]);
    const multi = q[1].length > 1;
    const opts = q[4] || [];
    const sel = new Set();
    const p = store.getProgress();
    const prev = p[subject]?.[sec]?.[num];
    const mode = S.practice ? 'instant' : store.getAnswerMode();
    const sectionMode = mode === 'section' && !S.practice;
    const sectionDoneBefore = qs.every(x => p[subject]?.[sec]?.[x[0]]);
    const graded = !sectionMode || sectionDoneBefore;
    const navItems = (S.practice && list && list.length) ? list : qs.map(x => ({ subject, sec, num: x[0] }));
    const navIdx = navItems.findIndex(it => (it.subject || subject) === subject && (it.sec || sec) === sec && it.num === num);
    const navCount = navItems.length;

    body.innerHTML = `<div class="panel q-panel">
      <div class="q-crumb">
        <button class="link-btn" id="q-back">${icon('back')} ${S.practice ? '专项列表' : '题目列表'}</button>
        <span>${esc(d.displayName || d.name)} · ${esc(sec)} · 第 ${num} 题 ${multi ? '<span class="tag">多选</span>' : ''}</span>
      </div>
      <h2 class="stem">${esc(q[2])}</h2>
      ${figure(q[5])}
      <div class="q-mode-note">${sectionMode ? '小节统一判分：单选点击后自动下一题，本节结束统一看结果' : '即时判分：点击选项立即显示对错与解析'}</div>
      <div class="opts" id="q-opts"></div>
      <div class="act-row q-confirm-row hidden" id="q-confirm-row">
        <button class="btn primary grow" id="q-confirm">${sectionMode ? '确认并继续' : '确认答案'}</button>
      </div>
      ${!sectionMode ? `<button class="link-btn peek-link" id="q-peek">直接看答案</button>` : ''}
      <div id="q-result"></div>
      <div class="q-foot">
        <button class="btn" id="q-prev" ${navIdx <= 0 ? 'disabled' : ''}>${icon('back')} 上一题</button>
        <span class="small">${navIdx + 1} / ${navCount}${prev ? (graded ? ' · 已完成' : ' · 已答') : ''}</span>
        <button class="btn" id="q-next" ${navIdx >= navCount - 1 ? 'disabled' : ''}>下一题 ${icon('arrow')}</button>
      </div>
    </div>`;

    const optsEl = $('#q-opts');
    const confirmRow = $('#q-confirm-row');

    const showConfirm = () => { if (confirmRow) confirmRow.classList.remove('hidden'); };

    if (isOpts) {
      optsEl.innerHTML = (opts.length ? opts : ['A', 'B', 'C', 'D']).map(t =>
        `<button type="button" class="opt" data-l="${esc(String(t)[0])}"><span class="opt-k">${esc(String(t)[0])}</span><span>${esc(String(t).replace(/^[A-D][.、．]\s*/, ''))}</span></button>`).join('');
      $$('#q-opts .opt').forEach(o => o.onclick = () => {
        if (o.classList.contains('locked')) return;
        if (!multi) {
          $$('#q-opts .opt').forEach(x => x.classList.remove('sel'));
          sel.clear(); sel.add(o.dataset.l); o.classList.add('sel');
          commit();
        } else {
          const L = o.dataset.l;
          if (sel.has(L)) { sel.delete(L); o.classList.remove('sel'); }
          else { sel.add(L); o.classList.add('sel'); }
          if (sel.size) showConfirm(); else confirmRow && confirmRow.classList.add('hidden');
        }
      });
    } else {
      optsEl.innerHTML = `<input type="text" id="q-text" class="text-in" placeholder="输入你的答案，如 CD 或 ①I、IV…" autocomplete="off">` +
        (opts.length ? `<div class="hint-line">参考选项：${opts.map(esc).join('　')}</div>` : '');
      const input = $('#q-text');
      input.addEventListener('input', () => {
        if (input.value.trim()) showConfirm(); else confirmRow && confirmRow.classList.add('hidden');
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); commit(); }
      });
    }

    const lockOptions = () => {
      $$('#q-opts .opt').forEach(o => o.classList.add('locked'));
      const t = $('#q-text');
      if (t) { t.readOnly = true; t.classList.add('locked'); }
      if (confirmRow) confirmRow.classList.add('hidden');
    };

    const markMine = mine => {
      if (isOpts) {
        $$('#q-opts .opt').forEach(o => { if (mine.includes(o.dataset.l)) o.classList.add('sel'); });
      } else {
        const t = $('#q-text');
        if (t) t.value = mine;
      }
    };

    const reveal = (mine, ok, completed) => {
      const res = $('#q-result');
      res.className = 'result show ' + (ok ? 'ok' : 'bad');
      res.innerHTML = `${completed ? '<div class="done-note">已作答</div>' : ''}
        <div class="result-title">${ok ? '✅ 回答正确' : '❌ 回答错误'}</div>
        <div class="ans">正确答案：${esc(q[1])}</div>
        ${ok ? '' : `<div class="small">你的答案：${esc(mine || '未作答')}</div>`}
        ${completed && prev ? `<div class="small">作答时间：${fmtDate(prev.ts)}</div>` : ''}
        ${kpChipsHtml(kps)}
        <div class="expl">${esc(q[3] || '（教材无文字解析）')}</div>
        <div class="ai-actions">
          <button class="btn small primary" id="q-ai">${icon('ai')} AI 解析这道题</button>
          <button class="btn small" id="q-ask">问问 AI</button>
          <button class="btn small" id="q-reset">重做本题</button>
        </div>
        <div id="q-ai-box" class="ai-box"></div>`;
      bindKpChips(res);
      $('#q-confirm-row')?.classList.add('hidden');
      $('#q-peek')?.classList.add('hidden');
      const txt = $('#q-text');
      if (txt) { txt.readOnly = true; txt.classList.add('locked'); }
      $$('#q-opts .opt').forEach(o => {
        const L = o.dataset.l;
        o.classList.add('locked');
        if (q[1].includes(L)) o.classList.add('right');
        if (!ok && mine && mine.includes(L)) o.classList.add('wrong');
      });
      $('#q-ai').onclick = () => inlineAI({
        host: $('#q-ai-box'),
        messages: messagesForQuestion({ subject, secTitle: `${sec} ${v.title || ''}`, q, mine, kpNames: kps.map(k => k.name) }),
        subject, sec, num,
        prompt: '请解析这道选择题，重点说明我的错因。',
      });
      $('#q-ask').onclick = () => {
        S.ai.pending = {
          kind: 'question', subject, sec, num, q, mine,
          kpNames: kps.map(k => k.name),
          messages: messagesForQuestion({ subject, secTitle: `${sec} ${v.title || ''}`, q, mine, kpNames: kps.map(k => k.name) }),
        };
        navigate('#/ai');
      };
      $('#q-reset').onclick = () => {
        store.clearAnswer(subject, sec, num);
        openQuestion(subject, sec, num, list);
      };
    };

    function advanceAfterSection() {
      if (S.xzt.num !== num) return;
      const fresh = store.getProgress()[subject]?.[sec] || {};
      const all = qs.every(x => fresh[x[0]]);
      if (all) { showSectionSummary(subject, sec); return; }
      let next = qs.slice(idx + 1).find(x => !fresh[x[0]]);
      if (!next) next = qs.find(x => !fresh[x[0]]);
      if (next) openQuestion(subject, sec, next[0], list);
      else showSectionSummary(subject, sec);
    }

    function commit() {
      const mine = isOpts ? Array.from(sel).sort().join('') : ($('#q-text')?.value || '').trim();
      if (!mine) { toast(isOpts ? '请先选择答案' : '请先输入答案'); return; }
      const ok = isOpts ? mine === q[1].split('').sort().join('') : norm(mine) === norm(q[1]);
      store.recordAnswer(subject, sec, num, mine, ok);
      store.logActivity(1);
      if (ok) store.removeMistake(subject, sec, num);
      else store.upsertMistake({ subject, sec, num, mine, right: q[1] });
      updateBadge();
      if (sectionMode) {
        lockOptions();
        const res = $('#q-result');
        res.className = 'result show';
        res.innerHTML = `<div class="done-note">已作答</div><div class="small">答案已记录，本节结束后统一判分</div>`;
        setTimeout(advanceAfterSection, 320);
      } else {
        reveal(mine, ok, false);
        $('#q-result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    $('#q-confirm')?.addEventListener('click', commit);
    $('#q-peek')?.addEventListener('click', () => reveal('', false, false));

    if (prev) {
      markMine(String(prev.mine || ''));
      lockOptions();
      if (graded) reveal(prev.mine, !!prev.ok, true);
      else {
        const res = $('#q-result');
        res.className = 'result show';
        res.innerHTML = `<div class="done-note">已作答</div><div class="small">本节统一判分，完成本节后查看结果</div>
          <div class="act-row"><button class="btn small" id="q-reset">重做本题</button></div>`;
        $('#q-reset').onclick = () => {
          store.clearAnswer(subject, sec, num);
          openQuestion(subject, sec, num, list);
        };
      }
    }

    $('#q-back').onclick = () => {
      S.xzt.num = null;
      if (S.practice) renderPracticeList(S.practice);
      else navigate(qHash(subject, sec));
    };
    $('#q-prev').onclick = () => {
      if (navIdx <= 0) return;
      const it = navItems[navIdx - 1];
      openQuestion(it.subject || subject, it.sec || sec, it.num, list);
    };
    $('#q-next').onclick = () => {
      if (navIdx >= navCount - 1) return;
      const it = navItems[navIdx + 1];
      openQuestion(it.subject || subject, it.sec || sec, it.num, list);
    };
    window.scrollTo(0, 0);
  } catch (e) {
    body.innerHTML = `<div class="empty"><p>加载失败：${esc(e.message)}</p><button class="btn" onclick="location.reload()">重试</button></div>`;
  }
}

async function showSectionSummary(subject, sec) {
  const body = $('#xzt-body');
  if (!body) return;
  const d = await loadBank(subject);
  const v = d.sections[sec];
  if (!v) return;
  const p = store.getProgress()[subject]?.[sec] || {};
  const qs = v.qs;
  const items = qs.map(q => ({ subject, sec, num: q[0] }));
  const answered = qs.filter(q => p[q[0]]).length;
  const correct = qs.filter(q => p[q[0]] && p[q[0]].ok).length;
  const allDone = answered >= qs.length;
  const acc = pct(correct, answered);
  S.xzt.num = null;
  S.xzt.subject = subject; S.xzt.sec = sec; S.xzt.list = items;

  body.innerHTML = `<div class="panel summary-panel">
    <div class="summary-top">
      ${ring(pct(answered, qs.length), 82, `${answered}/${qs.length}`)}
      <div>
        <h2>${allDone ? '本节完成' : '本节进度'}</h2>
        <div class="small">答对 ${correct} 题 · 已答 ${answered}/${qs.length} 题</div>
        ${allDone
          ? `<div class="summary-score" style="color:${acc >= 80 ? 'var(--ok)' : acc >= 60 ? 'var(--mid)' : 'var(--bad)'}">正确率 ${acc}%</div>`
          : `<div class="small">还有 ${qs.length - answered} 题未作答，完成后自动判分</div>`}
      </div>
    </div>
    <div class="summary-list">
      ${qs.map(q => {
        const st = p[q[0]];
        const status = st ? (st.ok ? '<span class="s-ok">✓</span>' : '<span class="s-bad">✗</span>') : '<span class="s-skip">—</span>';
        return `<button class="summary-row" data-num="${q[0]}">
          <span class="no">${q[0]}</span>${status}
          <span class="ans">你：${esc(st ? (st.mine || '—') : '未答')}　正确：${esc(q[1])}</span>
        </button>`;
      }).join('')}
    </div>
    <div class="act-row">
      ${!allDone ? `<button class="btn primary" id="sum-continue">继续答题</button>` : ''}
      <button class="btn" id="sum-back">返回章节</button>
      <button class="btn" id="sum-redo">重做本节</button>
    </div>
  </div>`;
  $$('.summary-row', body).forEach(r => r.onclick = () => openQuestion(subject, sec, Number(r.dataset.num), items));
  $('#sum-continue')?.addEventListener('click', () => {
    const next = qs.find(q => !p[q[0]]);
    if (next) openQuestion(subject, sec, next[0], items);
  });
  $('#sum-back').onclick = () => navigate(qHash(subject));
  $('#sum-redo').onclick = async () => {
    if (!(await confirmDialog('重做本节', '将清除本节全部作答记录与错题，重新开始练习。', '重做'))) return;
    store.clearSection(subject, sec);
    updateBadge();
    navigate(qHash(subject, sec));
  };
  window.scrollTo(0, 0);
}

/* =====================================================================
   综合应用题
   ===================================================================== */
async function viewDt() {
  updateBadge();
  const app = $('#app');
  const subject = S.dt.subject || SUBJECTS[0];
  app.innerHTML = pageHead('综合应用题', '先动笔，再看思路与解答') + `
    <div class="toolbar">${subjTabs(subject)}
      <div class="toolbar-row"><select id="dt-sec" aria-label="选择章节"></select><button class="btn small" id="to-xzt">${icon('quiz')} 选择题</button></div>
    </div><div id="dt-body">${skeleton(3)}</div>`;
  bindSubjTabs(app, s => { S.dt = { subject: s, sec: null, num: null }; navigate('#/dt'); });
  $('#to-xzt').onclick = () => navigate(qHash(subject));
  try {
    const d = await loadBank(subject);
    const secs = sortSecs(Object.keys(d.sections).filter(s => d.sections[s].bigq.length));
    if (!secs.length) { $('#dt-body').innerHTML = emptyBox('该科暂无综合应用题'); return; }
    if (!secs.includes(S.dt.sec)) S.dt.sec = secs[0];
    const sel = $('#dt-sec');
    sel.innerHTML = secs.map(s => `<option value="${esc(s)}" ${s === S.dt.sec ? 'selected' : ''}>${esc(s)} ${esc(d.sections[s].title || '')}</option>`).join('');
    sel.onchange = () => { S.dt.sec = sel.value; renderDtList(d); };
    renderDtList(d);
  } catch (e) {
    $('#dt-body').innerHTML = `<div class="empty"><p>加载失败：${esc(e.message)}</p></div>`;
  }
}

function renderDtList(d) {
  const v = d.sections[S.dt.sec];
  const rows = v.bigq.map(b => `<button class="q-row" data-num="${b[0]}">
    <span class="q-no">${b[0]}</span><span class="q-stem">${esc(b[1])}</span><span class="tag">大题</span>
  </button>`).join('');
  $('#dt-body').innerHTML = `<div class="list-head"><div><b>${esc(S.dt.sec)} ${esc(v.title || '')}</b><div class="small">共 ${v.bigq.length} 道综合应用题</div></div></div>
    <div class="qlist">${rows}</div>`;
  $$('#dt-body .q-row').forEach(r => r.onclick = () => renderDtDetail(d, Number(r.dataset.num)));
  window.scrollTo(0, 0);
}

async function renderDtDetail(d, num) {
  const v = d.sections[S.dt.sec];
  const b = v.bigq.find(x => x[0] === num);
  if (!b) return;
  const body = $('#dt-body');
  body.innerHTML = skeleton(3);
  const kps = await kpNamesOf(d.name, S.dt.sec, num, 'bigq');
  const hints = (b[3] || []).map(h => esc((h[0] ? h[0] + '　' : '') + h[1])).join('；');
  body.innerHTML = `<div class="panel q-panel">
    <div class="q-crumb"><button class="link-btn" id="dt-back">${icon('back')} 大题列表</button>
      <span>${esc(d.displayName || d.name)} · ${esc(S.dt.sec)} · 第 ${num} 题</span></div>
    <h2 class="stem">${esc(b[1])}</h2>
    ${figure(b[4])}
    ${kpChipsHtml(kps)}
    <div class="act-row"><button class="btn" id="dt-hint">💡 思路引导</button><button class="btn primary" id="dt-ans">显示解答</button></div>
    <div id="dt-hintbox" class="result"></div>
    <div id="dt-ansbox" class="result"></div>
    <div class="ai-actions"><button class="btn small" id="dt-ai">${icon('ai')} AI 拆解步骤</button></div>
    <div id="dt-aibox" class="ai-box"></div>
  </div>`;
  bindKpChips(body);
  $('#dt-back').onclick = () => renderDtList(d);
  $('#dt-hint').onclick = () => {
    const r = $('#dt-hintbox');
    r.className = 'result show';
    r.innerHTML = `<b>思路引导</b><div class="hint-line">${hints || '先列出已知条件，按章节思路逐步推演。'}</div>`;
  };
  $('#dt-ans').onclick = () => {
    const r = $('#dt-ansbox');
    r.className = 'result show';
    r.innerHTML = `<b>参考解答</b><div class="expl">${esc(b[2] || '（解答待核，请翻教材）')}</div>${figure(b[5])}`;
  };
  $('#dt-ai').onclick = () => inlineAI({
    host: $('#dt-aibox'),
    messages: messagesForBigq({ subject: d.displayName || d.name, secTitle: `${S.dt.sec} ${v.title || ''}`, b, kpNames: kps.map(k => k.name) }),
    prompt: '请拆解这道综合应用题的解题步骤和得分点。',
  });
  window.scrollTo(0, 0);
}

/* =====================================================================
   AI：流式渲染、内联解析、对话
   ===================================================================== */
function noKeyHtml() {
  return `<div class="warn-box">${icon('ai')}<div><b>还没有配置 AI</b><p>在「我的 → AI 设置」填入 API Key（支持 DeepSeek / OpenAI / Ollama 等），Key 只保存在本机浏览器。</p></div>
    <button class="btn small primary" id="go-ai-settings">去设置</button></div>`;
}
function bindNoKey(root) {
  const b = root.querySelector('#go-ai-settings');
  if (b) b.onclick = () => navigate('#/settings');
}

function aiBoxShell(host, title) {
  host.classList.add('show');
  host.innerHTML = `<div class="ai-head"><span class="ai-badge">${icon('ai')} ${esc(title || 'AI 解析')}</span><span class="spin" aria-label="生成中"></span></div>
    <div class="ai-body md"></div><div class="ai-foot"><span class="small">内容由 AI 生成，请以教材为准</span><button class="link-btn" data-copy>复制</button></div>`;
  const bodyEl = host.querySelector('.ai-body');
  let text = '';
  let pending = false;
  const draw = () => { pending = false; bodyEl.innerHTML = md(text); };
  const onDelta = d => {
    text += d;
    if (!pending) { pending = true; requestAnimationFrame(() => { draw(); autoscrollIfNear(host); }); }
  };
  const finish = () => {
    draw();
    host.querySelector('.spin')?.remove();
    const copy = host.querySelector('[data-copy]');
    if (copy) copy.onclick = async () => {
      const ok = await copyText(text);
      toast(ok ? '已复制' : '复制失败');
    };
    return text;
  };
  return { onDelta, finish, bodyEl };
}

function autoscrollIfNear(el) {
  const r = el.getBoundingClientRect();
  if (r.bottom > window.innerHeight && r.top < window.innerHeight) {
    window.scrollBy(0, Math.min(60, r.bottom - window.innerHeight + 40));
  }
}

async function inlineAI({ host, messages, subject, sec, num, prompt }) {
  if (!host) return;
  if (!store.hasKey()) { host.classList.add('show'); host.innerHTML = noKeyHtml(); bindNoKey(host); return; }
  if (subject && sec != null && num != null) {
    const cached = store.getAnalysis(subject, sec, num);
    if (cached) {
      host.classList.add('show');
      host.innerHTML = `<div class="ai-head"><span class="ai-badge">${icon('ai')} AI 解析</span><span class="small">${fmtDate(cached.ts)} 缓存</span></div>
        <div class="ai-body md">${md(cached.text)}</div>
        <div class="ai-foot"><span class="small">${esc(cached.model || '')}</span><button class="link-btn" data-regen>重新生成</button></div>`;
      host.querySelector('[data-regen]').onclick = () => {
        store.deleteAnalysis(subject, sec, num);
        host.innerHTML = '';
        host.classList.remove('show');
        inlineAI({ host, messages, subject, sec, num, prompt });
      };
      return;
    }
  }
  const runner = aiBoxShell(host, 'AI 解析');
  try {
    const text = await streamChat(messages, { onDelta: runner.onDelta });
    runner.finish();
    if (subject && sec != null && num != null && text.trim()) {
      store.saveAnalysis(subject, sec, num, text, store.getAI().model);
    }
  } catch (e) {
    host.querySelector('.spin')?.remove();
    if (e.name === 'AbortError') return;
    host.innerHTML = `<div class="warn-box bad"><div><b>AI 请求失败</b><p>${esc(e.message)}</p></div><button class="btn small" id="ai-retry">重试</button></div>`;
    $('#ai-retry').onclick = () => inlineAI({ host, messages, subject, sec, num, prompt });
  }
}

/* ---------- AI 对话页 ---------- */
async function viewAi() {
  updateBadge();
  const app = $('#app');
  const cfg = store.getAI();
  const chat = store.getChat();
  const pending = S.ai.pending;
  const hasKey = !!cfg.apiKey;
  const live = (S.xzt.num != null && S.xzt.subject && S.xzt.sec)
    ? { subject: S.xzt.subject, sec: S.xzt.sec, num: S.xzt.num } : null;
  const lastQ = store.getLast();
  const fallback = (!live && lastQ && lastQ.type === 'xzt' && Date.now() - (lastQ.ts || 0) < 86400000 * 7)
    ? { subject: lastQ.subject, sec: lastQ.sec, num: lastQ.num } : null;
  const qctx = pending && pending.kind === 'question'
    ? { subject: pending.subject, sec: pending.sec, num: pending.num, active: true }
    : (live || fallback);
  const ctxLabel = pending && pending.kind === 'question' ? '已带入题目'
    : live ? '正在刷' : '上次做到';

  app.innerHTML = pageHead('AI 问答', '概念、解题思路、复习规划，随时问')
    + `${hasKey ? '' : `<div class="card setup-card"><div class="setup-ic">${icon('ai')}</div><div><b>先配置一个 AI 服务</b><p>支持 DeepSeek、OpenAI、通义、Kimi、Ollama 等 OpenAI 兼容接口。Key 仅保存在本机。</p></div><button class="btn primary" id="setup-go">去设置</button></div>`}`
    + `${qctx ? `<div class="q-context ${qctx.active ? 'active' : ''}">
        <div class="q-context-main"><span class="q-context-ic">${icon('book')}</span>
          <div><b>${ctxLabel}：${esc(qctx.subject)} ${esc(qctx.sec)} 第 ${qctx.num} 题</b>
            <div class="small">${qctx.active ? '题目信息已加入 AI 上下文' : '切换到 AI 不会丢失这道题，可随时返回'}</div></div>
        </div>
        <div class="q-context-actions">
          <button class="btn small" id="ctx-return">返回题目</button>
          ${qctx.active ? '' : `<button class="btn small primary" id="ctx-use">围绕此题提问</button>`}
        </div>
      </div>` : ''}`
    + `${pending && pending.kind === 'kp' ? `<div class="context-chip" id="ctx-chip"><span>${icon('ai')} 正在问：${esc(pending.name)}</span><button class="icon-btn tiny" id="ctx-clear" aria-label="移除上下文">${icon('close')}</button></div>` : ''}`
    + `<div class="ai-page">
      <div class="chat" id="chat"><div class="chat-inner" id="chat-inner"></div></div>
      <div class="composer" id="composer">
        <div class="suggest" id="suggest"></div>
        <div class="composer-row">
          <textarea id="ai-input" rows="1" placeholder="输入你的问题…" enterkeyhint="send"></textarea>
          <button class="send-btn" id="ai-send" aria-label="发送">${icon('arrow')}</button>
        </div>
        <div class="composer-foot"><span class="small">AI 生成内容仅供参考</span><button class="link-btn" id="ai-clear">清空对话</button></div>
      </div>
    </div>`;

  $('#setup-go')?.addEventListener('click', () => navigate('#/settings'));
  $('#ctx-clear')?.addEventListener('click', () => { S.ai.pending = null; viewAi(); });
  $('#ctx-return')?.addEventListener('click', () => {
    if (!qctx) return;
    S.ai.pending = null;
    navigate(qHash(qctx.subject, qctx.sec, qctx.num));
  });
  $('#ctx-use')?.addEventListener('click', async () => {
    if (!qctx) return;
    try {
      const d = await loadBank(qctx.subject);
      const v = d.sections[qctx.sec];
      const q = v && v.qs.find(x => x[0] === qctx.num);
      if (!q) { toast('题目不存在，可能题库已更新'); return; }
      const kps = await kpNamesOf(qctx.subject, qctx.sec, qctx.num);
      const pr = store.getProgress();
      const mine = pr[qctx.subject]?.[qctx.sec]?.[qctx.num]?.mine || '';
      S.ai.pending = {
        kind: 'question', subject: qctx.subject, sec: qctx.sec, num: qctx.num, q, mine,
        kpNames: kps.map(k => k.name),
        messages: messagesForQuestion({ subject: qctx.subject, secTitle: `${qctx.sec} ${v.title || ''}`, q, mine, kpNames: kps.map(k => k.name) }),
      };
      viewAi();
    } catch (e) { toast(e.message); }
  });
  $('#ai-clear').onclick = async () => {
    if (!chat.messages.length) return;
    if (await confirmDialog('清空对话', '将删除本机保存的全部 AI 对话记录。', '清空')) { store.clearChat(); viewAi(); }
  };

  const inner = $('#chat-inner');
  const input = $('#ai-input');
  const sendBtn = $('#ai-send');

  const renderMessages = () => {
    const c = store.getChat();
    if (!c.messages.length) {
      inner.innerHTML = `<div class="chat-empty">
        <div class="chat-empty-ic">${icon('ai')}</div>
        <h3>有什么想问的？</h3>
        <p>可以问概念、公式、代码，也可以让我解析你的错题。</p>
      </div>`;
      return;
    }
    inner.innerHTML = c.messages.map(m => `<div class="msg ${m.role}">
      ${m.role === 'assistant' ? `<div class="msg-avatar">${icon('ai')}</div>` : ''}
      <div class="bubble ${m.role}">${m.role === 'assistant' ? md(m.content) : esc(m.content).replace(/\n/g, '<br>')}</div>
    </div>`).join('') + (S.ai.busy ? `<div class="msg assistant"><div class="msg-avatar">${icon('ai')}</div><div class="bubble assistant typing"><span></span><span></span><span></span></div></div>` : '');
    scrollChat(true);
  };

  const scrollChat = (force) => {
    const box = $('#chat');
    if (!box) return;
    const nearBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 280;
    if (force || nearBottom) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: force ? 'auto' : 'smooth' });
  };

  const suggestions = pending
    ? ['请解析这道题，并说明我的错因', '这道题考的是哪个知识点？', '给我一道类似的题', '用更简单的方式讲一遍']
    : ['区分进程和线程', 'TCP 为什么需要三次握手', 'Cache 组相联映射怎么算', '帮我制定一周复习计划'];
  $('#suggest').innerHTML = suggestions.map(s => `<button class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join('');
  $$('#suggest [data-s]').forEach(b => b.onclick = () => send(b.dataset.s));

  function buildContext() {
    const p = S.ai.pending;
    if (!p) return '';
    if (p.kind === 'question') {
      const q = p.q;
      return `\n\n【当前题目上下文】\n科目：${p.subject} 章节：${p.sec}\n题干：${q[2]}\n选项：${(q[4] || []).join(' / ')}\n正确答案：${q[1]}\n学生答案：${p.mine || '未作答'}\n${p.kpNames?.length ? '知识点：' + p.kpNames.join('、') : ''}\n请围绕这道题回答用户的问题。`;
    }
    if (p.kind === 'kp') {
      return `\n\n【当前知识点上下文】\n科目：${p.subject} 章节：${p.chapter} 知识点：${p.name}\n前置：${(p.preNames || []).join('、') || '无'}\n后续：${(p.dependents || []).join('、') || '无'}\n请围绕这个知识点回答用户的问题。`;
    }
    return '';
  }

  function setBusyUI(busy) {
    sendBtn.innerHTML = busy ? icon('stop') : icon('arrow');
    sendBtn.setAttribute('aria-label', busy ? '停止生成' : '发送');
    sendBtn.classList.toggle('stop', busy);
    sendBtn.onclick = busy ? () => { try { S.ai.controller?.abort(); } catch (e) {} } : () => send();
  }

  async function send(text) {
    text = (text || input.value || '').trim();
    if (!text || S.ai.busy) return;
    if (!store.hasKey()) { toast('请先在 AI 设置中填写 API Key'); navigate('#/settings'); return; }
    input.value = '';
    input.style.height = 'auto';
    const chatNow = store.getChat();
    chatNow.messages.push({ role: 'user', content: text, ts: Date.now() });
    if (chatNow.messages.length > 60) chatNow.messages = chatNow.messages.slice(-60);
    store.setChat(chatNow);
    renderMessages();

    S.ai.busy = true;
    S.ai.controller = new AbortController();
    setBusyUI(true);
    renderMessages();
    const assistant = { role: 'assistant', content: '', ts: Date.now() };
    chatNow.messages.push(assistant);
    const sys = (cfg.system || '') + buildContext();
    const msgs = [{ role: 'system', content: sys }].concat(
      chatNow.messages.slice(0, -1).slice(-24).map(m => ({ role: m.role, content: m.content }))
    );
    try {
      const full = await streamChat(msgs, {
        signal: S.ai.controller.signal,
        onDelta: d => {
          assistant.content += d;
          const bubbles = $$('#chat-inner .bubble.assistant');
          const last = bubbles[bubbles.length - 1];
          if (last) {
            last.classList.remove('typing');
            last.classList.add('streaming');
            last.innerHTML = md(assistant.content);
            booleanScroll();
          }
        },
      });
      assistant.content = full;
    } catch (e) {
      if (e.name === 'AbortError') { if (!assistant.content) assistant.content = '（已停止）'; }
      else assistant.content = (assistant.content ? assistant.content + '\n\n' : '') + '⚠️ ' + e.message;
    } finally {
      S.ai.busy = false;
      S.ai.controller = null;
      store.setChat(chatNow);
      setBusyUI(false);
      renderMessages();
    }
  }
  const booleanScroll = () => scrollChat(false);

  setBusyUI(false);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(120, input.scrollHeight) + 'px';
  });
  renderMessages();
  scrollChat(true);
}

/* =====================================================================
   错题本
   ===================================================================== */
async function viewCt() {
  updateBadge();
  const app = $('#app');
  const all = store.getMistakes().slice().sort((a, b) => b.ts - a.ts);
  const active = S.ct.subject;
  const list = active === '全部' ? all : all.filter(m => m.subject === active);
  app.innerHTML = pageHead('错题本', '答错自动收录；答对后自动移出', `<button class="icon-btn" id="ct-export" aria-label="导出">${icon('download')}</button>`)
    + `<div class="seg seg-wrap">${['全部', ...SUBJECTS].map(s => `<button class="seg-btn ${active === s ? 'on' : ''}" data-filter="${esc(s)}">${esc(s)}${s === '全部' ? ` ${all.length}` : ''}</button>`).join('')}</div>`
    + `<div id="ct-list">${list.length ? list.map(m => mistakeCard(m)).join('') : emptyBox('这里还很干净，继续保持～')}</div>`
    + `${list.length ? `<div class="act-row" style="margin-top:14px"><button class="btn" id="ct-clear">清空错题本</button><button class="btn" id="ct-practice">错题重练</button></div>` : ''}`;

  $$('[data-filter]').forEach(b => b.onclick = () => { S.ct.subject = b.dataset.filter; viewCt(); });
  $('#ct-export').onclick = () => {
    if (!all.length) { toast('暂无错题'); return; }
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = '错题本.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  $('#ct-clear')?.addEventListener('click', async () => {
    if (await confirmDialog('清空错题本', '将删除全部错题记录（不影响作答进度）。', '清空')) { store.setMistakes([]); updateBadge(); viewCt(); }
  });
  $('#ct-practice')?.addEventListener('click', () => {
    if (!list.length) return;
    S.practice = { mix: true, name: '错题重练', items: list.map(m => ({ subject: m.subject, sec: m.sec, num: m.num })) };
    navigate('#/xzt?mix=__mistakes__');
  });

  $$('#ct-list .mistake').forEach(card => bindMistakeCard(card));
}

function mistakeCard(m) {
  const key = `${m.subject}|${m.sec}|${m.num}`;
  return `<div class="mistake" data-key="${esc(key)}">
    <div class="mistake-head">
      <div><b>${esc(m.subject)} · ${esc(m.sec)} 第 ${m.num} 题</b>
        <div class="small">${fmtDate(m.ts)} · 我的 ${esc(m.mine || '—')} / 正确 ${esc(m.right || '—')}</div></div>
      <button class="icon-btn tiny" data-del aria-label="删除">${icon('close')}</button>
    </div>
    <div class="mistake-body"></div>
    <div class="act-row">
      <button class="btn small" data-open>${icon('book')} 查看解析</button>
      <button class="btn small" data-redo>重做</button>
      <button class="btn small" data-ai>${icon('ai')} AI 解析</button>
    </div>
    <div class="ai-box"></div>
  </div>`;
}

function bindMistakeCard(card) {
  const [subject, sec, numStr] = card.dataset.key.split('|');
  const num = Number(numStr);
  const m = store.getMistakes().find(x => x.subject === subject && x.sec === sec && x.num === num);
  if (!m) return;
  card.querySelector('[data-del]').onclick = () => { store.removeMistake(subject, sec, num); updateBadge(); viewCt(); };
  card.querySelector('[data-redo]').onclick = () => {
    store.clearAnswer(subject, sec, num);
    navigate(qHash(subject, sec, num));
  };
  let loaded = false;
  const load = async () => {
    if (loaded) return; loaded = true;
    const d = await loadBank(subject);
    const v = d.sections[sec];
    const q = v && v.qs.find(x => x[0] === num);
    const body = card.querySelector('.mistake-body');
    if (!q) { body.innerHTML = '<div class="small">题目不存在，题库可能已更新</div>'; return; }
    const kps = await kpNamesOf(subject, sec, num);
    body.innerHTML = `<div class="dim">${esc(q[2])}</div>${figure(q[5])}
      ${(q[4] || []).length ? `<div class="hint-line">${q[4].map(esc).join('　')}</div>` : ''}
      ${kpChipsHtml(kps)}
      <div class="expl">${esc(q[3] || '（教材无文字解析）')}</div>`;
    bindKpChips(body);
    card._q = q;
  };
  card.querySelector('[data-open]').onclick = async () => {
    card.classList.toggle('open');
    if (card.classList.contains('open')) await load();
  };
  card.querySelector('[data-ai]').onclick = async () => {
    card.classList.add('open');
    await load();
    const q = card._q;
    if (!q) return;
    const kps = await kpNamesOf(subject, sec, num);
    inlineAI({
      host: card.querySelector('.ai-box'),
      messages: messagesForQuestion({ subject, secTitle: `${sec}`, q, mine: m.mine, kpNames: kps.map(k => k.name) }),
      subject, sec, num,
      prompt: '请解析这道错题，说明我的错因。',
    });
  };
}

/* =====================================================================
   学习统计
   ===================================================================== */
async function viewStats() {
  updateBadge();
  const app = $('#app');
  app.innerHTML = pageHead('学习统计', '作答、正确率与薄弱章节') + skeleton(3);
  try {
    const ds = await loadAllBanks();
    const p = store.getProgress();
    const ms = store.getMistakes();
    const act = store.activitySeries(7);
    const maxAct = Math.max(1, ...act.map(a => a.count));
    let tDone = 0, tOk = 0, tTot = 0;
    const subjects = ds.map((d, i) => {
      const key = SUBJECTS[i];
      let tot = 0, done = 0, ok = 0;
      const chapters = [];
      Object.entries(d.sections).forEach(([sec, v]) => {
        tot += v.qs.length;
        const sp = (p[key] && p[key][sec]) || {};
        const sd = Object.keys(sp).length;
        const so = Object.values(sp).filter(x => x.ok).length;
        done += sd; ok += so;
        if (sd) chapters.push({ sec, title: v.title, done: sd, tot: v.qs.length, acc: pct(so, sd) });
      });
      tDone += done; tOk += ok; tTot += tot;
      chapters.sort((a, b) => a.acc - b.acc);
      return { key, name: d.displayName || d.name, tot, done, ok, acc: pct(ok, done), comp: pct(done, tot), chapters };
    });
    const overall = pct(tOk, tDone);
    const streak = (() => { let n = 0; for (const d of store.activitySeries(60).reverse()) { if (d.count > 0) n++; else break; } return n; })();

    app.innerHTML = pageHead('学习统计', '作答、正确率与薄弱章节') + `
      <div class="stat-grid">
        <div class="stat-card"><span>总体正确率</span><b>${tDone ? overall + '%' : '—'}</b></div>
        <div class="stat-card"><span>已做题数</span><b>${tDone}</b></div>
        <div class="stat-card"><span>错题待复习</span><b>${ms.length}</b></div>
        <div class="stat-card"><span>连续学习</span><b>${streak} 天</b></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>近 7 天作答</h3><span class="small">共 ${act.reduce((a, b) => a + b.count, 0)} 题</span></div>
        <div class="bars">${act.map(a => `<div class="bar-col"><div class="bar-v" style="height:${Math.max(4, a.count / maxAct * 100)}%"><i></i></div><span>${a.label}</span></div>`).join('')}</div>
      </div>
      ${subjects.map(s => `<div class="panel subj-stat ${subjectClass(s.key)}">
        <div class="panel-head"><h3>${esc(s.name)}</h3><span class="small">${s.done}/${s.tot} · 完成 ${s.comp}% · 正确率 ${s.done ? s.acc + '%' : '—'}</span></div>
        <div class="bar lg" title="完成度"><i style="width:${s.comp}%"></i></div>
        ${s.chapters.length ? `<div class="chapter-list">${s.chapters.slice(0, 6).map(c => `<div class="chapter-row">
          <span class="chapter-name">${esc(c.sec)} ${esc(c.title || '')}</span>
          <span class="chapter-acc ${c.acc < 60 ? 'bad' : c.acc < 80 ? 'mid' : 'ok'}">${c.acc}%</span>
          <span class="small">${c.done}/${c.tot}</span>
        </div>`).join('')}</div>` : `<p class="small" style="margin:10px 0 0">还没有作答记录</p>`}
      </div>`).join('')}
      <div class="panel"><div class="panel-head"><h3>知识图谱覆盖</h3><span class="small">点击进入诊断</span></div>
        <p class="small">根据错题自动定位薄弱知识点与先修知识缺口。</p>
        <button class="btn primary" id="stats-kg">${icon('graph')} 查看薄弱点诊断</button>
      </div>`;
    $('#stats-kg').onclick = () => navigate('#/kg');
  } catch (e) {
    app.innerHTML = pageHead('学习统计') + `<div class="empty"><p>${esc(e.message)}</p></div>`;
  }
}

/* =====================================================================
   知识图谱
   ===================================================================== */
async function viewKg() {
  updateBadge();
  const app = $('#app');
  app.innerHTML = pageHead('知识图谱', '按章节构建知识点网络，错题自动定位薄弱环节') + skeleton(3);
  try {
    const g = await getKG();
    g.stats = computeStats(g.kg, g.index);
    const subject = S.kg.subject;
    const mode = S.kg.mode;
    const summary = subjectSummary(g.kg, g.index, g.stats, subject);
    const diag = diagnose(g.kg, g.index, g.stats);
    const weakCount = diag.weak.length;

    app.innerHTML = pageHead('知识图谱', '颜色代表掌握度，箭头代表先修关系') + `
      ${subjTabs(subject)}
      <div class="kg-switch">
        <button class="seg-btn ${mode === 'graph' ? 'on' : ''}" data-mode="graph">${icon('graph')} 图谱</button>
        <button class="seg-btn ${mode === 'diag' ? 'on' : ''}" data-mode="diag">${icon('brain')} 薄弱诊断${weakCount ? ` · ${weakCount}` : ''}</button>
      </div>
      <div id="kg-body"></div>`;

    bindSubjTabs(app, s => { S.kg.subject = s; viewKg(); });
    $$('[data-mode]').forEach(b => b.onclick = () => { S.kg.mode = b.dataset.mode; viewKg(); });

    if (mode === 'diag') renderDiagnosis(diag, g);
    else renderGraph(subject, g, summary);
  } catch (e) {
    app.innerHTML = pageHead('知识图谱') + `<div class="empty"><p>加载失败：${esc(e.message)}</p><button class="btn" onclick="location.reload()">重试</button></div>`;
  }
}

function renderGraph(subject, g, summary) {
  const subj = g.kg.subjects.find(s => s.name === subject);
  const body = $('#kg-body');
  if (!subj) { body.innerHTML = emptyBox('暂无该科图谱'); return; }
  const mobile = window.innerWidth < 720;
  const cols = mobile ? 2 : 3;
  const NW = mobile ? 138 : 168, NH = mobile ? 48 : 52, GX = mobile ? 8 : 14, GY = mobile ? 8 : 12, PAD = mobile ? 12 : 18;
  const width = cols * NW + (cols - 1) * GX + PAD * 2;
  const HEAD = mobile ? 40 : 46;
  let y = 10;
  const nodes = {};
  const chapters = subj.chapters.map(ch => {
    const rows = Math.ceil(ch.kps.length / cols);
    const h = HEAD + rows * (NH + GY) - GY + PAD;
    const c = { id: ch.id, name: ch.name, x: 8, y, w: width - 16, h, titleY: y + (mobile ? 26 : 29) };
    ch.kps.forEach((kp, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = c.x + PAD + col * (NW + GX);
      const ny = c.y + HEAD + row * (NH + GY);
      nodes[kp.id] = { kp, x, y: ny, w: NW, h: NH };
    });
    y += h + 14;
    return c;
  });
  const height = y + 6;

  const statusOf = id => g.stats[id]?.status || 'new';
  const maxChars = Math.max(6, Math.floor((NW - 22) / 12));
  const nodeTitle = s => s.length > maxChars ? s.slice(0, maxChars) + '…' : s;
  const edges = (g.kg.edges || []).filter(e => nodes[e.from] && nodes[e.to]);

  const edgeSvg = edges.map(e => {
    const a = nodes[e.from], b = nodes[e.to];
    let d;
    if (Math.abs(a.y - b.y) < 4) {
      const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
      d = `M${x1},${y1} C${x1 + 30},${y1} ${x2 - 30},${y2} ${x2},${y2}`;
    } else {
      const x1 = a.x + a.w / 2, y1 = a.y + a.h, x2 = b.x + b.w / 2, y2 = b.y;
      const my = Math.max(20, Math.abs(y2 - y1) * 0.45);
      d = `M${x1},${y1} C${x1},${y1 + my} ${x2},${y2 - my} ${x2},${y2}`;
    }
    return `<path class="kg-edge ${statusOf(e.from)}" d="${d}" marker-end="url(#arr)"/>`;
  }).join('');

  body.innerHTML = `<div class="kg-summary">
      <span>本科目正确率 <b>${summary && summary.attempts ? Math.round(summary.acc * 100) + '%' : '—'}</b></span>
      <span>已练 <b>${summary ? summary.practiced : 0}/${summary ? summary.total : 0}</b> 个知识点</span>
    </div>
    <div class="kg-legend">
      <span><i class="dot good"></i>已掌握</span><span><i class="dot mid"></i>待巩固</span>
      <span><i class="dot weak"></i>薄弱</span><span><i class="dot new"></i>未练习</span>
    </div>
    <div class="kg-wrap"><svg class="kg-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(subject)}知识图谱">
      <defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>
      ${chapters.map(c => `<g class="kg-chapter">
        <rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" rx="16"/>
        <text x="${c.x + 14}" y="${c.titleY}" class="kg-ch-title">${esc(c.name)}</text>
      </g>`).join('')}
      ${edgeSvg}
      ${Object.values(nodes).map(n => {
        const s = g.stats[n.kp.id];
        const st = s.status;
        const sub = s.attempts ? `${s.attempts} 题 · ${Math.round(s.acc * 100)}%` : '未练习';
        return `<g class="kg-node ${st}" data-kp="${esc(n.kp.id)}" tabindex="0" role="button" aria-label="${esc(n.kp.name)}">
          <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="11"/>
          <text x="${n.x + 10}" y="${n.y + 20}" class="kg-name">${esc(nodeTitle(n.kp.name))}</text>
          <text x="${n.x + 10}" y="${n.y + 37}" class="kg-sub">${sub}</text>
        </g>`;
      }).join('')}
    </svg></div>
    <div class="kg-tip">点击节点查看知识点详情与专项练习</div>`;

  $$('.kg-node', body).forEach(n => {
    n.onclick = () => openKpSheet(n.dataset.kp);
    n.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openKpSheet(n.dataset.kp); } };
  });
  // 自动滚动到薄弱节点
  const firstWeak = Object.values(nodes).find(n => statusOf(n.kp.id) === 'weak');
  if (firstWeak) setTimeout(() => {
    const el = body.querySelector(`.kg-node[data-kp="${firstWeak.kp.id}"]`);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 250);
}

function renderDiagnosis(diag, g) {
  const body = $('#kg-body');
  if (!diag.practiced) {
    body.innerHTML = emptyBox('还没有足够的作答数据。先刷几道题，AI 会从错题里推断你缺失的知识点。', `<button class="btn primary" onclick="location.hash='#/xzt'">去刷题</button>`);
    return;
  }
  const subjectName = id => g.index.subjectOfKp[id];
  const top = diag.gaps.slice(0, 5);
  const gapIds = top.map(x => x.id).join(',');

  body.innerHTML = `<div class="diag-summary">
      <div class="diag-ring">${ring(diag.practiced / Math.max(1, diag.totalKp) * 100, 66, `${diag.practiced}/${diag.totalKp}`)}</div>
      <div><b>已触达 ${diag.practiced} 个知识点</b><p class="small">共 ${diag.totalKp} 个；${diag.weak.length ? '发现 ' + diag.weak.length + ' 个薄弱点' : '暂无明显薄弱点，保持节奏'}</p></div>
    </div>
    ${top.length ? `<div class="section-title"><h2>疑似缺失的知识点</h2><span class="small">按先修关系推断</span></div>
      ${top.map((gap, i) => {        const s = g.stats[gap.id];
        const sources = gap.sources.filter(id => id !== gap.id).map(id => g.index.kpById[id]?.name).filter(Boolean).slice(0, 3);
        const reason = gap.kind === 'untested'
          ? `它在你的错题链上游，但还没有练习记录，基础可能不牢。`
          : sources.length
            ? `你在这条先修链上的掌握度偏低；受影响的知识点：${sources.join('、')}。`
            : `你在「${gap.name}」相关题目上反复出错，建议回看知识点本身。`;
        return `<div class="gap-card">
          <div class="gap-top"><span class="gap-rank">${i + 1}</span><div><b>${esc(gap.name)}</b>
            <div class="small">${esc(subjectName(gap.id))} · ${esc(g.index.chapterById[g.index.kpChapter[gap.id]]?.name || '')}</div></div>
            <span class="gap-score">${Math.round(Math.min(1, gap.score / 1.6) * 100)}</span></div>
          <p class="gap-reason">${esc(reason)}</p>
          <div class="bar thin"><i style="width:${Math.round(Math.min(1, gap.score / 1.6) * 100)}%"></i></div>
          <div class="act-row"><button class="btn small primary" data-drill="${esc(gap.id)}">去练习</button>
            <button class="btn small" data-kp="${esc(gap.id)}">查看知识点</button></div>
        </div>`;
      }).join('')}
      <button class="btn primary wide" id="diag-practice">${icon('spark')} 一键补齐前 ${top.length} 个短板</button>` : `<div class="panel" style="text-align:center">
        <p class="small" style="margin:0 0 10px">目前没有足够的薄弱证据。继续刷题，系统会自动从错题中找出知识缺口。</p>
        <button class="btn primary" id="diag-more">继续刷题</button></div>`}
    ${(() => {
      const rest = diag.weak.filter(s => !diag.gaps.some(gap => gap.id === s.id));
      return rest.length ? `<div class="section-title"><h2>其他薄弱点</h2></div>
      <div class="weak-list">${rest.map(s => `<button class="weak-item" data-kp="${esc(s.id)}">
        <span>${esc(g.index.kpById[s.id]?.name || s.id)}</span><span class="tag bad">${s.attempts ? Math.round(s.acc * 100) + '%' : '错题'}</span></button>`).join('')}</div>` : '';
    })()}
    <div class="kg-tip">诊断依据：错题 + 先修关系 + 掌握度。样本越多越准确。</div>`;

  $$('[data-drill]', body).forEach(b => b.onclick = () => startPractice(b.dataset.drill));
  $$('[data-kp]', body).forEach(b => b.onclick = () => openKpSheet(b.dataset.kp));
  const btn = $('#diag-practice');
  if (btn) btn.onclick = () => navigate('#/xzt?mix=' + encodeURIComponent(gapIds));
  const more = $('#diag-more');
  if (more) more.onclick = () => navigate('#/xzt');
}

/* =====================================================================
   我的 / 设置 / 题库更新
   ===================================================================== */
async function viewMe() {
  updateBadge();
  const app = $('#app');
  const p = store.getProgress();
  let done = 0, ok = 0;
  Object.values(p).forEach(secs => Object.values(secs).forEach(sp => Object.values(sp).forEach(x => { done++; if (x.ok) ok++; })));
  const ms = store.getMistakes().length;
  const cfg = store.getAI();
  let installed = { version: '—', isOverlay: false, qs: 0, bigq: 0 };
  try { installed = await sync.installedSummary(); } catch (e) {}
  const cfgOk = !!cfg.apiKey;
  const heat = monthHeatmap();

  app.innerHTML = pageHead('我的', '学习档案与本机设置') + `
    <div class="profile-card">
      <div class="avatar">学</div>
      <div class="profile-main"><h2>学习者</h2><p class="small">${done ? `已坚持 ${done} 道题` : '今天也要加油'} · ${new Date().getFullYear()} 学习记录</p></div>
      <div class="profile-acc">${done ? Math.round(ok / done * 100) + '%' : '—'}<span>正确率</span></div>
    </div>
    <div class="me-grid">
      <button class="me-item" data-go="#/ct">${icon('check')}<b>错题本</b><span id="me-mistake-count">${ms}</span></button>
      <button class="me-item" data-go="#/stats">${icon('chart')}<b>学习统计</b><span>趋势</span></button>
      <button class="me-item" data-go="#/kg">${icon('graph')}<b>知识图谱</b><span>诊断</span></button>
      <button class="me-item" data-go="#/ai">${icon('ai')}<b>AI 问答</b><span>${cfgOk ? '已配置' : '待配置'}</span></button>
    </div>

    <div class="heat-card">
      <div class="heat-head">
        <div><b>${heat.month} 月做题热力图</b><div class="small">共 ${heat.total} 题 · ${heat.active} 天有作答</div></div>
        <button class="link-btn" data-go="#/stats">查看统计</button>
      </div>
      <div class="heat-week">${'一二三四五六日'.split('').map(d => `<span>${d}</span>`).join('')}</div>
      <div class="heat-grid">${heat.cells}</div>
      <div class="heat-legend"><span class="small">少</span><i class="heat-mini l0"></i><i class="heat-mini l1"></i><i class="heat-mini l2"></i><i class="heat-mini l3"></i><i class="heat-mini l4"></i><span class="small">多</span></div>
    </div>

    <div class="menu-group">
      <div class="menu-title">题库</div>
      <button class="menu-row" data-go="#/sync"><span class="menu-ic">${icon('download')}</span><div><b>题库更新</b><small>${esc(shortVer(installed.version))} · ${installed.isOverlay ? '已同步' : '内置'} · ${installed.qs} 题</small></div>${icon('arrow')}</button>
      <button class="menu-row" data-go="#/settings"><span class="menu-ic">${icon('ai')}</span><div><b>AI 设置</b><small>${cfgOk ? esc(cfg.model) + ' · Key 已保存在本机' : '未配置 API Key'}</small></div>${icon('arrow')}</button>
    </div>
    <div class="menu-group">
      <div class="menu-title">更多</div>
      <button class="menu-row" id="install-app"><span class="menu-ic">${icon('download')}</span><div><b>安装到手机</b><small>主屏幕快捷方式 · 离线可用</small></div>${icon('arrow')}</button>
      <button class="menu-row" id="about-app"><span class="menu-ic">${icon('book')}</span><div><b>关于</b><small>数据来源与隐私说明</small></div>${icon('arrow')}</button>
      <button class="menu-row" data-go="#/settings"><span class="menu-ic">${icon('gear')}</span><div><b>清除与重置</b><small>进度、错题、AI 记录</small></div>${icon('arrow')}</button>
    </div>
    <p class="foot-note">${APP_VERSION} · 作者 wwl · 题库 ${esc(shortVer(installed.version))}</p>`;

  $$('[data-go]').forEach(b => b.onclick = () => navigate(b.dataset.go));
  $('#install-app').onclick = async () => {
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
      toast('当前已在安卓 App 中运行');
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    } else if (window.matchMedia('(display-mode: standalone)').matches) {
      toast('已经在独立 App 模式中运行');
    } else {
      sheet(`<div class="sheet-head"><h2>安装到手机</h2><button class="icon-btn" data-close>${icon('close')}</button></div>
        <div class="sheet-sec"><p>iPhone / iPad：Safari 打开本页 → 分享 → 「添加到主屏幕」。</p>
        <p>Android：Chrome 打开本页 → 右上角菜单 → 「安装应用」或「添加到主屏幕」。</p>
        <p class="small">安装后可以全屏运行，并在离线时使用已缓存的题库。</p></div>`);
    }
  };
  $('#about-app').onclick = () => sheet(`<div class="sheet-head"><h2>关于题库练习</h2><button class="icon-btn" data-close>${icon('close')}</button></div>
    <div class="sheet-sec"><p>题库由教材扫描 OCR 整理，仅供个人学习使用。</p>
    <p>知识图谱依据课程考试范围整理，共 129 个知识点与先修关系；错题诊断完全在本机计算。</p>
    <p><b>作者：</b>wwl</p>
    <p><b>隐私：</b>作答记录、错题、AI API Key 均保存在本机浏览器，不会上传。AI 请求只发送到你配置的服务商。</p>
    <p class="small">${APP_VERSION} · 支持 PWA / Android</p></div>`);
}

async function viewSettings() {
  const app = $('#app');
  const cfg = store.getAI();
  const presets = [
    ['deepseek', 'DeepSeek', 'https://api.deepseek.com/v1', 'deepseek-chat'],
    ['openai', 'OpenAI', 'https://api.openai.com/v1', 'gpt-4o-mini'],
    ['moonshot', 'Kimi / Moonshot', 'https://api.moonshot.cn/v1', 'moonshot-v1-8k'],
    ['zhipu', '智谱 GLM', 'https://open.bigmodel.cn/api/paas/v4', 'glm-4-flash'],
    ['qwen', '通义千问', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'qwen-plus'],
    ['ollama', 'Ollama 本地', 'http://localhost:11434/v1', 'llama3.1'],
    ['custom', '自定义', '', ''],
  ];
  const current = presets.find(p => p[2] && cfg.baseUrl.replace(/\/+$/, '') === p[2].replace(/\/+$/, '')) || presets[6];
  let keyVisible = false;

  const answerMode = store.getAnswerMode();
  app.innerHTML = pageHead('设置', '答题模式、AI 服务与题库同步') + `
    <div class="panel">
      <div class="panel-head"><h3>${icon('quiz')} 答题设置</h3><span class="tag">${answerMode === 'section' ? '统一判分' : '即时判分'}</span></div>
      <p class="small">两种模式都不需要点击“提交答案”。</p>
      <div class="mode-cards">
        <button class="mode-card ${answerMode === 'instant' ? 'on' : ''}" data-mode="instant">
          <b>即时判分</b><span>点击选项后立即判断对错并显示解析，适合边做边学。</span>
        </button>
        <button class="mode-card ${answerMode === 'section' ? 'on' : ''}" data-mode="section">
          <b>小节统一判分</b><span>点击选项自动进入下一题，做完本节后统一显示对错与结果。</span>
        </button>
      </div>
      <p class="small" style="margin:8px 0 0">多选题/填空题会显示「确认」按钮；专项练习固定为即时判分。</p>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>${icon('ai')} AI 服务</h3><span class="tag ${cfg.apiKey ? 'ok' : ''}">${cfg.apiKey ? '已配置' : '未配置'}</span></div>
      <p class="small">使用 OpenAI 兼容接口。常用服务商可一键预设，也可以填任意兼容地址。</p>
      <label class="field"><span>服务商</span><select id="ai-preset">${presets.map(p => `<option value="${p[0]}" ${p[0] === current[0] ? 'selected' : ''}>${p[1]}</option>`).join('')}</select></label>
      <label class="field"><span>Base URL</span><input type="url" id="ai-base" value="${esc(cfg.baseUrl)}" placeholder="https://api.deepseek.com/v1" autocomplete="off"></label>
      <label class="field"><span>模型</span><input type="text" id="ai-model" value="${esc(cfg.model)}" placeholder="deepseek-chat" autocomplete="off"></label>
      <label class="field"><span>API Key</span><div class="key-row"><input type="password" id="ai-key" value="${esc(cfg.apiKey)}" placeholder="sk-..." autocomplete="off" spellcheck="false"><button class="btn small" id="toggle-key">显示</button></div></label>
      <label class="field"><span>温度 ${''}<small>0 更严谨，1 更发散</small></span><input type="range" id="ai-temp" min="0" max="1" step="0.1" value="${cfg.temperature}"><output id="temp-val">${cfg.temperature}</output></label>
      <div class="warn-box soft">${icon('check')}<div><b>Key 只保存在本机</b><p>存放在浏览器 localStorage，不会上传到本站；仅在你发起请求时发送给你填写的服务商。公共设备请用完清除。</p></div></div>
      <div class="act-row"><button class="btn primary" id="save-ai">保存</button><button class="btn" id="test-ai">测试连接</button></div>
      <div id="ai-test-result" class="test-result"></div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>${icon('download')} 题库同步</h3></div>
      <p class="small">题库数据从 GitHub 仓库的 data/ 目录读取；同步后覆盖本机内置题库，可随时恢复。</p>
      <label class="field"><span>GitHub 仓库</span><input type="text" id="sync-repo" value="${esc(cfg.repo)}" placeholder="owner/repo" autocomplete="off"></label>
      <label class="field"><span>分支</span><input type="text" id="sync-branch" value="${esc(cfg.branch)}" placeholder="main" autocomplete="off"></label>
      <label class="field"><span>加速前缀（可选）</span><input type="url" id="sync-prefix" value="${esc(cfg.rawPrefix)}" placeholder="https://ghproxy.net/" autocomplete="off"></label>
      <label class="switch-row"><span>启动时自动检查更新<small>每 24 小时最多一次</small></span><input type="checkbox" id="auto-check" ${cfg.autoCheck ? 'checked' : ''}></label>
      <div class="act-row"><button class="btn primary" id="save-sync">保存同步设置</button><button class="btn" id="go-sync">打开题库更新</button></div>
    </div>

    <div class="panel">
      <div class="panel-head"><h3>${icon('trash')} 数据管理</h3></div>
      <div class="menu-list">
        <button class="menu-row danger-text" id="clear-progress"><div><b>清除作答进度</b><small>${''}保留错题与设置</small></div>${icon('arrow')}</button>
        <button class="menu-row danger-text" id="clear-mistakes"><div><b>清空错题本</b><small>删除全部错题记录</small></div>${icon('arrow')}</button>
        <button class="menu-row danger-text" id="clear-ai"><div><b>清除 AI 对话与解析缓存</b><small>不影响 API Key</small></div>${icon('arrow')}</button>
        <button class="menu-row danger-text" id="clear-all"><div><b>恢复内置题库</b><small>移除 GitHub 同步覆盖</small></div>${icon('arrow')}</button>
      </div>
    </div>
    <p class="foot-note">${APP_VERSION} · 设置仅保存在本机</p>`;

  const saveAI = () => {
    store.setAI({
      baseUrl: $('#ai-base').value.trim(),
      model: $('#ai-model').value.trim(),
      apiKey: $('#ai-key').value.trim(),
      temperature: Number($('#ai-temp').value),
    });
    toast('AI 设置已保存');
  };
  $('#ai-preset').onchange = () => {
    const p = presets.find(x => x[0] === $('#ai-preset').value);
    if (p && p[2]) { $('#ai-base').value = p[2]; $('#ai-model').value = p[3]; }
  };
  $('#toggle-key').onclick = () => {
    keyVisible = !keyVisible;
    $('#ai-key').type = keyVisible ? 'text' : 'password';
    $('#toggle-key').textContent = keyVisible ? '隐藏' : '显示';
  };
  $('#ai-temp').oninput = () => { $('#temp-val').textContent = $('#ai-temp').value; };
  $('#save-ai').onclick = saveAI;
  $('#test-ai').onclick = async () => {
    saveAI();
    const out = $('#ai-test-result');
    out.className = 'test-result';
    out.textContent = '正在测试…';
    try {
      const { testConnection } = await import('./ai.js');
      const r = await testConnection();
      out.className = 'test-result ok';
      out.textContent = '✅ 连接成功：' + r;
    } catch (e) {
      out.className = 'test-result bad';
      out.textContent = '❌ ' + e.message;
    }
  };
  $('#save-sync').onclick = () => {
    store.setAI({ repo: $('#sync-repo').value.trim() || 'WangLing1206/408-quiz', branch: $('#sync-branch').value.trim() || 'main', rawPrefix: $('#sync-prefix').value.trim(), autoCheck: $('#auto-check').checked });
    resetMem(); dropKGCache();
    toast('同步设置已保存');
  };
  $('#go-sync').onclick = () => navigate('#/sync');
  $$('.mode-card').forEach(b => b.onclick = () => {
    store.setAnswerMode(b.dataset.mode);
    $$('.mode-card').forEach(x => x.classList.toggle('on', x === b));
    const tag = $('.panel-head .tag');
    if (tag) tag.textContent = b.dataset.mode === 'section' ? '统一判分' : '即时判分';
    toast(b.dataset.mode === 'section' ? '已切换为小节统一判分' : '已切换为即时判分');
  });
  $('#clear-progress').onclick = async () => {
    if (await confirmDialog('清除作答进度', '将删除所有科目/章节的作答记录，错题本保留。', '清除')) {
      store.setProgress({}); toast('已清除进度');
    }
  };
  $('#clear-mistakes').onclick = async () => {
    if (await confirmDialog('清空错题本', '删除全部错题记录。', '清空')) { store.setMistakes([]); updateBadge(); toast('已清空'); }
  };
  $('#clear-ai').onclick = async () => {
    if (await confirmDialog('清除 AI 记录', '将删除本机 AI 对话与错题解析缓存，API Key 保留。', '清除')) {
      store.clearChat(); store.clearAnalyses(); toast('已清除 AI 记录');
    }
  };
  $('#clear-all').onclick = async () => {
    if (await confirmDialog('恢复内置题库', '将移除从 GitHub 同步的覆盖题库与知识图谱，恢复为随 App 发布的内置版本。作答进度不受影响。', '恢复')) {
      await sync.restoreBundled();
      dropKGCache();
      toast('已恢复内置题库');
      setTimeout(() => location.reload(), 600);
    }
  };
}

async function viewSync() {
  const app = $('#app');
  app.innerHTML = pageHead('题库更新', '从 GitHub 仓库同步最新题目与知识点') + skeleton(2);
  let summary;
  try { summary = await sync.installedSummary(); } catch (e) { summary = null; }
  const cfg = store.getAI();

  app.innerHTML = pageHead('题库更新', '从 GitHub 仓库同步最新题目与知识点') + `
    <div class="panel bank-card">
      <div class="bank-version">
        ${ring(100, 58, '题库')}
        <div><div class="small">当前题库版本</div><h2>${esc(shortVer(summary?.version))}</h2>
          <div class="small">${summary?.isOverlay ? '已从 GitHub 同步' : '随 App 内置'}${summary?.generatedAt ? ' · ' + fmtDateOnly(summary.generatedAt) : ''} · ${summary?.qs || 0} 选择题 / ${summary?.bigq || 0} 大题</div></div>
      </div>
      <div class="bank-meta">
        <div><span>仓库</span><b>${esc(cfg.repo)}</b></div>
        <div><span>分支</span><b>${esc(cfg.branch)}</b></div>
        <div><span>上次检查</span><b>${summary?.checkedAt ? fmtDate(summary.checkedAt) : '从未'}</b></div>
        <div><span>上次更新</span><b>${summary?.appliedAt ? fmtDate(summary.appliedAt) : '—'}</b></div>
      </div>
      <div class="act-row"><button class="btn primary" id="check-update">${icon('download')} 检查更新</button>
        <button class="btn" id="sync-settings">修改仓库</button></div>
      <div id="sync-status"></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h3>同步说明</h3></div>
      <ul class="tips">
        <li>更新源为仓库的 <code>main</code> 分支下 <code>data/bank.json</code> 清单与各科题库 JSON。</li>
        <li>下载后会校验题目数量，通过后才写入本机；同步失败不会破坏现有题库。</li>
        <li>国内网络访问 GitHub 较慢时，可在设置中填写加速前缀（如 <code>https://ghproxy.net/</code>）。</li>
        <li>同步的题库保存在浏览器 IndexedDB，可随时恢复内置版本。</li>
        <li>新增题目的配图若本地不存在，会自动从 GitHub 加载。</li>
      </ul>
      <div class="act-row"><button class="btn" id="restore-inner">恢复内置题库</button></div>
    </div>`;

  $('#sync-settings').onclick = () => navigate('#/settings');
  $('#restore-inner').onclick = async () => {
    if (await confirmDialog('恢复内置题库', '移除本机同步覆盖，恢复随 App 发布的题库。', '恢复')) {
      await sync.restoreBundled(); dropKGCache(); toast('已恢复内置题库'); setTimeout(() => location.reload(), 500);
    }
  };
  $('#check-update').onclick = async () => {
    const status = $('#sync-status');
    status.innerHTML = `<div class="sync-progress"><div class="spinner-row"><span class="spin"></span> 正在连接 GitHub…</div></div>`;
    try {
      const r = await sync.checkUpdates(store.getAI());
      const st = store.getSyncState();
      store.setSyncState({ ...st, checkedAt: Date.now() });
      if (!r.available) {
        status.innerHTML = `<div class="test-result ok">✅ 已是最新版本（${esc(r.remote.version)}）</div>`;
        setUpdateHint(false);
        return;
      }
      setUpdateHint(true);
      const rows = r.changes.length
        ? r.changes.map(c => `<li><b>${esc(c.name)}</b> ${c.meta.qs != null ? `· ${c.meta.qs} 选择题 / ${c.meta.bigq} 大题` : ''}</li>`).join('')
        : '<li>知识图谱与题型标注更新</li>';
      status.innerHTML = `<div class="update-found">
        <div class="update-head"><span class="tag warn">发现更新</span><b>${esc(r.remote.version)}</b></div>
        <ul class="tips">${rows}</ul>
        <div class="act-row"><button class="btn primary" id="do-sync">立即同步</button>
          <button class="btn" id="cancel-sync">稍后</button></div>
        <div class="sync-progress" id="progress"></div>
      </div>`;
      $('#cancel-sync').onclick = () => { status.innerHTML = ''; };
      $('#do-sync').onclick = async () => {
        const prog = $('#progress');
        prog.innerHTML = `<div class="bar"><i style="width:2%"></i></div><div class="small" id="prog-label">准备下载…</div>`;
        $('#do-sync').disabled = true;
        try {
          await sync.applyUpdate(r.remote, r.changes, store.getAI(), ({ step, total, label }) => {
            prog.querySelector('.bar i').style.width = Math.round(step / total * 100) + '%';
            $('#prog-label').textContent = `${label}（${step}/${total}）`;
          });
          dropKGCache();
          prog.innerHTML = `<div class="test-result ok">✅ 同步完成，正在刷新…</div>`;
          setTimeout(() => location.reload(), 800);
        } catch (e) {
          prog.innerHTML = `<div class="test-result bad">❌ 同步失败：${esc(e.message)}<br><span class="small">现有题库未受影响，可稍后重试。</span></div>`;
          $('#do-sync').disabled = false;
        }
      };
    } catch (e) {
      status.innerHTML = `<div class="test-result bad">❌ 检查失败：${esc(e.message)}<br>
        <span class="small">请确认网络可访问 GitHub，或在设置中配置镜像前缀。</span></div>`;
    }
  };
}

/* =====================================================================
   启动
   ===================================================================== */
function registerRoutes() {
  route('', viewHome);
  route('xzt', viewXzt);
  route('dt', viewDt);
  route('ct', viewCt);
  route('stats', viewStats);
  route('kg', viewKg);
  route('ai', viewAi);
  route('me', viewMe);
  route('settings', viewSettings);
  route('sync', viewSync);
}

async function autoCheck() {
  const cfg = store.getAI();
  if (!cfg.autoCheck || !navigator.onLine) return;
  const st = store.getSyncState();
  if (Date.now() - (st.checkedAt || 0) < 86400000) return;
  try {
    const r = await sync.checkUpdates(cfg);
    store.setSyncState({ ...st, checkedAt: Date.now() });
    if (r.available) {
      setUpdateHint(true);
      setTimeout(() => toast(`发现题库更新 ${r.remote.version}，可在「我的 → 题库更新」同步`), 1500);
    }
  } catch (e) { /* 后台静默失败 */ }
}

function initLaunch() {
  const el = $('#launch');
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    el.classList.add('launch-out');
    document.body.classList.remove('launching');
    setTimeout(() => el.remove(), 560);
  };
  const nativeWv = /; wv\)/.test(navigator.userAgent)
    || !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  try {
    if (!nativeWv && sessionStorage.getItem('q408.launched') === '1') {
      el.remove(); document.body.classList.remove('launching'); return;
    }
    sessionStorage.setItem('q408.launched', '1');
  } catch (e) { /* ignore */ }
  const video = $('#launchVideo');
  if (reduce) {
    if (video) { video.removeAttribute('autoplay'); try { video.pause(); } catch (e) {} }
    setTimeout(finish, 700);
    return;
  }
  document.body.classList.add('launching');
  if (video) {
    video.muted = true;
    video.addEventListener('ended', finish, { once: true });
    video.addEventListener('error', () => setTimeout(finish, 700), { once: true });
    const play = video.play();
    if (play && play.catch) play.catch(() => setTimeout(finish, 1200));
  }
  setTimeout(finish, 3400);
}

function registerPWA() {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
  const native = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  if (!native && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) toast('新版本已就绪，重新打开后生效');
        });
      });
    }).catch(() => {});
  }
  window.addEventListener('offline', () => toast('当前离线，已缓存的题库仍可使用'));
}

/* 安卓物理返回键：关弹层 → 退出当前题目 → 返回上一页 → 退出 App */
function setupNativeBack() {
  const Cap = window.Capacitor;
  const App = Cap && Cap.Plugins && Cap.Plugins.App;
  if (!Cap || typeof Cap.isNativePlatform !== 'function' || !Cap.isNativePlatform() || !App) return;
  App.addListener('backButton', ({ canGoBack }) => {
    const modal = $('#modal');
    if (modal && !modal.classList.contains('hidden')) {
      modal.classList.add('hidden'); modal.innerHTML = ''; modal.onclick = null;
      return;
    }
    if (S.xzt.num != null && currentPath() === 'xzt') {
      if (S.practice) { S.xzt.num = null; viewXzt(); return; }
      if (S.xzt.subject && S.xzt.sec) {
        S.xzt.num = null;
        navigate(qHash(S.xzt.subject, S.xzt.sec));
        return;
      }
    }
    if (currentPath()) {
      if (canGoBack) history.back(); else navigate('#/');
    } else {
      App.exitApp();
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  registerRoutes();
  initLaunch();
  updateBadge();
  startRouter();
  registerPWA();
  setupNativeBack();
  const st = store.getLast();
  if (st && st.subject && !S.xzt.subject) S.xzt.subject = st.subject;
  setTimeout(autoCheck, 4000);
});

// 调试入口（避免全局污染）
window.__q408 = { reset: () => { dropKGCache(); resetMem(); }, state: S, store };
