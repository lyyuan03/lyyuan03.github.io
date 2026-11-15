import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';

const ARTICLE_ID = 'love-universal-emotion-and-fidelity';
const credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
if (!credentials.private_key) throw new Error('Missing Firebase credentials');
initializeApp({ credential: cert(credentials), projectId: 'lyyuan03-membership' });
const db = getFirestore();

const oldPassage = '當年撰寫《請問愛》，無極瑤池金母對愛的解釋，讓我必須重新思考長期以來習以為常的觀念。書中第一章談愛如何超越單一對象，第二章進一步分辨情感與愛；往後又從業力、生命經驗與靈魂意識，繼續探討人為什麼在關係裡反覆受困。單靠幾段摘錄，很難看見這些觀念彼此之間的連結。';
const oldShortPassage = '《請問愛》所談的愛，遠遠超過男女之間的情感。\n\n無極瑤池金母從愛的本質、情感的限制、業力與靈魂意識等不同層面，揭示人為什麼會受到情愛牽引，以及如何從個人的依戀中，逐漸認識更廣大的愛。';
const revisedPassage = '在長期的靈修指導中，我看過不少人反覆陷入相似的感情困境。即使換了伴侶，依戀、佔有與渴望被愛的習氣仍然存在。《請問愛》第一章談愛如何超越單一對象，第二章分辨情感與愛，再從業力、生命經驗與靈魂意識，深入探討這些習氣如何牽動人的念頭與選擇。讀到這裡，靈修人應該回頭檢查自己：究竟是哪一個念頭，讓自己一次又一次陷入相同的關係？';
const imagePaths = content => [...String(content || '').matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map(m => m[1]);
const count = (s, token) => s.split(token).length - 1;

function rewrite(original) {
  let result = String(original || '');
  const formerMentions = count(result, '母娘');
  result = result.replaceAll('母娘', '無極瑤池金母');
  let passageMode = 'not-present';
  if (result.includes(oldPassage)) {
    if (count(result, oldPassage) !== 1) throw new Error('Duplicate exact passage; stop without writing');
    result = result.replace(oldPassage, revisedPassage);
    passageMode = 'exact-paragraph';
  } else if (result.includes('當年撰寫《請問愛》')) {
    const paragraph = result.split(/\n\s*\n/).find(x => x.includes('當年撰寫《請問愛》'));
    if (!paragraph || count(result, '當年撰寫《請問愛》') !== 1 || paragraph.length > 800) throw new Error('Unrecognized target paragraph; stop without writing');
    result = result.replace(paragraph, revisedPassage);
    passageMode = 'historical-paragraph';
  } else if (result.includes(oldShortPassage)) {
    result = result.replace(oldShortPassage, revisedPassage);
    passageMode = 'canonical-summary';
  } else if (result.includes(revisedPassage)) {
    passageMode = 'already-updated';
  }
  if (result.includes('母娘')) throw new Error('Unexpected maternal wording remains');
  if (JSON.stringify(imagePaths(original)) !== JSON.stringify(imagePaths(result))) throw new Error('Unexpected image links modified');
  if (count(original, '<!-- paid-only -->') !== count(result, '<!-- paid-only -->')) throw new Error('Paid access marker altered');
  if (count(original, '<!-- member-only -->') !== count(result, '<!-- member-only -->')) throw new Error('Member marker altered');
  return { result, formerMentions, passageMode };
}

const publicRef = db.doc(`articles/${ARTICLE_ID}`);
const publicSnap = await publicRef.get();
if (!publicSnap.exists) throw new Error('Expected article was not found');
const publicBefore = publicSnap.data() || {};
const publicOriginal = String(publicBefore.content || '');
const publicChanged = rewrite(publicOriginal);
if (publicChanged.result !== publicOriginal) {
  await publicRef.update({ content: publicChanged.result });
  const verify = await publicRef.get();
  if (verify.data()?.content !== publicChanged.result || verify.data()?.status !== publicBefore.status || verify.data()?.accessType !== publicBefore.accessType) throw new Error('Public article verification failed');
}

const bodyRef = db.doc(`paidArticleBodies/${ARTICLE_ID}`);
const bodySnap = await bodyRef.get();
let privateReport = {exists: false, formerMentions: 0, passageMode: 'none'};
if (bodySnap.exists) {
  const bodyBefore = bodySnap.data() || {};
  const bodyOriginal = String(bodyBefore.content || '');
  const bodyChanged = rewrite(bodyOriginal);
  privateReport = {exists: true, formerMentions: bodyChanged.formerMentions, passageMode: bodyChanged.passageMode};
  if (bodyChanged.result !== bodyOriginal) {
    const nextVersion = Math.max(0, Number(bodyBefore.contentVersion || 0), Number(publicBefore.paidContentVersion || 0)) + 1;
    const newHash = createHash('sha256').update(bodyChanged.result).digest('hex');
    await bodyRef.update({content: bodyChanged.result, contentHash: newHash, contentVersion: nextVersion});
    await publicRef.update({paidContentHash: newHash, paidContentVersion: nextVersion});
    const [verifiedBody, verifiedPublic] = await Promise.all([bodyRef.get(), publicRef.get()]);
    if (verifiedBody.data()?.content !== bodyChanged.result || verifiedPublic.data()?.paidContentHash !== newHash || Number(verifiedPublic.data()?.paidContentVersion) !== nextVersion) throw new Error('Protected paid article verification failed');
  }
}

console.log('LOVE_JINMU_PATCH', JSON.stringify({
  articleId: ARTICLE_ID,
  statusUnchanged: publicBefore.status,
  accessTypeUnchanged: publicBefore.accessType,
  replacedMotherTerms: publicChanged.formerMentions,
  paragraphAction: publicChanged.passageMode,
  changedPublicArticle: publicChanged.result !== publicOriginal,
  protectedBody: privateReport
}));