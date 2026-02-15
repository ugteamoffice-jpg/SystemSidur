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
import { loadReportSettings, type ReportSettings } from "@/components/report-settings-dialog"

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

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
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

    // טעינת הגדרות חברה
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

    const tableRows = filteredRecords
      .map((record, index) => {
        const fields = record.fields
        const recordDate = fields.fldvNsQbfzMWTc7jakp ? new Date(fields.fldvNsQbfzMWTc7jakp) : null
        const dateStr = recordDate ? format(recordDate, "d.M.yyyy") : ""
        const goTime = fields.fldLbXMREYfC8XVIghj || "-"
        const route = escapeHtml(fields.fldA6e7ul57abYgAZDh || "-")
        const returnTime = fields.fld56G8M1LyHRRROWiL || "-"
        const vehicleType = escapeHtml(getVehicleType(record))
        const priceBeforeVat = Number(fields.fldSNuxbM8oJfrQ3a9x) || 0
        const priceWithVat = Number(fields.fldyQIhjdUeQwtHMldD) || 0
        const notes = escapeHtml(fields.fldhNoiFEkEgrkxff02 || "")

        return `<tr>
          <td class="c">${index + 1}</td>
          <td class="c">${dateStr}</td>
          <td class="c">${goTime}</td>
          <td>${route}</td>
          <td class="c">${returnTime}</td>
          <td class="c">${vehicleType}</td>
          <td class="c">${priceBeforeVat.toLocaleString("he-IL")} ₪</td>
          <td class="c">${priceWithVat.toLocaleString("he-IL")} ₪</td>
          <td class="notes">${notes}</td>
        </tr>`
      })
      .join("")

    // --- בניית חלקי ה-HTML ---

    // Header: לוגו + שם חברה (אם קיימים)
    const hasCompanyInfo = settings.companyName || settings.logoBase64
    const logoHtml = settings.logoBase64
      ? `<img src="${settings.logoBase64}" class="logo" alt="לוגו"/>`
      : ""
    const companyNameHtml = settings.companyName
      ? `<div class="company-name">${escapeHtml(settings.companyName)}</div>`
      : ""

    const headerSection = hasCompanyInfo
      ? `<div class="company-header">
          ${logoHtml}
          ${companyNameHtml}
        </div>`
      : ""

    // Footer: פרטי חברה + טקסט חופשי
    const footerParts: string[] = []
    if (settings.address) footerParts.push(escapeHtml(settings.address))
    if (settings.phone) footerParts.push(`טלפון: ${escapeHtml(settings.phone)}`)
    if (settings.email) footerParts.push(escapeHtml(settings.email))
    
    const footerLine1 = footerParts.length > 0
      ? `<div class="footer-info">${footerParts.join("  |  ")}</div>`
      : ""
    const footerLine2 = settings.footerText
      ? `<div class="footer-custom">${escapeHtml(settings.footerText)}</div>`
      : ""
    const footerDate = `<div class="footer-date">תאריך הפקה: ${format(new Date(), "d.M.yyyy")}</div>`

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8"/>
  <title>דוח עבודה - ${escapeHtml(initialDriverName)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 12mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      direction: rtl;
      color: #1a1a1a;
      padding: 20px;
      font-size: 13px;
      line-height: 1.5;
    }

    /* --- חברה --- */
    .company-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .logo {
      height: 50px;
      width: auto;
      max-width: 160px;
      object-fit: contain;
    }
    .company-name {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    /* --- כותרת דוח --- */
    h1 {
      text-align: center;
      font-size: 24px;
      font-weight: 700;
      margin: 10px 0 4px 0;
    }
    .info-line {
      text-align: center;
      font-size: 12px;
      color: #666;
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1.5px solid #333;
    }
    .info-line span + span::before {
      content: " | ";
      margin: 0 8px;
    }

    /* --- טבלה --- */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    thead th {
      background: #f0f0f0;
      padding: 9px 7px;
      text-align: right;
      font-weight: 700;
      font-size: 12px;
      border-top: 2px solid #333;
      border-bottom: 2px solid #333;
      white-space: nowrap;
    }
    thead th.c { text-align: center; }
    tbody td {
      padding: 7px;
      border-bottom: 1px solid #e0e0e0;
      vertical-align: top;
    }
    td.c { text-align: center; }
    td.notes {
      font-size: 11px;
      color: #666;
      max-width: 140px;
      word-break: break-word;
    }
    tbody tr:nth-child(even) { background: #fafafa; }

    /* --- שורת סיכום --- */
    tr.total td {
      padding: 9px 7px;
      border-top: 2px solid #333;
      border-bottom: 2px solid #333;
      font-weight: 700;
      font-size: 13px;
      background: #f5f5f5;
    }

    /* --- פוטר --- */
    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #ccc;
      text-align: center;
      font-size: 10.5px;
      color: #888;
    }
    .footer-info { margin-bottom: 2px; }
    .footer-custom { margin-bottom: 2px; }
    .footer-date { margin-top: 4px; font-size: 10px; color: #aaa; }

    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>

  ${headerSection}

  <h1>דוח עבודה לנהג ${escapeHtml(initialDriverName)}</h1>

  <div class="info-line">
    <span>תקופה: ${format(startDate, "d.M.yyyy")} — ${format(endDate, "d.M.yyyy")}</span>
    <span>סה"כ נסיעות: ${filteredRecords.length}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th class="c" style="width:36px">#</th>
        <th class="c">תאריך</th>
        <th class="c">הלוך</th>
        <th>מסלול</th>
        <th class="c">חזור</th>
        <th class="c">סוג רכב</th>
        <th class="c">לפני מע"מ</th>
        <th class="c">כולל מע"מ</th>
        <th>הערות</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      <tr class="total">
        <td colspan="6" style="text-align:left; font-size:13px;">סה"כ</td>
        <td class="c">${totalBeforeVat.toLocaleString("he-IL")} ₪</td>
        <td class="c">${totalWithVat.toLocaleString("he-IL")} ₪</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <div class="footer">
    ${footerLine1}
    ${footerLine2}
    ${footerDate}
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
          <div className="space-y-2">
            <Label className="text-right">נהג</Label>
            <Input value={initialDriverName || ""} disabled className="text-right bg-muted" />
          </div>

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
