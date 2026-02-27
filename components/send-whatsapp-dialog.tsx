"use client"

import * as React from "react"
import { Calendar as CalendarIcon, Send, Loader2, Copy, Check } from "lucide-react"
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
import { useTenantFields, useTenant } from "@/lib/tenant-context"

interface SendWhatsappDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentDate: Date
  allRecords: any[]
  initialDriverName?: string
  selectedRecords?: any[]
}

function getDriverName(record: any, fieldId: string): string {
  if (record.fields._driverFullName) return record.fields._driverFullName
  const driver = record.fields[fieldId]
  if (Array.isArray(driver) && driver.length > 0) return driver[0]?.title || ""
  if (typeof driver === "object" && driver?.title) return driver.title
  return String(driver || "")
}

function getVehicleType(record: any, fieldId: string): string {
  const vt = record.fields[fieldId]
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
  selectedRecords,
}: SendWhatsappDialogProps) {
  const { toast } = useToast()
  const tenantFields = useTenantFields()
  const { tenantId } = useTenant()
  const WS = tenantFields?.workSchedule
  const DRV = tenantFields?.drivers
  const FIRST_NAME_ID = DRV?.FIRST_NAME || ""
  const PHONE_ID = DRV?.PHONE || ""
  const DRIVER_TYPE_ID = DRV?.DRIVER_TYPE || ""

  const [startDate, setStartDate] = React.useState<Date | undefined>(currentDate)
  const [startDateMonth, setStartDateMonth] = React.useState<Date>(currentDate)
  const [endDate, setEndDate] = React.useState<Date | undefined>(currentDate)
  const [endDateMonth, setEndDateMonth] = React.useState<Date>(currentDate)
  const [isLoading, setIsLoading] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [driverInfo, setDriverInfo] = React.useState<{
    phone: string
    type: string
  } | null>(null)

  React.useEffect(() => {
    if (open) {
      setUseSelectedOnly(hasSelected || false)
      setStartDate(currentDate)
      setEndDate(currentDate)
      setStartDateMonth(currentDate)
      setEndDateMonth(currentDate)
      setDriverInfo(null)
      setCopied(false)
      if (initialDriverName) {
        fetchDriverInfo(initialDriverName)
      }
    }
  }, [open, currentDate, initialDriverName])

  const fetchDriverInfo = async (driverName: string) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/drivers?tenant=${tenantId}`)
      const json = await res.json()
      if (!json.records) throw new Error("No records")

      const match = json.records.find((d: any) => {
        const name = (d.fields[FIRST_NAME_ID] || "").trim()
        return name === driverName
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

  const hasSelected = selectedRecords && selectedRecords.length > 0
  const [useSelectedOnly, setUseSelectedOnly] = React.useState(false)

  // בניית ההודעה — משותף לשליחה ולהעתקה
  const buildMessage = (): string | null => {
    if (!initialDriverName || !driverInfo) return null
    if (!useSelectedOnly && (!startDate || !endDate)) return null

    const settings = loadReportSettings(tenantId)

    let filteredRecords: any[]

    if (useSelectedOnly && hasSelected) {
      filteredRecords = [...selectedRecords!]
    } else {
      const startOfDay = new Date(startDate!)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(endDate!)
      endOfDay.setHours(23, 59, 59, 999)

      filteredRecords = allRecords.filter((record) => {
        const recordDate = record.fields[WS?.DATE || ""]
          ? new Date(record.fields[WS?.DATE || ""])
          : null
        if (!recordDate) return false
        const name = getDriverName(record, WS?.DRIVER || "")
        return name === initialDriverName && recordDate >= startOfDay && recordDate <= endOfDay
      })
    }

    if (filteredRecords.length === 0) return null

    filteredRecords.sort((a, b) => {
      const dateA = new Date(a.fields[WS?.DATE || ""] || 0)
      const dateB = new Date(b.fields[WS?.DATE || ""] || 0)
      if (dateA.getTime() !== dateB.getTime()) return dateA.getTime() - dateB.getTime()
      // Same date - sort by pickup time
      const timeA = a.fields[WS?.PICKUP_TIME || ""] || "99:99"
      const timeB = b.fields[WS?.PICKUP_TIME || ""] || "99:99"
      return timeA.localeCompare(timeB)
    })

    const isContractor = driverInfo.type === "קבלן"

    const companyPart = settings.companyName ? ` מחברת ${settings.companyName}` : ""
    let message = `לכבוד : ${initialDriverName} , מצ"ב סידור עבודה${companyPart}\n`

    let totalBeforeVat = 0
    let totalWithVat = 0

    filteredRecords.forEach((record) => {
      const fields = record.fields
      const recordDate = fields[WS?.DATE || ""] ? new Date(fields[WS?.DATE || ""]) : null
      const dateStr = recordDate ? format(recordDate, "d.M.yyyy") : ""
      const goTime = fields[WS?.PICKUP_TIME || ""] || "-"
      const route = fields[WS?.DESCRIPTION || ""] || "-"
      const returnTime = fields[WS?.DROPOFF_TIME || ""] || ""
      const vehicleType = getVehicleType(record, WS?.VEHICLE_TYPE || "")
      const priceBeforeVat = Number(fields[WS?.PRICE_DRIVER_EXCL || ""]) || 0
      const priceWithVat = Number(fields[WS?.PRICE_DRIVER_INCL || ""]) || 0

      totalBeforeVat += priceBeforeVat
      totalWithVat += priceWithVat

      message += `\n*תאריך* - ${dateStr}\n`

      // סוג רכב רק לקבלנים
      if (isContractor) {
        message += `*סוג רכב* - ${vehicleType}\n`
      }

      // שעת חזור רק אם קיימת
      if (returnTime) {
        message += `${goTime} ${route} ${returnTime}\n`
      } else {
        message += `${goTime} ${route}\n`
      }

      if (isContractor) {
        message += `מחיר לפני מע"מ - ${priceBeforeVat.toLocaleString("he-IL")} ₪\n`
        message += `מחיר כולל מע"מ - ${priceWithVat.toLocaleString("he-IL")} ₪\n`
      }

      const notes = fields[WS?.DRIVER_NOTES || ""] || ""
      if (notes) {
        message += `הערות: ${notes}\n`
      }
    })

    // סיכום
    message += `\n*סיכום*\n`
    message += `סה"כ נסיעות: ${filteredRecords.length}\n`

    if (isContractor) {
      message += `סה"כ לפני מע"מ: ${totalBeforeVat.toLocaleString("he-IL")} ₪\n`
      message += `סה"כ כולל מע"מ: ${totalWithVat.toLocaleString("he-IL")} ₪\n`
    }

    message += `\nנא לאשר קבלת סידור עבודה`

    return message
  }

  const handleSend = () => {
    if (!startDate || !endDate) {
      toast({ title: "שגיאה", description: "יש לבחור תאריכים", variant: "destructive" })
      return
    }
    if (startDate > endDate) {
      toast({ title: "שגיאה", description: "תאריך ההתחלה חייב להיות לפני תאריך הסיום", variant: "destructive" })
      return
    }
    if (!driverInfo?.phone) {
      toast({ title: "שגיאה", description: "אין מספר טלפון לנהג", variant: "destructive" })
      return
    }

    const message = buildMessage()
    if (!message) {
      toast({
        title: "אין נתונים",
        description: "לא נמצאו נסיעות עבור הנהג בטווח התאריכים שנבחר",
        variant: "destructive",
      })
      return
    }

    const phone = formatPhone(driverInfo.phone)
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    window.open(url, "_blank")
    onOpenChange(false)
  }

  const handleCopy = async () => {
    if (!startDate || !endDate) {
      toast({ title: "שגיאה", description: "יש לבחור תאריכים", variant: "destructive" })
      return
    }
    if (startDate > endDate) {
      toast({ title: "שגיאה", description: "תאריך ההתחלה חייב להיות לפני תאריך הסיום", variant: "destructive" })
      return
    }

    const message = buildMessage()
    if (!message) {
      toast({
        title: "אין נתונים",
        description: "לא נמצאו נסיעות עבור הנהג בטווח התאריכים שנבחר",
        variant: "destructive",
      })
      return
    }

    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      toast({ title: "הועתק", description: "ההודעה הועתקה. עבור לוואטסאפ ווב והדבק." })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast({ title: "שגיאה", description: "לא ניתן להעתיק", variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">שליחה בוואטסאפ</DialogTitle>
          <DialogDescription className="text-right">
            {useSelectedOnly ? "שלח נסיעות שנבחרו לנהג בוואטסאפ" : "שלח סידור עבודה לנהג בוואטסאפ"}
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
          {hasSelected && (
            <label className="flex items-center gap-2 cursor-pointer text-sm bg-blue-50 p-3 rounded-md border border-blue-200">
              <input
                type="checkbox"
                checked={useSelectedOnly}
                onChange={(e) => setUseSelectedOnly(e.target.checked)}
                className="rounded"
              />
              <span>רק נסיעות מסומנות ({selectedRecords!.length})</span>
            </label>
          )}

          {!useSelectedOnly && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>מתאריך:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className="w-full justify-start text-right">
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {startDate ? format(startDate, "EEEE '|' PPP", { locale: he }) : "בחר תאריך"}
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
                    {endDate ? format(endDate, "EEEE '|' PPP", { locale: he }) : "בחר תאריך"}
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
          )}
        </div>

        <DialogFooter className="flex-row-reverse gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button variant="outline" onClick={handleCopy} disabled={isLoading}>
            {copied ? <Check className="ml-2 h-4 w-4" /> : <Copy className="ml-2 h-4 w-4" />}
            {copied ? "הועתק!" : "העתק הודעה"}
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
