"use client"

import VehiclesGrid from "./vehicles-grid"

export function VehiclesPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden" dir="rtl">
      <div className="flex-1 overflow-hidden">
        <VehiclesGrid />
      </div>
    </div>
  )
}
