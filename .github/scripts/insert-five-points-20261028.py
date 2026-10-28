import json,subprocess,urllib.request,urllib.parse,time
project="lyyuan03-membership"
article="yuanshen-awakening-lingyu-tianwen-lingquan"
image="https://lyyuan.tw/assets/articles/yuanshen-awakening/yuanshen-five-key-points-20261028.jpg"
for i in range(30):
 try:
  with urllib.request.urlopen(urllib.request.Request(image,method="HEAD"),timeout=20) as response:
   assert response.status==200
  break
 except Exception:
  if i==29:raise
  time.sleep(10)
token=subprocess.check_output(["gcloud","auth","print-access-token"],text=True).strip()
base=f"https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents/articles/{article}"
def request(url,method="GET",data=None):
 body=None if data is None else json.dumps(data,ensure_ascii=False).encode()
 r=urllib.request.Request(url,method=method,data=body,headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"})
 with urllib.request.urlopen(r,timeout=40) as response:return json.load(response)
before=request(base)
fields=before["fields"]
assert fields["status"]["stringValue"]=="published"
content=fields["content"]["stringValue"]
if image in content:
 print("Already included; no duplicate added")
else:
 addition="\n\n## 元神覺醒的五個關鍵觀念\n\n![元神覺醒的五個關鍵觀念]("+image+")\n"
 content=content.rstrip()+addition
 url=base+"?"+urllib.parse.urlencode({"updateMask.fieldPaths":"content"})
 request(url,"PATCH",{"fields":{"content":{"stringValue":content}}})
after=request(base)["fields"]
assert after["content"]["stringValue"]==content
for key in fields:
 if key!="content":assert fields[key]==after[key],key
print("SUCCESS: original five-points infographic inserted in article conclusion; other fields unchanged")
