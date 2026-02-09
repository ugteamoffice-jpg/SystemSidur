"use client"

import { useState } from "react"
import { DataGrid } from "@/components/data-grid"
import { AppHeader } from "@/components/app-header"
import { CustomersPage } from "@/components/customers-page"
import { DriversPage } from "@/components/drivers-page"
import { VehiclesPage } from "@/components/vehicles-page"
import workScheduleSchema from "@/schema/table-tblVAQgIYOLfvCZdqgj.json"

export default function HomePage() {
  const [activePage, setActivePage] = useState<"work-schedule" | "customers" | "drivers" | "vehicles">("work-schedule")

  return (
    <div className="flex flex-col h-screen">
      <AppHeader activePage={activePage} onPageChange={setActivePage} />
      {activePage === "work-schedule" && <DataGrid schema={workScheduleSchema} />}
      {activePage === "customers" && <CustomersPage />}
      {activePage === "drivers" && <DriversPage />}
      {activePage === "vehicles" && <VehiclesPage />}
    </div>
  )
}
