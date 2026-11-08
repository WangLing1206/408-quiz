#!/usr/bin/env python3
"""从 assets/source/tubiao.png 生成全套应用图标与安卓启动图。

作者: wwl    发布签名: wwl_408
用法: python tools/make_icons.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'source', 'tubiao.png')
ICONS = os.path.join(ROOT, 'assets', 'icons')
RES = os.path.join(ROOT, 'mobile', 'android', 'app', 'src', 'main', 'res')
DENS = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def font(size, bold=True):
    for f in (['C:/Windows/Fonts/msyhbd.ttc', 'C:/Windows/Fonts/msyh.ttc'] if bold else ['C:/Windows/Fonts/msyh.ttc']):
        if os.path.exists(f):
            return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def base_image():
    im = Image.open(SRC).convert('RGB')
    w, h = im.size
    inset = int(min(w, h) * 0.015)
    return im.crop((inset, inset, w - inset, h - inset))


def rounded(img, size, radius_ratio=0.22):
    s = size * 2
    im = img.resize((s, s), Image.LANCZOS).convert('RGBA')
    mask = Image.new('L', (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * radius_ratio), fill=255)
    out = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out.resize((size, size), Image.LANCZOS)


def circular(img, size):
    s = size * 2
    im = img.resize((s, s), Image.LANCZOS).convert('RGBA')
    mask = Image.new('L', (s, s), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, s - 1, s - 1], fill=255)
    out = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    return out.resize((size, size), Image.LANCZOS)


def padded(img, size, scale=1.0):
    """maskable / 自适应前景：满幅图片，避免出现方形接缝。"""
    return img.resize((size, size), Image.LANCZOS).convert('RGBA')


def gradient(w, h):
    img = Image.new('RGB', (1, h))
    top, bot = (35, 28, 112), (79, 70, 229)
    for y in range(h):
        t = y / max(1, h - 1)
        img.putpixel((0, y), tuple(int(top[i] * (1 - t) + bot[i] * t) for i in range(3)))
    return img.resize((w, h))


def splash(w, h, icon):
    img = Image.new('RGBA', (w, h), (255, 255, 255, 255))
    d = ImageDraw.Draw(img)
    unit = min(w, h)
    # 轻微的品牌色光晕，保持白色底
    r = int(unit * 0.34)
    glow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse(
        [w // 2 - r, h // 2 - r - int(unit * 0.02), w // 2 + r, h // 2 + r - int(unit * 0.02)],
        fill=(79, 70, 229, 12))
    glow = glow.filter(ImageFilter.GaussianBlur(r // 4))
    img.alpha_composite(glow)

    s = int(unit * 0.30)
    pad = max(4, int(s * 0.055))
    outer = s + pad * 2
    off = int(s * 0.06)
    sh = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        [w // 2 - outer // 2, h // 2 - outer // 2 + off, w // 2 + outer // 2, h // 2 + outer // 2 + off],
        radius=int(outer * 0.25), fill=(31, 38, 70, 65))
    sh = sh.filter(ImageFilter.GaussianBlur(max(2, s // 12)))
    img.alpha_composite(sh)
    # 白色填充边框 + 图标
    frame = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle(
        [w // 2 - outer // 2, h // 2 - outer // 2, w // 2 + outer // 2, h // 2 + outer // 2],
        radius=int(outer * 0.25), fill=(255, 255, 255, 255))
    img.alpha_composite(frame)
    card = icon.resize((s, s), Image.LANCZOS)
    img.alpha_composite(card, (w // 2 - s // 2, h // 2 - s // 2))

    fy = h // 2 + outer // 2 + int(unit * 0.065)
    f1 = font(int(unit * 0.055))
    t1 = '题库练习'
    b1 = d.textbbox((0, 0), t1, font=f1)
    d.text(((w - (b1[2] - b1[0])) / 2 - b1[0], fy), t1, font=f1, fill=(26, 33, 48, 255))
    f2 = font(int(unit * 0.026), False)
    t2 = '随时练习 · 稳步提升'
    b2 = d.textbbox((0, 0), t2, font=f2)
    d.text(((w - (b2[2] - b2[0])) / 2 - b2[0], fy + (b1[3] - b1[1]) + int(unit * 0.025)),
           t2, font=f2, fill=(122, 130, 150, 255))
    return img.convert('RGB')


def main():
    im = base_image()
    os.makedirs(ICONS, exist_ok=True)
    rounded(im, 512).save(os.path.join(ICONS, 'icon-512.png'), 'PNG')
    rounded(im, 192).save(os.path.join(ICONS, 'icon-192.png'), 'PNG')
    rounded(im, 64).save(os.path.join(ICONS, 'favicon.png'), 'PNG')
    padded(im, 512).save(os.path.join(ICONS, 'icon-maskable-512.png'), 'PNG')
    # iOS 图标不要透明，由系统裁切
    im.resize((180, 180), Image.LANCZOS).save(os.path.join(ICONS, 'apple-touch-icon.png'), 'PNG')

    for d, m in DENS.items():
        folder = os.path.join(RES, 'mipmap-' + d)
        os.makedirs(folder, exist_ok=True)
        rounded(im, int(48 * m)).save(os.path.join(folder, 'ic_launcher.png'), 'PNG')
        circular(im, int(48 * m)).save(os.path.join(folder, 'ic_launcher_round.png'), 'PNG')
        padded(im, int(108 * m)).save(os.path.join(folder, 'ic_launcher_foreground.png'), 'PNG')

    sizes = {
        'drawable': (480, 320),
        'drawable-land-mdpi': (480, 320), 'drawable-land-hdpi': (800, 480),
        'drawable-land-xhdpi': (1280, 720), 'drawable-land-xxhdpi': (1600, 960),
        'drawable-land-xxxhdpi': (1920, 1280),
        'drawable-port-mdpi': (320, 480), 'drawable-port-hdpi': (480, 800),
        'drawable-port-xhdpi': (720, 1280), 'drawable-port-xxhdpi': (960, 1600),
        'drawable-port-xxxhdpi': (1280, 1920),
    }
    card = rounded(im, 512)
    for folder, (w, h) in sizes.items():
        path = os.path.join(RES, folder)
        os.makedirs(path, exist_ok=True)
        splash(w, h, card).save(os.path.join(path, 'splash.png'), 'PNG')
    print('图标与安卓启动图已从 tubiao.png 生成')


if __name__ == '__main__':
    main()
