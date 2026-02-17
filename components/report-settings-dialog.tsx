"use client"

import * as React from "react"
import { Settings, Upload, X, Image as ImageIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useTenant } from "@/lib/tenant-context"

export interface ReportSettings {
  companyName: string
  logoBase64: string
  address: string
  phone: string
  email: string
  footerText: string
}

const defaultSettings: ReportSettings = {
  companyName: "",
  logoBase64: "",
  address: "",
  phone: "",
  email: "",
  footerText: "",
}

export function loadReportSettings(tenantId?: string): ReportSettings {
  if (typeof window === "undefined") return defaultSettings
  try {
    const key = tenantId ? `reportSettings_${tenantId}` : "reportSettings"
    const saved = localStorage.getItem(key)
    if (saved) return { ...defaultSettings, ...JSON.parse(saved) }
  } catch (e) {
    console.error("Failed to load report settings:", e)
  }
  return defaultSettings
}

function saveReportSettings(settings: ReportSettings, tenantId?: string) {
  try {
    const key = tenantId ? `reportSettings_${tenantId}` : "reportSettings"
    localStorage.setItem(key, JSON.stringify(settings))
  } catch (e) {
    console.error("Failed to save report settings:", e)
  }
}

interface ReportSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReportSettingsDialog({ open, onOpenChange }: ReportSettingsDialogProps) {
  const { toast } = useToast()
  const { tenantId } = useTenant()
  const [settings, setSettings] = React.useState<ReportSettings>(defaultSettings)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      setSettings(loadReportSettings(tenantId))
    }
  }, [open, tenantId])

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast({ title: "שגיאה", description: "יש לבחור קובץ תמונה", variant: "destructive" })
      return
    }

    if (file.size > 500 * 1024) {
      toast({ title: "שגיאה", description: "גודל הלוגו מקסימלי 500KB", variant: "destructive" })
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setSettings((prev) => ({ ...prev, logoBase64: base64 }))
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveLogo = () => {
    setSettings((prev) => ({ ...prev, logoBase64: "" }))
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleSave = () => {
    saveReportSettings(settings, tenantId)
    toast({ title: "נשמר", description: "הגדרות הדוח נשמרו בהצלחה" })
    onOpenChange(false)
  }

  const updateField = (field: keyof ReportSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <Settings className="h-5 w-5" />
            הגדרות ייצוא דוח
          </DialogTitle>
          <DialogDescription className="text-right">
            פרטים אלו יופיעו בדוחות המיוצאים
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* שם חברה */}
          <div className="space-y-2">
            <Label>שם חברה</Label>
            <Input
              value={settings.companyName}
              onChange={(e) => updateField("companyName", e.target.value)}
              placeholder='לדוגמה: "הסעות ישראל בע"מ"'
              className="text-right"
            />
          </div>

          {/* לוגו */}
          <div className="space-y-2">
            <Label>לוגו חברה</Label>
            {settings.logoBase64 ? (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                <img
                  src={settings.logoBase64}
                  alt="לוגו"
                  className="h-14 w-auto max-w-[200px] object-contain"
                />
                <Button variant="ghost" size="icon" onClick={handleRemoveLogo} className="text-red-500 hover:text-red-600 hover:bg-red-50 mr-auto">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <ImageIcon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">לחץ להעלאת לוגו (עד 500KB)</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
          </div>

          {/* כתובת */}
          <div className="space-y-2">
            <Label>כתובת</Label>
            <Input
              value={settings.address}
              onChange={(e) => updateField("address", e.target.value)}
              placeholder='לדוגמה: "רחוב הרצל 1, תל אביב"'
              className="text-right"
            />
          </div>

          {/* טלפון ומייל בשורה אחת */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>טלפון</Label>
              <Input
                value={settings.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="03-1234567"
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <Label>אימייל</Label>
              <Input
                value={settings.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="info@company.co.il"
                className="text-right"
                dir="ltr"
              />
            </div>
          </div>

          {/* טקסט חופשי בפוטר */}
          <div className="space-y-2">
            <Label>טקסט חופשי בפוטר</Label>
            <Textarea
              value={settings.footerText}
              onChange={(e) => updateField("footerText", e.target.value)}
              placeholder='לדוגמה: "ח.פ 123456789 | כל הזכויות שמורות"'
              className="text-right resize-none"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-row-reverse gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={handleSave}>
            שמור הגדרות
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
