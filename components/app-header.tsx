"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Database, Moon, Sun, Settings, ChevronDown, Eye } from "lucide-react"
import { useTheme } from "next-themes"
import dynamic from "next/dynamic"
import { ReportSettingsDialog } from "@/components/report-settings-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTenant } from "@/lib/tenant-context"

const UserButton = dynamic(() => import("@clerk/nextjs").then(mod => mod.UserButton), { ssr: false })

export type PageType = "work-schedule" | "customers" | "drivers" | "vehicles" | "report-customer" | "report-driver" | "report-invoices" | "report-profit"

const reportPages: PageType[] = ["report-customer", "report-driver", "report-invoices", "report-profit"]

interface AppHeaderProps {
  activePage: PageType
  onPageChange: (page: PageType) => void
}

export function AppHeader({ activePage, onPageChange }: AppHeaderProps) {
  const { theme, setTheme } = useTheme()
  const [showReportSettings, setShowReportSettings] = useState(false)
  const { tenantId } = useTenant()

  const COLUMN_VISIBILITY_KEY = `workScheduleColumnVisibility_${tenantId}`

  const toggleableColumns = [
    { id: "sent", label: "שלח" },
    { id: "approved", label: "מאושר" },
    { id: "customer", label: "שם לקוח" },
    { id: "pickup", label: "התייצבות" },
    { id: "route", label: "מסלול" },
    { id: "destination", label: "חזור" },
    { id: "vehicleType", label: "סוג רכב" },
    { id: "driver", label: "שם נהג" },
    { id: "vehicleNumber", label: "מספר רכב" },
    { id: "price1", label: "מחיר לקוח+ מע״מ" },
    { id: "price2", label: "מחיר לקוח כולל מע״מ" },
    { id: "price3", label: "מחיר נהג+ מע״מ" },
    { id: "price4", label: "מחיר נהג כולל מע״מ" },
  ]

  const [colVisibility, setColVisibility] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY)
        if (saved) return JSON.parse(saved)
      } catch {}
    }
    return {}
  })

  const updateVisibility = (colId: string, visible: boolean) => {
    const updated = { ...colVisibility, [colId]: visible }
    setColVisibility(updated)
    localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(updated))
    window.dispatchEvent(new CustomEvent("columnVisibilityChange", { detail: updated }))
  }

  const resetVisibility = () => {
    setColVisibility({})
    localStorage.removeItem(COLUMN_VISIBILITY_KEY)
    window.dispatchEvent(new CustomEvent("columnVisibilityChange", { detail: {} }))
  }
  
  const navItems = [
    { id: "work-schedule" as PageType, label: "סידור עבודה" },
    { id: "customers" as PageType, label: "לקוחות" },
    { id: "drivers" as PageType, label: "נהגים" },
    { id: "vehicles" as PageType, label: "רכבים" },
  ]

  const isReportActive = reportPages.includes(activePage)

  const reportLabel: Record<string, string> = {
    "report-customer": "דוח לקוח",
    "report-driver": "דוח נהג",
    "report-invoices": "דוח חשבוניות",
    "report-profit": "דוח רווח והפסד",
  }

  return (
    <>
      <div className="border-b border-border bg-card" dir="rtl">
        <div className="px-4 md:px-6 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <div className="flex items-center gap-2 shrink-0">
                <Database className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                <h1 className="text-base md:text-xl font-bold hidden sm:block">מערכת ניהול</h1>
              </div>
              <nav className="flex gap-0.5 md:gap-1 flex-wrap">
                {navItems.map((item) => (
                  <Button
                    key={item.id}
                    variant="ghost"
                    onClick={() => onPageChange(item.id)}
                    className={`text-sm md:text-base font-medium px-2 md:px-3 h-9 hover:bg-accent hover:text-accent-foreground ${
                      activePage === item.id ? "bg-accent text-accent-foreground" : ""
                    }`}
                  >
                    {item.label}
                  </Button>
                ))}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className={`text-sm md:text-base font-medium px-2 md:px-3 h-9 hover:bg-accent hover:text-accent-foreground ${
                        isReportActive ? "bg-accent text-accent-foreground" : ""
                      }`}
                    >
                      {isReportActive ? reportLabel[activePage] : "דוחות"}
                      <ChevronDown className="h-4 w-4 mr-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" dir="rtl">
                    <DropdownMenuItem onClick={() => onPageChange("report-customer")}>דוח לקוח</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPageChange("report-driver")}>דוח נהג</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPageChange("report-invoices")}>דוח חשבוניות</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onPageChange("report-profit")}>דוח רווח והפסד</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </nav>
            </div>
            
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              {activePage === "work-schedule" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8" title="הצג/הסתר עמודות">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[220px] p-2" align="end" side="bottom" dir="rtl">
                    <div className="text-sm font-medium mb-2">עמודות</div>
                    <div className="flex flex-col gap-1">
                      {toggleableColumns.map(col => (
                        <label key={col.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-accent rounded px-2 py-1">
                          <Checkbox
                            checked={colVisibility[col.id] !== false}
                            onCheckedChange={(checked) => updateVisibility(col.id, !!checked)}
                            className="h-4 w-4"
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={resetVisibility}>
                      איפוס ברירת מחדל
                    </Button>
                  </PopoverContent>
                </Popover>
              )}
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowReportSettings(true)} title="הגדרות ייצוא דוח">
                <Settings className="h-4 w-4" />
              </Button>
              <div className="hidden sm:flex items-center gap-1.5 h-8">
                <Sun className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <input
                  type="range"
                  min="40"
                  max="100"
                  defaultValue={theme === "dark" ? "40" : "100"}
                  className="w-16 md:w-20 h-1.5 accent-amber-500 cursor-pointer"
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val <= 60 && theme !== "dark") setTheme("dark");
                    if (val > 60 && theme !== "light") setTheme("light");
                    document.documentElement.style.filter = `brightness(${val}%)`;
                  }}
                  title="בהירות"
                />
                <Moon className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              </div>
              <UserButton 
                afterSignOutUrl="/sign-in"
                appearance={{ elements: { avatarBox: "h-8 w-8" } }}
              />
            </div>
          </div>
        </div>
      </div>

      <ReportSettingsDialog 
        open={showReportSettings} 
        onOpenChange={setShowReportSettings} 
      />
    </>
  )
}
