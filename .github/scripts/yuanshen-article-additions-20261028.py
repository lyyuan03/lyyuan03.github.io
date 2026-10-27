import datetime as dt,json,subprocess,urllib.request,urllib.parse
project="lyyuan03-membership"
article_id="yuanshen-awakening-lingyu-tianwen-lingquan"
base=f"https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents/articles/{article_id}"
token=subprocess.check_output(["gcloud","auth","print-access-token"],text=True).strip()
def call(url,method="GET",payload=None):
 data=None if payload is None else json.dumps(payload,ensure_ascii=False).encode()
 req=urllib.request.Request(url,data=data,method=method,headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"})
 with urllib.request.urlopen(req,timeout=40) as res:return json.load(res)
fields=call(base)["fields"]
assert fields["status"]["stringValue"]=="published"
assert fields["accessType"]["stringValue"]=="open"
body=fields["content"]["stringValue"]
sections=[
("啟靈、元神覺醒與元神合一","靈修圈常見的兩種誤解","在台灣的靈修圈，尤其是接觸靈山派修行的人，對靈動、會靈、靈語與天文並不陌生。有些人參加靈修活動後，身體開始靈動，或自然說出自己也聽不懂的靈語；也有人修行多年，始終沒有明顯反應，看到別人會說靈語、寫天文，便懷疑自己的元神是否尚未覺醒。\n\n另一種情況恰好相反。有些人因為靈拳打得漂亮、天文寫得特殊，便認為自己的元神靈格很高，甚至急著指導別人。這兩種判斷都有問題：外在現象必須放回每個人的修行階段與元神條件來理解，不能拿來當成所有修行者共同的衡量標準。"),
("靈拳與會靈","天文不只是特殊符號","天文不一定每次都在揭示前世、天命、主神或靈界祕密。有些天文與修行者當時的心性、生活狀態或需要面對的問題有關，也可能出現在特定的宗教儀式之中。不能因為一張紙上寫滿旁人看不懂的符號，就認定其中必然記載了高深天機。\n\n我會觀察天文書寫的變化。有些人初期寫出的是雜亂線條、蝌蚪般的符號，經過修持後，筆畫可能逐漸形成結構，甚至出現可以辨識的文字。但這些變化仍須連同書寫情境、修行者的元神狀態與天文用途一起判斷，不能只比較字跡是否特殊。"),
("老師應該引導學生","提前覺醒，不代表修行已經準備妥當","有些人的元神因為特殊因緣而提前覺醒，尚未經過完整的基礎修持，便出現靈語、靈動或其他明顯反應。這可能是原本的元神條件使然，卻不表示後天意識、生活習慣與心性已經準備妥當。\n\n有些人過度相信自己的感應，開始排斥他人的提醒；也有人將日常生活中發生的每一件事，都解釋成神明或靈界的安排。元神能力顯現得早，並不一定就是幸運。老師需要判斷他目前能承擔什麼、欠缺哪些基礎，再安排合適的修持。"),
("回到最初的問題","老師的目的，是教會學生自行辨識","尤其在天文的學習上，我不贊成學生每次寫完，都只等著老師替他翻譯。老師應該協助學生觀察書寫時的狀態、理解天文與自身修行的關係，逐步培養辨識能力。否則，即使得到很多答案，也未必真正認識自己的元神。\n\n初期需要老師帶領，與日後學會自行判斷並不矛盾。老師不是替學生完成修行，而是依照不同元神的條件引導，讓學生能逐漸承擔自己的修持。")
]
for anchor,title,addition in sections:
 if title in body:continue
 pos=body.find(anchor)
 if pos<0:raise RuntimeError("Missing anchor: "+anchor)
 start=body.rfind("\n",0,pos)+1
 body=body[:start]+title+"\n\n"+addition+"\n\n"+body[start:]
for _,title,_ in sections:assert title in body
mask=urllib.parse.urlencode([("updateMask.fieldPaths","content"),("updateMask.fieldPaths","updatedAt")])
updated={"fields":{"content":{"stringValue":body},"updatedAt":{"timestampValue":dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00","Z")}}}
call(base+"?"+mask,"PATCH",updated)
verified=call(base)["fields"]
assert verified["content"]["stringValue"]==body
assert verified["status"]["stringValue"]=="published" and verified["accessType"]["stringValue"]=="open"
print("SUCCESS: 4 sections added, original article preserved, no A case added")
