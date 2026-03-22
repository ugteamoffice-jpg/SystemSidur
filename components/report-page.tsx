"use client"

import * as React from "react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { requestQueue } from "@/lib/request-queue"
import { Calendar as CalendarIcon, Loader2, Search, X, LayoutDashboard, SlidersHorizontal, Download, FileSpreadsheet, Printer, Receipt, LayoutGrid } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { useTenantFields, useTenant } from "@/lib/tenant-context"
import { useToast } from "@/hooks/use-toast"
import { loadReportSettings } from "@/components/report-settings-dialog"
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
  description: string
  clientPriceFilter: "all" | "with" | "without"
  driverPriceFilter: "all" | "with" | "without"
  invoiceFilter: "all" | "with" | "without"
}

const escapeHtml = (str: string) => {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

// Field ID for Invoice Number
// INVOICE_FIELD_ID now comes from tenant config (see below)

export function ReportPage({ reportType }: ReportPageProps) {
  const tenantFields = useTenantFields()
  const { tenantId } = useTenant()
  const WS = tenantFields?.workSchedule || ({} as any)
  const INVOICE_FIELD_ID = WS.INVOICE || ""
  const { toast } = useToast()

  const [allData, setAllData] = React.useState<WorkScheduleRecord[]>([])
  const driverNamesRef = React.useRef<Map<string, string>>(new Map())
  const [isLoading, setIsLoading] = React.useState(false)
  const [showFilterDialog, setShowFilterDialog] = React.useState(true)
  const [hasSearched, setHasSearched] = React.useState(false)
  const [globalFilter, setGlobalFilter] = React.useState("")

  // Edit Ride Dialog State
  const [editingRecord, setEditingRecord] = React.useState<WorkScheduleRecord | null>(null)

  // Selection & Bulk Invoice State
  const [selectedRowIds, setSelectedRowIds] = React.useState<Set<string>>(new Set())
  const [showInvoiceDialog, setShowInvoiceDialog] = React.useState(false)
  const [bulkInvoiceNum, setBulkInvoiceNum] = React.useState("")
  const [isUpdatingInvoice, setIsUpdatingInvoice] = React.useState(false)
  const [invoiceProgress, setInvoiceProgress] = React.useState({ current: 0, total: 0 })
  // Driver assign
  const [showDriverAssignDialog, setShowDriverAssignDialog] = React.useState(false)
  const [driversList, setDriversList] = React.useState<{id: string, title: string}[]>([])
  const [selectedDriverId, setSelectedDriverId] = React.useState("")
  const [driverSearch, setDriverSearch] = React.useState("")

  // Column resizing with localStorage persistence
  const REPORT_COL_KEY = `reportColumnWidths_${tenantId}_${reportType}`
  const defaultWidths: Record<string, number> = {
    select: 45, invoiceNum: 90, date: 95, customer: 130, pickup: 80, route: 200, dropoff: 80, 
    vehicleType: 100, driver: 110, vehicleNum: 85, 
    p1: 100, p2: 110, p3: 100, p4: 100, profit: 80
  }
  const [colWidths, setColWidths] = React.useState<Record<string, number>>(defaultWidths)
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(REPORT_COL_KEY)
      if (saved) setColWidths(prev => ({ ...prev, ...JSON.parse(saved) }))
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [REPORT_COL_KEY])
  React.useEffect(() => {
    try { localStorage.setItem(REPORT_COL_KEY, JSON.stringify(colWidths)) } catch {}
  }, [colWidths, REPORT_COL_KEY])

  // Sort state
  const [sortCol, setSortCol] = React.useState<string | null>(null)
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc")
  const handleSortCol = (colId: string) => {
    if (sortCol === colId) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortCol(colId); setSortDir("asc") }
  }

  // Column resize
  const resizingCol = React.useRef<string | null>(null)
  const resizeStartX = React.useRef(0)
  const resizeStartW = React.useRef(0)
  const startResize = React.useCallback((e: React.MouseEvent, colId: string, curWidth: number) => {
    e.preventDefault(); e.stopPropagation()
    resizingCol.current = colId; resizeStartX.current = e.clientX; resizeStartW.current = curWidth
    const onMove = (ev: MouseEvent) => {
      const diff = resizeStartX.current - ev.clientX
      setColWidths(p => ({ ...p, [resizingCol.current!]: Math.max(50, resizeStartW.current + diff) }))
    }
    const onUp = () => { resizingCol.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp) }
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp)
  }, [])

  // Column order + drag
  const REPORT_COL_ORDER_KEY = `reportColumnOrder_${tenantId}_${reportType}`
  const [reportColumnOrder, setReportColumnOrder] = React.useState<string[] | null>(() => {
    if (typeof window !== 'undefined') { try { const s = localStorage.getItem(REPORT_COL_ORDER_KEY); if (s) return JSON.parse(s) } catch {} }
    return null
  })
  React.useEffect(() => {
    if (typeof window !== 'undefined' && reportColumnOrder) {
      try { localStorage.setItem(REPORT_COL_ORDER_KEY, JSON.stringify(reportColumnOrder)) } catch {}
    }
  }, [reportColumnOrder, REPORT_COL_ORDER_KEY])
  const [reportDraggingColId, setReportDraggingColId] = React.useState<string | null>(null)

  // --- Visible table columns per report type ---
  type TableColDef = {
    id: string; label: string; width: number
    render: (record: WorkScheduleRecord) => React.ReactNode
    cls?: string
  }
  const tableColumns = React.useMemo((): TableColDef[] => {
    const mkDate = (r: WorkScheduleRecord) => r.fields[WS.DATE] ? format(new Date(r.fields[WS.DATE]), "dd/MM/yyyy") : "-"
    const mkPickup = (r: WorkScheduleRecord) => r.fields[WS.PICKUP_TIME] || "-"
    const mkRoute = (r: WorkScheduleRecord) => r.fields[WS.DESCRIPTION] || "-"
    const mkDropoff = (r: WorkScheduleRecord) => r.fields[WS.DROPOFF_TIME] || "-"
    const mkVehicle = (r: WorkScheduleRecord) => renderLinkField(r.fields[WS.VEHICLE_TYPE])
    const mkVehicleNum = (r: WorkScheduleRecord) => r.fields[WS.VEHICLE_NUM] || "-"
    const mkCustomer = (r: WorkScheduleRecord) => renderLinkField(r.fields[WS.CUSTOMER])
    const mkDriver = (r: WorkScheduleRecord) => (r.fields as any)._driverFullName || renderLinkField(r.fields[WS.DRIVER])
    const mkP1 = (r: WorkScheduleRecord) => (Number(r.fields[WS.PRICE_CLIENT_EXCL]) || 0).toLocaleString()
    const mkP2 = (r: WorkScheduleRecord) => (Number(r.fields[WS.PRICE_CLIENT_INCL]) || 0).toLocaleString()
    const mkP3 = (r: WorkScheduleRecord) => (Number(r.fields[WS.PRICE_DRIVER_EXCL]) || 0).toLocaleString()
    const mkP4 = (r: WorkScheduleRecord) => (Number(r.fields[WS.PRICE_DRIVER_INCL]) || 0).toLocaleString()
    const mkProfit = (r: WorkScheduleRecord) => (Number(r.fields[WS.PROFIT]) || 0).toLocaleString()
    const mkInvoice = (r: WorkScheduleRecord) => r.fields[INVOICE_FIELD_ID] || "-"

    if (reportType === "report-driver") {
      return [
        { id: "date", label: "תאריך", width: colWidths.date || 95, render: mkDate },
        { id: "pickup", label: "הלוך", width: colWidths.pickup || 80, render: mkPickup },
        { id: "route", label: "מסלול", width: colWidths.route || 200, render: mkRoute },
        { id: "dropoff", label: "חזור", width: colWidths.dropoff || 80, render: mkDropoff },
        { id: "vehicleType", label: "סוג רכב", width: colWidths.vehicleType || 100, render: mkVehicle },
        { id: "driver", label: "שם נהג", width: colWidths.driver || 110, render: mkDriver },
        { id: "vehicleNum", label: "מספר רכב", width: colWidths.vehicleNum || 85, render: mkVehicleNum },
        { id: "p3", label: 'נהג לפני מע"מ', width: colWidths.p3 || 100, render: mkP3 },
        { id: "p4", label: 'נהג כולל מע"מ', width: colWidths.p4 || 100, render: mkP4 },
      ]
    } else if (reportType === "report-customer") {
      return [
        { id: "date", label: "תאריך", width: colWidths.date || 95, render: mkDate },
        { id: "customer", label: "שם לקוח", width: colWidths.customer || 130, render: mkCustomer },
        { id: "pickup", label: "הלוך", width: colWidths.pickup || 80, render: mkPickup },
        { id: "route", label: "מסלול", width: colWidths.route || 200, render: mkRoute },
        { id: "vehicleType", label: "סוג רכב", width: colWidths.vehicleType || 100, render: mkVehicle },
        { id: "driver", label: "שם נהג", width: colWidths.driver || 110, render: mkDriver },
        { id: "p1", label: 'לקוח לפני מע"מ', width: colWidths.p1 || 110, render: mkP1 },
        { id: "p2", label: 'לקוח כולל מע"מ', width: colWidths.p2 || 110, render: mkP2 },
      ]
    } else if (reportType === "report-invoices") {
      return [
        { id: "invoiceNum", label: "מס' חשבונית", width: colWidths.invoiceNum || 90, render: mkInvoice },
        { id: "customer", label: "שם לקוח", width: colWidths.customer || 130, render: mkCustomer },
        { id: "date", label: "תאריך", width: colWidths.date || 95, render: mkDate },
        { id: "pickup", label: "הלוך", width: colWidths.pickup || 80, render: mkPickup },
        { id: "route", label: "מסלול", width: colWidths.route || 200, render: mkRoute },
        { id: "dropoff", label: "חזור", width: colWidths.dropoff || 80, render: mkDropoff },
        { id: "vehicleType", label: "סוג רכב", width: colWidths.vehicleType || 100, render: mkVehicle },
        { id: "p1", label: 'לקוח לפני מע"מ', width: colWidths.p1 || 110, render: mkP1 },
        { id: "p2", label: 'לקוח כולל מע"מ', width: colWidths.p2 || 110, render: mkP2 },
      ]
    } else {
      // report-profit
      return [
        { id: "customer", label: "שם לקוח", width: colWidths.customer || 130, render: mkCustomer },
        { id: "date", label: "תאריך", width: colWidths.date || 95, render: mkDate },
        { id: "pickup", label: "הלוך", width: colWidths.pickup || 80, render: mkPickup },
        { id: "route", label: "מסלול", width: colWidths.route || 200, render: mkRoute },
        { id: "dropoff", label: "חזור", width: colWidths.dropoff || 80, render: mkDropoff },
        { id: "vehicleType", label: "סוג רכב", width: colWidths.vehicleType || 100, render: mkVehicle },
        { id: "driver", label: "שם נהג", width: colWidths.driver || 110, render: mkDriver },
        { id: "p1", label: 'לקוח לפני מע"מ', width: colWidths.p1 || 100, render: mkP1 },
        { id: "p2", label: 'לקוח כולל מע"מ', width: colWidths.p2 || 110, render: mkP2 },
        { id: "p3", label: 'נהג לפני מע"מ', width: colWidths.p3 || 100, render: mkP3 },
        { id: "p4", label: 'נהג כולל מע"מ', width: colWidths.p4 || 100, render: mkP4 },
        { id: "profit", label: "רווח", width: colWidths.profit || 80, render: mkProfit, cls: "text-green-600 dark:text-green-400 font-medium" },
      ]
    }
  }, [reportType, WS, colWidths])

  const displayColumns = React.useMemo(() => {
    if (!reportColumnOrder) return tableColumns
    return reportColumnOrder.map(id => tableColumns.find(c => c.id === id)).filter(Boolean) as TableColDef[]
  }, [tableColumns, reportColumnOrder])
  
  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  const [filters, setFilters] = React.useState<FilterState>({
    startDate: firstOfMonth,
    endDate: today,
    customerName: "",
    driverName: "",
    description: "",
    clientPriceFilter: "all",
    driverPriceFilter: "all",
    invoiceFilter: "all",
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

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerRef.current && !customerRef.current.contains(e.target as Node)) setShowCustomerSuggestions(false)
      if (driverRef.current && !driverRef.current.contains(e.target as Node)) setShowDriverSuggestions(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  React.useEffect(() => {
    const fetchNames = async () => {
      try {
        const [custRes, drvRes] = await Promise.all([
          fetch(`/api/customers?tenant=${tenantId}&take=500`),
          fetch(`/api/drivers?tenant=${tenantId}&take=500`),
        ])
        if (custRes.ok) {
          const data = await custRes.json()
          const names = (data.records || []).map((r: any) => r.fields?.[tenantFields?.customers?.NAME] || "").filter(Boolean)
          setCustomerOptions([...new Set(names)] as string[])
        }
        if (drvRes.ok) {
          const data = await drvRes.json()
          const map = new Map<string, string>()
          const names = (data.records || []).map((r: any) => {
            const name = r.fields?.[tenantFields?.drivers?.FIRST_NAME] || ""
            const full = name.trim()
            if (r.id && full) map.set(r.id, full)
            return full
          }).filter(Boolean)
          setDriverOptions([...new Set(names)] as string[])
          driverNamesRef.current = map
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

  // Fetch drivers list for assign dialog
  const driversListRef = React.useRef<{id: string, title: string}[]>([])
  const fetchDriversList = React.useCallback(async () => {
    if (driversListRef.current.length > 0) {
      setDriversList(driversListRef.current)
      return
    }
    const DRV = tenantFields?.drivers
    if (!DRV?.FIRST_NAME) return
    try {
      const res = await fetch(`/api/drivers?tenant=${tenantId}`)
      const json = await res.json()
      if (!json.records) return
      const items = json.records.map((x: any) => ({
        id: x.id,
        title: (x.fields?.[DRV.FIRST_NAME] || "").trim()
      })).filter((d: any) => d.title)
      driversListRef.current = items
      setDriversList(items)
    } catch {}
  }, [tenantFields, tenantId])

  const bulkUpdateField = React.useCallback(async (ids: string[], fieldKey: string, value: any) => {
    await Promise.all(ids.map(id =>
      requestQueue.add(async () => {
        const res = await fetch(`/api/work-schedule/${id}?tenant=${tenantId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: { [fieldKey]: value } })
        })
        if (!res.ok) throw new Error(`PATCH failed`)
      }).catch(() => {})
    ))
    // Update local data
    setAllData(prev => prev.map(r => ids.includes(r.id) ? { ...r, fields: { ...r.fields, [fieldKey]: value } } : r))
  }, [tenantId])

  const handleAssignDriver = React.useCallback(async () => {
    const driver = driversList.find(d => d.id === selectedDriverId)
    if (!driver) return
    const ids = Array.from(selectedRowIds)
    await bulkUpdateField(ids, WS.DRIVER, [{ id: driver.id, title: driver.title }])
    setShowDriverAssignDialog(false)
    setSelectedDriverId("")
    setDriverSearch("")
  }, [driversList, selectedDriverId, selectedRowIds, bulkUpdateField, WS.DRIVER])

  const openFilterDialog = () => {
    setTempFilters(filters)
    setShowFilterDialog(true)
  }

  const applyFilters = async () => {
    setFilters(tempFilters)
    setShowFilterDialog(false)
    setSelectedRowIds(new Set()) // איפוס בחירות בחיפוש מחדש
    
    try {
      setIsLoading(true)
      // Fetch all records with pagination
      let allRecords: WorkScheduleRecord[] = []
      let skip = 0
      const take = 1000
      while (true) {
        const response = await fetch(`/api/work-schedule?tenant=${tenantId}&take=${take}&skip=${skip}&_t=${Date.now()}`)
        if (!response.ok) throw new Error("Failed to fetch")
        const json = await response.json()
        const records = json.records || []
        allRecords = allRecords.concat(records)
        if (records.length < take) break
        skip += take
      }
      setAllData(allRecords.map(record => {
        const v = record.fields[WS.DRIVER]
        if (Array.isArray(v) && v[0]?.id && driverNamesRef.current.has(v[0].id)) {
          return { ...record, fields: { ...record.fields, _driverFullName: driverNamesRef.current.get(v[0].id) } } as any
        }
        return record
      }))
      setHasSearched(true)
    } catch (error) {
      console.error("Error fetching report data:", error)
      toast({ title: "שגיאה בטעינת נתונים", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const filteredData = React.useMemo(() => {
    let filtered = allData

    if (filters.startDate) {
      const startStr = format(filters.startDate, "yyyy-MM-dd")
      filtered = filtered.filter((r) => (r.fields[WS.DATE] || "").substring(0, 10) >= startStr)
    }
    if (filters.endDate) {
      const endStr = format(filters.endDate, "yyyy-MM-dd")
      filtered = filtered.filter((r) => (r.fields[WS.DATE] || "").substring(0, 10) <= endStr)
    }

    if (filters.customerName.trim()) {
      const search = filters.customerName.trim().toLowerCase()
      filtered = filtered.filter((r) => renderLinkField(r.fields[WS.CUSTOMER]).toLowerCase().includes(search))
    }

    if (filters.driverName.trim()) {
      const search = filters.driverName.trim().toLowerCase()
      filtered = filtered.filter((r) => {
        const name = (r.fields as any)._driverFullName || renderLinkField(r.fields[WS.DRIVER])
        return name.toLowerCase().includes(search)
      })
    }

    if (filters.description.trim()) {
      const search = filters.description.trim().toLowerCase()
      filtered = filtered.filter((r) => (r.fields[WS.DESCRIPTION] || "").toLowerCase().includes(search))
    }

    // Invoice filter
    if (filters.invoiceFilter === "with") {
      filtered = filtered.filter((r) => !!r.fields[INVOICE_FIELD_ID])
    } else if (filters.invoiceFilter === "without") {
      filtered = filtered.filter((r) => !r.fields[INVOICE_FIELD_ID])
    }

    // Price filters
    if (filters.clientPriceFilter === "with") {
      filtered = filtered.filter((r) => Number(r.fields[WS.PRICE_CLIENT_EXCL]) > 0)
    } else if (filters.clientPriceFilter === "without") {
      filtered = filtered.filter((r) => !(Number(r.fields[WS.PRICE_CLIENT_EXCL]) > 0))
    }
    if (filters.driverPriceFilter === "with") {
      filtered = filtered.filter((r) => Number(r.fields[WS.PRICE_DRIVER_EXCL]) > 0)
    } else if (filters.driverPriceFilter === "without") {
      filtered = filtered.filter((r) => !(Number(r.fields[WS.PRICE_DRIVER_EXCL]) > 0))
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
  }, [allData, filters, globalFilter, WS])

  const sortedData = React.useMemo(() => {
    if (!sortCol) return filteredData
    const col = tableColumns.find(c => c.id === sortCol)
    if (!col) return filteredData
    return [...filteredData].sort((a, b) => {
      const av = String(col.render(a) ?? "")
      const bv = String(col.render(b) ?? "")
      const cmp = av.localeCompare(bv, "he")
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filteredData, sortCol, sortDir, tableColumns])

  React.useEffect(() => {
    setSelectedRowIds(new Set())
  }, [filteredData])

  const totals = React.useMemo(() => ({
    totalRows: filteredData.length,
    p1: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_CLIENT_EXCL]) || 0), 0),
    p2: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_CLIENT_INCL]) || 0), 0),
    p3: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_DRIVER_EXCL]) || 0), 0),
    p4: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PRICE_DRIVER_INCL]) || 0), 0),
    p5: filteredData.reduce((s, r) => s + (Number(r.fields[WS.PROFIT]) || 0), 0),
    p6: filteredData.reduce((s, r) => s + ((Number(r.fields[WS.PRICE_CLIENT_INCL]) || 0) - (Number(r.fields[WS.PRICE_DRIVER_INCL]) || 0)), 0),
  }), [filteredData, WS])

  const filterSummary = React.useMemo(() => {
    const parts: string[] = []
    if (filters.startDate && filters.endDate) parts.push(`${format(filters.startDate, "dd/MM/yyyy")} - ${format(filters.endDate, "dd/MM/yyyy")}`)
    if (filters.customerName) parts.push(`לקוח: ${filters.customerName}`)
    if (filters.driverName) parts.push(`נהג: ${filters.driverName}`)
    if (filters.description) parts.push(`מסלול: ${filters.description}`)
    if (filters.invoiceFilter === "with") parts.push("עם חשבונית")
    if (filters.invoiceFilter === "without") parts.push("ללא חשבונית")
    if (filters.clientPriceFilter === "with") parts.push("עם מחיר לקוח")
    if (filters.clientPriceFilter === "without") parts.push("ללא מחיר לקוח")
    if (filters.driverPriceFilter === "with") parts.push("עם מחיר נהג")
    if (filters.driverPriceFilter === "without") parts.push("ללא מחיר נהג")
    return parts.join(" | ")
  }, [filters])

  // --- Row Selection Logic ---
  const handleToggleAll = () => {
    if (selectedRowIds.size === filteredData.length) {
      setSelectedRowIds(new Set())
    } else {
      setSelectedRowIds(new Set(filteredData.map(r => r.id)))
    }
  }

  const handleToggleRow = (id: string) => {
    const newSet = new Set(selectedRowIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedRowIds(newSet)
  }

  // --- Bulk Update Invoice ---
  const handleBulkUpdateInvoice = async () => {
    if (selectedRowIds.size === 0) return
    setIsUpdatingInvoice(true)

    const valueToSave = bulkInvoiceNum.trim() === "" ? null : bulkInvoiceNum
    const ids = Array.from(selectedRowIds)
    setInvoiceProgress({ current: 0, total: ids.length })

    const results = await Promise.all(ids.map((id) =>
      requestQueue.add(async () => {
        const res = await fetch(`/api/work-schedule/${id}?tenant=${tenantId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: { [INVOICE_FIELD_ID]: valueToSave } })
        })
        if (!res.ok) throw new Error(`PATCH failed: ${res.status}`)
        setInvoiceProgress(prev => ({ ...prev, current: prev.current + 1 }))
        return true
      }).catch(() => {
        setInvoiceProgress(prev => ({ ...prev, current: prev.current + 1 }))
        return false
      })
    ))
    const errorCount = results.filter(ok => !ok).length

    await applyFilters()

    setIsUpdatingInvoice(false)
    setInvoiceProgress({ current: 0, total: 0 })
    setShowInvoiceDialog(false)
    setBulkInvoiceNum("")

    if (errorCount > 0) {
      toast({ title: "שגיאה", description: `נכשל בעדכון של ${errorCount} נסיעות`, variant: "destructive" })
    } else {
      toast({ title: "מספרי החשבונית עודכנו בהצלחה" })
    }
  }

  // --- ייצוא לאקסל (CSV) ---
  // Helper: resolve driver full name
  const getDriverFullName = (fields: any): string => {
    if (fields._driverFullName) return fields._driverFullName
    return renderLinkField(fields[WS.DRIVER])
  }

  const exportToCsv = () => {
    if (filteredData.length === 0) return

    const customerLabel = filters.customerName ? ` - ${filters.customerName}` : ""
    const isInvoiceReport = reportType === "report-invoices"

    const headers = isInvoiceReport
      ? ["מס' חשבונית", "תאריך", "התייצבות", "מסלול", "חזור", "סוג רכב", "שם נהג", "מספר רכב", 'לקוח לפני מע"מ', 'לקוח כולל מע"מ']
      : ["מס' חשבונית", "תאריך", "שם לקוח", "התייצבות", "מסלול", "חזור", "סוג רכב", "שם נהג", "מספר רכב", 'לקוח לפני מע"מ', 'לקוח כולל מע"מ', 'נהג לפני מע"מ', 'נהג כולל מע"מ', "רווח"]

    const csvRows = [
      headers.join(","),
      ...filteredData.map(record => {
        const f = record.fields
        const baseRow = isInvoiceReport
          ? [
              `"${f[INVOICE_FIELD_ID] || ""}"`,
              f[WS.DATE] ? format(new Date(f[WS.DATE]), "dd/MM/yyyy") : "",
              `"${f[WS.PICKUP_TIME] || ""}"`,
              `"${(f[WS.DESCRIPTION] || "").replace(/"/g, '""')}"`,
              `"${f[WS.DROPOFF_TIME] || ""}"`,
              `"${renderLinkField(f[WS.VEHICLE_TYPE]).replace(/"/g, '""')}"`,
              `"${getDriverFullName(f).replace(/"/g, '""')}"`,
              `"${f[WS.VEHICLE_NUM] || ""}"`,
              Number(f[WS.PRICE_CLIENT_EXCL]) || 0,
              Number(f[WS.PRICE_CLIENT_INCL]) || 0,
            ]
          : [
              `"${f[INVOICE_FIELD_ID] || ""}"`,
              f[WS.DATE] ? format(new Date(f[WS.DATE]), "dd/MM/yyyy") : "",
              `"${renderLinkField(f[WS.CUSTOMER]).replace(/"/g, '""')}"`,
              `"${f[WS.PICKUP_TIME] || ""}"`,
              `"${(f[WS.DESCRIPTION] || "").replace(/"/g, '""')}"`,
              `"${f[WS.DROPOFF_TIME] || ""}"`,
              `"${renderLinkField(f[WS.VEHICLE_TYPE]).replace(/"/g, '""')}"`,
              `"${getDriverFullName(f).replace(/"/g, '""')}"`,
              `"${f[WS.VEHICLE_NUM] || ""}"`,
              Number(f[WS.PRICE_CLIENT_EXCL]) || 0,
              Number(f[WS.PRICE_CLIENT_INCL]) || 0,
              Number(f[WS.PRICE_DRIVER_EXCL]) || 0,
              Number(f[WS.PRICE_DRIVER_INCL]) || 0,
              Number(f[WS.PROFIT]) || 0,
            ]
        return baseRow.join(",")
      })
    ]

    const csvContent = "\uFEFF" + csvRows.join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${reportTitles[reportType]}${customerLabel}_${format(new Date(), "dd-MM-yyyy")}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // --- ייצוא ל-PDF / הדפסה (עמודות שונות לכל סוג דוח) ---
  // --- PDF / print - per-report column definitions ---
  const exportToPdf = () => {
    if (filteredData.length === 0) return

    const settings = loadReportSettings(tenantId)

    const entityName =
      reportType === "report-driver" ? (filters.driverName || "") :
      reportType === "report-customer" ? (filters.customerName || "") : ""
    const entityLabel = reportType === "report-driver" ? "נהג" : "לקוח"

    interface ColDef {
      header: string; width?: string; cls?: string
      getValue: (f: any) => string; isTotalField?: "p1"|"p2"|"p3"|"p4"|"p5"
    }

    const mkDate = (f: any) => f[WS.DATE] ? format(new Date(f[WS.DATE]), "dd/MM/yyyy") : ""
    const mkGo   = (f: any) => escapeHtml(f[WS.PICKUP_TIME] || "-")
    const mkRoute = (f: any) => escapeHtml(f[WS.DESCRIPTION] || "-")
    const mkRet  = (f: any) => escapeHtml(f[WS.DROPOFF_TIME] || "-")
    const mkVT   = (f: any) => escapeHtml(renderLinkField(f[WS.VEHICLE_TYPE]))
    const mkVN   = (f: any) => escapeHtml(f[WS.VEHICLE_NUM] || "-")
    const mkCust = (f: any) => escapeHtml(renderLinkField(f[WS.CUSTOMER]))
    const mkDrv  = (f: any) => escapeHtml(getDriverFullName(f))
    const mkP1   = (f: any) => (Number(f[WS.PRICE_CLIENT_EXCL]) || 0).toLocaleString("he-IL")
    const mkP2   = (f: any) => (Number(f[WS.PRICE_CLIENT_INCL]) || 0).toLocaleString("he-IL")
    const mkP3   = (f: any) => (Number(f[WS.PRICE_DRIVER_EXCL]) || 0).toLocaleString("he-IL")
    const mkP4   = (f: any) => (Number(f[WS.PRICE_DRIVER_INCL]) || 0).toLocaleString("he-IL")
    const mkP5   = (f: any) => (Number(f[WS.PROFIT]) || 0).toLocaleString("he-IL")

    let cols: ColDef[] = []

    if (reportType === "report-driver") {
      cols = [
        { header: "תאריך",   width:"70px", cls:"c",     getValue: mkDate },
        { header: "הלוך",    width:"50px", cls:"c",     getValue: mkGo },
        { header: "מסלול",               cls:"route",  getValue: mkRoute },
        { header: "חזור",    width:"50px", cls:"c",     getValue: mkRet },
        { header: "סוג רכב",width:"90px", cls:"c",     getValue: mkVT },
        { header: "שם נהג", width:"90px", cls:"",      getValue: mkDrv },
        { header: "מספר רכב",width:"80px",cls:"c",     getValue: mkVN },
        { header: 'נהג לפני מע"מ', width:"80px", cls:"l", getValue: mkP3, isTotalField:"p3" },
        { header: 'נהג כולל מע"מ', width:"80px", cls:"l", getValue: mkP4, isTotalField:"p4" },
      ]
    } else if (reportType === "report-customer") {
      cols = [
        { header: "תאריך",                 width:"70px", cls:"c",   getValue: mkDate },
        { header: "שם לקוח",              width:"100px",cls:"",    getValue: mkCust },
        { header: "הלוך",                  width:"50px", cls:"c",   getValue: mkGo },
        { header: "מסלול",                             cls:"route", getValue: mkRoute },
        { header: "סוג רכב",              width:"90px", cls:"c",   getValue: mkVT },
        { header: 'מחיר לקוח לפני מע"מ', width:"90px", cls:"l",   getValue: mkP1, isTotalField:"p1" },
        { header: 'מחיר לקוח כולל מע"מ', width:"90px", cls:"l",   getValue: mkP2, isTotalField:"p2" },
      ]
    } else if (reportType === "report-invoices") {
      cols = [
        { header: "מס' חשבונית",          width:"80px", cls:"c",   getValue: (f: any) => escapeHtml(f[INVOICE_FIELD_ID] || "-") },
        { header: "תאריך",                 width:"70px", cls:"c",   getValue: mkDate },
        { header: "הלוך",                  width:"50px", cls:"c",   getValue: mkGo },
        { header: "מסלול",                             cls:"route", getValue: mkRoute },
        { header: "חזור",                  width:"50px", cls:"c",   getValue: mkRet },
        { header: "סוג רכב",              width:"90px", cls:"c",   getValue: mkVT },
        { header: 'מחיר לקוח לפני מע"מ', width:"90px", cls:"l",   getValue: mkP1, isTotalField:"p1" },
        { header: 'מחיר לקוח כולל מע"מ', width:"90px", cls:"l",   getValue: mkP2, isTotalField:"p2" },
      ]
    } else {
      cols = [
        { header: "שם לקוח",              width:"100px",cls:"",    getValue: mkCust },
        { header: "תאריך",                width:"70px", cls:"c",   getValue: mkDate },
        { header: "הלוך",                 width:"50px", cls:"c",   getValue: mkGo },
        { header: "מסלול",                            cls:"route", getValue: mkRoute },
        { header: "חזור",                 width:"50px", cls:"c",   getValue: mkRet },
        { header: "סוג רכב",             width:"85px", cls:"c",   getValue: mkVT },
        { header: "שם נהג",              width:"100px",cls:"",    getValue: mkDrv },
        { header: 'לקוח לפני מע"מ',     width:"72px", cls:"l",   getValue: mkP1, isTotalField:"p1" },
        { header: 'לקוח כולל מע"מ',     width:"72px", cls:"l",   getValue: mkP2, isTotalField:"p2" },
        { header: 'נהג לפני מע"מ',      width:"72px", cls:"l",   getValue: mkP3, isTotalField:"p3" },
        { header: 'נהג כולל מע"מ',      width:"72px", cls:"l",   getValue: mkP4, isTotalField:"p4" },
        { header: "רווח",                width:"65px", cls:"lprofit", getValue: mkP5, isTotalField:"p5" },
      ]
    }

    const tableRows = filteredData.map((record, index) => {
      const f = record.fields
      const cells = cols.map(col => {
        const cls = col.cls === "lprofit" ? "l profit-cell" : col.cls === "route" ? "route-cell" : (col.cls || "")
        return `<td class="${cls}">${col.getValue(f)}</td>`
      }).join("")
      return `<tr><td class="c text-muted" style="width:25px">${index + 1}</td>${cells}</tr>`
    }).join("")

    const firstTotalIdx = cols.findIndex(c => c.isTotalField)
    let totalsRow = ""
    if (firstTotalIdx >= 0) {
      const tvals: Record<string, string> = {
        p1: `${totals.p1.toLocaleString("he-IL")} \u20aa`,
        p2: `${totals.p2.toLocaleString("he-IL")} \u20aa`,
        p3: `${totals.p3.toLocaleString("he-IL")} \u20aa`,
        p4: `${totals.p4.toLocaleString("he-IL")} \u20aa`,
        p5: `${totals.p5.toLocaleString("he-IL")} \u20aa`,
      }
      const span = firstTotalIdx + 1
      const priceCells = cols.slice(firstTotalIdx).map(col =>
        col.isTotalField
          ? `<td class="l${col.cls === "lprofit" ? " profit-cell" : ""}">${tvals[col.isTotalField!]}</td>`
          : `<td></td>`
      ).join("")
      totalsRow = `<tr class="total"><td colspan="${span}" style="text-align:right;">\u05e1\u05d4"\u05db:</td>${priceCells}</tr>`
    }

    const theadCells = `<th class="c" style="width:25px">#</th>` + cols.map(col => {
      const cls = col.cls === "c" ? "c" : (col.cls || "").startsWith("l") ? "l" : ""
      const styleAttr = col.width ? `style="width:${col.width}"` : ""
      return `<th class="${cls}" ${styleAttr}>${col.header}</th>`
    }).join("")

    const logoHtml = settings.logoBase64 ? `<img src="${settings.logoBase64}" class="logo" alt="\u05dc\u05d5\u05d2\u05d5 \u05d7\u05d1\u05e8\u05d4"/>` : ""
    const footerParts: string[] = []
    if (settings.address) footerParts.push(escapeHtml(settings.address))
    if (settings.phone) footerParts.push(`\u05d8\u05dc\u05e4\u05d5\u05df: ${escapeHtml(settings.phone)}`)
    if (settings.email) footerParts.push(escapeHtml(settings.email))
    const companyDetailsHtml = footerParts.length > 0
      ? `<div class="cd">${footerParts.join(" | ")}</div>` : ""
    const footerLine2 = settings.footerText
      ? `<div class="fc">${escapeHtml(settings.footerText)}</div>` : ""

    const pdfCustomerName = reportType === "report-invoices" && filters.customerName ? filters.customerName : ""
    const reportTitle = reportTitles[reportType]
    const genDate = format(new Date(), "dd/MM/yyyy")
    const totalRec = filteredData.length
    
    // Compute date range for header
    const reportDates = filteredData.map(r => r.fields[WS.DATE]).filter(Boolean).map((d: string) => new Date(d))
    const dateRangeStr = reportDates.length > 0 
      ? (filters.startDate && filters.endDate 
          ? `${format(filters.startDate, "dd/MM/yyyy")} - ${format(filters.endDate, "dd/MM/yyyy")}`
          : format(reportDates[0], "MMMM yyyy", { locale: he }))
      : ""

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8"/>
  <title>${reportTitle}${entityName ? ` - ${entityName}` : ""}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; font-family: Tahoma, sans-serif !important; }
    body { font-family: Tahoma !important; direction: rtl; padding: 10px 20px; font-size: 13px; color: #1e293b; line-height: 1.5; background: #fff; }
    .hdr { text-align:center; margin-bottom:20px; border-bottom:2px solid #e2e8f0; padding-bottom:15px; }
    .logo { max-height:65px; max-width:180px; object-fit:contain; margin:0 auto 8px; display:block; }
    .company-name { margin:0 0 4px 0; font-size:24px; color:#0f172a; font-weight:800; font-family: Tahoma, sans-serif; }
    .cd { font-size:13px; color:#64748b; margin-bottom:8px; font-family: Tahoma, sans-serif; }
    .report-title { margin:8px 0 4px 0; font-size:20px; color:#0f172a; font-weight:700; font-family: Tahoma, sans-serif; }
    .me { font-size:15px; color:#1e40af; font-weight:700; margin-bottom:4px; }
    .mi { font-size:13px; color:#475569; margin-bottom:3px; font-family: Tahoma, sans-serif; }
    .mf { font-size:12px; color:#64748b; max-width:400px; line-height:1.3; margin:4px auto 0; }
    table { width:100%; border-collapse:collapse; margin-bottom:20px; font-family: Tahoma, sans-serif; }
    th { background:#f8fafc; color:#334155; font-weight:700; padding:11px 7px; text-align:right; border-bottom:2px solid #cbd5e1; white-space:nowrap; font-size:13px; font-family: Tahoma, sans-serif; }
    td { padding:9px 7px; border-bottom:1px solid #f1f5f9; vertical-align:middle; font-size:13px; font-family: Tahoma, sans-serif; }
    tr:nth-child(even) td { background:#fdfdfd; }
    .c { text-align:center; } .l { text-align:left; }
    .text-muted { color:#94a3b8; }
    .route-cell { max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .profit-cell { color:#16a34a; font-weight:600; }
    tr.total td { background:#f1f5f9; font-weight:700; border-top:2px solid #94a3b8; border-bottom:none; padding:13px 7px; color:#0f172a; font-size:14px; }
    .ftr { margin-top:30px; text-align:center; font-size:12px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:15px; font-family: Tahoma, sans-serif; }
    .fc { margin-top:5px; color:#64748b; font-family: Tahoma, sans-serif; }
    @media print { body { padding:0; } }
  </style>
</head>
<body>
  <div class="hdr">
    ${logoHtml}
    ${settings.companyName ? `<div class="company-name">${escapeHtml(settings.companyName)}</div>` : ""}
    ${companyDetailsHtml}
    <div class="report-title">${reportTitle}${entityName ? ` עבור ${escapeHtml(entityName)}` : ""}${pdfCustomerName && !entityName ? ` - ${escapeHtml(pdfCustomerName)}` : ""}</div>
    ${dateRangeStr ? `<div class="mi">${dateRangeStr}</div>` : ""}
    <div class="mi">תאריך הפקה: ${genDate} | סה"כ רשומות: ${totalRec}</div>
  </div>
  <table>
    <thead><tr>${theadCells}</tr></thead>
    <tbody>${tableRows}${totalsRow}</tbody>
  </table>
  <div class="ftr">${footerLine2}<div style="font-weight:800;font-size:14px;color:#1e293b;margin-top:6px;font-family: Tahoma;">הופק באמצעות מערכת לו&quot;ז - ניהול סידור עבודה</div></div>
  <script>window.onload=function(){setTimeout(function(){window.print();},500);}</script>
</body>
</html>`

    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
    } else {
      toast({ title: "\u05e9\u05d2\u05d9\u05d0\u05d4", description: "\u05d4\u05d3\u05e4\u05d3\u05e4\u05df \u05d7\u05e1\u05dd \u05e4\u05ea\u05d9\u05d7\u05ea \u05d7\u05dc\u05d5\u05df \u05d7\u05d3\u05e9. \u05d0\u05e0\u05d0 \u05d0\u05e9\u05e8 \u05d7\u05dc\u05d5\u05e0\u05d5\u05ea \u05e7\u05d5\u05e4\u05e6\u05d9\u05dd \u05dc\u05d0\u05ea\u05e8 \u05d6\u05d4.", variant: "destructive" })
    }
  }

  // --- ייצוא דוח איקסים (X report) ל-PDF ---
  const exportXReportPdf = () => {
    if (filteredData.length === 0) return

    const settings = loadReportSettings(tenantId)
    const customerName = filters.customerName || ""

    // Determine the month range from data
    const dates = filteredData.map(r => r.fields[WS.DATE]).filter(Boolean).map((d: string) => new Date(d))
    if (dates.length === 0) return
    
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
    const daysInMonth = new Date(minDate.getFullYear(), minDate.getMonth() + 1, 0).getDate()
    const monthName = format(minDate, "MMMM yyyy", { locale: he })

    // Group by route description
    interface RouteData {
      route: string
      days: Set<number>
      totalPrice: number
      rideCount: number
    }
    const routeMap = new Map<string, RouteData>()

    for (const record of filteredData) {
      const f = record.fields
      const route = escapeHtml(f[WS.DESCRIPTION] || "-")
      const dateStr = f[WS.DATE]
      if (!dateStr) continue
      const day = new Date(dateStr).getDate()
      const price = Number(f[WS.PRICE_CLIENT_EXCL]) || 0

      if (!routeMap.has(route)) {
        routeMap.set(route, { route, days: new Set(), totalPrice: 0, rideCount: 0 })
      }
      const rd = routeMap.get(route)!
      rd.days.add(day)
      rd.totalPrice += price
      rd.rideCount += 1
    }

    const routes = Array.from(routeMap.values())

    // Build table rows
    const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => `<th class="day-col">${i + 1}</th>`).join("")
    const tableRows = routes.map((rd, idx) => {
      const dayCells = Array.from({ length: daysInMonth }, (_, i) => {
        const hasRide = rd.days.has(i + 1)
        return `<td class="day-col${hasRide ? " x-mark" : ""}">${hasRide ? "X" : ""}</td>`
      }).join("")
      const pricePerRide = rd.rideCount > 0 ? Math.round(rd.totalPrice / rd.rideCount) : 0
      return `<tr>
        <td class="c idx">${idx + 1}</td>
        <td class="route-name">${rd.route}</td>
        ${dayCells}
        <td class="summary-col">${rd.rideCount}</td>
        <td class="summary-col">${pricePerRide.toLocaleString("he-IL")}</td>
        <td class="summary-col total-col">${rd.totalPrice.toLocaleString("he-IL")}</td>
      </tr>`
    }).join("")

    // Totals row
    const dayTotals = Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1
      const count = routes.reduce((sum, rd) => sum + (rd.days.has(dayNum) ? 1 : 0), 0)
      return `<td class="day-col total-day">${count || ""}</td>`
    }).join("")
    const totalRides = routes.reduce((s, rd) => s + rd.rideCount, 0)
    const totalPrice = routes.reduce((s, rd) => s + rd.totalPrice, 0)

    const logoHtml = settings.logoBase64 ? `<img src="${settings.logoBase64}" class="logo" alt="לוגו חברה"/>` : ""
    const footerParts: string[] = []
    if (settings.address) footerParts.push(escapeHtml(settings.address))
    if (settings.phone) footerParts.push(`טלפון: ${escapeHtml(settings.phone)}`)
    if (settings.email) footerParts.push(escapeHtml(settings.email))
    const companyDetailsHtml = footerParts.length > 0 ? `<div class="cd">${footerParts.join(" | ")}</div>` : ""
    const footerLine2 = settings.footerText ? `<div class="fc">${escapeHtml(settings.footerText)}</div>` : ""

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8"/>
  <title>פירוט הסעות - ${customerName}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; font-family: Tahoma, sans-serif !important; }
    body { font-family: Tahoma !important; direction: rtl; padding: 5px 10px; font-size: 11px; color: #1e293b; line-height: 1.4; background: #fff; }
    .hdr { text-align:center; margin-bottom:10px; border-bottom:2px solid #e2e8f0; padding-bottom:8px; }
    .logo { max-height:50px; max-width:140px; object-fit:contain; margin:0 auto 5px; display:block; }
    .company-name { margin:0 0 2px 0; font-size:20px; color:#0f172a; font-weight:800; font-family: Tahoma, sans-serif; }
    .cd { font-size:11px; color:#64748b; margin-bottom:5px; font-family: Tahoma, sans-serif; }
    .report-title { margin:5px 0 3px 0; font-size:15px; color:#0f172a; font-weight:700; font-family: Tahoma, sans-serif; }
    .mi { font-size:11px; color:#475569; margin-bottom:2px; font-family: Tahoma, sans-serif; }
    table { width:100%; border-collapse:collapse; margin-bottom:10px; font-family: Tahoma, sans-serif; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 3px; text-align: center; vertical-align: middle; font-family: Tahoma, sans-serif; }
    th { background:#f1f5f9; color:#334155; font-weight:700; font-size:11px; white-space:nowrap; }
    .day-col { width: 24px; min-width: 24px; max-width: 24px; font-size: 11px; }
    .x-mark { font-weight: 800; color: #000000; font-size: 12px; }
    .route-name { text-align: right; padding: 4px 7px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; font-size: 11px; font-weight: 500; }
    .idx { width: 24px; color: #94a3b8; font-size: 10px; }
    .summary-col { font-weight: 600; font-size: 11px; background: #f8fafc; min-width: 60px; }
    .total-col { color: #0f172a; }
    tr.totals-row td { background: #e2e8f0; font-weight: 800; border-top: 2px solid #94a3b8; font-size: 11px; }
    .total-day { font-size: 10px; color: #475569; }
    .ftr { margin-top:15px; text-align:center; font-size:11px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:8px; font-family: Tahoma, sans-serif; }
    .fc { margin-top:3px; color:#64748b; font-family: Tahoma, sans-serif; }
    @media print { body { padding:0; } }
  </style>
</head>
<body>
  <div class="hdr">
    ${logoHtml}
    ${settings.companyName ? `<div class="company-name">${escapeHtml(settings.companyName)}</div>` : ""}
    ${companyDetailsHtml}
    <div class="report-title">דוח נסיעות עבור : ${escapeHtml(customerName)} | ${format(minDate, "dd/MM/yyyy")} עד ${format(maxDate, "dd/MM/yyyy")}</div>
    <div class="mi">תאריך הפקה: ${format(new Date(), "dd/MM/yyyy")}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="idx">#</th>
        <th style="min-width:120px;text-align:right;">מסלול</th>
        ${dayHeaders}
        <th class="summary-col">סה"כ<br/>נסיעות</th>
        <th class="summary-col">מחיר לפני<br/>מע"מ</th>
        <th class="summary-col">סה"כ לפני<br/>מע"מ</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      <tr class="totals-row">
        <td colspan="2" style="text-align:right;font-weight:800;">סה"כ</td>
        ${dayTotals}
        <td class="summary-col">${totalRides}</td>
        <td class="summary-col"></td>
        <td class="summary-col total-col">${totalPrice.toLocaleString("he-IL")} ₪</td>
      </tr>
    </tbody>
  </table>
  <div class="ftr">${footerLine2}<div style="font-weight:800;font-size:14px;color:#1e293b;margin-top:6px;font-family: Tahoma;">הופק באמצעות מערכת לו&quot;ז - ניהול סידור עבודה</div></div>
  <script>window.onload=function(){setTimeout(function(){window.print();},500);}</script>
</body>
</html>`

    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
    } else {
      toast({ title: "שגיאה", description: "הדפדפן חסם פתיחת חלון חדש. אנא אשר חלונות קופצים לאתר זה.", variant: "destructive" })
    }
  }

  return (
    <>
      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent className="sm:max-w-[520px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>{reportTitles[reportType]}</DialogTitle>
            <DialogDescription>בחר פרמטרים לדוח</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-1">
            {/* תאריכים */}
            <div className="space-y-1.5">
              <Label className="font-bold text-sm">טווח תאריכים</Label>
              <div className="flex items-center gap-2">
                <Popover open={startCalOpen} onOpenChange={setStartCalOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start text-right font-normal h-9 text-sm">
                      <CalendarIcon className="ml-2 h-3.5 w-3.5" />
                      {tempFilters.startDate ? format(tempFilters.startDate, "dd/MM/yyyy") : "מתאריך"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={tempFilters.startDate} onSelect={(d) => {
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
                <span className="text-muted-foreground text-xs">עד</span>
                <Popover open={endCalOpen} onOpenChange={setEndCalOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start text-right font-normal h-9 text-sm">
                      <CalendarIcon className="ml-2 h-3.5 w-3.5" />
                      {tempFilters.endDate ? format(tempFilters.endDate, "dd/MM/yyyy") : "עד תאריך"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={tempFilters.endDate} onSelect={(d) => { setTempFilters(p => ({ ...p, endDate: d })); setEndCalOpen(false) }} locale={he} dir="rtl" initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* לקוח + נהג */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-bold text-sm">שם לקוח</Label>
                <div className="relative" ref={customerRef}>
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="חפש לקוח..." value={tempFilters.customerName}
                    onChange={(e) => { setTempFilters(p => ({ ...p, customerName: e.target.value })); setShowCustomerSuggestions(true) }}
                    onFocus={() => setShowCustomerSuggestions(true)} className="pr-8 h-9 text-sm" />
                  {tempFilters.customerName && (
                    <button className="absolute left-2.5 top-1/2 -translate-y-1/2" onClick={() => { setTempFilters(p => ({ ...p, customerName: "" })); setShowCustomerSuggestions(false) }}>
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                  {showCustomerSuggestions && filteredCustomerSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 max-h-[140px] overflow-auto bg-popover border rounded-md shadow-md">
                      {filteredCustomerSuggestions.map((name, i) => (
                        <button key={i} className="w-full text-right px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                          onClick={() => { setTempFilters(p => ({ ...p, customerName: name })); setShowCustomerSuggestions(false) }}>{name}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-bold text-sm">שם נהג</Label>
                <div className="relative" ref={driverRef}>
                  <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="חפש נהג..." value={tempFilters.driverName}
                    onChange={(e) => { setTempFilters(p => ({ ...p, driverName: e.target.value })); setShowDriverSuggestions(true) }}
                    onFocus={() => setShowDriverSuggestions(true)} className="pr-8 h-9 text-sm" />
                  {tempFilters.driverName && (
                    <button className="absolute left-2.5 top-1/2 -translate-y-1/2" onClick={() => { setTempFilters(p => ({ ...p, driverName: "" })); setShowDriverSuggestions(false) }}>
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                  {showDriverSuggestions && filteredDriverSuggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 max-h-[140px] overflow-auto bg-popover border rounded-md shadow-md">
                      {filteredDriverSuggestions.map((name, i) => (
                        <button key={i} className="w-full text-right px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                          onClick={() => { setTempFilters(p => ({ ...p, driverName: name })); setShowDriverSuggestions(false) }}>{name}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* מסלול */}
            <div className="space-y-1.5">
              <Label className="font-bold text-sm">תיאור מסלול</Label>
              <div className="relative">
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="חפש מסלול..." value={tempFilters.description}
                  onChange={(e) => setTempFilters(p => ({ ...p, description: e.target.value }))}
                  className="pr-8 h-9 text-sm" />
                {tempFilters.description && (
                  <button className="absolute left-2.5 top-1/2 -translate-y-1/2" onClick={() => setTempFilters(p => ({ ...p, description: "" }))}>
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            </div>

            {/* סינון */}
            <div className="flex gap-2 w-full">
              <div className="flex-1 space-y-1">
                <Label className="font-bold text-sm">חשבונית</Label>
                <Select value={tempFilters.invoiceFilter} onValueChange={(v: "all" | "with" | "without") => setTempFilters(p => ({ ...p, invoiceFilter: v }))}>
                  <SelectTrigger className="h-9 text-sm w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">הכל</SelectItem>
                    <SelectItem value="with">עם</SelectItem>
                    <SelectItem value="without">ללא</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1">
                <Label className="font-bold text-sm">מחיר לקוח</Label>
                <Select value={tempFilters.clientPriceFilter} onValueChange={(v: "all" | "with" | "without") => setTempFilters(p => ({ ...p, clientPriceFilter: v }))}>
                  <SelectTrigger className="h-9 text-sm w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">הכל</SelectItem>
                    <SelectItem value="with">עם</SelectItem>
                    <SelectItem value="without">ללא</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1">
                <Label className="font-bold text-sm">מחיר נהג</Label>
                <Select value={tempFilters.driverPriceFilter} onValueChange={(v: "all" | "with" | "without") => setTempFilters(p => ({ ...p, driverPriceFilter: v }))}>
                  <SelectTrigger className="h-9 text-sm w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">הכל</SelectItem>
                    <SelectItem value="with">עם</SelectItem>
                    <SelectItem value="without">ללא</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={applyFilters} disabled={isLoading} className="h-10 mt-1">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Search className="h-4 w-4 ml-2" />}
              הצג דוח
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Invoice Update Dialog */}
      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent dir="rtl" className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>עדכון מס' חשבונית מרוכז</DialogTitle>
            <DialogDescription>
              הזן מספר חשבונית לעדכון עבור {selectedRowIds.size} הנסיעות שנבחרו.
              שים לב: מספרי חשבוניות קיימים יידרסו!
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>מס' חשבונית</Label>
            <Input 
              value={bulkInvoiceNum} 
              onChange={(e) => setBulkInvoiceNum(e.target.value.replace(/\D/g, ''))} 
              placeholder="הזן מס' חשבונית (או השאר ריק למחיקה)..." 
              className="mt-2 text-right"
              inputMode="numeric"
              disabled={isUpdatingInvoice}
            />
          </div>
          {isUpdatingInvoice && invoiceProgress.total > 0 && (
            <div className="space-y-2 px-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{invoiceProgress.current} / {invoiceProgress.total}</span>
                <span>{Math.round((invoiceProgress.current / invoiceProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-primary h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(invoiceProgress.current / invoiceProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowInvoiceDialog(false)} disabled={isUpdatingInvoice}>ביטול</Button>
            <Button onClick={handleBulkUpdateInvoice} disabled={isUpdatingInvoice}>
              {isUpdatingInvoice ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  מעדכן... {invoiceProgress.current}/{invoiceProgress.total}
                </>
              ) : (
                "שמור"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="w-full h-[calc(100vh-2rem)] flex flex-col p-2 md:p-4 overflow-hidden" dir="rtl">
        <div className="flex items-center gap-1.5 md:gap-3 pb-2 md:pb-3 flex-none flex-nowrap overflow-hidden">
          <Button variant="outline" size="sm" onClick={openFilterDialog} className="shrink-0 text-xs md:text-sm h-8 md:h-9 px-2 md:px-3">
            <SlidersHorizontal className="h-3.5 w-3.5 md:h-4 md:w-4 ml-1 md:ml-2" />
            שינוי סינון
          </Button>

          {/* Bulk Action Button - Always visible but disabled if nothing is selected */}
          <Button 
            variant={selectedRowIds.size > 0 ? "default" : "outline"} 
            size="sm" 
            className={`shrink-0 transition-colors text-xs md:text-sm h-8 md:h-9 px-2 md:px-3 ${selectedRowIds.size > 0 ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'opacity-50 cursor-not-allowed'}`}
            onClick={() => setShowInvoiceDialog(true)}
            disabled={selectedRowIds.size === 0}
          >
            עדכן חשבונית
          </Button>

          {/* Export Button + Search - side by side */}
          {hasSearched && filteredData.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Input
                placeholder="חיפוש חופשי..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="w-[130px] md:w-[190px] h-8 md:h-9 text-xs md:text-sm"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="shrink-0 text-xs md:text-sm h-8 md:h-9 px-2 md:px-3">
                    <Download className="h-3.5 w-3.5 md:h-4 md:w-4 ml-1 md:ml-2" />
                    ייצוא דוח
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" dir="rtl">
                  <DropdownMenuItem onClick={exportToCsv} className="cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4 ml-2 text-green-600" />
                    ייצוא לאקסל (CSV)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToPdf} className="cursor-pointer">
                    <Printer className="h-4 w-4 ml-2 text-orange-600" />
                    {reportType === "report-customer" ? "דוח רגיל / PDF" : "הדפסה / PDF"}
                  </DropdownMenuItem>
                  {reportType === "report-customer" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={exportXReportPdf} className="cursor-pointer">
                        <LayoutGrid className="h-4 w-4 ml-2 text-purple-600" />
                        דוח איקסים / PDF
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {hasSearched && (
            <div className="text-[10px] md:text-xs text-muted-foreground border rounded px-2 md:px-3 py-1 md:py-1.5 bg-muted/30 shrink-0">
              {filterSummary}
            </div>
          )}

          {hasSearched && (
            <div className="flex items-center gap-1 md:gap-2 bg-card border rounded px-2 md:px-3 py-1 md:py-1.5 shadow-sm shrink-0">
              <LayoutDashboard className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
              <span className="text-[10px] md:text-xs text-muted-foreground">סה"כ שורות: <span className="font-bold text-foreground text-xs md:text-sm">{totals.totalRows}</span></span>
            </div>
          )}

          {hasSearched && filteredData.length > 0 && (
            <div className="hidden md:flex gap-2 lg:gap-3 text-[10px] lg:text-sm bg-muted/20 border rounded px-2 lg:px-3 py-1 lg:py-1.5 shadow-sm items-center shrink-0 mr-auto">
              {(reportType === "report-customer" || reportType === "report-invoices" || reportType === "report-profit") && (
                <div className="flex flex-col gap-0.5 whitespace-nowrap">
                  <span>לקוח לפני מע"מ: <span className="font-bold">{totals.p1.toLocaleString()} ₪</span></span>
                  <span>לקוח כולל מע"מ: <span className="font-bold">{totals.p2.toLocaleString()} ₪</span></span>
                </div>
              )}
              {(reportType === "report-driver" || reportType === "report-profit") && (
                <>
                  {reportType === "report-profit" && <div className="w-px bg-border self-stretch my-0.5"></div>}
                  <div className="flex flex-col gap-0.5 whitespace-nowrap">
                    <span>נהג לפני מע"מ: <span className="font-bold">{totals.p3.toLocaleString()} ₪</span></span>
                    <span>נהג כולל מע"מ: <span className="font-bold">{totals.p4.toLocaleString()} ₪</span></span>
                  </div>
                </>
              )}
              {reportType === "report-profit" && (
                <>
                  <div className="w-px bg-border self-stretch my-0.5"></div>
                  <div className="flex flex-col gap-0.5 text-green-600 dark:text-green-400 font-medium whitespace-nowrap">
                    <span>רווח: <span className="font-bold">{totals.p5.toLocaleString()} ₪</span></span>
                    <span>רווח כולל: <span className="font-bold">{totals.p6.toLocaleString()} ₪</span></span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

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
                  <TableHead className="w-[45px] text-center border-l px-0">
                    <Checkbox 
                      checked={filteredData.length > 0 && selectedRowIds.size === filteredData.length} 
                      onCheckedChange={handleToggleAll} 
                    />
                  </TableHead>
                  {displayColumns.map(col => (
                    <TableHead
                      key={col.id}
                      className={`relative text-right border-l select-none overflow-visible transition-colors ${reportDraggingColId && reportDraggingColId !== col.id ? 'border-l-2 border-l-primary/30' : ''}`}
                      style={{ width: col.width, cursor: 'grab' }}
                      draggable
                      onDragStart={(e) => { setReportDraggingColId(col.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", col.id) }}
                      onDragOver={(e) => { if (!reportDraggingColId) return; e.preventDefault(); e.dataTransfer.dropEffect = "move" }}
                      onDrop={(e) => {
                        e.preventDefault(); const src = e.dataTransfer.getData("text/plain")
                        if (!src || src === col.id) { setReportDraggingColId(null); return }
                        const order = displayColumns.map(c => c.id)
                        const fi = order.indexOf(src); const ti = order.indexOf(col.id)
                        if (fi === -1 || ti === -1) { setReportDraggingColId(null); return }
                        order.splice(fi, 1); order.splice(ti, 0, src); setReportColumnOrder(order); setReportDraggingColId(null)
                      }}
                      onDragEnd={() => setReportDraggingColId(null)}
                    >
                      <div className="flex items-center justify-between cursor-pointer" onClick={() => handleSortCol(col.id)}>
                        <span className="truncate">{col.label}</span>
                        <span className="text-[10px] opacity-60 shrink-0">
                          {sortCol === col.id ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
                        </span>
                      </div>
                      <div
                        className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 z-20"
                        onMouseDown={(e) => startResize(e, col.id, col.width)}
                      />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((record) => (
                  <ContextMenu key={record.id}>
                    <ContextMenuTrigger asChild>
                      <TableRow 
                        className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedRowIds.has(record.id) ? 'bg-muted/30' : ''}`}
                        onClick={() => setEditingRecord(record)}
                      >
                        <TableCell className="text-center border-l px-0" onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={selectedRowIds.has(record.id)} 
                            onCheckedChange={() => handleToggleRow(record.id)} 
                          />
                        </TableCell>
                        {displayColumns.map(col => (
                          <TableCell key={col.id} className={`text-right border-l truncate ${col.cls || ""}`}>
                            {col.render(record)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </ContextMenuTrigger>
                    <ContextMenuContent dir="rtl" className="w-52">
                      <ContextMenuItem onSelect={() => setEditingRecord(record)} className="cursor-pointer">
                        עריכת נסיעה
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => {
                          if (!selectedRowIds.has(record.id)) setSelectedRowIds(new Set([record.id]))
                          setShowInvoiceDialog(true)
                        }}
                        className="cursor-pointer"
                      >
                        עדכון מס' חשבונית
                      </ContextMenuItem>
                      <div className="h-px bg-border my-1" />
                      <ContextMenuItem
                        onSelect={() => {
                          if (!selectedRowIds.has(record.id)) setSelectedRowIds(new Set([record.id]))
                          fetchDriversList()
                          setShowDriverAssignDialog(true)
                        }}
                        className="cursor-pointer"
                      >
                        {selectedRowIds.size > 1 ? `שיבוץ נהג ל-${selectedRowIds.size} נסיעות` : "שיבוץ / החלפת נהג"}
                      </ContextMenuItem>

                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Dialog שיבוץ נהג */}
      <Dialog open={showDriverAssignDialog} onOpenChange={(open) => { setShowDriverAssignDialog(open); if (!open) { setSelectedDriverId(""); setDriverSearch(""); } }}>
        <DialogContent className="sm:max-w-[400px] h-[420px] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">
              {selectedRowIds.size > 1 ? `שיבוץ נהג ל-${selectedRowIds.size} נסיעות` : "שיבוץ / החלפת נהג"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex flex-col min-h-0 py-2">
            <Input
              placeholder="חיפוש נהג..."
              value={driverSearch}
              onChange={(e) => setDriverSearch(e.target.value)}
              className="mb-2 text-right flex-none"
              dir="rtl"
            />
            <div className="flex-1 overflow-auto border rounded-md min-h-0">
              {driversList.filter(d => d.title.includes(driverSearch)).map(d => (
                <button
                  key={d.id}
                  className={`w-full text-right px-3 py-2 text-sm hover:bg-accent transition-colors ${selectedDriverId === d.id ? "bg-accent font-bold" : ""}`}
                  onClick={() => setSelectedDriverId(d.id)}
                >
                  {d.title}
                </button>
              ))}
              {driversList.filter(d => d.title.includes(driverSearch)).length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-4">לא נמצאו נהגים</div>
              )}
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="outline" onClick={() => setShowDriverAssignDialog(false)}>ביטול</Button>
            <Button onClick={handleAssignDriver} disabled={!selectedDriverId}>שבץ נהג</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RideDialog 
        open={!!editingRecord} 
        onOpenChange={(isOpen: boolean) => { if (!isOpen) { setEditingRecord(null); applyFilters(); } }}
        initialData={editingRecord} 
        onRideSaved={() => { setEditingRecord(null); applyFilters(); }} 
        triggerChild={<span />}
        allRides={filteredData}
        onNavigate={(record: any) => setEditingRecord(record)}
      />
    </>
  )
}
