import SearchBox from '../components/SearchBox'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">

      {/* Title Section */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          SuburbLens
        </h1>
        <p className="text-gray-500 text-lg">
          Is this suburb becoming more "owner-occupied" or "rental"?
        </p>
        <p className="text-gray-400 text-sm mt-1">
          Based on Australian Census data from 2011, 2016, and 2021.
        </p>
      </div>

      <SearchBox />

      <p className="mt-4 text-xs text-gray-400">
        Only Sydney and Melbourne suburbs are available in this demo version.
      </p>

    </main>
  )
}