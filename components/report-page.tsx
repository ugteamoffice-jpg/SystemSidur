"use client"

import * as React from "react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { Calendar as CalendarIcon, Loader2, Search, X, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useTenantFields } from "@/lib/tenant-context"
import { useToast } from "@/hooks/use-toast"
import { RideDialog } from "@/components/new-ride-dialog"

interface WorkScheduleRecord {
  id: string
  fields: { [key: string]: any }
}

export type ReportType = "report-customer" | "report-driver" | "report-invoices" | "report-profit"

interface ReportPageProps {
  reportType: ReportType
}

const renderLinkField = (value: any): string => {
  if (!value) return "-"
  if (Array.isArray(value) && value.length > 0) return value[0]?.title || "-"
  if (typeof value === "object" && value.title) return value.title
  return String(value)
}

export function ReportPage({ reportType }: ReportPageProps) {
  const tenantFields = useTenantFields()
  const WS = tenantFields?.workSchedule || ({} as any)
  const { toast } = useToast()

  const [allData, setAllData] = React.useState<WorkScheduleRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [hasSearched, setHasSearched] = React.useState(false)
  const [editingRecord, setEditingRecord] = React.useState<WorkScheduleRecord | null>(null)
  const [globalFilter, setGlobalFilter] = React.useState("")

  // Filters
  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const [startDate, setStartDate] = React.useState<Date | undefined>(firstOfMonth)
  const [endDate, setEndDate] = React.useState<Date | undefined>(today)
  const [startCalOpen, setStartCalOpen] = React.useState(false)
  const [endCalOpen, setEndCalOpen] = React.useState(false)
  const [filterName, setFilterName] = React.useState("")

  // Autocomplete
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
    if (!showNameFilter) return
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
  }, [reportType, tenantFields, showNameFilter])

  const filteredSuggestions = React.useMemo(() => {
    if (!filterName.trim()) return nameOptions.slice(0, 15)
    return nameOptions.filter(n => n.toLowerCase().includes(filterName.toLowerCase())).slice(0, 15)
  }, [nameOptions, filterName])

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/work-schedule?take=1000&_t=${Date.now()}`)
      if (!response.ok) throw new Error("Failed to fetch")
      const json = await response.json()
      setAllData(json.records || [])
      setHasSearched(true)
    } catch (error) {
      console.error("Error fetching report data:", error)
      toast({ title: "שגיאה בטעינת נתונים", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  // Filter data
  const filteredData = React.useMemo(() => {
    let filtered = allData

    if (startDate) {
      const startStr = format(startDate, "yyyy-MM-dd")
      filtered = filtered.filter((r) => (r.fields[WS.DATE] || "").substring(0, 10) >= startStr)
    }
    if (endDate) {
      const endStr = format(endDate, "yyyy-MM-dd")
      filtered = filtered.filter((r) => (r.fields[WS.DATE] || "").substring(0, 10) <= endStr)
    }

    if (filterName.trim()) {
      const search = filterName.trim().toLowerCase()
      if (reportType === "report-driver") {
        filtered = filtered.filter((r) => renderLinkField(r.fields[WS.DRIVER]).toLowerCase().includes(search))
      } else if (reportType === "report-customer") {
        filtered = filtered.filter((r) => renderLinkField(r.fields[WS.CUSTOMER]).toLowerCase().includes(search))
      }
    }

    if (globalFilter.trim()) {
      const search = globalFilter.trim().toLowerCase()
      filtered = filtered.filter((r) => {
        return Object.values(r.fields).some((val) => {
          const str = typeof val === "string" ? val : renderLinkField(val)
          return str.toLowerCase().includes(search)
        })
      })
    }

    filtered.sort((a, b) => {
      const da = (a.fields[WS.DATE] || "").substring(0, 10)
      const db = (b.fields[WS.DATE] || "").substring(0, 10)
      return da.localeCompare(db)
    })

    return filtered
  }, [allData, startDate, endDate, filterName, globalFilter, reportType, WS])

  // Totals
  const totals = React.useMemo(() => {
    const rows = filteredData
    return {
      totalRows: rows.length,
      p1: rows.reduce((s, r) => s + (Number(r.fields[WS.PRICE_CLIENT_EXCL]) || 0), 0),
      p2: rows.reduce((s, r) => s + (Number(r.fields[WS.PRICE_CLIENT_INCL]) || 0), 0),
      p3: rows.reduce((s, r) => s + (Number(r.fields[WS.PRICE_DRIVER_EXCL]) || 0), 0),
      p4: rows.reduce((s, r) => s + (Number(r.fields[WS.PRICE_DRIVER_INCL]) || 0), 0),
      p5: rows.reduce((s, r) => s + (Number(r.fields[WS.PROFIT]) || 0), 0),
      p6: rows.reduce((s, r) => s + ((Number(r.fields[WS.PRICE_CLIENT_INCL]) || 0) - (Number(r.fields[WS.PRICE_DRIVER_INCL]) || 0)), 0),
    }
  }, [filteredData, WS])

  return (
    <div className="w-full h-[calc(100vh-2rem)] flex flex-col space-y-3 p-4 overflow-hidden" dir="rtl">
      {/* Filter bar */}
      <div className="flex flex-col gap-3 flex-none">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Start date */}
          <Popover open={startCalOpen} onOpenChange={setStartCalOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[170px] justify-start text-right font-normal shrink-0">
                <CalendarIcon className="ml-2 h-4 w-4" />
                {startDate ? format(startDate, "dd/MM/yyyy") : "מתאריך"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end" side="bottom">
              <Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); setStartCalOpen(false) }} locale={he} dir="rtl" initialFocus />
            </PopoverContent>
          </Popover>

          <span className="text-muted-foreground text-sm shrink-0">עד</span>

          {/* End date */}
          <Popover open={endCalOpen} onOpenChange={setEndCalOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-[170px] justify-start text-right font-normal shrink-0">
                <CalendarIcon className="ml-2 h-4 w-4" />
                {endDate ? format(endDate, "dd/MM/yyyy") : "עד תאריך"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end" side="bottom">
              <Calendar mode="single" selected={endDate} onSelect={(d) => { setEndDate(d); setEndCalOpen(false) }} locale={he} dir="rtl" initialFocus />
            </PopoverContent>
          </Popover>

          {/* Name filter with autocomplete */}
          {showNameFilter && (
            <div className="relative w-[200px] shrink-0" ref={suggestionsRef}>
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

          {/* Search button */}
          <Button onClick={fetchData} disabled={isLoading} className="shrink-0">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Search className="h-4 w-4 ml-2" />}
            הצג דוח
          </Button>

          {/* Global search */}
          {hasSearched && (
            <div className="flex-1 min-w-[120px]">
              <Input placeholder="חיפוש חופשי..." value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="w-full h-10" />
            </div>
          )}

          {/* Row count */}
          {hasSearched && (
            <div className="flex bg-card p-2 px-4 rounded-md border shadow-sm items-center gap-2 whitespace-nowrap shrink-0">
              <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground text-xs font-medium">סה"כ שורות: <span className="font-bold text-foreground text-sm">{totals.totalRows}</span></span>
            </div>
          )}

          {/* Price totals */}
          {hasSearched && filteredData.length > 0 && (
            <div className="flex gap-6 text-xs bg-muted/20 p-2 px-4 rounded-md border shadow-sm items-center whitespace-nowrap shrink-0">
              <div className="flex flex-col gap-1 items-start justify-center">
                <span>סה"כ לקוח+ מע"מ: <span className="font-bold text-sm">{totals.p1.toLocaleString()} ₪</span></span>
                <span>סה"כ לקוח כולל מע"מ: <span className="font-bold text-sm">{totals.p2.toLocaleString()} ₪</span></span>
              </div>
              <div className="w-px bg-border self-stretch my-1"></div>
              <div className="flex flex-col gap-1 items-start justify-center">
                <span>סה"כ נהג+ מע"מ: <span className="font-bold text-sm">{totals.p3.toLocaleString()} ₪</span></span>
                <span>סה"כ נהג כולל מע"מ: <span className="font-bold text-sm">{totals.p4.toLocaleString()} ₪</span></span>
              </div>
              <div className="w-px bg-border self-stretch my-1"></div>
              <div className="flex flex-col gap-1 items-start justify-center text-green-600 dark:text-green-400 font-medium">
                <span>רווח+ מע"מ: <span className="font-bold text-sm">{totals.p5.toLocaleString()} ₪</span></span>
                <span>רווח כולל מע"מ: <span className="font-bold text-sm">{totals.p6.toLocaleString()} ₪</span></span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border flex-1 overflow-auto min-h-0">
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
          <Table className="relative w-full" style={{ tableLayout: "fixed" }}>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                <TableHead className="text-right pr-4 w-[95px]">תאריך</TableHead>
                <TableHead className="text-right w-[70px]">שלח</TableHead>
                <TableHead className="text-right w-[70px]">מאושר</TableHead>
                <TableHead className="text-right w-[140px]">שם לקוח</TableHead>
                <TableHead className="text-right w-[90px]">התייצבות</TableHead>
                <TableHead className="text-right w-[200px]">מסלול</TableHead>
                <TableHead className="text-right w-[90px]">חזור</TableHead>
                <TableHead className="text-right w-[110px]">סוג רכב</TableHead>
                <TableHead className="text-right w-[120px]">שם נהג</TableHead>
                <TableHead className="text-right w-[90px]">מספר רכב</TableHead>
                <TableHead className="text-right w-[120px]">לקוח+ מע״מ</TableHead>
                <TableHead className="text-right w-[140px]">לקוח כולל מע״מ</TableHead>
                <TableHead className="text-right w-[120px]">נהג+ מע״מ</TableHead>
                <TableHead className="text-right w-[140px]">נהג כולל מע״מ</TableHead>
                <TableHead className="text-right w-[90px]">רווח</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((record) => (
                <TableRow
                  key={record.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setEditingRecord(record)}
                >
                  <TableCell className="text-right pr-4 truncate">
                    {record.fields[WS.DATE] ? format(new Date(record.fields[WS.DATE]), "dd/MM/yyyy") : "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox checked={!!record.fields[WS.SENT]} disabled className="h-5 w-5" />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox checked={!!record.fields[WS.APPROVED]} disabled className="h-5 w-5" />
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

      {/* Edit dialog - same as data-grid */}
      <RideDialog
        open={!!editingRecord}
        onOpenChange={(isOpen: boolean) => !isOpen && setEditingRecord(null)}
        initialData={editingRecord}
        onRideSaved={() => { setEditingRecord(null); fetchData(); }}
        triggerChild={<span />}
        defaultDate={editingRecord?.fields[WS.DATE] ? (editingRecord.fields[WS.DATE] as string).substring(0, 10) : format(new Date(), "yyyy-MM-dd")}
      />
    </div>
  )
}
