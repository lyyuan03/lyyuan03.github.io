"use strict";

const crypto = require("node:crypto");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineJsonSecret } = require("firebase-functions/params");

const REGION = "asia-east1";
const SITE_URL = "https://lyyuan.tw";
const ADMIN_EMAILS = new Set(["lyyuan03@gmail.com"]);
const db = getFirestore();
const youtubeOAuthConfig = defineJsonSecret("YOUTUBE_OAUTH_CONFIG");
const TOKEN_DOC = db.collection("privateIntegrations").doc("youtube");

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function requireAdmin(request) {
  const email = normalizeEmail(request.auth?.token?.email);
  if (!request.auth || !ADMIN_EMAILS.has(email)) {
    throw new HttpsError("permission-denied", "僅限靈元院管理員操作。");
  }
  return { uid: request.auth.uid, email };
}

function config() {
  const value = youtubeOAuthConfig.value();
  if (!value?.clientId || !value?.clientSecret || !value?.redirectUri) {
    throw new Error("YOUTUBE_OAUTH_CONFIG 尚未完整設定。");
  }
  return value;
}

async function googleToken(params) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error || "Google OAuth token 交換失敗。");
  return data;
}

async function accessToken() {
  const snapshot = await TOKEN_DOC.get();
  if (!snapshot.exists) throw new HttpsError("failed-precondition", "YouTube 尚未授權連接。");
  const stored = snapshot.data();
  const expiresAt = stored.expiresAt?.toDate?.() || new Date(0);
  if (stored.accessToken && expiresAt.getTime() > Date.now() + 60_000) return stored.accessToken;
  if (!stored.refreshToken) throw new HttpsError("failed-precondition", "YouTube 授權已失效，請重新連接。");
  const oauth = config();
  const refreshed = await googleToken({
    client_id: oauth.clientId,
    client_secret: oauth.clientSecret,
    refresh_token: stored.refreshToken,
    grant_type: "refresh_token"
  });
  const nextExpiry = new Date(Date.now() + Number(refreshed.expires_in || 3600) * 1000);
  await TOKEN_DOC.set({
    accessToken: refreshed.access_token,
    expiresAt: Timestamp.fromDate(nextExpiry),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return refreshed.access_token;
}

async function youtubeRequest(path, options = {}) {
  const token = await accessToken();
  const response = await fetch(`https://www.googleapis.com/youtube/v3/${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new HttpsError("internal", data.error?.message || "YouTube API 操作失敗。");
  return data;
}

exports.youtubeAdminStatus = onCall({ region: REGION, secrets: [youtubeOAuthConfig] }, async (request) => {
  requireAdmin(request);
  const snapshot = await TOKEN_DOC.get();
  return { connected: snapshot.exists, channelTitle: snapshot.data()?.channelTitle || "" };
});

exports.youtubeCreateAuthUrl = onCall({ region: REGION, secrets: [youtubeOAuthConfig] }, async (request) => {
  const admin = requireAdmin(request);
  const oauth = config();
  const state = crypto.randomBytes(24).toString("hex");
  await db.collection("youtubeOAuthStates").doc(state).set({
    uid: admin.uid,
    email: admin.email,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000)
  });
  const params = new URLSearchParams({
    client_id: oauth.clientId,
    redirect_uri: oauth.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: [
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.force-ssl",
      "https://www.googleapis.com/auth/yt-analytics.readonly"
    ].join(" "),
    state
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
});

exports.youtubeOAuthCallback = onRequest({ region: REGION, secrets: [youtubeOAuthConfig] }, async (request, response) => {
  try {
    const { code, state, error } = request.query;
    if (error) throw new Error(`Google 授權未完成：${error}`);
    if (!code || !state) throw new Error("缺少 OAuth code 或 state。");
    const stateRef = db.collection("youtubeOAuthStates").doc(String(state));
    const stateSnapshot = await stateRef.get();
    if (!stateSnapshot.exists || stateSnapshot.data().expiresAt.toMillis() < Date.now()) throw new Error("授權連結已失效，請重新操作。");
    const oauth = config();
    const token = await googleToken({
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      code: String(code),
      redirect_uri: oauth.redirectUri,
      grant_type: "authorization_code"
    });
    const channelResponse = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
      headers: { authorization: `Bearer ${token.access_token}` }
    });
    const channelData = await channelResponse.json();
    if (!channelResponse.ok || !channelData.items?.[0]) throw new Error(channelData.error?.message || "找不到可管理的 YouTube 頻道。");
    const channel = channelData.items[0];
    await TOKEN_DOC.set({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Timestamp.fromMillis(Date.now() + Number(token.expires_in || 3600) * 1000),
      channelId: channel.id,
      channelTitle: channel.snippet?.title || "",
      connectedBy: stateSnapshot.data().email,
      connectedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    await stateRef.delete();
    response.redirect(`${SITE_URL}/youtube-admin.html?connected=1`);
  } catch (error) {
    response.redirect(`${SITE_URL}/youtube-admin.html?oauthError=${encodeURIComponent(error.message)}`);
  }
});

exports.youtubeListVideos = onCall({ region: REGION, secrets: [youtubeOAuthConfig] }, async (request) => {
  requireAdmin(request);
  const maxResults = Math.min(Math.max(Number(request.data?.maxResults || 25), 1), 50);
  const channels = await youtubeRequest("channels?part=contentDetails,snippet&mine=true");
  const channel = channels.items?.[0];
  if (!channel) throw new HttpsError("not-found", "找不到 YouTube 頻道。");
  const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
  const playlist = await youtubeRequest(`playlistItems?part=contentDetails&playlistId=${encodeURIComponent(uploads)}&maxResults=${maxResults}`);
  const ids = playlist.items?.map((item) => item.contentDetails.videoId).filter(Boolean) || [];
  if (!ids.length) return { channel: { id: channel.id, title: channel.snippet?.title || "" }, videos: [] };
  const videos = await youtubeRequest(`videos?part=snippet,status,statistics&id=${encodeURIComponent(ids.join(","))}`);
  return {
    channel: { id: channel.id, title: channel.snippet?.title || "" },
    videos: (videos.items || []).map((video) => ({
      id: video.id,
      title: video.snippet?.title || "",
      description: video.snippet?.description || "",
      publishedAt: video.snippet?.publishedAt || "",
      thumbnail: video.snippet?.thumbnails?.medium?.url || video.snippet?.thumbnails?.default?.url || "",
      privacyStatus: video.status?.privacyStatus || "",
      viewCount: Number(video.statistics?.viewCount || 0),
      likeCount: Number(video.statistics?.likeCount || 0),
      commentCount: Number(video.statistics?.commentCount || 0)
    }))
  };
});

exports.youtubePreviewVideoUpdate = onCall({ region: REGION, secrets: [youtubeOAuthConfig] }, async (request) => {
  requireAdmin(request);
  const videoId = String(request.data?.videoId || "").trim();
  if (!/^[\w-]{6,20}$/.test(videoId)) throw new HttpsError("invalid-argument", "影片 ID 不正確。");
  const result = await youtubeRequest(`videos?part=snippet,status&id=${encodeURIComponent(videoId)}`);
  const video = result.items?.[0];
  if (!video) throw new HttpsError("not-found", "找不到指定影片。");
  const nextTitle = String(request.data?.title ?? video.snippet.title).trim().slice(0, 100);
  const nextDescription = String(request.data?.description ?? video.snippet.description).slice(0, 5000);
  return {
    confirmationToken: crypto.createHash("sha256").update(`${videoId}\n${nextTitle}\n${nextDescription}`).digest("hex"),
    before: { title: video.snippet.title, description: video.snippet.description },
    after: { title: nextTitle, description: nextDescription }
  };
});

exports.youtubeApplyVideoUpdate = onCall({ region: REGION, secrets: [youtubeOAuthConfig] }, async (request) => {
  const admin = requireAdmin(request);
  const videoId = String(request.data?.videoId || "").trim();
  const title = String(request.data?.title || "").trim().slice(0, 100);
  const description = String(request.data?.description || "").slice(0, 5000);
  const expected = crypto.createHash("sha256").update(`${videoId}\n${title}\n${description}`).digest("hex");
  if (!request.data?.confirmed || request.data?.confirmationToken !== expected) {
    throw new HttpsError("failed-precondition", "修改內容尚未完成確認。");
  }
  const current = await youtubeRequest(`videos?part=snippet,status&id=${encodeURIComponent(videoId)}`);
  const video = current.items?.[0];
  if (!video) throw new HttpsError("not-found", "找不到指定影片。");
  const before = { title: video.snippet.title, description: video.snippet.description };
  const updated = await youtubeRequest("videos?part=snippet", {
    method: "PUT",
    body: JSON.stringify({
      id: videoId,
      snippet: { ...video.snippet, title, description }
    })
  });
  await db.collection("youtubeAdminAudit").add({
    action: "video.update",
    videoId,
    before,
    after: { title, description },
    adminEmail: admin.email,
    createdAt: FieldValue.serverTimestamp()
  });
  return { ok: true, video: updated.items?.[0] || null };
});

exports.youtubeDisconnect = onCall({ region: REGION, secrets: [youtubeOAuthConfig] }, async (request) => {
  requireAdmin(request);
  const snapshot = await TOKEN_DOC.get();
  if (snapshot.exists) {
    const token = snapshot.data().refreshToken || snapshot.data().accessToken;
    if (token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => null);
    await TOKEN_DOC.delete();
  }
  return { ok: true };
});
