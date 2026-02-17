"use client"

import * as React from "react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { Calendar as CalendarIcon, Loader2, Search, X } from "lucide-react"
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

  const [filteredData, setFilteredData] = React.useState<WorkScheduleRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [showResults, setShowResults] = React.useState(false)

  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const [startDate, setStartDate] = React.useState<Date | undefined>(firstOfMonth)
  const [endDate, setEndDate] = React.useState<Date | undefined>(today)
  const [startCalOpen, setStartCalOpen] = React.useState(false)
  const [endCalOpen, setEndCalOpen] = React.useState(false)
  const [filterName, setFilterName] = React.useState("")

  const [nameOptions, setNameOptions] = React.useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const suggestionsRef = React.useRef<HTMLDivElement>(null)

  const filterLabel = reportType === "report-driver" ? "שם נהג" : "שם לקוח"
  const showNameFilter = reportType === "report-customer" || reportType === "report-driver"

  // Close suggestions on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Fetch names for autocomplete
  React.useEffect(() => {
    if (!open || !showNameFilter) return
    const fetchNames = async () => {
      try {
        const endpoint = reportType === "report-driver" ? "/api/drivers?take=500" : "/api/customers?take=500"
        const res = await fetch(endpoint)
        if (!res.ok) return
        const data = await res.json()
        const records = data.records || []
        const names: string[] = []
        records.forEach((r: any) => {
          if (reportType === "report-driver") {
            const first = r.fields?.[tenantFields?.drivers?.FIRST_NAME] || ""
            const last = r.fields?.[tenantFields?.drivers?.LAST_NAME] || ""
            const name = `${first} ${last}`.trim()
            if (name) names.push(name)
          } else {
            const name = r.fields?.[tenantFields?.customers?.NAME] || ""
            if (name) names.push(name)
          }
        })
        setNameOptions([...new Set(names)])
      } catch (e) {
        console.error("Error fetching names:", e)
      }
    }
    fetchNames()
  }, [open, reportType, tenantFields, showNameFilter])

  // Reset on open
  React.useEffect(() => {
    if (open) {
      setFilteredData([])
      setShowResults(false)
      setFilterName("")
      setShowSuggestions(false)
      const t = new Date()
      setStartDate(new Date(t.getFullYear(), t.getMonth(), 1))
      setEndDate(t)
    }
  }, [open])

  const filteredSuggestions = React.useMemo(() => {
    if (!filterName.trim()) return nameOptions.slice(0, 15)
    return nameOptions.filter(n => n.toLowerCase().includes(filterName.toLowerCase())).slice(0, 15)
  }, [nameOptions, filterName])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({ take: "2000" })
      if (startDate) params.set("startDate", format(startDate, "yyyy-MM-dd"))
      if (endDate) params.set("endDate", format(endDate, "yyyy-MM-dd"))

      const response = await fetch(`/api/work-schedule?${params.toString()}&_t=${Date.now()}`)
      if (!response.ok) throw new Error("Failed to fetch")
      const json = await response.json()
      let records: WorkScheduleRecord[] = json.records || []

      // Client-side name filter
      if (filterName.trim()) {
        const search = filterName.trim().toLowerCase()
        if (reportType === "report-driver") {
          records = records.filter((r) =>
            renderLinkField(r.fields[WS.DRIVER]).toLowerCase().includes(search)
          )
        } else if (reportType === "report-customer") {
          records = records.filter((r) =>
            renderLinkField(r.fields[WS.CUSTOMER]).toLowerCase().includes(search)
          )
        }
      }

      records.sort((a, b) => {
        const da = (a.fields[WS.DATE] || "").substring(0, 10)
        const db = (b.fields[WS.DATE] || "").substring(0, 10)
        return da.localeCompare(db)
      })

      setFilteredData(records)
      setShowResults(true)
    } catch (error) {
      console.error("Error fetching report data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const totals = React.useMemo(() => ({
    totalRows: filteredData.length,
    p1: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_CLIENT_EXCL]) || 0), 0),
    p2: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_CLIENT_INCL]) || 0), 0),
    p3: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_DRIVER_EXCL]) || 0), 0),
    p4: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_DRIVER_INCL]) || 0), 0),
    p5: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PROFIT]) || 0), 0),
    p6: filteredData.reduce((s, r) => s + ((Number(r.fields[WS.PRICE_CLIENT_INCL]) || 0) - (Number(r.fields[WS.PRICE_DRIVER_INCL]) || 0)), 0),
  }), [filteredData, WS])

  // --- Step 1: Small filter dialog ---
  if (!showResults) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[420px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>{reportTitles[reportType]}</DialogTitle>
            <DialogDescription>בחר פרמטרים לדוח</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex items-center gap-3">
              <Popover open={startCalOpen} onOpenChange={setStartCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start text-right font-normal h-10">
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : "מתאריך"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); setStartCalOpen(false) }} locale={he} dir="rtl" initialFocus />
                </PopoverContent>
              </Popover>

              <span className="text-muted-foreground text-sm">עד</span>

              <Popover open={endCalOpen} onOpenChange={setEndCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 justify-start text-right font-normal h-10">
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : "עד תאריך"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={endDate} onSelect={(d) => { setEndDate(d); setEndCalOpen(false) }} locale={he} dir="rtl" initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            {showNameFilter && (
              <div className="relative" ref={suggestionsRef}>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={filterLabel}
                    value={filterName}
                    onChange={(e) => { setFilterName(e.target.value); setShowSuggestions(true) }}
                    onFocus={() => setShowSuggestions(true)}
                    className="pr-9 h-10"
                  />
                  {filterName && (
                    <button className="absolute left-3 top-1/2 transform -translate-y-1/2" onClick={() => { setFilterName(""); setShowSuggestions(false) }}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 max-h-[200px] overflow-auto bg-popover border rounded-md shadow-md">
                    {filteredSuggestions.map((name, i) => (
                      <button
                        key={i}
                        className="w-full text-right px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                        onClick={() => { setFilterName(name); setShowSuggestions(false) }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Button onClick={fetchData} disabled={isLoading} className="h-10">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Search className="h-4 w-4 ml-2" />}
              הצג דוח
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // --- Step 2: Full results dialog ---
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[85vh] flex flex-col p-0 gap-0" dir="rtl">
        <DialogHeader className="px-5 pt-3 pb-2 border-b flex-none">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">{reportTitles[reportType]}</DialogTitle>
            <Button variant="outline" size="sm" onClick={() => setShowResults(false)}>שינוי סינון</Button>
          </div>
          <DialogDescription className="sr-only">תוצאות דוח</DialogDescription>
        </DialogHeader>

        <div className="px-5 py-2 border-b flex items-center gap-3 flex-wrap flex-none bg-muted/30 text-xs">
          <span className="text-muted-foreground">
            {startDate && format(startDate, "dd/MM/yyyy")} - {endDate && format(endDate, "dd/MM/yyyy")}
            {filterName && ` | ${filterLabel}: ${filterName}`}
          </span>
          <span className="text-muted-foreground mr-auto">סה"כ: <span className="font-bold text-foreground text-sm">{totals.totalRows}</span></span>
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

        <div className="flex-1 overflow-auto min-h-0">
          {filteredData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">לא נמצאו תוצאות</div>
          ) : (
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
                    <TableCell className="text-right pr-4 truncate">{record.fields[WS.DATE] ? format(new Date(record.fields[WS.DATE]), "dd/MM/yyyy") : "-"}</TableCell>
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
