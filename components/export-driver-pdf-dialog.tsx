"use client"

import * as React from "react"
import { Calendar as CalendarIcon, FileText } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"

interface ExportDriverPdfDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentDate: Date
  allRecords: any[]
  initialDriverName?: string
}

// פונקציה לחילוץ שם נהג מ-record
function getDriverName(record: any): string {
  const driver = record.fields.flddNPbrzOCdgS36kx5
  if (Array.isArray(driver) && driver.length > 0) return driver[0]?.title || ""
  if (typeof driver === "object" && driver?.title) return driver.title
  return String(driver || "")
}

// פונקציה לחילוץ שם לקוח מ-record
function getCustomerName(record: any): string {
  const customer = record.fields.fldVy6L2DCboXUTkjBX
  if (Array.isArray(customer) && customer.length > 0) return customer[0]?.title || "-"
  if (typeof customer === "object" && customer?.title) return customer.title
  return String(customer || "-")
}

// פונקציה לחילוץ סוג רכב מ-record
function getVehicleType(record: any): string {
  const vt = record.fields.fldx4hl8FwbxfkqXf0B
  if (Array.isArray(vt) && vt.length > 0) return vt[0]?.title || "-"
  if (typeof vt === "object" && vt?.title) return vt.title
  return String(vt || "-")
}

// יום בשבוע בעברית
const hebrewDays: Record<string, string> = {
  Sunday: "יום ראשון",
  Monday: "יום שני",
  Tuesday: "יום שלישי",
  Wednesday: "יום רביעי",
  Thursday: "יום חמישי",
  Friday: "יום שישי",
  Saturday: "יום שבת",
}

function getHebrewDay(date: Date): string {
  const eng = format(date, "EEEE")
  return hebrewDays[eng] || eng
}

export function ExportDriverPdfDialog({
  open,
  onOpenChange,
  currentDate,
  allRecords,
  initialDriverName,
}: ExportDriverPdfDialogProps) {
  const { toast } = useToast()
  const [selectedDriver, setSelectedDriver] = React.useState<string>("")
  const [startDate, setStartDate] = React.useState<Date | undefined>(currentDate)
  const [startDateMonth, setStartDateMonth] = React.useState<Date>(currentDate)
  const [endDate, setEndDate] = React.useState<Date | undefined>(currentDate)
  const [endDateMonth, setEndDateMonth] = React.useState<Date>(currentDate)

  // חישוב רשימת נהגים ייחודיים מכל הרשומות
  const driverNames = React.useMemo(() => {
    const names = new Set<string>()
    allRecords.forEach((record) => {
      const name = getDriverName(record)
      if (name) names.add(name)
    })
    return Array.from(names).sort((a, b) => a.localeCompare(b, "he"))
  }, [allRecords])

  React.useEffect(() => {
    if (open) {
      setStartDate(currentDate)
      setEndDate(currentDate)
      setStartDateMonth(currentDate)
      setEndDateMonth(currentDate)
      setSelectedDriver(initialDriverName || "")
    }
  }, [open, currentDate, initialDriverName])

  const generateReport = () => {
    if (!selectedDriver) {
      toast({ title: "שגיאה", description: "יש לבחור נהג", variant: "destructive" })
      return
    }
    if (!startDate || !endDate) {
      toast({ title: "שגיאה", description: "יש לבחור תאריכים", variant: "destructive" })
      return
    }
    if (startDate > endDate) {
      toast({ title: "שגיאה", description: "תאריך ההתחלה חייב להיות לפני תאריך הסיום", variant: "destructive" })
      return
    }

    // סינון הנסיעות של הנהג בטווח התאריכים
    const startOfDay = new Date(startDate)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(endDate)
    endOfDay.setHours(23, 59, 59, 999)

    const filteredRecords = allRecords.filter((record) => {
      const recordDate = record.fields.fldvNsQbfzMWTc7jakp
        ? new Date(record.fields.fldvNsQbfzMWTc7jakp)
        : null
      if (!recordDate) return false
      const driverName = getDriverName(record)
      return driverName === selectedDriver && recordDate >= startOfDay && recordDate <= endOfDay
    })

    if (filteredRecords.length === 0) {
      toast({
        title: "אין נתונים",
        description: "לא נמצאו נסיעות עבור הנהג בטווח התאריכים שנבחר",
        variant: "destructive",
      })
      return
    }

    // מיון לפי תאריך ושעה
    filteredRecords.sort((a, b) => {
      const dateA = new Date(a.fields.fldvNsQbfzMWTc7jakp || 0)
      const dateB = new Date(b.fields.fldvNsQbfzMWTc7jakp || 0)
      return dateA.getTime() - dateB.getTime()
    })

    // חישוב סיכומים
    let totalBeforeVat = 0
    let totalWithVat = 0
    filteredRecords.forEach((r) => {
      totalBeforeVat += Number(r.fields.fldSNuxbM8oJfrQ3a9x) || 0
      totalWithVat += Number(r.fields.fldyQIhjdUeQwtHMldD) || 0
    })
    const vat = totalWithVat - totalBeforeVat
    const vatPercentage = totalBeforeVat > 0 ? ((vat / totalBeforeVat) * 100).toFixed(0) : "0"

    // בניית שורות טבלה
    const tableRows = filteredRecords
      .map((record) => {
        const fields = record.fields
        const recordDate = fields.fldvNsQbfzMWTc7jakp ? new Date(fields.fldvNsQbfzMWTc7jakp) : null
        const dayName = recordDate ? getHebrewDay(recordDate) : ""
        const dateStr = recordDate ? format(recordDate, "d.M.yyyy") : ""
        const time = fields.fldLbXMREYfC8XVIghj || "-"
        const customer = getCustomerName(record)
        const route = fields.fldA6e7ul57abYgAZDh || "-"
        const returnTime = fields.fld56G8M1LyHRRROWiL || "-"
        const vehicleType = getVehicleType(record)
        const priceBeforeVat = Number(fields.fldSNuxbM8oJfrQ3a9x) || 0
        const priceWithVat = Number(fields.fldyQIhjdUeQwtHMldD) || 0
        const notes = fields.fldhNoiFEkEgrkxff02 || ""

        return `<tr>
          <td>${dayName}<br/><strong>${dateStr}</strong></td>
          <td>${time}</td>
          <td>${customer}</td>
          <td>${route}</td>
          <td>${returnTime}</td>
          <td>${vehicleType}</td>
          <td>${priceBeforeVat.toLocaleString("he-IL")}</td>
          <td>${priceWithVat.toLocaleString("he-IL")}</td>
          <td class="notes-cell">${notes}</td>
        </tr>`
      })
      .join("")

    // בניית ה-HTML המלא
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8"/>
  <title>דוח נסיעות - ${selectedDriver}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      direction: rtl;
      color: #1a1a1a;
      padding: 20px;
      font-size: 12px;
      line-height: 1.4;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header-right h1 {
      font-size: 22px;
      color: #2563eb;
      margin-bottom: 4px;
    }
    .header-right .subtitle {
      font-size: 13px;
      color: #64748b;
    }
    .header-left {
      text-align: left;
      font-size: 11px;
      color: #64748b;
    }

    .info-bar {
      display: flex;
      gap: 24px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 16px;
      margin-bottom: 16px;
      font-size: 12px;
    }
    .info-bar .info-item strong { color: #334155; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 11px;
    }
    thead th {
      background: #2563eb;
      color: white;
      padding: 8px 6px;
      text-align: right;
      font-weight: 600;
      font-size: 11px;
      white-space: nowrap;
    }
    tbody td {
      padding: 6px;
      border-bottom: 1px solid #e2e8f0;
      text-align: right;
      vertical-align: top;
    }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody tr:hover { background: #eff6ff; }
    .notes-cell {
      font-size: 10px;
      color: #64748b;
      max-width: 140px;
      word-break: break-word;
    }

    .summary-section {
      page-break-inside: avoid;
      border: 2px solid #2563eb;
      border-radius: 8px;
      overflow: hidden;
    }
    .summary-header {
      background: #2563eb;
      color: white;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 700;
    }
    .summary-body {
      display: flex;
      justify-content: space-around;
      padding: 16px;
      background: #eff6ff;
    }
    .summary-item {
      text-align: center;
    }
    .summary-item .label {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 4px;
    }
    .summary-item .value {
      font-size: 18px;
      font-weight: 700;
      color: #1e40af;
    }
    .summary-item .currency { font-size: 13px; }

    .footer {
      margin-top: 16px;
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }

    @media print {
      body { padding: 0; }
      tbody tr:hover { background: inherit; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-right">
      <h1>דוח נסיעות לנהג</h1>
      <div class="subtitle">${selectedDriver}</div>
    </div>
    <div class="header-left">
      תאריך הפקה: ${format(new Date(), "d.M.yyyy")}
    </div>
  </div>

  <div class="info-bar">
    <div class="info-item"><strong>נהג:</strong> ${selectedDriver}</div>
    <div class="info-item"><strong>תקופה:</strong> ${format(startDate, "d.M.yyyy")} — ${format(endDate, "d.M.yyyy")}</div>
    <div class="info-item"><strong>סה"כ נסיעות:</strong> ${filteredRecords.length}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>תאריך</th>
        <th>שעה</th>
        <th>לקוח</th>
        <th>מסלול</th>
        <th>חזור</th>
        <th>סוג רכב</th>
        <th>מחיר נהג<br/>+ מע"מ</th>
        <th>מחיר נהג<br/>כולל מע"מ</th>
        <th>הערות</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="summary-section">
    <div class="summary-header">סיכום כספי</div>
    <div class="summary-body">
      <div class="summary-item">
        <div class="label">סה"כ לפני מע"מ</div>
        <div class="value">${totalBeforeVat.toLocaleString("he-IL")} <span class="currency">₪</span></div>
      </div>
      <div class="summary-item">
        <div class="label">מע"מ (${vatPercentage}%)</div>
        <div class="value">${vat.toLocaleString("he-IL")} <span class="currency">₪</span></div>
      </div>
      <div class="summary-item">
        <div class="label">סה"כ כולל מע"מ</div>
        <div class="value">${totalWithVat.toLocaleString("he-IL")} <span class="currency">₪</span></div>
      </div>
      <div class="summary-item">
        <div class="label">מספר נסיעות</div>
        <div class="value">${filteredRecords.length}</div>
      </div>
    </div>
  </div>

  <div class="footer">
    דוח זה הופק אוטומטית ממערכת סידור העבודה
  </div>

  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>`

    // פתיחת חלון חדש עם הדוח
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
    } else {
      toast({
        title: "שגיאה",
        description: "הדפדפן חסם פתיחת חלון חדש. יש לאשר חלונות קופצים עבור אתר זה.",
        variant: "destructive",
      })
    }

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">ייצוא דוח נסיעות לנהג</DialogTitle>
          <DialogDescription className="text-right">
            בחר נהג וטווח תאריכים ליצירת דוח PDF
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* בחירת נהג */}
          <div className="space-y-2">
            <Label className="text-right">נהג</Label>
            <Select value={selectedDriver} onValueChange={setSelectedDriver}>
              <SelectTrigger className="text-right">
                <SelectValue placeholder="בחר נהג..." />
              </SelectTrigger>
              <SelectContent>
                {driverNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
          <Button onClick={generateReport} disabled={!selectedDriver}>
            <FileText className="ml-2 h-4 w-4" />
            צור דוח PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
