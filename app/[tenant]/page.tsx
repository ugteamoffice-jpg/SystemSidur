"use client"

import { useState, useEffect } from "react"
import { DataGrid } from "@/components/data-grid"
import { AppHeader } from "@/components/app-header"
import type { PageType } from "@/components/app-header"
import { CustomersPage } from "@/components/customers-page"
import { DriversPage } from "@/components/drivers-page"
import VehiclesGrid from "@/components/vehicles-grid"
import CompanyVehiclesGrid from "@/components/company-vehicles-grid"
import { ReportPage } from "@/components/report-page"
import type { ReportType } from "@/components/report-page"
import { GeneralReportPage } from "@/components/general-report-page"
import { RecurringRidesPage } from "@/components/recurring-rides-page"
import { useTenant } from "@/lib/tenant-context"
import { Loader2 } from "lucide-react"

export default function TenantHomePage() {
  const { config, loading } = useTenant()
  const [activePage, setActivePage] = useState<PageType>("work-schedule")

  // Read page from URL on load + set tab title
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const page = params.get("page") as PageType
    if (page) setActivePage(page)
    const titles: Record<string, string> = {
      "work-schedule": 'לו"ז - סידור עבודה',
      "recurring-rides": "נסיעות קבועות",
      "customers": "לקוחות",
      "drivers": "נהגים",
      "vehicle-types": "סוגי רכבים",
      "company-vehicles": "רכבי חברה",
      "report-general": "דוח נסיעות כללי",
      "report-customer": "דוח לקוח",
      "report-driver": "דוח נהג",
      "report-invoices": "דוח חשבוניות",
      "report-profit": "דוח רווח והפסד",
    }
    if (page && titles[page]) document.title = titles[page]
  }, [])

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const isReport = activePage.startsWith("report-") && activePage !== "report-general"

  return (
    <div className="flex flex-col h-screen">
      <AppHeader activePage={activePage} onPageChange={setActivePage} />
      {activePage === "work-schedule" && <DataGrid />}
      {activePage === "recurring-rides" && <RecurringRidesPage />}
      {activePage === "customers" && <CustomersPage />}
      {activePage === "drivers" && <DriversPage />}
      {activePage === "vehicle-types" && <div className="flex flex-col h-full overflow-hidden"><VehiclesGrid /></div>}
      {activePage === "company-vehicles" && <div className="flex flex-col h-full overflow-hidden"><CompanyVehiclesGrid /></div>}
      {activePage === "report-general" && <GeneralReportPage />}
      {isReport && <ReportPage key={activePage} reportType={activePage as ReportType} />}
    </div>
  )
}
