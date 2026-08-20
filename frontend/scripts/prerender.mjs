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

// 4b. Seed the STATIC routes too. The SPA served the same empty dist/index.html
//     for /, /about, /methodology and /suburbs, so a non-JS crawler (and the
//     AdSense reviewer viewing "page source") saw only <div id="root"></div> on
//     the very pages most likely to be opened first — read as Low value content
//     even though About/Methodology carry substantial original prose. We emit a
//     readable, static text version of each into its own dist file; createRoot()
//     wipes it on mount, so real users still get the full SPA and there is no
//     duplicate content. Amplify rewrites /about -> /about.html etc.; the root /
//     serves index.html natively, so the homepage seed just overwrites it.
//     (adsense-plan §8.5 — "Low value content" remediation, static pages.)
function staticShell(bodyHtml) {
  return (
    `<section data-prerendered style="max-width:48rem;margin:0 auto;padding:2rem 1.25rem;` +
    `font-family:system-ui,-apple-system,sans-serif;color:#9aa0ad;line-height:1.65;background:#0d0f14">` +
    bodyHtml +
    `</section>`
  )
}

const H1 = 'color:#eef1f6;font-size:1.6rem;margin:0 0 1rem;line-height:1.25'
const H2 = 'color:#eef1f6;font-size:1.15rem;margin:1.75rem 0 .5rem'
const A = 'color:#c6f24e'

// Every in-scope suburb as an internal link — gives crawlers a path to all 1494
// suburb pages from one indexable page, and is real, useful navigation content.
const suburbIndexLinks = suburbs
  .slice()
  .sort((a, b) => String(a.salName).localeCompare(String(b.salName)))
  .map(
    (s) =>
      `<a href="/suburb/${esc(String(s.salCode))}" style="${A};margin:0 .6rem .25rem 0;` +
      `display:inline-block;white-space:nowrap">${escHtml(String(s.salName))}</a>`,
  )
  .join('')

const HOME_BODY =
  `<h1 style="${H1}">SuburbLens — see what a Sydney or Melbourne suburb is actually like</h1>` +
  `<p>SuburbLens turns Australian Bureau of Statistics Census data into a plain reading of how a Greater ` +
  `Sydney or Greater Melbourne suburb is changing. Rather than a single snapshot, it tracks the mix of homes ` +
  `owned outright, owned with a mortgage, and rented across the 2011, 2016 and 2021 Censuses, so you can see ` +
  `the direction a neighbourhood is heading — not just where it stands today.</p>` +
  `<p>Every suburb has a profile bringing several Census dimensions together: tenure trends and the SuburbLens ` +
  `Residency Shift Index, the main languages spoken at home, residents' countries of birth, education levels, ` +
  `and — for Greater Melbourne — recorded crime. You can compare suburbs side by side or view the whole city ` +
  `as a map.</p>` +
  `<p>It is built for new migrants and international students deciding where to live, and it is an independent, ` +
  `non-commercial project — not affiliated with the ABS, realestate.com.au, or domain.com.au.</p>` +
  `<p>Start by <a style="${A}" href="/suburbs">browsing every suburb A–Z</a>, read ` +
  `<a style="${A}" href="/about">about the project</a>, or see the ` +
  `<a style="${A}" href="/methodology">methodology</a> behind the numbers.</p>`

const ABOUT_BODY =
  `<h1 style="${H1}">About SuburbLens</h1>` +
  `<p>SuburbLens is a tool for new migrants and students deciding where to live in Sydney or Melbourne, built ` +
  `on public Australian Bureau of Statistics Census data. It answers one question property listing sites do ` +
  `not: what kind of area is this, and which way is it heading?</p>` +
  `<h2 style="${H2}">Why it exists</h2>` +
  `<p>When you move to a new city — especially as a migrant or an international student — the hardest question ` +
  `is not which house but which suburb. Property platforms show listings: price, bedrooms, photos. They are ` +
  `not built to tell you what a neighbourhood is actually like, or how it has been changing. SuburbLens takes ` +
  `the Census — a rich but hard-to-read public dataset — and turns it into a plain reading of a suburb's ` +
  `character and trajectory.</p>` +
  `<h2 style="${H2}">Change over time, not a snapshot</h2>` +
  `<p>Most numbers people use to judge a suburb — median rent, median income — are snapshots. SuburbLens leads ` +
  `instead with tenure: the mix of homes owned outright, owned with a mortgage, and rented, tracked across ` +
  `three Census years. A suburb where renting climbed from 35% to 46% in five years is being absorbed by ` +
  `investors; one where mortgage ownership is growing is being moved into by young families. To summarise that ` +
  `direction in one figure, SuburbLens computes a Residency Shift Index — a SuburbLens Custom heuristic, not an ` +
  `official ABS statistic.</p>` +
  `<h2 style="${H2}">Where the data comes from</h2>` +
  `<p>All figures come from public Australian government releases: the ABS Census of Population and Housing 2021 ` +
  `Time Series Profile (harmonised 2011/2016/2021) and General Community Profile, ABS Statistical Areas for ` +
  `geography, and recorded criminal incidents from the relevant state agency (Greater Melbourne only for now). ` +
  `SuburbLens adds structure and visualisation; it does not alter the underlying counts. The Residency Shift ` +
  `Index is the only figure it invents.</p>` +
  `<h2 style="${H2}">An independent project</h2>` +
  `<p>SuburbLens is built and run independently. It is not affiliated with, endorsed by, or sponsored by the ` +
  `Australian Bureau of Statistics, any government agency, or any property platform. Read the ` +
  `<a style="${A}" href="/methodology">methodology</a> for how each figure is computed, or ` +
  `<a style="${A}" href="/suburbs">browse every suburb</a>.</p>`

const METHOD_BODY =
  `<h1 style="${H1}">Methodology</h1>` +
  `<p>How SuburbLens computes the Residency Shift Index, how suburbs map to ABS statistical areas, and the ` +
  `years, sources and limitations behind every dataset.</p>` +
  `<h2 style="${H2}">Residency Shift Index (SuburbLens Custom)</h2>` +
  `<p>Prices and rents in the Census age badly — a "median mortgage" can reflect a loan taken out a decade ago. ` +
  `Tenure — whether homes are owned outright, owned with a mortgage, or rented — is a structural signal that ` +
  `does not go stale the same way. The Residency Shift Index compresses the direction of that change into one ` +
  `number: a weighted sum of the percentage-point change in each tenure share between the 2016 and 2021 ` +
  `Censuses — minus 1.0 times the change in rented share (rising rental = investor-driven, the main signal), ` +
  `plus 0.8 times the change in owned-with-mortgage share (young families entering), plus 0.3 times the change ` +
  `in owned-outright share (stabilising). Scores map to five bands from strong ownership shift to strong rental ` +
  `shift. It is a heuristic for putting one number on a trend — useful for a glance, not a scientific measure — ` +
  `and is always labelled "SuburbLens Custom" in the interface.</p>` +
  `<h2 style="${H2}">Suburbs vs statistical areas (SAL to SA2)</h2>` +
  `<p>You search by Suburb and Locality (SAL) — the name people recognise — but the ABS publishes most Census ` +
  `tables against Statistical Area Level 2 (SA2), a slightly coarser unit. SuburbLens matches each suburb to ` +
  `its primary SA2 and shows that SA2's data, so a figure can fold in a neighbouring area. Every suburb page ` +
  `notes which SA2 its cross-year data comes from.</p>` +
  `<h2 style="${H2}">Sources and limitations</h2>` +
  `<p>Tenure, language at home, country of birth and education come from the ABS Census Time Series Profile ` +
  `(tables T01, T10, T08, T29) for 2011, 2016 and 2021. Crime is from the Victoria Crime Statistics Agency, ` +
  `recorded incidents, Greater Melbourne only, and is ranked by volume rather than a per-capita rate. Coverage ` +
  `is Greater Sydney and Greater Melbourne only. The Census is a five-yearly, self-reported snapshot and the ` +
  `ABS randomly adjusts very small counts to protect privacy, so tiny numbers are approximate.</p>`

const SUBURBS_BODY =
  `<h1 style="${H1}">All suburbs</h1>` +
  `<p>Every suburb SuburbLens covers, across Greater Sydney and Greater Melbourne. Pick one to see its tenure ` +
  `trend, community profile, education levels, and Residency Shift Index.</p>` +
  `<div style="margin-top:1rem">${suburbIndexLinks}</div>`

const staticPages = [
  { file: 'index.html', path: '/', title: 'SuburbLens — see what a Sydney or Melbourne suburb is actually like', desc: 'Compare Sydney and Melbourne suburbs using ABS Census data — tenure trends, community languages, countries of birth, and education levels.', body: HOME_BODY },
  { file: 'about.html', path: '/about', title: 'About SuburbLens — Census-data suburb insight for Sydney & Melbourne', desc: "SuburbLens turns ABS Census data into a plain story of how a Sydney or Melbourne suburb is changing — who builds it, and where the data comes from.", body: ABOUT_BODY },
  { file: 'methodology.html', path: '/methodology', title: 'Methodology | SuburbLens', desc: 'How SuburbLens computes the Residency Shift Index, how suburbs map to ABS statistical areas, and the years, sources and limitations behind every dataset.', body: METHOD_BODY },
  { file: 'suburbs.html', path: '/suburbs', title: 'All suburbs | SuburbLens', desc: 'Browse every Greater Sydney and Greater Melbourne suburb covered by SuburbLens, A–Z, with a direct link to each suburb Census profile.', body: SUBURBS_BODY },
]

staticPages.forEach(({ file, path, title, desc, body }) => {
  const url = `${SITE}${path}`
  const html = template
    .replace(/<title>.*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=").*?(")/, `$1${esc(desc)}$2`)
    .replace(/(<meta property="og:title" content=").*?(")/, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=").*?(")/, `$1${esc(desc)}$2`)
    .replace(/(<meta property="og:url" content=").*?(")/, `$1${esc(url)}$2`)
    .replace(/(<link rel="canonical" href=").*?(")/, `$1${esc(url)}$2`)
    .replace(/<div id="root">\s*<\/div>/, `<div id="root">${staticShell(body)}</div>`)
  writeFileSync(resolve(DIST, file), html)
})
console.log(`[prerender] wrote ${staticPages.length} static pages (home/about/methodology/suburbs)`)

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
