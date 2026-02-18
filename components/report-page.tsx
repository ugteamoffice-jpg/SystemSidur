"use client"

import * as React from "react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { Calendar as CalendarIcon, Loader2, Search, X, LayoutDashboard, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

const reportTitles: Record<ReportType, string> = {
  "report-customer": "דוח לקוח",
  "report-driver": "דוח נהג",
  "report-invoices": "דוח חשבוניות",
  "report-profit": "דוח רווח והפסד",
}

interface FilterState {
  startDate: Date | undefined
  endDate: Date | undefined
  customerName: string
  driverName: string
  withClientPrice: boolean
  withoutClientPrice: boolean
  withDriverPrice: boolean
  withoutDriverPrice: boolean
}

export function ReportPage({ reportType }: ReportPageProps) {
  const tenantFields = useTenantFields()
  const WS = tenantFields?.workSchedule || ({} as any)
  const { toast } = useToast()

  const [allData, setAllData] = React.useState<WorkScheduleRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [showFilterDialog, setShowFilterDialog] = React.useState(true)
  const [hasSearched, setHasSearched] = React.useState(false)
  const [editingRecord, setEditingRecord] = React.useState<WorkScheduleRecord | null>(null)
  const [globalFilter, setGlobalFilter] = React.useState("")

  // Column resizing
  const defaultWidths: Record<string, number> = {
    date: 95, customer: 130, pickup: 80, route: 200, dropoff: 80, 
    vehicleType: 100, driver: 110, vehicleNum: 85, 
    p1: 100, p2: 110, p3: 100, p4: 100, profit: 80
  }
  const [colWidths, setColWidths] = React.useState<Record<string, number>>(defaultWidths)
  const resizeCol = (colId: string, startX: number, startWidth: number) => {
    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(50, startWidth + (startX - e.clientX))
      setColWidths(prev => ({ ...prev, [colId]: newWidth }))
    }
    const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); }
    document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp)
  }

  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  const [filters, setFilters] = React.useState<FilterState>({
    startDate: firstOfMonth,
    endDate: today,
    customerName: "",
    driverName: "",
    withClientPrice: true,
    withoutClientPrice: true,
    withDriverPrice: true,
    withoutDriverPrice: true,
  })

  // Temp filters for dialog
  const [tempFilters, setTempFilters] = React.useState<FilterState>(filters)
  const [startCalOpen, setStartCalOpen] = React.useState(false)
  const [endCalOpen, setEndCalOpen] = React.useState(false)

  // Autocomplete
  const [customerOptions, setCustomerOptions] = React.useState<string[]>([])
  const [driverOptions, setDriverOptions] = React.useState<string[]>([])
  const [showCustomerSuggestions, setShowCustomerSuggestions] = React.useState(false)
  const [showDriverSuggestions, setShowDriverSuggestions] = React.useState(false)
  const customerRef = React.useRef<HTMLDivElement>(null)
  const driverRef = React.useRef<HTMLDivElement>(null)

  // Close suggestions on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) setShowCustomerSuggestions(false)
      if (driverRef.current && !driverRef.current.contains(e.target as Node)) setShowDriverSuggestions(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Fetch names for autocomplete
  React.useEffect(() => {
    const fetchNames = async () => {
      try {
        const [custRes, drvRes] = await Promise.all([
          fetch("/api/customers?take=500"),
          fetch("/api/drivers?take=500"),
        ])
        if (custRes.ok) {
          const data = await custRes.json()
          const names = (data.records || []).map((r: any) => r.fields?.[tenantFields?.customers?.NAME] || "").filter(Boolean)
          setCustomerOptions([...new Set(names)] as string[])
        }
        if (drvRes.ok) {
          const data = await drvRes.json()
          const names = (data.records || []).map((r: any) => {
            const first = r.fields?.[tenantFields?.drivers?.FIRST_NAME] || ""
            const last = r.fields?.[tenantFields?.drivers?.LAST_NAME] || ""
            return `${first} ${last}`.trim()
          }).filter(Boolean)
          setDriverOptions([...new Set(names)] as string[])
        }
      } catch (e) { console.error("Error fetching names:", e) }
    }
    fetchNames()
  }, [tenantFields])

  const filteredCustomerSuggestions = React.useMemo(() => {
    if (!tempFilters.customerName.trim()) return customerOptions.slice(0, 15)
    return customerOptions.filter(n => n.toLowerCase().includes(tempFilters.customerName.toLowerCase())).slice(0, 15)
  }, [customerOptions, tempFilters.customerName])

  const filteredDriverSuggestions = React.useMemo(() => {
    if (!tempFilters.driverName.trim()) return driverOptions.slice(0, 15)
    return driverOptions.filter(n => n.toLowerCase().includes(tempFilters.driverName.toLowerCase())).slice(0, 15)
  }, [driverOptions, tempFilters.driverName])

  const openFilterDialog = () => {
    setTempFilters(filters)
    setShowFilterDialog(true)
  }

  const applyFilters = async () => {
    setFilters(tempFilters)
    setShowFilterDialog(false)
    
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

  // Filter data based on applied filters
  const filteredData = React.useMemo(() => {
    let filtered = allData

    // Date range
    if (filters.startDate) {
      const startStr = format(filters.startDate, "yyyy-MM-dd")
      filtered = filtered.filter((r) => (r.fields[WS.DATE] || "").substring(0, 10) >= startStr)
    }
    if (filters.endDate) {
      const endStr = format(filters.endDate, "yyyy-MM-dd")
      filtered = filtered.filter((r) => (r.fields[WS.DATE] || "").substring(0, 10) <= endStr)
    }

    // Customer name
    if (filters.customerName.trim()) {
      const search = filters.customerName.trim().toLowerCase()
      filtered = filtered.filter((r) => renderLinkField(r.fields[WS.CUSTOMER]).toLowerCase().includes(search))
    }

    // Driver name
    if (filters.driverName.trim()) {
      const search = filters.driverName.trim().toLowerCase()
      filtered = filtered.filter((r) => renderLinkField(r.fields[WS.DRIVER]).toLowerCase().includes(search))
    }

    // Price filters
    if (!filters.withClientPrice) {
      filtered = filtered.filter((r) => !(Number(r.fields[WS.PRICE_CLIENT_EXCL]) > 0))
    }
    if (!filters.withoutClientPrice) {
      filtered = filtered.filter((r) => Number(r.fields[WS.PRICE_CLIENT_EXCL]) > 0)
    }
    if (!filters.withDriverPrice) {
      filtered = filtered.filter((r) => !(Number(r.fields[WS.PRICE_DRIVER_EXCL]) > 0))
    }
    if (!filters.withoutDriverPrice) {
      filtered = filtered.filter((r) => Number(r.fields[WS.PRICE_DRIVER_EXCL]) > 0)
    }

    // Global search
    if (globalFilter.trim()) {
      const search = globalFilter.trim().toLowerCase()
      filtered = filtered.filter((r) => {
        return Object.values(r.fields).some((val) => {
          const str = typeof val === "string" ? val : renderLinkField(val)
          return str.toLowerCase().includes(search)
        })
      })
    }

    // Sort by date
    filtered.sort((a, b) => {
      const da = (a.fields[WS.DATE] || "").substring(0, 10)
      const db = (b.fields[WS.DATE] || "").substring(0, 10)
      return da.localeCompare(db)
    })

    return filtered
  }, [allData, filters, globalFilter, WS])

  // Totals
  const totals = React.useMemo(() => ({
    totalRows: filteredData.length,
    p1: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_CLIENT_EXCL]) || 0), 0),
    p2: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_CLIENT_INCL]) || 0), 0),
    p3: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_DRIVER_EXCL]) || 0), 0),
    p4: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_DRIVER_INCL]) || 0), 0),
    p5: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PROFIT]) || 0), 0),
    p6: filteredData.reduce((s, r) => s + ((Number(r.fields[WS.PRICE_CLIENT_INCL]) || 0) - (Number(r.fields[WS.PRICE_DRIVER_INCL]) || 0)), 0),
  }), [filteredData, WS])

  // Active filter description
  const filterSummary = React.useMemo(() => {
    const parts: string[] = []
    if (filters.startDate && filters.endDate) parts.push(`${format(filters.startDate, "dd/MM/yyyy")} - ${format(filters.endDate, "dd/MM/yyyy")}`)
    if (filters.customerName) parts.push(`לקוח: ${filters.customerName}`)
    if (filters.driverName) parts.push(`נהג: ${filters.driverName}`)
    if (!filters.withClientPrice) parts.push("ללא מחיר לקוח")
    if (!filters.withoutClientPrice) parts.push("עם מחיר לקוח")
    if (!filters.withDriverPrice) parts.push("ללא מחיר נהג")
    if (!filters.withoutDriverPrice) parts.push("עם מחיר נהג")
    return parts.join(" | ")
  }, [filters])

  return (
    <>
      {/* Filter Dialog */}
      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent className="sm:max-w-[480px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>{reportTitles[reportType]}</DialogTitle>
            <DialogDescription>בחר פרמטרים לדוח</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            {/* Date range */}
            <div className="space-y-2">
              <Label className="font-bold">טווח תאריכים</Label>
              <div className="flex items-center gap-3">
                <Popover open={startCalOpen} onOpenChange={setStartCalOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start text-right font-normal h-10">
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {tempFilters.startDate ? format(tempFilters.startDate, "dd/MM/yyyy") : "מתאריך"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={tempFilters.startDate} onSelect={(d) => { setTempFilters(p => ({ ...p, startDate: d })); setStartCalOpen(false) }} locale={he} dir="rtl" initialFocus />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground text-sm">עד</span>
                <Popover open={endCalOpen} onOpenChange={setEndCalOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start text-right font-normal h-10">
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {tempFilters.endDate ? format(tempFilters.endDate, "dd/MM/yyyy") : "עד תאריך"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={tempFilters.endDate} onSelect={(d) => { setTempFilters(p => ({ ...p, endDate: d })); setEndCalOpen(false) }} locale={he} dir="rtl" initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Customer name */}
            <div className="space-y-2">
              <Label className="font-bold">שם לקוח</Label>
              <div className="relative" ref={customerRef}>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="חפש לקוח..." value={tempFilters.customerName}
                    onChange={(e) => { setTempFilters(p => ({ ...p, customerName: e.target.value })); setShowCustomerSuggestions(true) }}
                    onFocus={() => setShowCustomerSuggestions(true)} className="pr-9 h-10" />
                  {tempFilters.customerName && (
                    <button className="absolute left-3 top-1/2 transform -translate-y-1/2" onClick={() => { setTempFilters(p => ({ ...p, customerName: "" })); setShowCustomerSuggestions(false) }}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
                {showCustomerSuggestions && filteredCustomerSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 max-h-[160px] overflow-auto bg-popover border rounded-md shadow-md">
                    {filteredCustomerSuggestions.map((name, i) => (
                      <button key={i} className="w-full text-right px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => { setTempFilters(p => ({ ...p, customerName: name })); setShowCustomerSuggestions(false) }}>
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Driver name */}
            <div className="space-y-2">
              <Label className="font-bold">שם נהג</Label>
              <div className="relative" ref={driverRef}>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="חפש נהג..." value={tempFilters.driverName}
                    onChange={(e) => { setTempFilters(p => ({ ...p, driverName: e.target.value })); setShowDriverSuggestions(true) }}
                    onFocus={() => setShowDriverSuggestions(true)} className="pr-9 h-10" />
                  {tempFilters.driverName && (
                    <button className="absolute left-3 top-1/2 transform -translate-y-1/2" onClick={() => { setTempFilters(p => ({ ...p, driverName: "" })); setShowDriverSuggestions(false) }}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
                {showDriverSuggestions && filteredDriverSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 max-h-[160px] overflow-auto bg-popover border rounded-md shadow-md">
                    {filteredDriverSuggestions.map((name, i) => (
                      <button key={i} className="w-full text-right px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => { setTempFilters(p => ({ ...p, driverName: name })); setShowDriverSuggestions(false) }}>
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Price filters */}
            <div className="space-y-2">
              <Label className="font-bold">סינון מחירים</Label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={tempFilters.withClientPrice} onCheckedChange={(c) => setTempFilters(p => ({ ...p, withClientPrice: !!c }))} />
                  נסיעות עם מחיר לקוח
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={tempFilters.withoutClientPrice} onCheckedChange={(c) => setTempFilters(p => ({ ...p, withoutClientPrice: !!c }))} />
                  נסיעות ללא מחיר לקוח
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={tempFilters.withDriverPrice} onCheckedChange={(c) => setTempFilters(p => ({ ...p, withDriverPrice: !!c }))} />
                  נסיעות עם מחיר נהג
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={tempFilters.withoutDriverPrice} onCheckedChange={(c) => setTempFilters(p => ({ ...p, withoutDriverPrice: !!c }))} />
                  נסיעות ללא מחיר נהג
                </label>
              </div>
            </div>

            {/* Submit */}
            <Button onClick={applyFilters} disabled={isLoading} className="h-10 mt-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Search className="h-4 w-4 ml-2" />}
              הצג דוח
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main table view */}
      <div className="w-full h-[calc(100vh-4.5rem)] flex flex-col p-4 overflow-hidden" dir="rtl">
        {/* Top bar */}
        <div className="flex items-center gap-3 pb-3 flex-none flex-wrap">
          <Button variant="outline" size="sm" onClick={openFilterDialog} className="shrink-0">
            <SlidersHorizontal className="h-4 w-4 ml-2" />
            שינוי סינון
          </Button>

          {hasSearched && (
            <div className="text-xs text-muted-foreground border rounded px-3 py-1.5 bg-muted/30 shrink-0">
              {filterSummary}
            </div>
          )}

          {hasSearched && (
            <Input placeholder="חיפוש חופשי..." value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="w-[200px] h-9 shrink-0" />
          )}

          {hasSearched && (
            <div className="flex items-center gap-2 bg-card border rounded px-3 py-1.5 shadow-sm shrink-0">
              <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">סה"כ שורות: <span className="font-bold text-foreground text-sm">{totals.totalRows}</span></span>
            </div>
          )}

          {hasSearched && filteredData.length > 0 && (
            <div className="flex gap-4 text-xs bg-muted/20 border rounded px-3 py-1.5 shadow-sm items-center shrink-0 mr-auto">
              <span>לקוח+ מע"מ: <span className="font-bold">{totals.p1.toLocaleString()} ₪</span></span>
              <span>לקוח כולל: <span className="font-bold">{totals.p2.toLocaleString()} ₪</span></span>
              <span className="text-border">|</span>
              <span>נהג+ מע"מ: <span className="font-bold">{totals.p3.toLocaleString()} ₪</span></span>
              <span>נהג כולל: <span className="font-bold">{totals.p4.toLocaleString()} ₪</span></span>
              <span className="text-border">|</span>
              <span className="text-green-600 dark:text-green-400 font-medium">רווח: <span className="font-bold">{totals.p5.toLocaleString()} ₪</span></span>
              <span className="text-green-600 dark:text-green-400 font-medium">רווח כולל: <span className="font-bold">{totals.p6.toLocaleString()} ₪</span></span>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="rounded-md border flex-1 overflow-auto min-h-0">
          {!hasSearched && !isLoading && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>בחר פרמטרים ולחץ "הצג דוח"</p>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="mr-2 text-muted-foreground">טוען נתונים...</span>
            </div>
          )}

          {hasSearched && !isLoading && filteredData.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground">לא נמצאו תוצאות</div>
          )}

          {hasSearched && !isLoading && filteredData.length > 0 && (
            <Table className="relative w-full" style={{ tableLayout: "fixed" }}>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  {[
                    { id: "date", label: "תאריך" }, { id: "customer", label: "שם לקוח" },
                    { id: "pickup", label: "התייצבות" }, { id: "route", label: "מסלול" },
                    { id: "dropoff", label: "חזור" }, { id: "vehicleType", label: "סוג רכב" },
                    { id: "driver", label: "שם נהג" }, { id: "vehicleNum", label: "מספר רכב" },
                    { id: "p1", label: "לקוח+ מע״מ" }, { id: "p2", label: "לקוח כולל" },
                    { id: "p3", label: "נהג+ מע״מ" }, { id: "p4", label: "נהג כולל" },
                    { id: "profit", label: "רווח" },
                  ].map(col => (
                    <TableHead key={col.id} className="text-right relative border-l select-none group hover:bg-muted/30" style={{ width: colWidths[col.id] }}>
                      {col.label}
                      <div onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); resizeCol(col.id, e.clientX, colWidths[col.id]); }}
                        className="absolute top-0 left-0 w-[4px] h-full cursor-col-resize bg-transparent hover:bg-primary/50 active:bg-primary/70" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((record) => (
                  <TableRow key={record.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditingRecord(record)}>
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
      </div>

      {/* Edit dialog */}
      <RideDialog
        open={!!editingRecord}
        onOpenChange={(isOpen: boolean) => !isOpen && setEditingRecord(null)}
        initialData={editingRecord}
        onRideSaved={() => { setEditingRecord(null); applyFilters(); }}
        triggerChild={<span />}
        defaultDate={editingRecord?.fields[WS.DATE] ? (editingRecord.fields[WS.DATE] as string).substring(0, 10) : format(new Date(), "yyyy-MM-dd")}
      />
    </>
  )
}
