import { auth, db, isAdminEmail } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, doc, getDoc, getDocs, query, setDoc, serverTimestamp, where } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const ARTICLE_ID = 'love-universal-emotion-and-fidelity';
const ENVELOPE_URL = './secure-imports/love-universal-emotion-and-fidelity-20261115.enc.json';
const PAID_MARKER = '<!-- paid-only -->';
const keyField = document.querySelector('#decryption-key');
const button = document.querySelector('#import-paid-love');
const status = document.querySelector('#import-status');
const resultLink = document.querySelector('#result-link');

function setStatus(message, error = false) {
  status.textContent = message;
  status.dataset.kind = error ? 'error' : 'info';
}
function decodeBase64Url(value = '') {
  const normal = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normal + '='.repeat((4 - normal.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}
function hex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function digest(text) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
}
async function decryptEnvelope(keyText) {
  const response = await fetch(ENVELOPE_URL, { cache: 'no-store' });
  if (!response.ok) throw new Error(`無法載入加密文章：HTTP ${response.status}`);
  const envelope = await response.json();
  if (envelope.algorithm !== 'AES-GCM-256' || envelope.compression !== 'gzip' || envelope.articleId !== ARTICLE_ID) {
    throw new Error('匯入包格式或文章識別碼不正確');
  }
  const rawKey = decodeBase64Url(keyText.trim());
  if (rawKey.length !== 32) throw new Error('解密金鑰格式不正確');
  const cryptoKey = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decodeBase64Url(envelope.iv) }, cryptoKey, decodeBase64Url(envelope.ciphertext));
  const dataStream = new Blob([decrypted]).stream().pipeThrough(new DecompressionStream('gzip'));
  const dataBytes = new Uint8Array(await new Response(dataStream).arrayBuffer());
  const actualHash = hex(await crypto.subtle.digest('SHA-256', dataBytes));
  if (actualHash !== envelope.plaintextSha256) throw new Error('解密檔案的雜湊驗證失敗');
  return JSON.parse(new TextDecoder().decode(dataBytes));
}
async function inspectImages(payload) {
  const paths = [payload.coverImage, payload.thumbnailImage, ...(payload.expectedImagePaths || [])];
  if (paths.length !== 8 || new Set(paths).size !== 8 || paths.some(path => !String(path).startsWith(`assets/articles/${ARTICLE_ID}/`) || !String(path).endsWith('.webp'))) {
    throw new Error('文章圖片數量或格式不正確');
  }
  const results = await Promise.all(paths.map(async path => {
    const r = await fetch('./' + path, { method: 'HEAD', cache: 'no-store' });
    return { path, ok: r.ok, status: r.status };
  }));
  const missing = results.filter(item => !item.ok);
  if (missing.length) throw new Error(`圖片未通過檢查：${missing.map(item => `${item.path}(${item.status})`).join('、')}`);
}
async function existingArticleRef() {
  const byId = doc(db, 'articles', ARTICLE_ID);
  const snapshot = await getDoc(byId);
  if (snapshot.exists()) return { ref: byId, snap: snapshot };
  const matching = await getDocs(query(collection(db, 'articles'), where('slug', '==', ARTICLE_ID)));
  if (matching.size > 1) throw new Error('存在多筆相同網址識別碼的文章，請先於後台整理');
  if (matching.size === 1) return { ref: matching.docs[0].ref, snap: matching.docs[0] };
  return { ref: byId, snap: snapshot };
}
async function publishPaidArticle(payload) {
  if (payload.articleId !== ARTICLE_ID || payload.accessType !== 'paid' || payload.status !== 'published') {
    throw new Error('文章識別碼或付費發布狀態不正確');
  }
  const publicText = String(payload.publicContent || '').replaceAll('**', '').trim();
  const privateText = String(payload.privateContent || '').replaceAll('**', '').trim();
  if (!publicText || privateText.length < 1000 || publicText.includes(PAID_MARKER) || privateText.includes(PAID_MARKER)) {
    throw new Error('試閱區／會員正文格式不符合規格');
  }
  await inspectImages(payload);
  const { ref: articleRef, snap: existing } = await existingArticleRef();
  const oldData = existing.exists() ? existing.data() : {};
  const privateRef = doc(db, 'paidArticleBodies', articleRef.id);
  const oldPrivate = await getDoc(privateRef);
  const nextVersion = Math.max(0, Number(oldPrivate.data()?.contentVersion || 0)) + 1;
  const bodyHash = await digest(privateText);
  // 先寫受 Firestore 規則保護的正文並回讀比對，再開放付費文章的試閱。
  await setDoc(privateRef, {
    articleId: articleRef.id, title: payload.title, status: 'published', active: true,
    content: privateText, contentVersion: nextVersion, contentHash: bodyHash,
    source: 'love-paid-admin-import-20261115', updatedAt: serverTimestamp()
  }, { merge: true });
  const verifiedPrivate = await getDoc(privateRef);
  if (!verifiedPrivate.exists() || verifiedPrivate.data()?.content !== privateText) throw new Error('受保護的付費正文寫入驗證失敗');

  const safePublicContent = `${publicText}\n\n${PAID_MARKER}`;
  const meta = {
    id: ARTICLE_ID, slug: ARTICLE_ID, title: payload.title,
    category: oldData.category || 'worldly', displayCategory: oldData.displayCategory || '人生',
    series: oldData.series || '情愛與靈修',
    status: 'published', accessType: 'paid', hidden: false, systemRecord: false,
    privatePaidContent: true, paidContentHash: bodyHash, paidContentVersion: nextVersion,
    content: safePublicContent,
    coverImage: payload.coverImage, thumbnailImage: payload.thumbnailImage,
    thumbnailTitle: payload.thumbnailTitle,
    excerpt: oldData.excerpt || '從黃仁勳事件談情愛、博愛、創造力與四項靈修心法，探討如何面對情慾並兼顧家庭與事業。',
    bookTitle: oldData.bookTitle || '請問愛：愛的真諦（上冊）',
    bookAuthor: oldData.bookAuthor || '宇色 Osel',
    bookPublisher: oldData.bookPublisher || '柿子文化',
    bookPurchaseUrl: oldData.bookPurchaseUrl || 'https://www.books.com.tw/products/0011022589',
    updatedAt: serverTimestamp()
  };
  if (oldData.status !== 'published' || !oldData.publishedAt) meta.publishedAt = serverTimestamp();
  await setDoc(articleRef, meta, { merge: true });
  const verifiedPublic = await getDoc(articleRef);
  const posted = verifiedPublic.data() || {};
  if (posted.accessType !== 'paid' || posted.status !== 'published' || posted.content !== safePublicContent || posted.privatePaidContent !== true) {
    throw new Error('公開試閱與付費狀態寫入驗證失敗');
  }
  if (posted.content.includes(privateText.slice(0, 100))) throw new Error('公開資料出現受保護正文，請立刻檢查');
  return { articleId: articleRef.id, paidContentVersion: nextVersion };
}

onAuthStateChanged(auth, user => {
  const admin = Boolean(user?.email) && isAdminEmail(user.email);
  button.disabled = !admin;
  setStatus(admin ? `已驗證管理員：${user.email}。請輸入本次匯入金鑰。` : '請先登入靈元院網站管理員帳號，再返回本頁操作。', !admin);
});

button.addEventListener('click', async () => {
  if (!auth.currentUser?.email || !isAdminEmail(auth.currentUser.email)) {
    setStatus('目前登入者沒有管理員權限。', true); return;
  }
  button.disabled = true;
  resultLink.hidden = true;
  try {
    setStatus('正在驗證加密文章與圖片……');
    const payload = await decryptEnvelope(keyField.value);
    setStatus('加密驗證完成，正在安全寫入付費正文與公開試閱……');
    const result = await publishPaidArticle(payload);
    keyField.value = '';
    resultLink.hidden = false;
    setStatus(`完成：${payload.title} 已發布為贊助付費文章。正文版本 ${result.paidContentVersion}，會員權限由既有 Firestore 規則控制。`);
  } catch (error) {
    console.error('贊助付費文章匯入失敗', error);
    setStatus(`匯入失敗：${error?.message || String(error)}`, true);
  } finally {
    button.disabled = !auth.currentUser?.email || !isAdminEmail(auth.currentUser.email);
  }
});