import datetime as dt,json,re,subprocess,urllib.request,urllib.parse
P="lyyuan03-membership"
I="yuanshen-awakening-lingyu-tianwen-lingquan"
ROOT=f"https://firestore.googleapis.com/v1/projects/{P}/databases/(default)/documents"
TOKEN=subprocess.check_output(["gcloud","auth","print-access-token"],text=True).strip()
def request(path,method="GET",payload=None):
    data=None if payload is None else json.dumps(payload,ensure_ascii=False).encode("utf-8")
    req=urllib.request.Request(ROOT+path,data=data,method=method,headers={"Authorization":"Bearer "+TOKEN,"Content-Type":"application/json"})
    with urllib.request.urlopen(req,timeout=30) as response:return json.load(response)
def string(v):return {"stringValue":v}
path="/articles/"+I
fields=request(path)["fields"]
assert fields["status"]["stringValue"]=="published"
assert fields["accessType"]["stringValue"]=="open"
content=fields["content"]["stringValue"]
content=re.sub(r"(?m)^(#{2,3})\s*[一二三四五六七八九十]+[、.．]\s*",r"\1 ",content)
content=re.sub(r"(?m)^(#{2,3})\s*[0-9]+[、.．]\s*",r"\1 ",content)
content=re.sub(r"(?m)^\*([^*\n]+)\*\s*$",r"\1",content)
content=content.replace("https://lyyuan.tw/assets/articles/blessing-teacher-discernment/03-ritual-direct-20260930.jpg","https://lyyuan.tw/assets/articles/reconciliation-absolution-heart/03-ritual-order.jpg")
cover="https://lyyuan.tw/assets/articles/fantasy-intuition-yuanshen/cover.webp"
updates={"content":string(content),"coverImage":string(cover),"thumbnailImage":string(cover),"updatedAt":{"timestampValue":dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00","Z")}}
query=urllib.parse.urlencode([("updateMask.fieldPaths",k) for k in updates])
request(path+"?"+query,"PATCH",{"fields":updates})
result=request(path)["fields"]
assert result["content"]["stringValue"]==content
assert result["coverImage"]["stringValue"]==cover
assert result["status"]["stringValue"]=="published" and result["accessType"]["stringValue"]=="open"
assert not re.search(r"(?m)^#{2,3}\s*(?:[一二三四五六七八九十]+|[0-9]+)[、.．]",content)
print("Article formatting and image references verified")
