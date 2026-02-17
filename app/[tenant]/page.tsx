"use client"

import { useState } from "react"
import { DataGrid } from "@/components/data-grid"
import { AppHeader } from "@/components/app-header"
import { CustomersPage } from "@/components/customers-page"
import { DriversPage } from "@/components/drivers-page"
import { VehiclesPage } from "@/components/vehicles-page"
import { ReportPage } from "@/components/report-page"
import { useTenant } from "@/lib/tenant-context"
import { Loader2 } from "lucide-react"

type PageType = "work-schedule" | "customers" | "drivers" | "vehicles" | "report-customer" | "report-driver" | "report-invoices" | "report-profit"

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

  return (
    <div className="flex flex-col h-screen">
      <AppHeader activePage={activePage} onPageChange={setActivePage} />
      {activePage === "work-schedule" && <DataGrid />}
      {activePage === "customers" && <CustomersPage />}
      {activePage === "drivers" && <DriversPage />}
      {activePage === "vehicles" && <VehiclesPage />}
      {activePage === "report-customer" && <ReportPage reportType="report-customer" />}
      {activePage === "report-driver" && <ReportPage reportType="report-driver" />}
      {activePage === "report-invoices" && <ReportPage reportType="report-invoices" />}
      {activePage === "report-profit" && <ReportPage reportType="report-profit" />}
    </div>
  )
}
