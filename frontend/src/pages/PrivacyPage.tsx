import { Link } from 'react-router-dom'
import { CARD } from '../lib/theme'
import PageMeta from '../components/PageMeta'

// Chrome Web Store requires a reachable contact for the listing's privacy tab.
const CONTACT_EMAIL = 'suburblens@outlook.com'
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

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-ink">
      <PageMeta
        title="Privacy Policy | SuburbLens"
        description="What SuburbLens collects, what it does not, and who processes it — for the browser extension, the website, and the AI assistant."
      />
      <div className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
        <Link
          to="/"
          className="font-mono text-[11px] uppercase tracking-wider text-faint transition-colors hover:text-lemon"
        >
          ← SuburbLens
        </Link>

        <header className="mt-6 mb-10">
          <div className="font-mono text-[11px] uppercase tracking-wider text-lemon">Legal</div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-fg">Privacy Policy</h1>
          <p className="mt-3 font-mono text-xs text-dim">Last updated {LAST_UPDATED}</p>
        </header>

        <div className={`${CARD} mb-10 p-6`}>
          <div className="font-mono text-[11px] uppercase tracking-wider text-lemon mb-3">In short</div>
          <ul className="space-y-2 text-sm leading-relaxed text-muted">
            <li>
              The <strong className="text-fg">browser extension</strong> reads only the suburb name from the
              page address on two property sites. It has no account, sets no cookies, and does not track you.
            </li>
            <li>
              The <strong className="text-fg">website</strong> works without an account. Signing in is needed
              only for the AI assistant.
            </li>
            <li>
              If you use the <strong className="text-fg">AI assistant</strong>, your messages are sent to an
              external AI provider and stored so the conversation can continue. This is the only part of
              SuburbLens that sends your own words off our servers.
            </li>
            <li>
              The website uses <strong className="text-fg">Microsoft Clarity</strong> and{' '}
              <strong className="text-fg">Google Analytics</strong> to see how pages are used — anonymous
              session replays, click heatmaps, and visit counts.
            </li>
            <li>
              The website carries ads served by <strong className="text-fg">Google AdSense</strong>, which
              use cookies. Ads appear on the <strong className="text-fg">website only</strong> — the browser
              extension contains no advertising and injects nothing into the pages it runs on. We never sell
              your personal information.
            </li>
          </ul>
        </div>

        <div className="space-y-10">
          <Section id="extension" title="The browser extension">
            <p>
              The SuburbLens extension runs only on <code className="font-mono text-xs text-fg">realestate.com.au</code>{' '}
              and <code className="font-mono text-xs text-fg">domain.com.au</code>. On those sites it reads the
              page address to work out which suburb you are looking at, then asks our API for that suburb's
              Census statistics and draws them over the page.
            </p>

            <div className="divide-y divide-white/[0.07] border-y border-white/[0.07] my-4">
              <Row label="What is read">The page address, only on the two sites listed above.</Row>
              <Row label="What is sent">
                The suburb name and state (for example <em>Chatswood, New South Wales</em>). Nothing else — not
                the full address, not your browsing history, not any identifier.
              </Row>
              <Row label="Where it goes">Our API on Amazon Web Services in Sydney, which queries our database in Sydney.</Row>
              <Row label="What is kept">
                Nothing. The lookup is answered and not written to any log we keep.
              </Row>
              <Row label="Accounts">None. The extension does not sign you in and does not know who you are.</Row>
            </div>

            <p>
              The extension does not read page content, form fields, prices, saved properties, or any other
              part of the sites it runs on. It has no access to any other website you visit.
            </p>
          </Section>

          <Section id="website" title="The website">
            <p>
              Browsing suburb data, comparisons, and the map requires no account, and we do not tie what you
              look at to your name or email.
            </p>
            <p>
              If you create an account, we store your <strong className="text-fg">email address</strong> and a
              securely hashed password through our authentication provider. You may also continue as a guest,
              which creates an anonymous session with no email attached.
            </p>

            <h3 className="font-display text-base font-semibold text-fg pt-2">Analytics</h3>
            <p>
              To understand how the site is used and where people get stuck, we run two analytics tools:
            </p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li>
                <strong className="text-fg">Microsoft Clarity</strong> (from Microsoft) — records anonymous{' '}
                <strong className="text-fg">session replays</strong> (how the page was scrolled and clicked)
                and aggregate <strong className="text-fg">heatmaps</strong>. It masks text you type into fields
                by default.
              </li>
              <li>
                <strong className="text-fg">Google Analytics</strong> (from Google) — counts{' '}
                <strong className="text-fg">page visits</strong> and a few in-app actions (such as running a
                comparison) so we can see which features are used.
              </li>
            </ul>
            <p>Neither tool is used to identify individual people.</p>
            <div className="divide-y divide-white/[0.07] border-y border-white/[0.07] my-4">
              <Row label="What is collected">
                Pages visited, clicks, scrolling and mouse movement, device and browser type, and approximate
                (non-precise) location derived from your IP address.
              </Row>
              <Row label="What is not">Your name, email, or the text you type into fields.</Row>
              <Row label="Where it goes">
                Microsoft and Google, both of which process this data outside Australia.
              </Row>
              <Row label="How to opt out">
                Use your browser's <em>Do Not Track</em> setting, or a content/ad blocker — both tools are
                blocked by common ad blockers, and Clarity honours Do Not Track.
              </Row>
            </div>

            <h3 className="font-display text-base font-semibold text-fg pt-2">Advertising</h3>
            <p>
              The website is funded by ads served through{' '}
              <strong className="text-fg">Google AdSense</strong>. Ads appear on the website only. The{' '}
              <strong className="text-fg">browser extension shows no ads</strong>, injects no ads into the
              pages it runs on, and sends nothing to any advertising network.
            </p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li>
                Google, as a third-party vendor, uses <strong className="text-fg">cookies</strong> to serve
                ads on this site.
              </li>
              <li>
                Google's use of advertising cookies lets it and its partners serve ads to you based on your
                visit to this site and other sites on the internet.
              </li>
              <li>
                Other third-party vendors and ad networks may also serve ads here and may set their own
                cookies.
              </li>
            </ul>
            <div className="divide-y divide-white/[0.07] border-y border-white/[0.07] my-4">
              <Row label="What is collected">
                Cookies and device identifiers, the pages you view on this site, and approximate
                (non-precise) location derived from your IP address.
              </Row>
              <Row label="What is not">
                Your name, email, account details, or anything you type into the AI assistant. We do not
                pass your account information to any advertiser.
              </Row>
              <Row label="How to opt out">
                Turn off personalised advertising at{' '}
                <a
                  href="https://myadcenter.google.com/"
                  className="text-lemon underline underline-offset-4 hover:text-lemon/80"
                >
                  Google My Ad Center
                </a>
                , or opt out of third-party vendor cookies at{' '}
                <a
                  href="https://www.aboutads.info/choices/"
                  className="text-lemon underline underline-offset-4 hover:text-lemon/80"
                >
                  aboutads.info/choices
                </a>
                . An ad blocker also works.
              </Row>
              <Row label="Consent">
                If you are in the EEA, the UK or Switzerland, you will be asked to consent before
                personalised ads are shown. You can change that choice at any time from the link in the
                consent notice.
              </Row>
            </div>
          </Section>

          <Section id="assistant" title="The AI assistant">
            <p className="text-fg">
              This is the part of SuburbLens you should read most carefully, because it is the only part that
              sends your own words to a third party.
            </p>
            <p>
              When you send a message to the assistant, that message is forwarded to{' '}
              <strong className="text-fg">OpenRouter</strong>, which routes it to the{' '}
              <strong className="text-fg">DeepSeek</strong> model running on external inference providers.
              These providers are located outside Australia, and your message is processed on their systems
              under their own terms and retention practices, which we do not control.
            </p>
            <p>We also store, in our database in Sydney:</p>
            <ul className="ml-4 list-disc space-y-1.5">
              <li>
                <strong className="text-fg">Your conversation history</strong> — so a conversation can pick up
                where it left off.
              </li>
              <li>
                <strong className="text-fg">A daily message count</strong> against your account, used only to
                enforce a fair-use limit.
              </li>
              <li>
                <strong className="text-fg">Blocked-input records.</strong> If our safety filter blocks a
                message, we keep a short excerpt of it together with a one-way hash of your user id — not the
                id itself — so we can tell whether the filter is working.
              </li>
            </ul>
            <p>
              If you would rather nothing you write leaves our servers, do not use the assistant. Every other
              feature of SuburbLens works without it.
            </p>
          </Section>

          <Section id="third-parties" title="Who processes your data">
            <p>We run SuburbLens on services operated by other companies. They process data on our behalf:</p>
            <div className="divide-y divide-white/[0.07] border-y border-white/[0.07] my-4">
              <Row label="Amazon Web Services">Runs our API. Sydney, Australia.</Row>
              <Row label="Microsoft Clarity">Website analytics and session replay. Outside Australia.</Row>
              <Row label="Google Analytics">Website visit and event analytics. Outside Australia.</Row>
              <Row label="Google AdSense">Serves the ads on the website. Outside Australia.</Row>
              <Row label="Supabase">Database and accounts. Sydney, Australia.</Row>
              <Row label="Upstash">Caches map data. Contains no personal data.</Row>
              <Row label="Fly.io">Runs the AI assistant service.</Row>
              <Row label="OpenRouter / DeepSeek">
                Processes AI assistant messages. Outside Australia. Used only if you use the assistant.
              </Row>
            </div>
            <p>
              We do not sell your personal information. Ads on the website are served by Google and may use
              cookies as described above, but we do not hand your account details, your email, or your
              assistant conversations to any advertiser, and we do not give your data to anyone for
              unrelated purposes.
            </p>
          </Section>

          <Section id="retention" title="Keeping and deleting data">
            <p>
              Suburb lookups from the extension are not retained. Account details and assistant conversations
              are kept until you ask us to delete them. Write to us at the address below and we will delete
              your account and its conversation history.
            </p>
            <p>
              Once a message has been processed by an external AI provider, any copy held on their systems is
              governed by their retention policy, not ours, and we cannot delete it for you.
            </p>
          </Section>

          <Section id="census" title="About the Census data">
            <p>
              The statistics SuburbLens shows come from the Australian Bureau of Statistics and describe
              suburbs, not people. They are public aggregate data and contain nothing about you.
            </p>
          </Section>

          <Section id="changes" title="Changes and contact">
            <p>
              If this policy changes materially we will update the date at the top of this page. Questions,
              corrections, or deletion requests:
            </p>
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
            SuburbLens is an independent project and is not affiliated with the Australian Bureau of
            Statistics, realestate.com.au, or domain.com.au.
          </p>
        </footer>
      </div>
    </div>
  )
}
