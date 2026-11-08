'use strict';
/* 本地数据模型：进度、错题、AI 设置、对话、解析缓存、同步状态 */

import { lsGet, lsSet, lsDel } from './core.js';

export const K = {
  progress: 'q408.progress.v1',
  mistakes: 'q408.mistakes.v1',
  ai: 'q408.ai.v1',
  chat: 'q408.chat.v1',
  analysis: 'q408.aiAnalysis.v1',
  last: 'q408.last.v1',
  sync: 'q408.sync.v1',
  activity: 'q408.activity.v1',
};

/* ---------- 进度 ---------- */
export const getProgress = () => lsGet(K.progress, {});
export const setProgress = p => lsSet(K.progress, p);

export function recordAnswer(subject, sec, num, mine, ok) {
  const p = getProgress();
  if (!p[subject]) p[subject] = {};
  if (!p[subject][sec]) p[subject][sec] = {};
  const prev = p[subject][sec][num] || {};
  const n = (prev.n || 0) + 1;
  const okN = (prev.okN || 0) + (ok ? 1 : 0);
  p[subject][sec][num] = { mine, ok, ts: Date.now(), n, okN };
  setProgress(p);
  return p;
}

/** 清除单题作答（用于“重做本题”），不动错题记录与热力图 */
export function clearAnswer(subject, sec, num) {
  const p = getProgress();
  if (p[subject] && p[subject][sec]) {
    delete p[subject][sec][num];
    if (!Object.keys(p[subject][sec]).length) delete p[subject][sec];
    if (!Object.keys(p[subject]).length) delete p[subject];
    setProgress(p);
  }
}

/** 清除整章作答与本章错题（热力图使用记录保留） */
export function clearSection(subject, sec) {
  const p = getProgress();
  if (p[subject]) {
    delete p[subject][sec];
    if (!Object.keys(p[subject]).length) delete p[subject];
    setProgress(p);
  }
  setMistakes(getMistakes().filter(m => !(m.subject === subject && m.sec === sec)));
}

/* ---------- 错题本 ---------- */
export const getMistakes = () => lsGet(K.mistakes, []);
export function setMistakes(m) { lsSet(K.mistakes, m); }
export function upsertMistake(m) {
  const ms = getMistakes().filter(x => !(x.subject === m.subject && x.sec === m.sec && x.num === m.num));
  ms.push({ ...m, ts: Date.now() });
  setMistakes(ms);
}
export function removeMistake(subject, sec, num) {
  setMistakes(getMistakes().filter(x => !(x.subject === subject && x.sec === sec && x.num === num)));
}

/* ---------- 活动记录 ---------- */
const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export function logActivity(n = 1) {
  const a = lsGet(K.activity, {});
  const k = dayKey(Date.now());
  a[k] = (a[k] || 0) + n;
  lsSet(K.activity, a);
}
export function activitySeries(days = 7) {
  const a = lsGet(K.activity, {});
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    out.push({ key: dayKey(d.getTime()), count: a[dayKey(d.getTime())] || 0, label: `${d.getMonth() + 1}/${d.getDate()}` });
  }
  return out;
}
export function getActivityLog() { return lsGet(K.activity, {}); }

/* ---------- AI 设置 ---------- */
export const AI_DEFAULTS = {
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  apiKey: '',
  temperature: 0.4,
  system: '你是计算机专业基础课程辅导老师，讲解准确、简洁，先给结论再给推理过程。',
  repo: 'WangLing1206/408-quiz',
  branch: 'main',
  rawPrefix: '',
  autoCheck: true,
  stream: true,
};
export function getAI() { return { ...AI_DEFAULTS, ...lsGet(K.ai, {}) }; }
export function setAI(patch) { const s = { ...getAI(), ...patch }; lsSet(K.ai, s); return s; }
export function hasKey() { return !!(getAI().apiKey || '').trim(); }

/* ---------- 对话 ---------- */
export function getChat() { return lsGet(K.chat, { messages: [] }); }
export function setChat(c) { lsSet(K.chat, { ...c, updated: Date.now() }); }
export function clearChat() { lsDel(K.chat); }

/* ---------- 解析缓存 ---------- */
export const analysisKey = (subject, sec, num) => `${subject}|${sec}|${num}`;
export function getAnalysis(subject, sec, num) {
  const all = lsGet(K.analysis, {});
  return all[analysisKey(subject, sec, num)] || null;
}
export function saveAnalysis(subject, sec, num, text, model) {
  const all = lsGet(K.analysis, {});
  all[analysisKey(subject, sec, num)] = { text, model, ts: Date.now() };
  // 最多保留 300 条
  const keys = Object.keys(all);
  if (keys.length > 300) {
    keys.sort((a, b) => (all[a].ts || 0) - (all[b].ts || 0));
    keys.slice(0, keys.length - 300).forEach(k => delete all[k]);
  }
  lsSet(K.analysis, all);
}
export function clearAnalyses() { lsDel(K.analysis); }
export function deleteAnalysis(subject, sec, num) {
  const all = lsGet(K.analysis, {});
  delete all[analysisKey(subject, sec, num)];
  lsSet(K.analysis, all);
}

/* ---------- 同步状态 ---------- */
export function getSyncState() { return lsGet(K.sync, { version: '', files: {}, checkedAt: 0, appliedAt: 0 }); }
export function setSyncState(s) { lsSet(K.sync, s); }


/* ---------- 答题模式 ---------- */
export const ANSWER_MODE_KEY = 'q408.answerMode.v1';
export function getAnswerMode() {
  return lsGet(ANSWER_MODE_KEY, 'instant') === 'section' ? 'section' : 'instant';
}
export function setAnswerMode(mode) {
  lsSet(ANSWER_MODE_KEY, mode === 'section' ? 'section' : 'instant');
}

/* ---------- 上次位置 ---------- */
export function getLast() { return lsGet(K.last, null); }
export function setLast(v) { lsSet(K.last, { ...v, ts: Date.now() }); }
