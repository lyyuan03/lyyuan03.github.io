const SITE_ORIGIN = "https://lyyuan.tw";

function cleanThumbnailUrl(value = "") {
  return String(value || "").trim().replace(/^<|>$/g, "");
}

function isDataOrBlobUrl(value = "") {
  return /^(?:data:|blob:)/i.test(value);
}

function isLyyuanHost(hostname = "") {
  const host = String(hostname || "").toLowerCase();
  return host === "lyyuan.tw" || host === "www.lyyuan.tw";
}

export function resolveThumbnailUrl(value = "") {
  const raw = cleanThumbnailUrl(value);
  if (!raw || isDataOrBlobUrl(raw)) return raw;

  try {
    const url = raw.startsWith("//")
      ? new URL(`https:${raw}`)
      : new URL(raw, `${SITE_ORIGIN}/`);

    if (isLyyuanHost(url.hostname)) {
      return `${SITE_ORIGIN}${url.pathname}${url.search}${url.hash}`;
    }
    return url.href;
  } catch {
    return raw;
  }
}

export function classifyThumbnailUrl(value = "") {
  const raw = cleanThumbnailUrl(value);
  if (!raw) return "empty";
  if (isDataOrBlobUrl(raw)) return "embedded";

  const resolved = resolveThumbnailUrl(raw);
  try {
    const url = new URL(resolved);
    return isLyyuanHost(url.hostname) ? "internal" : "external";
  } catch {
    return "invalid";
  }
}

export { SITE_ORIGIN };
