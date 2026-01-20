// /functions/counties.js
import { loadSitesRegistry } from './_lib.js';

/** Index page listing all county directories */
export const onRequestGet = async ({ request }) => {
  let sites;

  // Load site config
  try {
    sites = await loadSitesRegistry();
  } catch (err) {
    return html(500, `<!doctype html><h1>Config error</h1><pre>${escapeHtml(String(err))}</pre>`);
  }

  // Filter for county-specific directories
  const countyDirectories = Object.entries(sites)
    .filter(([domain]) => {
      // Exclude general directories
      if (domain.includes('mineral-services-directory')) return false;
      if (domain.includes('permian-basin')) return false; // Not a county
      // Include only county-specific domains (format: *-county-*.mineralrightsforum.com)
      return domain.includes('-county-') && domain.includes('.mineralrightsforum.com');
    })
    .map(([domain, config]) => {
      // Extract county name from domain
      // e.g., "reeves-county-texas.mineralrightsforum.com" -> "Reeves County, TX"
      const domainParts = domain.replace('.mineralrightsforum.com', '').split('-');
      const countyIndex = domainParts.indexOf('county');
      
      if (countyIndex === -1) {
        // Fallback: try to extract from page_title or serving_line
        const title = config.page_title || config.serving_line || domain;
        return {
          domain,
          name: title.split(',')[0].trim(),
          state: 'TX',
          url: `https://${domain}/`,
          config
        };
      }

      // Extract county name (everything before "county")
      const countyParts = domainParts.slice(0, countyIndex);
      const countyName = countyParts
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ') + ' County';

      // Extract state (everything after "county") and convert to abbreviation
      // Join all parts after "county" to handle multi-word states like "new-mexico"
      const stateParts = domainParts.slice(countyIndex + 1);
      const stateNameFromDomain = stateParts.length > 0 
        ? stateParts.join('-').toLowerCase() 
        : 'texas';
      
      // Map full state name to abbreviation
      const stateNameToAbbrMap = {
        'texas': 'TX',
        'oklahoma': 'OK',
        'new-mexico': 'NM',
        'louisiana': 'LA',
        'arkansas': 'AR',
        'colorado': 'CO',
        'wyoming': 'WY',
        'north-dakota': 'ND',
        'montana': 'MT',
        'utah': 'UT',
        'kansas': 'KS'
      };
      
      const stateAbbr = stateNameToAbbrMap[stateNameFromDomain] || 'TX';

      return {
        domain,
        name: countyName,
        state: stateAbbr,
        url: `https://${domain}/`,
        config
      };
    })
    .sort((a, b) => {
      // Sort alphabetically by county name
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
    });

  // Group counties by state
  const countiesByState = {};
  countyDirectories.forEach(county => {
    const state = county.state;
    if (!countiesByState[state]) {
      countiesByState[state] = [];
    }
    countiesByState[state].push(county);
  });

  // State name mapping (abbreviation -> full name)
  const stateNames = {
    'TX': 'Texas',
    'OK': 'Oklahoma',
    'NM': 'New Mexico',
    'LA': 'Louisiana',
    'AR': 'Arkansas',
    'CO': 'Colorado',
    'WY': 'Wyoming',
    'ND': 'North Dakota',
    'MT': 'Montana',
    'UT': 'Utah',
    'KS': 'Kansas'
  };

  // Reverse mapping (full name -> abbreviation) for fallback lookup
  const stateNameToAbbr = {
    'Texas': 'TX',
    'Oklahoma': 'OK',
    'New Mexico': 'NM',
    'Louisiana': 'LA',
    'Arkansas': 'AR',
    'Colorado': 'CO',
    'Wyoming': 'WY',
    'North Dakota': 'ND',
    'Montana': 'MT',
    'Utah': 'UT',
    'Kansas': 'KS'
  };

  // State flag image URLs (using Wikimedia Commons with direct PNG links)
  const stateFlags = {
    'TX': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Flag_of_Texas.svg/320px-Flag_of_Texas.svg.png',
    'OK': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Flag_of_Oklahoma.svg/320px-Flag_of_Oklahoma.svg.png',
    'NM': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Flag_of_New_Mexico.svg/320px-Flag_of_New_Mexico.svg.png',
    'LA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Flag_of_Louisiana.svg/320px-Flag_of_Louisiana.svg.png',
    'AR': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Flag_of_Arkansas.svg/320px-Flag_of_Arkansas.svg.png',
    'CO': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Flag_of_Colorado.svg/320px-Flag_of_Colorado.svg.png',
    'WY': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Flag_of_Wyoming.svg/320px-Flag_of_Wyoming.svg.png',
    'ND': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Flag_of_North_Dakota.svg/320px-Flag_of_North_Dakota.svg.png',
    'MT': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/Flag_of_Montana.svg/320px-Flag_of_Montana.svg.png',
    'UT': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Flag_of_Utah.svg/320px-Flag_of_Utah.svg.png',
    'KS': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Flag_of_Kansas.svg/320px-Flag_of_Kansas.svg.png'
  };

  // Build HTML grouped by state
  const pageUrl = new URL(request.url).origin;
  const stateSections = Object.keys(countiesByState)
    .sort() // Sort states alphabetically
    .map(stateAbbr => {
      const stateName = stateNames[stateAbbr] || stateAbbr;
      const counties = countiesByState[stateAbbr];
      const stateId = `state-${stateAbbr.toLowerCase()}`;
      
      const countyList = counties.map(county => {
        const description = county.config.serving_line || county.config.page_title || '';
        
        return `
          <li class="county-list-item">
            <a href="${escapeAttr(county.url)}" class="county-list-link">
              <h3 class="county-list-name">${escapeHtml(county.name)}</h3>
              ${description ? `<span class="county-list-desc">${escapeHtml(description)}</span>` : ''}
            </a>
          </li>
        `;
      }).join('');

      // Get flag URL - try multiple lookup methods
      // First try direct abbreviation lookup (should be 'TX', 'OK', etc.)
      let flagUrl = stateFlags[stateAbbr];
      
      // If not found, try uppercase version
      if (!flagUrl && stateAbbr) {
        flagUrl = stateFlags[stateAbbr.toUpperCase()];
      }
      
      // If still not found, try looking up by state name (fallback)
      if (!flagUrl && stateName) {
        const abbrFromName = stateNameToAbbr[stateName];
        if (abbrFromName) {
          flagUrl = stateFlags[abbrFromName];
        }
      }
      
      const finalFlagUrl = flagUrl;
      
      const flagImgHtml = finalFlagUrl 
        ? `<img src="${escapeAttr(finalFlagUrl)}" alt="${escapeHtml(stateName)} flag" class="state-flag" width="32" height="24" loading="lazy" />`
        : '';

      return `
        <div class="state-section">
          <button class="state-header" data-state="${stateAbbr}" aria-expanded="true" aria-controls="${stateId}">
            ${flagImgHtml || '<span class="state-flag-placeholder"></span>'}
            <h2 class="state-name">${escapeHtml(stateName)}</h2>
            <span class="state-count">(${counties.length})</span>
            <svg class="state-chevron" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9l6 6 6-6"></path>
            </svg>
          </button>
          <div class="state-content" id="${stateId}">
            <ul class="county-list">
              ${countyList}
            </ul>
          </div>
        </div>
      `;
    }).join('');

  return html(200, /* html */`<!doctype html>
<html lang="en">
  <head>
    <link rel="icon" type="image/png" sizes="48x48" href="https://pub-06eb4d473d5a4ae3b3274a9a1919e3d7.r2.dev/mrf-favicon-48x48.png">
    <link rel="stylesheet" href="/styles.css?v=202511080417p">
    <meta charset="utf-8">
    <link rel="canonical" href="${pageUrl}">
    <title>County Index of Mineral Service Professionals | Mineral Rights Forum</title>
    <meta property="og:title" content="County Index of Mineral Service Professionals | Mineral Rights Forum">
    <meta property="og:description" content="Browse all USA county-specific mineral rights professional directories.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${pageUrl}">
    <meta property="og:image" content="https://www.mineralrightsforum.com/uploads/db5755/original/3X/7/7/7710a47c9cd8492b1935dd3b8d80584938456dd4.jpeg">
    <meta property="og:site_name" content="Mineral Rights Forum">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="description" content="Browse all USA county-specific mineral rights professional directories.">
    <meta name="robots" content="index, follow">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://static.mineralrightsforum.com/styles.css">
    <!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','GTM-M6JQPF');</script>
    <!-- End Google Tag Manager -->
    <!-- Google Analytics 4 -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZS0JTM2XTR"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-ZS0JTM2XTR');
    </script>
    <style>
      :root{
        --sticky-offset: 64px;
        --mrf-primary: #111827;
        --mrf-primary-700: #0f172a;
        --mrf-text-on-primary: #ffffff;
        --mrf-outline: #e5e7eb;
        --mrf-border: #e5e7eb;
        --mrf-subtle: #6b7280;
        --mrf-accent: #f59e0b;
        --mrf-accent-600: #d97706;
      }
      html{ scroll-behavior:smooth; }
      html, body {
        width: 100%;
        overflow-x: hidden;
        max-width: 100vw;
      }
      body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;color:#111;line-height:1.5}
      .site-wrapper, .page, .content, .container, main, footer, header {
        max-width: 100%;
        overflow-x: hidden;
      }
      * { box-sizing: border-box; }
      img, video, iframe, embed, object { max-width: 100%; height: auto; }
      .container{max-width:1280px;margin:0 auto;padding:1rem}
      .shadow-soft{box-shadow:0 1px 2px rgba(0,0,0,.05),0 1px 3px rgba(0,0,0,.1)}
      
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
      
      .srch{width:100%;max-width:28rem}
      
      .expand-collapse-buttons {
        display: flex;
        gap: 0.5rem;
      }
      
      .btn-expand-collapse {
        padding: 0.625rem 1.25rem;
        background: #23456D;
        color: #ffffff;
        border: none;
        border-radius: 0.5rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.9375rem;
        white-space: nowrap;
      }
      
      .btn-expand-collapse:hover {
        background: #1a3454;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(35, 69, 109, 0.2);
      }
      
      .btn-expand-collapse:active {
        transform: translateY(0);
        box-shadow: none;
      }
      
      /* State Sections */
      .states-container {
        max-width: 900px;
        margin: 0 auto 3rem;
      }
      
      .state-section.hidden {
        display: none;
      }
      
      .county-list-item.hidden {
        display: none;
      }
      
      .state-section {
        background: white;
        border: 1px solid var(--mrf-border);
        border-radius: 0.75rem;
        margin-bottom: 1rem;
        overflow: hidden;
        box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 1px 3px rgba(0,0,0,.1);
      }
      
      .state-header {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.25rem 1.5rem;
        background: var(--mrf-primary);
        color: var(--mrf-text-on-primary);
        border: none;
        cursor: pointer;
        font-size: 1.125rem;
        font-weight: 600;
        text-align: left;
        transition: background 0.2s ease;
        gap: 0.75rem;
      }
      
      .state-header:hover {
        background: var(--mrf-primary-700);
      }
      
      .state-header .state-chevron {
        transform: rotate(0deg);
      }
      
      .state-header[aria-expanded="false"] .state-chevron {
        transform: rotate(-90deg);
      }
      
      .state-flag {
        width: 32px;
        height: 24px;
        object-fit: cover;
        border-radius: 2px;
        flex-shrink: 0;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      .state-flag-placeholder {
        width: 32px;
        height: 24px;
        background: rgba(255, 255, 255, 0.2);
        display: inline-block;
        border-radius: 2px;
        flex-shrink: 0;
        border: 1px solid rgba(255, 255, 255, 0.3);
      }
      
      .state-name {
        flex: 1;
        margin: 0;
        font-size: inherit;
        font-weight: inherit;
      }
      
      .state-count {
        margin-left: 0.5rem;
        font-weight: 400;
        opacity: 0.9;
      }
      
      .state-chevron {
        margin-left: 1rem;
        transition: transform 0.3s ease;
        flex-shrink: 0;
      }
      
      .state-content {
        max-height: 2000px;
        overflow: hidden;
        transition: max-height 0.3s ease, padding 0.3s ease;
        padding: 1rem 1.5rem;
      }
      
      .state-section.collapsed .state-content {
        max-height: 0;
        padding: 0 1.5rem;
      }
      
      .county-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      
      .county-list-item {
        margin-bottom: 0.75rem;
      }
      
      .county-list-item:last-child {
        margin-bottom: 0;
      }
      
      .county-list-link {
        display: block;
        padding: 0.875rem 1rem;
        background: #f9fafb;
        border: 1px solid var(--mrf-border);
        border-radius: 0.5rem;
        text-decoration: none;
        color: var(--mrf-primary);
        transition: all 0.2s ease;
      }
      
      .county-list-link:hover {
        background: #f3f4f6;
        border-color: var(--mrf-accent);
        transform: translateX(4px);
        box-shadow: 0 2px 4px rgba(0,0,0,.05);
      }
      
      .county-list-name {
        display: block;
        font-weight: 600;
        font-size: 1rem;
        margin: 0 0 0.25rem 0;
      }
      
      .county-list-desc {
        display: block;
        font-size: 0.875rem;
        color: var(--mrf-subtle);
        line-height: 1.4;
      }
      
      /* Buttons */
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.625rem 1.25rem;
        border-radius: 0.5rem;
        border: 1px solid var(--mrf-outline);
        font-weight: 500;
        text-decoration: none;
        transition: all 0.2s ease;
        cursor: pointer;
      }
      
      .btn-primary {
        background: var(--mrf-primary);
        color: var(--mrf-text-on-primary);
        border-color: var(--mrf-primary);
      }
      
      .btn-primary:hover {
        background: var(--mrf-primary-700);
        border-color: var(--mrf-primary-700);
        transform: translateY(-1px);
        box-shadow: 0 4px 6px rgba(0,0,0,.1);
      }
      
      /* Footer */
      footer {
        background: var(--mrf-primary);
        color: #f9fafb;
        padding: 2.5rem 0;
        margin-top: 3rem;
        width: 100%;
      }
      
      .footer-content {
        display: flex;
        flex-wrap: wrap;
        gap: 2rem;
        justify-content: space-between;
        align-items: flex-start;
      }
      
      .footer-left {
        flex: 0 0 auto;
        text-align: left;
      }
      
      .footer-left h3 {
        font-size: 1.125rem;
        font-weight: 700;
        color: #f9fafb;
        margin: 0 0 0.5rem 0;
      }
      
      .footer-left p {
        font-size: 0.875rem;
        color: #d1d5db;
        margin: 0;
        line-height: 1.5;
      }
      
      .footer-right {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        align-items: flex-end;
        text-align: right;
      }
      
      .footer-menu {
        display: flex;
        flex-wrap: wrap;
        gap: 1.5rem;
        list-style: none;
        margin: 0;
        padding: 0;
        justify-content: flex-end;
      }
      
      .footer-menu a {
        color: #e5e7eb;
        text-decoration: none;
        font-size: 0.9375rem;
        transition: color 0.2s ease;
      }
      
      .footer-menu a:hover {
        color: #ffffff;
      }
      
      .footer-social {
        display: flex;
        gap: 1rem;
        align-items: center;
      }
      
      .footer-social a {
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
      
      .footer-social a:hover {
        background: rgba(255, 255, 255, 0.2);
        color: #ffffff;
      }
      
      .footer-social svg {
        width: 20px;
        height: 20px;
      }
      
      @media (max-width: 767px) {
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

        /* Hide inline filters in the sticky bar on mobile */
        .dir-sticky .filters-row{
          display: none;
        }

        /* Reduce space under black sticky bar */
        .dir-sticky{
          margin-bottom: 0px !important;
        }
        
        .states-container {
          margin: 0 auto 2rem;
        }
        
        .state-header {
          padding: 1rem 1.25rem;
          font-size: 1rem;
        }
        
        .state-content {
          padding: 0.75rem 1.25rem;
        }
        
        .state-section.collapsed .state-content {
          padding: 0 1.25rem;
        }
        
        .county-list-link {
          padding: 0.75rem;
        }
        
        footer {
          padding: 2rem 0;
        }
        
        .footer-content {
          flex-direction: column;
          gap: 1.5rem;
          align-items: center;
          text-align: center;
        }
        
        .footer-left {
          text-align: center;
        }
        
        .footer-right {
          align-items: center;
          text-align: center;
        }
        
        .footer-menu {
          justify-content: center;
        }
      }
    </style>
  </head>
  <body class="bg-white">

    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-M6JQPF"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->

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
          <button class="header-back-btn" style="display: none;" id="returnBtn" data-return-url="https://www.mineralrightsforum.com">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <span>Return to Forum</span>
          </button>
        </div>
      </div>
    </header>

    <!-- ===== DIRECTORY STICKY BAR (TITLE + FILTERS) ===== -->
    <div class="dir-sticky">
      <div class="container py-1">
        <div class="flex flex-col gap-2 md:flex-row items-center md:items-center md:justify-between">
          <div>
            <h1 class="text-xl font-bold whitespace-pre-line">County Index of Mineral Professionals</h1>
          </div>
          <div class="flex gap-2 items-center filters-row">
            <input id="countySearch" class="srch border rounded-lg px-3 py-2" type="search" placeholder="Search counties..." aria-label="Search counties">
            <div class="expand-collapse-buttons">
              <button id="expandAll" class="btn-expand-collapse">Expand All</button>
              <button id="collapseAll" class="btn-expand-collapse">Collapse All</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== CONTENT ===== -->
    <main class="container">
      <div class="states-container">
        ${stateSections}
      </div>
    </main>

    <script>
      document.addEventListener('DOMContentLoaded', () => {
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
        
        // Handle return button click
        if (returnBtn) {
          const returnUrl = returnBtn.getAttribute('data-return-url') || 'https://www.mineralrightsforum.com';
          returnBtn.addEventListener('click', () => {
            window.location.href = returnUrl;
          });
        }
        
        const stateHeaders = document.querySelectorAll('.state-header');
        const countySearch = document.getElementById('countySearch');
        const expandAllBtn = document.getElementById('expandAll');
        const collapseAllBtn = document.getElementById('collapseAll');
        
        // Handle state section expand/collapse
        stateHeaders.forEach(header => {
          header.addEventListener('click', () => {
            const stateSection = header.closest('.state-section');
            const isExpanded = header.getAttribute('aria-expanded') === 'true';
            
            // Toggle collapsed class
            if (isExpanded) {
              stateSection.classList.add('collapsed');
              header.setAttribute('aria-expanded', 'false');
            } else {
              stateSection.classList.remove('collapsed');
              header.setAttribute('aria-expanded', 'true');
            }
          });
        });
        
        // Expand all functionality
        expandAllBtn.addEventListener('click', () => {
          stateHeaders.forEach(header => {
            const stateSection = header.closest('.state-section');
            stateSection.classList.remove('collapsed');
            header.setAttribute('aria-expanded', 'true');
          });
        });
        
        // Collapse all functionality
        collapseAllBtn.addEventListener('click', () => {
          stateHeaders.forEach(header => {
            const stateSection = header.closest('.state-section');
            stateSection.classList.add('collapsed');
            header.setAttribute('aria-expanded', 'false');
          });
        });
        
        // Search functionality
        function filterCounties(searchTerm) {
          const term = searchTerm.toLowerCase().trim();
          const countyItems = document.querySelectorAll('.county-list-item');
          const stateSections = document.querySelectorAll('.state-section');
          
          let hasVisibleCounties = false;
          
          // Filter county items
          countyItems.forEach(item => {
            const countyName = item.querySelector('.county-list-name')?.textContent.toLowerCase() || '';
            const countyDesc = item.querySelector('.county-list-desc')?.textContent.toLowerCase() || '';
            
            const matches = !term || countyName.includes(term) || countyDesc.includes(term);
            item.classList.toggle('hidden', !matches);
            
            if (matches) {
              hasVisibleCounties = true;
            }
          });
          
          // Show/hide state sections based on visible counties
          stateSections.forEach(section => {
            const visibleCounties = section.querySelectorAll('.county-list-item:not(.hidden)');
            section.classList.toggle('hidden', visibleCounties.length === 0);
          });
          
          // Auto-expand sections with matching counties
          if (term) {
            stateSections.forEach(section => {
              const visibleCounties = section.querySelectorAll('.county-list-item:not(.hidden)');
              if (visibleCounties.length > 0) {
                const header = section.querySelector('.state-header');
                section.classList.remove('collapsed');
                if (header) {
                  header.setAttribute('aria-expanded', 'true');
                }
              }
            });
          }
        }
        
        // Debounce function for search
        function debounce(func, wait) {
          let timeout;
          return function executedFunction(...args) {
            const later = () => {
              clearTimeout(timeout);
              func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
          };
        }
        
        // Add search event listener with debounce
        countySearch.addEventListener('input', debounce((e) => {
          filterCounties(e.target.value);
        }, 200));
      });
    </script>

    <footer>
      <div class="container">
        <div class="footer-content">
          <div class="footer-left">
            <span>The Mineral Rights Forum</span>
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
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584l-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>
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

  </body>
</html>
`);

  // -------- helpers --------
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }
};

function html(status, body) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

