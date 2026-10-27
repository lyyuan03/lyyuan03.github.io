import json,subprocess,urllib.request,urllib.error,urllib.parse,datetime as dt
P="lyyuan03-membership"
I="yuanshen-awakening-lingyu-tianwen-lingquan"
BASE="https://lyyuan.tw/assets/articles/"
COVER=BASE+"thumbnails/yuanshen-awakening.jpg"
TIANWEN=BASE+"historical-yuanshen-destiny-cultivation/04-tianwen-original-photo.jpg"
RITUAL=BASE+"blessing-teacher-discernment/03-ritual-direct-20260930.jpg"
root=f"https://firestore.googleapis.com/v1/projects/{P}/databases/(default)/documents"
token=subprocess.check_output(["gcloud","auth","print-access-token"],text=True).strip()
def req(path,method="GET",payload=None):
    data=None if payload is None else json.dumps(payload,ensure_ascii=False).encode()
    r=urllib.request.Request(root+path,data=data,method=method,headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"})
    with urllib.request.urlopen(r,timeout=30) as response:return json.loads(response.read())
def s(x):return {"stringValue":x}
for url in [COVER,TIANWEN,RITUAL]:
    with urllib.request.urlopen(urllib.request.Request(url,method="HEAD"),timeout=20) as response:
        assert response.status==200,(url,response.status)
path="/articles/"+I
doc=req(path)
f=doc["fields"]
assert f["status"]["stringValue"]=="published"
assert f["accessType"]["stringValue"]=="open"
assert f.get("privatePaidContent",{}).get("booleanValue") is False
original=f["content"]["stringValue"]
img1="![天文書寫實際照片]("+TIANWEN+")\n\n*天文書寫實際照片，供讀者了解書寫形式；並非蘇監院本人作品。*\n\n"
img2="![台灣宗教儀式現場照片]("+RITUAL+")\n\n*宗教儀式現場照片，供讀者了解法務環境；並非蘇監院執行收驚或祭改的紀錄。*\n\n"
anchor1="## 四、靈拳與會靈：不要只看外在動作"
anchor2="## 六、元神能力與心性修持不能互相取代"
assert original.count(anchor1)==1 and original.count(anchor2)==1
if TIANWEN in original and RITUAL in original:
    updated=original
else:
    assert TIANWEN not in original and RITUAL not in original
    updated=original.replace(anchor1,img1+anchor1).replace(anchor2,img2+anchor2)
now=dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00","Z")
changes={"content":s(updated),"coverImage":s(COVER),"thumbnailImage":s(COVER),"updatedAt":{"timestampValue":now}}
query=urllib.parse.urlencode([("updateMask.fieldPaths",x) for x in changes])
req(path+"?"+query,"PATCH",{"fields":changes})
v=req(path)["fields"]
assert v["content"]["stringValue"]==updated
assert v["coverImage"]["stringValue"]==COVER
assert v["thumbnailImage"]["stringValue"]==COVER
assert v["status"]["stringValue"]=="published" and v["accessType"]["stringValue"]=="open"
print(json.dumps({"status":"published","accessType":"open","cover":COVER,"inlineImages":[TIANWEN,RITUAL],"url":"https://lyyuan.tw/articles.html?id="+I},ensure_ascii=False))
