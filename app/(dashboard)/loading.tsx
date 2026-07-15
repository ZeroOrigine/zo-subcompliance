// CANONICAL — Route-level skeleton for dashboard pages while their chunk loads.
export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your dashboard">
      <div className="space-y-2">
        <div className="sc-skeleton h-4 w-32" />
        <div className="sc-skeleton h-9 w-72 max-w-full" />
      </div>
      <div className="sc-skeleton h-32 w-full" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="sc-skeleton h-28 w-full" />
        <div className="sc-skeleton h-28 w-full" />
        <div className="sc-skeleton h-28 w-full" />
        <div className="sc-skeleton h-28 w-full" />
      </div>
      <div className="sc-skeleton h-72 w-full" />
    </div>
  )
}
