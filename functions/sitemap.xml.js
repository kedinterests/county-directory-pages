// /functions/sitemap.xml.js
import { getHost, loadSitesRegistry, getSiteConfig } from './_lib.js';

/** Generate sitemap.xml for the current site */
export const onRequestGet = async ({ request, env }) => {
  const host = getHost(request);
  let sites, site;

  // Load site config
  try {
    sites = await loadSitesRegistry();
    site = getSiteConfig(sites, host);
  } catch (err) {
    return new Response(`<!-- Error: ${String(err)} -->`, {
      status: 500,
      headers: { 'content-type': 'text/xml; charset=utf-8' },
    });
  }

  // Build sitemap
  const baseUrl = `https://${host}`;
  const currentDate = new Date().toISOString().split('T')[0];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600', // Cache for 1 hour
    },
  });
};

