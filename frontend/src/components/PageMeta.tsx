// Per-page <title> and description. React 19 hoists title/meta rendered
// anywhere in the tree up into <head>, so no helmet library is needed.
//
// Deliberately does NOT emit og:* tags. Those live as static defaults in
// index.html: social crawlers never run our JS, so anything set here is
// invisible to them, and emitting og:* in both places would leave two of each
// tag in the DOM for the crawlers that DO run JS (React 19 appends, it does
// not replace). Per-suburb share cards need build-time HTML — see
// docs/planning/seo-and-sharing.md, Stage 1.
export default function PageMeta({ title, description }: { title: string; description: string }) {
  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
    </>
  )
}
