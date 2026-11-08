'use strict';
/* 知识图谱计算：掌握度、薄弱点诊断、先修链条推断 */

import { getProgress, getMistakes } from './store.js';

export function buildIndex(kg) {
  const kpById = {}, chapterById = {}, kpChapter = {}, subjectOfKp = {};
  const dependents = {};
  const chaptersOf = {};
  kg.subjects.forEach(subj => {
    chaptersOf[subj.name] = subj.chapters;
    subj.chapters.forEach(ch => {
      chapterById[ch.id] = { ...ch, subject: subj.name };
      ch.kps.forEach(kp => {
        kpById[kp.id] = kp;
        kpChapter[kp.id] = ch.id;
        subjectOfKp[kp.id] = subj.name;
        (kp.pre || []).forEach(p => { (dependents[p] = dependents[p] || []).push(kp.id); });
      });
    });
  });
  return { kpById, chapterById, kpChapter, subjectOfKp, dependents, chaptersOf };
}

/** 依据作答进度统计每个知识点的掌握度 */
export function computeStats(kg, index) {
  const progress = getProgress();
  const mistakes = getMistakes();
  const stats = {};
  Object.keys(index.kpById).forEach(id => {
    stats[id] = { id, attempts: 0, correct: 0, wrong: 0, acc: 0, mastery: 0.5, last: 0 };
  });
  const bump = (kid, ok, ts, n, okN) => {
    const s = stats[kid];
    if (!s) return;
    const times = Math.max(1, n || 1);
    s.attempts += times;
    s.correct += typeof okN === 'number' ? okN : (ok ? 1 : 0);
    if (!ok || (typeof okN === 'number' && okN < times)) s.wrong += 1;
    if (ts > s.last) s.last = ts;
  };
  Object.entries(kg.tags || {}).forEach(([subject, sections]) => {
    Object.entries(sections).forEach(([sec, entry]) => {
      const secProg = (progress[subject] && progress[subject][sec]) || {};
      Object.entries(entry.qs || {}).forEach(([num, kps]) => {
        const p = secProg[num];
        if (!p) return;
        kps.forEach(kid => bump(kid, !!p.ok, p.ts || 0, p.n, p.okN));
      });
    });
  });
  // 错题额外计权：即使进度被后续覆盖，也保留一次“曾经错”的证据
  mistakes.forEach(m => {
    const t = kg.tags?.[m.subject]?.[m.sec];
    const kps = (t && t.qs && t.qs[String(m.num)]) || [];
    kps.forEach(kid => { if (stats[kid]) stats[kid].wrong += 1; });
  });
  Object.values(stats).forEach(s => {
    s.acc = s.attempts ? s.correct / s.attempts : 0;
    s.mastery = s.attempts ? (s.correct + 0.5) / (s.attempts + 1) : 0.5;
    s.status = s.attempts === 0 ? 'new' : s.mastery >= 0.8 ? 'good' : s.mastery >= 0.65 ? 'mid' : 'weak';
  });
  return stats;
}

export function chapterStats(kg, index, stats) {
  const out = {};
  kg.subjects.forEach(subj => {
    subj.chapters.forEach(ch => {
      let attempts = 0, correct = 0;
      ch.kps.forEach(kp => {
        const s = stats[kp.id];
        attempts += s.attempts; correct += s.correct;
      });
      out[ch.id] = {
        id: ch.id, name: ch.name, subject: subj.name,
        attempts, correct, acc: attempts ? correct / attempts : 0,
        kpCount: ch.kps.length,
        mastery: (correct + 1) / (attempts + 2),
      };
    });
  });
  return out;
}

function ancestors(kid, index, depth = 3) {
  const out = [];
  const walk = (id, d, path) => {
    if (d <= 0) return;
    const kp = index.kpById[id];
    (kp?.pre || []).forEach(p => {
      if (path.includes(p)) return;
      out.push({ id: p, depth: d });
      walk(p, d - 1, path.concat(p));
    });
  };
  walk(kid, depth, [kid]);
  // 同一祖先保留最短距离
  const best = {};
  out.forEach(a => { if (!best[a.id] || a.depth < best[a.id].depth) best[a.id] = a; });
  return Object.values(best);
}

/**
 * 薄弱点诊断：
 * 1) 直接薄弱：练过且正确率低 / 错题集中
 * 2) 根因推断：沿先修关系上溯，找出“掌握更弱或从未练习”的前置知识点
 */
export function diagnose(kg, index, stats) {
  const weak = [];
  const gaps = new Map();

  Object.values(stats).forEach(s => {
    if (s.attempts >= 2 && s.mastery < 0.7) weak.push(s);
    else if (s.attempts <= 1 && s.wrong >= 1) weak.push(s);
  });
  weak.sort((a, b) => (b.wrong - a.wrong) || (a.mastery - b.mastery));

  const addGap = (kp, score, kind, source, depth) => {
    const cur = gaps.get(kp.id) || { id: kp.id, name: kp.name, score: 0, kind, sources: [], depth: 9 };
    cur.score += score;
    cur.depth = Math.min(cur.depth, depth);
    if (source && !cur.sources.includes(source)) cur.sources.push(source);
    cur.kind = cur.kind === 'weak' ? 'weak' : kind;
    gaps.set(kp.id, cur);
  };

  weak.forEach(w => {
    const anc = ancestors(w.id, index, 3);
    let explained = false;
    anc.forEach(a => {
      const as = stats[a.id];
      if (!as) return;
      if (as.attempts === 0) {
        const score = (1 - w.mastery) * 0.55 / (1 + 0.35 * (a.depth - 1));
        addGap(index.kpById[a.id], score, 'untested', w.id, a.depth);
        explained = true;
      } else if (as.mastery < 0.68) {
        const score = (1 - w.mastery) * (1 - as.mastery + 0.25) / (1 + 0.35 * (a.depth - 1));
        addGap(index.kpById[a.id], score, 'weak', w.id, a.depth);
        explained = true;
      }
    });
    if (!explained) {
      addGap(index.kpById[w.id], 0.45 + (1 - w.mastery), 'weak', w.id, 0);
    }
  });

  const list = [...gaps.values()]
    .filter(g => g.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return {
    weak: weak.slice(0, 12),
    gaps: list,
    practiced: Object.values(stats).filter(s => s.attempts > 0).length,
    totalKp: Object.keys(stats).length,
  };
}

export function kpQuestions(kg, kid) {
  const out = [];
  Object.entries(kg.tags || {}).forEach(([subject, secs]) => {
    Object.entries(secs).forEach(([sec, e]) => {
      Object.entries(e.qs || {}).forEach(([num, kps]) => {
        if (kps.includes(kid)) out.push({ subject, sec, num: Number(num), type: 'xzt' });
      });
      Object.entries(e.bigq || {}).forEach(([num, kps]) => {
        if (kps.includes(kid)) out.push({ subject, sec, num: Number(num), type: 'dt' });
      });
    });
  });
  return out;
}

/** 某个知识点的完整信息（含先修/后继/可练习章节） */
export function kpDetail(kg, index, kid, stats) {
  const kp = index.kpById[kid];
  if (!kp) return null;
  const chapter = index.chapterById[index.kpChapter[kid]];
  const linked = kpQuestions(kg, kid);
  return {
    kp,
    chapter,
    subject: index.subjectOfKp[kid],
    stat: stats[kid],
    pre: (kp.pre || []).map(id => index.kpById[id]).filter(Boolean),
    dependents: (index.dependents[kid] || []).map(id => index.kpById[id]).filter(Boolean),
    drills: (kg.drills && kg.drills[kid]) || [],
    count: linked.length,
    xztCount: linked.filter(x => x.type === 'xzt').length,
    bigqCount: linked.filter(x => x.type === 'dt').length,
  };
}

export function subjectSummary(kg, index, stats, subject) {
  const subj = kg.subjects.find(s => s.name === subject);
  if (!subj) return null;
  let attempts = 0, correct = 0, practiced = 0;
  subj.chapters.forEach(ch => ch.kps.forEach(kp => {
    const s = stats[kp.id];
    attempts += s.attempts; correct += s.correct;
    if (s.attempts) practiced++;
  }));
  return { attempts, correct, acc: attempts ? correct / attempts : 0, practiced, total: subj.chapters.reduce((a, c) => a + c.kps.length, 0) };
}
