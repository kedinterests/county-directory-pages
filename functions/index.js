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
  const countySlug = slugify(serving_line || host);

  // Build category nav items
  const navItems = categoryNames.map(c => `<a href="#cat-${idSlug(c)}" class="px-3 py-1 rounded-lg hover:bg-gray-100">${escapeHtml(c)}</a>`).join('');

  // Build sections
  const sections = categoryNames.map(cat => {
    const { premium, free } = groups[cat];
    const all = premium.concat(free);
    const cards = all.map(row => renderCard(row)).join('');
    return `
      <section id="cat-${idSlug(cat)}" class="scroll-mt-28">
        <h2 class="sticky top-24 z-20 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 px-2 py-2 text-xl font-semibold border-b"
            data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 py-4" data-category-grid="${escapeHtml(cat)}">
          ${cards}
        </div>
      </section>
    `;
  }).join('');

  // Count for analytics
  const companyCount  = companies.length;
  const categoryCount = categoryNames.length;

  // HTML shell (Tailwind classes in markup; you’re serving a shared CSS file)
  return html(200, /* html */`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(seo?.title || 'Directory')}</title>
  <meta name="description" content="${escapeHtml(seo?.description || '')}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${gtmHead(env.GTM_CONTAINER_ID, host)}
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${/* If you host a shared CSS, link it here. Example shown: */''}
  <link rel="stylesheet" href="https://static.mineralrightsforum.com/styles.css">
  <style>
    /* Minimal safety styles if your shared CSS hasn’t shipped yet */
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif; color:#111; line-height:1.5}
    .container{max-width:1200px;margin:0 auto;padding:1rem}
    .shadow-soft{box-shadow:0 1px 2px rgba(0,0,0,.05),0 1px 3px rgba(0,0,0,.1)}
    .btn{display:inline-flex;align-items:center;justify-content:center;padding:.5rem .75rem;border-radius:.5rem;border:1px solid #e5e7eb}
    .badge{display:inline-flex;align-items:center;gap:.375rem;font-size:.75rem;border-radius:9999px;padding:.125rem .5rem;border:1px solid #f59e0b33;background:#f59e0b1a}
    .sticky-nav{position:sticky;top:0;z-index:30;background:rgba(255,255,255,.92);backdrop-filter:saturate(1.8) blur(8px);border-bottom:1px solid #eee}
    .sticky-sub{position:sticky;top:3.5rem;z-index:20;background:rgba(255,255,255,.92);backdrop-filter:saturate(1.8) blur(8px)}
    .hidden{display:none !important}
    .srch{width:100%;max-width:28rem}
  </style>
</head>
<body class="bg-white">
  ${gtmBody(env.GTM_CONTAINER_ID)}

  <header class="sticky-nav">
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
          <label class="flex items-center gap-2 text-sm"><input id="onlyPremium" type="checkbox"> Premium only</label>
        </div>
      </div>
      <nav id="jump" class="flex gap-1 overflow-x-auto mt-3 pb-2">
        ${navItems}
      </nav>
    </div>
  </header>

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
        <button class="btn" data-close="1">Close</button>
      </div>
    </div>
  </div>

  <script>
    // ---- Small client enhancements (no framework) ----

    // GA/TagManager events (safe wrappers)
    window.dataLayer = window.dataLayer || [];
    function dl(ev){ try { window.dataLayer.push(ev); } catch(e){} }

    // Boot & first view
    dl({event:'directory_view', site_host: ${JSON.stringify(host)}, site_serving_line:${JSON.stringify(serving_line||'')}, company_count:${companyCount}, category_count:${categoryCount}});

    // Basic filter
    const q = document.getElementById('q');
    const cat = document.getElementById('cat');
    const onlyPremium = document.getElementById('onlyPremium');

    const isDesktop = matchMedia('(hover: hover)').matches;

    function normalize(s){ return (s||'').toLowerCase(); }

    function applyFilter(){
      const term = normalize(q.value);
      const cval = cat.value;
      const premiumOnly = !!onlyPremium.checked;
      let shown = 0;

      document.querySelectorAll('[data-card]').forEach(el=>{
        const name = el.getAttribute('data-name');
        const desc = el.getAttribute('data-desc');
        const category = el.getAttribute('data-category');
        const plan = el.getAttribute('data-plan');
        const matchesTerm = !term || name.includes(term) || desc.includes(term);
        const matchesCat  = !cval || category === cval;
        const matchesPlan = !premiumOnly || plan === 'premium';
        const show = matchesTerm && matchesCat && matchesPlan;
        el.classList.toggle('hidden', !show);
        if(show) shown++;
      });

      dl({event:'directory_filter', search_query:q.value||'', category_selected:cval||'', premium_only:premiumOnly, results_count:shown});
    }

    q.addEventListener('input', debounce(applyFilter, 120));
    cat.addEventListener('change', applyFilter);
    onlyPremium.addEventListener('change', applyFilter);

    function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }

    // Jump links active state via IntersectionObserver
    const headings = Array.from(document.querySelectorAll('section>h2'));
    const jump = document.getElementById('jump');
    const jumpLinks = Array.from(jump.querySelectorAll('a'));
    const hMap = Object.fromEntries(headings.map(h=>['#'+h.parentElement.id, h]));

    const io = new IntersectionObserver((entries)=>{
      let best;
      for(const e of entries){
        if(e.isIntersecting){
          if(!best || e.boundingClientRect.top < best.boundingClientRect.top) best = e;
        }
      }
      if(best){
        const id = '#'+best.target.parentElement.id;
        jumpLinks.forEach(a=>a.classList.toggle('bg-gray-100', a.getAttribute('href')===id));
      }
    }, {rootMargin:'-120px 0px -70% 0px', threshold:[0,1]});
    headings.forEach(h=>io.observe(h));

    // Premium "Call Now" handling
    const modal = document.getElementById('callModal');
    const callNumber = document.getElementById('callNumber');
    modal.addEventListener('click', (e)=>{ if(e.target.dataset.close) modal.classList.add('hidden'); });
    window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') modal.classList.add('hidden'); });

    document.addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-callnow]');
      if(!btn) return;
      const name = btn.getAttribute('data-company');
      const category = btn.getAttribute('data-category');
      const plan = 'premium';
      const tel = btn.getAttribute('data-tel');
      const display = btn.getAttribute('data-display');

      if(isDesktop){
        e.preventDefault();
        callNumber.textContent = display || tel || '';
        modal.classList.remove('hidden');
        dl({event:'directory_call_desktop_modal_open', company_name:name, category, plan});
      }else{
        // mobile: let anchor behave (tel:)
        dl({event:'directory_call_mobile', company_name:name, category, plan, phone_tel:tel});
      }
    });

    // Outbound click tracking for "Visit Site"
    document.addEventListener('click', (e)=>{
      const a = e.target.closest('a[data-out]');
      if(!a) return;
      dl({
        event:'directory_click_outbound',
        company_name: a.getAttribute('data-company') || '',
        category: a.getAttribute('data-category') || '',
        plan: a.getAttribute('data-plan') || '',
        destination_url: a.href || '',
        utm_campaign: ${JSON.stringify(countySlug)}
      });
    });

  </script>
</body>
</html>
`);

  // --------------- helpers ---------------

  function renderCard(row){
    const isPremium = (row.plan||'').toLowerCase()==='premium';
    const name = row.name||'';
    const desc = row.description_short||'';
    const cat  = row.category||'';
    const logo = row.logo_url||'';
    const website = row.website_url||'';

    const { tel, display } = normPhone(row.contact_phone||'');

    const base = 'rounded-xl border bg-white p-4 shadow-soft flex flex-col gap-3';
    const premiumRing = isPremium ? ' ring-1 ring-amber-400' : '';
    const badge = isPremium ? `<span class="badge" title="Featured">★ Featured</span>` : '';

    const logoImg = logo
      ? `<img src="${escapeAttr(logo)}" alt="" class="w-12 h-12 rounded object-contain bg-white border" loading="lazy" width="48" height="48">`
      : `<div class="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-sm font-semibold">${initials(name)}</div>`;

    const visitBtn = website
      ? `<a href="${escapeAttr(website)}" target="_blank" rel="noopener" class="btn"
            data-out="1" data-company="${escapeAttr(name)}" data-category="${escapeAttr(cat)}" data-plan="${isPremium?'premium':'free'}">Visit site</a>`
      : '';

    const callBtn = (isPremium && tel)
      ? (`
        <a ${isDesktopAttr()} class="btn"
           href="tel:${escapeAttr(tel)}"
           data-callnow="1"
           data-company="${escapeAttr(name)}"
           data-category="${escapeAttr(cat)}"
           data-tel="${escapeAttr(tel)}"
           data-display="${escapeAttr(display)}">Call now</a>
      `) : '';

    return `
      <article class="${base}${premiumRing}" data-card="1"
               data-name="${escapeAttr(name.toLowerCase())}"
               data-desc="${escapeAttr(desc.toLowerCase())}"
               data-category="${escapeAttr(cat)}"
               data-plan="${isPremium?'premium':'free'}">
        <div class="flex items-center gap-3">
          ${logoImg}
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="font-semibold text-base truncate">${escapeHtml(name)}</h3>
              ${badge}
            </div>
            <p class="text-xs text-gray-500 truncate">${escapeHtml(cat)}</p>
          </div>
        </div>
        <p class="text-sm text-gray-700 line-clamp-3">${escapeHtml(desc)}</p>
        <div class="mt-auto flex gap-2">
          ${visitBtn}
          ${callBtn}
        </div>
      </article>
    `;
  }

  function groupCompanies(rows){
    // split premium/free, sort A–Z by name, group by category A–Z
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
  function slugify(s){ return idSlug(s).replace(/-tx$/,'-tx'); }
  function initials(s){ const m=(s||'').match(/\b[A-Za-z]/g)||[]; return (m[0]||'').toUpperCase()+(m[1]||'').toUpperCase(); }
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
  function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }

  function normPhone(raw){
    const digits = String(raw||'').replace(/\D/g,'');
    let d = digits;
    if(d.length===11 && d[0]==='1') d = d.slice(1);
    if(d.length!==10) return { tel:null, display: raw||'' };
    const tel = '+1'+d;
    const display = `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
    return { tel, display };
  }

  function isDesktopAttr(){ return 'data-desktop="1"'; }

  function gtmHead(ID, host){
    if(!ID) return '';
    return `
<script>window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'directory_boot',site_host:${JSON.stringify(host)}});</script>
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0], j=d.createElement(s), dl=l!='dataLayer'?'&l='+l:'';
j.async=true; j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl; f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer',${JSON.stringify(ID)});</script>`;
  }
  function gtmBody(ID){
    if(!ID) return '';
    return `<!-- GTM (noscript) --><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${escapeAttr(ID)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;
  }
};

function html(status, body){ return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } }); }
