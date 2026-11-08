'use strict';
/* 题库加载：内置 data/*.json + IndexedDB 中的 GitHub 同步覆盖层 */

import { idbGet, idbSet, idbDelete, idbClear, esc } from './core.js';
import { getAI, getSyncState } from './store.js';

export const SUBJECTS = ['数据结构', '操作系统', '计组', '计网'];
const mem = { banks: {}, kg: null, manifest: null, failures: {} };

export function bankKey(subject) { return 'bank:' + subject; }
export function kgKey() { return 'kg'; }

const ALIASES = { '计组': '计算机组成原理', '计网': '计算机网络' };
function checkBank(d, name) {
  if (!d || typeof d !== 'object') throw new Error('题库数据格式无效');
  if (!d.sections || typeof d.sections !== 'object') throw new Error('题库缺少 sections 字段');
  if (d.name && d.name !== name && d.name !== ALIASES[name]) throw new Error(`题库科目不匹配：期望 ${name}，实际 ${d.name}`);
  for (const [sec, v] of Object.entries(d.sections)) {
    if (!v || !Array.isArray(v.qs) || !Array.isArray(v.bigq)) throw new Error(`章节 ${sec} 结构无效`);
  }
  const display = d.name || ALIASES[name] || name;
  d.name = name;
  d.displayName = display;
  return d;
}

export async function loadBank(subject) {
  if (mem.banks[subject]) return mem.banks[subject];
  if (mem.failures[subject]) throw mem.failures[subject];
  try {
    let overlay = null;
    try { overlay = await idbGet(bankKey(subject)); } catch (e) { /* IDB 不可用时忽略 */ }
    if (overlay && overlay.data) {
      try {
        const data = checkBank(overlay.data, subject);
        data._source = 'sync';
        data._sha = overlay.sha || '';
        mem.banks[subject] = data;
        return data;
      } catch (e) {
        // 同步数据损坏时回退到内置题库，避免整科不可用
        try { await idbDelete(bankKey(subject)); } catch (err) { /* ignore */ }
      }
    }
    const res = await fetch('data/' + encodeURIComponent(subject) + '.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('加载失败 HTTP ' + res.status);
    const data = checkBank(await res.json(), subject);
    data._source = 'builtin';
    mem.banks[subject] = data;
    return data;
  } catch (e) {
    mem.failures[subject] = e;
    throw e;
  }
}

export function peekBank(subject) { return mem.banks[subject] || null; }

export async function loadAllBanks() {
  return Promise.all(SUBJECTS.map(loadBank));
}

export async function loadKG() {
  if (mem.kg) return mem.kg;
  let kg = null;
  try {
    const overlay = await idbGet(kgKey());
    if (overlay && overlay.data && overlay.data.subjects) kg = overlay.data;
  } catch (e) { /* ignore */ }
  if (!kg) {
    const res = await fetch('data/kg.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('知识图谱加载失败 HTTP ' + res.status);
    kg = await res.json();
  }
  if (!kg || !Array.isArray(kg.subjects)) throw new Error('知识图谱数据无效');
  mem.kg = kg;
  return kg;
}

export async function loadManifest() {
  if (mem.manifest) return mem.manifest;
  try {
    const res = await fetch('data/bank.json', { cache: 'no-cache' });
    if (res.ok) mem.manifest = await res.json();
  } catch (e) { /* ignore */ }
  mem.manifest = mem.manifest || { schema: 1, version: '内置', files: {} };
  return mem.manifest;
}

export function resetMem() {
  mem.banks = {}; mem.kg = null; mem.manifest = null; mem.failures = {};
}

export async function clearOverlay() {
  await idbClear();
  resetMem();
}

/** 原始文件地址（支持自定义加速前缀） */
export function rawUrl(path, cfg) {
  const c = cfg || getAI();
  const direct = `https://raw.githubusercontent.com/${(c.repo || 'WangLing1206/408-quiz').trim()}/${(c.branch || 'main').trim()}/${path.replace(/^\/+/, '')}`;
  const prefix = (c.rawPrefix || '').trim();
  if (!prefix) return direct;
  return prefix.replace(/\/+$/, '') + '/' + direct;
}

/** 图片地址：先用本地，加载失败回退到 GitHub 仓库（同步新增题目的配图） */
export function figure(rel, cls) {
  if (!rel) return '';
  const local = 'data/' + encodeURI(rel);
  const remote = rawUrl('data/' + rel);
  return `<img class="fig ${cls || ''}" src="${esc(local)}" data-remote="${esc(remote)}" alt="题目配图" loading="lazy" onload="if(this.naturalHeight<64&&this.naturalWidth/(this.naturalHeight||1)>12)this.classList.add('fig-noise')" onerror="if(!this.dataset.fb){this.dataset.fb=1;this.src=this.dataset.remote}else{this.classList.add('fig-broken')}">`;
}

export function installedFileShas() {
  return (getSyncState().files) || {};
}

export async function saveBank(subject, data, sha, version) {
  await idbSet(bankKey(subject), { data, sha, version, savedAt: Date.now() });
}

export async function saveKGData(kg) {
  await idbSet(kgKey(), { data: kg, savedAt: Date.now() });
}

export function bankCounts(d) {
  let qs = 0, bigq = 0;
  Object.values(d.sections || {}).forEach(v => { qs += (v.qs || []).length; bigq += (v.bigq || []).length; });
  return { qs, bigq };
}
