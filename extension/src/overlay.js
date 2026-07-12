// Overlay UI — renders the SuburbLens card via Shadow DOM so the host page's
// CSS can never leak in and break it. Runs in the page's isolated content-script
// scope; content.js calls renderOverlay()/removeOverlay().

const SL_HOST_ID = 'suburblens-overlay-host'
const SITE_URL = 'https://main.d1yrvhzuhaioqy.amplifyapp.com'

const TREND = {
  strong_ownership_shift: { text: 'Shifting to owner-occupied',   color: '#3fb97f' },
  mild_ownership_shift:   { text: 'Slightly more owner-occupied', color: '#3fb97f' },
  stable:                 { text: 'Stable',                       color: '#9aa0ad' },
  mild_rental_shift:      { text: 'Slightly more rentals',        color: '#f2c14e' },
  strong_rental_shift:    { text: 'Shifting to rentals',          color: '#f2685c' },
}

// Benchmark accent colours (pill text + thumb ring) and their track gradients.
const EDU_COLOR = '#4f8fef'
const EDU_GRADIENT = 'linear-gradient(90deg, #1c2f52, #4f8fef)'
const CRIME_COLOR = '#f2685c'
const CRIME_GRADIENT = 'linear-gradient(90deg, #3fb97f, #f2c14e, #f2685c)'

// Inline 24×24 stroke icons (paths only); rendered dim to sit beside a label.
const ICON = {
  home:   '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>',
  trend:  '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/>',
  cap:    '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1 3 3 6 3s6-2 6-3v-5"/>',
  bars:   '<line x1="6" y1="20" x2="6" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="14"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/>',
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

// A benchmark row: icon + label, a "More than X%" pill, a gradient track with a
// ring thumb at the percentile, and a fewer/cohort/more scale. `color`/`gradient`
// drive the palette (blue for education, green→red for crime).
function benchRow({ label, color, gradient, pct, scaleMid }) {
  const p = Math.max(0, Math.min(100, Math.round(pct)))
  return `
    <div class="bench-row">
      <div class="bench-head">
        <span class="label bench-label">${svgIcon(ICON.bars)}${label}</span>
        <span class="bench-pill" style="background:color-mix(in srgb, ${color} 18%, transparent); color:${color};">More than ${p}%</span>
      </div>
      <div class="bench-track" style="background:${gradient};">
        <span class="bench-thumb" style="left:${p}%; border-color:${color};"></span>
      </div>
      <div class="bench-scale">
        <span>fewer</span><span class="scale-mid">${scaleMid}</span><span>more</span>
      </div>
    </div>`
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

function renderOverlay({ suburb, tenure, crime, education }) {
  removeOverlay()
  const t = TREND[tenure.trendLabel] ?? TREND.stable
  const rent = tenure.tenure?.rent ?? {}

  // Education: latest-year (2021) university qualification share + city rank.
  const uniPct = education?.y2021?.universityPct
  const eduRow = uniPct != null
    ? statRow(ICON.cap, 'University-qualified', fmt(uniPct), '2021')
    : ''

  // Education benchmark: blue gradient (not green→red) — qualification isn't
  // good/bad. Metric is already per-person, so no "by count" caveat needed.
  const eduBm = education?.benchmark
  const eduBenchRow = eduBm && eduBm.cohortCount > 1
    ? benchRow({
        label: `University rank vs ${eduBm.cohortName}`,
        color: EDU_COLOR, gradient: EDU_GRADIENT,
        pct: eduBm.percentileRank * 100,
        scaleMid: `${num(eduBm.cohortCount)} suburbs`,
      })
    : ''

  // Crime: latest year's total incidents (Melbourne only → may be absent).
  const period = crime?.periods?.[crime.periods.length - 1]
  const crimeRow = period
    ? statRow(ICON.shield, 'Crime incidents', num(period.total), `yr ending ${period.yearEnding}`)
    : ''

  // Crime benchmark: green→red gradient. Ranked by raw count, not per person,
  // so the scale carries a "· by count" caveat.
  const bm = crime?.benchmark
  const crimeBenchRow = bm && bm.cohortCount > 1
    ? benchRow({
        label: 'Crime rank vs Greater Melbourne',
        color: CRIME_COLOR, gradient: CRIME_GRADIENT,
        pct: bm.percentileRank * 100,
        scaleMid: `${num(bm.cohortCount)} suburbs · by count`,
      })
    : ''

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
      a.cta {
        display: flex; justify-content: center; align-items: center; gap: 6px;
        width: 100%; background: #c6f24e; color: #0d0f14; text-decoration: none;
        font-size: 13.5px; font-weight: 700; padding: 11px 14px; border-radius: 10px;
        margin-top: 14px; transition: filter .15s ease;
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
      <div class="stats">
        ${statRow(ICON.home, 'Renting share', `${fmt(rent.y2016)} → ${fmt(rent.y2021)}`, '2016→2021')}
        ${statRow(ICON.trend, 'Residency Shift Index', tenure.residencyShiftIndex ?? '—', 'SuburbLens custom')}
        ${eduRow}
        ${eduBenchRow}
        ${crimeRow}
        ${crimeBenchRow}
      </div>
      <a class="cta" target="_blank" rel="noopener"
         href="${SITE_URL}/suburb/${suburb.salCode}?ref=extension">View full analysis →</a>
    </div>`
  shadow.querySelector('.x').addEventListener('click', removeOverlay)
  document.body.appendChild(host)
}
