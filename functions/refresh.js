// /functions/refresh.js
import { json, getHost, loadSitesRegistry, getSiteConfig, KV_KEYS, quickHash } from './_lib.js';

export const onRequestPost = async (ctx) => {
  const { request, env } = ctx;
  const host = getHost(request);

  // Header auth
  const provided = request.headers.get('X-Refresh-Key');
  if (!provided || provided !== env.REFRESH_KEY) {
    return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Load site config
  let sites, site, keys;
  try {
    sites = await loadSitesRegistry();
    site = getSiteConfig(sites, host);
    keys = KV_KEYS(host);
  } catch (err) {
    return json({ ok: false, error: String(err) }, { status: 400 });
  }

  // Fetch Apps Script JSON (no-cache)
  let upstream;
  const t0 = Date.now();
  try {
    const res = await fetch(site.sheet.url, { headers: { 'cache-control': 'no-cache' } });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      await env.DIRECTORIES_KV.put(keys.lastError, `apps-script ${res.status}: ${body.slice(0, 300)}`);
      return json({ ok: false, error: `Apps Script error ${res.status}` }, { status: 502 });
    }
    upstream = await res.json();
  } catch (err) {
    await env.DIRECTORIES_KV.put(keys.lastError, `fetch error: ${String(err)}`);
    return json({ ok: false, error: 'Fetch failed' }, { status: 502 });
  }

  // Validate shape
  if (!upstream?.ok) {
    await env.DIRECTORIES_KV.put(keys.lastError, `upstream not ok: ${JSON.stringify(upstream).slice(0,300)}`);
    return json({ ok: false, error: 'Upstream not ok' }, { status: 502 });
  }
  if (!Array.isArray(upstream.companies)) {
    await env.DIRECTORIES_KV.put(keys.lastError, `invalid companies array`);
    return json({ ok: false, error: 'Invalid companies array' }, { status: 502 });
  }

  // Filter out hidden companies before storing
  // The Apps Script converts "hidden" to "free", so we need to check the raw upstream data
  // Check what fields are available - look for a hidden company example to see its structure
  const visibleCompanies = upstream.companies.filter(row => {
    // Check all possible fields that might indicate hidden status
    const planRaw = row.plan;
    const plan = planRaw !== undefined && planRaw !== null ? String(planRaw).toLowerCase().trim() : '';
    
    // Check various possible fields that might indicate hidden
    const hasHiddenField = row.hidden === true || 
                           row.hidden === 'true' || 
                           row.hidden === 'yes' || 
                           row.hidden === 1 || 
                           String(row.hidden || '').toLowerCase().trim() === 'hidden' ||
                           row.status === 'hidden' ||
                           String(row.status || '').toLowerCase().trim() === 'hidden' ||
                           row.visible === false ||
                           row.visible === 'false' ||
                           row.show === false ||
                           row.show === 'false';
    
    // Check if plan is explicitly hidden (in case Apps Script doesn't convert it)
    const isHiddenPlan = plan === 'hidden' || plan === 'hide';
    
    // TEMPORARY: If plan is "free" but we suspect it should be hidden, we need another identifier
    // TODO: Check the raw upstream response to see what fields indicate hidden status
    // For now, only exclude if explicitly marked as hidden
    return !(isHiddenPlan || hasHiddenField);
  });

  const count = visibleCompanies.length;
  const nextEtag = upstream.etag || quickHash(visibleCompanies);

  const keysNow = await env.DIRECTORIES_KV.get(keys.etag);
  if (keysNow && keysNow === nextEtag) {
    // No change → no write
    const updated_at = await env.DIRECTORIES_KV.get(keys.updated);
    return json({ status: 'noop', count, etag: nextEtag, updated_at });
  }

  // Write snapshot to KV (filtered to exclude hidden companies)
  const updated_at = upstream.updated_at || new Date().toISOString();
  await env.DIRECTORIES_KV.put(keys.data, JSON.stringify(visibleCompanies));
  await env.DIRECTORIES_KV.put(keys.etag, nextEtag);
  await env.DIRECTORIES_KV.put(keys.updated, updated_at);
  await env.DIRECTORIES_KV.delete(keys.lastError);

  return json({
    status: 'ok',
    count,
    etag: nextEtag,
    updated_at,
    duration_ms: Date.now() - t0,
  });
};
