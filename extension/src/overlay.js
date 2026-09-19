// Overlay UI — renders the SuburbLens card via Shadow DOM so the host page's
// CSS can never leak in and break it. Runs in the page's isolated content-script
// scope; content.js calls renderOverlay()/removeOverlay().
//
// The card is a fixed 340px box anchored bottom-right, so vertical space is the
// binding constraint: the stats area is paged rather than scrolled. Header
// (suburb + trend badge) and footer (nav + CTA) stay put; only .stats swaps.

const SL_HOST_ID = 'suburblens-overlay-host'
const SITE_URL = 'https://www.suburblensapp.com'

const TREND = {
  strong_ownership_shift: { text: 'Shifting to owner-occupied',   color: '#3fb97f' },
  mild_ownership_shift:   { text: 'Slightly more owner-occupied', color: '#3fb97f' },
  stable:                 { text: 'Stable',                       color: '#9aa0ad' },
  mild_rental_shift:      { text: 'Slightly more rentals',        color: '#f2c14e' },
  strong_rental_shift:    { text: 'Shifting to rentals',          color: '#f2685c' },
}

// Benchmark accent colours (pill text + thumb ring) and their track gradients.
// Neutral measures (density, education, amenities) get single-hue ramps — none
// of them is good or bad. Only crime gets the green→red scale.
const EDU_COLOR = '#4f8fef'
const EDU_GRADIENT = 'linear-gradient(90deg, #1c2f52, #4f8fef)'
const DENSITY_COLOR = '#8f7cf0'
const DENSITY_GRADIENT = 'linear-gradient(90deg, #241f45, #8f7cf0)'
const AMENITY_COLOR = '#3fb97f'
const AMENITY_GRADIENT = 'linear-gradient(90deg, #16332a, #3fb97f)'
const CRIME_COLOR = '#f2685c'
const CRIME_GRADIENT = 'linear-gradient(90deg, #3fb97f, #f2c14e, #f2685c)'

// Inline 24×24 stroke icons (paths only); rendered dim to sit beside a label.
const ICON = {
  home:   '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>',
  trend:  '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/>',
  cap:    '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5"/>',
  bars:   '<line x1="6" y1="20" x2="6" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="14"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/>',
  grid:   '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  globe:  '<circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
  food:   '<path d="M5 3v6a2 2 0 0 0 4 0V3"/><line x1="7" y1="11" x2="7" y2="21"/><path d="M17 3c-1.4 1.6-2 3.6-2 6s.6 3.2 2 3.2V21"/>',
  beer:   '<path d="M6 5h9v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5Z"/><path d="M15 9h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/><line x1="9" y1="9" x2="9" y2="17"/>',
  cart:   '<circle cx="9.5" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/><path d="M2 3h3l2.5 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 7H6"/>',
}

const fmt = (v) => (v == null ? '—' : `${v}%`)
const num = (v) => (v == null ? '—' : v.toLocaleString('en-AU'))
const svgIcon = (paths) =>
  `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`

// Chrome shared by the loading + data cards (position, frame, header, title),
// so the spinner card and the real card are pixel-identical around the content.
const BASE_CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }
  .card {
    position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
    width: 340px; background: #13161d; color: #eef1f6;
    border: 1px solid rgba(255,255,255,.08); border-radius: 16px;
    padding: 16px 18px 18px; box-shadow: 0 12px 40px rgba(0,0,0,.5);
  }
  .head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
  .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #c6f24e; }
  .x {
    cursor: pointer; color: #6b7080; background: none; border: 0; font-size: 15px;
    line-height: 1; padding: 4px; border-radius: 6px; margin: -4px;
  }
  .x:hover { color: #9aa0ad; background: rgba(255,255,255,.06); }
  .suburb { font-size: 17px; font-weight: 700; color: #eef1f6; margin-bottom: 8px; line-height: 1.3; }
`

// 'st kilda' → 'St Kilda' — pretty-print the raw URL name for the loading state,
// before the API returns the canonical salName.
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase())

function removeOverlay() {
  const existing = document.getElementById(SL_HOST_ID)
  if (!existing) return
  existing.dispatchEvent(new Event('sl-teardown'))   // cancel any pending loading timer
  existing.remove()
}

// One row of the stat list: icon + label left, value right, optional dim qualifier.
function statRow(icon, label, value, qualifier) {
  return `
    <div class="stat-row">
      <span class="label">${svgIcon(icon)}${label}</span>
      <span class="value">${value}${qualifier ? ` <span class="dim">${qualifier}</span>` : ''}</span>
    </div>`
}

// A compact key/value list under a small caption — used where three full stat
// rows would eat the whole page (e.g. top languages).
function miniList(title, rows) {
  return `
    <div class="mini">
      <div class="mini-title">${title}</div>
      ${rows.map(([k, v]) => `
        <div class="mini-row"><span class="mini-k">${k}</span><span class="mini-v">${v}</span></div>`
      ).join('')}
    </div>`
}

// A benchmark row: icon + label, a "More than X%" pill, a gradient track with a
// ring thumb at the percentile, and a fewer/cohort/more scale. `color`/`gradient`
// drive the palette (blue for education, green→red for crime).
function benchRow({ label, color, gradient, pct, scaleMid }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)))
  // A percentile of 1.0 would read "More than 100%", which can't be true of
  // anything. The top-ranked suburb gets named as such; the thumb still sits at
  // the true position, only the pill wording changes.
  const pill = p >= 100 ? 'Highest in the city' : `More than ${p}%`
  return `
    <div class="bench-row">
      <div class="bench-head">
        <span class="label bench-label">${svgIcon(ICON.bars)}${label}</span>
        <span class="bench-pill" style="background:color-mix(in srgb, ${color} 18%, transparent); color:${color};">${pill}</span>
      </div>
      <div class="bench-track" style="background:${gradient};">
        <span class="bench-thumb" style="left:${p}%; border-color:${color};"></span>
      </div>
      <div class="bench-scale">
        <span>fewer</span><span class="scale-mid">${scaleMid}</span><span>more</span>
      </div>
    </div>`
}

// ── Pages ─────────────────────────────────────────────────────────────────────
// Grouped by the question a house-hunter asks next, not by which endpoint the
// data came from. Each page carries at most ONE benchmark bar: a bench row is
// ~70px against ~38px for a stat row, so one-per-page is what keeps the pages
// close in height. Order is fixed — page 1 is all most people will ever see —
// and any page that renders empty drops out of the deck; see buildPages().

function housingPage({ tenure, density }) {
  const rent = tenure.tenure?.rent ?? {}
  const bm = density?.benchmark
  return [
    statRow(ICON.home, 'Renting share', `${fmt(rent.y2016)} → ${fmt(rent.y2021)}`, '2016→2021'),
    statRow(ICON.trend, 'Residency Shift Index', tenure.residencyShiftIndex ?? '—', 'SuburbLens custom'),
    density?.personsPerSqkm != null
      ? statRow(ICON.grid, 'Population density', num(Math.round(density.personsPerSqkm)), 'per km²')
      : '',
    bm && bm.cohortCount > 1
      ? benchRow({
          label: `Density vs ${density.gccsaName}`,
          color: DENSITY_COLOR, gradient: DENSITY_GRADIENT,
          pct: bm.percentileRank * 100,
          scaleMid: `${num(bm.cohortCount)} suburbs`,
        })
      : '',
  ].join('')
}

function areaPage({ amenities }) {
  const c = amenities?.counts
  const bm = amenities?.benchmark
  // 383 in-scope suburbs are parks/water/industrial with no POIs at all —
  // three zeroes say nothing, so drop the page instead (empty → filtered out).
  if (!c || !c.total) return ''
  return [
    statRow(ICON.food, 'Food & drink', num(c.food)),
    statRow(ICON.beer, 'Bars & pubs', num(c.nightlife)),
    statRow(ICON.cart, 'Groceries', num(c.grocery)),
    bm && bm.cohortCount > 1
      ? benchRow({
          label: `Amenities vs ${amenities.gccsaName}`,
          color: AMENITY_COLOR, gradient: AMENITY_GRADIENT,
          pct: bm.percentileRank * 100,
          scaleMid: `${num(bm.cohortCount)} suburbs · per km²`,
        })
      : '',
  ].join('')
}

function peoplePage({ language, birth, education }) {
  // The country list is a fixed set of named countries with no "other"/"not
  // stated" bucket, so it does NOT sum to 100 — 100 minus Australia would
  // overstate "born overseas". Show the Australia figure the data actually has.
  const aus = (birth?.y2021?.countries ?? []).find(c => c.country === 'Australia')
  // 'Other' is the aggregate bucket for every language outside the named list —
  // in a three-slot list it would burn a third of the space saying nothing.
  const langs = (language?.y2021?.languages ?? [])
    .filter(l => l.language !== 'English only' && l.language !== 'Other'
                 && (l.pct ?? 0) >= 0.3)
    .slice(0, 3)
  const uniPct = education?.y2021?.universityPct
  const bm = education?.benchmark

  return [
    aus?.pct != null ? statRow(ICON.globe, 'Australia-born', fmt(aus.pct), '2021') : '',
    langs.length ? miniList('Top languages at home', langs.map(l => [l.language, fmt(l.pct)])) : '',
    // With a benchmark, the raw university share rides in the scale caption
    // rather than taking its own stat row — two numbers, one row of height.
    bm && bm.cohortCount > 1
      ? benchRow({
          label: 'University-qualified',
          color: EDU_COLOR, gradient: EDU_GRADIENT,
          pct: bm.percentileRank * 100,
          scaleMid: `${fmt(uniPct)} here · ${num(bm.cohortCount)} suburbs`,
        })
      : uniPct != null
        ? statRow(ICON.cap, 'University-qualified', fmt(uniPct), '2021')
        : '',
  ].join('')
}

function safetyPage({ crime }) {
  const periods = crime?.periods ?? []
  const last = periods[periods.length - 1]
  const prev = periods[periods.length - 2]
  const bm = crime?.benchmark

  // Direction year-on-year, since a raw incident count means little on its own.
  let changeRow = ''
  if (last?.total != null && prev?.total > 0) {
    const delta = ((last.total - prev.total) / prev.total) * 100
    changeRow = statRow(ICON.trend, 'Change vs last year',
                        `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`,
                        `from ${num(prev.total)}`)
  }

  return [
    last ? statRow(ICON.shield, 'Crime incidents', num(last.total), `yr ending ${last.yearEnding}`) : '',
    changeRow,
    bm && bm.cohortCount > 1
      ? benchRow({
          label: 'Crime rank vs Greater Melbourne',
          color: CRIME_COLOR, gradient: CRIME_GRADIENT,
          pct: bm.percentileRank * 100,
          scaleMid: `${num(bm.cohortCount)} suburbs · by count`,
        })
      : '',
  ].join('')
}

// Build the deck, dropping any page that renders empty. Sydney has no crime data
// at all (404) and hundreds of suburbs have no amenities, so a fixed four-page
// deck would hand those users blank pages — worse than not offering the page.
function buildPages(data) {
  return [
    { label: 'Housing', render: housingPage },
    { label: 'Area',    render: areaPage },
    { label: 'People',  render: peoplePage },
    { label: 'Safety',  render: safetyPage },
  ]
    .map(p => ({ label: p.label, html: p.render(data) }))
    .filter(p => p.html.trim() !== '')
}

// Loading state — same chrome as the data card, with a spinner + shimmer skeleton
// rows standing in for the stats. Shown the instant a suburb page is detected so
// the corner isn't blank during the API round-trip.
function renderLoading(name) {
  removeOverlay()
  const host = document.createElement('div')
  host.id = SL_HOST_ID
  const shadow = host.attachShadow({ mode: 'open' })
  shadow.innerHTML = `
    <style>
      ${BASE_CSS}
      .loading { display: flex; align-items: center; gap: 10px; margin: 4px 0 2px; }
      .spinner {
        width: 18px; height: 18px; flex: none; border-radius: 50%;
        border: 2.5px solid rgba(255,255,255,.14); border-top-color: #c6f24e;
        animation: sl-spin .7s linear infinite;
      }
      .loading-text { font-size: 13px; color: #9aa0ad; }
      @keyframes sl-spin { to { transform: rotate(360deg); } }
      .skeleton {
        margin-top: 16px; padding-top: 14px; display: flex; flex-direction: column; gap: 13px;
        border-top: 1px solid rgba(255,255,255,.07);
      }
      .sk-line {
        height: 10px; border-radius: 6px;
        background: linear-gradient(90deg, #1d212c 25%, #262b38 37%, #1d212c 63%);
        background-size: 400% 100%; animation: sl-shimmer 1.4s ease infinite;
      }
      .sk-line.short { width: 55%; }
      @keyframes sl-shimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }
      @media (prefers-reduced-motion: reduce) {
        .spinner, .sk-line { animation: none; }
      }
    </style>
    <div class="card">
      <div class="head">
        <span class="eyebrow">SuburbLens</span>
        <button class="x" title="Close">✕</button>
      </div>
      <div class="suburb">${name ? titleCase(name) : 'Loading…'}</div>
      <div class="loading">
        <span class="spinner"></span>
        <span class="loading-text">Fetching suburb data…</span>
      </div>
      <div class="skeleton">
        <div class="sk-line"></div>
        <div class="sk-line short"></div>
        <div class="sk-line"></div>
      </div>
    </div>`
  shadow.querySelector('.x').addEventListener('click', removeOverlay)

  // Cold starts can take a few seconds — after a beat, reassure the user it's
  // the server waking up, not a hang. Cleared when the card is replaced/removed.
  const textEl = shadow.querySelector('.loading-text')
  const slowTimer = setTimeout(() => {
    if (textEl.isConnected) textEl.textContent = 'Still loading — waking up the server…'
  }, 2500)
  host.addEventListener('sl-teardown', () => clearTimeout(slowTimer))

  document.body.appendChild(host)
}

function renderOverlay(data) {
  removeOverlay()
  const { suburb, tenure } = data
  const t = TREND[tenure.trendLabel] ?? TREND.stable
  const pages = buildPages(data)
  const multi = pages.length > 1

  const host = document.createElement('div')
  host.id = SL_HOST_ID
  const shadow = host.attachShadow({ mode: 'open' })   // isolate from host CSS
  shadow.innerHTML = `
    <style>
      ${BASE_CSS}
      .badge {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 12.5px; font-weight: 600; padding: 4px 10px 4px 8px;
        border-radius: 999px; background: color-mix(in srgb, ${t.color} 16%, transparent);
        color: ${t.color};
      }
      .dot { width: 6px; height: 6px; border-radius: 50%; background: ${t.color}; flex: none; }
      .stats { margin: 16px 0 4px; border-top: 1px solid rgba(255,255,255,.07); }
      .ic { width: 14px; height: 14px; flex: none; }
      .label { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #9aa0ad; }
      .stat-row {
        display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
        padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,.07);
      }
      .value { font-size: 13px; font-weight: 600; color: #eef1f6; text-align: right; white-space: nowrap; }
      .dim { font-weight: 400; font-size: 11.5px; color: #5b606d; }
      .mini { padding: 9px 0 10px; border-bottom: 1px solid rgba(255,255,255,.07); }
      .mini-title {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 10px; letter-spacing: .08em; text-transform: uppercase;
        color: #5b606d; margin-bottom: 6px;
      }
      .mini-row { display: flex; justify-content: space-between; gap: 10px; padding: 1.5px 0; }
      .mini-k { font-size: 12px; color: #9aa0ad; }
      .mini-v { font-size: 12px; font-weight: 600; color: #eef1f6; }
      .bench-row { padding: 13px 0; border-bottom: 1px solid rgba(255,255,255,.07); }
      .bench-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 12px; }
      .bench-label { padding-top: 1px; }
      .bench-pill {
        flex: none; font-size: 12px; font-weight: 700; padding: 3px 9px;
        border-radius: 999px; white-space: nowrap;
      }
      .bench-track { position: relative; height: 6px; border-radius: 999px; margin: 0 7px; }
      .bench-thumb {
        position: absolute; top: 50%; transform: translate(-50%, -50%);
        width: 14px; height: 14px; border-radius: 50%;
        background: #13161d; border: 2.5px solid #4f8fef;
        box-shadow: 0 0 0 3px #13161d, 0 2px 6px rgba(0,0,0,.5);
      }
      .bench-scale {
        display: flex; justify-content: space-between; margin-top: 8px;
        font-size: 10.5px; color: #5b606d;
      }
      .scale-mid { color: #6b7280; }
      .nav { display: flex; align-items: stretch; gap: 2px; margin-top: 8px; }
      .nav-arrow {
        flex: none; width: 20px; background: none; border: 0; cursor: pointer;
        color: #6b7280; font-size: 14px; line-height: 1; padding: 0; border-radius: 6px;
      }
      .nav-arrow:hover:not(:disabled) { color: #eef1f6; background: rgba(255,255,255,.06); }
      .nav-arrow:disabled { color: #33373f; cursor: default; }
      .nav-tabs { flex: 1; display: flex; gap: 2px; }
      .nav-tab {
        flex: 1; background: none; border: 0; cursor: pointer; padding: 5px 2px 6px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 10.5px; letter-spacing: .04em; color: #5b606d;
        border-bottom: 1.5px solid transparent; transition: color .12s ease;
      }
      .nav-tab:hover { color: #9aa0ad; }
      .nav-tab.active { color: #c6f24e; border-bottom-color: #c6f24e; }
      a.cta {
        display: flex; justify-content: center; align-items: center; gap: 6px;
        width: 100%; background: #c6f24e; color: #0d0f14; text-decoration: none;
        font-size: 13.5px; font-weight: 700; padding: 11px 14px; border-radius: 10px;
        margin-top: ${multi ? '10px' : '14px'}; transition: filter .15s ease;
      }
      a.cta:hover { filter: brightness(1.08); }
    </style>
    <div class="card">
      <div class="head">
        <span class="eyebrow">SuburbLens</span>
        <button class="x" title="Close">✕</button>
      </div>
      <div class="suburb">${suburb.salName}</div>
      <div class="badge"><span class="dot"></span>${t.text}</div>
      <div class="stats"></div>
      ${multi ? `
      <div class="nav">
        <button class="nav-arrow nav-prev" title="Previous">‹</button>
        <div class="nav-tabs">
          ${pages.map((p, i) => `<button class="nav-tab" data-i="${i}">${p.label}</button>`).join('')}
        </div>
        <button class="nav-arrow nav-next" title="Next">›</button>
      </div>` : ''}
      <a class="cta" target="_blank" rel="noopener"
         href="${SITE_URL}/suburb/${suburb.salCode}?ref=extension">View full analysis →</a>
    </div>`
  shadow.querySelector('.x').addEventListener('click', removeOverlay)

  const statsEl = shadow.querySelector('.stats')
  let page = 0

  const paint = () => {
    statsEl.innerHTML = pages[page].html
    if (!multi) return
    shadow.querySelectorAll('.nav-tab').forEach((el, i) =>
      el.classList.toggle('active', i === page))
    shadow.querySelector('.nav-prev').disabled = page === 0
    shadow.querySelector('.nav-next').disabled = page === pages.length - 1
  }

  if (multi) {
    // No wrap-around: with only three or four pages, looping back to the first
    // just loses the reader's place. Ends of the deck grey the arrow out.
    shadow.querySelector('.nav-prev').addEventListener('click', () => { page--; paint() })
    shadow.querySelector('.nav-next').addEventListener('click', () => { page++; paint() })
    shadow.querySelectorAll('.nav-tab').forEach(el =>
      el.addEventListener('click', () => { page = Number(el.dataset.i); paint() }))
  }

  document.body.appendChild(host)

  // The card is anchored bottom-right, so it grows upward: pages of different
  // heights would make it jump and slide the CTA out from under the cursor.
  // Measure each page once it's in the DOM and pin .stats to the tallest —
  // measured rather than a magic constant, so it stays right when a long suburb
  // name or benchmark label wraps to two lines.
  if (multi) {
    let tallest = 0
    for (const p of pages) {
      statsEl.innerHTML = p.html
      tallest = Math.max(tallest, statsEl.offsetHeight)
    }
    statsEl.style.minHeight = `${tallest}px`
  }
  paint()
}
