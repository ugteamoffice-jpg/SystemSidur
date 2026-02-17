"use client"

import * as React from "react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { Calendar as CalendarIcon, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useTenantFields } from "@/lib/tenant-context"

interface WorkScheduleRecord {
  id: string
  fields: { [key: string]: any }
}

type ReportType = "report-customer" | "report-driver" | "report-invoices" | "report-profit"

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reportType: ReportType
}

const renderLinkField = (value: any): string => {
  if (!value) return "-"
  if (Array.isArray(value) && value.length > 0) return value[0]?.title || "-"
  if (typeof value === "object" && value.title) return value.title
  return String(value)
}

const reportTitles: Record<ReportType, string> = {
  "report-customer": "דוח לקוח",
  "report-driver": "דוח נהג",
  "report-invoices": "דוח חשבוניות",
  "report-profit": "דוח רווח והפסד",
}

export function ReportDialog({ open, onOpenChange, reportType }: ReportDialogProps) {
  const tenantFields = useTenantFields()
  const WS = tenantFields?.workSchedule || ({} as any)

  const [allData, setAllData] = React.useState<WorkScheduleRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [hasSearched, setHasSearched] = React.useState(false)

  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const [startDate, setStartDate] = React.useState<Date | undefined>(firstOfMonth)
  const [endDate, setEndDate] = React.useState<Date | undefined>(today)
  const [startCalOpen, setStartCalOpen] = React.useState(false)
  const [endCalOpen, setEndCalOpen] = React.useState(false)
  const [filterName, setFilterName] = React.useState("")

  const filterLabel = reportType === "report-driver" ? "שם נהג" : "שם לקוח"

  // Reset when dialog opens
  React.useEffect(() => {
    if (open) {
      setAllData([])
      setHasSearched(false)
      setFilterName("")
      const t = new Date()
      setStartDate(new Date(t.getFullYear(), t.getMonth(), 1))
      setEndDate(t)
    }
  }, [open])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/work-schedule?take=5000&_t=${Date.now()}`)
      if (!response.ok) throw new Error("Failed to fetch")
      const json = await response.json()
      setAllData(json.records || [])
      setHasSearched(true)
    } catch (error) {
      console.error("Error fetching report data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredData = React.useMemo(() => {
    let filtered = allData

    if (startDate) {
      const startStr = format(startDate, "yyyy-MM-dd")
      filtered = filtered.filter((item) => {
        const d = (item.fields[WS.DATE] || "").substring(0, 10)
        return d >= startStr
      })
    }
    if (endDate) {
      const endStr = format(endDate, "yyyy-MM-dd")
      filtered = filtered.filter((item) => {
        const d = (item.fields[WS.DATE] || "").substring(0, 10)
        return d <= endStr
      })
    }

    if (filterName.trim()) {
      const search = filterName.trim().toLowerCase()
      if (reportType === "report-driver") {
        filtered = filtered.filter((item) =>
          renderLinkField(item.fields[WS.DRIVER]).toLowerCase().includes(search)
        )
      } else {
        filtered = filtered.filter((item) =>
          renderLinkField(item.fields[WS.CUSTOMER]).toLowerCase().includes(search)
        )
      }
    }

    filtered.sort((a, b) => {
      const da = (a.fields[WS.DATE] || "").substring(0, 10)
      const db = (b.fields[WS.DATE] || "").substring(0, 10)
      return da.localeCompare(db)
    })

    return filtered
  }, [allData, startDate, endDate, filterName, reportType, WS])

  const totals = React.useMemo(() => ({
    totalRows: filteredData.length,
    p1: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_CLIENT_EXCL]) || 0), 0),
    p2: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_CLIENT_INCL]) || 0), 0),
    p3: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_DRIVER_EXCL]) || 0), 0),
    p4: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_DRIVER_INCL]) || 0), 0),
    p5: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PROFIT]) || 0), 0),
    p6: filteredData.reduce((s, r) => s + ((Number(r.fields[WS.PRICE_CLIENT_INCL]) || 0) - (Number(r.fields[WS.PRICE_DRIVER_INCL]) || 0)), 0),
  }), [filteredData, WS])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh] flex flex-col p-0 gap-0" dir="rtl">
        <DialogHeader className="px-5 pt-4 pb-3 border-b flex-none">
          <DialogTitle className="text-xl">{reportTitles[reportType]}</DialogTitle>
          <DialogDescription className="sr-only">דוח מסונן לפי תאריכים</DialogDescription>
        </DialogHeader>

        {/* Filters bar */}
        <div className="px-5 py-3 border-b flex items-center gap-3 flex-wrap flex-none bg-muted/30">
          <Popover open={startCalOpen} onOpenChange={setStartCalOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[170px] justify-start text-right font-normal h-9">
                <CalendarIcon className="ml-2 h-4 w-4" />
                {startDate ? format(startDate, "dd/MM/yyyy") : "מתאריך"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); setStartCalOpen(false) }} locale={he} dir="rtl" initialFocus />
            </PopoverContent>
          </Popover>

          <Popover open={endCalOpen} onOpenChange={setEndCalOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[170px] justify-start text-right font-normal h-9">
                <CalendarIcon className="ml-2 h-4 w-4" />
                {endDate ? format(endDate, "dd/MM/yyyy") : "עד תאריך"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={endDate} onSelect={(d) => { setEndDate(d); setEndCalOpen(false) }} locale={he} dir="rtl" initialFocus />
            </PopoverContent>
          </Popover>

          {(reportType === "report-customer" || reportType === "report-driver") && (
            <div className="relative w-[200px]">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={filterLabel} value={filterName} onChange={(e) => setFilterName(e.target.value)} className="pr-9 h-9" />
            </div>
          )}

          <Button onClick={fetchData} disabled={isLoading} size="sm">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Search className="h-4 w-4 ml-2" />}
            הצג דוח
          </Button>

          {hasSearched && filteredData.length > 0 && (
            <>
              <div className="flex bg-card py-1.5 px-3 rounded-md border shadow-sm items-center whitespace-nowrap mr-auto">
                <span className="text-muted-foreground text-xs">סה"כ: <span className="font-bold text-foreground text-sm">{totals.totalRows}</span></span>
              </div>

              <div className="flex gap-3 text-xs bg-card py-1.5 px-3 rounded-md border shadow-sm items-center whitespace-nowrap">
                <span>לקוח+ מע"מ: <span className="font-bold">{totals.p1.toLocaleString()} ₪</span></span>
                <span className="text-border">|</span>
                <span>לקוח כולל: <span className="font-bold">{totals.p2.toLocaleString()} ₪</span></span>
                <span className="text-border">|</span>
                <span>נהג+ מע"מ: <span className="font-bold">{totals.p3.toLocaleString()} ₪</span></span>
                <span className="text-border">|</span>
                <span>נהג כולל: <span className="font-bold">{totals.p4.toLocaleString()} ₪</span></span>
                <span className="text-border">|</span>
                <span className="text-green-600 dark:text-green-400 font-medium">רווח: <span className="font-bold">{totals.p5.toLocaleString()} ₪</span></span>
                <span className="text-border">|</span>
                <span className="text-green-600 dark:text-green-400 font-medium">רווח כולל: <span className="font-bold">{totals.p6.toLocaleString()} ₪</span></span>
              </div>
            </>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto min-h-0">
          {!hasSearched && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>בחר טווח תאריכים ולחץ "הצג דוח"</p>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="mr-2 text-muted-foreground">טוען נתונים...</span>
            </div>
          )}

          {hasSearched && !isLoading && filteredData.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>לא נמצאו תוצאות</p>
            </div>
          )}

          {hasSearched && !isLoading && filteredData.length > 0 && (
            <Table style={{ tableLayout: "fixed" }}>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  <TableHead className="text-right pr-4 w-[95px]">תאריך</TableHead>
                  <TableHead className="text-right w-[130px]">שם לקוח</TableHead>
                  <TableHead className="text-right w-[80px]">התייצבות</TableHead>
                  <TableHead className="text-right w-[180px]">מסלול</TableHead>
                  <TableHead className="text-right w-[80px]">חזור</TableHead>
                  <TableHead className="text-right w-[95px]">סוג רכב</TableHead>
                  <TableHead className="text-right w-[110px]">שם נהג</TableHead>
                  <TableHead className="text-right w-[85px]">מספר רכב</TableHead>
                  <TableHead className="text-right w-[110px]">לקוח+ מע״מ</TableHead>
                  <TableHead className="text-right w-[120px]">לקוח כולל מע״מ</TableHead>
                  <TableHead className="text-right w-[100px]">נהג+ מע״מ</TableHead>
                  <TableHead className="text-right w-[120px]">נהג כולל מע״מ</TableHead>
                  <TableHead className="text-right w-[80px]">רווח</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-right pr-4 truncate">
                      {record.fields[WS.DATE] ? format(new Date(record.fields[WS.DATE]), "dd/MM/yyyy") : "-"}
                    </TableCell>
                    <TableCell className="text-right truncate">{renderLinkField(record.fields[WS.CUSTOMER])}</TableCell>
                    <TableCell className="text-right truncate">{record.fields[WS.PICKUP_TIME] || "-"}</TableCell>
                    <TableCell className="text-right truncate" title={record.fields[WS.DESCRIPTION]}>{record.fields[WS.DESCRIPTION] || "-"}</TableCell>
                    <TableCell className="text-right truncate">{record.fields[WS.DROPOFF_TIME] || "-"}</TableCell>
                    <TableCell className="text-right truncate">{renderLinkField(record.fields[WS.VEHICLE_TYPE])}</TableCell>
                    <TableCell className="text-right truncate">{renderLinkField(record.fields[WS.DRIVER])}</TableCell>
                    <TableCell className="text-right truncate">{record.fields[WS.VEHICLE_NUM] || "-"}</TableCell>
                    <TableCell className="text-right">{(Number(record.fields[WS.PRICE_CLIENT_EXCL]) || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{(Number(record.fields[WS.PRICE_CLIENT_INCL]) || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{(Number(record.fields[WS.PRICE_DRIVER_EXCL]) || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{(Number(record.fields[WS.PRICE_DRIVER_INCL]) || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-green-600 dark:text-green-400 font-medium">{(Number(record.fields[WS.PROFIT]) || 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
