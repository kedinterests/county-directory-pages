# County Directory Pages

A multi-tenant mineral rights professional directory platform hosted on **Cloudflare Pages**. It serves county-specific directories (78+ active sites) that help mineral owners find attorneys, landmen, engineers, appraisers, and other oil & gas professionals in their area.

## Overview

Each county directory is served at its own subdomain (e.g., `reeves-county-texas.mineralrightsforum.com`) and displays a curated list of local professionals grouped by category. Data is sourced from Google Sheets via Apps Script and cached in Cloudflare KV for fast edge delivery.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Hosting / SSR | Cloudflare Pages Functions |
| Styling | Tailwind CSS v3 + `@tailwindcss/line-clamp` |
| Data store | Cloudflare KV |
| Data source | Google Sheets + Apps Script (one per county) |
| Analytics | Google Tag Manager + GA4 |
| Build | npm (`npm run build:css`) |
| CI/CD | GitHub Actions → Cloudflare Pages |

## Repository Structure

```
county-directory-pages/
├── functions/          # Cloudflare Pages Functions (SSR & API endpoints)
│   ├── index.js        # Main directory page renderer
│   ├── counties.js     # Index page listing all 78+ county directories
│   ├── refresh.js      # POST endpoint: fetch from Apps Script → write to KV
│   ├── health.js       # GET /health – data freshness & error status
│   ├── data.json.js    # GET /data.json – raw JSON data snapshot
│   ├── sitemap.xml.js  # Dynamic XML sitemap
│   ├── robots.txt.js   # Dynamic robots.txt
│   └── _lib.js         # Shared utilities (host lookup, KV keys, hashing)
├── src/
│   ├── app.css         # Tailwind directives & custom component classes
│   └── brand.css       # Brand-specific style overrides
├── public/
│   └── styles.css      # Compiled & minified Tailwind output (served to browsers)
├── sites.json          # Configuration registry for all 78+ county directories
├── tailwind.config.js  # Tailwind configuration
├── package.json        # Build scripts & dev dependencies
├── DOCUMENTATION.md    # Full setup & operations guide
├── GTM_GA4_SETUP.md    # Analytics configuration guide
└── migrate-to-astro.md # Planned migration to Astro v5
```

## Data Flow

```
Google Sheets (78 sheets)
  └─► Apps Script JSON API (one URL per sheet)
        └─► POST /refresh  (secured with X-Refresh-Key header)
              └─► Cloudflare KV  (etag-based deduplication)
                    └─► GET /  (SSR – full HTML rendered at the edge)
                          └─► Browser
```

## Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Server-rendered directory page |
| `/refresh` | POST | Fetch latest data from Apps Script and store in KV |
| `/health` | GET | Data count, staleness, and last error |
| `/data.json` | GET | Raw JSON snapshot of cached company data |
| `/sitemap.xml` | GET | Dynamic XML sitemap |
| `/robots.txt` | GET | Dynamically generated robots.txt |

The `/refresh` endpoint requires the `X-Refresh-Key` request header.

## Getting Started

### Install dependencies

```bash
npm install
```

### Compile CSS

```bash
npm run build:css
```

This compiles `src/app.css` (Tailwind directives) into the minified `public/styles.css` file that is served to browsers.

### Deploy

Push to the `main` branch. GitHub Actions triggers a Cloudflare Pages deployment automatically.

### Refresh directory data

```bash
curl -X POST https://<county-subdomain>/refresh \
  -H "X-Refresh-Key: YOUR_REFRESH_KEY"
```

## Site Configuration (`sites.json`)

Each county directory is defined as a JSON object in `sites.json`:

```json
{
  "reeves-county-texas.mineralrightsforum.com": {
    "sheet": { "url": "https://script.google.com/..." },
    "serving_line": "Reeves County, Texas",
    "page_title": "Reeves County Mineral Rights Directory",
    "seo": {
      "title": "...",
      "description": "..."
    },
    "category_order": "alpha",
    "theme": "default"
  }
}
```

## Features

- **Premium & free listing tiers** with distinct card styling
- **Category navigation** with sticky header, filter pills, and mobile drawer
- **Text search & category filter** for quick professional lookup
- **SEO-optimized** with JSON-LD structured data (`WebPage`, `ItemList`, `LocalBusiness`)
- **Inquiry modal** with embedded Zoho form
- **GTM / GA4 analytics** with custom `directory_page_view` events
- **Etag-based caching** in KV to avoid redundant writes
- **Health monitoring** endpoint with staleness detection (flags data older than 2 hours)

## Documentation

- [Full Setup & Operations Guide](DOCUMENTATION.md)
- [Analytics Configuration](GTM_GA4_SETUP.md)
- [Migration Plan (Astro v5)](migrate-to-astro.md)
