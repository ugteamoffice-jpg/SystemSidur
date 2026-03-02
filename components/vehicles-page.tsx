"use client"

import { useState } from "react"
import VehiclesGrid from "./vehicles-grid"
import CompanyVehiclesGrid from "./company-vehicles-grid"

type VehicleTab = "types" | "company"

export function VehiclesPage() {
  const [activeTab, setActiveTab] = useState<VehicleTab>("types")

  return (
    <div className="flex flex-col h-full overflow-hidden" dir="rtl">
      {/* Sub-tabs */}
      <div className="flex border-b px-4 pt-2 gap-1 flex-none bg-background">
        <button
          onClick={() => setActiveTab("types")}
          className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors ${
            activeTab === "types"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          סוגי רכבים
        </button>
        <button
          onClick={() => setActiveTab("company")}
          className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 transition-colors ${
            activeTab === "company"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          רכבי חברה
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "types" && <VehiclesGrid />}
        {activeTab === "company" && <CompanyVehiclesGrid />}
      </div>
    </div>
  )
}

