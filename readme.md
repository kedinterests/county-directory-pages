# County Directory Pages

A multi-tenant, serverless directory platform that powers **78 county-level mineral rights professional directories** for [Mineral Rights Forum](https://www.mineralrightsforum.com). Each county gets its own subdomain (e.g., `reeves-county-texas.mineralrightsforum.com`) and displays a searchable listing of local attorneys, landmen, engineers, appraisers, and other service providers.

---

## Overview

| What | Details |
|------|---------|
| **Hosting** | Cloudflare Pages + Cloudflare KV |
| **Rendering** | Server-side via Cloudflare Pages Functions (Node.js-compatible JS) |
| **Data source** | Per-county Google Sheets → Google Apps Script JSON API |
| **Styling** | Tailwind CSS v3 with `@tailwindcss/line-clamp` plugin |
| **Analytics** | Google Tag Manager + Google Analytics 4 |
| **SEO** | JSON-LD structured data (Schema.org), dynamic `robots.txt` & `sitemap.xml` |

---

## Repository Structure

```
.
├── functions/           # Cloudflare Pages Functions (server-side handlers)
│   ├── index.js         # Main directory page renderer
│   ├── counties.js      # Index page listing all county directories
│   ├── refresh.js       # POST endpoint – syncs data from Google Sheets → KV
│   ├── health.js        # GET /health.json – liveness / data freshness check
│   ├── data.json.js     # GET /data.json – raw company data export
│   ├── robots.txt.js    # Dynamic robots.txt per domain
│   ├── sitemap.xml.js   # Dynamic sitemap.xml per domain
│   └── _lib.js          # Shared utilities (host detection, KV helpers, hashing)
├── public/
│   ├── styles.css       # Compiled Tailwind CSS (committed, do not edit manually)
│   └── robots.txt       # Static fallback robots.txt
├── src/
│   ├── app.css          # Tailwind directives + custom CSS (edit this, not styles.css)
│   └── brand.css        # Brand-specific style overrides
├── sites.json           # Registry of all 78 county directories (domains, titles, SEO, sheet URLs)
├── tailwind.config.js   # Tailwind CSS configuration
├── DOCUMENTATION.md     # Full setup & workflow guide
├── GTM_GA4_SETUP.md     # Analytics configuration guide
└── migrate-to-astro.md  # Future migration roadmap (Astro + Tailwind v4)
```

---

## How It Works

### Data Flow

```
Google Sheets (per county)
        │
        ▼  (Apps Script JSON API)
POST /refresh  ──▶  Cloudflare Pages Function (refresh.js)
                           │  validates, dedupes by etag, filters hidden companies
                           ▼
                  Cloudflare KV Storage  (site:{host}:data / :etag / :updated_at)
                           │
                           ▼  (GET /)
                  index.js renders full HTML page from KV snapshot
```

1. **Data is sourced** from a per-county Google Sheet via a Google Apps Script web app that returns JSON.
2. **Refreshes** are triggered by a POST to `/refresh` (requires `X-Refresh-Key` header). The function fetches from Apps Script, validates the response, deduplicates using an etag, filters out hidden companies, and writes to Cloudflare KV.
3. **Pages are rendered** server-side on every request by reading from KV and producing a full HTML response with embedded CSS, search/filter JavaScript, GTM snippet, and JSON-LD structured data.

### Listing Tiers

| Tier | Display |
|------|---------|
| `premium` | Logo, contact buttons (email / phone), "FEATURED" ribbon |
| `free` | Name initial in circle, description, website-only button |
| `hidden` | Filtered out before storage and rendering |

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Full HTML directory page |
| `/refresh` | POST | Sync data from Google Sheets (requires `X-Refresh-Key` header) |
| `/health.json` | GET | Health check – status, data count, staleness, last error |
| `/data.json` | GET | Raw companies array with metadata |
| `/robots.txt` | GET | Dynamic robots.txt with sitemap URL |
| `/sitemap.xml` | GET | Dynamic sitemap.xml |

---

## Local Development

### Prerequisites

- Node.js ≥ 18
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)

### Build CSS

```bash
npm install
npm run build       # compiles src/app.css → public/styles.css (minified)
```

### Run locally

```bash
wrangler pages dev  # starts a local Cloudflare Pages dev server
```

Set `REFRESH_KEY` in a `.dev.vars` file (or via Wrangler config) to test the `/refresh` endpoint locally.

---

## Adding a New County Directory

1. Create a Google Sheet for the county and publish an Apps Script web app that returns the sheet as JSON.
2. Add an entry to `sites.json` with the subdomain, Apps Script URL, page title, serving line, SEO metadata, and Cloudflare forum return URL.
3. Configure the subdomain in Cloudflare Pages.
4. POST to `/refresh` to populate the KV cache.

See [DOCUMENTATION.md](DOCUMENTATION.md) for the full step-by-step guide.

---

## Environment Variables

These are set in the Cloudflare Pages project settings:

| Variable | Purpose |
|----------|---------|
| `DIRECTORIES_KV` | Binding to the Cloudflare KV namespace that stores per-domain data snapshots |
| `REFRESH_KEY` | Secret key required in the `X-Refresh-Key` header to authorize a `/refresh` call |

---

## Analytics

GTM and GA4 are integrated directly in the rendered HTML. Each page view fires a `directory_page_view` event, and each premium advertiser fires a `directory_advertiser_present` event with custom dimensions. See [GTM_GA4_SETUP.md](GTM_GA4_SETUP.md) for details.

---

## Roadmap

A migration to [Astro](https://astro.build) + Tailwind CSS v4 + Starwind UI components is planned. The goal is to consolidate the 78 separate Google Sheets into a single master sheet and improve developer experience while preserving all current features and SEO. See [migrate-to-astro.md](migrate-to-astro.md) for the plan.
