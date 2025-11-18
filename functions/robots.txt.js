// /functions/robots.txt.js
import { getHost } from './_lib.js';

/** Generate robots.txt dynamically for the current site */
export const onRequestGet = async ({ request }) => {
  const host = getHost(request);
  const baseUrl = `https://${host}`;

  const robots = `User-agent: *
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
`;

  return new Response(robots, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=86400', // Cache for 24 hours
    },
  });
};

