"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Database, Moon, Sun, Settings, ChevronDown } from "lucide-react"
import { useTheme } from "next-themes"
import dynamic from "next/dynamic"
import { ReportSettingsDialog } from "@/components/report-settings-dialog"
import { ReportDialog } from "@/components/report-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const UserButton = dynamic(() => import("@clerk/nextjs").then(mod => mod.UserButton), { ssr: false })

type PageType = "work-schedule" | "customers" | "drivers" | "vehicles"
type ReportType = "report-customer" | "report-driver" | "report-invoices" | "report-profit"

interface AppHeaderProps {
  activePage: PageType
  onPageChange: (page: PageType) => void
}

export function AppHeader({ activePage, onPageChange }: AppHeaderProps) {
  const { theme, setTheme } = useTheme()
  const [showReportSettings, setShowReportSettings] = useState(false)
  const [reportDialog, setReportDialog] = useState<{ open: boolean; type: ReportType }>({ open: false, type: "report-customer" })
  
  const navItems = [
    { id: "work-schedule" as PageType, label: "סידור עבודה" },
    { id: "customers" as PageType, label: "לקוחות" },
    { id: "drivers" as PageType, label: "נהגים" },
    { id: "vehicles" as PageType, label: "רכבים" },
  ]

  const openReport = (type: ReportType) => {
    setReportDialog({ open: true, type })
  }

  return (
    <>
      <div className="border-b border-border bg-card" dir="rtl">
        {/* Top header with logo */}
        <div className="border-b border-border/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">מערכת ניהול</h1>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowReportSettings(true)}
                title="הגדרות ייצוא דוח"
              >
                <Settings className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                title={theme === "dark" ? "מצב בהיר" : "מצב כהה"}
              >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
              <UserButton 
                afterSignOutUrl="/sign-in"
                appearance={{
                  elements: {
                    avatarBox: "h-9 w-9"
                  }
                }}
              />
            </div>
          </div>
        </div>
        
        {/* Navigation menu */}
        <div className="px-6 py-2">
          <nav className="flex gap-2">
            {navItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                onClick={() => onPageChange(item.id)}
                className={`hover:bg-accent hover:text-accent-foreground ${
                  activePage === item.id ? "bg-accent text-accent-foreground" : ""
                }`}
              >
                {item.label}
              </Button>
            ))}

            {/* Reports dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="hover:bg-accent hover:text-accent-foreground">
                  דוחות
                  <ChevronDown className="h-4 w-4 mr-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" dir="rtl">
                <DropdownMenuItem onClick={() => openReport("report-customer")}>
                  דוח לקוח
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openReport("report-driver")}>
                  דוח נהג
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openReport("report-invoices")}>
                  דוח חשבוניות
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openReport("report-profit")}>
                  דוח רווח והפסד
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </div>

      <ReportSettingsDialog 
        open={showReportSettings} 
        onOpenChange={setShowReportSettings} 
      />

      <ReportDialog
        open={reportDialog.open}
        onOpenChange={(open) => setReportDialog(prev => ({ ...prev, open }))}
        reportType={reportDialog.type}
      />
    </>
  )
}
