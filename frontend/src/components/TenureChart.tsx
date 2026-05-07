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

interface Props {
  tenure: TenureByYear
}

export default function TenureChart({ tenure }: Props) {
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
  )
}
