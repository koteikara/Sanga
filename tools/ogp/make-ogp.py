"""ページ別のOGP画像（1200x630）を作る。文言を変えたら再実行する。
使い方: python3 tools/ogp/make-ogp.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
OUT = Path(__file__).resolve().parents[2] / "public" / "assets" / "ogp"
PAGES = {
    "timeline": ("サポータータイムライン", "チケット販売開始とキックオフを時系列で", "#8a1f6b"),
    "timeline-calendar": ("カレンダーで受け取る", "販売開始と試合日程を自分のカレンダーへ", "#8a1f6b"),
    "season": ("2026/27 年間スケジュール", "全試合の日程と参戦予定の保存", "#7b0064"),
    "squad": ("予想スカッド作成", "スタメンを並べて画像で共有", "#14532d"),
    "calendar": ("過密日程カレンダー", "試合間隔を色で見る 2026/27", "#c8402e"),
    "trade": ("求・譲 投稿フォーマット", "チケット・グッズ交換をXに投稿しやすく", "#5b1f7e"),
}

def hex2rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

for key, (title, sub, accent) in PAGES.items():
    img = Image.new("RGB", (1200, 630), hex2rgb(accent))
    d = ImageDraw.Draw(img)
    for y in range(630):  # 下へ向かって暗くする
        a = y / 630 * 0.45
        r, g, b = hex2rgb(accent)
        d.line([(0, y), (1200, y)], fill=(int(r * (1 - a)), int(g * (1 - a)), int(b * (1 - a))))
    d.rectangle([60, 60, 1140, 570], outline=(255, 255, 255), width=4)
    d.text((100, 100), "SANGA TOOLBOX", font=ImageFont.truetype(FONT, 40), fill=(255, 255, 255))
    size = 84
    while ImageFont.truetype(FONT, size).getlength(title) > 1000:
        size -= 4
    d.text((100, 240), title, font=ImageFont.truetype(FONT, size), fill=(255, 255, 255))
    d.text((100, 370), sub, font=ImageFont.truetype(FONT, 40), fill=(240, 228, 255))
    d.text((100, 490), "京都サンガF.C.の公式サイトではありません", font=ImageFont.truetype(FONT, 26), fill=(220, 210, 235))
    img.save(OUT / f"{key}.jpg", quality=85)
    print("wrote", key)
