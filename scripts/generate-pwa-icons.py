#!/usr/bin/env python3
"""타로냥 PWA 아이콘 생성기 — 보름달 + 고양이 + 별 무드.

생성 파일 (frontend/icons/):
  - icon-192.png          (192x192, any)
  - icon-512.png          (512x512, any)
  - icon-512-maskable.png (512x512, maskable — 안전 영역 패딩)
  - apple-touch-icon.png  (180x180)
  - favicon-32.png        (32x32)
  - favicon-16.png        (16x16)
"""

import math
import os
from PIL import Image, ImageDraw, ImageFilter

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "icons")
os.makedirs(OUT_DIR, exist_ok=True)

# 타로냥 디자인 시스템 색상
NAVY = (10, 10, 46)  # #0a0a2e  배경
DARK_PURPLE = (26, 26, 62)  # #1a1a3e
LAVENDER = (167, 139, 250)  # #a78bfa  보라
GOLD = (251, 191, 36)  # #fbbf24  금색
MOON = (255, 250, 230)  # 보름달
STAR_GLOW = (255, 255, 220)


def vertical_gradient(size, top, bottom):
    """수직 그라디언트 이미지 생성."""
    img = Image.new("RGB", (size, size), top)
    for y in range(size):
        t = y / max(size - 1, 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        for x in range(size):
            img.putpixel((x, y), (r, g, b))
    return img


def fast_gradient(size, top, bottom):
    """빠른 그라디언트 — 작은 이미지 스케일업."""
    small = vertical_gradient(max(2, size // 4), top, bottom).resize((size, size))
    return small


def draw_star(draw, cx, cy, r, color, points=5):
    """별 그리기."""
    coords = []
    for i in range(points * 2):
        angle = math.pi / 2 + i * math.pi / points
        radius = r if i % 2 == 0 else r * 0.4
        coords.append((cx + radius * math.cos(angle), cy - radius * math.sin(angle)))
    draw.polygon(coords, fill=color)


def draw_cat_silhouette(draw, cx, cy, size, color):
    """간단 고양이 실루엣 (머리 + 귀)."""
    # 머리 (타원)
    head_w = size * 0.62
    head_h = size * 0.52
    draw.ellipse(
        [cx - head_w / 2, cy - head_h / 2, cx + head_w / 2, cy + head_h / 2],
        fill=color,
    )
    # 귀 (삼각형 두 개)
    ear_h = size * 0.30
    ear_w = size * 0.20
    offset = size * 0.28
    # 왼쪽 귀
    draw.polygon(
        [
            (cx - offset - ear_w / 2, cy - head_h / 2 + ear_h * 0.15),
            (cx - offset + ear_w / 2, cy - head_h / 2 + ear_h * 0.15),
            (cx - offset, cy - head_h / 2 - ear_h * 0.7),
        ],
        fill=color,
    )
    # 오른쪽 귀
    draw.polygon(
        [
            (cx + offset - ear_w / 2, cy - head_h / 2 + ear_h * 0.15),
            (cx + offset + ear_w / 2, cy - head_h / 2 + ear_h * 0.15),
            (cx + offset, cy - head_h / 2 - ear_h * 0.7),
        ],
        fill=color,
    )


def render_icon(size, maskable=False):
    """아이콘 렌더링. maskable=True면 안전 영역(80%) 안에 요소 배치."""
    # 4x supersample for anti-aliasing
    ss = 4
    S = size * ss
    img = fast_gradient(S, (20, 14, 70), NAVY).convert("RGBA")

    # 배경 보라광 (중앙 라디얼)
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i in range(40, 0, -1):
        alpha = int(60 * (1 - i / 40))
        r = int(S * 0.55 * (i / 40))
        gd.ellipse(
            [S // 2 - r, S // 2 - r, S // 2 + r, S // 2 + r], fill=(124, 58, 237, alpha)
        )
    glow = glow.filter(ImageFilter.GaussianBlur(S // 30))
    img = Image.alpha_composite(img, glow)

    # maskable 안전영역: 중앙 80% 스케일
    scale = 0.80 if maskable else 1.0
    draw = ImageDraw.Draw(img)

    # 보름달 (금색빛)
    moon_r = S * 0.22 * scale
    moon_cx = S * 0.5
    moon_cy = S * 0.40
    # 달 광황
    halo = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    for i in range(30, 0, -1):
        alpha = int(40 * (1 - i / 30))
        r = int(moon_r * (1 + i * 0.05))
        hd.ellipse(
            [moon_cx - r, moon_cy - r, moon_cx + r, moon_cy + r],
            fill=(251, 191, 36, alpha),
        )
    halo = halo.filter(ImageFilter.GaussianBlur(S // 40))
    img = Image.alpha_composite(img, halo)
    draw = ImageDraw.Draw(img)
    # 달 본체
    draw.ellipse(
        [moon_cx - moon_r, moon_cy - moon_r, moon_cx + moon_r, moon_cy + moon_r],
        fill=MOON,
    )
    # 달 크레이터 (은은하게)
    for dx, dy, cr in [(-0.3, -0.2, 0.12), (0.25, 0.15, 0.09), (-0.1, 0.35, 0.07)]:
        cr_abs = moon_r * cr
        draw.ellipse(
            [
                moon_cx + moon_r * dx - cr_abs,
                moon_cy + moon_r * dy - cr_abs,
                moon_cx + moon_r * dx + cr_abs,
                moon_cy + moon_r * dy + cr_abs,
            ],
            fill=(245, 235, 200),
        )

    # 고양이 실루엣 (달 아래, 보라색)
    cat_size = S * 0.34 * scale
    draw_cat_silhouette(draw, S * 0.5, S * 0.66, cat_size, LAVENDER)
    # 고양이 눈 (금색)
    eye_r = cat_size * 0.035
    ey = S * 0.64
    for ex in [S * 0.5 - cat_size * 0.13, S * 0.5 + cat_size * 0.13]:
        draw.ellipse([ex - eye_r, ey - eye_r, ex + eye_r, ey + eye_r], fill=GOLD)

    # 별 장식 (3개)
    star_r = S * 0.035 * scale
    for sx, sy in [(0.22, 0.25), (0.80, 0.30), (0.84, 0.60)]:
        draw_star(draw, S * sx, S * sy, star_r, STAR_GLOW)
    # 작은 별 점들
    for sx, sy, pr in [
        (0.30, 0.15, 0.006),
        (0.70, 0.18, 0.005),
        (0.18, 0.55, 0.005),
        (0.88, 0.45, 0.004),
    ]:
        pr_abs = S * pr
        draw.ellipse(
            [S * sx - pr_abs, S * sy - pr_abs, S * sx + pr_abs, S * sy + pr_abs],
            fill=STAR_GLOW,
        )

    # 다운스케일 (anti-alias)
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    return img


def main():
    icons = {
        "icon-192.png": (192, False),
        "icon-512.png": (512, False),
        "icon-512-maskable.png": (512, True),
        "apple-touch-icon.png": (180, False),
        "favicon-32.png": (32, False),
        "favicon-16.png": (16, False),
    }
    for name, (size, maskable) in icons.items():
        path = os.path.join(OUT_DIR, name)
        render_icon(size, maskable=maskable).save(path, "PNG")
        print(f"  generated {path} ({size}x{size})")
    print("done.")


if __name__ == "__main__":
    main()
