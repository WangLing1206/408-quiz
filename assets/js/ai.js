'use strict';
/* AI 能力：OpenAI 兼容接口（本地 Key）+ 计算机基础课程提示词 */

import { getAI } from './store.js';
import { md } from './core.js';

export class AIError extends Error {
  constructor(message, status) { super(message); this.name = 'AIError'; this.status = status || 0; }
}

export function endpoint(cfg) {
  let base = (cfg.baseUrl || '').trim().replace(/\/+$/, '');
  if (!base) throw new AIError('请先在「我的 → AI 设置」中填写 Base URL');
  if (/\/chat\/completions$/.test(base)) return base;
  return base + '/chat/completions';
}

function friendly(status, detail) {
  if (status === 401 || status === 403) return 'API Key 无效或没有权限（' + status + '）。请检查 Key 与 Base URL 是否属于同一服务商。';
  if (status === 404) return '接口地址不存在（404）。Base URL 通常以 /v1 结尾，例如 https://api.deepseek.com/v1';
  if (status === 429) return '请求过于频繁或额度不足（429），请稍后再试。';
  if (status >= 500) return '服务商暂时不可用（' + status + '），请稍后再试。';
  return '请求失败（' + status + '）' + (detail ? '：' + detail : '');
}

function extractErrorText(text) {
  try {
    const j = JSON.parse(text);
    return (j.error && (j.error.message || j.error.type)) || j.message || '';
  } catch (e) { return String(text || '').slice(0, 200); }
}

/**
 * 流式对话。onDelta(增量文本)；返回完整文本。
 * 兼容 OpenAI / DeepSeek / Moonshot / 通义 / Ollama 等 /chat/completions 接口。
 */
export async function streamChat(messages, opts = {}) {
  const cfg = { ...getAI(), ...(opts.cfg || {}) };
  const key = (cfg.apiKey || '').trim();
  if (!key) throw new AIError('尚未配置 API Key。请在「我的 → AI 设置」中填写，Key 只保存在本机。');

  const controller = new AbortController();
  const signal = opts.signal || controller.signal;
  const body = {
    model: cfg.model || 'deepseek-chat',
    messages,
    temperature: Number.isFinite(opts.temperature) ? opts.temperature : Number(cfg.temperature) || 0.4,
    stream: opts.stream !== false && cfg.stream !== false,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;

  let res;
  try {
    res = await fetch(endpoint(cfg), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new AIError('无法连接 AI 服务：' + e.message + '。请检查网络、Base URL 与服务商是否允许浏览器跨域访问。');
  }

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new AIError(friendly(res.status, extractErrorText(t)), res.status);
  }

  const ctype = res.headers.get('content-type') || '';
  if (!body.stream || !ctype.includes('event-stream') || !res.body) {
    const j = await res.json().catch(() => null);
    const text = j?.choices?.[0]?.message?.content || '';
    if (!text) throw new AIError('服务商返回了空内容，请检查模型名称是否正确。');
    if (opts.onDelta) opts.onDelta(text);
    return text;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '', full = '', finished = false;
  while (!finished) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split(/\n\n/);
    buf = parts.pop() || '';
    for (const part of parts) {
      for (const line of part.split('\n')) {
        const s = line.trim();
        if (!s.startsWith('data:')) continue;
        const data = s.slice(5).trim();
        if (!data) continue;
        if (data === '[DONE]') { finished = true; break; }
        let j;
        try { j = JSON.parse(data); } catch (e) { continue; }
        const ch = j.choices && j.choices[0];
        if (!ch) continue;
        const delta = (ch.delta && (ch.delta.content || ch.delta.reasoning_content)) || (ch.message && ch.message.content) || '';
        if (delta) { full += delta; if (opts.onDelta) opts.onDelta(delta); }
      }
      if (finished) break;
    }
  }
  // 少数服务端在 [DONE] 后仍保持连接，主动释放
  try { await reader.cancel(); } catch (e) { /* ignore */ }
  if (!full.trim()) throw new AIError('服务商返回了空内容，请检查模型名称或稍后重试。');
  return full;
}

export async function testConnection() {
  const text = await streamChat([
    { role: 'system', content: '只回复“连接成功”。' },
    { role: 'user', content: '测试' },
  ], { stream: false, maxTokens: 16, temperature: 0 });
  return text.trim().slice(0, 40);
}

const BASE_SYSTEM = '你是计算机专业基础课程的辅导老师，擅长数据结构、计算机组成原理、操作系统与计算机网络。'
  + '回答使用简体中文，先给结论，再给推导过程；公式用纯文本；不要编造题外事实；不确定时明确说明。';

function kpLine(kpNames) {
  return kpNames && kpNames.length ? '涉及知识点：' + kpNames.join('、') : '';
}

/** 选择题解析提示词 */
export function questionPrompt({ subject, secTitle, q, mine, kpNames }) {
  const opts = (q[4] || []).map(x => '  ' + x).join('\n');
  const lines = [
    `【科目】${subject}  【章节】${secTitle}`,
    `【题干】${q[2]}`,
    opts ? `【选项】\n${opts}` : '',
    `【正确答案】${q[1]}`,
    `【学生答案】${mine || '（未作答）'}`,
    q[3] ? `【教材解析】${String(q[3]).slice(0, 1600)}` : '',
    kpLine(kpNames),
    '',
    '请按以下结构回答，控制在 500 字以内：',
    '1. 学生错因：指出学生的答案错在哪个概念或哪一步（若未作答则说明本题关键）。',
    '2. 正确思路：逐步推导，解释每个选项为什么对/错。',
    '3. 易错提醒：给出 1-2 条考场易错点。',
    '4. 关联知识点：列出需要复习的知识点名称。',
  ];
  return lines.filter(Boolean).join('\n');
}

/** 大题解析提示词 */
export function bigqPrompt({ subject, secTitle, b, kpNames }) {
  return [
    `【科目】${subject}  【章节】${secTitle}`,
    `【题目】${b[1]}`,
    `【参考答案】${String(b[2] || '').slice(0, 2400)}`,
    kpNames && kpNames.length ? kpLine(kpNames) : '',
    '',
    '请以阅卷老师的视角：',
    '1. 拆解解题步骤与每一步的得分点；',
    '2. 说明这类题的通用解题模板；',
    '3. 指出常见的失分原因。',
    '控制在 600 字以内，不要重复整段参考答案。',
  ].filter(Boolean).join('\n');
}

/** 知识点讲解提示词 */
export function kpPrompt({ subject, chapter, name, preNames, dependents }) {
  return [
    `【科目】${subject}  【章节】${chapter}`,
    `【知识点】${name}`,
    preNames && preNames.length ? `【前置知识】${preNames.join('、')}` : '',
    dependents && dependents.length ? `【后续知识】${dependents.join('、')}` : '',
    '',
    '请：1) 用一句话定义；2) 给出课程考试中最常考的 3 个要点；3) 举一个典型考法或反例；4) 给出自测问题。',
    '控制在 450 字以内。',
  ].filter(Boolean).join('\n');
}

export function messagesForQuestion(pack) {
  const sys = BASE_SYSTEM + ' 你在讲解一道计算机基础题，请直接针对题目，不要泛泛而谈。';
  return [
    { role: 'system', content: sys },
    { role: 'user', content: questionPrompt(pack) },
  ];
}

export function messagesForBigq(pack) {
  return [
    { role: 'system', content: BASE_SYSTEM + ' 你在讲解一道综合应用题。' },
    { role: 'user', content: bigqPrompt(pack) },
  ];
}

export function messagesForKp(pack) {
  return [
    { role: 'system', content: BASE_SYSTEM + ' 你在讲解计算机基础知识点。' },
    { role: 'user', content: kpPrompt(pack) },
  ];
}

/** 把一段 AI 文本渲染为 HTML（流式时最后再调用一次） */
export function renderAI(text) { return md(text); }
