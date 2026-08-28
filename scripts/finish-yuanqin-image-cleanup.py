from pathlib import Path
import re
import cv2, numpy as np, pytesseract
from PIL import Image

ROOT=Path("assets/articles/yuanqin-debt-heart")
CJK=re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]")
SKIP={"一","二","三","六","人","入"}

def detect(img):
    s=2.0
    up=cv2.resize(img,None,fx=s,fy=s,interpolation=cv2.INTER_CUBIC)
    g=cv2.cvtColor(up,cv2.COLOR_BGR2GRAY)
    _,th=cv2.threshold(g,0,255,cv2.THRESH_BINARY+cv2.THRESH_OTSU)
    out=[]
    for v in (g,th,255-th):
        d=pytesseract.image_to_data(v,lang="chi_tra+eng",config="--oem 1 --psm 11",output_type=pytesseract.Output.DICT)
        for i,t in enumerate(d["text"]):
            chars="".join(CJK.findall((t or "").strip()))
            if not chars: continue
            try: conf=float(d["conf"][i])
            except: conf=-1
            if conf<25 or (chars in SKIP and conf<85): continue
            x=int(d["left"][i]/s); y=int(d["top"][i]/s)
            w=max(1,int(d["width"][i]/s)); h=max(1,int(d["height"][i]/s))
            if w*h>=20: out.append((x,y,w,h,chars,conf))
    keep=[]
    for b in sorted(out,key=lambda z:z[5],reverse=True):
        x,y,w,h,_,_=b
        dup=False
        for u in keep:
            ux,uy,uw,uh,_,_=u
            ix=max(0,min(x+w,ux+uw)-max(x,ux))
            iy=max(0,min(y+h,uy+uh)-max(y,uy))
            if ix*iy and ix*iy/min(w*h,uw*uh)>.55: dup=True; break
        if not dup: keep.append(b)
    return keep

for p in sorted(ROOT.glob("*.webp")):
    img=cv2.imread(str(p))
    before=detect(img)
    cur=img.copy()
    for _ in range(3):
        bs=detect(cur)
        if not bs: break
        mask=np.zeros(cur.shape[:2],np.uint8); H,W=mask.shape
        for x,y,w,h,_,_ in bs:
            px=max(4,int(h*.22)); py=max(4,int(h*.18))
            cv2.rectangle(mask,(max(0,x-px),max(0,y-py)),(min(W-1,x+w+px),min(H-1,y+h+py)),255,-1)
        cur=cv2.inpaint(cur,mask,7,cv2.INPAINT_TELEA)
    after=detect(cur)
    Image.fromarray(cv2.cvtColor(cur,cv2.COLOR_BGR2RGB)).save(p,"WEBP",quality=95,method=6)
    print("IMAGE",p.name)
    print("before:", " | ".join(f"{b[4]}({b[5]:.0f})" for b in before) or "(none)")
    print("after:", " | ".join(f"{b[4]}({b[5]:.0f})" for b in after) or "(none)")

repls={
"article-yuanqin-debt-heart.js":[("20260828-clean-text-1","20260828-clean-text-2")],
"static-articles.js":[("20260828-clean-text-1","20260828-clean-text-2")],
"articles-core-20260810-v6.js":[("20260828-yuanqin-clean-text-1","20260828-yuanqin-clean-text-2"),("20260828-clean-text-1","20260828-clean-text-2")],
"article-thumbnail-display-v2.js":[("20260828-yuanqin-clean-text-1","20260828-yuanqin-clean-text-2"),("20260828-clean-text-1","20260828-clean-text-2")],
"article-admin-draft-preview.js":[("20260828-yuanqin-clean-text-1","20260828-yuanqin-clean-text-2")],
"articles-v6.js":[("20260828-yuanqin-clean-text-1","20260828-yuanqin-clean-text-2")],
"articles.html":[("20260828-yuanqin-clean-text-1","20260828-yuanqin-clean-text-2")],
}
for fn,pairs in repls.items():
    p=Path(fn); s=p.read_text(encoding="utf-8")
    for a,b in pairs: s=s.replace(a,b)
    p.write_text(s,encoding="utf-8")
