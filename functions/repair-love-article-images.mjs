import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

const ARTICLE_ID = 'love-universal-emotion-and-fidelity';
const DIR = `assets/articles/${ARTICLE_ID}`;
const FILES = [
  '01-multiple-loves.webp', '02-emotion-born-in-contact.webp',
  '03-universal-love.webp', '04-choice-and-boundaries.webp',
  '05-patterns-and-reflection.webp', '06-reading-and-understanding.webp',
  'cover.webp', 'thumbnail-450x800.webp'
];
const OLD_THUMB = 'thumbnail-900x1600.svg';
const THUMB_URL = `https://lyyuan.tw/${DIR}/thumbnail-450x800.webp?v=20261115-image-repair`;
const COVER_URL = `${DIR}/cover.webp`;
const fixArticleImagePaths = input => {
  let text = String(input || '');
  for (const file of FILES.slice(0, 6)) {
    const oldName = file.replace(/\.webp$/, '.svg');
    text = text.replaceAll(`${DIR}/${oldName}`, `${DIR}/${file}`);
  }
  return text;
};
const findInlineImages = text => [...String(text || '').matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map(x => x[1]);

if (process.argv.includes('--self-test')) {
  const sample = `![a](${DIR}/01-multiple-loves.svg)\n![b](https://lyyuan.tw/${DIR}/06-reading-and-understanding.svg)`;
  const fixed = fixArticleImagePaths(sample);
  if (fixed.includes('.svg') || !fixed.includes('/01-multiple-loves.webp') || !fixed.includes('/06-reading-and-understanding.webp')) throw new Error('IMAGE_REPLACEMENT_SELF_TEST_FAILED');
  console.log('Image replacement self-test passed');
  process.exit(0);
}

for (const filename of FILES) {
  const filePath = `${DIR}/${filename}`;
  const original = readFileSync(filePath);
  if (original.length < 1000 || original.subarray(0,4).toString() !== 'RIFF' || original.subarray(8,12).toString() !== 'WEBP') {
    throw new Error(`INVALID_WEBP:${filePath}`);
  }
  const response = await fetch(`https://lyyuan.tw/${filePath}?v=20261115-image-repair`, { cache: 'no-store', signal: AbortSignal.timeout(14000) });
  const live = Buffer.from(await response.arrayBuffer());
  if (response.status !== 200 || !response.headers.get('content-type')?.includes('image/webp') || live.length !== original.length || !live.equals(original)) {
    throw new Error(`LIVE_IMAGE_MISMATCH:${filename}:${response.status}:${live.length}`);
  }
}
console.log('LIVE_IMAGES_VERIFIED 8 of 8 with exact byte comparison');

const account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
if (!account.private_key) throw new Error('FIREBASE_SERVICE_ACCOUNT missing');
initializeApp({ credential: cert(account), projectId: 'lyyuan03-membership' });
const db = getFirestore();
const articleRef = db.doc(`articles/${ARTICLE_ID}`);
const settingsRef = db.doc('articles/__article-thumbnail-settings');
const [articleSnapshot, settingsSnapshot] = await Promise.all([articleRef.get(), settingsRef.get()]);
if (!articleSnapshot.exists) throw new Error('ARTICLE_MISSING');
const article = articleSnapshot.data() || {};
const existingContent = String(article.content || '');
const nextContent = fixArticleImagePaths(existingContent);
const previousImages = findInlineImages(existingContent);
const currentImages = findInlineImages(nextContent);
if (previousImages.length !== currentImages.length || nextContent.replaceAll('.webp', '.svg') === existingContent && existingContent === '') {
  throw new Error('IMAGE_COUNT_OR_CONTENT_INVALID');
}
for (const image of currentImages) {
  if (image.includes(`${DIR}/`) && !image.includes('.webp')) throw new Error(`UNCORRECTED_IMAGE:${image}`);
}
const articlePatch = {};
if (nextContent !== existingContent) articlePatch.content = nextContent;
const coverImage = String(article.coverImage || '');
if (coverImage.includes(`${DIR}/`) && coverImage.includes('.svg')) articlePatch.coverImage = COVER_URL;
const thumbImage = String(article.thumbnailImage || '');
if (!thumbImage.includes('thumbnail-450x800.webp') && (thumbImage.includes(OLD_THUMB) || thumbImage.includes(`${DIR}/`))) {
  articlePatch.thumbnailImage = THUMB_URL;
}

const settings = settingsSnapshot.data() || {};
const nestedPatch = {};
const thumbnailSettings = settings.settings?.[ARTICLE_ID];
if (thumbnailSettings && thumbnailSettings.thumbnailImage?.includes(OLD_THUMB)) {
  nestedPatch.settings = { [ARTICLE_ID]: { thumbnailImage: THUMB_URL } };
}
const inlineSettings = settings.inlineImageSettings?.[ARTICLE_ID];
if (Array.isArray(inlineSettings?.images)) {
  const nextInline = inlineSettings.images.map(image => ({ ...image, src: fixArticleImagePaths(image.src) }));
  if (JSON.stringify(nextInline) !== JSON.stringify(inlineSettings.images)) {
    nestedPatch.inlineImageSettings = { [ARTICLE_ID]: { images: nextInline } };
  }
}

console.log('REPAIR_PLAN', JSON.stringify({
  originalStatus: article.status, originalAccessType: article.accessType,
  oldImages: previousImages, updatedImages: currentImages,
  articleKeys: Object.keys(articlePatch), settingsKeys: Object.keys(nestedPatch),
  hasProtectedPaidBody: (await db.doc(`paidArticleBodies/${ARTICLE_ID}`).get()).exists
}));
if (Object.keys(articlePatch).length || Object.keys(nestedPatch).length) {
  const batch = db.batch();
  if (Object.keys(articlePatch).length) batch.set(articleRef, articlePatch, { merge: true });
  if (Object.keys(nestedPatch).length) batch.set(settingsRef, nestedPatch, { merge: true });
  await batch.commit();
}
const [verifiedArticle, verifiedSettings] = await Promise.all([articleRef.get(), settingsRef.get()]);
const updated = verifiedArticle.data() || {};
const updatedSettings = verifiedSettings.data() || {};
if (updated.content !== nextContent || updated.status !== article.status || updated.accessType !== article.accessType) throw new Error('ARTICLE_VERIFY_FAILED');
if (updated.coverImage?.includes('.svg') || updated.thumbnailImage?.includes('.svg') || updatedSettings.settings?.[ARTICLE_ID]?.thumbnailImage?.includes('.svg')) throw new Error('IMAGE_VERIFY_FAILED');
if (nextContent.includes(`${DIR}/01-multiple-loves.svg`)) throw new Error('INLINE_VERIFY_FAILED');
console.log('REPAIR_SUCCESS', JSON.stringify({ articleId: ARTICLE_ID, status: updated.status, accessType: updated.accessType, contentImageCount: currentImages.length, cover: updated.coverImage, thumbnail: updated.thumbnailImage, settingsThumbnail: updatedSettings.settings?.[ARTICLE_ID]?.thumbnailImage || '' }));