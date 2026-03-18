"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import type { PageType } from "@/components/app-header"
import type { ReportType } from "@/components/report-page"
import { CustomersPage } from "@/components/customers-page"
import { DriversPage } from "@/components/drivers-page"
import VehiclesGrid from "@/components/vehicles-grid"
import CompanyVehiclesGrid from "@/components/company-vehicles-grid"
import { GeneralReportPage } from "@/components/general-report-page"
import { RecurringRidesPage } from "@/components/recurring-rides-page"
import { useTenant } from "@/lib/tenant-context"
import { Loader2 } from "lucide-react"

const DataGrid = dynamic(() => import("@/components/data-grid").then(m => ({ default: m.DataGrid })), { ssr: false })
const AppHeader = dynamic(() => import("@/components/app-header").then(m => ({ default: m.AppHeader })), { ssr: false })
const ReportPage = dynamic(() => import("@/components/report-page").then(m => ({ default: m.ReportPage })), { ssr: false })
const DriverHoursPage = dynamic(() => import("@/components/driver-hours-page").then(m => ({ default: m.DriverHoursPage })), { ssr: false })
const AdminUsersPage = dynamic(() => import("@/components/admin-users-page").then(m => ({ default: m.AdminUsersPage })), { ssr: false })

export default function TenantHomePage() {
  const { config, loading } = useTenant()
  const [activePage, setActivePage] = useState<PageType>("work-schedule")

  const titles: Record<string, string> = {
    "work-schedule": 'סידור עבודה | לו"ז',
    "recurring-rides": 'נסיעות קבועות | לו"ז',
    "customers": 'לקוחות | לו"ז',
    "drivers": 'נהגים | לו"ז',
    "vehicle-types": 'סוגי רכבים | לו"ז',
    "company-vehicles": 'רכבי חברה | לו"ז',
    "report-general": 'דוח נסיעות כללי | לו"ז',
    "driver-hours": 'חישוב שעות נהג | לו"ז',
    "report-customer": 'דוח לקוח | לו"ז',
    "report-driver": 'דוח נהג | לו"ז',
    "report-invoices": 'דוח חשבוניות | לו"ז',
    "report-profit": 'דוח רווח והפסד | לו"ז',
    "admin-users": 'ניהול משתמשים | לו"ז',
  }

  // Read page from URL on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const page = params.get("page") as PageType
    if (page) setActivePage(page)
  }, [])

  // Update tab title whenever activePage changes
  useEffect(() => {
    document.title = titles[activePage] ?? 'סידור עבודה | לו"ז'
  }, [activePage])

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
      {activePage === "driver-hours" && <DriverHoursPage />}
      {activePage === "admin-users" && <AdminUsersPage />}
      {isReport && <ReportPage key={activePage} reportType={activePage as ReportType} />}
    </div>
  )
}
