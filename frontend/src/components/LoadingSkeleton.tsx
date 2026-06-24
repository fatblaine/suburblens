export default function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-8 bg-white/10 rounded w-1/3" />
        <div className="h-4 bg-white/10 rounded w-1/4" />
      </div>
      <div className="h-32 bg-white/10 rounded-2xl" />
      <div className="space-y-2">
        <div className="h-5 bg-white/10 rounded w-1/4" />
        <div className="h-64 bg-white/10 rounded-xl" />
      </div>
    </div>
  )
}
