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
intro="網友提問：元神覺醒後，一定會說靈語、寫天文、打靈拳嗎？\n\n日前，有位網友在 Facebook 留言，提出了一個關於元神覺醒的問題：\n\n「"+question+"」\n\n當時，靈元院小編已經針對這個問題作了回覆，說明每個人的元神條件與修行過程不同，靈語、天文及靈拳並不是判斷元神是否覺醒的唯一依據，也因此需要老師依照個別情況帶領。\n\n不過，這位網友提出的問題，其實還可以談得更深入。\n\n為什麼有些人在元神覺醒後會出現靈語、天文或靈拳，有些人卻完全沒有這些現象？如果這些都不是必要條件，老師又該如何判斷一個人的元神狀態？\n\n這些問題，牽涉到元神本身的條件、覺醒的過程，以及覺醒之後的修持方向。\n\n我想藉由這次的提問，進一步談談其中的差別。\n\n"
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
