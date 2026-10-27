import datetime as dt,json,re,subprocess,urllib.request,urllib.parse
P="lyyuan03-membership"
I="yuanshen-awakening-lingyu-tianwen-lingquan"
ROOT=f"https://firestore.googleapis.com/v1/projects/{P}/databases/(default)/documents"
TOKEN=subprocess.check_output(["gcloud","auth","print-access-token"],text=True).strip()
def req(path,method="GET",payload=None):
 data=None if payload is None else json.dumps(payload,ensure_ascii=False).encode()
 request=urllib.request.Request(ROOT+path,data=data,method=method,headers={"Authorization":"Bearer "+TOKEN,"Content-Type":"application/json"})
 with urllib.request.urlopen(request,timeout=30) as response:return json.load(response)
def st(v):return {"stringValue":v}
path="/articles/"+I
fields=req(path)["fields"]
assert fields["status"]["stringValue"]=="published" and fields["accessType"]["stringValue"]=="open"
body=fields["content"]["stringValue"]
question="我想請教老師，您在書中一直反覆說到，元神覺醒後自會講靈語、寫天文、打靈拳，這是每一個元神覺醒後都會有的現象嗎？如果沒有，是不是代表元神尚未覺醒？"
intro="讀者提問\n\n有網友閱讀《我在人間的元神覺醒》後，留下這個問題：\n\n「"+question+"」\n\n宇色老師回覆\n\n"
if question not in body:
 body=intro+body
body=re.sub(r"(?m)^#{1,6}\\s+(.+)$",lambda m:m.group(1),body)
body=re.sub(r"(?m)^\\s*\\*\\s*$","",body)
body=body.replace("**","")
updates={"content":st(body),"updatedAt":{"timestampValue":dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00","Z")}}
query=urllib.parse.urlencode([("updateMask.fieldPaths",k) for k in updates])
req(path+"?"+query,"PATCH",{"fields":updates})
verify=req(path)["fields"]
assert verify["content"]["stringValue"]==body
assert question in body and "#" not in body and "**" not in body
assert verify["status"]["stringValue"]=="published" and verify["accessType"]["stringValue"]=="open"
print("Published article updated: reader question first, no visible markdown heading symbols")
