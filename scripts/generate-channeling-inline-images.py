from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import os, math, random

W, H = 1600, 900
OUT = "assets/articles/channeling-ability-secrets-draft"
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(260905)

deep = np.array([7, 17, 6], dtype=float)
green = np.array([48, 58, 29], dtype=float)
tan = np.array([165, 130, 84], dtype=float)


def base_gradient(horizon=0.55, lightx=0.65):
    y = np.linspace(0, 1, H)[:, None]
    x = np.linspace(0, 1, W)[None, :]
    t = (1 - y) ** 1.5
    arr = np.zeros((H, W, 3), dtype=float)
    arr[:] = deep
    arr += t[:, :, None] * (green - deep) * 0.55
    gx = np.exp(-((x - lightx) / 0.32) ** 2)
    gy = np.exp(-((y - horizon) / 0.33) ** 2)
    arr += (gx * gy)[:, :, None] * (tan - deep) * 0.25
    arr += rng.normal(0, 5, (H, W, 1))
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").filter(ImageFilter.GaussianBlur(0.45))


def mist(im, seed):
    random.seed(seed)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(10):
        cy = random.randint(int(H * .18), int(H * .88))
        cx = random.randint(-100, W + 100)
        rx = random.randint(240, 600)
        ry = random.randint(25, 80)
        a = random.randint(10, 28)
        d.ellipse([cx-rx, cy-ry, cx+rx, cy+ry], fill=(235, 224, 199, a))
    layer = layer.filter(ImageFilter.GaussianBlur(50))
    return Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")


def hills(im, seed, layers=4):
    random.seed(seed)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    cols = [(8,17,8,225), (18,29,15,210), (38,46,24,175), (64,61,38,120)]
    for j in range(layers):
        base_y = int(H * (0.65 + 0.07*j))
        pts = [(0, H)]
        for i in range(11):
            xx = int(W * i / 10)
            yy = base_y + int(45 * math.sin(i * 1.1 + j) + random.randint(-35, 35))
            pts.append((xx, yy))
        pts += [(W, H)]
        d.polygon(pts, fill=cols[min(j, len(cols)-1)])
    return Image.alpha_composite(im.convert("RGBA"), layer).convert("RGB")


def vignette(im, strength=.38):
    arr = np.asarray(im).astype(float)
    yy, xx = np.mgrid[0:H, 0:W]
    dx = (xx - W/2)/(W/2)
    dy = (yy - H/2)/(H/2)
    r = np.sqrt(dx*dx + dy*dy)
    mask = np.clip((r - .3)/.9, 0, 1) * strength
    arr *= (1 - mask[:, :, None])
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def finish(im, name, seed):
    im = vignette(mist(im, seed))
    path = os.path.join(OUT, name)
    im.save(path, "JPEG", quality=91, optimize=True, progressive=True)
    return path


def img1():
    im = hills(base_gradient(.50, .53), 1, 4)
    layer = Image.new("RGBA", (W, H), (0,0,0,0)); d = ImageDraw.Draw(layer)
    for r,a,w in [(115,145,5),(190,105,4),(285,65,3),(390,35,2)]:
        d.ellipse([800-r,470-r,800+r,470+r], outline=(205,168,102,a), width=w)
    d.ellipse([770,315,830,375], fill=(10,14,9,245))
    d.polygon([(785,370),(815,370),(845,585),(755,585)], fill=(9,14,8,245))
    d.ellipse([785,430,815,460], fill=(240,214,150,230))
    return finish(Image.alpha_composite(im.convert("RGBA"), layer.filter(ImageFilter.GaussianBlur(.6))).convert("RGB"), "01-amplified-ability.jpg", 101)


def img2():
    im = hills(base_gradient(.47, .5), 2, 4)
    layer = Image.new("RGBA", (W,H), (0,0,0,0)); d = ImageDraw.Draw(layer)
    d.polygon([(690,H),(910,H),(845,550),(755,550)], fill=(118,102,72,65))
    centers=[(520,440),(800,375),(1080,440)]; rads=[55,72,55]
    for idx,(cx,cy) in enumerate(centers):
        for rr,a in [(130,25),(90,45),(rads[idx],120)]:
            d.ellipse([cx-rr,cy-rr,cx+rr,cy+rr], outline=(202,165,95,a), width=3)
        r=rads[idx]*.45
        d.ellipse([cx-r,cy-r,cx+r,cy+r], fill=(231,204,143,155))
    d.line([575,440,728,390], fill=(200,169,106,75), width=3)
    d.line([872,390,1025,440], fill=(200,169,106,75), width=3)
    return finish(Image.alpha_composite(im.convert("RGBA"), layer.filter(ImageFilter.GaussianBlur(.7))).convert("RGB"), "02-ability-heart-cultivation.jpg", 102)


def img3():
    im = base_gradient(.36, .69)
    layer = Image.new("RGBA", (W,H), (0,0,0,0)); d = ImageDraw.Draw(layer)
    tiers=[[(0,760),(0,620),(480,580),(650,650),(920,635),(1100,700),(1600,670),(1600,900)],[(0,610),(0,520),(390,470),(650,535),(930,480),(1180,560),(1600,500),(1600,900)],[(0,470),(0,400),(330,360),(560,405),(900,330),(1160,395),(1600,330),(1600,900)]]
    fills=[(20,31,16,215),(52,58,31,145),(94,85,51,82)]
    for pts,c in zip(tiers,fills): d.polygon(pts, fill=c)
    for xoff,a in [(0,90),(45,45),(90,20)]: d.polygon([(1120+xoff,0),(1360+xoff,0),(1040,700),(900,700)], fill=(220,193,137,a))
    d.ellipse([310,565,340,595], fill=(7,12,6,240)); d.polygon([(320,592),(330,592),(350,695),(300,695)], fill=(7,12,6,240))
    return finish(Image.alpha_composite(im.convert("RGBA"), layer.filter(ImageFilter.GaussianBlur(1.2))).convert("RGB"), "03-levels-of-spirit.jpg", 103)


def img4():
    im = base_gradient(.52, .70)
    layer = Image.new("RGBA", (W,H), (0,0,0,0)); d = ImageDraw.Draw(layer)
    d.rectangle([0,560,W,H], fill=(5,13,9,95))
    for r,a in [(150,22),(95,45),(52,170)]:
        d.ellipse([1160-r,380-r,1160+r,380+r], fill=(220,180,100,a) if r==52 else None, outline=(220,180,100,a), width=4)
    for i in range(15):
        yy=520+i*22; width=int(190*(1-i/18))
        d.line([1160-width,yy,1160+width,yy], fill=(202,161,87,max(8,70-i*4)), width=3)
    d.ellipse([520,535,550,565], fill=(8,12,7,245)); d.polygon([(528,562),(542,562),(555,650),(515,650)], fill=(8,12,7,245))
    d.line([535,650,395,860], fill=(181,153,101,55), width=16); d.line([535,650,1100,860], fill=(181,153,101,75), width=18)
    return finish(Image.alpha_composite(im.convert("RGBA"), layer.filter(ImageFilter.GaussianBlur(.8))).convert("RGB"), "04-desire-and-gain.jpg", 104)


def img5():
    im = hills(base_gradient(.43, .40), 5, 3)
    layer = Image.new("RGBA", (W,H), (0,0,0,0)); d = ImageDraw.Draw(layer); cx,cy=545,465
    for r,a,w in [(185,45,3),(120,80,3),(60,120,3)]: d.ellipse([cx-r,cy-r,cx+r,cy+r], outline=(218,184,119,a), width=w)
    d.polygon([(cx,cy-155),(cx+18,cy),(cx,cy+35),(cx-18,cy)], fill=(229,196,126,165)); d.ellipse([cx-14,cy-14,cx+14,cy+14], fill=(242,216,160,210))
    d.polygon([(1030,120),(1430,120),(1310,660),(1115,660)], fill=(227,209,163,35)); d.line([890,610,1490,610], fill=(220,200,150,55), width=2)
    return finish(Image.alpha_composite(im.convert("RGBA"), layer.filter(ImageFilter.GaussianBlur(.55))).convert("RGB"), "05-accuracy-vs-level.jpg", 105)


def img6():
    im = base_gradient(.44, .50)
    layer = Image.new("RGBA", (W,H), (0,0,0,0)); d = ImageDraw.Draw(layer)
    for x in [110,250,1380,1510]:
        d.rectangle([x,0,x+55,H], fill=(16,23,13,150)); d.rectangle([x+12,0,x+25,H], fill=(82,67,44,42))
    for r,a in [(260,25),(185,42),(110,75)]: d.ellipse([800-r,440-r,800+r,440+r], outline=(218,186,124,a), width=4)
    d.ellipse([770,330,830,390], fill=(6,12,7,245)); d.polygon([(775,388),(825,388),(860,575),(740,575)], fill=(6,12,7,245))
    d.polygon([(740,555),(610,650),(790,620)], fill=(6,12,7,245)); d.polygon([(860,555),(990,650),(810,620)], fill=(6,12,7,245))
    for rr,a in [(70,35),(42,90),(18,225)]: d.ellipse([800-rr,465-rr,800+rr,465+rr], fill=(238,209,145,a))
    d.line([330,695,1270,695], fill=(194,162,101,45), width=2)
    return finish(Image.alpha_composite(im.convert("RGBA"), layer.filter(ImageFilter.GaussianBlur(.8))).convert("RGB"), "06-return-to-heart.jpg", 106)


if __name__ == "__main__":
    paths = [img1(), img2(), img3(), img4(), img5(), img6()]
    for path in paths:
        with Image.open(path) as im:
            if im.size != (1600, 900):
                raise SystemExit(f"invalid dimensions: {path} {im.size}")
        print(path)
