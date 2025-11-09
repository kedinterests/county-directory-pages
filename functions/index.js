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

  // Group + sort
  const groups = groupCompanies(companies);
  const categoryNames = Object.keys(groups).sort(alpha);
  const { serving_line, seo } = site;

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
            style="top: var(--sticky-offset);"
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
  <link rel="stylesheet" href="/styles.css?v=202511080417p">
  <meta charset="utf-8">
  <title>${escapeHtml(seo?.title || 'Directory')}</title>
  <meta property="og:title" content="${escapeHtml(seo?.title || 'Directory')}">
  <meta property="og:description" content="${escapeHtml(seo?.description || '')}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="description" content="${escapeHtml(seo?.description || '')}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://static.mineralrightsforum.com/styles.css">
  <style>
    :root{
      --sticky-offset: 64px;
      --mrf-primary: #111827;       /* gray-900 */
      --mrf-primary-700: #0f172a;   /* slate-900-ish */
      --mrf-text-on-primary: #ffffff;
      --mrf-outline: #e5e7eb;       /* gray-200 */
      --mrf-accent: #f59e0b;        /* amber-500 */
      --mrf-accent-600: #d97706;    /* amber-600 */
    }
    html{ scroll-behavior:smooth; }
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;color:#111;line-height:1.5}
    .container{max-width:1280px;margin:0 auto;padding:1rem}
    .shadow-soft{box-shadow:0 1px 2px rgba(0,0,0,.05),0 1px 3px rgba(0,0,0,.1)}
    .hidden{display:none !important}
    .srch{width:100%;max-width:28rem}
    .dir-sticky{position:sticky;top:0;z-index:30;background:rgba(255,255,255,.96);backdrop-filter:saturate(1.8) blur(8px);border-bottom:1px solid #eee}

    /* Card base (ensures ribbon is clipped on all devices) */
    .card{position:relative;border:1px solid #e5e7eb;background:#fff;border-radius:.75rem;padding:1rem;overflow:hidden}

    /* Hide top search on mobile; drawer handles filtering there */
    @media (max-width:1023px){ .srch,#q{display:none} }

    /* Buttons — brand */
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;padding:.5rem .8rem;border-radius:.5rem;border:1px solid var(--mrf-outline);font-weight:500}
    .btn-primary{background:var(--mrf-primary);color:var(--mrf-text-on-primary);border-color:var(--mrf-primary)}
    .btn-primary:hover{background:var(--mrf-primary-700);border-color:var(--mrf-primary-700)}
    .btn-outline{background:#fff;color:var(--mrf-primary);border-color:var(--mrf-primary)}
    .btn-outline:hover{background:#f8fafc}

    /* Pills bar centering + mobile hide */
    #jump{display:flex;flex-wrap:wrap;justify-content:center;gap:.5rem;margin-top:.25rem}
    @media (max-width:1023px){#jump{display:none}}

    /* Mobile drawer helpers */
    .mobile-drawer{display:none}
    .mobile-drawer.open{display:block}
    .featured-only-label{white-space:nowrap}
  </style>
</head>
<body class="bg-white">

  <!-- ===== MRF HEADER ===== -->
  <header class="z-10 bg-white shadow-xl">
    <div class="bg-white max-w-7xl mx-auto px-4 sm:px-6 py-3 border-b border-gray-200">
      <div class="flex items-center justify-between gap-4">
        <a href="https://www.mineralrightsforum.com" class="block w-fit">
          <img src="https://www.mineralrightsforum.com/uploads/db5755/original/3X/7/7/7710a47c9cd8492b1935dd3b8d80584938456dd4.jpeg"
               alt="Mineral Rights Forum Logo"
               class="h-12 w-auto rounded-lg"
               onerror="this.onerror=null;this.src='https://placehold.co/150x40/d1d5db/4b5563?text=MRF+Logo'">
        </a>
        <span class="hidden md:inline text-gray-700 font-medium">
          Conversation for America's Mineral Owners
        </span>
      </div>
    </div>

    <nav class="bg-gray-900">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap justify-center items-center py-0">
        <a href="https://www.mineralrightsforum.com" class="text-white hover:bg-gray-700 transition duration-150 py-3 px-4 block text-md font-bold rounded-md">Home</a>
        <a href="https://mineralrightsforum.com/latest" class="text-white hover:bg-gray-700 transition duration-150 py-3 px-4 hidden sm:block text-md font-bold">Latest Posts</a>
        <a href="https://mineralrightsforum.com/categories" class="text-white hover:bg-gray-700 transition duration-150 py-3 px-4 hidden sm:block text-md font-bold">Categories</a>
        <a href="https://mineralrightsforum.com/t/advertise-with-us-to-reach-mineral-owners/24986" class="text-white hover:bg-gray-700 transition duration-150 py-3 px-4 hidden sm:block text-md font-bold">Advertise with Us</a>
        <a href="https://mineralrightsforum.com/search" class="text-white hover:bg-gray-700 transition duration-150 py-3 px-4 text-md font-bold">Search</a>
      </div>
    </nav>
  </header>

  <!-- ===== DIRECTORY STICKY BAR ===== -->
  <div class="dir-sticky">
    <div class="container py-3">
      <div class="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
        <div>
          <h1 class="text-2xl font-bold">${escapeHtml(seo?.title || 'Directory')}</h1>
          <p class="text-sm text-gray-600">${escapeHtml(serving_line || '')}</p>
        </div>
        <div class="flex gap-2 items-center">
          <input id="q" class="srch border rounded-lg px-3 py-2" type="search" placeholder="Search companies or descriptions…">
          <select id="cat" class="border rounded-lg px-2 py-2">
            <option value="">All categories</option>
            ${categoryNames.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
          </select>
          <label id="controls" class="flex items-center gap-2 text-sm featured-only-label">
            <input id="onlyPremium" type="checkbox"> Featured only
          </label>
        </div>
      </div>
      <nav id="jump">
        ${navItems}
      </nav>
    </div>
  </div>

  <!-- ===== CONTENT ===== -->
  <main class="container">
    ${sections}
    <footer class="py-10 text-sm text-gray-500">
      <p>Last updated: ${escapeHtml(updatedAt || '')}</p>
    </footer>
  </main>

  <!-- Desktop Call Now Modal -->
  <div id="callModal" class="hidden fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/40" data-close="1"></div>
    <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-[min(92vw,28rem)] shadow-soft">
      <h3 class="text-lg font-semibold mb-2">Call Now</h3>
      <p id="callNumber" class="text-2xl font-bold tracking-wide"></p>
      <div class="mt-5 flex justify-end gap-2">
        <button class="btn btn-outline" data-close="1">Close</button>
      </div>
    </div>
  </div>

  <script>
  document.addEventListener('DOMContentLoaded', () => {
    // ---- Client enhancements ----
    const q = document.getElementById('q');
    const cat = document.getElementById('cat');
    const onlyPremium = document.getElementById('onlyPremium');
    const isDesktop = matchMedia('(hover: hover)').matches;

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

      // Hide sections with zero visible cards
      document.querySelectorAll('section[id^="cat-"]').forEach(sec=>{
        const grid = sec.querySelector('[data-category-grid]');
        const hasVisible = !!grid && Array.from(grid.querySelectorAll('article'))
          .some(a => a.offsetParent !== null);
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
    modal?.addEventListener('click', (e)=>{ if(e.target.dataset.close) modal.classList.add('hidden'); });
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

    // --- Mobile bottom bar + drawer ---
    const mbFilterBtn = document.getElementById('mbFilterBtn');
    const mbDrawer = document.getElementById('mbDrawer');
    const mbClose = document.getElementById('mbClose');
    const mbApply = document.getElementById('mbApply');
    const mb_q = document.getElementById('mb_q');
    const mb_cat = document.getElementById('mb_cat');
    const mb_onlyPremium = document.getElementById('mb_onlyPremium');

    mbFilterBtn?.addEventListener('click', ()=> mbDrawer?.classList.add('open'));
    mbClose?.addEventListener('click', ()=> mbDrawer?.classList.remove('open'));

    mbApply?.addEventListener('click', ()=>{
      const qMain = document.getElementById('q');
      const catMain = document.getElementById('cat');
      const premMain = document.getElementById('onlyPremium');

      if(qMain) qMain.value = mb_q?.value || '';
      if(catMain) catMain.value = mb_cat?.value || '';
      if(premMain) premMain.checked = !!mb_onlyPremium?.checked;

      applyFilter();
      mbDrawer?.classList.remove('open');
    });

    // Sync drawer inputs when it opens
    mbFilterBtn?.addEventListener('click', ()=>{
      if (mb_q)   mb_q.value = q?.value || '';
      if (mb_cat) mb_cat.value = cat?.value || '';
      if (mb_onlyPremium && onlyPremium) mb_onlyPremium.checked = !!onlyPremium.checked;
    });
  });
  </script>

  <!-- ===== Mobile Bottom Filter Bar ===== -->
  <div class="mobile-filter-bar md:hidden">
    <button id="mbFilterBtn" class="btn btn-outline w-full justify-center">Filter</button>
    <a href="#top" class="btn btn-outline">Top</a>
  </div>

  <!-- Drawer panel -->
  <div id="mbDrawer" class="mobile-drawer md:hidden" aria-hidden="true">
    <div class="mobile-drawer-header">
      <strong>Filter</strong>
      <button id="mbClose" class="btn btn-outline">Close</button>
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
        <button id="mbApply" class="btn btn-primary w-full justify-center">Apply</button>
      </div>
    </div>
  </div>
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

    // Hooked card class; premium styling via CSS
    const base = 'card flex flex-col gap-3';

    const logoImg = logo
      ? `<img src="${escapeAttr(logo)}" alt="" class="w-12 h-12 rounded object-contain bg-white border" loading="lazy" width="48" height="48">`
      : `<div class="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-sm font-semibold">${initials(name)}</div>`;

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
      <article class="${base} ${isPremium ? 'card--premium' : ''}" data-card="1"
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

        <p class="desc line-clamp-3">${escapeHtml(desc)}</p>

        ${ctas}
      </article>
    `;
  }

  function groupCompanies(rows){
    const byCat = {};
    for (const row of rows){
      const cat = (row.category||'').trim() || 'Other';
      if(!byCat[cat]) byCat[cat] = { premium:[], free:[] };
      const bucket = (row.plan||'').toLowerCase()==='premium' ? 'premium' : 'free';
      byCat[cat][bucket].push(row);
    }
    for (const cat of Object.keys(byCat)){
      byCat[cat].premium.sort((a,b)=>alpha(a.name,b.name));
      byCat[cat].free.sort((a,b)=>alpha(a.name,b.name));
    }
    return byCat;
  }

  function alpha(a,b){ a=(a||'').toLowerCase(); b=(b||'').toLowerCase(); return a<b?-1:a>b?1:0; }
  function idSlug(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }
  function initials(s){ const m=(s||'').match(/\b[A-Za-z]/g)||[]; return (m[0]||'').toUpperCase()+(m[1]||'').toUpperCase(); }
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