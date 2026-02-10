"use client"

import { useState } from "react"
// שים לב: אנחנו מייבאים את הקומפוננטה החדשה במקום DataGrid
import { WorkScheduleView } from "@/components/work-schedule-view"
import { AppHeader } from "@/components/app-header"
import { CustomersPage } from "@/components/customers-page"
import { DriversPage } from "@/components/drivers-page"
import { VehiclesPage } from "@/components/vehicles-page"
// workScheduleSchema כבר לא נדרש כאן כי WorkScheduleView מטפל בזה

export default function HomePage() {
  const [activePage, setActivePage] = useState<"work-schedule" | "customers" | "drivers" | "vehicles">("work-schedule")

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <AppHeader activePage={activePage} onPageChange={setActivePage} />
      
      {/* אזור התוכן הראשי - תופס את כל המקום שנשאר */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activePage === "work-schedule" && <WorkScheduleView />}
        {activePage === "customers" && <CustomersPage />}
        {activePage === "drivers" && <DriversPage />}
        {activePage === "vehicles" && <VehiclesPage />}
      </div>
    </div>
  )
}
