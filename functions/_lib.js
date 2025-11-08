// /functions/_lib.js

export function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
    ...init,
  });
}

export function getHost(request) {
  // e.g., "reeves-county-texas.mineralrightsforum.com" or "<project>.pages.dev"
  return new URL(request.url).host.toLowerCase();
}

export async function loadSitesRegistry() {
  // sites.json is at repo root; functions/ is a subfolder → go up one level
  const mod = await import('../sites.json', { assert: { type: 'json' } });
  return mod.default || mod;
}

export function getSiteConfig(sites, host) {
  const site = sites[host];
  if (!site) throw new Error(`Site not found in registry for host: ${host}`);
  if (!site.sheet?.url) throw new Error(`Missing Apps Script URL for host: ${host}`);
  return site;
}

export const KV_KEYS = (host) => ({
  data: `site:${host}:data`,
  etag: `site:${host}:etag`,
  updated: `site:${host}:updated_at`,
  lastError: `site:${host}:last_error`,
});

export function isStale(updatedAtISO, minutes = 120) {
  if (!updatedAtISO) return true;
  const ageMs = Date.now() - Date.parse(updatedAtISO);
  return ageMs > minutes * 60 * 1000;
}

// Fallback etag if upstream didn't provide one
export function quickHash(obj) {
  const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return `h${(h >>> 0).toString(16)}`;
}
