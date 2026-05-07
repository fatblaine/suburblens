<<<<<<< HEAD
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { TenureByYear } from '../types/api'

const SLICES = [
  { key: 'outright' as const, label: 'Owned outright', fill: '#4ade80' },
  { key: 'mortgage' as const, label: 'With mortgage',  fill: '#facc15' },
  { key: 'rent'     as const, label: 'Rented',         fill: '#f87171' },
]

interface SliceDatum {
  name: string
  fill: string
  pct: number
  count: number | null
}

function buildSlices(tenure: TenureByYear, yr: 'y2011' | 'y2016' | 'y2021'): SliceDatum[] {
  const total = tenure.totalDwellings[yr] ?? null
  return SLICES.map(s => {
    const pct = tenure[s.key][yr] ?? 0
    return {
      name: s.label,
      fill: s.fill,
      pct,
      count: total != null ? Math.round((pct / 100) * total) : null,
    }
  })
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: SliceDatum }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-md text-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
        <span className="font-medium text-gray-800">{d.name}</span>
      </div>
      <div className="text-gray-700">{d.pct.toFixed(1)}%</div>
      {d.count != null && (
        <div className="text-gray-400 text-xs">{d.count.toLocaleString()} dwellings</div>
      )}
    </div>
  )
}

function DonutYear({ year, slices }: { year: string; slices: SliceDatum[] }) {
  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      <p className="text-sm font-semibold text-gray-500 mb-1">{year}</p>

      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="pct"
            innerRadius="62%"
            outerRadius="88%"
            cornerRadius={5}
            paddingAngle={4}
            startAngle={90}
            endAngle={-270}
          >
            {slices.map((s, i) => <Cell key={i} fill={s.fill} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="w-full mt-2 space-y-1.5">
        {slices.map(s => (
          <div key={s.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.fill }} />
              <span className="text-gray-500 truncate">{s.name}</span>
            </div>
            <div className="text-right ml-2 flex-shrink-0">
              <span className="font-medium text-gray-900">{s.pct.toFixed(1)}%</span>
              {s.count != null && (
                <span className="text-gray-400 ml-1">({s.count.toLocaleString()})</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

=======
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { TenureByYear } from '../types/api'

>>>>>>> origin/main
interface Props {
  tenure: TenureByYear
}

export default function TenureChart({ tenure }: Props) {
<<<<<<< HEAD
  return (
    <div className="flex gap-6">
      <DonutYear year="2011" slices={buildSlices(tenure, 'y2011')} />
      <DonutYear year="2016" slices={buildSlices(tenure, 'y2016')} />
      <DonutYear year="2021" slices={buildSlices(tenure, 'y2021')} />
    </div>
=======
  // total dwellings per year — used in tooltip to show "X% (N dwellings)"
  const totals: Record<string, number | null> = {
    '2011': tenure.totalDwellings.y2011,
    '2016': tenure.totalDwellings.y2016,
    '2021': tenure.totalDwellings.y2021,
  }

  const data = [
    {
      year: '2011',
      'Owned outright': tenure.outright.y2011,
      'With mortgage': tenure.mortgage.y2011,
      'Rented': tenure.rent.y2011,
    },
    {
      year: '2016',
      'Owned outright': tenure.outright.y2016,
      'With mortgage': tenure.mortgage.y2016,
      'Rented': tenure.rent.y2016,
    },
    {
      year: '2021',
      'Owned outright': tenure.outright.y2021,
      'With mortgage': tenure.mortgage.y2021,
      'Rented': tenure.rent.y2021,
    },
  ]

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis
          dataKey="year"
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#6b7280', fontSize: 14 }}
        />
        <YAxis
          unit="%"
          domain={[0, 100]}
          axisLine={false}
          tickLine={false}
          tick={{ fill: '#6b7280', fontSize: 12 }}
          width={40}
        />
        <Tooltip
          formatter={(value: number, name: string, props) => {
            const year = props.payload?.year as string
            const total = totals[year]
            const count = total != null ? Math.round((value / 100) * total) : null
            const countStr = count != null ? ` (${count.toLocaleString()} dwellings)` : ''
            return [`${value?.toFixed(1)}%${countStr}`, name]
          }}
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
        />
        <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '13px' }} />
        <Bar dataKey="Owned outright" fill="#4ade80" stackId="a" />
        <Bar dataKey="With mortgage"  fill="#facc15" stackId="a" />
        <Bar dataKey="Rented"         fill="#f87171" stackId="a" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
>>>>>>> origin/main
  )
}
