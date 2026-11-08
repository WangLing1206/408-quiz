#!/usr/bin/env python3
"""把网站资源打包到 mobile/www，供 Capacitor 打入安卓 App。

用法: python tools/build_www.py
"""
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'mobile', 'www')

COPY = ['index.html', 'manifest.webmanifest', 'sw.js', 'assets', 'data']

def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT, exist_ok=True)
    for item in COPY:
        src = os.path.join(ROOT, item)
        dst = os.path.join(OUT, item)
        if not os.path.exists(src):
            sys.exit('缺少资源: ' + src)
        if os.path.isdir(src):
            shutil.copytree(src, dst, ignore=shutil.ignore_patterns('source'))
        else:
            shutil.copy2(src, dst)
    total = 0
    for base, _, files in os.walk(OUT):
        for f in files:
            total += os.path.getsize(os.path.join(base, f))
    print('已生成 mobile/www（%.1f MB）' % (total / 1024 / 1024))


if __name__ == '__main__':
    main()
