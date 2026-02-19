"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Database, Moon, Sun, Settings, ChevronDown } from "lucide-react"
import { useTheme } from "next-themes"
import dynamic from "next/dynamic"
import { ReportSettingsDialog } from "@/components/report-settings-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
        <div className="px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Database className="h-7 w-7 text-primary" />
                <h1 className="text-xl font-bold">מערכת ניהול</h1>
              </div>
              <nav className="flex gap-1">
                {navItems.map((item) => (
                  <Button
                    key={item.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => onPageChange(item.id)}
                    className={`hover:bg-accent hover:text-accent-foreground ${
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
                      size="sm"
                      className={`hover:bg-accent hover:text-accent-foreground ${
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
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowReportSettings(true)} title="הגדרות ייצוא דוח">
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title={theme === "dark" ? "מצב בהיר" : "מצב כהה"}>
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
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
