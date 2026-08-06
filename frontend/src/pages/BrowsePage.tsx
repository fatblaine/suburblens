import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import PageMeta from '../components/PageMeta'
import Footer from '../components/Footer'
import { useAllSuburbs, type SuburbListEntry } from '../api/suburbs'

// The two in-scope Greater Capital City areas, in display order.
const CITIES: { code: string; name: string }[] = [
  { code: '1GSYD', name: 'Greater Sydney' },
  { code: '2GMEL', name: 'Greater Melbourne' },
]

// Group a city's suburbs by their uppercased first letter, each bucket sorted A–Z.
function byLetter(list: SuburbListEntry[]) {
  const buckets = new Map<string, SuburbListEntry[]>()
  for (const s of list) {
    const letter = (s.salName[0] ?? '#').toUpperCase()
    const key = /[A-Z]/.test(letter) ? letter : '#'
    const bucket = buckets.get(key) ?? []
    bucket.push(s)
    buckets.set(key, bucket)
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, items]) => ({
      letter,
      items: items.sort((a, b) => a.salName.localeCompare(b.salName)),
    }))
}

export default function BrowsePage() {
  const { data, isPending, isError } = useAllSuburbs()

  const cities = useMemo(() => {
    const all = data ?? []
    return CITIES.map(city => ({
      ...city,
      groups: byLetter(all.filter(s => s.gccsaCode === city.code)),
      count: all.filter(s => s.gccsaCode === city.code).length,
    })).filter(c => c.count > 0)
  }, [data])

  return (
    <div className="min-h-screen bg-ink">
      <PageMeta
        title="All suburbs | SuburbLens"
        description="Browse every Greater Sydney and Greater Melbourne suburb covered by SuburbLens, A–Z, with a direct link to each suburb's Census profile."
      />
      <div className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
        <Link
          to="/"
          className="font-mono text-[11px] uppercase tracking-wider text-faint transition-colors hover:text-lemon"
        >
          ← SuburbLens
        </Link>

        <header className="mt-6 mb-10">
          <div className="font-mono text-[11px] uppercase tracking-wider text-lemon">Index</div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-fg">All suburbs</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            Every suburb SuburbLens covers, across Greater Sydney and Greater Melbourne. Pick one to see its
            tenure trend, community profile, education levels, and Residency Shift Index.
          </p>
        </header>

        {isPending && <p className="font-mono text-xs text-dim">Loading the suburb list…</p>}

        {isError && (
          <p className="font-mono text-xs text-rose-300/80">
            Could not load the suburb list. Please refresh, or use the search box on the home page.
          </p>
        )}

        {!isPending && !isError && (
          <div className="space-y-14">
            {cities.map(city => (
              <section key={city.code}>
                <div className="mb-5 flex items-baseline gap-3 border-b border-white/[0.07] pb-3">
                  <h2 className="font-display text-2xl font-semibold text-fg">{city.name}</h2>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-dim">
                    {city.count} suburbs
                  </span>
                </div>

                <div className="space-y-7">
                  {city.groups.map(group => (
                    <div key={group.letter} className="grid gap-2 sm:grid-cols-[2.5rem_1fr] sm:gap-4">
                      <div className="font-display text-lg font-bold text-lemon/70">{group.letter}</div>
                      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3 lg:grid-cols-4">
                        {group.items.map(s => (
                          <li key={s.salCode}>
                            <Link
                              to={`/suburb/${s.salCode}`}
                              className="text-sm text-muted transition-colors hover:text-lemon"
                            >
                              {s.salName}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <Footer className="mt-16 border-t border-white/[0.07] pt-6" />
      </div>
    </div>
  )
}
