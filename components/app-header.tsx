"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Settings, ChevronDown, Eye, Menu, X, DatabaseBackup, Users } from "lucide-react"
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
import { useOrganization } from "@clerk/nextjs"
import { BackupDialog } from "@/components/backup-dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"

const UserButton = dynamic(() => import("@clerk/nextjs").then(mod => mod.UserButton), { ssr: false })

export type PageType = "work-schedule" | "customers" | "drivers" | "vehicle-types" | "company-vehicles" | "recurring-rides" | "report-customer" | "report-driver" | "report-invoices" | "report-profit" | "report-general" | "admin-users"

const reportPages: PageType[] = ["report-general", "report-customer", "report-driver", "report-invoices", "report-profit"]
const vehiclePages: PageType[] = ["vehicle-types", "company-vehicles"]

interface AppHeaderProps {
  activePage: PageType
  onPageChange: (page: PageType) => void
}

export function AppHeader({ activePage, onPageChange }: AppHeaderProps) {
  const { theme, setTheme } = useTheme()
  const [showReportSettings, setShowReportSettings] = useState(false)
  const [showBackupDialog, setShowBackupDialog] = useState(false)
  const [showAutoBackupPrompt, setShowAutoBackupPrompt] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { tenantId } = useTenant()
  const { membership } = useOrganization()
  const isAdmin = membership?.role === "org:admin"

  const navigateTo = (page: PageType) => {
    if (activePage === page) {
      window.location.reload()
    } else {
      const w = window.open(window.location.pathname + "?page=" + page, "luz_" + page)
      if (w) w.focus()
    }
  }

  // Set window name so duplicate tabs are reused
  useEffect(() => {
    window.name = "luz_" + activePage
  }, [activePage])

  const COLUMN_VISIBILITY_KEY = `workScheduleColumnVisibility_${tenantId}`

  // Auto-backup: check once per day — desktop only
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!tenantId) return
    if (window.innerWidth < 768) return // skip on mobile
    const key = `lastBackup_${tenantId}`
    try {
      const lastBackup = localStorage.getItem(key)
      const today = new Date().toISOString().substring(0, 10)
      if (lastBackup !== today) {
        setShowAutoBackupPrompt(true)
      }
    } catch {}
  }, [tenantId])

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

  const [colVisibility, setColVisibility] = useState<Record<string, boolean>>({})
  useEffect(() => {
    try {
      const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY)
      if (saved) setColVisibility(JSON.parse(saved))
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [COLUMN_VISIBILITY_KEY])

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
    { id: "work-schedule" as PageType, label: 'לו"ז - סידור עבודה' },
    { id: "recurring-rides" as PageType, label: "נסיעות קבועות" },
    { id: "customers" as PageType, label: "לקוחות" },
    { id: "drivers" as PageType, label: "נהגים" },
  ]

  const isReportActive = reportPages.includes(activePage)
  const isVehicleActive = vehiclePages.includes(activePage)

  const vehicleLabel: Record<string, string> = {
    "vehicle-types": "סוגי רכבים",
    "company-vehicles": "רכבי חברה",
  }

  const reportLabel: Record<string, string> = {
    "report-general": "דוח נסיעות כללי",
    "report-customer": "דוח לקוח",
    "report-driver": "דוח נהג",
    "report-invoices": "דוח חשבוניות",
    "report-profit": "דוח רווח והפסד",
  }

  return (
    <>
      <div className="border-b border-border bg-card" dir="rtl">
        <div className="px-3 md:px-6 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              {/* Logo - mobile: absolute center, desktop: normal flow */}
              <div className="flex items-center shrink-0 md:static absolute left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0">
                <img src="/luz-logo.png" alt="LUZ" className="h-10 md:h-14 border-0 outline-none bg-transparent" />
              </div>
              {/* Desktop nav */}
              <nav className="hidden md:flex gap-0.5 md:gap-1 flex-wrap">
                {navItems.map((item) => (
                  <Button
                    key={item.id}
                    variant="ghost"
                    onClick={() => navigateTo(item.id)}
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
                        isVehicleActive ? "bg-accent text-accent-foreground" : ""
                      }`}
                    >
                      {isVehicleActive ? vehicleLabel[activePage] : "רכבים"}
                      <ChevronDown className="h-4 w-4 mr-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" dir="rtl">
                    <DropdownMenuItem onClick={() => navigateTo("vehicle-types")}>סוגי רכבים</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigateTo("company-vehicles")}>רכבי חברה</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
                    <DropdownMenuItem onClick={() => navigateTo("report-general")}>דוח נסיעות כללי</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigateTo("report-customer")}>דוח לקוח</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigateTo("report-driver")}>דוח נהג</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigateTo("report-invoices")}>דוח חשבוניות</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigateTo("report-profit")}>דוח רווח והפסד</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigateTo("driver-hours")}>חישוב שעות נהג</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </nav>
            </div>
            
            <div className="flex items-center gap-1 md:gap-2 shrink-0">
              {activePage === "work-schedule" && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="h-8 w-8 hidden md:flex" title="הצג/הסתר עמודות">
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
              {isAdmin && (
              <Button variant="outline" size="icon" className="h-8 w-8 hidden md:flex" onClick={() => onPageChange("admin-users")} title="ניהול משתמשים">
                <Users className="h-4 w-4" />
              </Button>
              )}
              <Button variant="outline" size="icon" className="h-8 w-8 hidden md:flex" onClick={() => setShowBackupDialog(true)} title="גיבוי ושחזור">
                <DatabaseBackup className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 hidden md:flex" onClick={() => setShowReportSettings(true)} title="הגדרות ייצוא דוח">
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

      <AlertDialog open={showAutoBackupPrompt} onOpenChange={setShowAutoBackupPrompt}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">גיבוי יומי</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              לא בוצע גיבוי היום. האם ברצונך להוריד גיבוי של כל הנסיעות?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction onClick={() => {
              const key = `lastBackup_${tenantId}`
              localStorage.setItem(key, new Date().toISOString().substring(0, 10))
              setShowAutoBackupPrompt(false)
              setShowBackupDialog(true)
            }}>
              כן, הורד גיבוי
            </AlertDialogAction>
            <AlertDialogCancel onClick={() => {
              const key = `lastBackup_${tenantId}`
              localStorage.setItem(key, new Date().toISOString().substring(0, 10))
              setShowAutoBackupPrompt(false)
            }}>
              לא תודה
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <BackupDialog open={showBackupDialog} onOpenChange={setShowBackupDialog} />
      <ReportSettingsDialog 
        open={showReportSettings} 
        onOpenChange={setShowReportSettings} 
      />
    </>
  )
}
