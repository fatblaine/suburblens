// Leading '/' = extension root, so this works regardless of where the SW lives.
// (Relative 'src/config.js' would resolve against the SW's own dir → src/src/config.js.)
importScripts('/src/config.js')

const API_BASE = CONFIG.API_BASE
const STATE_NAME = {
  nsw: 'New South Wales', vic: 'Victoria', qld: 'Queensland',
  wa: 'Western Australia', sa: 'South Australia', tas: 'Tasmania',
  act: 'Australian Capital Territory', nt: 'Northern Territory',
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'SUBURBLENS_LOOKUP') return
  lookup(msg.name, msg.state)
    .then(sendResponse)
    .catch(err => sendResponse({ error: String(err) }))
  return true   
})

// Fetch JSON, but treat a non-2xx (e.g. 404) as "no data here" → null, so a
// missing dimension never sinks the whole lookup. Only tenure is required.
async function fetchJsonOrNull(url) {
  try {
    const r = await fetch(url)
    return r.ok ? await r.json() : null
  } catch {
    return null
  }
}

async function lookup(name, state) {
  const r1 = await fetch(`${API_BASE}/api/suburbs/search?q=${encodeURIComponent(name)}`)
  if (!r1.ok) throw new Error(`search ${r1.status}`)
  const results = await r1.json()
  const match = pickMatch(results, name, state)
  if (!match) return { notFound: true }

  const base = `${API_BASE}/api/suburbs/${match.salCode}`

  // tenure is required; crime (Melbourne-only → 404 elsewhere) and education
  // are best-effort. Fire all three in parallel.
  const [r2, crime, education] = await Promise.all([
    fetch(`${base}/tenure`),
    fetchJsonOrNull(`${base}/crime`),
    fetchJsonOrNull(`${base}/education`),
  ])
  if (!r2.ok) throw new Error(`tenure ${r2.status}`)

  return { suburb: match, tenure: await r2.json(), crime, education }
}

// geo_sal appends a disambiguation suffix to interstate duplicates,
// e.g. 'Carlton (Vic.)', 'Glebe (NSW)'. Strip the trailing "(...)" so the
// name compares equal to the plain suburb name from the URL.
function baseName(s) {
  return s.toLowerCase().replace(/\s*\(.*\)\s*$/, '').trim()
}

function pickMatch(results, name, state) {
  if (!Array.isArray(results) || results.length === 0) return null
  const lower = name.toLowerCase()
  const wantState = STATE_NAME[state]

  const sameName = results.filter(r => baseName(r.salName) === lower)
  const pool = sameName.length ? sameName : results

  // We always know the state from the URL, so require it — never fall back to
  // a same-named suburb in a DIFFERENT state (that's what mislabelled
  // 'Carlton (Vic.)' as Carlton NSW). No state match → treat as not found.
  if (wantState) return pool.find(r => r.stateName === wantState) || null
  return pool[0]
}