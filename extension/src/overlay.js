// Overlay UI — renders the SuburbLens card via Shadow DOM so the host page's
// CSS can never leak in and break it. Runs in the page's isolated content-script
// scope; content.js calls renderOverlay()/removeOverlay().

const SL_HOST_ID = 'suburblens-overlay-host'
const SITE_URL = 'https://main.d1yrvhzuhaioqy.amplifyapp.com'

const TREND = {
  strong_ownership_shift: { icon: '🏡', text: 'Shifting to owner-occupied',    color: '#3fb97f' },
  mild_ownership_shift:   { icon: '📈', text: 'Slightly more owner-occupied',  color: '#3fb97f' },
  stable:                 { icon: '⚖️', text: 'Stable',                        color: '#9aa0ad' },
  mild_rental_shift:      { icon: '📉', text: 'Slightly more rentals',         color: '#f2c14e' },
  strong_rental_shift:    { icon: '⚠️', text: 'Shifting to rentals',           color: '#f2685c' },
}

const fmt = (v) => (v == null ? '—' : `${v}%`)
const num = (v) => (v == null ? '—' : v.toLocaleString('en-AU'))

function removeOverlay() {
  document.getElementById(SL_HOST_ID)?.remove()
}

function renderOverlay({ suburb, tenure, crime, education }) {
  removeOverlay()
  const t = TREND[tenure.trendLabel] ?? TREND.stable
  const rent = tenure.tenure?.rent ?? {}

  // Crime: latest year's total incidents (Melbourne only → may be absent).
  const period = crime?.periods?.[crime.periods.length - 1]
  const crimeRow = period
    ? `<p class="sub">🚨 Crime ${num(period.total)} incidents
         <span style="color:#5b606d">· yr ending ${period.yearEnding}</span></p>`
    : ''

  // Education: latest-year (2021) university qualification share.
  const uniPct = education?.y2021?.universityPct
  const eduRow = uniPct != null
    ? `<p class="sub">🎓 University-qualified ${fmt(uniPct)} <span style="color:#5b606d">· 2021</span></p>`
    : ''

  const host = document.createElement('div')
  host.id = SL_HOST_ID
  const shadow = host.attachShadow({ mode: 'open' })   // isolate from host CSS
  shadow.innerHTML = `
    <style>
      .card { position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
              width: 300px; background: #13161d; color: #eef1f6;
              border: 1px solid rgba(255,255,255,.08); border-radius: 14px;
              padding: 14px 16px; box-shadow: 0 12px 40px rgba(0,0,0,.5);
              font-family: system-ui, sans-serif; }
      .row { display:flex; justify-content:space-between; align-items:center; }
      .eyebrow { font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:#c6f24e; }
      .x { cursor:pointer; color:#7d8290; background:none; border:0; font-size:16px; }
      h4 { margin:8px 0 4px; font-size:15px; }
      .trend { color:${t.color}; font-weight:600; }
      .sub { font-size:13px; color:#9aa0ad; margin:2px 0; }
      a.cta { display:inline-block; margin-top:10px; background:#c6f24e; color:#0d0f14;
              text-decoration:none; font-size:13px; font-weight:600;
              padding:7px 12px; border-radius:8px; }
    </style>
    <div class="card">
      <div class="row"><span class="eyebrow">SuburbLens</span>
        <button class="x" title="Close">✕</button></div>
      <h4>${t.icon} ${suburb.salName} <span class="trend">${t.text}</span></h4>
      <p class="sub">Renting ${fmt(rent.y2016)} → ${fmt(rent.y2021)} (2016→2021)</p>
      <p class="sub">Residency Shift Index ${tenure.residencyShiftIndex ?? '—'}
         <span style="color:#5b606d">· SuburbLens custom</span></p>
      ${crimeRow}
      ${eduRow}
      <a class="cta" target="_blank" rel="noopener"
         href="${SITE_URL}/suburb/${suburb.salCode}?ref=extension">View full analysis →</a>
    </div>`
  shadow.querySelector('.x').addEventListener('click', removeOverlay)
  document.body.appendChild(host)
}
