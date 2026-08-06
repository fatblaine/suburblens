// Per-suburb prerender (head + body) + sitemap generator.
//
// WHY: SuburbLens is a SPA — every URL serves the same dist/index.html and the
// real content is drawn by JS. Two audiences never run that JS:
//   1. Social crawlers (WeChat / WhatsApp / Slack / Facebook) — need per-suburb
//      <head> tags or every shared link previews with the same generic OG card.
//   2. The AdSense reviewer viewing "page source", and any non-JS crawler — see
//      only an empty <div id="root">, which reads as Low value content.
//
// Fix: emit one HTML file per suburb whose <head> carries that suburb's
// title/OG tags AND whose <div id="root"> is seeded with a real, data-driven
// narrative paragraph. main.tsx mounts with createRoot(), which REPLACES the
// contents of #root on load — so real users get the full SPA and the seeded
// prose is only ever seen before hydration / by crawlers. No duplicate content.
//
// The narrative text is produced by src/lib/narrative.ts — the SAME pure
// function the <SuburbNarrative> component uses — transpiled on the fly here so
// there is a single source of truth (adsense-plan §8.5.1 / §8.5.6 step 7). We
// transpile via the already-installed `typescript` dep rather than relying on
// the build container's Node version to strip types.
//
// Runs AFTER `vite build`, over the freshly built dist/. Census data updates
// every ~5 years, so regenerating only at build time is fine.
//
// See docs/planning/seo-and-sharing.md, Stage 1; docs/planning/adsense-plan.md §8.5.

import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

// Same env var Vite bakes into the bundle, so this hits the exact API the app
// uses. In Amplify's build container it is already set. Locally, pass it:
//   VITE_API_BASE_URL=https://s5120jvyf4.execute-api.ap-southeast-2.amazonaws.com npm run prerender
const API = process.env.VITE_API_BASE_URL
const SITE = process.env.SITE_URL ?? 'https://www.suburblensapp.com'
const DIST = resolve('dist')
const NARRATIVE_CONCURRENCY = 10

if (!API) {
  console.error('[prerender] VITE_API_BASE_URL is not set — cannot fetch the suburb list. Aborting.')
  process.exit(1)
}

// Escape text before it goes into an HTML *attribute* (title, og:*, canonical).
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// Escape text that becomes HTML *body* content (the narrative paragraphs).
const escHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

// Simple promise pool: run `fn` over `items` at most `limit` at a time, keeping
// the results aligned to the input order. Avoids a dependency (p-limit) and
// stops 1494 fetches from hammering the API all at once.
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++
      results[idx] = await fn(items[idx], idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// --- Load the shared narrative function -------------------------------------
// Transpile src/lib/narrative.ts to a temp .mjs and import it. The file only
// imports TYPES from ../types/api, which transpileModule elides, so the output
// is self-contained (no runtime imports to resolve).
const narrativeTsPath = resolve('src', 'lib', 'narrative.ts')
const transpiled = ts.transpileModule(readFileSync(narrativeTsPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const tmpNarrativePath = resolve(tmpdir(), `suburblens-narrative.${process.pid}.mjs`)
writeFileSync(tmpNarrativePath, transpiled)
let buildNarrative
try {
  ;({ buildNarrative } = await import(pathToFileURL(tmpNarrativePath).href))
} finally {
  try {
    unlinkSync(tmpNarrativePath)
  } catch {
    // best-effort cleanup; a stray temp file is harmless
  }
}

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

// 2. For each suburb, fetch its tenure — the single richest call, enough to
//    write a substantial opening paragraph. Concurrency-limited; a failed
//    suburb degrades to a head-only page rather than aborting the whole build.
console.log(`[prerender] fetching tenure for ${suburbs.length} suburbs (concurrency ${NARRATIVE_CONCURRENCY})`)
const tenures = await mapLimit(suburbs, NARRATIVE_CONCURRENCY, async ({ salCode }) => {
  try {
    const r = await fetch(`${API}/api/suburbs/${salCode}/tenure`)
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
})

// 3. Use the built index.html as the template.
const template = readFileSync(resolve(DIST, 'index.html'), 'utf8')

// Build the static narrative block seeded into #root. Kept minimal — React wipes
// it on mount, so its only jobs are to be readable in raw source and to not look
// broken during the pre-hydration instant.
function narrativeBlock(tenure) {
  if (!tenure) return ''
  const { paragraphs, source } = buildNarrative({ tenure })
  if (!paragraphs.length) return ''
  const body = paragraphs.map((p) => `<p style="margin:0 0 .75rem">${escHtml(p)}</p>`).join('')
  return (
    `<section data-prerendered-narrative style="max-width:48rem;margin:0 auto;padding:2rem 1.25rem;` +
    `font-family:system-ui,-apple-system,sans-serif;color:#9aa0ad;line-height:1.65;background:#0d0f14">` +
    `<h1 style="color:#eef1f6;font-size:1.5rem;margin:0 0 1rem">${escHtml(tenure.salName)}</h1>` +
    body +
    `<p style="font-size:.75rem;color:#5b606d;margin-top:1rem">${escHtml(source)}</p>` +
    `</section>`
  )
}

// 4. For each suburb, swap the head tags and seed the body.
const urls = []
let seeded = 0
suburbs.forEach(({ salCode, salName, stateName }, i) => {
  const where = stateName ? `${salName}, ${stateName}` : salName
  const title = `${salName} — tenure & Census data | SuburbLens`
  const desc = `${where}: ABS Census tenure, community language, country of origin and education data for this suburb.`
  const url = `${SITE}/suburb/${salCode}`

  let html = template
    .replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=").*?(")/, `$1${esc(desc)}$2`)
    .replace(/(<meta property="og:title" content=").*?(")/, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=").*?(")/, `$1${esc(desc)}$2`)
    .replace(/(<meta property="og:url" content=").*?(")/, `$1${esc(url)}$2`)
    .replace(/(<link rel="canonical" href=").*?(")/, `$1${esc(url)}$2`)

  const block = narrativeBlock(tenures[i])
  if (block) {
    const before = html
    html = html.replace(/<div id="root">\s*<\/div>/, `<div id="root">${block}</div>`)
    if (html !== before) seeded++
  }

  // Flat file per suburb, e.g. dist/suburb/12345.html — NOT a subdir index.html.
  // Amplify's rewrite wildcard <*> cannot be followed by "/", so the rule that
  // serves these (/suburb/<*> -> /suburb/<*>.html) needs a file extension, not a
  // directory. The public URL stays clean (/suburb/12345); the rewrite maps it.
  const dir = resolve(DIST, 'suburb')
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, `${String(salCode)}.html`), html)
  urls.push(url)
})

// 5. Sitemap for Google Search Console. Static routes first, then every suburb.
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

console.log(
  `[prerender] wrote ${urls.length} suburb pages (${seeded} with a seeded narrative) + sitemap.xml into dist/`,
)
