from pathlib import Path

# Add a public metadata-only status collection rule. Draft article content remains private.
rules_path = Path("firestore.rules")
rules = rules_path.read_text(encoding="utf-8")
article_rule = '''    match /articles/{articleId} {
      allow read: if resource.data.status == "published" || isAdmin();
      allow create, update, delete: if isAdmin();
    }
'''
status_rule = '''
    match /articlePublicationStatus/{articleId} {
      allow read: if true;
      allow create, update: if isAdmin()
        && request.resource.data.keys().hasAll(["status", "updatedAt"])
        && request.resource.data.keys().hasOnly(["status", "hidden", "systemRecord", "updatedAt"])
        && request.resource.data.status in ["draft", "published"];
      allow delete: if isAdmin();
    }
'''
if "match /articlePublicationStatus/" not in rules:
    if rules.count(article_rule) != 1:
        raise SystemExit("Could not locate the articles rule block")
    rules = rules.replace(article_rule, article_rule + status_rule, 1)
rules_path.write_text(rules, encoding="utf-8")

# Mirror article status into the metadata-only collection for every write path.
functions_path = Path("functions/index.js")
source = functions_path.read_text(encoding="utf-8")
import_line = 'const { onDocumentWritten } = require("firebase-functions/v2/firestore");\n'
import_anchor = 'const { onRequest } = require("firebase-functions/v2/https");\n'
if import_line not in source:
    if source.count(import_anchor) != 1:
        raise SystemExit("Could not locate the Firebase Functions import anchor")
    source = source.replace(import_anchor, import_anchor + import_line, 1)

if "exports.syncArticlePublicationStatus" not in source:
    source = source.rstrip() + '''

exports.syncArticlePublicationStatus = onDocumentWritten(
  {
    document: "articles/{articleId}",
    region: REGION
  },
  async (event) => {
    const articleId = event.params.articleId;
    const statusRef = db.doc(`articlePublicationStatus/${articleId}`);
    const after = event.data?.after;

    if (!after?.exists) {
      const statusSnapshot = await statusRef.get();
      if (statusSnapshot.exists) await statusRef.delete();
      return;
    }

    const article = after.data() || {};
    await statusRef.set({
      status: article.status === "published" ? "published" : "draft",
      hidden: article.hidden === true,
      systemRecord: article.systemRecord === true,
      updatedAt: FieldValue.serverTimestamp()
    });
  }
);
''' + "\n"
functions_path.write_text(source, encoding="utf-8")
