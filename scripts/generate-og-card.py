#!/usr/bin/env python3
"""Generate 1200x630 Open Graph wedding invitation preview card (Song Hy Xanh)."""

import math
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(ROOT, "public", "og-wedding-card.jpg")

COVER_IMG = os.path.join(ROOT, "data", "images", "cover-DXD_9823.jpg")
CHU_HY_IMG = os.path.join(ROOT, "images", "themes", "song-hy-red", "chu-hy.webp")
SEAL_ICON_IMG = os.path.join(ROOT, "images", "themes", "songlong-red", "chinese_happiness.webp")

FONT_PLAYFAIR = os.path.join(ROOT, "assets", "fonts", "PlayfairDisplay-Variable.ttf")
FONT_LORA = os.path.join(ROOT, "assets", "fonts", "Lora-Regular.ttf")
FONT_EB = os.path.join(ROOT, "assets", "fonts", "EBGaramond-Variable.ttf")

W, H = 1200, 630


def load_font(path, size, weight=None):
    font = ImageFont.truetype(path, size=size)
    if weight is not None:
        try:
            font.set_variation_by_axes([weight])
        except Exception:
            pass
    return font


def make_gradient_bg(w, h):
    """Deep Song Hy green diagonal gradient background."""
    bg = Image.new("RGB", (w, h))
    px = bg.load()
    # Top-left (#0c2111) -> Center (#1a3420) -> Bottom-right (#213e28)
    c0 = (11, 31, 16)
    c1 = (27, 54, 34)
    c2 = (35, 65, 42)
    for y in range(h):
        ty = y / (h - 1)
        for x in range(w):
            tx = x / (w - 1)
            t = 0.55 * tx + 0.45 * ty
            if t < 0.5:
                u = t * 2.0
                r = int(c0[0] + (c1[0] - c0[0]) * u)
                g = int(c0[1] + (c1[1] - c0[1]) * u)
                b = int(c0[2] + (c1[2] - c0[2]) * u)
            else:
                u = (t - 0.5) * 2.0
                r = int(c1[0] + (c2[0] - c1[0]) * u)
                g = int(c1[1] + (c2[1] - c1[1]) * u)
                b = int(c1[2] + (c2[2] - c1[2]) * u)
            px[x, y] = (r, g, b)
    return bg.convert("RGBA")


def add_soft_glow(canvas, cx, cy, radius, color_rgb, max_alpha):
    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    steps = 28
    for i in range(steps, 0, -1):
        frac = i / steps
        r = int(radius * frac)
        alpha = int(max_alpha * ((1.0 - frac) ** 1.8))
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*color_rgb, alpha))
    return Image.alpha_composite(canvas, glow)


def tint_image(img_rgba, rgb, opacity):
    alpha = img_rgba.getchannel("A")
    alpha = alpha.point(lambda a: int(a * opacity))
    tinted = Image.new("RGBA", img_rgba.size, (*rgb, 255))
    tinted.putalpha(alpha)
    return tinted


def make_arch_mask(w, h):
    """High-res anti-aliased arch mask (semicircle top + straight bottom)."""
    scale = 4
    mw, mh = w * scale, h * scale
    mask = Image.new("L", (mw, mh), 0)
    d = ImageDraw.Draw(mask)
    radius = mw // 2
    d.ellipse((0, 0, mw, radius * 2), fill=255)
    d.rectangle((0, radius, mw, mh), fill=255)
    return mask.resize((w, h), Image.Resampling.LANCZOS)


def composite_arch_outline_aa(canvas, x, y, w, h, color, width=2):
    scale = 4
    pad = 16
    lw, lh = w + pad * 2, h + pad * 2
    hi = Image.new("RGBA", (lw * scale, lh * scale), (0, 0, 0, 0))
    d = ImageDraw.Draw(hi)
    ox, oy = pad * scale, pad * scale
    sw, sh = w * scale, h * scale
    r = sw // 2
    stroke = max(1, int(width * scale))
    d.arc((ox, oy, ox + sw, oy + sw), start=180, end=360, fill=color, width=stroke)
    d.line((ox + stroke // 2, oy + r - 1, ox + stroke // 2, oy + sh), fill=color, width=stroke)
    d.line((ox + sw - (stroke + 1) // 2, oy + r - 1, ox + sw - (stroke + 1) // 2, oy + sh), fill=color, width=stroke)
    d.line((ox, oy + sh - (stroke + 1) // 2, ox + sw, oy + sh - (stroke + 1) // 2), fill=color, width=stroke)
    aa = hi.resize((lw, lh), Image.Resampling.LANCZOS)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer.paste(aa, (x - pad, y - pad))
    return Image.alpha_composite(canvas, layer)


def composite_pill_aa(canvas, x, y, w, h, fill_color):
    scale = 4
    pad = 24
    lw, lh = w + pad * 2, h + pad * 2
    # Soft glow around pill
    glow = Image.new("RGBA", (lw, lh), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.rounded_rectangle((pad - 2, pad - 2, pad + w + 2, pad + h + 2), radius=(h + 4) // 2, fill=(232, 240, 228, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=10))
    layer_glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer_glow.paste(glow, (x - pad, y - pad))
    canvas = Image.alpha_composite(canvas, layer_glow)

    hi = Image.new("RGBA", (lw * scale, lh * scale), (0, 0, 0, 0))
    d = ImageDraw.Draw(hi)
    d.rounded_rectangle(
        (pad * scale, pad * scale, (pad + w) * scale, (pad + h) * scale),
        radius=(h * scale) // 2,
        fill=fill_color
    )
    aa = hi.resize((lw, lh), Image.Resampling.LANCZOS)
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer.paste(aa, (x - pad, y - pad))
    return Image.alpha_composite(canvas, layer)


def draw_centered_text(draw, text, cx, y, font, fill, letter_spacing=0):
    if letter_spacing == 0:
        bbox = draw.textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        draw.text((cx - tw / 2, y), text, font=font, fill=fill)
        return bbox[3] - bbox[1]
    widths = [draw.textlength(ch, font=font) for ch in text]
    total_w = sum(widths) + letter_spacing * max(0, len(text) - 1)
    cur_x = cx - total_w / 2
    max_h = 0
    for ch, cw in zip(text, widths):
        bbox = draw.textbbox((0, 0), ch, font=font)
        max_h = max(max_h, bbox[3] - bbox[1])
        draw.text((cur_x, y), ch, font=font, fill=fill)
        cur_x += cw + letter_spacing
    return max_h


def build_og_card():
    canvas = make_gradient_bg(W, H)

    # Subtle ambient radial glows
    canvas = add_soft_glow(canvas, 860, 290, 420, (232, 240, 228), 26)
    canvas = add_soft_glow(canvas, 310, 320, 360, (232, 240, 228), 22)

    # Subtle watermark Song Hy characters in corners (matching envelope cover style)
    if os.path.exists(CHU_HY_IMG):
        hy = Image.open(CHU_HY_IMG).convert("RGBA")
        hy_tl = hy.resize((270, 270), Image.Resampling.LANCZOS).rotate(26, expand=True, resample=Image.Resampling.BICUBIC)
        hy_tl = tint_image(hy_tl, (232, 240, 228), 0.10)
        canvas.alpha_composite(hy_tl, (-95, -95))

        hy_br = hy.resize((300, 300), Image.Resampling.LANCZOS).rotate(-24, expand=True, resample=Image.Resampling.BICUBIC)
        hy_br = tint_image(hy_br, (232, 240, 228), 0.11)
        canvas.alpha_composite(hy_br, (W - hy_br.width + 85, H - hy_br.height + 90))

    # Decorative outer double border frame (ivory gold tint)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    odraw.rounded_rectangle((22, 22, W - 22, H - 22), radius=18, outline=(232, 240, 228, 70), width=2)
    odraw.rounded_rectangle((32, 32, W - 32, H - 32), radius=12, outline=(218, 206, 178, 45), width=1)
    canvas = Image.alpha_composite(canvas, overlay)

    # Left side: Arch-framed wedding portrait
    arch_w, arch_h = 410, 506
    arch_x, arch_y = 82, (H - arch_h) // 2 + 4

    # Drop shadow behind arch
    shadow_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    arch_mask = make_arch_mask(arch_w, arch_h)
    shadow_fill = Image.new("RGBA", (arch_w, arch_h), (0, 0, 0, 130))
    shadow_layer.paste(shadow_fill, (arch_x + 8, arch_y + 12), arch_mask)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=16))
    canvas = Image.alpha_composite(canvas, shadow_layer)

    # Crop cover photo nicely around couple faces & bouquet (portrait 1707x2560 -> crop upper-center)
    cover = Image.open(COVER_IMG).convert("RGB")
    cw, ch = cover.size
    # Focus crop window keeping full couple + bouquet well-framed inside the arch
    crop_top = int(ch * 0.14)
    crop_bottom = int(ch * 0.86)
    cropped = cover.crop((0, crop_top, cw, crop_bottom))
    fitted = ImageOps.fit(cropped, (arch_w, arch_h), method=Image.Resampling.LANCZOS, centering=(0.5, 0.36))

    photo_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    photo_layer.paste(fitted.convert("RGBA"), (arch_x, arch_y), arch_mask)
    canvas = Image.alpha_composite(canvas, photo_layer)

    # Fine smooth anti-aliased ivory frame around arch
    canvas = composite_arch_outline_aa(canvas, arch_x - 9, arch_y - 9, arch_w + 18, arch_h + 18, (232, 240, 228, 125), width=1.6)
    canvas = composite_arch_outline_aa(canvas, arch_x, arch_y, arch_w, arch_h, (242, 246, 238, 210), width=2.0)

    # Right side: Invitation Card Typography
    right_cx = 845

    # Wax seal emblem at top of right column (4x anti-aliased)
    seal_r = 34
    seal_cy = 104
    canvas = add_soft_glow(canvas, right_cx, seal_cy, 62, (232, 240, 228), 72)
    seal_hi = Image.new("RGBA", (seal_r * 8 + 16, seal_r * 8 + 16), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(seal_hi)
    sdraw.ellipse((8, 8, seal_r * 8 + 8, seal_r * 8 + 8), fill=(232, 240, 228, 255), outline=(255, 255, 255, 230), width=6)
    seal_aa = seal_hi.resize((seal_r * 2 + 4, seal_r * 2 + 4), Image.Resampling.LANCZOS)
    canvas.alpha_composite(seal_aa, (right_cx - seal_r - 2, seal_cy - seal_r - 2))
    if os.path.exists(SEAL_ICON_IMG):
        seal_icon = Image.open(SEAL_ICON_IMG).convert("RGBA").resize((38, 38), Image.Resampling.LANCZOS)
        seal_icon = tint_image(seal_icon, (31, 58, 37), 0.95)
        canvas.alpha_composite(seal_icon, (right_cx - 19, seal_cy - 19))

    # Fonts
    font_kicker = load_font(FONT_LORA, 18)
    font_name = load_font(FONT_PLAYFAIR, 64, weight=500)
    font_amp = load_font(FONT_EB, 34, weight=400)
    font_date = load_font(FONT_LORA, 26)
    font_sub = load_font(FONT_LORA, 20)
    font_cta = load_font(FONT_LORA, 19)

    ivory = (242, 246, 238, 255)
    ivory_soft = (224, 234, 219, 235)
    gold_soft = (223, 212, 184, 235)

    # Pill badge CTA look (composited before text)
    pill_w, pill_h = 252, 46
    pill_x = right_cx - pill_w // 2
    pill_y = 524
    canvas = composite_pill_aa(canvas, pill_x, pill_y, pill_w, pill_h, (236, 243, 233, 250))

    draw = ImageDraw.Draw(canvas)

    # Kicker
    draw_centered_text(draw, "THIỆP MỜI LỄ THÀNH HÔN", right_cx, 158, font_kicker, gold_soft, letter_spacing=3)

    # Couple names
    draw_centered_text(draw, "Nho Tín", right_cx, 196, font_name, ivory)
    draw_centered_text(draw, "&", right_cx, 270, font_amp, gold_soft)
    draw_centered_text(draw, "Hồng Ngân", right_cx, 308, font_name, ivory)

    # Divider with diamond ornament
    div_y = 415
    draw.line((right_cx - 155, div_y, right_cx - 22, div_y), fill=(232, 240, 228, 125), width=1)
    draw.line((right_cx + 22, div_y, right_cx + 155, div_y), fill=(232, 240, 228, 125), width=1)
    draw.polygon(
        [(right_cx, div_y - 6), (right_cx + 6, div_y), (right_cx, div_y + 6), (right_cx - 6, div_y)],
        fill=gold_soft
    )

    # Date & details
    draw_centered_text(draw, "Chủ Nhật  •  20 . 12 . 2026", right_cx, 434, font_date, ivory)
    draw_centered_text(draw, "Trân trọng kính mời quý khách đến chung vui", right_cx, 478, font_sub, ivory_soft)

    # Precisely centered text inside CTA pill
    cta_text = "Mở thiệp cưới"
    tb = draw.textbbox((0, 0), cta_text, font=font_cta)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    cta_x = right_cx - tw / 2 - tb[0]
    cta_y = pill_y + (pill_h - th) / 2 - tb[1]
    draw.text((cta_x, cta_y), cta_text, font=font_cta, fill=(26, 51, 32, 255))

    # Save optimized progressive JPEG for fastest social preview loading
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    canvas.convert("RGB").save(OUT_PATH, format="JPEG", quality=88, optimize=True, progressive=True)
    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"Generated {OUT_PATH} ({W}x{H}, {size_kb:.1f} KB)")


if __name__ == "__main__":
    build_og_card()
