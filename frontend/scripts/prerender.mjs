// Per-suburb <head> prerender + sitemap generator.
//
// WHY: SuburbLens is a SPA — every URL serves the same dist/index.html and the
// real content is drawn by JS. Social crawlers (WeChat / WhatsApp / Slack /
// Facebook) do NOT run JS, so every shared suburb link previews with the same
// generic OG card. Fix: emit one tiny HTML file per suburb whose <head> carries
// that suburb's <title> / og:title / og:description. <body> stays the empty
// <div id="root"></div> — the SPA hydrates normally for real users.
//
// Runs AFTER `vite build`, over the freshly built dist/. Zero dependencies.
// Census data updates every ~5 years, so regenerating only at build time is fine.
//
// See docs/planning/seo-and-sharing.md, Stage 1.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

// Same env var Vite bakes into the bundle, so this hits the exact API the app
// uses. In Amplify's build container it is already set. Locally, pass it:
//   VITE_API_BASE_URL=https://s5120jvyf4.execute-api.ap-southeast-2.amazonaws.com npm run prerender
const API = process.env.VITE_API_BASE_URL
const SITE = process.env.SITE_URL ?? 'https://www.suburblensapp.com'
const DIST = resolve('dist')

if (!API) {
  console.error('[prerender] VITE_API_BASE_URL is not set — cannot fetch the suburb list. Aborting.')
  process.exit(1)
}

// Escape text before it goes into an HTML attribute, or names like "O'Connor"
// and "St Mary's" would break the tag.
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// 1. Pull every suburb. /api/suburbs/heatmap already returns the full Sydney +
//    Melbourne set as a GeoJSON FeatureCollection — no new backend endpoint.
console.log(`[prerender] fetching suburb list from ${API}/api/suburbs/heatmap`)
const res = await fetch(`${API}/api/suburbs/heatmap`)
if (!res.ok) {
  console.error(`[prerender] heatmap request failed: HTTP ${res.status}. Aborting.`)
  process.exit(1)
}
const geo = await res.json()
const suburbs = geo.features
  .map((f) => f.properties)
  .filter((p) => p && p.salCode != null && p.salName)

if (suburbs.length === 0) {
  console.error('[prerender] heatmap returned zero usable suburbs. Aborting.')
  process.exit(1)
}

// 2. Use the built index.html as the template.
const template = readFileSync(resolve(DIST, 'index.html'), 'utf8')

// 3. For each suburb, swap only the head tags; everything else stays identical.
const urls = []
for (const { salCode, salName, stateName } of suburbs) {
  const where = stateName ? `${salName}, ${stateName}` : salName
  const title = `${salName} — tenure & Census data | SuburbLens`
  const desc = `${where}: ABS Census tenure, community language, country of origin and education data for this suburb.`
  const url = `${SITE}/suburb/${salCode}`

  const html = template
    .replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=").*?(")/, `$1${esc(desc)}$2`)
    .replace(/(<meta property="og:title" content=").*?(")/, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=").*?(")/, `$1${esc(desc)}$2`)
    .replace(/(<meta property="og:url" content=").*?(")/, `$1${esc(url)}$2`)
    .replace(/(<link rel="canonical" href=").*?(")/, `$1${esc(url)}$2`)

  // Flat file per suburb, e.g. dist/suburb/12345.html — NOT a subdir index.html.
  // Amplify's rewrite wildcard <*> cannot be followed by "/", so the rule that
  // serves these (/suburb/<*> -> /suburb/<*>.html) needs a file extension, not a
  // directory. The public URL stays clean (/suburb/12345); the rewrite maps it.
  const dir = resolve(DIST, 'suburb')
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, `${String(salCode)}.html`), html)
  urls.push(url)
}

// 4. Sitemap for Google Search Console. Static routes first, then every suburb.
//    This overwrites the hand-written public/sitemap.xml, so the static routes
//    have to be repeated here or they silently drop out of the deployed sitemap.
//    /login is omitted on purpose — robots.txt disallows it.
const STATIC_ROUTES = ['/', '/map', '/privacy', '/about', '/methodology', '/suburbs']
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${STATIC_ROUTES.map((p) => `  <url><loc>${SITE}${p === '/' ? '/' : p}</loc></url>`).join('\n')}
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>
`
writeFileSync(resolve(DIST, 'sitemap.xml'), sitemap)

console.log(`[prerender] wrote ${urls.length} suburb pages + sitemap.xml into dist/`)
