"use client"

import VehiclesGrid from "./vehicles-grid"

export function VehiclesPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden" dir="rtl">
      <div className="p-6 pb-0 flex-none">
        <h2 className="text-3xl font-bold">רכבים</h2>
        <p className="text-muted-foreground">ניהול רכבים במערכת</p>
      </div>

      <div className="flex-1 overflow-hidden">
        <VehiclesGrid />
      </div>
    </div>
  )
}
