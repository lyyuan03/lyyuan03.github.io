import json,re,subprocess,urllib.request,urllib.parse
project="lyyuan03-membership"
article="yuanshen-awakening-lingyu-tianwen-lingquan"
image="https://lyyuan.tw/assets/articles/yuanshen-awakening/yuanshen-five-key-points-20261028.jpg"
token=subprocess.check_output(["gcloud","auth","print-access-token"],text=True).strip()
base=f"https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents/articles/{article}"
def request(url,method="GET",data=None):
 body=None if data is None else json.dumps(data,ensure_ascii=False).encode()
 r=urllib.request.Request(url,method=method,data=body,headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"})
 with urllib.request.urlopen(r,timeout=40) as response:return json.load(response)
before=request(base);fields=before["fields"];original=fields["content"]["stringValue"]
assert fields["status"]["stringValue"]=="published"
block="## 元神覺醒的五個關鍵觀念\n\n![元神覺醒的五個關鍵觀念]("+image+")"
assert original.count(block)==1,("Image block count",original.count(block))
content=original.replace(block,"",1)
# Match first numbered concept heading (not the table of contents), accepting Chinese and Arabic numbers.
patterns=[
 r"(?m)^#{1,4}\s*(?:第[一1]個(?:觀念|重點)|[一1][、．.\s]+(?:啟靈|元神|靈語|天文|靈拳)|觀念[一1][：:、．.])[^\n]*$",
 r"(?m)^#{1,4}\s*[^\n]*(?:啟靈、元神覺醒與元神合一|啟靈與元神覺醒)[^\n]*$",
]
matches=[]
for pattern in patterns:
 matches=list(re.finditer(pattern,content))
 if matches:break
assert matches,("Could not find first concept heading safely; no change",content[:4000])
m=matches[0]
content=content[:m.start()]+block+"\n\n"+content[m.start():]
assert content.count(image)==1
assert re.sub(r"\\s+","",content.replace(block,"",1))==re.sub(r"\\s+","",original.replace(block,"",1))
if content!=original:
 url=base+"?"+urllib.parse.urlencode({"updateMask.fieldPaths":"content"})
 request(url,"PATCH",{"fields":{"content":{"stringValue":content}}})
after=request(base)["fields"]
assert after["content"]["stringValue"]==content
for key in fields:
 if key!="content":assert fields[key]==after[key],key
print("SUCCESS: infographic moved immediately before first concept heading:",m.group(0))
