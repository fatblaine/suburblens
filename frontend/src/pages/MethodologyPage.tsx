import { Link } from 'react-router-dom'
import { CARD } from '../lib/theme'
import PageMeta from '../components/PageMeta'

const LAST_UPDATED = '6 August 2026'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-xl font-semibold text-fg mb-3">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <div className="font-mono text-[11px] uppercase tracking-wider text-faint">{label}</div>
      <div className="text-sm text-muted">{children}</div>
    </div>
  )
}

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-ink">
      <PageMeta
        title="Methodology | SuburbLens"
        description="How SuburbLens computes the Residency Shift Index, how suburbs map to ABS statistical areas, and the years, sources, and limitations behind every dataset."
      />
      <div className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
        <Link
          to="/"
          className="font-mono text-[11px] uppercase tracking-wider text-faint transition-colors hover:text-lemon"
        >
          ← SuburbLens
        </Link>

        <header className="mt-6 mb-10">
          <div className="font-mono text-[11px] uppercase tracking-wider text-lemon">Reference</div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-fg">Methodology</h1>
          <p className="mt-3 font-mono text-xs text-dim">Last updated {LAST_UPDATED}</p>
        </header>

        <div className={`${CARD} mb-10 p-6`}>
          <div className="font-mono text-[11px] uppercase tracking-wider text-lemon mb-3">In short</div>
          <ul className="space-y-2 text-sm leading-relaxed text-muted">
            <li>
              The <strong className="text-fg">Residency Shift Index</strong> is a SuburbLens heuristic — a
              single weighted number summarising how a suburb's housing tenure changed between the 2016 and
              2021 Censuses. It is not an official ABS statistic.
            </li>
            <li>
              You search by <strong className="text-fg">suburb (SAL)</strong>, but the underlying figures are
              measured at the ABS <strong className="text-fg">SA2</strong> level, which can be slightly larger
              than the suburb itself.
            </li>
            <li>
              Coverage is limited to <strong className="text-fg">Greater Sydney and Greater Melbourne</strong>.
              Crime data exists for <strong className="text-fg">Melbourne only</strong>.
            </li>
          </ul>
        </div>

        <div className="space-y-10">
          <Section id="shift-index" title="Residency Shift Index (SuburbLens Custom)">
            <p>
              Prices and rents in the Census age badly — a "median mortgage" can reflect a loan taken out a
              decade ago. <strong className="text-fg">Tenure</strong> — whether homes are owned outright, owned
              with a mortgage, or rented — is a structural signal that does not go stale the same way. The
              Residency Shift Index compresses the direction of that change into one number.
            </p>
            <p>It is a weighted sum of the percentage-point change in each tenure share:</p>
            <pre className="overflow-x-auto rounded-xl border border-white/[0.07] bg-surface-2 p-4 font-mono text-xs leading-relaxed text-fg">
{`Residency Shift Index =
    −1.0 × Δ(rented %)                # rising rental = investor-driven (main signal)
    + 0.8 × Δ(owned-with-mortgage %)  # rising = young families entering
    + 0.3 × Δ(owned-outright %)       # rising = stabilising

Δ = percentage-point change between the 2016 and 2021 Censuses`}
            </pre>
            <p>The score maps to five bands:</p>
            <div className="divide-y divide-white/[0.07] border-y border-white/[0.07] my-4">
              <Row label="≥ +3">
                <strong className="text-fg">Strong ownership shift</strong> — owner-occupier share is rising
                significantly; community stability increasing.
              </Row>
              <Row label="+1 to +3">
                <strong className="text-fg">Mild ownership shift</strong> — owner-occupier share gradually
                increasing.
              </Row>
              <Row label="−1 to +1">
                <strong className="text-fg">Stable</strong> — tenure composition has not changed much.
              </Row>
              <Row label="−3 to −1">
                <strong className="text-fg">Mild rental shift</strong> — rental share gradually increasing.
              </Row>
              <Row label="≤ −3">
                <strong className="text-fg">Strong rental shift</strong> — rental share rising significantly;
                the area is being absorbed by investors.
              </Row>
            </div>
            <p>
              This is a heuristic for putting one number on a trend — useful for a glance, not a scientific
              measure. It is always labelled <em>"SuburbLens Custom"</em> in the interface for exactly this
              reason.
            </p>
          </Section>

          <Section id="geography" title="Suburbs vs statistical areas (SAL ↔ SA2)">
            <p>
              You search by <strong className="text-fg">Suburb and Locality (SAL)</strong> — the name people
              actually recognise. But the ABS publishes most Census tables against{' '}
              <strong className="text-fg">Statistical Area Level 2 (SA2)</strong>, a slightly coarser unit
              designed to hold a stable population over time.
            </p>
            <p>
              SuburbLens bridges the two: each suburb is matched to its <strong className="text-fg">primary
              SA2</strong> (the one it sits most within) and the data for that SA2 is shown. Two consequences
              worth knowing:
            </p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li>An SA2 can span more than one suburb, so figures may fold in a neighbouring area.</li>
              <li>
                We use the <strong className="text-fg">primary</strong> SA2 only — a suburb straddling two
                SA2s is represented by the dominant one, not a blend.
              </li>
            </ul>
            <p>
              Every suburb page notes which SA2 its cross-year data comes from, so you can judge how closely
              the statistical area matches the suburb you had in mind.
            </p>
          </Section>

          <Section id="sources" title="Data sources, years, and grain">
            <p>All figures come from public sources. What each one is, and when it was measured:</p>
            <div className="divide-y divide-white/[0.07] border-y border-white/[0.07] my-4">
              <Row label="Tenure">
                ABS Census <strong className="text-fg">Time Series Profile</strong> (TSP, table T01).{' '}
                <strong className="text-fg">2011, 2016, 2021.</strong> Counted at SA2, by dwelling.
              </Row>
              <Row label="Language at home">
                ABS Census TSP (T10). <strong className="text-fg">2011, 2016, 2021.</strong> SA2, by person.
              </Row>
              <Row label="Country of birth">
                ABS Census TSP (T08). <strong className="text-fg">2011, 2016, 2021.</strong> SA2, by person.
              </Row>
              <Row label="Education">
                ABS Census TSP (T29). <strong className="text-fg">2011, 2016, 2021.</strong> SA2, by person.
                "University-qualified" means a bachelor degree or higher.
              </Row>
              <Row label="Crime">
                Victoria <strong className="text-fg">Crime Statistics Agency</strong> (CSA). Recorded criminal
                incidents, year ending March. <strong className="text-fg">Greater Melbourne only</strong>,
                counted at suburb (SAL) level.
              </Row>
              <Row label="Local amenities">
                <strong className="text-fg">OpenStreetMap</strong> points of interest (cafés, restaurants,
                bars, pubs, supermarkets) counted inside the suburb (SAL) boundary.{' '}
                <strong className="text-fg">Snapshot, refreshed periodically</strong> — not a Census figure.
                &copy; OpenStreetMap contributors, available under the{' '}
                <a
                  href="https://www.openstreetmap.org/copyright"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-white/20 underline-offset-2 transition-colors hover:text-lemon"
                >
                  Open Database Licence (ODbL)
                </a>
                .
              </Row>
            </div>
          </Section>

          <Section id="limitations" title="Known limitations and biases">
            <ul className="ml-4 list-disc space-y-2">
              <li>
                <strong className="text-fg">The Shift Index is a heuristic, not official data.</strong> The
                weights (−1.0 / +0.8 / +0.3) are a deliberate editorial choice, not an ABS or academic
                standard.
              </li>
              <li>
                <strong className="text-fg">Statistical area, not the exact suburb.</strong> SA2 boundaries do
                not line up perfectly with suburb boundaries, so a figure can reflect a slightly wider area.
              </li>
              <li>
                <strong className="text-fg">Coverage is Sydney and Melbourne only.</strong> Other cities,
                regional areas, and the rest of Australia are out of scope.
              </li>
              <li>
                <strong className="text-fg">Crime is Melbourne-only and ranked by volume.</strong> There is no
                Sydney crime data. Rankings use total recorded incidents, not a per-capita rate — larger and
                inner-city suburbs sit higher simply because more people pass through them, not necessarily
                because they are less safe.
              </li>
              <li>
                <strong className="text-fg">Amenity counts are community-mapped, not a register.</strong>{' '}
                OpenStreetMap coverage is dense in the inner city and thinner in outer suburbs, so a low count
                can mean "less mapped" rather than "nothing there". Suburbs are ranked by amenities per km²
                so size does not distort the comparison, but treat the raw totals as indicative.
              </li>
              <li>
                <strong className="text-fg">The Census is a five-yearly, self-reported snapshot.</strong> To
                protect privacy the ABS randomly adjusts very small counts, so tiny numbers are approximate and
                category totals may not add up exactly.
              </li>
            </ul>
          </Section>
        </div>

        <footer className="mt-14 border-t border-white/[0.07] pt-6">
          <p className="font-mono text-[11px] leading-relaxed text-dim">
            Data: Australian Bureau of Statistics, Census of Population and Housing (2011, 2016, 2021); crime:
            Victoria Crime Statistics Agency; local amenities: &copy; OpenStreetMap contributors (ODbL).
            SuburbLens is an independent project and is not affiliated with the ABS.
          </p>
        </footer>
      </div>
    </div>
  )
}
