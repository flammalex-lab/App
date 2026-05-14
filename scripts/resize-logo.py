#!/usr/bin/env python3
"""
Python/Pillow fallback for generating PWA/favicon derivatives.

See scripts/resize-logo.mjs for the Node/sharp version. Both produce the same
files under public/icons/.

Usage:
    python3 scripts/resize-logo.py
"""
from pathlib import Path
from PIL import Image

SRC = Path("public/images/flf-logo.png")
OUT_DIR = Path("public/icons")
SIZES = [32, 152, 180, 192, 512]


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    src = Image.open(SRC).convert("RGBA")
    for size in SIZES:
        resized = src.resize((size, size), Image.LANCZOS)
        png_out = OUT_DIR / f"icon-{size}.png"
        webp_out = OUT_DIR / f"icon-{size}.webp"
        # optimize=True + the PNG quantizer downstream keeps file size lean.
        resized.save(png_out, format="PNG", optimize=True)
        resized.save(webp_out, format="WEBP", quality=82, method=6)
        print(f"wrote {png_out} ({png_out.stat().st_size} B) + {webp_out} ({webp_out.stat().st_size} B)")


if __name__ == "__main__":
    main()
