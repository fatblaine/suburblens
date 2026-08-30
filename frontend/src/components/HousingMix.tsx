import type { HousingMixResponse } from '../types/api'
import { COLORS, SURFACE_2 } from '../lib/theme'


interface Props {
  response: HousingMixResponse
}

const integer = new Intl.NumberFormat('en-AU')

function formatPct(value: number | null): string {
  return value == null ? '—' : `${value.toFixed(1)}%`
}

export default function HousingMix({ response }: Props) {
  const { housing, gccsaName, censusYear } = response
  const total = housing.totalOccupiedPrivateDwellings
  const allComponents =
    housing.separateHouses +
    housing.semiDetachedTownhouses +
    housing.apartments +
    housing.otherDwellings +
    housing.structureNotStated
  const barDenominator = Math.max(total, allComponents, 1)
  const houseShare = total > 0 ? 100 * housing.separateHouses / total : null
  const mainLabel = housing.attachedDwellingsPer100Houses == null
    ? 'No separate houses'
    : housing.attachedDwellingsPer100Houses.toFixed(1)
  const median = housing.cityMedianAttachedDwellingsPer100Houses
  const difference = housing.attachedDwellingsPer100Houses != null && median != null
    ? housing.attachedDwellingsPer100Houses - median
    : null
  const benchmarkLabel = difference == null
    ? null
    : Math.abs(difference) < 0.05
      ? 'In line with the city median'
      : `${Math.abs(difference).toFixed(1)} ${difference > 0 ? 'above' : 'below'} the city median`

  const categories = [
    {
      label: 'Separate houses',
      count: housing.separateHouses,
      pct: houseShare,
      color: COLORS.owned,
    },
    {
      label: 'Townhouses / terraces',
      count: housing.semiDetachedTownhouses,
      pct: housing.townhouseSharePct,
      color: COLORS.mortgage,
    },
    {
      label: 'Apartments',
      count: housing.apartments,
      pct: housing.apartmentSharePct,
      color: COLORS.origin,
    },
  ]

  const compositionLabel = categories
    .map(category => `${category.label} ${formatPct(category.pct)}`)
    .join(', ')

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-lemon">
        Housing mix · {censusYear} Census
      </p>

      <div className="mt-4 border-b border-white/[0.07] pb-6">
        {housing.attachedDwellingsPer100Houses == null ? (
          <p className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-3xl">
            {mainLabel}
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
            <span className="font-display text-4xl font-bold tracking-[-0.04em] text-fg sm:text-5xl">
              {mainLabel}
            </span>
            <span className="pb-1 font-mono text-xs uppercase tracking-[0.12em] text-muted sm:text-sm">
              attached dwellings per 100 separate houses
            </span>
          </div>
        )}
        <p className="mt-2 text-sm leading-6 text-muted">
          Attached dwellings include apartments, semi-detached homes, terraces and townhouses.
        </p>
        <p className="mt-1 font-mono text-xs text-faint">
          {housing.apartmentsPer100Houses == null
            ? 'Apartment-only ratio unavailable without separate houses'
            : `${housing.apartmentsPer100Houses.toFixed(1)} apartments per 100 separate houses`}
        </p>
      </div>

      <div className="mt-6">
        <div
          role="img"
          aria-label={`Housing composition: ${compositionLabel}`}
          className="flex h-3 overflow-hidden rounded-full bg-surface-3"
        >
          {categories.map(category => (
            <span
              key={category.label}
              aria-hidden="true"
              style={{
                width: `${100 * category.count / barDenominator}%`,
                backgroundColor: category.color,
              }}
            />
          ))}
        </div>

        <dl className="mt-4 grid gap-2 sm:grid-cols-3">
          {categories.map(category => (
            <div key={category.label} className={`${SURFACE_2} min-w-0 p-3`}>
              <dt className="flex items-center gap-2 text-xs text-muted">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                <span className="truncate">{category.label}</span>
              </dt>
              <dd className="mt-2 font-mono text-sm text-fg">
                {integer.format(category.count)}
                <span className="ml-2 text-faint">{formatPct(category.pct)}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className={`${SURFACE_2} mt-5 p-4`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-faint">
            {gccsaName} median
          </p>
          <p className="font-mono text-sm text-fg">
            {median == null ? '—' : `${median.toFixed(1)} per 100 separate houses`}
          </p>
        </div>
        {benchmarkLabel && <p className="mt-2 text-sm text-muted">{benchmarkLabel}.</p>}
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs text-faint">
        <span>Attached dwellings: {integer.format(housing.attachedDwellings)}</span>
        <span>Other dwellings: {integer.format(housing.otherDwellings)}</span>
        <span>Not stated: {integer.format(housing.structureNotStated)}</span>
        <span>Total occupied: {integer.format(total)}</span>
      </div>
    </div>
  )
}
