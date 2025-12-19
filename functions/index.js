// /functions/index.js
import { getHost, loadSitesRegistry, getSiteConfig, KV_KEYS } from './_lib.js';

/** SSR "/" — builds the full HTML page from KV snapshot with enhancements */
export const onRequestGet = async ({ request, env }) => {
  const host = new URL(request.url).host.toLowerCase();
  let sites, site, keys;

  // Load site config
  try {
    sites = await loadSitesRegistry();
    site  = getSiteConfig(sites, host);
    keys  = KV_KEYS(host);
  } catch (err) {
    return html(500, `<!doctype html><h1>Config error</h1><pre>${escapeHtml(String(err))}</pre>`);
  }

  // Load snapshot
  const [raw, updatedAt] = await Promise.all([
    env.DIRECTORIES_KV.get(keys.data),
    env.DIRECTORIES_KV.get(keys.updated),
  ]);
  if (!raw) {
    return html(503, `<!doctype html><h1>No data yet</h1><p>Try refreshing the site data.</p>`);
  }
  const companies = JSON.parse(raw);

  // Filter out hidden companies - check multiple ways to be absolutely sure
  const visibleCompanies = companies.filter(row => {
    // Check plan field - handle null, undefined, empty string, and various formats
    let plan = '';
    if (row.plan !== undefined && row.plan !== null) {
      plan = String(row.plan).toLowerCase().trim();
    }
    
    // Also check Plan (capital P) in case of different casing
    if (!plan && row.Plan !== undefined && row.Plan !== null) {
      plan = String(row.Plan).toLowerCase().trim();
    }
    
    // Check for hidden value - be very explicit
    const isHidden = plan === 'hidden' || 
                     plan === 'hide' ||
                     plan === 'h' ||
                     row.hidden === true || 
                     row.hidden === 'true' || 
                     row.hidden === 'yes' || 
                     row.hidden === 1 || 
                     row.hidden === 'hidden' ||
                     row.hidden === 'hide';
    
    // Exclude if hidden
    return !isHidden;
  });

  // Group + sort
  const { groups, categoryOrder } = groupCompanies(visibleCompanies);
  // Use spreadsheet order, fallback to all categories if order is empty
  const categoryNames = categoryOrder.length > 0 ? categoryOrder : Object.keys(groups);
  const { serving_line, seo, page_title, return_url, directory_intro } = site;

  // Build JSON-LD schema (Option A: flat ItemList of businesses)
  const pageUrl = `https://${host}/`;
  const pageName = seo?.title || 'Directory';
  const pageDesc = seo?.description || '';

  const itemListElements = visibleCompanies
    .map((row, idx) => {
      const name = row.name || '';
      if (!name) return null;

      const business = {
        '@type': 'Organization',
        '@id': `#company-${idx}`,
        additionalType: 'https://schema.org/Company',
        name
      };

      if (row.website_url) {
        business.url = row.website_url;
      }
      if (row.description_short) {
        business.description = row.description_short;
      }
      if (row.logo_url) {
        business.image = row.logo_url;
      }
      if (row.contact_phone) {
        business.telephone = row.contact_phone;
      }
      if (row.contact_email) {
        business.email = row.contact_email;
      }
      if (row.category) {
        business.category = row.category;
      }
      if (serving_line) {
        business.areaServed = serving_line;
      }
    

      return {
        '@type': 'ListItem',
        position: idx + 1,
        item: business
      };
    })
    .filter(Boolean);

  const schemaObject = {
    '@context': 'https://schema.org',
    '@type': ['WebPage', 'CollectionPage'],
    name: pageName,
    url: pageUrl,
    description: pageDesc,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: itemListElements
    }
  };

  // Safe JSON for embedding in <script>
  const schemaJson = JSON.stringify(schemaObject).replace(/</g, '\\u003c');

  // Build category nav items
  const navItems = categoryNames
    .map(c => `<a href="#cat-${idSlug(c)}" class="px-3 py-1 rounded-lg hover:bg-gray-100">${escapeHtml(c)}</a>`)
    .join('');

  // Build sections
  const sections = categoryNames.map(cat => {
    const { premium, free } = groups[cat];
    const all = premium.concat(free);
    const cards = all.map(row => renderCard(row)).join('');
    return `
      <section id="cat-${idSlug(cat)}" class="scroll-mt-[calc(var(--sticky-offset)+16px)]">
        <h2 class="sticky z-20 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 px-2 py-2 text-xl font-semibold border-b"
            style="top: var(--sticky-bar-height);"
            data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 py-4" data-category-grid="${escapeHtml(cat)}">
          ${cards}
        </div>
      </section>
    `;
  }).join('');

  // HTML shell
  return html(200, /* html */`<!doctype html>
<html lang="en">
  <head>
  <link rel="icon" type="image/png" href="https://www.mineralrightsforum.com/uploads/db5755/optimized/2X/5/53c419e5d847ede71cf80a938cf0156350637c44_2_32x32.png">
  <link rel="stylesheet" href="/styles.css?v=202511080417p">
  <meta charset="utf-8">
  <title>${escapeHtml(seo?.title || 'Directory')}</title>
  <meta property="og:title" content="${escapeHtml(seo?.title || 'Directory')}">
  <meta property="og:description" content="${escapeHtml(seo?.description || '')}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:image" content="https://www.mineralrightsforum.com/uploads/db5755/original/3X/7/7/7710a47c9cd8492b1935dd3b8d80584938456dd4.jpeg">
  <meta property="og:site_name" content="Mineral Rights Forum">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="description" content="${escapeHtml(seo?.description || '')}">
  <meta name="robots" content="index, follow">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://static.mineralrightsforum.com/styles.css">
  <!-- Google Analytics 4 -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZS0JTM2XTR"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-ZS0JTM2XTR');
  </script>
  <script type="application/ld+json">
  ${schemaJson}
  </script>
  <style>
    :root{
      --sticky-offset: 64px;
      --sticky-bar-height: 64px;    /* height of the black sticky bar */
      --mrf-primary: #111827;       /* gray-900 */
      --mrf-primary-700: #0f172a;   /* slate-900-ish */
      --mrf-text-on-primary: #ffffff;
      --mrf-outline: #e5e7eb;       /* gray-200 */
      --mrf-border: #e5e7eb;       /* gray-200 */
      --mrf-subtle: #6b7280;       /* gray-500 */
      --mrf-accent: #f59e0b;        /* amber-500 */
      --mrf-accent-600: #d97706;    /* amber-600 */
    }
    html{ scroll-behavior:smooth; }
    html, body {
      width: 100%;
      overflow-x: hidden;
      max-width: 100vw;
    }
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;color:#111;line-height:1.5}
    /* Prevent horizontal scrolling on mobile */
    .site-wrapper, .page, .content, .container, main, footer, header {
      max-width: 100%;
      overflow-x: hidden;
    }
    .button-row, .provider-actions, .nav-links, .footer-social {
      display: flex;
      flex-wrap: wrap;
    }
    * { box-sizing: border-box; }
    img, video, iframe, embed, object { max-width: 100%; height: auto; }
    .container{max-width:1280px;margin:0 auto;padding:1rem}
    .shadow-soft{box-shadow:0 1px 2px rgba(0,0,0,.05),0 1px 3px rgba(0,0,0,.1)}
    .hidden{display:none !important}
    .srch{width:100%;max-width:28rem}
    /* Header Back Button */
    .header-back-btn{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      font-size: 0.9375rem;
      font-weight: 500;
      color: #ffffff;
      background: #23456D;
      border: none;
      border-radius: 0.5rem;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .header-back-btn:hover{
      background: #1a3454;
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(35, 69, 109, 0.2);
    }
    .header-back-btn:active{
      transform: translateY(0);
      box-shadow: none;
    }
    .header-back-btn svg{
      flex-shrink: 0;
    }
/* Sticky title/filters row (almost black) */
.dir-sticky{
  position: -webkit-sticky; /* iOS Safari fallback */
  position: sticky;
  top: 0;
  z-index: 30;
  background: var(--mrf-primary);          /* #111827 – "almost black" */
  color: #f9fafb;
  border-bottom: 1px solid #020617;
  margin-bottom: 25px;
  transform: translateZ(0); /* Force hardware acceleration for iOS */
  will-change: transform; /* Optimize for iOS */
}

/* Tighten vertical padding in sticky bar */
.dir-sticky .container{
  padding-top: 0.35rem;
  padding-bottom: 0.35rem;
}

/* Make text/labels/inputs readable on dark bg */
.dir-sticky h1,
.dir-sticky p,
.dir-sticky label{
  color: #f9fafb;
}

.dir-sticky .srch,
.dir-sticky select{
  background-color: #ffffff;
  color: #111827;
  border-color: #4b5563;
}

.dir-sticky .srch::placeholder{
  color: #9ca3af;
}

.dir-sticky .featured-only-label{
  color: #e5e7eb;
    font-size: .9rem;
    line-height: 1;
}

/* Checkbox 100% larger and styled with white background on check and colored checkmark */
.dir-sticky input[type="checkbox"]{
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 0.375rem;
  border: 2px solid #e5e7eb;
  background-color: #111827;
  accent-color: #BD1E2B; /* checkmark + focus color */
}
.dir-sticky input[type="checkbox"]:checked{
  background-color: #ffffff;   /* white box when checked */
  border-color: #BD1E2B;       /* brand red border */
  accent-color: #BD1E2B;       /* rich red checkmark */
}

/* Pills bar centering (now lives below, on white) */
#jump{
  display:flex;
  flex-wrap:wrap;
  justify-content:center;
  gap:.5rem;
  margin-top:0;              /* spacing handled by container below */
}

@media (max-width:1023px){
  #jump{display:none}        /* still hide pills on mobile */
  /* Hide jump-container on tablet and mobile */
  .container.mt-12{
    display: none;
  }
}

    /* Mobile drawer helpers */
    .mobile-drawer{display:none}
    .mobile-drawer.open{display:block}
    .featured-only-label{white-space:nowrap}
    
    /* Mobile drawer overlay */
    .mobile-drawer-overlay{
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 45;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.25s ease, visibility 0.25s ease;
    }
    .mobile-drawer-overlay.open{
      opacity: 1;
      visibility: visible;
    }

    /* Close icon button - used in modals and drawer */
    .close-icon-btn{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      padding: 0;
      background: transparent;
      border: none;
      border-radius: 0.375rem;
      color: #111827;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .close-icon-btn:hover{
      background: #f3f4f6;
      color: #0f172a;
    }
    .close-icon-btn:active{
      background: #e5e7eb;
    }
    .close-icon-btn svg{
      flex-shrink: 0;
    }

    /* Style Zoho form iframe content */
    #applyModal iframe{
      font-size: 1rem;
    }
    /* Try to target element inside iframe (may not work due to cross-origin) */
    #applyModal iframe #descFld{
      font-size: 1rem !important;
    }

    @media (max-width: 767px){

      /* Smaller title text on mobile */
      .dir-sticky h1{
        font-size: 1rem;
        line-height: 1.1;
        text-align: center;
      }

      /* Tighter vertical padding on mobile */
      .dir-sticky .container{
        padding-top:7.5px;
        padding-bottom: 7.5px;
      }

      /* Hide inline filters in the sticky bar on mobile (drawer will handle filters) */
      .dir-sticky .filters-row{
        display: none;
      }

      /* Reduce space under black sticky bar */
      .dir-sticky{
        margin-bottom: 0px !important;
      }

      /* Adjust sticky bar height variable for mobile */
      :root{
        --sticky-bar-height: 45px;  /* shorter on mobile */
      }

      /* Category headers need to account for black sticky bar + mobile filter bar */
      section h2.sticky{
        top: calc(var(--sticky-bar-height) + 45px) !important;  /* black bar (~45px) + mobile filter bar (~45px) */
      }

      /* Hide jump-container entirely on mobile */
      .container.mt-12{
        display: none !important;
      }

      /* Move mobile filter bar to the top, just under the sticky title row, and make it sticky */
      .mobile-filter-bar{
        position: -webkit-sticky; /* iOS Safari fallback */
        position: sticky;
        top: 45px; /* approximate height of the sticky title bar */
        bottom: auto;
        z-index: 25;
        background: rgba(255,255,255,0.75);
         backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px); /* Safari */
        padding: 0.5rem 1rem;
        display: flex;
        gap: 0.5rem;
        justify-content: space-between;
        transform: translateZ(0); /* Force hardware acceleration for iOS */
        will-change: transform; /* Optimize for iOS */
      }
      .mobile-back-btn,
      .mobile-filter-btn{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.625rem 1rem;
        font-size: 0.9375rem;
        font-weight: 500;
        border-radius: 0.5rem;
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .mobile-back-btn{
        background: #f3f4f6;
        color: #374151;
        border: 1px solid #e5e7eb;
      }
      .mobile-back-btn:hover{
        background: #e5e7eb;
        color: #111827;
      }
      .mobile-back-btn:active{
        background: #d1d5db;
      }
      .mobile-filter-btn{
        background: #23456D;
        color: #ffffff;
        flex: 1;
      }
      .mobile-filter-btn:hover{
        background: #1a3454;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(35, 69, 109, 0.2);
      }
      .mobile-filter-btn:active{
        transform: translateY(0);
        box-shadow: none;
      }
      .mobile-back-btn svg,
      .mobile-filter-btn svg{
        flex-shrink: 0;
      }

      /* Mobile Apply Filter button - blue */
      .mobile-apply-btn{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem 1.5rem;
        font-size: 1rem;
        font-weight: 600;
        color: #ffffff;
        background: #23456D;
        border: none;
        border-radius: 0.5rem;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .mobile-apply-btn:hover{
        background: #1a3454;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(35, 69, 109, 0.2);
      }
      .mobile-apply-btn:active{
        transform: translateY(0);
        box-shadow: none;
      }
    }

    /* Tips Card Styles */
    .tips-card{
      border: 1px solid var(--mrf-border);
      border-radius: 0.5rem; /* rounded-lg - matches CTA block */
      background: #fff;
      box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 1px 3px rgba(0,0,0,.1);
      margin: 1.5rem auto;
      max-width: 1280px;
      overflow: hidden;
      transition: box-shadow .18s ease;
    }
    .tips-card:hover{
      box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 10px 30px rgba(15,23,42,.12);
    }
    .tips-card-header{
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      cursor: pointer;
      user-select: none;
      background: #f8fafc;
      border-bottom: 1px solid var(--mrf-border);
      transition: background .18s ease;
    }
    .tips-card-header:hover{
      background: #f1f5f9;
    }
    .tips-card-header h2{
      margin: 0;
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--mrf-primary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .tips-card-chevron{
      width: 20px;
      height: 20px;
      transition: transform 0.3s ease;
      color: var(--mrf-subtle);
    }
    .tips-card.expanded .tips-card-chevron{
      transform: rotate(180deg);
    }
    .tips-card-content{
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.3s ease, padding 0.3s ease;
      padding: 0 1.5rem;
    }
    .tips-card.expanded .tips-card-content{
      max-height: 1000px;
      padding: 1.5rem;
    }
    .tips-card-content ul{
      margin: 0;
      padding-left: 1.5rem;
      list-style-type: disc;
    }
    .tips-card-content li{
      margin-bottom: 0.75rem;
      line-height: 1.6;
      color: #374151;
    }
    .tips-card-content li:last-child{
      margin-bottom: 0;
    }
    .tips-card-content strong{
      color: var(--mrf-primary);
      font-weight: 600;
    }
    @media (max-width: 767px){
      .tips-card{
        margin: 1rem;
        border-radius: 0.5rem; /* rounded-lg - matches CTA block */
      }
      .tips-card-header{
        padding: 1rem;
      }
      .tips-card-header h2{
        font-size: 1rem;
      }
      .tips-card.expanded .tips-card-content{
        padding: 1rem;
      }
      .tips-card-content ul{
        padding-left: 1.25rem;
      }
    }

    /* Scroll to Top Button */
    .scroll-to-top{
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--mrf-primary);
      color: var(--mrf-text-on-primary);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,.15);
      z-index: 40;
      opacity: 0;
      visibility: hidden;
      transform: translateY(10px);
      transition: opacity 0.3s ease, visibility 0.3s ease, transform 0.3s ease, background 0.18s ease, bottom 0.3s ease;
    }
    .scroll-to-top.above-footer{
      bottom: 10rem;
    }
    .scroll-to-top.visible{
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
    .scroll-to-top:hover{
      background: var(--mrf-primary-700);
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0,0,0,.2);
    }
    .scroll-to-top:active{
      transform: translateY(0);
    }
    .scroll-to-top svg{
      width: 24px;
      height: 24px;
    }
    @media (max-width: 767px){
      .scroll-to-top{
        bottom: 1.5rem;
        right: 1.5rem;
        width: 44px;
        height: 44px;
      }
      .scroll-to-top svg{
        width: 20px;
        height: 20px;
      }
    }

    /* CTA Block Styles */
    .cta-block{
      margin: 3rem auto 2rem;
      max-width: 800px;
      padding: 2.5rem 2rem;
      background: #D1F0FF;
      border-radius: 1rem;
      text-align: center;
      box-shadow: 0 4px 6px rgba(35, 69, 109, 0.08), 0 2px 4px rgba(35, 69, 109, 0.06);
      border: 1px solid rgba(35, 69, 109, 0.1);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .cta-block:hover{
      transform: translateY(-2px);
      box-shadow: 0 8px 12px rgba(35, 69, 109, 0.12), 0 4px 6px rgba(35, 69, 109, 0.08);
    }
    .cta-text{
      font-size: 1.25rem;
      font-weight: 500;
      color: #23456D;
      margin: 0 0 1.75rem 0;
      line-height: 1.6;
    }
    .cta-button{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.875rem 2.25rem;
      font-size: 1.125rem;
      font-weight: 600;
      color: #ffffff;
      background: #23456D;
      border: none;
      border-radius: 0.625rem;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 6px rgba(35, 69, 109, 0.25), 0 2px 4px rgba(35, 69, 109, 0.2);
      letter-spacing: 0.01em;
    }
    .cta-button:hover{
      background: #1a3454;
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(35, 69, 109, 0.35), 0 4px 6px rgba(35, 69, 109, 0.25);
    }
    .cta-button:active{
      transform: translateY(0);
      box-shadow: 0 2px 4px rgba(35, 69, 109, 0.25);
    }
    @media (max-width: 767px){
      .cta-block{
        margin: 2rem 1rem 1.5rem;
        padding: 2rem 1.5rem;
        border-radius: 0.875rem;
      }
      .cta-text{
        font-size: 1.125rem;
        margin-bottom: 1.5rem;
      }
      .cta-button{
        padding: 0.75rem 2rem;
        font-size: 1rem;
        width: 100%;
        max-width: 280px;
      }
    }

    /* Footer Styles */
    footer{
      background: var(--mrf-primary);
      color: #f9fafb;
      padding: 2.5rem 0;
      margin-top: 3rem;
      width: 100%;
    }
    .footer-content{
      display: flex;
      flex-wrap: wrap;
      gap: 2rem;
      justify-content: space-between;
      align-items: flex-start;
    }
    .footer-left{
      flex: 0 0 auto;
      text-align: left;
    }
    .footer-left h3{
      font-size: 1.125rem;
      font-weight: 700;
      color: #f9fafb;
      margin: 0 0 0.5rem 0;
    }
    .footer-left p{
      font-size: 0.875rem;
      color: #d1d5db;
      margin: 0;
      line-height: 1.5;
    }
    .footer-right{
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      align-items: flex-end;
      text-align: right;
    }
    .footer-menu{
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
      list-style: none;
      margin: 0;
      padding: 0;
      justify-content: flex-end;
    }
    .footer-menu a{
      color: #e5e7eb;
      text-decoration: none;
      font-size: 0.9375rem;
      transition: color 0.2s ease;
    }
    .footer-menu a:hover{
      color: #ffffff;
    }
    .footer-social{
      display: flex;
      gap: 1rem;
      align-items: center;
    }
    .footer-social a{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 0.375rem;
      background: rgba(255, 255, 255, 0.1);
      color: #e5e7eb;
      transition: all 0.2s ease;
    }
    .footer-social a:hover{
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
    }
    .footer-social svg{
      width: 20px;
      height: 20px;
    }
    @media (max-width: 767px){
      footer{
        padding: 2rem 0;
      }
      .footer-content{
        flex-direction: column;
        gap: 1.5rem;
        align-items: center;
        text-align: center;
      }
      .footer-left{
        text-align: center;
      }
      .footer-right{
        align-items: center;
        text-align: center;
      }
      .footer-menu{
        justify-content: center;
      }
    }

    /* Placeholder/CTA Card Styles - Soft yellow design to encourage listings */
    .card--placeholder{
      background: linear-gradient(90deg,rgba(219, 238, 255, 1) 0%, rgba(220, 235, 250, 1) 50%, rgba(218, 233, 247, 1) 100%);
      border: 1px solidrgb(184, 229, 255);
      box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 1px 3px rgba(0,0,0,.1);
      position: relative;
      overflow: hidden;
    }
    .card--placeholder:hover{
      background: linear-gradient(270deg,rgba(219, 238, 255, 1) 0%, rgba(220, 235, 250, 1) 50%, rgba(218, 233, 247, 1) 100%);
      border-color: 1px solidrgb(184, 229, 255);
    }
    .card--placeholder h3{
      color: var(--mrf-ink);
      font-weight: 700;
    }
    .card--placeholder .desc{
      color: var(--mrf-ink);
    }
    .card--placeholder .category{
      color: var(--mrf-subtle);
    }
    .placeholder-cta-btn{
      transition: all 0.2s ease;
    }
    .placeholder-cta-btn:hover{
      opacity: 0.9;
    }
    .placeholder-cta-btn:active{
      transform: translateY(1px);
    }
  </style>
</head>
<body class="bg-white">

  <!-- ===== MRF HEADER ===== -->
  <header class="z-10 bg-white shadow-xl">
    <div class="bg-white max-w-7xl mx-auto px-4 sm:px-6 py-3 border-b border-gray-200">
      <div class="flex items-center justify-center md:justify-between">
        <a href="https://www.mineralrightsforum.com" class="block w-fit">
          <img src="https://www.mineralrightsforum.com/uploads/db5755/original/3X/7/7/7710a47c9cd8492b1935dd3b8d80584938456dd4.jpeg"
               alt="Mineral Rights Forum Logo"
               class="h-12 w-auto rounded-lg"
               onerror="this.onerror=null;this.src='https://placehold.co/150x40/d1d5db/4b5563?text=MRF+Logo'">
        </a>
        <button class="header-back-btn" style="display: none;" id="returnBtn" data-return-url="${return_url ? escapeAttr(return_url) : 'https://www.mineralrightsforum.com'}">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <span>Back to Forum</span>
        </button>
      </div>
    </div>
  </header>

  <!-- ===== DIRECTORY STICKY BAR (TITLE + FILTERS ONLY) ===== -->
  <div class="dir-sticky">
    <div class="container py-1">
      <div class="flex flex-col gap-2 md:flex-row items-center md:items-center md:justify-between">
        <div>
<h1 class="text-xl font-bold whitespace-pre-line">${escapeHtml(page_title || 'Directory')}</h1>                  </div>
        <div class="flex gap-2 items-center filters-row">
          <input id="q" class="srch border rounded-lg px-3 py-2" type="search" placeholder="Search this page">
          <select id="cat" class="border rounded-lg px-2 py-2">
            <option value="">Filter by Category</option>
            ${categoryNames.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
          </select>
          <label id="controls" class="flex items-center gap-2 text-sm featured-only-label">
            <input id="onlyPremium" type="checkbox"> Featured<br>Only
          </label>
        </div>
      </div>
    </div>
  </div>

  <!-- ===== Mobile Filter Bar (Top, under sticky title) ===== -->
  <div class="mobile-filter-bar md:hidden">
    <button id="mbBackBtn" class="mobile-back-btn" data-return-url="${return_url ? escapeAttr(return_url) : 'https://www.mineralrightsforum.com'}">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      <span>Back to Forum</span>
    </button>
    <button id="mbFilterBtn" class="mobile-filter-btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
      </svg>
      <span>Filter</span>
    </button>
  </div>  

  <!-- Drawer overlay -->
  <div id="mbDrawerOverlay" class="mobile-drawer-overlay md:hidden" aria-hidden="true"></div>
  
  <!-- Drawer panel -->
  <div id="mbDrawer" class="mobile-drawer md:hidden" aria-hidden="true">
    <div class="mobile-drawer-header">
      <strong>Filter by Category</strong>
      <button id="mbClose" class="close-icon-btn" aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <div class="mobile-drawer-body">
      <div class="flex flex-col gap-3">
        <input id="mb_q" class="border rounded-lg px-3 py-2" type="search" placeholder="Search companies or descriptions…">
        <select id="mb_cat" class="border rounded-lg px-2 py-2">
          <option value="">All categories</option>
          ${categoryNames.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
        </select>
        <label class="flex items-center gap-2 text-sm featured-only-label">
          <input id="mb_onlyPremium" type="checkbox"> Featured only
        </label>
        <button id="mbApply" class="mobile-apply-btn w-full justify-center">Apply Filter</button>
      </div>
    </div>
  </div>

  <!-- Category jump pills: NOT in black row, with ~50px gap -->
  <div class="container mt-12">
    <nav id="jump">
      ${navItems}
    </nav>
  </div>

  <!-- ===== CONTENT ===== -->
  <main class="container">
    ${directory_intro ? `<div class="directory-intro mb-8 text-gray-700 max-w-4xl mx-auto font-semibold text-center leading-normal"><p>${escapeHtml(directory_intro).replace(/\n\n/g, '</p><p class="mt-4">').replace(/\n/g, '<br>')}</p></div>` : ''}
    ${sections}
    
    <!-- ===== Tips for Choosing a Pro ===== -->
    <div class="tips-card" id="tipsCard">
      <div class="tips-card-header" id="tipsCardHeader">
        <h2>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink: 0;">
            <g fill="none" stroke="currentColor" stroke-width="2">
              <path d="M13.737 21.848a10.002 10.002 0 0 0 6.697-15.221a10 10 0 1 0-6.698 15.221z"/>
              <path stroke-linecap="square" d="M12 12v6m0-11V6"/>
            </g>
          </svg>
          <span>Tips for Choosing a Pro</span>
        </h2>
        <svg class="tips-card-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </div>
      <div class="tips-card-content">
        <ul>
          <li><strong>Verify credentials and licenses:</strong> Ensure the pro is properly licensed and certified in their field (attorneys should be bar members, landmen may have certifications, etc.)</li>
          <li><strong>Ask about local experience:</strong> Inquire specifically about their experience working with mineral rights in your county or region</li>
          <li><strong>Request references:</strong> Ask for references from other mineral rights owners they've worked with</li>
          <li><strong>Understand fee structures:</strong> Get clear information upfront about how they charge (hourly, flat fee, percentage, etc.) and what services are included</li>
          <li><strong>Check for complaints:</strong> Research any complaints or disciplinary actions through state licensing boards or pro associations</li>
          <li><strong>Consider specialization:</strong> Look for pros who specialize in your specific needs (royalty disputes, lease negotiations, title work, etc.)</li>
        </ul>
      </div>
    </div>
    
    <!-- Business Owners CTA Section -->
    <div class="cta-block">
      <p class="cta-text">
        Business Owners - would you like to appear on this page? We offer limited paid directory placements.
      </p>
      <button id="applyForListingBtn" class="cta-button">
        Apply for Listing
      </button>
    </div>
  </main>

  <footer>
    <div class="container">
      <div class="footer-content">
        <div class="footer-left">
          <h3>The Mineral Rights Forum</h3>
          <p>&copy; ${new Date().getFullYear()} All Rights Reserved</p>
        </div>
        <div class="footer-right">
          <ul class="footer-menu">
            <li><a href="https://www.mineralrightsforum.com">Home</a></li>
            <li><a href="https://www.mineralrightsforum.com/about">About</a></li>
            <li><a href="https://www.mineralrightsforum.com/privacy">Privacy</a></li>
            <li><a href="https://www.mineralrightsforum.com/tos">TOS</a></li>
            <li><a href="https://www.mineralrightsforum.com/t/advertise-with-us-to-reach-mineral-owners/24986">Advertise</a></li>
          </ul>
          <div class="footer-social">
            <a href="https://www.facebook.com/mrforum" aria-label="Facebook" target="_blank">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1h3z"></path>
              </svg>
            </a>
            <a href="https://x.com/mineralforum" aria-label="X (Twitter)" target="_blank">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
              </svg>
            </a>
            <a href="https://www.linkedin.com/company/the-mineral-rights-forum" aria-label="LinkedIn" target="_blank">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                <rect x="2" y="9" width="4" height="12"></rect>
                <circle cx="4" cy="4" r="2"></circle>
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  </footer>

  <!-- Desktop Call Now Modal -->
  <div id="callModal" class="hidden fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/40" data-close="1"></div>
    <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl p-6 w-[min(92vw,28rem)] shadow-soft" style="background-color: #DAE9F8;">
      <div class="flex justify-between items-center mb-2">
        <h3 class="text-lg font-semibold">We’d love to hear from you!</h3>
        <button class="close-icon-btn" data-close="1" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <p id="callNumber" class="text-2xl font-bold tracking-wide"></p>
      <div class="mt-5 flex justify-end gap-2">
      </div>
    </div>
  </div>

  <!-- Apply for Listing Modal -->
  <div id="applyModal" class="hidden fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/40" data-close-apply="1"></div>
    <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-[min(95vw,48rem)] max-h-[90vh] overflow-y-auto shadow-soft">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold">Apply for Listing</h3>
        <button class="close-icon-btn" data-close-apply="1" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <iframe aria-label='MRF Advertiser Questionnaire' frameborder="0" style="height:500px;width:99%;border:none;" src='https://forms.zohopublic.com/kedinterestsllc/form/MRFAdvertiserQuestionnaire/formperma/fqHZoswuV-fPl--7JzxywtBbJ6WhWoQx5PkXRVrqBoI'></iframe>
    </div>
  </div>

  <script>
  document.addEventListener('DOMContentLoaded', () => {
    // ---- Client enhancements ----
    const q = document.getElementById('q');
    const cat = document.getElementById('cat');
    const onlyPremium = document.getElementById('onlyPremium');
    const isDesktop = matchMedia('(hover: hover)').matches;
    
    // Show/hide return button based on screen size
    const returnBtn = document.getElementById('returnBtn');
    function toggleReturnButton() {
      if (returnBtn) {
        if (window.matchMedia('(min-width: 768px)').matches) {
          returnBtn.style.display = 'inline-flex';
        } else {
          returnBtn.style.display = 'none';
        }
      }
    }
    toggleReturnButton();
    window.addEventListener('resize', toggleReturnButton);
    
    // Handle return button click - navigate to return_url from site config
    if (returnBtn) {
      const returnUrl = returnBtn.getAttribute('data-return-url') || 'https://www.mineralrightsforum.com';
      returnBtn.addEventListener('click', () => {
        window.location.href = returnUrl;
      });
    }

    function normalize(s){ return (s||'').toLowerCase(); }

    function applyFilter(){
      const term = normalize(q?.value || '');
      const selectedCat = (cat?.value || '').toLowerCase();
      const premiumOnly = !!onlyPremium?.checked;

      document.querySelectorAll('article[data-card]').forEach(el=>{
        const name = (el.getAttribute('data-name')||'');
        const desc = (el.getAttribute('data-desc')||'');
        const category = (el.getAttribute('data-category')||'').toLowerCase();
        const plan = (el.getAttribute('data-plan')||'').toLowerCase();

        const textOk = !term || name.includes(term) || desc.includes(term) || category.includes(term);
        const catOk  = !selectedCat || category === selectedCat;
        const premOk = !premiumOnly || plan === 'premium';

        el.classList.toggle('hidden', !(textOk && catOk && premOk));
      });

      // Hide sections with zero visible cards (ignore current layout/display state)
      document.querySelectorAll('section[id^="cat-"]').forEach(sec=>{
        const grid = sec.querySelector('[data-category-grid]');
        const hasVisible = !!grid && Array.from(grid.querySelectorAll('article'))
          .some(a => !a.classList.contains('hidden'));
        sec.classList.toggle('hidden', !hasVisible);
      });

      // Prune jump links to only visible categories
      const jumpNav = document.getElementById('jump');
      if (jumpNav) {
        jumpNav.querySelectorAll('a[href^="#cat-"]').forEach(link=>{
          const id = link.getAttribute('href').slice(1);
          const sec = document.getElementById(id);
          link.classList.toggle('hidden', !sec || sec.classList.contains('hidden'));
        });
      }
    }

    // input bindings (search is debounced)
    q?.addEventListener('input', debounce(applyFilter, 120));
    cat?.addEventListener('change', applyFilter);
    onlyPremium?.addEventListener('change', applyFilter);

    // Mirror mobile checkbox when it exists
    const elMbOnly = document.getElementById('mb_onlyPremium');
    if (elMbOnly) {
      elMbOnly.addEventListener('change', () => {
        if (onlyPremium) onlyPremium.checked = elMbOnly.checked;
        applyFilter();
      });
    }

    // Run once on load
    applyFilter();

    function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

    // Jump links active state + smooth scroll (keeps H2 visible)
    const headings = Array.from(document.querySelectorAll('section>h2'));
    const jump = document.getElementById('jump');
    const jumpLinks = jump ? Array.from(jump.querySelectorAll('a')) : [];
    if (jump) {
      jump.addEventListener('click', (e)=>{
        const a = e.target.closest('a[href^="#cat-"]');
        if(!a) return;
        const id = a.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if(!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior:'smooth', block:'start' });
      });
    }
    if ('IntersectionObserver' in window){
      const io = new IntersectionObserver((entries)=>{
        let best;
        for (const e of entries){
          if(e.isIntersecting){
            if(!best || e.boundingClientRect.top < best.boundingClientRect.top) best = e;
          }
        }
        if(best && jumpLinks.length){
          const id = '#'+best.target.parentElement.id;
          jumpLinks.forEach(a=>a.classList.toggle('bg-gray-100', a.getAttribute('href')===id));
        }
      }, {rootMargin:'-120px 0px -70% 0px', threshold:[0,1]});
      headings.forEach(h=>io.observe(h));
    }

    // Desktop "Call now" modal
    const modal = document.getElementById('callModal');
    const callNumber = document.getElementById('callNumber');
    modal?.addEventListener('click', (e)=>{
      const closeBtn = e.target.closest('[data-close]');
      if(closeBtn) modal.classList.add('hidden');
    });
    window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') modal?.classList.add('hidden'); });
    document.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-callnow]');
      if(!btn) return;
      const tel = btn.getAttribute('data-tel');
      const display = btn.getAttribute('data-display');
      if(isDesktop){
        e.preventDefault();
        if (callNumber) callNumber.textContent = display || tel || '';
        modal?.classList.remove('hidden');
      }
    });

    // Apply for Listing modal
    const applyModal = document.getElementById('applyModal');
    const applyBtn = document.getElementById('applyForListingBtn');
    applyModal?.addEventListener('click', (e)=>{
      const closeBtn = e.target.closest('[data-close-apply]');
      if(closeBtn) applyModal.classList.add('hidden');
    });
    applyBtn?.addEventListener('click', ()=>{ applyModal?.classList.remove('hidden'); });
    // Handle placeholder card button clicks
    document.querySelectorAll('.placeholder-cta-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        applyModal?.classList.remove('hidden');
        // Scroll to modal
        setTimeout(() => {
          applyModal?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      });
    });
    window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') applyModal?.classList.add('hidden'); });

    // Try to style Zoho form element inside iframe
    const zohoIframe = applyModal?.querySelector('iframe');
    if (zohoIframe) {
      zohoIframe.addEventListener('load', () => {
        try {
          const iframeDoc = zohoIframe.contentDocument || zohoIframe.contentWindow?.document;
          if (iframeDoc) {
            const descFld = iframeDoc.getElementById('descFld');
            if (descFld) {
              descFld.style.fontSize = '1rem';
              descFld.style.setProperty('font-size', '1rem', 'important');
            }
            // Also try adding a style tag to the iframe
            const style = iframeDoc.createElement('style');
            style.textContent = '#descFld { font-size: 1rem !important; }';
            iframeDoc.head.appendChild(style);
          }
        } catch (e) {
          // Cross-origin restriction - can't access iframe content
          console.log('Cannot style iframe content due to cross-origin restrictions');
        }
      });
    }

    // --- Mobile bottom bar + drawer ---
    const mbBackBtn = document.getElementById('mbBackBtn');
    const mbFilterBtn = document.getElementById('mbFilterBtn');
    const mbDrawer = document.getElementById('mbDrawer');
    const mbDrawerOverlay = document.getElementById('mbDrawerOverlay');
    const mbClose = document.getElementById('mbClose');
    const mbApply = document.getElementById('mbApply');
    const mb_q = document.getElementById('mb_q');
    const mb_cat = document.getElementById('mb_cat');
    const mb_onlyPremium = document.getElementById('mb_onlyPremium');
    
    // Function to open drawer
    function openDrawer() {
      mbDrawer?.classList.add('open');
      mbDrawerOverlay?.classList.add('open');
      if (mbDrawer) mbDrawer.setAttribute('aria-hidden', 'false');
      if (mbDrawerOverlay) mbDrawerOverlay.setAttribute('aria-hidden', 'false');
    }
    
    // Function to close drawer
    function closeDrawer() {
      mbDrawer?.classList.remove('open');
      mbDrawerOverlay?.classList.remove('open');
      if (mbDrawer) mbDrawer.setAttribute('aria-hidden', 'true');
      if (mbDrawerOverlay) mbDrawerOverlay.setAttribute('aria-hidden', 'true');
    }

    // Handle back to forum button - navigate to return_url from site config
    if (mbBackBtn) {
      const returnUrl = mbBackBtn.getAttribute('data-return-url') || 'https://www.mineralrightsforum.com';
      mbBackBtn.addEventListener('click', () => {
        window.location.href = returnUrl;
      });
    }

    mbFilterBtn?.addEventListener('click', openDrawer);
    mbClose?.addEventListener('click', closeDrawer);
    mbDrawerOverlay?.addEventListener('click', closeDrawer);

    mbApply?.addEventListener('click', ()=>{
      const qMain = document.getElementById('q');
      const catMain = document.getElementById('cat');
      const premMain = document.getElementById('onlyPremium');

      if(qMain) qMain.value = mb_q?.value || '';
      if(catMain) catMain.value = mb_cat?.value || '';
      if(premMain) premMain.checked = !!mb_onlyPremium?.checked;

      applyFilter();
      closeDrawer();
    });

    // Sync drawer inputs when it opens
    mbFilterBtn?.addEventListener('click', ()=>{
      if (mb_q)   mb_q.value = q?.value || '';
      if (mb_cat) mb_cat.value = cat?.value || '';
      if (mb_onlyPremium && onlyPremium) mb_onlyPremium.checked = !!onlyPremium.checked;
    });

    // --- Tips Card Toggle ---
    const tipsCard = document.getElementById('tipsCard');
    const tipsCardHeader = document.getElementById('tipsCardHeader');
    if (tipsCardHeader && tipsCard) {
      tipsCardHeader.addEventListener('click', () => {
        tipsCard.classList.toggle('expanded');
        // Optional: Save state to localStorage
        localStorage.setItem('tipsCardExpanded', tipsCard.classList.contains('expanded'));
      });
      // Optional: Restore state from localStorage
      const savedState = localStorage.getItem('tipsCardExpanded');
      if (savedState === 'true') {
        tipsCard.classList.add('expanded');
      }
    }

    // --- Scroll to Top Button ---
    const scrollToTopBtn = document.getElementById('scrollToTop');
    const footer = document.querySelector('footer');
    if (scrollToTopBtn) {
      // Show/hide button based on scroll position and adjust position when footer is visible
      function toggleScrollToTop() {
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollY > 300) {
          scrollToTopBtn.classList.add('visible');
          
          // Check if footer is visible in viewport
          if (footer) {
            const footerRect = footer.getBoundingClientRect();
            const footerTop = footerRect.top;
            const viewportHeight = window.innerHeight;
            
            // If footer is visible in viewport (within bottom 200px), move button above it
            if (footerTop < viewportHeight && footerTop > -100) {
              const footerHeight = footerRect.height;
              const padding = 24; // padding in pixels
              const spaceNeeded = Math.max(footerHeight + padding, 100); // minimum 100px from bottom
              scrollToTopBtn.style.bottom = spaceNeeded + 'px';
            } else {
              // Reset to default position (remove inline style to use CSS default)
              scrollToTopBtn.style.bottom = '';
            }
          }
        } else {
          scrollToTopBtn.classList.remove('visible');
          // Reset position when hidden
          scrollToTopBtn.style.bottom = '';
        }
      }
      
      // Scroll to top on click
      scrollToTopBtn.addEventListener('click', () => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
      
      // Listen for scroll events
      window.addEventListener('scroll', toggleScrollToTop, { passive: true });
      
      // Listen for resize to recalculate
      window.addEventListener('resize', toggleScrollToTop);
      
      // Check initial scroll position
      toggleScrollToTop();
    }
  });
  </script>

  <!-- Scroll to Top Button -->
  <button id="scrollToTop" class="scroll-to-top" aria-label="Scroll to top">
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path>
    </svg>
  </button>

</body>
</html>
`);

  // -------- helpers --------
  function renderCard(row){
    const isPremium = (row.plan||'').toLowerCase()==='premium';
    const name = row.name||'';
    const desc = row.description_short||'';
    const cat  = row.category||'';
    const logo = row.logo_url||'';
    const website = row.website_url||'';
    const email = row.contact_email||'';
    const { tel, display } = normPhone(row.contact_phone||'');

    // Detect placeholder/CTA company names (e.g., "your... company featured here")
    const nameLower = name.toLowerCase();
    const isPlaceholder = (nameLower.includes('your') && nameLower.includes('company') && nameLower.includes('featured')) ||
                          (nameLower.includes('your') && nameLower.includes('featured')) ||
                          nameLower.includes('company featured here');

    // Hooked card class; premium styling via CSS
    const base = 'card flex flex-col gap-3';

    // Free: always show initial block, even if logo exists
    // Premium: show logo if exists, otherwise show initial block
    const logoImg = (isPremium && logo)
      ? `<img src="${escapeAttr(logo)}" alt="" class="w-12 h-12 rounded object-contain bg-white border" loading="lazy" width="48" height="48">`
      : `<div class="w-12 h-12 rounded bg-black text-white flex items-center justify-center text-sm font-semibold">${firstInitial(name)}</div>`;

    const visitBtn = website
      ? `<a href="${escapeAttr(website)}" target="_blank" rel="noopener"
            class="btn btn-outline w-full justify-center"
            aria-label="Visit website for ${escapeAttr(name)}">Visit website</a>`
      : '';

    const hasEmail = !!(isPremium && email);
    const hasCall  = !!(isPremium && tel);

    const emailBtn = hasEmail
      ? `<a href="mailto:${escapeAttr(email)}"
            class="btn btn-outline w-full justify-center ${!hasCall ? 'col-span-2' : ''}"
            aria-label="Email ${escapeAttr(name)}">Email us</a>`
      : '';

    const callBtn = hasCall
      ? (`
        <a class="btn btn-primary w-full justify-center ${!hasEmail ? 'col-span-2' : ''}"
           href="tel:${escapeAttr(tel)}"
           data-callnow="1"
           data-company="${escapeAttr(name)}"
           data-category="${escapeAttr(cat)}"
           data-tel="${escapeAttr(tel)}"
           data-display="${escapeAttr(display)}"
           aria-label="Call ${escapeAttr(name)} now">
          <span>Call now</span>
        </a>
      `) : '';

    const ctas = isPremium
      ? `
        <div class="mt-auto flex flex-col gap-2">
          <div class="grid grid-cols-2 gap-2">
            ${emailBtn}
            ${callBtn}
          </div>
          <div>${visitBtn || ''}</div>
        </div>
      `
      : `
        <div class="mt-auto">
          ${visitBtn || ''}
        </div>
      `;

    return `
      <article class="${base} ${isPremium ? 'card--premium' : ''} ${isPlaceholder ? 'card--placeholder' : ''}" data-card="1"
               data-name="${escapeAttr(name.toLowerCase())}"
               data-desc="${escapeAttr(desc.toLowerCase())}"
               data-category="${escapeAttr(cat.toLowerCase())}"
               data-plan="${isPremium?'premium':'free'}">

        ${isPremium ? '<div class="ribbon">FEATURED</div>' : ''}

        <div class="flex items-center gap-3">
          ${logoImg}
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-semibold text-base leading-tight">${escapeHtml(name)}</h3>
            </div>
            <p class="category truncate">${escapeHtml(cat)}</p>
          </div>
        </div>

        <p class="desc">${escapeHtml(desc)}</p>

        ${isPlaceholder ? `
          <div class="mt-auto">
            <a href="#applyModal" class="btn btn-primary w-full justify-center placeholder-cta-btn" style="background: linear-gradient(135deg, #23456D 0%, #1a3454 100%); font-weight: 700; font-size: 1.05rem; padding: 0.875rem 1.5rem; box-shadow: 0 4px 12px rgba(35, 69, 109, 0.3);">
              <span>Apply for Listing</span>
            </a>
          </div>
        ` : ctas}
      </article>
    `;
  }

  function groupCompanies(rows){
    const byCat = {};
    const categoryOrder = []; // Preserve order as categories first appear in spreadsheet data
    for (const row of rows){
      // Skip hidden companies (should already be filtered, but double-check)
      let plan = '';
      if (row.plan !== undefined && row.plan !== null) {
        plan = String(row.plan).toLowerCase().trim();
      }
      if (!plan && row.Plan !== undefined && row.Plan !== null) {
        plan = String(row.Plan).toLowerCase().trim();
      }
      
      const isHidden = plan === 'hidden' || 
                       plan === 'hide' ||
                       plan === 'h' ||
                       row.hidden === true || 
                       row.hidden === 'true' || 
                       row.hidden === 'yes' || 
                       row.hidden === 1 || 
                       row.hidden === 'hidden' ||
                       row.hidden === 'hide';
      
      if (isHidden) continue;
      
      const cat = (row.category||'').trim() || 'Other';
      if(!byCat[cat]) {
        byCat[cat] = { premium:[], free:[] };
        categoryOrder.push(cat); // Track order as categories first appear
      }
      const bucket = plan === 'premium' ? 'premium' : 'free';
      byCat[cat][bucket].push(row);
    }
    for (const cat of Object.keys(byCat)){
      byCat[cat].premium.sort((a,b)=>alpha(a.name,b.name));
      byCat[cat].free.sort((a,b)=>alpha(a.name,b.name));
    }
    return { groups: byCat, categoryOrder };
  }

  function alpha(a,b){ a=(a||'').toLowerCase(); b=(b||'').toLowerCase(); return a<b?-1:a>b?1:0; }
  function idSlug(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
  function initials(s){ const m=(s||'').match(/\b[A-Za-z]/g)||[]; return (m[0]||'').toUpperCase()+(m[1]||'').toUpperCase(); }
  function firstInitial(s){
    const m = String(s||'').match(/[A-Za-z0-9]/);
    return m ? m[0].toUpperCase() : '?';
  }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
  function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }

  function normPhone(raw){
    const digits = String(raw||'').replace(/\D/g,'');
    let d = digits;
    if(d.length===11 && d[0]==='1') d = d.slice(1);
    if(d.length!==10) return { tel:null, display: raw||'' };
    const tel = '+1'+d;
    const display = '(' + d.slice(0,3) + ') ' + d.slice(3,6) + '-' + d.slice(6);
    return { tel, display };
  }
};

function html(status, body){ return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } }); }