"""Builds a Y4M fake-camera video (640x480, 30 frames) showing the given PNG, for Chromium's
--use-file-for-fake-video-capture. Used by e2e.cjs to test real QR decoding through the scanner."""
import sys

from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
W, H, FRAMES = 640, 480, 30

im = Image.open(src).convert("RGB")
scale = min((W * 0.7) / im.width, (H * 0.7) / im.height)
im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.LANCZOS)
canvas = Image.new("RGB", (W, H), (255, 255, 255))
canvas.paste(im, ((W - im.width) // 2, (H - im.height) // 2))

y, cb, cr = canvas.convert("YCbCr").split()
cb = cb.resize((W // 2, H // 2), Image.BILINEAR)
cr = cr.resize((W // 2, H // 2), Image.BILINEAR)
frame = b"FRAME\n" + y.tobytes() + cb.tobytes() + cr.tobytes()
with open(dst, "wb") as f:
    f.write(b"YUV4MPEG2 W%d H%d F30:1 Ip A1:1 C420jpeg\n" % (W, H))
    for _ in range(FRAMES):
        f.write(frame)
print(dst)
