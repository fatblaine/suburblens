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

const fmt = (v) => (v == null ? '—' : `${v}%`)
const num = (v) => (v == null ? '—' : v.toLocaleString('en-AU'))

function removeOverlay() {
  document.getElementById(SL_HOST_ID)?.remove()
}

// One row of the stat list: label left, value right, optional dim qualifier.
function statRow(label, value, qualifier) {
  return `
    <div class="stat-row">
      <span class="label">${label}</span>
      <span class="value">${value}${qualifier ? ` <span class="dim">${qualifier}</span>` : ''}</span>
    </div>`
}

function renderOverlay({ suburb, tenure, crime, education }) {
  removeOverlay()
  const t = TREND[tenure.trendLabel] ?? TREND.stable
  const rent = tenure.tenure?.rent ?? {}

  // Crime: latest year's total incidents (Melbourne only → may be absent).
  const period = crime?.periods?.[crime.periods.length - 1]
  const crimeRow = period
    ? statRow('Crime incidents', num(period.total), `yr ending ${period.yearEnding}`)
    : ''

  // Crime benchmark: where this suburb sits among all Greater Melbourne suburbs.
  // Gradient track (green = fewer incidents → red = more); thumb marks the
  // percentile. Ranked by raw count, not per person — kept as a rough position.
  const bm = crime?.benchmark
  const benchmarkBlock = bm && bm.cohortCount > 1
    ? (() => {
        const pct = Math.max(0, Math.min(100, Math.round(bm.percentileRank * 100)))
        return `
      <div class="bench">
        <div class="bench-head">
          <span class="bench-label">Crime rank vs Greater Melbourne</span>
          <span class="bench-pct">More than ${pct}%</span>
        </div>
        <div class="bench-track"><span class="bench-thumb" style="left:${pct}%"></span></div>
        <div class="bench-scale">
          <span>fewer</span>
          <span>${num(bm.cohortCount)} suburbs · by count</span>
          <span>more</span>
        </div>
      </div>`
      })()
    : ''

  // Education: latest-year (2021) university qualification share.
  const uniPct = education?.y2021?.universityPct
  const eduRow = uniPct != null
    ? statRow('University-qualified', fmt(uniPct), '2021')
    : ''

  // Education benchmark: university-qualified rank among same-city suburbs.
  // Neutral blue gradient (not green→red) — higher qualification isn't good/bad.
  // Metric is already per-person, so no "by count" caveat needed.
  const eduBm = education?.benchmark
  const eduBenchBlock = eduBm && eduBm.cohortCount > 1
    ? (() => {
        const pct = Math.max(0, Math.min(100, Math.round(eduBm.percentileRank * 100)))
        return `
      <div class="bench">
        <div class="bench-head">
          <span class="bench-label">University rank vs ${eduBm.cohortName}</span>
          <span class="bench-pct">More than ${pct}%</span>
        </div>
        <div class="bench-track edu"><span class="bench-thumb" style="left:${pct}%"></span></div>
        <div class="bench-scale">
          <span>fewer</span>
          <span>${num(eduBm.cohortCount)} suburbs</span>
          <span>more</span>
        </div>
      </div>`
      })()
    : ''

  const host = document.createElement('div')
  host.id = SL_HOST_ID
  const shadow = host.attachShadow({ mode: 'open' })   // isolate from host CSS
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; }
      .card {
        position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
        width: 320px; background: #13161d; color: #eef1f6;
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
      .badge {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 12.5px; font-weight: 600; padding: 4px 10px 4px 8px;
        border-radius: 999px; background: color-mix(in srgb, ${t.color} 16%, transparent);
        color: ${t.color};
      }
      .dot { width: 6px; height: 6px; border-radius: 50%; background: ${t.color}; flex: none; }
      .stats { margin: 16px 0 16px; border-top: 1px solid rgba(255,255,255,.07); }
      .stat-row {
        display: flex; justify-content: space-between; align-items: baseline; gap: 12px;
        padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,.07);
      }
      .label { font-size: 12px; color: #9aa0ad; }
      .value { font-size: 13px; font-weight: 600; color: #eef1f6; text-align: right; white-space: nowrap; }
      .dim { font-weight: 400; font-size: 11.5px; color: #5b606d; }
      .bench { margin: 0 0 16px; }
      .bench-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
      .bench-label { font-size: 12px; color: #9aa0ad; }
      .bench-pct { font-size: 12.5px; font-weight: 700; color: #eef1f6; }
      .bench-track {
        position: relative; height: 8px; border-radius: 999px;
        background: linear-gradient(90deg, #3fb97f 0%, #f2c14e 55%, #f2685c 100%);
      }
      .bench-track.edu { background: linear-gradient(90deg, #1d212c 0%, #5aa9ff 100%); }
      .bench-thumb {
        position: absolute; top: 50%; transform: translate(-50%, -50%);
        width: 14px; height: 14px; border-radius: 50%;
        background: #eef1f6; border: 2px solid #13161d;
        box-shadow: 0 0 0 1px rgba(255,255,255,.3);
      }
      .bench-scale {
        display: flex; justify-content: space-between; margin-top: 6px;
        font-size: 10.5px; color: #5b606d;
      }
      a.cta {
        display: flex; justify-content: center; align-items: center; gap: 6px;
        width: 100%; background: #c6f24e; color: #0d0f14; text-decoration: none;
        font-size: 13.5px; font-weight: 700; padding: 11px 14px; border-radius: 10px;
        transition: filter .15s ease;
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
        ${statRow('Renting share', `${fmt(rent.y2016)} → ${fmt(rent.y2021)}`, '2016→2021')}
        ${statRow('Residency Shift Index', tenure.residencyShiftIndex ?? '—', 'SuburbLens custom')}
        ${eduRow}
      </div>
      ${eduBenchBlock}
      ${crimeRow ? `<div class="stats">${crimeRow}</div>` : ''}
      ${benchmarkBlock}
      <a class="cta" target="_blank" rel="noopener"
         href="${SITE_URL}/suburb/${suburb.salCode}?ref=extension">View full analysis →</a>
    </div>`
  shadow.querySelector('.x').addEventListener('click', removeOverlay)
  document.body.appendChild(host)
}
