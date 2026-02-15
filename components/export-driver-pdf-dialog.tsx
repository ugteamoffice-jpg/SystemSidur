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
import { Input } from "@/components/ui/input"
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

export function ExportDriverPdfDialog({
  open,
  onOpenChange,
  currentDate,
  allRecords,
  initialDriverName,
}: ExportDriverPdfDialogProps) {
  const { toast } = useToast()
  const [startDate, setStartDate] = React.useState<Date | undefined>(currentDate)
  const [startDateMonth, setStartDateMonth] = React.useState<Date>(currentDate)
  const [endDate, setEndDate] = React.useState<Date | undefined>(currentDate)
  const [endDateMonth, setEndDateMonth] = React.useState<Date>(currentDate)

  React.useEffect(() => {
    if (open) {
      setStartDate(currentDate)
      setEndDate(currentDate)
      setStartDateMonth(currentDate)
      setEndDateMonth(currentDate)
    }
  }, [open, currentDate])

  const generateReport = () => {
    if (!initialDriverName) return
    if (!startDate || !endDate) {
      toast({ title: "שגיאה", description: "יש לבחור תאריכים", variant: "destructive" })
      return
    }
    if (startDate > endDate) {
      toast({ title: "שגיאה", description: "תאריך ההתחלה חייב להיות לפני תאריך הסיום", variant: "destructive" })
      return
    }

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
      return driverName === initialDriverName && recordDate >= startOfDay && recordDate <= endOfDay
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

    let totalBeforeVat = 0
    let totalWithVat = 0
    filteredRecords.forEach((r) => {
      totalBeforeVat += Number(r.fields.fldSNuxbM8oJfrQ3a9x) || 0
      totalWithVat += Number(r.fields.fldyQIhjdUeQwtHMldD) || 0
    })
    const vat = totalWithVat - totalBeforeVat

    const tableRows = filteredRecords
      .map((record, index) => {
        const fields = record.fields
        const recordDate = fields.fldvNsQbfzMWTc7jakp ? new Date(fields.fldvNsQbfzMWTc7jakp) : null
        const dateStr = recordDate ? format(recordDate, "d.M.yyyy") : ""
        const goTime = fields.fldLbXMREYfC8XVIghj || "-"
        const route = fields.fldA6e7ul57abYgAZDh || "-"
        const returnTime = fields.fld56G8M1LyHRRROWiL || "-"
        const vehicleType = getVehicleType(record)
        const priceBeforeVat = Number(fields.fldSNuxbM8oJfrQ3a9x) || 0
        const priceWithVat = Number(fields.fldyQIhjdUeQwtHMldD) || 0
        const notes = fields.fldhNoiFEkEgrkxff02 || ""

        return `<tr>
          <td class="center">${index + 1}</td>
          <td class="center">${dateStr}</td>
          <td class="center">${goTime}</td>
          <td>${route}</td>
          <td class="center">${returnTime}</td>
          <td class="center">${vehicleType}</td>
          <td class="center">${priceBeforeVat.toLocaleString("he-IL")} ₪</td>
          <td class="center">${priceWithVat.toLocaleString("he-IL")} ₪</td>
          <td class="notes">${notes}</td>
        </tr>`
      })
      .join("")

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8"/>
  <title>דוח עבודה - ${initialDriverName}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 14mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      direction: rtl;
      color: #000;
      padding: 24px;
      font-size: 14px;
      line-height: 1.5;
    }

    /* --- כותרת --- */
    h1 {
      text-align: center;
      font-size: 26px;
      font-weight: 700;
      margin-bottom: 6px;
      letter-spacing: 0.5px;
    }

    /* --- שורת מידע --- */
    .info {
      text-align: center;
      font-size: 13px;
      color: #555;
      margin-bottom: 20px;
      padding-bottom: 14px;
      border-bottom: 2px solid #000;
    }
    .info span { margin: 0 12px; }

    /* --- טבלה --- */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    thead th {
      background: #f5f5f5;
      padding: 10px 8px;
      text-align: right;
      font-weight: 700;
      font-size: 13px;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      white-space: nowrap;
    }
    tbody td {
      padding: 8px;
      border-bottom: 1px solid #ddd;
      text-align: right;
      vertical-align: top;
    }
    tbody tr:last-child td {
      border-bottom: none;
    }
    td.center, th.center { text-align: center; }
    td.notes {
      font-size: 11px;
      color: #555;
      max-width: 150px;
      word-break: break-word;
    }

    /* --- שורת סיכום --- */
    .summary-row td {
      padding: 10px 8px;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
      font-weight: 700;
      font-size: 14px;
      background: #f9f9f9;
    }

    /* --- פוטר --- */
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 10px;
      color: #999;
    }

    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <h1>דוח עבודה לנהג ${initialDriverName}</h1>

  <div class="info">
    <span>תקופה: ${format(startDate, "d.M.yyyy")} — ${format(endDate, "d.M.yyyy")}</span>
    <span>|</span>
    <span>סה"כ נסיעות: ${filteredRecords.length}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width:40px">#</th>
        <th class="center">תאריך</th>
        <th class="center">הלוך</th>
        <th>מסלול</th>
        <th class="center">חזור</th>
        <th class="center">סוג רכב</th>
        <th class="center">לפני מע"מ</th>
        <th class="center">כולל מע"מ</th>
        <th>הערות</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      <tr class="summary-row">
        <td colspan="6" style="text-align:left;">סה"כ</td>
        <td class="center">${totalBeforeVat.toLocaleString("he-IL")} ₪</td>
        <td class="center">${totalWithVat.toLocaleString("he-IL")} ₪</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    תאריך הפקה: ${format(new Date(), "d.M.yyyy")}
  </div>

  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>`

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
          <DialogTitle className="text-right">ייצוא דוח נסיעות</DialogTitle>
          <DialogDescription className="text-right">
            בחר טווח תאריכים ליצירת דוח PDF
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* נהג נעול */}
          <div className="space-y-2">
            <Label className="text-right">נהג</Label>
            <Input value={initialDriverName || ""} disabled className="text-right bg-muted" />
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
          <Button onClick={generateReport}>
            <FileText className="ml-2 h-4 w-4" />
            צור דוח PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
