import { Link } from 'react-router-dom'
import { CARD } from '../lib/theme'
import PageMeta from '../components/PageMeta'

const CONTACT_EMAIL = 'suburblens@outlook.com'

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

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-ink">
      <PageMeta
        title="About SuburbLens — Census-data suburb insight for Sydney & Melbourne"
        description="SuburbLens turns ABS Census data into a plain story of how a Sydney or Melbourne suburb is changing — tenure, language, origin, education and crime. Who builds it, and where the data comes from."
      />
      <div className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
        <Link
          to="/"
          className="font-mono text-[11px] uppercase tracking-wider text-faint transition-colors hover:text-lemon"
        >
          ← SuburbLens
        </Link>

        <header className="mt-6 mb-10">
          <div className="font-mono text-[11px] uppercase tracking-wider text-lemon">About</div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-fg">About SuburbLens</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            A tool for new migrants and students deciding where to live in Sydney or Melbourne — built on
            public Australian Bureau of Statistics Census data.
          </p>
        </header>

        <div className={`${CARD} mb-10 p-6`}>
          <div className="font-mono text-[11px] uppercase tracking-wider text-lemon mb-3">In short</div>
          <ul className="space-y-2 text-sm leading-relaxed text-muted">
            <li>
              SuburbLens answers one question property listing sites do not:{' '}
              <strong className="text-fg">what kind of area is this, and which way is it heading?</strong>
            </li>
            <li>
              It reads the ABS Census across <strong className="text-fg">2011, 2016 and 2021</strong> to show a
              suburb's direction of change, not just a single snapshot.
            </li>
            <li>
              It is an <strong className="text-fg">independent, non-commercial project</strong>, not affiliated
              with the ABS, realestate.com.au, or domain.com.au.
            </li>
          </ul>
        </div>

        <div className="space-y-10">
          <Section id="why" title="Why SuburbLens exists">
            <p>
              When you move to a new city — especially as a migrant or an international student — the hardest
              question is not <em>which house</em> but <em>which suburb</em>. Property platforms are built to
              show listings: price, bedrooms, photos. They are not built to tell you what a neighbourhood is
              actually like, or how it has been changing.
            </p>
            <p>
              SuburbLens exists to fill that gap. It takes the Australian Bureau of Statistics Census — a rich
              but hard-to-read public dataset — and turns it into a plain reading of a suburb's character and
              trajectory, so you can decide whether it fits the life you are trying to build here.
            </p>
          </Section>

          <Section id="idea" title="The core idea: change over time, not a snapshot">
            <p>
              Most numbers people use to judge a suburb — median rent, median income — are snapshots. They tell
              you today's state, not the direction. SuburbLens leads instead with{' '}
              <strong className="text-fg">tenure</strong>: the mix of homes owned outright, owned with a
              mortgage, and rented, tracked across three Census years.
            </p>
            <p>
              A suburb where renting climbed from 35% to 46% in five years is being absorbed by investors. One
              where mortgage ownership is growing is being moved into by young families. These trajectories lead
              to very different communities, and no mainstream tool surfaces them.
            </p>
            <p>
              To summarise that direction in a single figure, SuburbLens computes a{' '}
              <strong className="text-fg">Residency Shift Index</strong>. This is a{' '}
              <strong className="text-fg">SuburbLens Custom</strong> heuristic — a weighted sum of tenure change,
              not an official ABS statistic — meant as a quick signal of whether an area is stabilising toward
              ownership or shifting toward renting.
            </p>
          </Section>

          <Section id="explore" title="What you can explore">
            <p>Every Sydney and Melbourne suburb has a page that brings several Census dimensions together:</p>
            <div className="divide-y divide-white/[0.07] border-y border-white/[0.07] my-4">
              <Row label="Tenure trends">Owned / mortgaged / rented across 2011, 2016 and 2021, with the Residency Shift Index.</Row>
              <Row label="Languages at home">The main languages spoken in the community and how they have shifted.</Row>
              <Row label="Country of birth">Where residents were born, and the share born overseas.</Row>
              <Row label="Education">The distribution of qualification levels, including university-qualified share.</Row>
              <Row label="Recorded crime">Yearly recorded incidents by category — Greater Melbourne only for now.</Row>
              <Row label="Nearby suburbs">The closest suburbs, so you can widen your search.</Row>
              <Row label="Compare & map">Put suburbs side by side, or view the city as a map.</Row>
              <Row label="AI assistant">Ask questions about a suburb in plain language (sign-in required).</Row>
            </div>
            <p>
              There is also a <strong className="text-fg">browser extension</strong> that overlays a suburb's
              Census statistics directly on listings at realestate.com.au and domain.com.au.
            </p>
          </Section>

          <Section id="data" title="Where the data comes from">
            <p>
              All figures come from public Australian government releases. SuburbLens adds structure and
              visualisation; it does not alter the underlying counts.
            </p>
            <div className="divide-y divide-white/[0.07] border-y border-white/[0.07] my-4">
              <Row label="Census data">
                Australian Bureau of Statistics, Census of Population and Housing 2021 — Time Series Profile
                (harmonised 2011/2016/2021) and General Community Profile.
              </Row>
              <Row label="Geography">
                ABS Statistical Areas. Suburbs shown to you use the SAL layer; cross-year data is anchored to the
                SA2 layer, bridged via the ABS correspondence files.
              </Row>
              <Row label="Crime">
                Recorded criminal incidents from the relevant state agency. Currently available for Greater
                Melbourne only.
              </Row>
              <Row label="Coverage">
                Greater Sydney and Greater Melbourne. Other cities are not included yet.
              </Row>
            </div>
            <p>
              The Residency Shift Index is the only figure SuburbLens invents. Everything else is a direct
              reading of official data. See the{' '}
              <Link to="/privacy" className="text-lemon underline underline-offset-4 hover:text-lemon/80">
                privacy policy
              </Link>{' '}
              for how the website and extension handle your data.
            </p>
          </Section>

          <Section id="independent" title="An independent project">
            <p>
              SuburbLens is built and run independently. It is not affiliated with, endorsed by, or sponsored by
              the Australian Bureau of Statistics, any government agency, or any property platform. Suburb
              boundaries and names follow ABS standards; any interpretation on this site is our own.
            </p>
            <p>
              The Census describes suburbs in aggregate, not individuals. Statistics can be several years old and
              may not reflect recent change, so treat SuburbLens as one input into a decision, not the last word.
            </p>
          </Section>

          <Section id="contact" title="Contact">
            <p>Questions, corrections, or feedback are welcome:</p>
            <p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-mono text-sm text-lemon underline underline-offset-4 hover:text-lemon/80"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </Section>
        </div>

        <footer className="mt-14 border-t border-white/[0.07] pt-6">
          <p className="font-mono text-[11px] leading-relaxed text-dim">
            Data source: Australian Bureau of Statistics, Census of Population and Housing 2021. SuburbLens is an
            independent project and is not affiliated with the ABS, realestate.com.au, or domain.com.au.
          </p>
        </footer>
      </div>
    </div>
  )
}
