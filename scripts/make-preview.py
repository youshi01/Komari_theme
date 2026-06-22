from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps
import math
import random


ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "scripts" / "preview-sources"
OUT_PATH = ROOT / "preview.png"
README_OUT_PATH = ROOT / "preview-readme.png"

WIDTH = 1280
HEIGHT = 720

def first_existing(*candidates):
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return str(path)
    return candidates[0]


TITLE_FONT = first_existing(
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
    "C:/Windows/Fonts/georgiab.ttf",
    "C:/Windows/Fonts/timesbd.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
)
BODY_FONT = first_existing(
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
)
BODY_BOLD_FONT = first_existing(
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "C:/Windows/Fonts/segoeuib.ttf",
)


def vertical_gradient(size, top, bottom):
    width, height = size
    base = Image.new("RGBA", size)
    draw = ImageDraw.Draw(base)
    for y in range(height):
        t = y / max(height - 1, 1)
        row = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(4))
        draw.line((0, y, width, y), fill=row)
    return base


def blurred_blob(size, bbox, color, blur):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.ellipse(bbox, fill=color)
    return layer.filter(ImageFilter.GaussianBlur(blur))


def add_noise(image, amount=18):
    noise = Image.new("L", image.size)
    pixels = noise.load()
    rng = random.Random(7)
    for y in range(image.height):
        for x in range(image.width):
            pixels[x, y] = 128 + rng.randint(-amount, amount)
    soft = noise.filter(ImageFilter.GaussianBlur(0.4))
    noise_rgba = Image.merge("RGBA", (soft, soft, soft, Image.new("L", image.size, 24)))
    return ImageChops.overlay(image, noise_rgba)


def rounded_mask(size, radius):
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def crop_cover(image, size, centering=(0.5, 0.5)):
    return ImageOps.fit(image, size, method=Image.Resampling.LANCZOS, centering=centering)


def build_card(source_path, frame_size, accent, centering, radius=30):
    source = Image.open(source_path).convert("RGB")
    inner = crop_cover(source, (frame_size[0] - 26, frame_size[1] - 26), centering)

    card = Image.new("RGBA", frame_size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)

    # Outer frame
    draw.rounded_rectangle(
        (0, 0, frame_size[0] - 1, frame_size[1] - 1),
        radius=radius,
        fill=(245, 247, 251, 240),
        outline=(255, 255, 255, 210),
        width=2,
    )

    # Accent strip
    draw.rounded_rectangle(
        (14, 14, frame_size[0] - 14, 30),
        radius=10,
        fill=accent,
    )

    inner_rgba = inner.convert("RGBA")
    inner_mask = rounded_mask(inner.size, max(radius - 8, 18))
    card.paste(inner_rgba, (13, 13), inner_mask)

    gloss = Image.new("RGBA", frame_size, (0, 0, 0, 0))
    gloss_draw = ImageDraw.Draw(gloss)
    gloss_draw.rounded_rectangle(
        (1, 1, frame_size[0] - 2, 100),
        radius=radius,
        fill=(255, 255, 255, 34),
    )
    gloss = gloss.filter(ImageFilter.GaussianBlur(18))
    card = Image.alpha_composite(card, gloss)

    mask = rounded_mask(frame_size, radius)
    shadow = Image.new("RGBA", (frame_size[0] + 80, frame_size[1] + 80), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (24, 18, 24 + frame_size[0], 18 + frame_size[1]),
        radius=radius + 8,
        fill=(31, 45, 68, 82),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))

    framed = Image.new("RGBA", shadow.size, (0, 0, 0, 0))
    framed.alpha_composite(shadow, (0, 0))
    framed.paste(card, (24, 18), mask)
    return framed


def paste_rotated(base, overlay, xy, angle):
    rotated = overlay.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    base.alpha_composite(rotated, xy)


def pill(draw, xy, text, font, fill, text_fill, padding_x=18, padding_y=10):
    bbox = draw.textbbox((0, 0), text, font=font)
    width = bbox[2] - bbox[0] + padding_x * 2
    height = bbox[3] - bbox[1] + padding_y * 2
    x, y = xy
    draw.rounded_rectangle((x, y, x + width, y + height), radius=height // 2, fill=fill)
    draw.text((x + padding_x, y + padding_y - 2), text, font=font, fill=text_fill)
    return width


def main():
    canvas = vertical_gradient(
        (WIDTH, HEIGHT),
        (244, 239, 229, 255),
        (214, 224, 241, 255),
    )
    canvas = Image.alpha_composite(
        canvas,
        blurred_blob((WIDTH, HEIGHT), (-120, -160, 620, 450), (255, 191, 138, 118), 78),
    )
    canvas = Image.alpha_composite(
        canvas,
        blurred_blob((WIDTH, HEIGHT), (720, 280, 1360, 860), (102, 134, 196, 108), 92),
    )
    canvas = Image.alpha_composite(
        canvas,
        blurred_blob((WIDTH, HEIGHT), (420, 40, 980, 360), (255, 255, 255, 72), 56),
    )
    canvas = add_noise(canvas)

    draw = ImageDraw.Draw(canvas)
    title_font = ImageFont.truetype(TITLE_FONT, 106)
    subtitle_font = ImageFont.truetype(BODY_BOLD_FONT, 30)
    body_font = ImageFont.truetype(BODY_FONT, 22)
    pill_font = ImageFont.truetype(BODY_BOLD_FONT, 20)
    meta_font = ImageFont.truetype(BODY_FONT, 18)

    draw.text((76, 82), "YS", font=title_font, fill=(25, 34, 47, 255))
    draw.text((82, 186), "Komari theme", font=subtitle_font, fill=(60, 73, 95, 255))
    draw.text(
        (82, 238),
        "Fast homepage rendering, polished detail pages,\nand a cleaner theme-manage workflow.",
        font=body_font,
        fill=(76, 87, 108, 255),
        spacing=10,
    )

    x = 82
    y = 338
    x += pill(draw, (x, y), "Optimized homepage", pill_font, (255, 255, 255, 190), (27, 38, 55, 255))
    x += 14
    x += pill(draw, (x, y), "Light + Dark", pill_font, (34, 49, 73, 220), (244, 246, 250, 255))
    x = 82
    y = 394
    x += pill(draw, (x, y), "Detail view refresh", pill_font, (255, 244, 229, 220), (97, 61, 22, 255))
    x += 14
    pill(draw, (x, y), "Theme-manage", pill_font, (226, 233, 245, 230), (39, 58, 87, 255))

    draw.text(
        (84, 640),
        "Home  •  Detail  •  Theme manage",
        font=meta_font,
        fill=(77, 89, 112, 230),
    )

    light_card = build_card(
        SOURCES / "home-light.webp",
        (660, 390),
        (245, 196, 141, 255),
        (0.52, 0.16),
    )
    dark_card = build_card(
        SOURCES / "home-dark.webp",
        (560, 328),
        (78, 101, 148, 255),
        (0.52, 0.16),
    )
    manage_card = build_card(
        SOURCES / "home-light.webp",
        (430, 252),
        (132, 177, 181, 255),
        (0.52, 0.18),
    )

    paste_rotated(canvas, light_card, (552, 78), -4)
    paste_rotated(canvas, manage_card, (808, 46), 4)
    paste_rotated(canvas, dark_card, (456, 364), 2)

    frame = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    frame_draw = ImageDraw.Draw(frame)
    frame_draw.rounded_rectangle(
        (18, 18, WIDTH - 18, HEIGHT - 18),
        radius=34,
        outline=(255, 255, 255, 120),
        width=2,
    )
    canvas = Image.alpha_composite(canvas, frame)

    output = canvas.convert("RGB")
    output.save(OUT_PATH, format="PNG", optimize=True)
    output.save(README_OUT_PATH, format="PNG", optimize=True)
    print(f"Wrote {OUT_PATH}")
    print(f"Wrote {README_OUT_PATH}")


if __name__ == "__main__":
    main()
