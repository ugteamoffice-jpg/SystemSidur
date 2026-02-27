"use client"

import { useState } from "react"
import { DataGrid } from "@/components/data-grid"
import { AppHeader } from "@/components/app-header"
import type { PageType } from "@/components/app-header"
import { CustomersPage } from "@/components/customers-page"
import { DriversPage } from "@/components/drivers-page"
import { VehiclesPage } from "@/components/vehicles-page"
import { ReportPage } from "@/components/report-page"
import type { ReportType } from "@/components/report-page"
import { RecurringRidesPage } from "@/components/recurring-rides-page"
import { useTenant } from "@/lib/tenant-context"
import { Loader2 } from "lucide-react"

export default function TenantHomePage() {
  const { config, loading } = useTenant()
  const [activePage, setActivePage] = useState<PageType>("work-schedule")

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const isReport = activePage.startsWith("report-")

  return (
    <div className="flex flex-col h-screen">
      <AppHeader activePage={activePage} onPageChange={setActivePage} />
      {activePage === "work-schedule" && <DataGrid />}
      {activePage === "recurring-rides" && <RecurringRidesPage />}
      {activePage === "customers" && <CustomersPage />}
      {activePage === "drivers" && <DriversPage />}
      {activePage === "vehicles" && <VehiclesPage />}
      {isReport && <ReportPage key={activePage} reportType={activePage as ReportType} />}
    </div>
  )
}
