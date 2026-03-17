"use client"

import * as React from "react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { requestQueue } from "@/lib/request-queue"
import { Calendar as CalendarIcon, Loader2, Search, X, SlidersHorizontal, UserCog, DollarSign, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useTenantFields, useTenant } from "@/lib/tenant-context"
import { useToast } from "@/hooks/use-toast"

interface RideRecord { id: string; fields: { [key: string]: any } }

const VAT = 1.18

const renderLink = (value: any): string => {
  if (!value) return "-"
  if (Array.isArray(value) && value.length > 0) return value[0]?.title || "-"
  if (typeof value === "object" && value.title) return value.title
  return String(value)
}

interface FilterState {
  startDate: Date | undefined; endDate: Date | undefined
  customerName: string; driverName: string; description: string
  withClientPrice: boolean; withoutClientPrice: boolean
  withDriverPrice: boolean; withoutDriverPrice: boolean
}

export function GeneralReportPage() {
  const tenantFields = useTenantFields()
  const { tenantId } = useTenant()
  const WS = tenantFields?.workSchedule || ({} as any)
  const { toast } = useToast()

  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  const [showFilterDialog, setShowFilterDialog] = React.useState(true)
  const [filters, setFilters] = React.useState<FilterState>({
    startDate: firstOfMonth, endDate: today,
    customerName: "", driverName: "", description: "",
    withClientPrice: true, withoutClientPrice: true,
    withDriverPrice: true, withoutDriverPrice: true,
  })
  const [tempFilters, setTempFilters] = React.useState<FilterState>(filters)
  const [startCalOpen, setStartCalOpen] = React.useState(false)
  const [endCalOpen, setEndCalOpen] = React.useState(false)

  const [customerOptions, setCustomerOptions] = React.useState<string[]>([])
  const [driverOptions, setDriverOptions] = React.useState<string[]>([])
  const [showCustomerSuggestions, setShowCustomerSuggestions] = React.useState(false)
  const [showDriverSuggestions, setShowDriverSuggestions] = React.useState(false)
  const customerRef = React.useRef<HTMLDivElement>(null)
  const driverRef = React.useRef<HTMLDivElement>(null)

  const [allData, setAllData] = React.useState<RideRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [hasSearched, setHasSearched] = React.useState(false)
  const [globalFilter, setGlobalFilter] = React.useState("")

  const [driverList, setDriverList] = React.useState<{ id: string; name: string }[]>([])
  const driverNamesRef = React.useRef<Map<string, string>>(new Map())
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())

  const [showDriverDialog, setShowDriverDialog] = React.useState(false)
  const [bulkDriverId, setBulkDriverId] = React.useState("")
  const [bulkDriverName, setBulkDriverName] = React.useState("")
  const [driverSuggestOpen, setDriverSuggestOpen] = React.useState(false)

  const [showPriceDialog, setShowPriceDialog] = React.useState(false)
  const [priceClientExcl, setPriceClientExcl] = React.useState("")
  const [priceClientIncl, setPriceClientIncl] = React.useState("")
  const [priceDriverExcl, setPriceDriverExcl] = React.useState("")
  const [priceDriverIncl, setPriceDriverIncl] = React.useState("")
  const [updateClient, setUpdateClient] = React.useState(true)
  const [updateDriver, setUpdateDriver] = React.useState(true)
  const [isUpdating, setIsUpdating] = React.useState(false)

  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)

  // Column order
  const COL_ORDER_KEY = `generalReportColOrder_${tenantId}`
  const defaultColOrder = ["sel","date","customer","pickup","route","dropoff","vehicleType","driver","vehicleNum","p1","p2","p3","p4"]
  const [columnOrder, setColumnOrder] = React.useState<string[]>(() => {
    try { const s = localStorage.getItem(COL_ORDER_KEY); return s ? JSON.parse(s) : defaultColOrder } catch { return defaultColOrder }
  })
  React.useEffect(() => { try { localStorage.setItem(COL_ORDER_KEY, JSON.stringify(columnOrder)) } catch {} }, [columnOrder])
  const [draggedCol, setDraggedCol] = React.useState<string | null>(null)

  const COL_KEY = `generalReportColWidths_${tenantId}`
  const defaultWidths: Record<string, number> = { sel:45, date:95, customer:140, pickup:75, route:200, dropoff:75, vehicleType:100, driver:120, vehicleNum:90, p1:105, p2:115, p3:105, p4:115 }
  const [colWidths, setColWidths] = React.useState<Record<string, number>>(() => {
    try { const s = localStorage.getItem(COL_KEY); return s ? { ...defaultWidths, ...JSON.parse(s) } : defaultWidths } catch { return defaultWidths }
  })
  React.useEffect(() => { try { localStorage.setItem(COL_KEY, JSON.stringify(colWidths)) } catch {} }, [colWidths])

  const handleResizeStart = (colId: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX; const startW = colWidths[colId] || 100
    const onMove = (me: MouseEvent) => setColWidths(p => ({ ...p, [colId]: Math.max(50, startW + (startX - me.clientX)) }))
    const onUp = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp) }
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp)
  }

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) setShowCustomerSuggestions(false)
      if (driverRef.current && !driverRef.current.contains(e.target as Node)) setShowDriverSuggestions(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  React.useEffect(() => {
    const load = async () => {
      try {
        const [custRes, drvRes] = await Promise.all([
          fetch(`/api/customers?tenant=${tenantId}`),
          fetch(`/api/drivers?tenant=${tenantId}`),
        ])
        if (custRes.ok) {
          const data = await custRes.json()
          const names = (data.records || []).map((r: any) => r.fields?.[tenantFields?.customers?.NAME] || "").filter(Boolean)
          setCustomerOptions([...new Set(names)] as string[])
        }
        if (drvRes.ok) {
          const data = await drvRes.json()
          const map = new Map<string, string>()
          const list: { id: string; name: string }[] = []
          const names = (data.records || []).map((r: any) => {
            const name = r.fields?.[tenantFields?.drivers?.FIRST_NAME] || ""
            if (r.id && name) { map.set(r.id, name); list.push({ id: r.id, name }) }
            return name
          }).filter(Boolean)
          driverNamesRef.current = map; setDriverList(list)
          setDriverOptions([...new Set(names)] as string[])
        }
      } catch {}
    }
    if (tenantFields) load()
  }, [tenantFields, tenantId])

  const filteredCustomerSuggestions = React.useMemo(() => {
    if (!tempFilters.customerName.trim()) return customerOptions.slice(0, 15)
    return customerOptions.filter(n => n.toLowerCase().includes(tempFilters.customerName.toLowerCase())).slice(0, 15)
  }, [customerOptions, tempFilters.customerName])

  const filteredDriverSuggestions = React.useMemo(() => {
    if (!tempFilters.driverName.trim()) return driverOptions.slice(0, 15)
    return driverOptions.filter(n => n.toLowerCase().includes(tempFilters.driverName.toLowerCase())).slice(0, 15)
  }, [driverOptions, tempFilters.driverName])

  const bulkDriverSuggestions = React.useMemo(() =>
    driverList.filter(d => d.name.toLowerCase().includes(bulkDriverName.toLowerCase())).slice(0, 15),
    [driverList, bulkDriverName])

  const openFilterDialog = () => { setTempFilters(filters); setShowFilterDialog(true) }

  const applyFilters = async () => {
    setFilters(tempFilters); setShowFilterDialog(false); setSelectedIds(new Set()); setIsLoading(true)
    try {
      let allRecords: RideRecord[] = []; let skip = 0
      while (true) {
        const r = await fetch(`/api/work-schedule?tenant=${tenantId}&take=1000&skip=${skip}&_t=${Date.now()}`)
        if (!r.ok) throw new Error("fetch failed")
        const json = await r.json(); const records = json.records || []
        allRecords = allRecords.concat(records)
        if (records.length < 1000) break; skip += 1000
      }
      setAllData(allRecords.map(rec => {
        const v = rec.fields[WS.DRIVER]; const driverId = Array.isArray(v) ? v[0]?.id : null
        if (driverId && driverNamesRef.current.has(driverId)) {
          return { ...rec, fields: { ...rec.fields, _driverName: driverNamesRef.current.get(driverId) } }
        }
        return rec
      }))
      setHasSearched(true)
    } catch { toast({ title: "שגיאה בטעינת נתונים", variant: "destructive" }) }
    finally { setIsLoading(false) }
  }

  const filteredData = React.useMemo(() => {
    let d = allData
    if (filters.startDate) { const s = format(filters.startDate, "yyyy-MM-dd"); d = d.filter(r => (r.fields[WS.DATE] || "").substring(0, 10) >= s) }
    if (filters.endDate) { const e = format(filters.endDate, "yyyy-MM-dd"); d = d.filter(r => (r.fields[WS.DATE] || "").substring(0, 10) <= e) }
    if (filters.customerName.trim()) { const q = filters.customerName.toLowerCase(); d = d.filter(r => renderLink(r.fields[WS.CUSTOMER]).toLowerCase().includes(q)) }
    if (filters.driverName.trim()) { const q = filters.driverName.toLowerCase(); d = d.filter(r => ((r.fields as any)._driverName || renderLink(r.fields[WS.DRIVER])).toLowerCase().includes(q)) }
    if (filters.description.trim()) { const q = filters.description.toLowerCase(); d = d.filter(r => (r.fields[WS.DESCRIPTION] || "").toLowerCase().includes(q)) }
    if (!filters.withClientPrice) d = d.filter(r => !(Number(r.fields[WS.PRICE_CLIENT_EXCL]) > 0))
    if (!filters.withoutClientPrice) d = d.filter(r => Number(r.fields[WS.PRICE_CLIENT_EXCL]) > 0)
    if (!filters.withDriverPrice) d = d.filter(r => !(Number(r.fields[WS.PRICE_DRIVER_EXCL]) > 0))
    if (!filters.withoutDriverPrice) d = d.filter(r => Number(r.fields[WS.PRICE_DRIVER_EXCL]) > 0)
    if (globalFilter.trim()) { const q = globalFilter.toLowerCase(); d = d.filter(r => Object.values(r.fields).some(v => String(v || "").toLowerCase().includes(q))) }
    return d
  }, [allData, filters, globalFilter, WS])

  const filterSummary = React.useMemo(() => {
    const parts: string[] = []
    if (filters.startDate && filters.endDate) parts.push(`${format(filters.startDate, "dd/MM/yyyy")} - ${format(filters.endDate, "dd/MM/yyyy")}`)
    if (filters.customerName) parts.push(`לקוח: ${filters.customerName}`)
    if (filters.driverName) parts.push(`נהג: ${filters.driverName}`)
    if (filters.description) parts.push(`מסלול: ${filters.description}`)
    return parts.join(" | ")
  }, [filters])

  const totals = React.useMemo(() => ({
    p1: Math.round(filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_CLIENT_EXCL]) || 0), 0)),
    p2: Math.round(filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_CLIENT_INCL]) || 0), 0)),
    p3: Math.round(filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_DRIVER_EXCL]) || 0), 0)),
    p4: Math.round(filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_DRIVER_INCL]) || 0), 0)),
    p5: Math.round(filteredData.reduce((s, r) => s + ((Number(r.fields[WS.PRICE_CLIENT_EXCL]) || 0) - (Number(r.fields[WS.PRICE_DRIVER_EXCL]) || 0)), 0)),
    p6: Math.round(filteredData.reduce((s, r) => s + ((Number(r.fields[WS.PRICE_CLIENT_INCL]) || 0) - (Number(r.fields[WS.PRICE_DRIVER_INCL]) || 0)), 0)),
  }), [filteredData, WS])

  const allSelected = filteredData.length > 0 && selectedIds.size === filteredData.length
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(filteredData.map(r => r.id)))
  const toggleRow = (id: string) => { const s = new Set(selectedIds); s.has(id) ? s.delete(id) : s.add(id); setSelectedIds(s) }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    setIsUpdating(true)
    const results = await Promise.all(Array.from(selectedIds).map(id =>
      requestQueue.add(async () => {
        const res = await fetch(`/api/work-schedule/${id}?tenant=${tenantId}`, { method: "DELETE" })
        return res.ok
      }).catch(() => false)
    ))
    const errors = results.filter(ok => !ok).length
    setIsUpdating(false); setShowDeleteDialog(false); setSelectedIds(new Set())
    await applyFilters()
    errors > 0 ? toast({ title: "שגיאה", description: `נכשלה מחיקת ${errors} נסיעות`, variant: "destructive" })
               : toast({ title: "הצלחה", description: `נמחקו ${selectedIds.size} נסיעות` })
  }

  const handleBulkUpdateDriver = async () => {
    if (!bulkDriverId || selectedIds.size === 0) return
    setIsUpdating(true)
    const results = await Promise.all(Array.from(selectedIds).map(id =>
      requestQueue.add(async () => {
        const res = await fetch(`/api/work-schedule/${id}?tenant=${tenantId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: { [WS.DRIVER]: [bulkDriverId] } })
        }); return res.ok
      }).catch(() => false)
    ))
    const errors = results.filter(ok => !ok).length
    setIsUpdating(false); setShowDriverDialog(false); setBulkDriverId(""); setBulkDriverName("")
    await applyFilters()
    errors > 0 ? toast({ title: "שגיאה", description: `נכשל עדכון ${errors} נסיעות`, variant: "destructive" })
               : toast({ title: "הצלחה", description: `עודכן נהג ב-${selectedIds.size} נסיעות` })
  }

  const handleBulkUpdatePrices = async () => {
    if (selectedIds.size === 0 || (!updateClient && !updateDriver)) return
    setIsUpdating(true)
    const fields: Record<string, any> = {}
    if (updateClient && priceClientExcl !== "") fields[WS.PRICE_CLIENT_EXCL] = parseFloat(priceClientExcl) || 0
    if (updateClient && priceClientIncl !== "") fields[WS.PRICE_CLIENT_INCL] = parseFloat(priceClientIncl) || 0
    if (updateDriver && priceDriverExcl !== "") fields[WS.PRICE_DRIVER_EXCL] = parseFloat(priceDriverExcl) || 0
    if (updateDriver && priceDriverIncl !== "") fields[WS.PRICE_DRIVER_INCL] = parseFloat(priceDriverIncl) || 0
    if (Object.keys(fields).length === 0) { setIsUpdating(false); toast({ title: "שים לב", description: "לא הוזנו ערכים", variant: "destructive" }); return }
    const results = await Promise.all(Array.from(selectedIds).map(id =>
      requestQueue.add(async () => {
        const res = await fetch(`/api/work-schedule/${id}?tenant=${tenantId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields })
        }); return res.ok
      }).catch(() => false)
    ))
    const errors = results.filter(ok => !ok).length
    setIsUpdating(false); setShowPriceDialog(false)
    setPriceClientExcl(""); setPriceClientIncl(""); setPriceDriverExcl(""); setPriceDriverIncl("")
    await applyFilters()
    errors > 0 ? toast({ title: "שגיאה", description: `נכשל עדכון ${errors} נסיעות`, variant: "destructive" })
               : toast({ title: "הצלחה", description: `מחירים עודכנו ב-${selectedIds.size} נסיעות` })
  }

  const colDefs = [
    { id: "sel",         label: "",               width: colWidths.sel || 45,  noResize: true, noDrag: true },
    { id: "date",        label: "תאריך",           width: colWidths.date || 95 },
    { id: "customer",    label: "שם לקוח",         width: colWidths.customer || 140 },
    { id: "pickup",      label: "הלוך",            width: colWidths.pickup || 75 },
    { id: "route",       label: "מסלול",           width: colWidths.route || 200 },
    { id: "dropoff",     label: "חזור",            width: colWidths.dropoff || 75 },
    { id: "vehicleType", label: "סוג רכב",         width: colWidths.vehicleType || 100 },
    { id: "driver",      label: "שם נהג",          width: colWidths.driver || 120 },
    { id: "vehicleNum",  label: "מס' רכב",         width: colWidths.vehicleNum || 90 },
    { id: "p1",          label: 'לקוח לפני מע"מ',  width: colWidths.p1 || 105 },
    { id: "p2",          label: 'לקוח כולל מע"מ',  width: colWidths.p2 || 115 },
    { id: "p3",          label: 'נהג לפני מע"מ',   width: colWidths.p3 || 105 },
    { id: "p4",          label: 'נהג כולל מע"מ',   width: colWidths.p4 || 115 },
  ]

  // Sort by columnOrder
  const colDefMap = Object.fromEntries(colDefs.map(c => [c.id, c]))
  const cols = columnOrder.map(id => colDefMap[id]).filter(Boolean)

  const renderCell = (col: string, rec: RideRecord) => {
    const f = rec.fields
    switch (col) {
      case "date":        return f[WS.DATE] ? format(new Date(f[WS.DATE]), "dd/MM/yyyy") : "-"
      case "customer":    return renderLink(f[WS.CUSTOMER])
      case "pickup":      return f[WS.PICKUP_TIME] || "-"
      case "route":       return f[WS.DESCRIPTION] || "-"
      case "dropoff":     return f[WS.DROPOFF_TIME] || "-"
      case "vehicleType": return renderLink(f[WS.VEHICLE_TYPE])
      case "driver":      return (f as any)._driverName || renderLink(f[WS.DRIVER])
      case "vehicleNum":  return f[WS.VEHICLE_NUM] || "-"
      case "p1":          return (Number(f[WS.PRICE_CLIENT_EXCL]) || 0).toLocaleString()
      case "p2":          return (Number(f[WS.PRICE_CLIENT_INCL]) || 0).toLocaleString()
      case "p3":          return (Number(f[WS.PRICE_DRIVER_EXCL]) || 0).toLocaleString()
      case "p4":          return (Number(f[WS.PRICE_DRIVER_INCL]) || 0).toLocaleString()
      default:            return "-"
    }
  }

  return (
    <>
      {/* ====== Filter Dialog ====== */}
      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent className="sm:max-w-[480px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>דוח נסיעות כללי</DialogTitle>
            <DialogDescription>בחר פרמטרים לדוח</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
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
                    <Calendar mode="single" selected={tempFilters.startDate} onSelect={d => {
                      if (d) {
                        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0)
                        setTempFilters(p => ({ ...p, startDate: d, endDate: endOfMonth }))
                      } else {
                        setTempFilters(p => ({ ...p, startDate: d }))
                      }
                      setStartCalOpen(false)
                    }} locale={he} dir="rtl" initialFocus />
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
                    <Calendar mode="single" selected={tempFilters.endDate} onSelect={d => { setTempFilters(p => ({ ...p, endDate: d })); setEndCalOpen(false) }} locale={he} dir="rtl" initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold">שם לקוח</Label>
              <div className="relative" ref={customerRef}>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="חפש לקוח..." value={tempFilters.customerName}
                    onChange={e => { setTempFilters(p => ({ ...p, customerName: e.target.value })); setShowCustomerSuggestions(true) }}
                    onFocus={() => setShowCustomerSuggestions(true)} className="pr-9 h-10" />
                  {tempFilters.customerName && (
                    <button className="absolute left-3 top-1/2 -translate-y-1/2" onClick={() => { setTempFilters(p => ({ ...p, customerName: "" })); setShowCustomerSuggestions(false) }}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
                {showCustomerSuggestions && filteredCustomerSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 max-h-[160px] overflow-auto bg-popover border rounded-md shadow-md">
                    {filteredCustomerSuggestions.map((name, i) => (
                      <button key={i} className="w-full text-right px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => { setTempFilters(p => ({ ...p, customerName: name })); setShowCustomerSuggestions(false) }}>{name}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold">שם נהג</Label>
              <div className="relative" ref={driverRef}>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="חפש נהג..." value={tempFilters.driverName}
                    onChange={e => { setTempFilters(p => ({ ...p, driverName: e.target.value })); setShowDriverSuggestions(true) }}
                    onFocus={() => setShowDriverSuggestions(true)} className="pr-9 h-10" />
                  {tempFilters.driverName && (
                    <button className="absolute left-3 top-1/2 -translate-y-1/2" onClick={() => { setTempFilters(p => ({ ...p, driverName: "" })); setShowDriverSuggestions(false) }}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
                {showDriverSuggestions && filteredDriverSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 max-h-[160px] overflow-auto bg-popover border rounded-md shadow-md">
                    {filteredDriverSuggestions.map((name, i) => (
                      <button key={i} className="w-full text-right px-3 py-2 text-sm hover:bg-accent transition-colors"
                        onClick={() => { setTempFilters(p => ({ ...p, driverName: name })); setShowDriverSuggestions(false) }}>{name}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold">תיאור מסלול</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="חפש מסלול..." value={tempFilters.description}
                  onChange={e => setTempFilters(p => ({ ...p, description: e.target.value }))} className="pr-9 h-10" />
                {tempFilters.description && (
                  <button className="absolute left-3 top-1/2 -translate-y-1/2" onClick={() => setTempFilters(p => ({ ...p, description: "" }))}>
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold">סינון מחירים</Label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={tempFilters.withClientPrice} onCheckedChange={c => setTempFilters(p => ({ ...p, withClientPrice: !!c }))} />
                  נסיעות עם מחיר לקוח
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={tempFilters.withoutClientPrice} onCheckedChange={c => setTempFilters(p => ({ ...p, withoutClientPrice: !!c }))} />
                  נסיעות ללא מחיר לקוח
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={tempFilters.withDriverPrice} onCheckedChange={c => setTempFilters(p => ({ ...p, withDriverPrice: !!c }))} />
                  נסיעות עם מחיר נהג
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={tempFilters.withoutDriverPrice} onCheckedChange={c => setTempFilters(p => ({ ...p, withoutDriverPrice: !!c }))} />
                  נסיעות ללא מחיר נהג
                </label>
              </div>
            </div>

            <Button onClick={applyFilters} disabled={isLoading} className="h-10 mt-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Search className="h-4 w-4 ml-2" />}
              הצג דוח
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== Bulk Driver Dialog ====== */}
      <Dialog open={showDriverDialog} onOpenChange={o => { setShowDriverDialog(o); if (!o) { setBulkDriverId(""); setBulkDriverName("") } }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-orange-500" /> עדכון נהג</DialogTitle>
            <DialogDescription>יעדכן {selectedIds.size} נסיעות נבחרות</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>בחר נהג</Label>
            <div className="relative">
              <Input value={bulkDriverName}
                onChange={e => { setBulkDriverName(e.target.value); setBulkDriverId(""); setDriverSuggestOpen(true) }}
                onFocus={() => setDriverSuggestOpen(true)}
                onBlur={() => setTimeout(() => setDriverSuggestOpen(false), 200)}
                placeholder="הקלד שם נהג..." className="text-right" />
              {driverSuggestOpen && bulkDriverSuggestions.length > 0 && (
                <div className="absolute z-50 w-full bg-white border rounded-md shadow-md max-h-48 overflow-auto mt-1 text-right">
                  {bulkDriverSuggestions.map(d => (
                    <div key={d.id} className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                      onMouseDown={() => { setBulkDriverName(d.name); setBulkDriverId(d.id); setDriverSuggestOpen(false) }}>{d.name}</div>
                  ))}
                </div>
              )}
            </div>
            {bulkDriverId && <p className="text-xs text-green-600">✓ נבחר: {bulkDriverName}</p>}
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="outline" onClick={() => setShowDriverDialog(false)}>ביטול</Button>
            <Button onClick={handleBulkUpdateDriver} disabled={!bulkDriverId || isUpdating}>
              {isUpdating && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              עדכן {selectedIds.size} נסיעות
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Bulk Price Dialog ====== */}
      <Dialog open={showPriceDialog} onOpenChange={o => { setShowPriceDialog(o); if (!o) { setPriceClientExcl(""); setPriceClientIncl(""); setPriceDriverExcl(""); setPriceDriverIncl("") } }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-orange-500" /> עדכון מחירים</DialogTitle>
            <DialogDescription>יעדכן {selectedIds.size} נסיעות נבחרות. שדה ריק = לא ישתנה.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="uc" checked={updateClient} onCheckedChange={v => setUpdateClient(!!v)} />
                <Label htmlFor="uc" className="cursor-pointer font-medium">מחיר לקוח</Label>
              </div>
              {updateClient && (
                <div className="grid grid-cols-2 gap-3 pr-6">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">לפני מע"מ</Label>
                    <Input type="number" value={priceClientExcl} placeholder="0" className="h-8 text-sm"
                      onChange={e => { setPriceClientExcl(e.target.value); if (e.target.value !== "") setPriceClientIncl(String(Math.round(parseFloat(e.target.value) * VAT * 100) / 100)) }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">כולל מע"מ</Label>
                    <Input type="number" value={priceClientIncl} placeholder="0" className="h-8 text-sm font-bold"
                      onChange={e => { setPriceClientIncl(e.target.value); if (e.target.value !== "") setPriceClientExcl(String(Math.round(parseFloat(e.target.value) / VAT * 100) / 100)) }} />
                  </div>
                </div>
              )}
            </div>
            <div className="border-t" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="ud" checked={updateDriver} onCheckedChange={v => setUpdateDriver(!!v)} />
                <Label htmlFor="ud" className="cursor-pointer font-medium">מחיר נהג</Label>
              </div>
              {updateDriver && (
                <div className="grid grid-cols-2 gap-3 pr-6">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">לפני מע"מ</Label>
                    <Input type="number" value={priceDriverExcl} placeholder="0" className="h-8 text-sm"
                      onChange={e => { setPriceDriverExcl(e.target.value); if (e.target.value !== "") setPriceDriverIncl(String(Math.round(parseFloat(e.target.value) * VAT * 100) / 100)) }} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">כולל מע"מ</Label>
                    <Input type="number" value={priceDriverIncl} placeholder="0" className="h-8 text-sm font-bold"
                      onChange={e => { setPriceDriverIncl(e.target.value); if (e.target.value !== "") setPriceDriverExcl(String(Math.round(parseFloat(e.target.value) / VAT * 100) / 100)) }} />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="outline" onClick={() => setShowPriceDialog(false)}>ביטול</Button>
            <Button onClick={handleBulkUpdatePrices} disabled={isUpdating || (!updateClient && !updateDriver)}>
              {isUpdating && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              עדכן {selectedIds.size} נסיעות
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Main View ====== */}
      <div className="w-full h-[calc(100vh-2rem)] flex flex-col p-2 md:p-4 overflow-hidden" dir="rtl">
        <div className="flex items-center gap-1.5 md:gap-3 pb-2 md:pb-3 flex-none flex-nowrap overflow-hidden">
          <Button variant="outline" size="sm" onClick={openFilterDialog} className="shrink-0 text-xs md:text-sm h-8 md:h-9 px-2 md:px-3">
            <SlidersHorizontal className="h-3.5 w-3.5 md:h-4 md:w-4 ml-1 md:ml-2" />
            שינוי סינון
          </Button>

          <Button variant={selectedIds.size > 0 ? "default" : "outline"} size="sm"
            className={`shrink-0 text-xs md:text-sm h-8 md:h-9 px-2 md:px-3 gap-1 transition-colors ${selectedIds.size > 0 ? "bg-orange-500 hover:bg-orange-600 text-white" : "opacity-50 cursor-not-allowed"}`}
            onClick={() => setShowDriverDialog(true)} disabled={selectedIds.size === 0}>
            <UserCog className="h-3.5 w-3.5" /> עדכן נהג
          </Button>

          <Button variant={selectedIds.size > 0 ? "default" : "outline"} size="sm"
            className={`shrink-0 text-xs md:text-sm h-8 md:h-9 px-2 md:px-3 gap-1 transition-colors ${selectedIds.size > 0 ? "bg-orange-500 hover:bg-orange-600 text-white" : "opacity-50 cursor-not-allowed"}`}
            onClick={() => setShowPriceDialog(true)} disabled={selectedIds.size === 0}>
            <DollarSign className="h-3.5 w-3.5" /> עדכן מחיר
          </Button>

          <Button variant={selectedIds.size > 0 ? "default" : "outline"} size="sm"
            className={`shrink-0 text-xs md:text-sm h-8 md:h-9 px-2 md:px-3 gap-1 transition-colors ${selectedIds.size > 0 ? "bg-red-500 hover:bg-red-600 text-white" : "opacity-50 cursor-not-allowed"}`}
            onClick={() => setShowDeleteDialog(true)} disabled={selectedIds.size === 0}>
            <Trash2 className="h-3.5 w-3.5" /> מחק
          </Button>

          {hasSearched && (
            <div className="text-[10px] md:text-xs text-muted-foreground border rounded px-2 md:px-3 py-1 md:py-1.5 bg-muted/30 shrink-0 truncate max-w-[220px]">
              {filterSummary}
            </div>
          )}

          {hasSearched && (
            <Input placeholder="חיפוש חופשי..." value={globalFilter} onChange={e => setGlobalFilter(e.target.value)}
              className="w-[120px] md:w-[200px] h-8 md:h-9 text-xs md:text-sm shrink-0" />
          )}

          {hasSearched && (
            <div className="hidden md:flex bg-card p-1.5 lg:p-2 px-2 lg:px-4 rounded-md border shadow-sm items-center gap-2 lg:gap-4 whitespace-nowrap shrink-0 mr-auto">
              <span className="text-muted-foreground text-[10px] lg:text-xs font-medium">
                סה"כ שורות: <span className="font-bold text-foreground text-xs lg:text-sm">{filteredData.length}</span>
                {selectedIds.size > 0 && <span className="mr-2 text-orange-600 font-bold">({selectedIds.size} נבחרו)</span>}
              </span>
            </div>
          )}

          {hasSearched && (
            <div className="flex md:hidden items-center gap-1 bg-card border rounded px-2 py-1 shadow-sm shrink-0 mr-auto">
              <span className="text-[10px] text-muted-foreground">
                {filteredData.length} שורות{selectedIds.size > 0 && <span className="text-orange-600 font-bold mr-1">({selectedIds.size} נבחרו)</span>}
              </span>
            </div>
          )}

          {hasSearched && filteredData.length > 0 && (
            <div className="hidden lg:flex gap-2 xl:gap-3 text-[10px] xl:text-sm bg-muted/20 p-1.5 xl:p-2 px-2 xl:px-4 rounded-md border shadow-sm items-center shrink-0">
              <div className="flex flex-col gap-0.5 items-start justify-center whitespace-nowrap">
                <span>לקוח+ מע"מ: <span className="font-bold">{totals.p1.toLocaleString()} ₪</span></span>
                <span>לקוח כולל: <span className="font-bold">{totals.p2.toLocaleString()} ₪</span></span>
              </div>
              <div className="w-px bg-border self-stretch my-1" />
              <div className="flex flex-col gap-0.5 items-start justify-center whitespace-nowrap">
                <span>נהג+ מע"מ: <span className="font-bold">{totals.p3.toLocaleString()} ₪</span></span>
                <span>נהג כולל: <span className="font-bold">{totals.p4.toLocaleString()} ₪</span></span>
              </div>
              <div className="w-px bg-border self-stretch my-1" />
              <div className="flex flex-col gap-0.5 items-start justify-center text-orange-500 dark:text-orange-400 font-medium whitespace-nowrap">
                <span>רווח+ מע"מ: <span className="font-bold">{totals.p5.toLocaleString()} ₪</span></span>
                <span>רווח כולל: <span className="font-bold">{totals.p6.toLocaleString()} ₪</span></span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-md border flex-1 overflow-auto min-h-0">
          {!hasSearched && !isLoading && (
            <div className="flex items-center justify-center h-full text-muted-foreground"><p>בחר פרמטרים ולחץ "הצג דוח"</p></div>
          )}
          {isLoading && (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin" /><span className="mr-2 text-muted-foreground">טוען נתונים...</span>
            </div>
          )}
          {hasSearched && !isLoading && filteredData.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground">לא נמצאו תוצאות</div>
          )}
          {hasSearched && !isLoading && filteredData.length > 0 && (
            <Table className="relative w-full" style={{ tableLayout: "fixed" }}>
              <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
                <TableRow>
                  {cols.map(col => (
                    <TableHead key={col.id} className="text-right border-l relative select-none" style={{ width: col.width }}
                      draggable={!col.noDrag}
                      onDragStart={() => !col.noDrag && setDraggedCol(col.id)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => {
                        if (draggedCol && draggedCol !== col.id && !col.noDrag) {
                          const newOrder = [...columnOrder]
                          const fromIdx = newOrder.indexOf(draggedCol)
                          const toIdx = newOrder.indexOf(col.id)
                          if (fromIdx !== -1 && toIdx !== -1) {
                            newOrder.splice(fromIdx, 1)
                            newOrder.splice(toIdx, 0, draggedCol)
                            setColumnOrder(newOrder)
                          }
                        }
                        setDraggedCol(null)
                      }}
                    >
                      {col.id === "sel"
                        ? <div className="flex items-center justify-center"><Checkbox checked={allSelected} onCheckedChange={toggleAll} /></div>
                        : <div className="flex items-center gap-1 cursor-grab">{col.label}</div>
                      }
                      {!col.noResize && (
                        <div onMouseDown={e => handleResizeStart(col.id, e)}
                          className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary transition-colors duration-200 z-20" />
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map(rec => (
                  <TableRow key={rec.id}
                    className={`cursor-pointer hover:bg-muted/50 transition-colors ${selectedIds.has(rec.id) ? "bg-orange-50" : ""}`}
                    onClick={() => toggleRow(rec.id)}>
                    {cols.map(col => (
                      <TableCell key={col.id} className="border-l truncate text-right text-sm" style={{ width: col.width }}
                        onClick={col.id === "sel" ? e => e.stopPropagation() : undefined}>
                        {col.id === "sel"
                          ? <Checkbox checked={selectedIds.has(rec.id)} onCheckedChange={() => toggleRow(rec.id)} />
                          : renderCell(col.id, rec)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
      {/* ====== Delete AlertDialog ====== */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת נסיעות</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק <strong>{selectedIds.size} נסיעות</strong> לצמיתות?
              <br />פעולה זו אינה ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={handleBulkDelete}>
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              כן, מחק לצמיתות
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
