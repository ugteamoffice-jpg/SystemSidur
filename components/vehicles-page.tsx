"use client"

import VehiclesGrid from "./vehicles-grid"

export function VehiclesPage() {
  return (
    <div className="flex flex-col h-full p-6" dir="rtl">
      <div className="mb-6">
        <h2 className="text-3xl font-bold">רכבים</h2>
        <p className="text-muted-foreground">ניהול רכבים במערכת</p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <VehiclesGrid />
      </div>
    </div>
  )
}
