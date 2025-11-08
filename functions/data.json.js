// /functions/data.json.js
import { json, getHost, KV_KEYS } from './_lib.js';

export const onRequestGet = async ({ request, env }) => {
  const host = getHost(request);
  const keys = KV_KEYS(host);

  const raw = await env.DIRECTORIES_KV.get(keys.data);
  if (!raw) {
    return json({ ok: false, error: 'no data yet' }, { status: 503 });
  }

  const companies = JSON.parse(raw);
  const [etag, updated_at] = await Promise.all([
    env.DIRECTORIES_KV.get(keys.etag),
    env.DIRECTORIES_KV.get(keys.updated),
  ]);

  return json({ ok: true, updated_at, etag, count: companies.length, companies });
};
