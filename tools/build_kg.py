#!/usr/bin/env python3
"""构建知识图谱与题库清单。

输入:
  tools/kg_source.json   人工维护的课程知识体系（章节/知识点/先修关系/章节映射）
  data/*.json            题库（教材扫描 OCR 提取）

输出:
  data/kg.json           知识图谱 + 每道题的知识点标签
  data/bank.json         题库清单（版本号、每科校验和、题量），供客户端从 GitHub 同步

用法:
  python tools/build_kg.py
  python tools/build_kg.py --check   # 仅校验，不写文件
"""
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
SOURCE = os.path.join(ROOT, 'tools', 'kg_source.json')
REPO = 'WangLing1206/408-quiz'
BRANCH = 'main'


def read_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def write_json(path, obj, pretty=False):
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        if pretty:
            json.dump(obj, f, ensure_ascii=False, indent=2)
        else:
            json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def load_banks(source):
    banks = {}
    for subj in source['subjects']:
        path = os.path.join(DATA, subj['name'] + '.json')
        if not os.path.exists(path):
            sys.exit('缺少题库文件: ' + path)
        d = read_json(path)
        if 'sections' not in d or not isinstance(d['sections'], dict):
            sys.exit('题库结构异常: ' + path)
        banks[subj['name']] = (path, d)
    return banks


def validate(source, banks):
    errors, warnings = [], []
    kp_ids, chapter_of = {}, {}
    for subj in source['subjects']:
        if subj['name'] not in banks:
            errors.append('kg_source 科目不存在于题库: ' + subj['name'])
        for ch in subj['chapters']:
            for kp in ch['kps']:
                if kp['id'] in kp_ids:
                    errors.append('知识点 id 重复: ' + kp['id'])
                kp_ids[kp['id']] = kp
                chapter_of[kp['id']] = ch['id']
                if not kp.get('keywords'):
                    warnings.append('知识点缺少关键词: ' + kp['id'])
    for kid, kp in kp_ids.items():
        for pre in kp.get('pre', []):
            if pre not in kp_ids:
                errors.append('%s 的先修知识点不存在: %s' % (kid, pre))
            elif pre == kid:
                errors.append('知识点不能以自己为先修: ' + kid)
    for name, secs in source['sectionMap'].items():
        if name not in banks:
            errors.append('sectionMap 科目不存在: ' + name)
            continue
        for sec, kps in secs.items():
            if sec not in banks[name][1]['sections']:
                errors.append('%s 章节不存在于题库: %s' % (name, sec))
            for kid in kps:
                if kid not in kp_ids:
                    errors.append('%s/%s 映射到未知知识点: %s' % (name, sec, kid))
    # 统计知识点覆盖
    return errors, warnings, kp_ids, chapter_of


def clean_text(s):
    return re.sub(r'\s+', '', str(s or ''))


def tag_questions(source, banks, kp_ids, chapter_of):
    """按章节映射 + 关键词命中为每道题打知识点标签（每题最多 3 个）。"""
    chapter_kps = {}
    chapter_of_subject = {}
    for subj in source['subjects']:
        for ch in subj['chapters']:
            chapter_kps[ch['id']] = ch['kps']
            for kp in ch['kps']:
                chapter_of_subject[kp['id']] = subj['name']

    def score_kp(kp, text):
        score = 0
        for kw in kp.get('keywords', []):
            if not kw:
                continue
            hits = text.count(kw)
            if hits:
                # 长关键词更有区分度；同一个词最多计 3 次
                score += min(hits, 3) * max(1, len(kw) - 1)
        return score

    def tags_for(base_ids, title, *texts):
        text = clean_text(title + ' ' + ' '.join(str(t or '') for t in texts))
        base_ids = [k for k in base_ids if k in kp_ids]
        chapters = {chapter_of[k] for k in base_ids}
        cands = []
        for ch in chapters:
            cands.extend(chapter_kps.get(ch, []))
        scored = sorted(((score_kp(kp, text), kp['id']) for kp in cands), reverse=True)
        chosen = []
        # 章节主映射提供 1-2 个基础标签
        for k in base_ids[:2]:
            chosen.append(k)
        # 关键词命中的知识点补充，最多补到 3 个
        for score, kid in scored:
            if len(chosen) >= 3:
                break
            if score >= 4 and kid not in chosen:
                chosen.append(kid)
        return chosen

    tags = {}
    coverage = {kid: 0 for kid in kp_ids}
    for name, (path, d) in banks.items():
        secmap = source['sectionMap'].get(name, {})
        tags[name] = {}
        for sec, v in d['sections'].items():
            base = secmap.get(sec, [])
            entry = {'qs': {}, 'bigq': {}}
            for q in v.get('qs', []):
                t = tags_for(base, v.get('title', ''), q[2], q[3], ' '.join(q[4] or []))
                entry['qs'][str(q[0])] = t
                for kid in t:
                    coverage[kid] += 1
            for b in v.get('bigq', []):
                t = tags_for(base, v.get('title', ''), b[1], b[2],
                             ' '.join(h[1] for h in (b[3] or [])))
                entry['bigq'][str(b[0])] = t
                for kid in t:
                    coverage[kid] += 1
            tags[name][sec] = entry
    return tags, coverage


def build_kg(source, tags):
    subjects = []
    edges = []
    for subj in source['subjects']:
        chapters = []
        for ch in subj['chapters']:
            kps = []
            for kp in ch['kps']:
                for pre in kp.get('pre', []):
                    edges.append({'from': pre, 'to': kp['id']})
                kps.append({
                    'id': kp['id'],
                    'name': kp['name'],
                    'keywords': kp.get('keywords', []),
                    'pre': kp.get('pre', []),
                })
            chapters.append({'id': ch['id'], 'name': ch['name'], 'kps': kps})
        subjects.append({'id': subj['id'], 'name': subj['name'], 'chapters': chapters})

    # 知识点 -> 可练习的章节（用于图谱里“去练习”）
    drills = {}
    for name, secs in source['sectionMap'].items():
        for sec, kids in secs.items():
            for kid in kids:
                drills.setdefault(kid, []).append({'subject': name, 'sec': sec})

    kg = {
        'schema': 1,
        'version': '',
        'subjects': subjects,
        'edges': edges,
        'sectionMap': source['sectionMap'],
        'drills': drills,
        'tags': tags,
    }
    return kg


def main():
    check_only = '--check' in sys.argv
    source = read_json(SOURCE)
    banks = load_banks(source)
    errors, warnings, kp_ids, chapter_of = validate(source, banks)
    if errors:
        print('校验失败:')
        for e in errors:
            print('  ✗', e)
        sys.exit(1)
    for w in warnings:
        print('  ! ' + w)

    tags, coverage = tag_questions(source, banks, kp_ids, chapter_of)
    kg = build_kg(source, tags)

    missing = sorted(k for k, n in coverage.items() if n == 0)
    if missing:
        print('  ! 以下知识点暂无关联题目: ' + ', '.join(missing))

    total_q = sum(len(v['qs']) for n in tags for v in tags[n].values())
    total_b = sum(len(v['bigq']) for n in tags for v in tags[n].values())
    print('题目标注: %d 选择题 / %d 大题 / %d 知识点' % (total_q, total_b, len(kp_ids)))

    files = {}
    combined = hashlib.sha256()
    for subj in source['subjects']:
        name = subj['name']
        path, d = banks[name]
        digest = sha256(path)
        combined.update(digest.encode())
        files[name + '.json'] = {
            'sha256': digest,
            'qs': sum(len(v['qs']) for v in d['sections'].values()),
            'bigq': sum(len(v['bigq']) for v in d['sections'].values()),
            'sections': len(d['sections']),
        }
    # 知识体系源文件也参与版本号：只改知识点/映射时同样能触发同步
    combined.update(sha256(SOURCE).encode())
    version = combined.hexdigest()[:12]
    kg['version'] = version
    kg_bytes = json.dumps(kg, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    manifest = {
        'schema': 1,
        'version': version,
        'generatedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'repo': REPO,
        'branch': BRANCH,
        'files': files,
        'kg': {'sha256': hashlib.sha256(kg_bytes).hexdigest(), 'kps': len(kp_ids)},
        'totalQs': sum(f['qs'] for f in files.values()),
        'totalBigq': sum(f['bigq'] for f in files.values()),
    }

    if check_only:
        print('校验通过，version =', version)
        return
    write_json(os.path.join(DATA, 'kg.json'), kg)
    write_json(os.path.join(DATA, 'bank.json'), manifest, pretty=True)
    print('已生成 data/kg.json (%d KB) 与 data/bank.json，version = %s' % (
        os.path.getsize(os.path.join(DATA, 'kg.json')) // 1024, version))


if __name__ == '__main__':
    main()
