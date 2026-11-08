'use strict';
/* 题库在线更新：从 GitHub 仓库读取 bank.json 清单，下载有变化的科目并写入 IndexedDB */

import { rawUrl, loadManifest, saveBank, saveKGData, resetMem, clearOverlay, bankKey, kgKey } from './bank.js';
import { getAI, getSyncState, setSyncState } from './store.js';
import { idbGet } from './core.js';

const SUBJECT_FILES = ['数据结构.json', '操作系统.json', '计组.json', '计网.json'];

async function fetchJSON(url, timeout = 20000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally { clearTimeout(timer); }
}

export async function remoteManifest(cfg) {
  const url = rawUrl('data/bank.json', cfg) + '?t=' + Date.now();
  const j = await fetchJSON(url);
  if (!j || !j.files || !j.version) throw new Error('远端清单格式无效');
  return j;
}

function validateBankFile(name, data, meta) {
  if (!data || !data.sections) throw new Error(name + ' 结构无效');
  const key = name.replace(/\.json$/, '');
  const aliases = { '计组': '计算机组成原理', '计网': '计算机网络' };
  if (data.name && data.name !== key && data.name !== aliases[key]) throw new Error(name + ' 科目名称不匹配');
  let qs = 0, bigq = 0;
  Object.values(data.sections).forEach(v => {
    if (!Array.isArray(v.qs) || !Array.isArray(v.bigq)) throw new Error(name + ' 章节结构无效');
    qs += v.qs.length; bigq += v.bigq.length;
  });
  if (meta) {
    if (meta.qs != null && meta.qs !== qs) throw new Error(`${name} 选择题数量校验失败（远端 ${meta.qs} / 下载 ${qs}）`);
    if (meta.bigq != null && meta.bigq !== bigq) throw new Error(`${name} 大题数量校验失败（远端 ${meta.bigq} / 下载 ${bigq}）`);
  }
  return data;
}

/** 检查更新；返回 { available, remote, localVersion, changes: [{name, sha, meta}] } */
export async function checkUpdates(cfg) {
  const c = cfg || getAI();
  const remote = await remoteManifest(c);
  const localManifest = await loadManifest();
  const state = getSyncState();
  const localVersion = state.version || localManifest.version || '内置';
  const localFiles = Object.keys(state.files || {}).length ? state.files : (localManifest.files || {});
  const changes = [];
  Object.entries(remote.files || {}).forEach(([name, meta]) => {
    const local = localFiles[name];
    if (!local || local.sha256 !== meta.sha256) changes.push({ name, sha: meta.sha256, meta });
  });
  // 知识图谱随版本更新
  const kgChanged = remote.version !== localVersion;
  return { available: remote.version !== localVersion, remote, localVersion, changes, kgChanged };
}

/**
 * 应用更新：先全部下载校验，成功后再原子写入，避免半途失败留下坏题库。
 * onProgress({step, total, label})
 */
export async function applyUpdate(remote, changes, cfg, onProgress) {
  const c = cfg || getAI();
  const stage = [];
  let i = 0;
  const total = changes.length + 1;
  const tick = label => { i++; if (onProgress) onProgress({ step: i, total, label }); };

  for (const ch of changes) {
    tick('下载 ' + ch.name);
    const url = rawUrl('data/' + ch.name, c) + '?t=' + Date.now();
    const data = await fetchJSON(url, 45000);
    validateBankFile(ch.name, data, ch.meta);
    stage.push({ key: 'bank', name: ch.name.replace(/\.json$/, ''), data, sha: ch.sha });
  }

  tick('下载知识图谱');
  const kgUrl = rawUrl('data/kg.json', c) + '?t=' + Date.now();
  const kg = await fetchJSON(kgUrl, 45000);
  if (!kg || !Array.isArray(kg.subjects) || !kg.tags) throw new Error('知识图谱数据无效');
  stage.push({ key: 'kg', data: kg, sha: remote.kg ? remote.kg.sha256 : '' });

  // 全部校验通过后再写入
  for (const s of stage) {
    if (s.key === 'bank') await saveBank(s.name, s.data, s.sha, remote.version);
    else await saveKGData(s.data);
  }
  const files = { ...(getSyncState().files || {}) };
  Object.entries(remote.files || {}).forEach(([name, meta]) => { files[name] = { sha256: meta.sha256, qs: meta.qs, bigq: meta.bigq }; });
  setSyncState({ version: remote.version, files, appliedAt: Date.now(), checkedAt: Date.now(), generatedAt: remote.generatedAt || '', source: c.repo + '@' + c.branch });
  resetMem();
  return { version: remote.version, files };
}

export async function restoreBundled() {
  await clearOverlay();
  setSyncState({ version: '', files: {}, appliedAt: 0, checkedAt: 0 });
  resetMem();
}

export async function installedSummary() {
  const state = getSyncState();
  const localManifest = await loadManifest();
  const files = Object.keys(state.files || {}).length ? state.files : (localManifest.files || {});
  let qs = 0, bigq = 0;
  Object.values(files).forEach(f => { qs += f.qs || 0; bigq += f.bigq || 0; });
  let overlayBytes = 0, overlayCount = 0;
  for (const name of SUBJECT_FILES.map(n => n.replace(/\.json$/, ''))) {
    const v = await idbGet(bankKey(name));
    if (v) { overlayCount++; overlayBytes += JSON.stringify(v.data).length; }
  }
  const kg = await idbGet(kgKey());
  return {
    version: state.version || localManifest.version || '内置',
    generatedAt: state.generatedAt || localManifest.generatedAt || '',
    isOverlay: overlayCount > 0,
    appliedAt: state.appliedAt || 0,
    checkedAt: state.checkedAt || 0,
    qs, bigq, overlayCount, overlayBytes, kgOverlay: !!kg,
  };
}
