// Site adapter for domain.com.au — SEARCH / LIST pages only (MVP).
//
// Target URL shape (the whole page is about ONE suburb):
//   /rent/carlton-vic-3053/
//   /sale/st-kilda-vic-3182/
//   /sold/north-sydney-nsw-2060/
//
// Structure: /{buy|rent|sold|sale}/{suburb}-{state}-{postcode}/
//   - spaces inside the suburb are '-' (e.g. 'st-kilda')
//   - state and postcode are the LAST two '-'-separated segments
//   - query strings (e.g. ?excludedeposittaken=1) live outside pathname, so
//     they're ignored — we read location.pathname only
//
// Returns { name, state, postcode } on a suburb list page, or null otherwise
// (home page, individual property pages, multi-suburb ?suburb= searches, etc.).

const SL_LIST_RE =
  /^\/(?:buy|rent|sold|sale)\/(.+?)-(nsw|vic|qld|wa|sa|tas|act|nt)-(\d{4})(?:\/|$)/i

function extractSuburb() {
  const m = location.pathname.match(SL_LIST_RE)
  if (!m) return null

  // '-' → space, then collapse any accidental double spaces.
  const name = decodeURIComponent(m[1]).replace(/-/g, ' ').replace(/\s+/g, ' ').trim()
  if (!name) return null

  return {
    name,                       // 'carlton' | 'st kilda'
    state: m[2].toLowerCase(),  // 'vic'
    postcode: m[3],             // '3053' — used to disambiguate same-named suburbs
  }
}
