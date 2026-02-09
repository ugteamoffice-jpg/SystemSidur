"use client"

import * as React from "react"
import { Calendar as CalendarIcon, FileText } from "lucide-react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import jsPDF from "jspdf"

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
  driverName: string
  driverId: string
  currentDate: Date
  allRecords: any[]
}

export function ExportDriverPdfDialog({
  open,
  onOpenChange,
  driverName,
  driverId,
  currentDate,
  allRecords,
}: ExportDriverPdfDialogProps) {
  const { toast } = useToast()
  const [startDate, setStartDate] = React.useState<Date | undefined>(currentDate)
  const [startDateMonth, setStartDateMonth] = React.useState<Date>(currentDate)
  const [endDate, setEndDate] = React.useState<Date | undefined>(currentDate)
  const [endDateMonth, setEndDateMonth] = React.useState<Date>(currentDate)
  const [isGenerating, setIsGenerating] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setStartDate(currentDate)
      setEndDate(currentDate)
      setStartDateMonth(currentDate)
      setEndDateMonth(currentDate)
    }
  }, [open, currentDate])

  const generatePDF = async () => {
    if (!startDate || !endDate) {
      toast({ title: "שגיאה", description: "יש לבחור תאריכים", variant: "destructive" })
      return
    }

    if (startDate > endDate) {
      toast({ title: "שגיאה", description: "תאריך ההתחלה חייב להיות לפני תאריך הסיום", variant: "destructive" })
      return
    }

    setIsGenerating(true)

    try {
      // סינון הנסיעות של הנהג בטווח התאריכים
      const filteredRecords = allRecords.filter(record => {
        const recordDate = record.fields.fldvNsQbfzMWTc7jakp ? new Date(record.fields.fldvNsQbfzMWTc7jakp) : null
        if (!recordDate) return false

        const driver = record.fields.flddNPbrzOCdgS36kx5
        const recordDriverName = Array.isArray(driver) && driver.length > 0 ? driver[0]?.title : (typeof driver === 'object' ? driver?.title : String(driver || ""))
        
        return recordDriverName === driverName && 
               recordDate >= startDate && 
               recordDate <= endDate
      })

      if (filteredRecords.length === 0) {
        toast({ title: "אין נתונים", description: "לא נמצאו נסיעות עבור הנהג בטווח התאריכים שנבחר", variant: "destructive" })
        setIsGenerating(false)
        return
      }

      // מיון לפי תאריך
      filteredRecords.sort((a, b) => {
        const dateA = new Date(a.fields.fldvNsQbfzMWTc7jakp || 0)
        const dateB = new Date(b.fields.fldvNsQbfzMWTc7jakp || 0)
        return dateA.getTime() - dateB.getTime()
      })

      // יצירת PDF
      const doc = new jsPDF()
      
      // הגדרת גופן שתומך בעברית
      doc.setFont("helvetica")
      doc.setLanguage("he")
      
      let yPosition = 20
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 20
      const lineHeight = 7

      // כותרת
      doc.setFontSize(18)
      doc.text("סידור עבודה לנהג", pageWidth / 2, yPosition, { align: "center" })
      yPosition += 15

      // קו מפריד
      doc.setLineWidth(0.5)
      doc.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      // פרטי הנהג והתקופה
      doc.setFontSize(12)
      doc.text(`נהג: ${driverName}`, pageWidth - margin, yPosition, { align: "right" })
      yPosition += lineHeight
      doc.text(`תקופה: ${format(startDate, "d.M.yyyy")} - ${format(endDate, "d.M.yyyy")}`, pageWidth - margin, yPosition, { align: "right" })
      yPosition += lineHeight
      doc.text(`תאריך הפקה: ${format(new Date(), "d.M.yyyy")}`, pageWidth - margin, yPosition, { align: "right" })
      yPosition += 15

      // חישוב סיכומים
      let totalBeforeVat = 0
      let totalWithVat = 0

      // מעבר על כל הנסיעות
      for (let i = 0; i < filteredRecords.length; i++) {
        const record = filteredRecords[i]
        const fields = record.fields

        // בדיקה אם צריך עמוד חדש
        if (yPosition > 250) {
          doc.addPage()
          yPosition = 20
        }

        // קו מפריד
        doc.setLineWidth(0.3)
        doc.line(margin, yPosition, pageWidth - margin, yPosition)
        yPosition += 8

        // תאריך
        const recordDate = fields.fldvNsQbfzMWTc7jakp ? new Date(fields.fldvNsQbfzMWTc7jakp) : null
        if (recordDate) {
          const dayName = format(recordDate, "EEEE", { locale: he })
          const dateStr = format(recordDate, "d.M.yyyy", { locale: he })
          doc.setFontSize(14)
          doc.setFont("helvetica", "bold")
          doc.text(`${dayName}, ${dateStr}`, pageWidth - margin, yPosition, { align: "right" })
          yPosition += 8
        }

        doc.setFont("helvetica", "normal")
        doc.setFontSize(11)

        // שעה
        if (fields.fldLbXMREYfC8XVIghj) {
          doc.text(`שעה: ${fields.fldLbXMREYfC8XVIghj}`, pageWidth - margin, yPosition, { align: "right" })
          yPosition += lineHeight
        }

        // לקוח
        const customer = fields.fldVy6L2DCboXUTkjBX
        const customerName = Array.isArray(customer) && customer.length > 0 ? customer[0]?.title : (typeof customer === 'object' ? customer?.title : String(customer || "-"))
        doc.text(`לקוח: ${customerName}`, pageWidth - margin, yPosition, { align: "right" })
        yPosition += lineHeight

        // מסלול
        if (fields.fldA6e7ul57abYgAZDh) {
          doc.text(`מסלול: ${fields.fldA6e7ul57abYgAZDh}`, pageWidth - margin, yPosition, { align: "right" })
          yPosition += lineHeight
        }

        // חזור
        const returnTime = fields.fld56G8M1LyHRRROWiL || "-"
        doc.text(`חזור: ${returnTime}`, pageWidth - margin, yPosition, { align: "right" })
        yPosition += lineHeight

        // סוג רכב
        const vehicleType = fields.fldx4hl8FwbxfkqXf0B
        const vehicleTypeName = Array.isArray(vehicleType) && vehicleType.length > 0 ? vehicleType[0]?.title : (typeof vehicleType === 'object' ? vehicleType?.title : String(vehicleType || "-"))
        doc.text(`סוג רכב: ${vehicleTypeName}`, pageWidth - margin, yPosition, { align: "right" })
        yPosition += lineHeight + 2

        // מחירים
        const priceBeforeVat = Number(fields.fldSNuxbM8oJfrQ3a9x) || 0
        const priceWithVat = Number(fields.fldyQIhjdUeQwtHMldD) || 0
        
        totalBeforeVat += priceBeforeVat
        totalWithVat += priceWithVat

        doc.text(`מחיר נהג (לפני מע"מ): ${priceBeforeVat.toLocaleString()} ₪`, pageWidth - margin, yPosition, { align: "right" })
        yPosition += lineHeight
        doc.text(`מחיר נהג (כולל מע"מ): ${priceWithVat.toLocaleString()} ₪`, pageWidth - margin, yPosition, { align: "right" })
        yPosition += lineHeight + 2

        // הערות
        if (fields.fldhNoiFEkEgrkxff02) {
          doc.text(`הערות: ${fields.fldhNoiFEkEgrkxff02}`, pageWidth - margin, yPosition, { align: "right" })
          yPosition += lineHeight
        }

        yPosition += 5
      }

      // סיכום כספי
      yPosition += 10
      if (yPosition > 230) {
        doc.addPage()
        yPosition = 20
      }

      doc.setLineWidth(0.5)
      doc.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 10

      doc.setFontSize(14)
      doc.setFont("helvetica", "bold")
      doc.text("סיכום כספי", pageWidth / 2, yPosition, { align: "center" })
      yPosition += 10

      doc.setLineWidth(0.3)
      doc.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 8

      doc.setFontSize(12)
      doc.setFont("helvetica", "normal")
      
      const vat = totalWithVat - totalBeforeVat
      const vatPercentage = totalBeforeVat > 0 ? ((vat / totalBeforeVat) * 100).toFixed(0) : "0"

      doc.text(`סה"כ לפני מע"מ:`, pageWidth - margin - 80, yPosition, { align: "right" })
      doc.text(`${totalBeforeVat.toLocaleString()} ₪`, margin + 40, yPosition, { align: "left" })
      yPosition += lineHeight

      doc.text(`מע"מ (${vatPercentage}%):`, pageWidth - margin - 80, yPosition, { align: "right" })
      doc.text(`${vat.toLocaleString()} ₪`, margin + 40, yPosition, { align: "left" })
      yPosition += lineHeight

      doc.setLineWidth(0.3)
      doc.line(pageWidth - margin - 80, yPosition, margin + 80, yPosition)
      yPosition += 5

      doc.setFont("helvetica", "bold")
      doc.text(`סה"כ כולל מע"מ:`, pageWidth - margin - 80, yPosition, { align: "right" })
      doc.text(`${totalWithVat.toLocaleString()} ₪`, margin + 40, yPosition, { align: "left" })
      yPosition += 12

      doc.setLineWidth(0.5)
      doc.line(margin, yPosition, pageWidth - margin, yPosition)
      yPosition += 8

      doc.setFont("helvetica", "normal")
      doc.setFontSize(11)
      doc.text(`סה"כ נסיעות: ${filteredRecords.length}`, pageWidth - margin, yPosition, { align: "right" })

      // שמירת הקובץ
      const fileName = `דוח_נהג_${driverName}_${format(startDate, "d.M.yyyy")}-${format(endDate, "d.M.yyyy")}.pdf`
      doc.save(fileName)

      toast({ title: "הצלחה", description: "הדוח נוצר בהצלחה!" })
      onOpenChange(false)
    } catch (error) {
      console.error("Error generating PDF:", error)
      toast({ title: "שגיאה", description: "לא הצלחנו ליצור את הדוח", variant: "destructive" })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">ייצוא דוח לנהג</DialogTitle>
          <DialogDescription className="text-right">
            בחר טווח תאריכים ליצירת דוח PDF
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-right">נהג</Label>
            <Input value={driverName} disabled className="text-right bg-muted" />
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            ביטול
          </Button>
          <Button onClick={generatePDF} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <FileText className="ml-2 h-4 w-4 animate-pulse" />
                יוצר דוח...
              </>
            ) : (
              <>
                <FileText className="ml-2 h-4 w-4" />
                צור PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
