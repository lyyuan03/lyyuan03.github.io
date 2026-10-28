import json,subprocess,urllib.request,urllib.parse,datetime as dt
P="lyyuan03-membership"
I="yuanshen-awakening-lingyu-tianwen-lingquan"
OLD="https://lyyuan.tw/assets/articles/historical-yuanshen-destiny-cultivation/04-tianwen-original-photo.jpg"
NEW="https://lyyuan.tw/assets/articles/yuanshen-awakening/tianwen-flat-replacement-20261028.jpg"
root=f"https://firestore.googleapis.com/v1/projects/{P}/databases/(default)/documents"
token=subprocess.check_output(["gcloud","auth","print-access-token"],text=True).strip()
def req(path,method="GET",payload=None):
 data=None if payload is None else json.dumps(payload,ensure_ascii=False).encode()
 request=urllib.request.Request(root+path,data=data,method=method,headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"})
 with urllib.request.urlopen(request,timeout=35) as r:return json.load(r)
with urllib.request.urlopen(urllib.request.Request(NEW,method="HEAD"),timeout=30) as r:assert r.status==200
path="/articles/"+I
doc=req(path);f=doc["fields"]
assert f["status"]["stringValue"]=="published" and f["accessType"]["stringValue"]=="open"
original=f["content"]["stringValue"]
if NEW in original:
 assert OLD not in original
 print("Already replaced");quit()
assert original.count(OLD)==1,("Expected one old inline image",original.count(OLD))
updated=original.replace(OLD,NEW,1)
assert len(updated)-len(original)==len(NEW)-len(OLD)
mask=urllib.parse.urlencode({"updateMask.fieldPaths":"content"})
req(path+"?"+mask,"PATCH",{"fields":{"content":{"stringValue":updated}}})
verify=req(path)["fields"]
assert verify["content"]["stringValue"]==updated
assert verify["status"]["stringValue"]=="published" and verify["accessType"]["stringValue"]=="open"
for key in ["coverImage","thumbnailImage"]:
 assert verify.get(key)==f.get(key),(key,"changed")
print("SUCCESS: replaced only inline Tianwen photo; all other text and cover fields unchanged")
