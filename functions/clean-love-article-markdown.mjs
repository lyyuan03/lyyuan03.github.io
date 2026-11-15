// Safe, isolated cleanup. Never changes published/draft or paid/open flags.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
const ARTICLE_ID='love-universal-emotion-and-fidelity';
const creds=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
if (!creds.private_key) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON');
initializeApp({credential:cert(creds),projectId:'lyyuan03-membership'});
const db=getFirestore();
const clean = value => String(value || '').replaceAll('**','');
const articleRef=db.doc(`articles/${ARTICLE_ID}`);
const articleSnap=await articleRef.get();
if(!articleSnap.exists) throw new Error('Article missing; do not guess another target');
const doc=articleSnap.data() || {};
const oldContent=String(doc.content||'');
const revised=clean(oldContent);
const imagePaths=text => [...text.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map(m=>m[1]);
if(JSON.stringify(imagePaths(oldContent))!==JSON.stringify(imagePaths(revised)))throw new Error('Unexpected image change');
if(revised!==oldContent){
  await articleRef.update({content:revised});
  const after=await articleRef.get();
  if(after.data().content!==revised||after.data().status!==doc.status||after.data().accessType!==doc.accessType) throw new Error('Post-write mismatch');
}
const bodyRef=db.doc(`paidArticleBodies/${ARTICLE_ID}`);
const bodySnap=await bodyRef.get();
let privateReplacements=0;
if(bodySnap.exists){
  const source=String(bodySnap.data().content||'');
  const updated=clean(source);
  privateReplacements=(source.length-updated.length)/2;
  if(source!==updated){
    // Body versioning is preserved, but incremented when actual content changes.
    const {createHash}=await import('node:crypto');
    const nextVersion=Math.max(1,Number(bodySnap.data().contentVersion||0)+1);
    await bodyRef.update({content:updated,contentHash:createHash('sha256').update(updated).digest('hex'),contentVersion:nextVersion});
    const verify=await bodyRef.get();
    if(verify.data().content!==updated)throw new Error('Paid body verification failed');
  }
}
console.log('LOVE_MARKDOWN_CLEANUP', JSON.stringify({articleId:ARTICLE_ID, originalStatus:doc.status,originalAccessType:doc.accessType, removedPublicStars:oldContent.length-revised.length,removedPrivatePairs:privateReplacements, privateBodyExists:bodySnap.exists, paths:imagePaths(revised).length}));