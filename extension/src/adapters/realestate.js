// Site adapter for realestate.com.au — SEARCH / LIST pages only (MVP).
//
// Target URL shape (the whole page is about ONE suburb):
//   /buy/in-carlton,+vic+3053/list-1
//   /rent/in-st+kilda,+vic+3182/list-1
//   /sold/in-north+sydney,+nsw+2060/list-2
//
// Structure: /{buy|rent|sold}/in-{suburb},+{state}+{postcode}/list-{page}
//   - spaces inside the suburb are '+' (e.g. 'st+kilda')
//   - state and postcode are separated from the suburb by ',+'
//   - location.pathname does NOT decode '+' to space, so we do it ourselves
//
// Returns { name, state, postcode } on a suburb list page, or null otherwise
// (home page, individual property pages, multi-suburb searches, etc.).

const SL_LIST_RE =
  /^\/(?:buy|rent|sold)\/in-(.+?),\+(nsw|vic|qld|wa|sa|tas|act|nt)\+(\d{4})/i

function extractSuburb() {
  const m = location.pathname.match(SL_LIST_RE)
  if (!m) return null

  // '+' → space, then collapse any accidental double spaces.
  const name = decodeURIComponent(m[1]).replace(/\+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!name) return null

  return {
    name,                       // 'carlton' | 'st kilda'
    state: m[2].toLowerCase(),  // 'vic'
    postcode: m[3],             // '3053' — used to disambiguate same-named suburbs
  }
}
