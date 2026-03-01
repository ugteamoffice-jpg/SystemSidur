"use client"

import * as React from "react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { requestQueue } from "@/lib/request-queue"
import { Calendar as CalendarIcon, Loader2, Search, UserCog, DollarSign, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTenantFields, useTenant } from "@/lib/tenant-context"
import { useToast } from "@/hooks/use-toast"

interface RideRecord {
  id: string
  fields: { [key: string]: any }
}

const VAT = 1.18

const renderLink = (value: any): string => {
  if (!value) return "-"
  if (Array.isArray(value) && value.length > 0) return value[0]?.title || "-"
  if (typeof value === "object" && value.title) return value.title
  return String(value)
}

export function GeneralReportPage() {
  const tenantFields = useTenantFields()
  const { tenantId } = useTenant()
  const WS = tenantFields?.workSchedule || ({} as any)
  const { toast } = useToast()

  // --- State ---
  const [allData, setAllData] = React.useState<RideRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [hasSearched, setHasSearched] = React.useState(false)
  const [globalFilter, setGlobalFilter] = React.useState("")

  // Filters
  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const [startDate, setStartDate] = React.useState<Date | undefined>(firstOfMonth)
  const [endDate, setEndDate] = React.useState<Date | undefined>(today)
  const [startCalOpen, setStartCalOpen] = React.useState(false)
  const [endCalOpen, setEndCalOpen] = React.useState(false)
  const [filterCustomer, setFilterCustomer] = React.useState("")
  const [filterDriver, setFilterDriver] = React.useState("")

  // Lists
  const [driverList, setDriverList] = React.useState<{ id: string; name: string }[]>([])
  const driverNamesRef = React.useRef<Map<string, string>>(new Map())

  // Selection
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  // Bulk update dialogs
  const [showDriverDialog, setShowDriverDialog] = React.useState(false)
  const [showPriceDialog, setShowPriceDialog] = React.useState(false)
  const [isUpdating, setIsUpdating] = React.useState(false)

  // Bulk driver state
  const [bulkDriverId, setBulkDriverId] = React.useState("")
  const [bulkDriverName, setBulkDriverName] = React.useState("")
  const [driverSuggestOpen, setDriverSuggestOpen] = React.useState(false)

  // Bulk price state
  const [priceClientExcl, setPriceClientExcl] = React.useState("")
  const [priceClientIncl, setPriceClientIncl] = React.useState("")
  const [priceDriverExcl, setPriceDriverExcl] = React.useState("")
  const [priceDriverIncl, setPriceDriverIncl] = React.useState("")
  const [updateClient, setUpdateClient] = React.useState(true)
  const [updateDriver, setUpdateDriver] = React.useState(true)

  // Column widths
  const COL_KEY = `generalReportColWidths_${tenantId}`
  const defaultWidths: Record<string, number> = {
    sel: 45, date: 95, customer: 140, pickup: 75, route: 200,
    dropoff: 75, vehicleType: 100, driver: 120, vehicleNum: 90,
    p1: 105, p2: 115, p3: 105, p4: 115,
  }
  const [colWidths, setColWidths] = React.useState<Record<string, number>>(() => {
    try { const s = localStorage.getItem(COL_KEY); return s ? { ...defaultWidths, ...JSON.parse(s) } : defaultWidths } catch { return defaultWidths }
  })
  React.useEffect(() => { try { localStorage.setItem(COL_KEY, JSON.stringify(colWidths)) } catch {} }, [colWidths])

  const handleResizeStart = (colId: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX; const startW = colWidths[colId] || defaultWidths[colId] || 100
    const onMove = (me: MouseEvent) => setColWidths(p => ({ ...p, [colId]: Math.max(50, startW + (startX - me.clientX)) }))
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp) }
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp)
  }

  // Load driver list
  React.useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`/api/drivers?tenant=${tenantId}`)
        if (!r.ok) return
        const data = await r.json()
        const map = new Map<string, string>()
        const list = (data.records || []).map((rec: any) => {
          const name = rec.fields?.[tenantFields?.drivers?.FIRST_NAME] || ""
          if (rec.id && name) map.set(rec.id, name)
          return { id: rec.id, name }
        }).filter((d: any) => d.name)
        driverNamesRef.current = map
        setDriverList(list)
      } catch {}
    }
    if (tenantFields) load()
  }, [tenantFields, tenantId])

  // Fetch data
  const fetchData = async () => {
    setIsLoading(true)
    setSelectedIds(new Set())
    try {
      let allRecords: RideRecord[] = []
      let skip = 0
      while (true) {
        const r = await fetch(`/api/work-schedule?tenant=${tenantId}&take=1000&skip=${skip}&_t=${Date.now()}`)
        if (!r.ok) throw new Error("fetch failed")
        const json = await r.json()
        const records = json.records || []
        allRecords = allRecords.concat(records)
        if (records.length < 1000) break
        skip += 1000
      }
      // Enrich with driver name
      setAllData(allRecords.map(rec => {
        const v = rec.fields[WS.DRIVER]
        const driverId = Array.isArray(v) ? v[0]?.id : null
        if (driverId && driverNamesRef.current.has(driverId)) {
          return { ...rec, fields: { ...rec.fields, _driverName: driverNamesRef.current.get(driverId), _driverId: driverId } }
        }
        return rec
      }))
      setHasSearched(true)
    } catch {
      toast({ title: "שגיאה בטעינת נתונים", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  // Filtered data
  const filteredData = React.useMemo(() => {
    let d = allData
    if (startDate) {
      const s = format(startDate, "yyyy-MM-dd")
      d = d.filter(r => (r.fields[WS.DATE] || "").substring(0, 10) >= s)
    }
    if (endDate) {
      const e = format(endDate, "yyyy-MM-dd")
      d = d.filter(r => (r.fields[WS.DATE] || "").substring(0, 10) <= e)
    }
    if (filterCustomer.trim()) {
      const q = filterCustomer.toLowerCase()
      d = d.filter(r => renderLink(r.fields[WS.CUSTOMER]).toLowerCase().includes(q))
    }
    if (filterDriver.trim()) {
      const q = filterDriver.toLowerCase()
      d = d.filter(r => {
        const name = (r.fields as any)._driverName || renderLink(r.fields[WS.DRIVER])
        return name.toLowerCase().includes(q)
      })
    }
    if (globalFilter.trim()) {
      const q = globalFilter.toLowerCase()
      d = d.filter(r => Object.values(r.fields).some(v => String(v || "").toLowerCase().includes(q)))
    }
    return d
  }, [allData, startDate, endDate, filterCustomer, filterDriver, globalFilter, WS])

  // Selection
  const allSelected = filteredData.length > 0 && selectedIds.size === filteredData.length
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(filteredData.map(r => r.id)))
  const toggleRow = (id: string) => {
    const s = new Set(selectedIds)
    s.has(id) ? s.delete(id) : s.add(id)
    setSelectedIds(s)
  }

  // Bulk update driver
  const handleBulkUpdateDriver = async () => {
    if (!bulkDriverId || selectedIds.size === 0) return
    setIsUpdating(true)
    const ids = Array.from(selectedIds)
    const results = await Promise.all(ids.map(id =>
      requestQueue.add(async () => {
        const res = await fetch(`/api/work-schedule/${id}?tenant=${tenantId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: { [WS.DRIVER]: [bulkDriverId] } })
        })
        return res.ok
      }).catch(() => false)
    ))
    const errors = results.filter(ok => !ok).length
    setIsUpdating(false)
    setShowDriverDialog(false)
    setBulkDriverId(""); setBulkDriverName("")
    await fetchData()
    errors > 0
      ? toast({ title: "שגיאה", description: `נכשל עדכון ${errors} נסיעות`, variant: "destructive" })
      : toast({ title: "הצלחה", description: `עודכן נהג ב-${ids.length} נסיעות` })
  }

  // Bulk update prices
  const handleBulkUpdatePrices = async () => {
    if (selectedIds.size === 0) return
    if (!updateClient && !updateDriver) return
    setIsUpdating(true)
    const ids = Array.from(selectedIds)

    const fields: Record<string, any> = {}
    if (updateClient && priceClientExcl !== "") fields[WS.PRICE_CLIENT_EXCL] = parseFloat(priceClientExcl) || 0
    if (updateClient && priceClientIncl !== "") fields[WS.PRICE_CLIENT_INCL] = parseFloat(priceClientIncl) || 0
    if (updateDriver && priceDriverExcl !== "") fields[WS.PRICE_DRIVER_EXCL] = parseFloat(priceDriverExcl) || 0
    if (updateDriver && priceDriverIncl !== "") fields[WS.PRICE_DRIVER_INCL] = parseFloat(priceDriverIncl) || 0

    if (Object.keys(fields).length === 0) {
      setIsUpdating(false)
      toast({ title: "שים לב", description: "לא הוזנו ערכים לעדכון", variant: "destructive" })
      return
    }

    const results = await Promise.all(ids.map(id =>
      requestQueue.add(async () => {
        const res = await fetch(`/api/work-schedule/${id}?tenant=${tenantId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields })
        })
        return res.ok
      }).catch(() => false)
    ))
    const errors = results.filter(ok => !ok).length
    setIsUpdating(false)
    setShowPriceDialog(false)
    setPriceClientExcl(""); setPriceClientIncl(""); setPriceDriverExcl(""); setPriceDriverIncl("")
    await fetchData()
    errors > 0
      ? toast({ title: "שגיאה", description: `נכשל עדכון ${errors} נסיעות`, variant: "destructive" })
      : toast({ title: "הצלחה", description: `מחירים עודכנו ב-${ids.length} נסיעות` })
  }

  const filteredDriverSuggestions = React.useMemo(() =>
    driverList.filter(d => d.name.toLowerCase().includes(bulkDriverName.toLowerCase())).slice(0, 15),
    [driverList, bulkDriverName]
  )

  const cols = [
    { id: "sel", label: "", width: colWidths.sel || 45 },
    { id: "date", label: "תאריך", width: colWidths.date || 95 },
    { id: "customer", label: "שם לקוח", width: colWidths.customer || 140 },
    { id: "pickup", label: "הלוך", width: colWidths.pickup || 75 },
    { id: "route", label: "מסלול", width: colWidths.route || 200 },
    { id: "dropoff", label: "חזור", width: colWidths.dropoff || 75 },
    { id: "vehicleType", label: "סוג רכב", width: colWidths.vehicleType || 100 },
    { id: "driver", label: "שם נהג", width: colWidths.driver || 120 },
    { id: "vehicleNum", label: "מס' רכב", width: colWidths.vehicleNum || 90 },
    { id: "p1", label: 'לקוח לפני מע"מ', width: colWidths.p1 || 105 },
    { id: "p2", label: 'לקוח כולל מע"מ', width: colWidths.p2 || 115 },
    { id: "p3", label: 'נהג לפני מע"מ', width: colWidths.p3 || 105 },
    { id: "p4", label: 'נהג כולל מע"מ', width: colWidths.p4 || 115 },
  ]

  const renderCell = (col: string, rec: RideRecord) => {
    const f = rec.fields
    switch (col) {
      case "date": return f[WS.DATE] ? format(new Date(f[WS.DATE]), "dd/MM/yyyy") : "-"
      case "customer": return renderLink(f[WS.CUSTOMER])
      case "pickup": return f[WS.PICKUP_TIME] || "-"
      case "route": return f[WS.DESCRIPTION] || "-"
      case "dropoff": return f[WS.DROPOFF_TIME] || "-"
      case "vehicleType": return renderLink(f[WS.VEHICLE_TYPE])
      case "driver": return (f as any)._driverName || renderLink(f[WS.DRIVER])
      case "vehicleNum": return f[WS.VEHICLE_NUM] || "-"
      case "p1": return (Number(f[WS.PRICE_CLIENT_EXCL]) || 0).toLocaleString()
      case "p2": return (Number(f[WS.PRICE_CLIENT_INCL]) || 0).toLocaleString()
      case "p3": return (Number(f[WS.PRICE_DRIVER_EXCL]) || 0).toLocaleString()
      case "p4": return (Number(f[WS.PRICE_DRIVER_INCL]) || 0).toLocaleString()
      default: return "-"
    }
  }

  return (
    <div className="flex flex-col h-full p-4 gap-3 overflow-hidden" dir="rtl">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Date range */}
        <Popover open={startCalOpen} onOpenChange={setStartCalOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 text-xs h-9">
              <CalendarIcon className="h-3.5 w-3.5" />
              {startDate ? format(startDate, "dd/MM/yy") : "מתאריך"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={startDate} onSelect={(d) => { setStartDate(d); setStartCalOpen(false) }} locale={he} />
          </PopoverContent>
        </Popover>

        <span className="text-muted-foreground text-xs">—</span>

        <Popover open={endCalOpen} onOpenChange={setEndCalOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 text-xs h-9">
              <CalendarIcon className="h-3.5 w-3.5" />
              {endDate ? format(endDate, "dd/MM/yy") : "עד תאריך"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={endDate} onSelect={(d) => { setEndDate(d); setEndCalOpen(false) }} locale={he} />
          </PopoverContent>
        </Popover>

        <Input placeholder="סינון לקוח..." value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} className="h-9 w-32 text-xs" />
        <Input placeholder="סינון נהג..." value={filterDriver} onChange={e => setFilterDriver(e.target.value)} className="h-9 w-32 text-xs" />

        <Button onClick={fetchData} disabled={isLoading} className="h-9 gap-1">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          הצג דוח
        </Button>

        {hasSearched && (
          <Input placeholder="חיפוש חופשי..." value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} className="h-9 w-40 text-xs" />
        )}

        {/* Bulk actions — only visible when rows are selected */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 mr-auto bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
            <span className="text-xs font-medium text-orange-700">{selectedIds.size} נבחרו</span>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-orange-300 text-orange-700 hover:bg-orange-100"
              onClick={() => setShowDriverDialog(true)}>
              <UserCog className="h-3.5 w-3.5" />
              עדכן נהג
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-orange-300 text-orange-700 hover:bg-orange-100"
              onClick={() => setShowPriceDialog(true)}>
              <DollarSign className="h-3.5 w-3.5" />
              עדכן מחירים
            </Button>
          </div>
        )}

        {hasSearched && selectedIds.size === 0 && (
          <div className="mr-auto text-xs text-muted-foreground border rounded px-3 py-1.5 bg-muted/30">
            סה"כ: <span className="font-bold">{filteredData.length}</span> נסיעות
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto border rounded-lg min-h-0">
        {!hasSearched && !isLoading && (
          <div className="flex items-center justify-center h-full text-muted-foreground">בחר תאריכים ולחץ "הצג דוח"</div>
        )}
        {isLoading && (
          <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> טוען...
          </div>
        )}
        {hasSearched && !isLoading && filteredData.length === 0 && (
          <div className="flex items-center justify-center h-full text-muted-foreground">לא נמצאו נסיעות</div>
        )}
        {hasSearched && !isLoading && filteredData.length > 0 && (
          <Table style={{ tableLayout: "fixed", width: cols.reduce((s, c) => s + c.width, 0) }}>
            <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
              <TableRow>
                {cols.map(col => (
                  <TableHead key={col.id} className="text-right border-l relative select-none" style={{ width: col.width }}>
                    {col.id === "sel" ? (
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                    ) : col.label}
                    {col.id !== "sel" && (
                      <div onMouseDown={e => handleResizeStart(col.id, e)}
                        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary z-20" />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map(rec => (
                <TableRow key={rec.id}
                  className={`hover:bg-muted/50 transition-colors ${selectedIds.has(rec.id) ? "bg-orange-50" : ""}`}>
                  {cols.map(col => (
                    <TableCell key={col.id} className="border-l truncate text-right text-sm" style={{ width: col.width }}>
                      {col.id === "sel"
                        ? <Checkbox checked={selectedIds.has(rec.id)} onCheckedChange={() => toggleRow(rec.id)} />
                        : renderCell(col.id, rec)
                      }
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog: עדכון נהג */}
      <Dialog open={showDriverDialog} onOpenChange={o => { setShowDriverDialog(o); if (!o) { setBulkDriverId(""); setBulkDriverName("") } }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-orange-500" /> עדכון נהג</DialogTitle>
            <DialogDescription>יעדכן {selectedIds.size} נסיעות נבחרות</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label>בחר נהג</Label>
            <div className="relative">
              <Input
                value={bulkDriverName}
                onChange={e => { setBulkDriverName(e.target.value); setBulkDriverId(""); setDriverSuggestOpen(true) }}
                onFocus={() => setDriverSuggestOpen(true)}
                onBlur={() => setTimeout(() => setDriverSuggestOpen(false), 200)}
                placeholder="הקלד שם נהג..."
                className="text-right"
              />
              {driverSuggestOpen && filteredDriverSuggestions.length > 0 && (
                <div className="absolute z-50 w-full bg-white border rounded-md shadow-md max-h-48 overflow-auto mt-1 text-right">
                  {filteredDriverSuggestions.map(d => (
                    <div key={d.id} className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                      onMouseDown={() => { setBulkDriverName(d.name); setBulkDriverId(d.id); setDriverSuggestOpen(false) }}>
                      {d.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {bulkDriverId && <p className="text-xs text-green-600">✓ נבחר: {bulkDriverName}</p>}
          </div>

          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="outline" onClick={() => setShowDriverDialog(false)}>ביטול</Button>
            <Button onClick={handleBulkUpdateDriver} disabled={!bulkDriverId || isUpdating}>
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              עדכן {selectedIds.size} נסיעות
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: עדכון מחירים */}
      <Dialog open={showPriceDialog} onOpenChange={o => {
        setShowPriceDialog(o)
        if (!o) { setPriceClientExcl(""); setPriceClientIncl(""); setPriceDriverExcl(""); setPriceDriverIncl("") }
      }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-orange-500" /> עדכון מחירים</DialogTitle>
            <DialogDescription>יעדכן {selectedIds.size} נסיעות נבחרות. שדה ריק = לא ישתנה.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* מחיר לקוח */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="update-client" checked={updateClient} onCheckedChange={v => setUpdateClient(!!v)} />
                <Label htmlFor="update-client" className="cursor-pointer font-medium">מחיר לקוח</Label>
              </div>
              {updateClient && (
                <div className="grid grid-cols-2 gap-3 pr-6">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">לפני מע"מ</Label>
                    <Input type="number" value={priceClientExcl} placeholder="0"
                      onChange={e => {
                        setPriceClientExcl(e.target.value)
                        if (e.target.value !== "") setPriceClientIncl(String(Math.round(parseFloat(e.target.value) * VAT * 100) / 100))
                      }} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">כולל מע"מ</Label>
                    <Input type="number" value={priceClientIncl} placeholder="0"
                      onChange={e => {
                        setPriceClientIncl(e.target.value)
                        if (e.target.value !== "") setPriceClientExcl(String(Math.round(parseFloat(e.target.value) / VAT * 100) / 100))
                      }} className="h-8 text-sm font-bold" />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t" />

            {/* מחיר נהג */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="update-driver-price" checked={updateDriver} onCheckedChange={v => setUpdateDriver(!!v)} />
                <Label htmlFor="update-driver-price" className="cursor-pointer font-medium">מחיר נהג</Label>
              </div>
              {updateDriver && (
                <div className="grid grid-cols-2 gap-3 pr-6">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">לפני מע"מ</Label>
                    <Input type="number" value={priceDriverExcl} placeholder="0"
                      onChange={e => {
                        setPriceDriverExcl(e.target.value)
                        if (e.target.value !== "") setPriceDriverIncl(String(Math.round(parseFloat(e.target.value) * VAT * 100) / 100))
                      }} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">כולל מע"מ</Label>
                    <Input type="number" value={priceDriverIncl} placeholder="0"
                      onChange={e => {
                        setPriceDriverIncl(e.target.value)
                        if (e.target.value !== "") setPriceDriverExcl(String(Math.round(parseFloat(e.target.value) / VAT * 100) / 100))
                      }} className="h-8 text-sm font-bold" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="outline" onClick={() => setShowPriceDialog(false)}>ביטול</Button>
            <Button onClick={handleBulkUpdatePrices} disabled={isUpdating || (!updateClient && !updateDriver)}>
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              עדכן {selectedIds.size} נסיעות
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
