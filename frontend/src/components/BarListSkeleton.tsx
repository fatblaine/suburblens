// Shared loading placeholder for the horizontal "label · bar · %" lists used by
// the language / education / crime sections. Replaces three hand-rolled copies.
export default function BarListSkeleton({
  rows = 6,
  labelWidth = 'w-28',
}: {
  rows?: number
  labelWidth?: string
}) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className={`${labelWidth} h-3 bg-white/10 rounded`} />
          <div className="flex-1 h-4 bg-white/10 rounded-full" />
          <div className="w-10 h-3 bg-white/10 rounded" />
        </div>
      ))}
    </div>
  )
}
