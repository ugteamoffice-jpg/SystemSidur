"use client"

import * as React from "react"
import { Calendar as CalendarIcon, Send, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { he } from "date-fns/locale"

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
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { loadReportSettings } from "@/components/report-settings-dialog"

// שדות נהגים
const FIRST_NAME_ID = "fld1yMIkREcEcRkCHQ0"
const LAST_NAME_ID = "fldAI4Vc5glNW9aZVov"
const PHONE_ID = "fldnGgcmCUrVXHKBSWU"
const DRIVER_TYPE_ID = "fldkfxdV3js9C4FqzRz"

interface SendWhatsappDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentDate: Date
  allRecords: any[]
  initialDriverName?: string
}

function getDriverName(record: any): string {
  const driver = record.fields.flddNPbrzOCdgS36kx5
  if (Array.isArray(driver) && driver.length > 0) return driver[0]?.title || ""
  if (typeof driver === "object" && driver?.title) return driver.title
  return String(driver || "")
}

function getVehicleType(record: any): string {
  const vt = record.fields.fldx4hl8FwbxfkqXf0B
  if (Array.isArray(vt) && vt.length > 0) return vt[0]?.title || "-"
  if (typeof vt === "object" && vt?.title) return vt.title
  return String(vt || "-")
}

export function SendWhatsappDialog({
  open,
  onOpenChange,
  currentDate,
  allRecords,
  initialDriverName,
}: SendWhatsappDialogProps) {
  const { toast } = useToast()
  const [startDate, setStartDate] = React.useState<Date | undefined>(currentDate)
  const [startDateMonth, setStartDateMonth] = React.useState<Date>(currentDate)
  const [endDate, setEndDate] = React.useState<Date | undefined>(currentDate)
  const [endDateMonth, setEndDateMonth] = React.useState<Date>(currentDate)
  const [isLoading, setIsLoading] = React.useState(false)
  const [driverInfo, setDriverInfo] = React.useState<{
    phone: string
    type: string
  } | null>(null)

  React.useEffect(() => {
    if (open) {
      setStartDate(currentDate)
      setEndDate(currentDate)
      setStartDateMonth(currentDate)
      setEndDateMonth(currentDate)
      setDriverInfo(null)
      if (initialDriverName) {
        fetchDriverInfo(initialDriverName)
      }
    }
  }, [open, currentDate, initialDriverName])

  const fetchDriverInfo = async (driverName: string) => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/drivers")
      const json = await res.json()
      if (!json.records) throw new Error("No records")

      // חיפוש נהג לפי שם מלא (שם פרטי + שם משפחה)
      const match = json.records.find((d: any) => {
        const firstName = d.fields[FIRST_NAME_ID] || ""
        const lastName = d.fields[LAST_NAME_ID] || ""
        const fullName = `${firstName} ${lastName}`.trim()
        return fullName === driverName || firstName === driverName
      })

      if (match) {
        const phone = String(match.fields[PHONE_ID] || "")
        const type = String(match.fields[DRIVER_TYPE_ID] || "קבלן")
        setDriverInfo({ phone, type })
      } else {
        setDriverInfo({ phone: "", type: "קבלן" })
        toast({
          title: "לא נמצא טלפון",
          description: "לא נמצא מספר טלפון עבור הנהג. ניתן להזין ידנית.",
          variant: "destructive",
        })
      }
    } catch (err) {
      console.error("Failed to fetch driver info:", err)
      setDriverInfo({ phone: "", type: "קבלן" })
    } finally {
      setIsLoading(false)
    }
  }

  const formatPhone = (phone: string): string => {
    let clean = phone.replace(/\D/g, "")
    if (clean.startsWith("0")) {
      clean = "972" + clean.slice(1)
    }
    if (!clean.startsWith("972")) {
      clean = "972" + clean
    }
    return clean
  }

  const handleSend = () => {
    if (!initialDriverName || !driverInfo) return
    if (!startDate || !endDate) {
      toast({ title: "שגיאה", description: "יש לבחור תאריכים", variant: "destructive" })
      return
    }
    if (startDate > endDate) {
      toast({ title: "שגיאה", description: "תאריך ההתחלה חייב להיות לפני תאריך הסיום", variant: "destructive" })
      return
    }
    if (!driverInfo.phone) {
      toast({ title: "שגיאה", description: "אין מספר טלפון לנהג", variant: "destructive" })
      return
    }

    const settings = loadReportSettings()

    const startOfDay = new Date(startDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(endDate)
    endOfDay.setHours(23, 59, 59, 999)

    const filteredRecords = allRecords.filter((record) => {
      const recordDate = record.fields.fldvNsQbfzMWTc7jakp
        ? new Date(record.fields.fldvNsQbfzMWTc7jakp)
        : null
      if (!recordDate) return false
      const name = getDriverName(record)
      return name === initialDriverName && recordDate >= startOfDay && recordDate <= endOfDay
    })

    if (filteredRecords.length === 0) {
      toast({
        title: "אין נתונים",
        description: "לא נמצאו נסיעות עבור הנהג בטווח התאריכים שנבחר",
        variant: "destructive",
      })
      return
    }

    filteredRecords.sort((a, b) => {
      const dateA = new Date(a.fields.fldvNsQbfzMWTc7jakp || 0)
      const dateB = new Date(b.fields.fldvNsQbfzMWTc7jakp || 0)
      return dateA.getTime() - dateB.getTime()
    })

    const isContractor = driverInfo.type === "קבלן"

    // בניית ההודעה
    const companyPart = settings.companyName ? ` מחברת ${settings.companyName}` : ""
    let message = `מצ"ב סידור עבודה${companyPart}\n`

    let totalBeforeVat = 0
    let totalWithVat = 0

    filteredRecords.forEach((record) => {
      const fields = record.fields
      const recordDate = fields.fldvNsQbfzMWTc7jakp ? new Date(fields.fldvNsQbfzMWTc7jakp) : null
      const dateStr = recordDate ? format(recordDate, "d.M.yyyy") : ""
      const goTime = fields.fldLbXMREYfC8XVIghj || "-"
      const route = fields.fldA6e7ul57abYgAZDh || "-"
      const returnTime = fields.fld56G8M1LyHRRROWiL || "-"
      const vehicleType = getVehicleType(record)
      const priceBeforeVat = Number(fields.fldSNuxbM8oJfrQ3a9x) || 0
      const priceWithVat = Number(fields.fldyQIhjdUeQwtHMldD) || 0

      totalBeforeVat += priceBeforeVat
      totalWithVat += priceWithVat

      message += `\n*תאריך* - ${dateStr}\n`
      message += `*סוג רכב* - ${vehicleType}\n`
      message += `${goTime} ${route} ${returnTime}\n`

      if (isContractor) {
        message += `מחיר לפני מע"מ - ${priceBeforeVat.toLocaleString("he-IL")} ₪\n`
        message += `מחיר כולל מע"מ - ${priceWithVat.toLocaleString("he-IL")} ₪\n`
      }

      const notes = fields.fldhNoiFEkEgrkxff02 || ""
      if (notes) {
        message += `הערות: ${notes}\n`
      }
    })

    // סיכום
    message += `\n📊 *סיכום*\n`
    message += `סה"כ נסיעות: ${filteredRecords.length}\n`

    if (isContractor) {
      message += `סה"כ לפני מע"מ: ${totalBeforeVat.toLocaleString("he-IL")} ₪\n`
      message += `סה"כ כולל מע"מ: ${totalWithVat.toLocaleString("he-IL")} ₪\n`
    }

    message += `\nנא לאשר קבלת סידור עבודה ✅`

    const phone = formatPhone(driverInfo.phone)
    const encodedMessage = encodeURIComponent(message)
    const url = `https://wa.me/${phone}?text=${encodedMessage}`

    window.open(url, "_blank")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">שליחה בוואטסאפ</DialogTitle>
          <DialogDescription className="text-right">
            שלח סידור עבודה לנהג בוואטסאפ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* נהג נעול */}
          <div className="space-y-2">
            <Label className="text-right">נהג</Label>
            <Input value={initialDriverName || ""} disabled className="text-right bg-muted" />
          </div>

          {/* טלפון */}
          <div className="space-y-2">
            <Label className="text-right">טלפון</Label>
            {isLoading ? (
              <div className="flex items-center gap-2 h-10 px-3 border rounded-md bg-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">טוען פרטי נהג...</span>
              </div>
            ) : (
              <Input
                value={driverInfo?.phone || ""}
                onChange={(e) =>
                  setDriverInfo((prev) => prev ? { ...prev, phone: e.target.value } : { phone: e.target.value, type: "קבלן" })
                }
                placeholder="050-1234567"
                className="text-right"
                dir="ltr"
              />
            )}
          </div>

          {/* סוג נהג */}
          {driverInfo && (
            <div className="text-sm text-muted-foreground">
              סוג נהג: <span className="font-medium text-foreground">{driverInfo.type}</span>
              {driverInfo.type === "שכיר" && " (ההודעה תישלח ללא מחירים)"}
            </div>
          )}

          {/* תאריכים */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>מתאריך:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className="w-full justify-start text-right">
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP", { locale: he }) : "בחר תאריך"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side="bottom">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date)
                      if (date) setStartDateMonth(date)
                    }}
                    month={startDateMonth}
                    onMonthChange={setStartDateMonth}
                    locale={he}
                    dir="rtl"
                    fixedWeeks
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>עד תאריך:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className="w-full justify-start text-right">
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP", { locale: he }) : "בחר תאריך"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side="bottom">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      setEndDate(date)
                      if (date) setEndDateMonth(date)
                    }}
                    month={endDateMonth}
                    onMonthChange={setEndDateMonth}
                    locale={he}
                    dir="rtl"
                    fixedWeeks
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row-reverse gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={handleSend} disabled={isLoading || !driverInfo?.phone}>
            <Send className="ml-2 h-4 w-4" />
            שלח בוואטסאפ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
