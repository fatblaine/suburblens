import {
  useSuburbTenure,
  useSuburbLanguage,
  useSuburbBirthCountry,
  useSuburbEducation,
  useSuburbCrime,
} from '../api/suburbs'
import { buildNarrative } from '../lib/narrative'

// An editorial, data-driven paragraph shown on every suburb card. It reuses the
// exact hooks (and therefore the TanStack cache) that SuburbCard's other
// sections already populate, so it fires no extra network requests. Its job is
// to turn "charts + numbers" into readable prose — the strongest evidence for
// AdSense that these are genuine content pages, not scaled/templated filler
// (adsense-plan §8.5.1).
export default function SuburbNarrative({ salCode }: { salCode: string }) {
  const tenure = useSuburbTenure(salCode)
  const language = useSuburbLanguage(salCode)
  const birthCountry = useSuburbBirthCountry(salCode)
  const education = useSuburbEducation(salCode)
  const crime = useSuburbCrime(salCode)

  // Tenure is the backbone; without it there is nothing to say. The other
  // dimensions fill in the prose as their queries settle.
  if (!tenure.data) return null

  const { paragraphs, source } = buildNarrative({
    tenure: tenure.data,
    language: language.data,
    birthCountry: birthCountry.data,
    education: education.data,
    crime: crime.data,
  })

  if (!paragraphs.length) return null

  return (
    <section className="bg-surface border border-white/[0.07] shadow-xl shadow-black/30 rounded-2xl p-6">
      <div className="font-mono text-[11px] uppercase tracking-wider text-lemon mb-3">In brief</div>
      <div className="space-y-3 text-sm leading-relaxed text-muted">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <p className="mt-4 font-mono text-[11px] text-dim">{source}</p>
    </section>
  )
}
