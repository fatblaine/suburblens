// Orchestrator (injected into the page). Ties the three pieces together:
//   1. extractSuburb()  (realestate.js) — read suburb from the URL
//   2. ask background.js to hit the API  — content scripts can't call it directly (CORS)
//   3. renderOverlay()  (overlay.js)     — draw the card, or remove it on no-match
//
// realestate.com.au is a SPA: navigating between suburbs changes the URL without a
// full page reload, so we also poll for URL changes and re-run.

function runSuburbLens() {
  const info = extractSuburb()            // from realestate.js
  if (!info) { removeOverlay(); return }  // not a suburb list page

  chrome.runtime.sendMessage(
    {
      type: 'SUBURBLENS_LOOKUP',
      name: info.name,
      state: info.state,
      postcode: info.postcode,            // bonus — background can use it to disambiguate
    },
    (resp) => {
      // lastError fires if the service worker was asleep / channel closed.
      if (chrome.runtime.lastError || !resp || resp.error || resp.notFound) {
        removeOverlay()
        return
      }
      renderOverlay(resp)                 // from overlay.js — { suburb, tenure }
    }
  )
}

runSuburbLens()

// SPA guard: URL changes but no reload → re-run when the path changes.
let lastUrl = location.href
setInterval(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    runSuburbLens()
  }
}, 1000)
