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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
  withClientPrice: boolean
  withoutClientPrice: boolean
  withDriverPrice: boolean
  withoutDriverPrice: boolean
  withInvoice: boolean
  withoutInvoice: boolean
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

  // Column resizing with localStorage persistence
  const REPORT_COL_KEY = `reportColumnWidths_${tenantId}_${reportType}`
  const defaultWidths: Record<string, number> = {
    select: 45, invoiceNum: 90, date: 95, customer: 130, pickup: 80, route: 200, dropoff: 80, 
    vehicleType: 100, driver: 110, vehicleNum: 85, 
    p1: 100, p2: 110, p3: 100, p4: 100, profit: 80
  }
  const [colWidths, setColWidths] = React.useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(REPORT_COL_KEY)
      if (saved) return { ...defaultWidths, ...JSON.parse(saved) }
    } catch {}
    return defaultWidths
  })
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
  
  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  const [filters, setFilters] = React.useState<FilterState>({
    startDate: firstOfMonth,
    endDate: today,
    customerName: "",
    driverName: "",
    description: "",
    withClientPrice: true,
    withoutClientPrice: true,
    withDriverPrice: true,
    withoutDriverPrice: true,
    withInvoice: true,
    withoutInvoice: true,
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

    // Invoice filters
    if (!filters.withInvoice) {
      filtered = filtered.filter((r) => !r.fields[INVOICE_FIELD_ID])
    }
    if (!filters.withoutInvoice) {
      filtered = filtered.filter((r) => !!r.fields[INVOICE_FIELD_ID])
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
    if (!filters.withInvoice) parts.push("ללא מס' חשבונית")
    if (!filters.withoutInvoice) parts.push("מס' חשבונית קיים")
    if (!filters.withClientPrice) parts.push("ללא מחיר לקוח")
    if (!filters.withoutClientPrice) parts.push("עם מחיר לקוח")
    if (!filters.withDriverPrice) parts.push("ללא מחיר נהג")
    if (!filters.withoutDriverPrice) parts.push("עם מחיר נהג")
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

    const results = await Promise.all(ids.map((id) =>
      requestQueue.add(async () => {
        const res = await fetch(`/api/work-schedule/${id}?tenant=${tenantId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: { [INVOICE_FIELD_ID]: valueToSave } })
        })
        if (!res.ok) throw new Error(`PATCH failed: ${res.status}`)
        return true
      }).catch(() => false)
    ))
    const errorCount = results.filter(ok => !ok).length

    await applyFilters()

    setIsUpdatingInvoice(false)
    setShowInvoiceDialog(false)
    setBulkInvoiceNum("")

    if (errorCount > 0) {
      toast({ title: "שגיאה", description: `נכשל בעדכון של ${errorCount} נסיעות`, variant: "destructive" })
    } else {
      toast({ title: "הצלחה", description: "מספרי החשבונית עודכנו בהצלחה" })
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
  <style>@font-face { font-family: "Varela Round"; src: url("data:font/otf;base64,T1RUTwAMAIAAAwBAQ0ZGICGfHZYAAFuAAABL7UdQT1PjFKHQAAAocAAALvRHU1VC5oPgsQAAV2QAAAQcT1MvMoYueCcAAAEwAAAAYGNtYXBrh8MZAAAILAAAAmJoZWFk9s7sMgAAAMwAAAA2aGhlYQbpA18AAAEEAAAAJGhtdHgwpzJ5AAAKkAAAA+RrZXJuHeAaMQAADpQAABnabWF4cAD5UAAAAAEoAAAABm5hbWX5kXz+AAABkAAABplwb3N0/7gAMgAADnQAAAAgAAEAAAABAACl7ld2Xw889QADA+gAAAAAyjPUbQAAAADKM9Rt/3T+4gPcA5YAAAADAAIAAAAAAAAAAQAAA5b+4gAABBD/dP9zA9wAAQAAAAAAAAAAAAAAAAAAAPkAAFAAAPkAAAACAkABkAAFAAACvAKKAAAAjAK8AooAAAHdADIA+gAAAgAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAABweXJzAEAAIPsGA5b+4gAAA5YBHgAAAAEAAAAAAf4CugAAACAAAwAAABwBVgABAAAAAAAAAHIAAAABAAAAAAABAAwAcgABAAAAAAACAAcAfgABAAAAAAADABEAhQABAAAAAAAEAAwAcgABAAAAAAAFAA0AlgABAAAAAAAGAAsAowABAAAAAAAHAEMArgABAAAAAAAIAAoA8QABAAAAAAAJAAoA8QABAAAAAAAKAHIAAAABAAAAAAAMABwA+wABAAAAAAANAJABFwABAAAAAAAOABoBpwADAAEECQAAAOQBwQADAAEECQABABgCpQADAAEECQACAA4CvQADAAEECQADACICywADAAEECQAEABYC7QADAAEECQAFABoDAwADAAEECQAGABYC7QADAAEECQAHAIYDHQADAAEECQAIABQDowADAAEECQAJABQDowADAAEECQAKAOQBwQADAAEECQAMADgDtwADAAEECQANASAD7wADAAEECQAOADQFD0NvcHlyaWdodCAoYykgMjAxMSwgSm9lIFByaW5jZSwgQWRtaXggRGVzaWducyAoaHR0cDovL3d3dy5hZG1peGRlc2lnbnMuY29tLykgd2l0aCBSZXNlcnZlZCBGb250IE5hbWUgVmFyZWxhIFJvdW5kLlZhcmVsYSBSb3VuZFJlZ3VsYXIxLjAwMDtWYXJlbGFSb3VuZFZlcnNpb24gMS4wMDBWYXJlbGFSb3VuZFZhcmVsYSBSb3VuZCBpcyBhIHRyYWRlbWFyayBvZiBBZG1peCBEZXNpZ25zICh3d3cuYWRtaXhkZXNpZ25zLmNvbSlKb2UgUHJpbmNlaHR0cDovL3d3dy5hZG1peGRlc2lnbnMuY29tL1RoaXMgRm9udCBTb2Z0d2FyZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgU0lMIE9wZW4gRm9udCBMaWNlbnNlLCBWZXJzaW9uIDEuMS4gVGhpcyBsaWNlbnNlIGlzIGF2YWlsYWJsZSB3aXRoIGEgRkFRIGF0OiBodHRwOi8vc2NyaXB0cy5zaWwub3JnL09GTGh0dHA6Ly9zY3JpcHRzLnNpbC5vcmcvT0ZMAEMAbwBwAHkAcgBpAGcAaAB0ACAAKABjACkAIAAyADAAMQAxACwAIABKAG8AZQAgAFAAcgBpAG4AYwBlACwAIABBAGQAbQBpAHgAIABEAGUAcwBpAGcAbgBzACAAKABoAHQAdABwADoALwAvAHcAdwB3AC4AYQBkAG0AaQB4AGQAZQBzAGkAZwBuAHMALgBjAG8AbQAvACkAIAB3AGkAdABoACAAUgBlAHMAZQByAHYAZQBkACAARgBvAG4AdAAgAE4AYQBtAGUAIABWAGEAcgBlAGwAYQAgAFIAbwB1AG4AZAAuAFYAYQByAGUAbABhACAAUgBvAHUAbgBkAFIAZQBnAHUAbABhAHIAMQAuADAAMAAwADsAVgBhAHIAZQBsAGEAUgBvAHUAbgBkAFYAYQByAGUAbABhAFIAbwB1AG4AZABWAGUAcgBzAGkAbwBuACAAMQAuADAAMAAwAFYAYQByAGUAbABhACAAUgBvAHUAbgBkACAAaQBzACAAYQAgAHQAcgBhAGQAZQBtAGEAcgBrACAAbwBmACAAQQBkAG0AaQB4ACAARABlAHMAaQBnAG4AcwAgACgAdwB3AHcALgBhAGQAbQBpAHgAZABlAHMAaQBnAG4AcwAuAGMAbwBtACkASgBvAGUAIABQAHIAaQBuAGMAZQBoAHQAdABwADoALwAvAHcAdwB3AC4AYQBkAG0AaQB4AGQAZQBzAGkAZwBuAHMALgBjAG8AbQAvAFQAaABpAHMAIABGAG8AbgB0ACAAUwBvAGYAdAB3AGEAcgBlACAAaQBzACAAbABpAGMAZQBuAHMAZQBkACAAdQBuAGQAZQByACAAdABoAGUAIABTAEkATAAgAE8AcABlAG4AIABGAG8AbgB0ACAATABpAGMAZQBuAHMAZQAsACAAVgBlAHIAcwBpAG8AbgAgADEALgAxAC4AIABUAGgAaQBzACAAbABpAGMAZQBuAHMAZQAgAGkAcwAgAGEAdgBhAGkAbABhAGIAbABlACAAdwBpAHQAaAAgAGEAIABGAEEAUQAgAGEAdAA6ACAAaAB0AHQAcAA6AC8ALwBzAGMAcgBpAHAAdABzAC4AcwBpAGwALgBvAHIAZwAvAE8ARgBMAGgAdAB0AHAAOgAvAC8AcwBjAHIAaQBwAHQAcwAuAHMAaQBsAC4AbwByAGcALwBPAEYATAAAAAAAAAMAAAADAAABIgABAAAAAAAcAAMAAQAAASIAAAEGAAAAAAAAAAAAAAABAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fAIKDhYePlJqfnqCioaOlp6aoqauqrK2vsbCytLO4t7m6225iY2bddJ1saONyZ+6Elutv7/Blc+Xo59LsaXjRpLZ9YWvqv+3manneYH6BkwAA09TY2dXWtfG9AOHi3+D09dx119oAgIh/iYaLjI2KkZIAkJiZlwDJz23LzM120M7KAAQBQAAAAEwAQAAFAAwAfgClAKwA/wF/AZIB/wIbAjcCxwLdA6kDwCAUIBogHiAiICYgOiBEIKwhIiEmIgIiBiIPIhIiGiIeIisiSCJgImUlyvsA+wT7Bv//AAAAIACgAKcArgF/AZIB/AIYAjcCxgLYA6kDwCATIBggHCAgICYgOSBEIKwhIiEmIgIiBiIPIhEiGiIeIisiSCJgImQlyvsA+wH7Bv///+H/wP+//77/P/8t/sT+rP6R/gP98/0o/RLgwOC94Lzgu+C44KbgneA238Hfvt7j3uDe2N7X3tDezd7B3qXejt6L2ycF8gXzBfIAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICABQBBAAAARkAUgGbADsCZAAkAmQALwMuACsC3ABHAO4APwE4ADMBOAAwAaEAQgIyACgBBAA/AZgARQEEAEUBuwAwAnQAKwJ0AIACdABBAnQAOwJ0ABkCdABAAnQAOwJ0ADwCdAAvAnQAMAEEAEUBBAA/AkQAIwLIAEkCRAA2AfEAGgOCADECuQAaArUAYQK6ADgC7gBhAn4AYQJiAGEC6AA3AvMAYQEdAGEB0gAMAp4AYQJAAGEDxgBhAyMAYQMrADcCnQBhAywANwLIAGECaAAzAmMADgL2AFwCtgAYA+8AGgKdACsChQAeAn4ALwFCAFcBuwAvAUIAHAIMAFIClwA0APYARQIrACYCdwBPAhgALgJ3ADACOgAxAXwAEwJ3ADACYQBPAQEASwEB/9ICIgBPAQkAVwOXAE8CYQBPAmAAMAJ3AE8CdwAwAYMATwHgADABgAAWAmIASwISABoDEQAZAh4AMwIVABgB8wAnAVgAAwD9AFYBWAAcAn4ASgEEAAABAwBHAicALAJcACcCnABCApIAQQIRAC8BkAA/AzMAMwHlAEICSQA2AkMASQMzADMBOAAIAXoANAJeAD4BcgAmAXIAJADwADACXABUAtwAJwEEAEUBMwAtAXIATgICAEYCSQBKA6wAVQOsAE8DrAA/AegAKAK5ABoCuQAaArkAGgK5ABoCuQAaArkAGgQQAAICugA4An4AYQJ+AGECfgBhAn4AYQEdADgBHQBhAR0ABwEdAAcC9QARAyMAYQMrADcDKwA3AysANwMrADcDKwA3AjMAOwMrADcC9gBcAvYAXAL2AFwC9gBcAoUAHgKfAGECYgBPAisAJgIrACYCKwAmAisAJgIrACYCKwAmA4gAJQIZAC4COgAxAjoAMQI6ADECOgAxAQEAKgEBAFMBAf/5AQH/+QJXADECYQBPAmAAMAJgADACYAAwAmAAMAJgADACyABJAmAAMAJiAEsCYgBLAmIASwJiAEsCFQAYAncATwIVABgBHwATAZP/ywQQAAIDiAAlAysANwJgADACaQAzAeAAMAJhAA0BfwAVAQH/0gGZAEQBhwBEAYEAMQDkAD8BDgArAV8ARQGwADcBjwAwAxYANgJ6ABACrABFA3sARQD/AEIA7gA/AQQAPwG1AEIBpAA/AboAPwH5ACMCEwAwAXkAOAPIAEUBeQA2AXkASgDI/3QCqgAqA7kAOQMWADYCrQAqAtEARALlACQCdwApAsgASQJsAAcDwwBBAXMAAQKjAFMCsAA7AnYAOgJ2AEwCcgAoAwYAEwKBABMCgQATAoQAEwQLABMEDgATA0oAMAADAAAAAAAA/7UAMgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAGdYAAQRMGAAACgHIAAMAD/9+AAMA2v93AAcACP/SAAcANf/QAAcANv/7AAcAN//SAAcAOP/lAAcAOv/IAAcAR//zAAcAVf/xAAcAV//oAAcAWP/xAAcAWv/rAAcAhAATAAgAD/+JAAgAEP/VAAgAIf/sAAgAIv/NAAgAK/++AAgAQv/yAAgAUP/kAAgAVP/wAAgAhP/AAAgA3//eAAkAMP/rAAkANv/0AAkAQv/tAAkAR//zAAkAT//uAAkAUP/lAAkAVP/tAAkAVf/qAAkAVv/pAAkAV//rAAkAWP/uAAkAWv/xAAkAW//2AAkAjAARAAsAIv/XAAsAK/+/AAsAQv/2AAsAUP/yAAsAhP/NAAsArAAUAAsArQALAA4AIv/yAA4AK//LAA4ANP/tAA4ANf/AAA4AN//fAA4AOP/uAA4AOf/hAA4AOv++AA4AO//hAA4AR//zAA4AVf/0AA4AV//4AA4AWf/qAA4AW//qAA8AA/+DAA8ACP+JAA8AMP/tAA8ANf/AAA8ANv/uAA8AN//AAA8AOP/WAA8AOv+1AA8AR//2AA8AVf/0AA8AV//hAA8AWP/rAA8AWv/kAA8A1f+EAA8A2f+DABAAEP9sABAAIv/gABAAK//gABAAQv/sABAAT//xABAAUP/qABAAVP/vABAAVv/yABAAhP/vABsANf/WABsAN//3ABsAOv/mACEANf/uACEAOv/oACIACP/TACIAC//XACIADv/yACIAIP/uACIAIgAqACIAKwAeACIAMP/yACIANf/CACIANv/tACIAN//UACIAOP/hACIAOQAYACIAOv/AACIAPf/gACIAPv/xACIAR//rACIASf/6ACIASv/5ACIATf/4ACIAT//6ACIAUP/0ACIAVf/pACIAVv/yACIAV//cACIAWP/jACIAWv/fACIAXv/0ACIAbP/2ACIA1f/TACIA4//UACMACv/wACMANf/WACMAN//0ACMAOP/7ACMAOf/vACMAOv/jACMAPv/yACMAR//1ACMASf/5ACMASv/4ACMATf/3ACMAT//5ACMAUP/7ACMAVP/3ACMAVf/yACMAVv/5ACMAV//zACMAWP/4ACMAWf/uACMAWv/2ACMAW//1ACMAXv/yACMAhP/4ACQAB//5ACQADv/qACQAMP/3ACQAR//5ACQAT//5ACQAUP/wACQAVP/2ACQAVf/sACQAVv/1ACQAV//OACQAWP/bACQAWv/SACUACv/rACUAD//tACUAEP/2ACUAIv/xACUAK//wACUANf/kACUAN//yACUAOP/6ACUAOf/kACUAOv/fACUAO//xACUAPv/uACUAQv/2ACUASf/3ACUASv/2ACUATf/1ACUAT//3ACUAUP/6ACUAVP/6ACUAVv/4ACUAWf/zACUAW//2ACUAXv/uACUAhP/RACUA4//4ACYAB//5ACYAMP/5ACYAQv/5ACYAR//1ACYAT//5ACYAUP/yACYAVP/6ACYAVf/vACYAVv/zACYAV//wACYAWP/0ACYAWv/yACcAB//pACcAD/+5ACcAEP/nACcAIv/MACcAK/+ZACcAQv+0ACcAR//uACcASf/5ACcASv/1ACcATf/2ACcAT//lACcAUP/sACcAVP/sACcAVf/lACcAVv/oACcAV//xACcAWP/0ACcAWf/VACcAWv/zACcAW/+1ACcAhP+xACcA4P/zACgAN//7ACgAOv/4ACgAQv/6ACgAR//3ACgASf/3ACgASv/2ACgATf/0ACgAT//3ACgAUP/5ACgAVP/6ACgAVf/zACgAVv/3ACgAV//3ACgAWP/6ACgAWf/2ACgAWv/5ACgAW//4ACoAOv/7ACoAQv/1ACoAR//4ACoASf/2ACoASv/2ACoATf/2ACoAT//2ACoAUP/yACoAVP/1ACoAVf/1ACoAVv/zACoAV//3ACoAWP/5ACoAWv/5ACoAW//2ACsACv/1ACsAD//0ACsAIv/zACsAK//5ACsAQv/yACsAR//4ACsASf/yACsASv/yACsATf/xACsAT//zACsAUP/yACsAVP/yACsAVf/1ACsAVv/vACsAV//4ACsAWP/6ACsAWf/4ACsAWv/6ACsAW//zACwAB//sACwADv/nACwAIgAiACwAKwAXACwAMP/kACwANP/3ACwANQAKACwANwAZACwAOAATACwAOQAYACwAOgAdACwAR//tACwAUP/gACwAVf/YACwAVv/qACwAV//aACwAWP/kACwAWv/eAC0AB//5AC0ACP+hAC0AC/+gAC0ADv+8AC0AIP/vAC0AMP/nAC0ANf+aAC0ANv/nAC0AN/+qAC0AOP+3AC0AOQAXAC0AOv+cAC0APf/aAC0APv/2AC0AR//JAC0ATf/7AC0AUP/1AC0AVf/HAC0AVv/1AC0AV/+pAC0AWP+2AC0AWv+tAC0AbP/vAC0Adf++AC0AhAAYAC0A1f+hAC0A3//zAC0A4/+fADAACv/rADAAD//tADAAIv/yADAAK//yADAANf/oADAAN//zADAAOP/7ADAAOf/mADAAOv/hADAAO//zADAAPv/uADAAQv/2ADAASf/3ADAASv/2ADAATf/0ADAAT//3ADAAUP/6ADAAVP/6ADAAVv/4ADAAWf/zADAAW//2ADAAXv/vADAAhP/UADAA4//4ADEAB//5ADEACv/zADEAD/+yADEAEP/pADEAIv/UADEAK/+0ADEAOf/sADEAOv/7ADEAO//5ADEAQv/mADEASf/6ADEASv/4ADEATf/4ADEAT//4ADEAUP/yADEAVP/5ADEAVv/5ADEAXv/2ADEAhP+xADEArP/+ADMANf/yADMAN//5ADMAOv/wADMAQv/5ADMAR//7ADMASf/5ADMASv/3ADMATf/3ADMAT//4ADMAUP/0ADMAVP/3ADMAVf/3ADMAVv/2ADMAV//6ADMAWf/4ADMAW//5ADQAC//0ADQANf/bADQAN//6ADQAOf/5ADQAOv/4ADQAR//mADQASf/4ADQASv/3ADQATf/1ADQAT//4ADQAVP/5ADQAVf/qADQAVv/3ADQAV//gADQAWP/qADQAWf/rADQAWv/jADQAW//0ADQA4//4ADUAB//XADUADv/AADUAD//AADUAEP/cADUAG//WADUAIf/iADUAIv/CADUAK/+3ADUAMP/oADUANwAlADUAOAAmADUAOQAjADUAOgArADUAQv+xADUAR//iADUASf/6ADUASv/2ADUATf/3ADUAT/+9ADUAUP+rADUAVP+0ADUAVf/BADUAVv++ADUAV/+5ADUAWP+/ADUAWf+8ADUAWv+7ADUAW/+yADUAbP/wADUAhP/LADUArAABADUArQAPADUA3//FADUA4P/NADYACv/1ADYAD//uADYAEP/yADYAIv/sADYAK//xADYAQv/vADYAR//4ADYASf/zADYASv/xADYATf/uADYAT//uADYAUP/xADYAVP/wADYAVf/2ADYAVv/uADYAV//4ADYAWP/7ADYAWf/2ADYAWv/6ADYAW//wADYAhP/2ADcAB//yADcADv/fADcAD//AADcAEP/dADcAG//3ADcAIf/vADcAIv/UADcAK//BADcAMP/zADcANP/7ADcANQAfADcANwAjADcAOAAkADcAOQAhADcAOgAwADcAQv/KADcAR//1ADcASf/4ADcASv/3ADcATf/1ADcAT//UADcAUP/LADcAVP/OADcAVf/oADcAVv/XADcAV//0ADcAWP/1ADcAWf/xADcAWv/2ADcAW//kADcAbP/2ADcAhP/QADcAqgADADcArAABADcArQASADcA3//hADcA4P/0ADcA4wAIADgAB//6ADgADv/uADgAD//WADgAEP/pADgAIv/hADgAK//WADgAMP/7ADgANQAhADgANwAjADgAOAAdADgAOQAcADgAOgAmADgAQv/YADgAR//6ADgASv/7ADgATf/5ADgAT//hADgAUP/XADgAVP/fADgAVf/yADgAVv/kADgAV//7ADgAWf/5ADgAW//uADgAhP/qADgArAADADgArQAOADgA3//vADkAB//vADkADv/hADkAIgAgADkAKwAaADkAMP/mADkANP/6ADkANQAgADkANwAgADkAOAAjADkAOQAcADkAOgAlADkAQv/2ADkAR//xADkAT//4ADkAUP/YADkAVP/3ADkAVf/UADkAVv/hADkAV//aADkAWP/dADkAWv/cADkA3//xADoAB//mADoADv++ADoAD/+1ADoAEP/UADoAG//mADoAIf/dADoAIv/AADoAKv/7ADoAK/+1ADoAMP/iADoANP/3ADoANQAqADoANwAtADoAOAAuADoAOQAtADoAOgAyADoAPgAKADoAQv+vADoAR//oADoASf/4ADoASv/3ADoATf/1ADoAT/+6ADoAUP+pADoAVP+rADoAVf/JADoAVv+8ADoAV//dADoAWP/aADoAWf/VADoAWv/eADoAW//JADoAXgAMADoAbP/pADoAhP+4ADoAqgAOADoArQAXADoA3//FADoA4P/gADoA4wAaADsAB//7ADsADv/UADsAMP/yADsAQv/3ADsAR//uADsASf/5ADsASv/3ADsATf/3ADsAT//wADsAUP/iADsAVP/0ADsAVf/hADsAVv/mADsAV//jADsAWP/mADsAWv/lADsAW//6ADsA3//rADwAIv/vADwAK//yADwAMP/vADwAOgAKADwAQv/sADwAT//sADwAUP/nADwAVP/sADwAVf/sADwAVv/pADwAV//rADwAWP/uADwAWf/1ADwAWv/xADwAW//vAD0ACP/YAD0AMP/2AD0ANf/cAD0ANv/yAD0AN//dAD0AOP/pAD0AOv/UAD0AVf/2AD0AV//tAD0AWP/zAD0AWv/zAD0AhAAIAEIAB//6AEIACP/yAEIACv/sAEIAC//yAEIAIP/tAEIAIv/7AEIAKv/yAEIAMP/2AEIANP/0AEIANf+lAEIANv/qAEIAN//LAEIAOP/dAEIAOf/6AEIAOv+qAEIAO//xAEIAPf/pAEIAPv/pAEIAR//6AEIAVf/7AEIAVv/8AEIAV//2AEIAWP/7AEIAWv/5AEIAXv/sAEIA1f/zAEIA4//nAEQAB//vAEQACv/2AEQADv/0AEQAMP/1AEQANP/1AEQANf+gAEQANv/3AEQAN//hAEQAOP/vAEQAOv+6AEQAPv/0AEQAUP/8AEQA4//0AEUAB//5AEUAIv/6AEUAKv/2AEUAMP/3AEUANP/5AEUANf/6AEUANv/zAEUAN//4AEUAOv/4AEUAO//1AEYAB//6AEYACP/0AEYACv/rAEYAC//1AEYAIP/vAEYAIv/7AEYAKv/1AEYAK//6AEYAMP/7AEYANP/1AEYANf+vAEYANv/zAEYAN//KAEYAOP/YAEYAOf/wAEYAOv+tAEYAO//wAEYAPf/tAEYAPv/rAEYAV//7AEYAWf/6AEYAXv/tAEYA1f/1AEYA4//rAEcAB//tAEcADv/hAEcAD//jAEcAEP/vAEcAIv/TAEcAK//TAEcANwAHAEcAOgATAEcAQv/wAEcAUP/3AEcAVQAVAEcAVwAgAEcAWAAjAEcAWQAPAEcAWgAgAEcA3//xAEoAB//4AEoAIv/5AEoAKv/2AEoAK//7AEoAMP/2AEoANP/3AEoANf/2AEoANv/xAEoAN//3AEoAOP/7AEoAOv/4AEoAO//zAEwAB//nAEwADv/nAEwAIP/2AEwAMP/oAEwANP/4AEwANf+8AEwANv/zAEwAN//WAEwAOP/qAEwAOv/GAEwAQv/7AEwAUP/rAEwAVP/8AEwAVf/4AEwAVwAGAEwAWAAIAEwAWQANAEwAWgAPAEwA3//2AEwA4//wAE0AB//3AE0AIv/4AE0AKv/2AE0AK//7AE0AMP/1AE0ANP/3AE0ANf/3AE0ANv/uAE0AN//1AE0AOP/5AE0AOv/1AE0AO//yAE0Adf/EAE8AB//6AE8ACP/yAE8ACv/sAE8AC//zAE8AIP/uAE8AIv/7AE8AKv/yAE8AMP/2AE8ANP/1AE8ANf+mAE8ANv/rAE8AN//MAE8AOP/eAE8AOf/6AE8AOv+vAE8AO//xAE8APf/qAE8APv/pAE8AR//7AE8AVf/8AE8AV//3AE8AWP/7AE8AWv/6AE8AXv/sAE8A1f/1AE8A4//oAFAACP/wAFAACv/lAFAAC//yAFAAIP/sAFAAIv/0AFAAKv/yAFAAK//5AFAAMP/6AFAANP/yAFAANf+qAFAANv/xAFAAN//LAFAAOP/WAFAAOf/XAFAAOv+pAFAAO//lAFAAPf/qAFAAPv/nAFAAR//7AFAAVf/8AFAAV//5AFAAWf/xAFAAWv/7AFAAW//6AFAAXv/pAFAA1f/xAFAA4//pAFMAB//gAFMACv/tAFMADv/NAFMAD//LAFMAEP/pAFMAIv/NAFMAKv/2AFMAK/+2AFMANf/AAFMANv/4AFMAN//2AFMAOf/aAFMAOv/hAFMAO/+5AFMAPv/rAFMAQv/hAFMARwARAFMAUP/wAFMAVQAOAFMAVwAXAFMAWAAVAFMAWQAOAFMAWgAcAFMAXv/wAFMA3//qAFQACv/tAFQAIP/vAFQAKv/1AFQAMP/3AFQANP/6AFQANf+yAFQANv/wAFQAN//LAFQAOP/eAFQAOf/0AFQAOv+wAFQAO//3AFQAPf/vAFQAPv/sAFQAVf/8AFQAV//8AFQAXv/vAFQA4//qAFUAB//1AFUANf+3AFUANv/5AFUAN//uAFUAOP/4AFUAOv/TAFUAPv/1AFUAVQAHAFUAVwARAFUAWAAOAFUAWgAPAFUA4//4AFYAB//5AFYACv/uAFYAIv/6AFYAKv/2AFYAMP/3AFYANP/4AFYANf+9AFYANv/uAFYAN//UAFYAOP/hAFYAOf/4AFYAOv+6AFYAO//wAFYAPf/xAFYAPv/sAFYAXv/uAFYA4//uAFcAB//yAFcACv/sAFcADv/4AFcAD//hAFcAEP/tAFcAIv/cAFcAKv/3AFcAK//RAFcANf/PAFcANv/4AFcAN//0AFcAOP/7AFcAOf/aAFcAOv/dAFcAO//RAFcAPv/rAFcAQv/6AFcARwAcAFcAUP/5AFcAVQAVAFcAVwAUAFcAWAAVAFcAWQASAFcAWgAbAFcAXv/vAFgAB//2AFgACv/uAFgAD//rAFgAEP/zAFgAIv/jAFgAKv/5AFgAK//TAFgANf/NAFgANv/7AFgAN//1AFgAOf/dAFgAOv/aAFgAO//WAFgAPv/uAFgARwAhAFgAVQAQAFgAVwAVAFgAWAAVAFgAWQAOAFgAWgAXAFgAXv/xAFkAB//tAFkADv/pAFkAKv/7AFkAMP/zAFkANf+8AFkANv/2AFkAN//xAFkAOP/6AFkAOv/VAFkAPv/1AFkARwAVAFkAUP/xAFkAVwAQAFkAWAARAFkAWQAOAFkAWgAPAFkA3//zAFkA4//4AFoAB//0AFoACv/vAFoAD//kAFoAEP/xAFoAIv/eAFoAKv/5AFoAK//TAFoANf/QAFoANv/6AFoAN//2AFoAOf/cAFoAOv/fAFoAO//TAFoAPv/uAFoAQv/8AFoAUP/7AFoAVQAWAFoAVwAfAFoAWAAhAFoAWQAcAFoAWgAdAFoAXv/zAFsAB//zAFsACv/1AFsADv/uAFsAKv/2AFsAMP/3AFsANf+yAFsANv/xAFsAN//lAFsAOP/wAFsAOv/JAFsAO//4AFsAPv/vAFsAUP/7AFsAXv/zAFsA4//xAFwAIv/zAFwAK//2AFwAMP/vAFwAOgAMAFwAQv/vAFwAT//uAFwAUP/qAFwAVP/uAFwAVf/vAFwAVv/sAFwAV//vAFwAWP/xAFwAWv/1AFwAW//zAFwAjAAMAGEANf/QAGEAN//wAGEAOv/gAGwAIv/1AGwAK//2AGwANf/vAGwAN//2AGwAOv/nAHUATf/EAH0AIv/xAH0AKv/wAH0AK//qAH0AMP/qAH0ANP/wAH0ANf+7AH0ANv/nAH0AN//ZAH0AOP/kAH0AOv/JAH0AO//sAH0AQv/rAH0AR//vAH0ASf/uAH0ASv/uAH0ASwASAH0ATf/tAH0AT//uAH0AUP/nAH0AVP/tAH0AVf/sAH0AVv/pAH0AV//rAH0AWP/u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/+0A4//rAAUAB//tABD/7wA3AAcAVwAgAFkADwAIAAf/+QAK/+4AN//UADn/+AA9//EAPv/sAF7/7gDj/+4ACwAH//oACv/sAAv/8wAg/+4AN//MADn/+gA9/+oAPv/pAFf/9wBe/+wA4//oAAIAB//4ADf/9wACAAf/+AA3//cAAwAH//cAN//1AHX/xAALAAf/+gAK/+wAC//zACD/7gA3/8wAOf/6AD3/6gA+/+kAV//3AF7/7ADj/+gACwAH//oACv/sAAv/8wAg/+4AN//MADn/+gA9/+oAPv/pAFf/9wBe/+wA4//oAAsACv/lAAv/8gAg/+wAN//LADn/1wA9/+oAPv/nAFf/+QBZ//EAXv/pAOP/6QALAAr/5QAL//IAIP/sADf/ywA5/9cAPf/qAD7/5wBX//kAWf/xAF7/6QDj/+kACAAH//kACv/uADf/1AA5//gAPf/xAD7/7ABe/+4A4//uAAEAPv/rAAkACv/tACD/7wA3/8sAOf/0AD3/7wA+/+wAV//8AF7/7wDj/+oABQAH//UAN//uAD7/9QBXABEA4//4AAgAB//5AAr/7gA3/9QAOf/4AD3/8QA+/+wAXv/uAOP/7gAJAAf/8gAK/+wAEP/tADf/9AA5/9oAPv/rAFcAFABZABIAXv/vAAYAB//tADf/8QA+//UAVwAQAFkADgDj//gACQAH//QACv/vABD/8QA3//YAOf/cAD7/7gBXAB8AWQAcAF7/8wACAFf/7wCMAAwAAQA3//AAAQA3//QAAQA3//YAAwA3/+EAOf/xAFn/8wAEADf/2QBLABIAV//rAFn/9QAKAAv/1wAg/+4AN//UADkAGAA9/+AAPv/xAFf/3ABe//QAbP/2AOP/1AAKAAv/1wAg/+4AN//UADkAGAA9/+AAPv/xAFf/3ABe//QAbP/2AOP/1AAKAAv/1wAg/+4AN//UADkAGAA9/+AAPv/xAFf/3ABe//QAbP/2AOP/1AAKAAv/1wAg/+4AN//UADkAGAA9/+AAPv/xAFf/3ABe//QAbP/2AOP/1AAKAAv/1wAg/+4AN//UADkAGAA9/+AAPv/xAFf/3ABe//QAbP/2AOP/1AAKAAv/1wAg/+4AN//UADkAGAA9/+AAPv/xAFf/3ABe//QAbP/2AOP/1AACAAf/+QBX//AAAgAH//kAV//OAAIAB//5AFf/8AACAAf/+QBX//AAAgAH//kAV//wAAIAB//5AFf/8AABAFf/9wABAFf/9wADAAoAEQBX//cAXgALAAEAV//3AAgACv/rABD/9gA3//IAOf/kAD7/7gBZ//MAXv/uAOP/+AABAFf/9wAHAAr/6wA3//MAOf/mAD7/7gBZ//MAXv/vAOP/+AAHAAr/6wA3//MAOf/mAD7/7gBZ//MAXv/vAOP/+AAHAAr/6wA3//MAOf/mAD7/7gBZ//MAXv/vAOP/+AAHAAr/6wA3//MAOf/mAD7/7gBZ//MAXv/vAOP/+AAHAAr/6wA3//MAOf/mAD7/7gBZ//MAXv/vAOP/+AAHAAr/6wA3//MAOf/mAD7/7gBZ//MAXv/vAOP/+AAEAAr/9QAQ//IAV//4AFn/9gAEAAr/9QAQ//IAV//4AFn/9gAEAAr/9QAQ//IAV//4AFn/9gAEAAr/9QAQ//IAV//4AFn/9gANAAf/5gAQ/9QAIf/dADcALQA5AC0APgAKAFf/3QBZ/9UAXgAMAGz/6QCqAA4ArQAXAOMAGgAHAAr/7AAQ//YAN//1ADn/1AA+/+8AWf/2AF7/8QAGAAr/7wA+//MAV//6AFn/+gBe//MA4//3AAsAB//6AAr/7AAL//IAIP/tADf/ywA5//oAPf/pAD7/6QBX//YAXv/sAOP/5wALAAf/+gAK/+wAC//yACD/7QA3/8sAOf/6AD3/6QA+/+kAV//2AF7/7ADj/+cACwAH//oACv/sAAv/8gAg/+0AN//LADn/+gA9/+kAPv/pAFf/9gBe/+wA4//nAAsAB//6AAr/7AAL//IAIP/tADf/ywA5//oAPf/pAD7/6QBX//YAXv/sAOP/5wALAAf/+gAK/+wAC//yACD/7QA3/8sAOf/6AD3/6QA+/+kAV//2AF7/7ADj/+cACwAH//oACv/sAAv/8gAg/+0AN//LADn/+gA9/+kAPv/pAFf/9gBe/+wA4//nAAwAB//6AAr/6wAL//UAIP/vADf/ygA5//AAPf/tAD7/6wBX//sAWf/6AF7/7QDj/+sABQAH/+8ACv/2ADf/4QA+//QA4//0AAwAB//6AAr/6wAL//UAIP/vADf/ygA5//AAPf/tAD7/6wBX//sAWf/6AF7/7QDj/+sADAAH//oACv/rAAv/9QAg/+8AN//KADn/8AA9/+0APv/rAFf/+wBZ//oAXv/tAOP/6wAMAAf/+gAK/+sAC//1ACD/7wA3/8oAOf/wAD3/7QA+/+sAV//7AFn/+gBe/+0A4//rAAwAB//6AAr/6wAL//UAIP/vADf/ygA5//AAPf/tAD7/6wBX//sAWf/6AF7/7QDj/+sAAgAH//gAN//3AAIAB//4ADf/9wAEAAf/+AALABMAIAAOADf/9wAEAAf/+AALAAoAN//3AOMABgAKAAf/+wAK/+sAC//2ACD/9AA9//QAPv/tAFf//ABZ//UAXv/uAOP/7wALAAf/+gAK/+wAC//zACD/7gA3/8wAOf/6AD3/6gA+/+kAV//3AF7/7ADj/+gACwAK/+UAC//yACD/7AA3/8sAOf/XAD3/6gA+/+cAV//5AFn/8QBe/+kA4//pAAsACv/lAAv/8gAg/+wAN//LADn/1wA9/+oAPv/nAFf/+QBZ//EAXv/pAOP/6QALAAr/5QAL//IAIP/sADf/ywA5/9cAPf/qAD7/5wBX//kAWf/xAF7/6QDj/+kACwAK/+UAC//yACD/7AA3/8sAOf/XAD3/6gA+/+cAV//5AFn/8QBe/+kA4//pAAsACv/lAAv/8gAg/+wAN//LADn/1wA9/+oAPv/nAFf/+QBZ//EAXv/pAOP/6QALAAr/5QAL//IAIP/sADf/ywA5/9cAPf/qAD7/5wBX//kAWf/xAF7/6QDj/+kACAAH//kACv/uADf/1AA5//gAPf/xAD7/7ABe/+4A4//uAAgAB//5AAr/7gA3/9QAOf/4AD3/8QA+/+wAXv/uAOP/7gAIAAf/+QAK/+4AN//UADn/+AA9//EAPv/sAF7/7gDj/+4ACAAH//kACv/uADf/1AA5//gAPf/xAD7/7ABe/+4A4//uAAkAB//0AAr/7wAQ//EAN//2ADn/3AA+/+4AVwAfAFkAHABe//MACwAK/+UAC//yACD/7AA3/8sAOf/XAD3/6gA+/+cAV//5AFn/8QBe/+kA4//pAAkAB//0AAr/7wAQ//EAN//2ADn/3AA+/+4AVwAfAFkAHABe//MABQCqAFIAqwABAKwAPQCtAGAAyAABAAIAB//5AFf/8AAMAAf/+gAK/+sAC//1ACD/7wA3/8oAOf/wAD3/7QA+/+sAV//7AFn/+gBe/+0A4//rAAcACv/rADf/8wA5/+YAPv/uAFn/8wBe/+8A4//4AAsACv/lAAv/8gAg/+wAN//LADn/1wA9/+oAPv/nAFf/+QBZ//EAXv/pAOP/6QAGAAv/9AA3//oAOf/5AFf/4ABZ/+sA4//4AAkACv/tACD/7wA3/8sAOf/0AD3/7wA+/+wAV//8AF7/7wDj/+oACgAH/9cAEP/cACH/4gA3ACUAOQAjAFf/uQBZ/7wAbP/wAKwAAQCtAA8ABQAH//UAN//uAD7/9QBXABEA4//4AAIAB//4ADf/9wAEADf/3wA5/+EAV//4AFn/6gAEADf/3wA5/+EAV//4AFn/6gACABD/1QAh/+wABAAD/4MAN//AAFf/4QDZ/4MAAgAQ/9UAIf/sAAQAA/+DADf/wABX/+EA2f+DAAEAN//0AAMAN//hADn/8QBZ//MABQAH/+0AEP/vADcABwBXACAAWQAPAAIAB//4ADf/9wACAAf/+AA3//cAAwAH//cAN//1AHX/xAACAAf/+AA3//cAAwAH//cAN//1AHX/xAAFAAf/9QA3/+4APv/1AFcAEQDj//gAARjSAAQAAAAEABIAJACaAbwABAAN/34AD/9+ANf/fgDe/34AHQAD/9IACP/SADX/0AA2//sAOv/IAEf/8wBV//EAWv/rAIQAEwCX//sAmP/7AJn/+wCa//sAm//IAJ3/8wC7/+sAvf/rAL7/8wDAABMAxv/QAMf/8QDW/9IA2f/SAPL/8wDz//MA9P/zAPX/8wD2//MA9//zAEgAJP/rACj/6wAw/+sAMv/rADb/9ABC/+0ARP/lAEX/5QBG/+UAR//zAEj/5QBO/+4AT//uAFD/5QBR/+4AUv/lAFP/7gBU/+0AVf/qAFb/6QBa//EAhf/rAJD/6wCR/+sAkv/rAJP/6wCU/+sAlv/rAJf/9ACY//QAmf/0AJr/9ACd//MAnv/tAJ//7QCg/+0Aof/tAKL/7QCj/+0ApP/tAKX/5QCm/+UAp//lAKj/5QCp/+UArv/lAK//7gCw/+UAsf/lALL/5QCz/+UAtP/lALb/5QC3/+kAuP/pALn/6QC6/+kAu//xAL3/8QC+//MAwf/tAML/6wDD/+UAxf/tAMf/6gDy//MA8//zAPT/8wD1//MA9v/zAPf/8wD4/+0AEwBE//IARf/yAEb/8gBI//IAUP/yAFL/8gCl//IApv/yAKf/8gCo//IAqf/yAK7/8gCw//IAsf/yALL/8gCz//IAtP/yALb/8gDD//IAARbUAAQAAAAWADYAgAFKAVwCWgOkBLIGVAeqCLgJOgqgC+IM8A0CDTAPCg+4D8IP3A/mD/wAEgAi/9cAQv/2AH7/1wB//9cAgP/XAIH/1wCC/9cAg//XAIT/zQCe//YAn//2AKD/9gCh//YAov/2AKP/9gCk//YAwP/NAMH/9gAyACL/4ABC/+wARP/qAEX/6gBG/+oASP/qAE7/8QBP//EAUP/qAFH/8QBS/+oAU//xAFT/7wBW//IAfv/gAH//4ACA/+AAgf/gAIL/4ACD/+AAhP/vAJ7/7ACf/+wAoP/sAKH/7ACi/+wAo//sAKT/7ACl/+oApv/qAKf/6gCo/+oAqf/qAK7/6gCv//EAsP/qALH/6gCy/+oAs//qALT/6gC2/+oAt//yALj/8gC5//IAuv/yAMD/7wDB/+wAw//qAMX/7wD4/+8ABAA1/+4AOv/oAJv/6ADG/+4APwA1/9YAOv/jAEP/+QBE//sARf/7AEb/+wBH//UASP/7AEn/+QBK//gAS//4AEz/+QBO//kAT//5AFD/+wBR//kAUv/7AFP/+QBU//cAVf/yAFb/+QBa//YAhP/4AJv/4wCd//UApf/7AKb/+wCn//sAqP/7AKn/+wCq//gAq//4AKz/+ACt//gArv/7AK//+QCw//sAsf/7ALL/+wCz//sAtP/7ALb/+wC3//kAuP/5ALn/+QC6//kAu//2ALz/+QC9//YAvv/1AMD/+ADD//sAxf/3AMb/1gDH//IAyP/4APL/9QDz//UA9P/1APX/9QD2//UA9//1APj/9wBSAA3/uQAP/7kAIv/MAEL/tABD//kARP/sAEX/7ABG/+wAR//uAEj/7ABJ//kASv/1AEv/9QBM//kATv/lAE//5QBQ/+wAUf/lAFL/7ABT/+UAVP/sAFX/5QBW/+gAWv/zAHn/8wB+/8wAf//MAID/zACB/8wAgv/MAIP/zACE/7EAnf/uAJ7/tACf/7QAoP+0AKH/tACi/7QAo/+0AKT/tACl/+wApv/sAKf/7ACo/+wAqf/sAKr/9QCr//UArP/1AK3/9QCu/+wAr//lALD/7ACx/+wAsv/sALP/7AC0/+wAtv/sALf/6AC4/+gAuf/oALr/6AC7//MAvP/5AL3/8wC+/+4AwP+xAMH/tADD/+wAxf/sAMf/5QDI//UA1/+5ANr/uQDe/7kA4P/zAPL/7gDz/+4A9P/uAPX/7gD2/+4A9//uAPj/7ABDAA3/sgAP/7IAIv/UADr/+wBC/+YAQ//6AET/8gBF//IARv/yAEj/8gBJ//oASv/4AEv/+ABM//oATv/4AE//+ABQ//IAUf/4AFL/8gBT//gAVP/5AFb/+QB+/9QAf//UAID/1ACB/9QAgv/UAIP/1ACE/7EAm//7AJ7/5gCf/+YAoP/mAKH/5gCi/+YAo//mAKT/5gCl//IApv/yAKf/8gCo//IAqf/yAKr/+ACr//gArf/4AK7/8gCv//gAsP/yALH/8gCy//IAs//yALT/8gC2//IAt//5ALj/+QC5//kAuv/5ALz/+gDA/7EAwf/mAMP/8gDF//kAyP/4ANf/sgDa/7IA3v+yAPj/+QBoAA3/wAAO/98AD//AABv/9wAc//cAIv/UACT/8wAo//MAMP/zADL/8wA0//sANQAfADoAMABC/8oAQ//4AET/ywBF/8sARv/LAEf/9QBI/8sASf/4AEr/9wBL//cATP/4AE7/1ABP/9QAUP/LAFH/1ABS/8sAU//UAFT/zgBV/+gAVv/XAFr/9gBq/+EAef/0AH7/1AB//9QAgP/UAIH/1ACC/9QAg//UAIT/0ACF//MAkP/zAJH/8wCS//MAk//zAJT/8wCW//MAmwAwAJ3/9QCe/8oAn//KAKD/ygCh/8oAov/KAKP/ygCk/8oApf/LAKb/ywCn/8sAqP/LAKn/ywCr//cArv/LAK//1ACw/8sAsf/LALL/ywCz/8sAtP/LALb/ywC3/9cAuP/XALn/1wC6/9cAu//2ALz/+AC9//YAvv/1AMD/0ADB/8oAwv/zAMP/ywDE//sAxf/OAMYAHwDH/+gAyP/3ANP/3wDU/98A1//AANr/wADe/8AA3//hAOD/9ADy//UA8//1APT/9QD1//UA9v/1APf/9QD4/84AVQAO/+EAIgAgACT/5gAo/+YAMP/mADL/5gA0//oANQAgADoAJQBC//YARP/YAEX/2ABG/9gAR//xAEj/2ABO//gAT//4AFD/2ABR//gAUv/YAFP/+ABU//cAVf/UAFb/4QBa/9wAav/xAH4AIAB/ACAAgAAgAIEAIACCACAAgwAgAIX/5gCQ/+YAkf/mAJL/5gCT/+YAlP/mAJb/5gCbACUAnf/xAJ7/9gCf//YAoP/2AKH/9gCi//YAo//2AKT/9gCl/9gApv/YAKf/2ACo/9gAqf/YAK7/2ACv//gAsP/YALH/2ACy/9gAs//YALT/2AC2/9gAt//hALj/4QC5/+EAuv/hALv/3AC9/9wAvv/xAMH/9gDC/+YAw//YAMT/+gDF//cAxgAgAMf/1ADT/+EA1P/hAN//8QDy//EA8//xAPT/8QD1//EA9v/xAPf/8QD4//cAQwAi/+8AJP/vACj/7wAw/+8AMv/vADoACgBC/+wARP/nAEX/5wBG/+cASP/nAE7/7ABP/+wAUP/nAFH/7ABS/+cAU//sAFT/7ABV/+wAVv/pAFr/8QB+/+8Af//vAID/7wCB/+8Agv/vAIP/7wCF/+8AkP/vAJH/7wCS/+8Ak//vAJT/7wCW/+8AmwAKAJ7/7ACf/+wAoP/sAKH/7ACi/+wAo//sAKT/7ACl/+cApv/nAKf/5wCo/+cAqf/nAK7/5wCv/+wAsP/nALH/5wCy/+cAs//nALT/5wC2/+cAt//pALj/6QC5/+kAuv/pALv/8QC9//EAwf/sAML/7wDD/+cAxf/sAMf/7AD4/+wAIAAD/9gACP/YACT/9gAo//YAMP/2ADL/9gA1/9wANv/yADr/1ABV//YAWv/zAIQACACF//YAkP/2AJH/9gCS//YAk//2AJT/9gCW//YAl//yAJj/8gCZ//IAmv/yAJv/1AC7//MAvf/zAMAACADC//YAxv/cAMf/9gDW/9gA2f/YAFkADf/hAA7/+AAP/+EAIv/cACP/9wAl//cAJv/3ACf/9wAp//cAKv/3ACz/9wAt//cALv/3AC//9wAx//cAM//3ADX/zwA2//gAOv/dAEL/+gBE//kARf/5AEb/+QBHABwASP/5AFD/+QBS//kAVQAVAFoAGwB+/9wAf//cAID/3ACB/9wAgv/cAIP/3ACG//cAh//3AIj/9wCJ//cAiv/3AIv/9wCM//cAjf/3AI7/9wCP//cAl//4AJj/+ACZ//gAmv/4AJv/3QCc//cAnQAcAJ7/+gCf//oAoP/6AKH/+gCi//oAo//6AKT/+gCl//kApv/5AKf/+QCo//kAqf/5AK7/+QCw//kAsf/5ALL/+QCz//kAtP/5ALb/+QC7ABsAvQAbAL4AHADB//oAw//5AMb/zwDHABUA0//4ANT/+ADX/+EA2v/hAN7/4QDyABwA8wAcAPQAHAD1ABwA9gAcAPcAHABQAA7/6QAj//sAJP/zACX/+wAm//sAJ//7ACj/8wAp//sAKv/7ACz/+wAt//sALv/7AC//+wAw//MAMf/7ADL/8wAz//sANf+8ADb/9gA6/9UARP/xAEX/8QBG//EARwAVAEj/8QBQ//EAUv/xAFoADwBq//MAhf/zAIb/+wCH//sAiP/7AIn/+wCK//sAi//7AIz/+wCN//sAjv/7AI//+wCQ//MAkf/zAJL/8wCT//MAlP/zAJb/8wCX//YAmP/2AJn/9gCa//YAm//VAJz/+wCdABUApf/xAKb/8QCn//EAqP/xAKn/8QCu//EAsP/xALH/8QCy//EAs//xALT/8QC2//EAuwAPAL0ADwC+ABUAwv/zAMP/8QDG/7wA0//pANT/6QDf//MA8gAVAPMAFQD0ABUA9QAVAPYAFQD3ABUAQwAi//MAJP/vACj/7wAw/+8AMv/vADoADABC/+8ARP/qAEX/6gBG/+oASP/qAE7/7gBP/+4AUP/qAFH/7gBS/+oAU//uAFT/7gBV/+8AVv/sAFr/9QB+//MAf//zAID/8wCB//MAgv/zAIP/8wCF/+8AkP/vAJH/7wCS/+8Ak//vAJT/7wCW/+8AmwAMAJ7/7wCf/+8AoP/vAKH/7wCi/+8Ao//vAKT/7wCl/+oApv/qAKf/6gCo/+oAqf/qAK7/6gCv/+4AsP/qALH/6gCy/+oAs//qALT/6gC2/+oAt//sALj/7AC5/+wAuv/sALv/9QC9//UAwf/vAML/7wDD/+oAxf/uAMf/7wD4/+4ABAA1/9AAOv/gAJv/4ADG/9AACwAi//UANf/vADr/5wB+//UAf//1AID/9QCB//UAgv/1AIP/9QCb/+cAxv/vAHYAIv/xACP/8AAk/+oAJf/wACb/8AAn//AAKP/qACn/8AAq//AALP/wAC3/8AAu//AAL//wADD/6gAx//AAMv/qADP/8AA0//AANf+7ADb/5wA6/8kAQv/rAEP/7gBE/+cARf/nAEb/5wBH/+8ASP/nAEn/7gBK/+4ATP/uAE7/7gBP/+4AUP/nAFH/7gBS/+cAU//uAFT/7QBV/+wAVv/pAFr/8wB+//EAf//xAID/8QCB//EAgv/xAIP/8QCF/+oAhv/wAIf/8ACI//AAif/wAIr/8ACL//AAjP/wAI3/8ACO//AAj//wAJD/6gCR/+oAkv/qAJP/6gCU/+oAlv/qAJf/5wCY/+cAmf/nAJr/5wCb/8kAnP/wAJ3/7wCe/+sAn//rAKD/6wCh/+sAov/rAKP/6wCk/+sApf/nAKb/5wCn/+cAqP/nAKn/5wCq/+4Aq//uAKz/7gCt/+4Arv/nAK//7gCw/+cAsf/nALL/5wCz/+cAtP/nALb/5wC3/+kAuP/pALn/6QC6/+kAu//zALz/7gC9//MAvv/vAMH/6wDC/+oAw//nAMT/8ADF/+0Axv+7AMf/7ADI/+4A8v/vAPP/7wD0/+8A9f/vAPb/7wD3/+8A+P/tACsADf/dAA//3QAi/+8ANf/TADr/3gBC//gAQ//7AEn/+wBK//sAS//7AEz/+wBO//sAT//7AFH/+wBT//sAfv/vAH//7wCA/+8Agf/vAIL/7wCD/+8AhP/FAJv/3gCe//gAn//4AKD/+ACh//gAov/4AKP/+ACk//gAqv/7AKv/+wCs//sArf/7AK//+wC8//sAwP/FAMH/+ADG/9MAyP/7ANf/3QDa/90A3v/dAAIAVf/8AMf//AAGAAP/8wAI//MA1f/0ANb/8wDY//QA2f/zAAIASgALAEsACwAFAA3/fgAP/34A1/9+ANr/fgDe/34ACQAi/+IAfv/iAH//4gCA/+IAgf/iAIL/4gCD/+IAhP/iAMD/4gACBuIABAAAB4gJcgAdABoAAP/0//r/6f/y//n/3//C/9P/wP/y/9P/6//y/+3/+gAqAAAAAAAAAAAAAAAAAAAAAAAAAAD/8P/5/+z/9wAA/9IAAAAAAAD/6gAA//n/9QAAAAAAAP/2AAAAAAAAAAAAAAAAAAAAAAAA//r/9wAAAAD/9gAA/+QAAP/fAAAAAAAA//gAAP/3//H/+v/t//b/0QAAAAAAAAAAAAAAAP/y//n/7//5AAD/8gAAAAAAAAAAAAD/9f/zAAAAAAAA//oAAP/5AAAAAAAAAAAAAAAAAAD/8v/2//UAAP/2//kAAAAA//sAAAAA//j/8wAA//YAAP/1AAD/9QAAAAAAAAAAAAAAAAAA//r/9wAAAAD/9gAA/+gAAP/hAAAAAAAA//gAAP/3//L/+v/t//b/1AAAAAAAAAAAAAAAAAAA//j/6gAA//f/4//bAAD/+AAAAAD/5v/3AAD/+AAA//kAAAAAAAAAAAAAAAAAAAAAAAD/q/+9/8H/6P/2/7sAAAAAACv/wAAA/+L/vgAA//r/wv+0/8D/sf/L/8X/zf/WAAAAAAAA//H/7v/2AAD/8f/6AAAAAAAAAAAAAP/4/+4AAP/z/+z/8P/u/+//9gAAAAAAAAAAAAAAAP+p/7r/yf/i//f/3gAqAAAAMv++AAD/6P+8AAD/+P/A/6v/tf+v/7j/xf/g/+b/+//3AAAAAAAA//v/9gAA//n/pf/y/6oAAP/z//r//P/qAAD/+wAAAAAAAAAAAAAAAAAA//L/9AAA//wAAAAA//UAAAAA/6AAAP+6//QAAAAAAAD/9wAAAAAAAAAAAAAAAAAAAAAAAAAA//UAAAAAAAAAAAAAAAAAAP/WAAD/5gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/+wAAAAD/r//0/60AAP/1AAAAAP/zAAD/+wAAAAAAAAAAAAAAAAAA//X/9QAA//cAAAAVAAAAAAAgAAAAAAAT/+EAAAAAAAAAAAAA/9MAAP/j//AAAP/xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/NAAD/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/xf/q/8UAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/0AAAAAAAA/8AAAP++AAAAAP/zAAAAAAAA//IAAAAAAAAAAAAAAAAAAAAA/+0AAAAAAAAAAP/2AAAAAP/2AAD/+AAAAAAAAAAA//EAAP/5AAAAAAAAAAAAAAAAAAD/9v/3AAAAAAAAAAD/9QAAAAD/9wAA//UAAAAAAAAAAP/uAAD/+AAAAAAAAAAAAAAAAAAA//b/9wAAAAAAAP/8//YAAP/6/6b/8v+vAAD/9f/7AAD/6wAA//sAAAAAAAAAAAAAAAAAAP/y//UAAAAAAAD//P/6AAD/+/+q//D/qQAA//H/+wAA//EAAP/0AAAAAAAAAAAAAAAAAAD/8v/yAAAAAAAA//T/7QAA/+T/wP+J/7UAAP+E//YAAP/uAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/9MAAP+EAAD/xwAAAAAAAAAAAAAAAP/kAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/N//D/if/y/8D/3gAAAAAAAAAAAAAAAAAA//z/9wAAAAD/sgAA/7AAAAAAAAAAAP/wAAAAAAAAAAAAAAAAAAAAAAAA//X/+gAAAAAAAAAHAAAAAAAP/7cAAP/TAAAAAAAAAAD/+QAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/3AAAAAP+9AAD/ugAAAAAAAAAA/+4AAP/6AAAAAAAAAAAAAAAAAAD/9v/4AAD/+wAAABYAAAAAAB3/0AAA/98AAAAAAAAAAP/6AAD/3gAA/+T//AAAAAAAAAAA//kAAAACAB0AAwADAAAABwAJAAEACwALAAQADQAQAAUAGwAcAAkAIgAnAAsAKQAqABEALgAyABMANAA3ABgAOQA6ABwAPAA9AB4AQgBEACAARgBLACMATQBXACkAWQBaADQAXABcADYAYQBhADcAagBqADgAbABsADkAeQB5ADoAfQCUADsAlgC0AFMAtgC+AHIAwADIAHsA0wDUAIQA1gDXAIYA2QDaAIgA3wDgAIoA8gD4AIwAAQAEAAMABwAJAAsAAQAWAAsAEAAhACMAJwAxADcAOQA8AD0AVwBZAFwAYQBsAH0AnACdAK4AvgDZAOMAAgAbAAMAAwAAAAgACAABAA0ADwACABsAHAAFACIAIgAHACQAJgAIACkAKgALAC4AMAANADIAMgAQADQANgARADoAOgAUAEIARAAVAEYASwAYAE0AUgAeAFQAVgAkAFoAWgAnAGoAagAoAHkAeQApAH4AlAAqAJYAmwBBAJ4ArQBHAK8AtABXALYAvQBdAMAAyABlANMA2gBuAN8A4AB2APIA+AB4AAIAUQADAAMAGAAIAAgAGAANAA0AFgAOAA4AEQAPAA8AFgAbABwADAAkACQAAQAlACUAAgAmACYAAwApACoABAAuAC8ABAAwADAABQAyADIABQA0ADQABgA1ADUABwA2ADYACAA6ADoACQBCAEIACgBDAEMAFQBEAEQACwBGAEYADQBHAEcADgBIAEgAGwBJAEkAFABKAEsAEgBNAE0AEwBOAE8AFABQAFEAFQBSAFIAGwBUAFQAGQBVAFUAGgBWAFYAGwBaAFoAHABqAGoADwB5AHkAEACEAIQAAwCFAIUAAQCGAIkAAwCKAI0ABACOAI4AAgCPAI8ABACQAJQABQCWAJYABQCXAJoACACbAJsACQCeAKMACgCkAKQADQClAKUACwCmAKkADQCqAK0AEgCvAK8AFACwALQAFQC2ALYAFQC3ALoAGwC7ALsAHAC8ALwAFQC9AL0AHADAAMAAAwDBAMEADQDCAMIABQDDAMMAFQDEAMQABgDFAMUAGQDGAMYABwDHAMcAGgDIAMgAEgDTANQAEQDVANUAFwDWANYAGADXANcAFgDYANgAFwDZANkAGADaANoAFgDfAN8ADwDgAOAAEADyAPIADgDzAPQAEgD1APUAEwD2APYAEgD3APcAEwD4APgAGgABAAMA9gAIAAAAAAAAAAAACAAAAAAAAAAAABIACgASAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAXABcAAAAAAAAAAAAAABAAGAAEABgAGAAYAAQAGAAYAAAAGAAYABgAGAAEABgABAAYABkABwAOAAAAAAAAAAkAAAAAAAAAAAAAAAAAAAATAA8AAQABAAEADAABAA8ABQAFAA8AAAACAAIAAQACAAEAAgARAAMADQAAAAAAAAAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABYAAAAAAAAAAAAQABAAEAAQABAAEAAUAAQAGAAYABgAGAAYABgAGAAYABgAGAAEAAQABAAEAAQAAAAEAA4ADgAOAA4ACQAYAAwAEwATABMAEwATABMAEwABAAEAAQABAAEABQAFAAUABQABAAIAAQABAAEAAQABAAAAAQANAA0ADQANAAYADwAGAAwAAAAUABMABAABABkAEQAHAAMABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAoACgALAAgAEgALAAgAEgAAAAAAAAASABUAFgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAMAAwADAAMAAwAEQABAAAACgDIAigAA2N5cmwAFGdyZWsAJGxhdG4ANAAEAAAAAP//AAMAAAAJABMABAAAAAD//wADAAEACgAUAC4AB0FaRSAAOkNSVCAARkRFVSAAUk1PTCAAXlJPTSAAalNSQiAAdlRSSyAAfgAA//8AAwACAAsAFQAA//8AAwADAAwAFgAA//8AAwAEAA0AFwAA//8AAwAFAA4AGAAA//8AAwAGAA8AGQAA//8AAwAHABAAGgAA//8AAQARAAD//wADAAgAEgAbABxmcmFjAKpmcmFjALBmcmFjALZmcmFjALxmcmFjAMJmcmFjAMhmcmFjAM5mcmFjANRmcmFjANpsaWdhAOBsaWdhAOhsaWdhAPBsaWdhAPhsaWdhAP5saWdhAQRsaWdhAQxsaWdhARRsaWdhARxsaWdhASRvcmRuASpvcmRuATBvcmRuATZvcmRuATxvcmRuAUJvcmRuAUhvcmRuAU5vcmRuAVRvcmRuAVoAAAABAAAAAAABAAAAAAABAAAAAAABAAAAAAABAAAAAAABAAAAAAABAAAAAAABAAAAAAABAAAAAAACAAIAAwAAAAIAAgADAAAAAgACAAMAAAABAAMAAAABAAMAAAACAAIAAwAAAAIAAgADAAAAAgACAAMAAAACAAIAAwAAAAEAAwAAAAEAAQAAAAEAAQAAAAEAAQAAAAEAAQAAAAEAAQAAAAEAAQAAAAEAAQAAAAEAAQAAAAEAAQAGAA4AHAAqADIAOgBCAAYAAAAEADwAUABkAHgABgAAAAQAfgCQAKIAtgAEAAAAAQC8AAQAAAABANAABAAAAAEA9AABAAAAAQFOAAMAAAADAVABVgFQAAAAAQAAAAQAAwAAAAMBSgFCAVAAAAABAAAABAADAAAAAwE2AS4BQgAAAAEAAAAEAAMAAAADATQBGgEuAAAAAQAAAAQAAwABASYAAQEwAAAAAQAAAAUAAwABARQAAQEkAAAAAQAAAAUAAwACARgBAgABAQwAAAABAAAABQADAAIBBADuAAEA/gAAAAEAAAAFAAEA9gABAAgAAgAGAA4A9gADAEcASgD0AAIASgABANoAAQAIAAQACgASABgAHgD3AAMARwBNAPIAAgBHAPMAAgBLAPUAAgBNAAEAtAADAAwAIgBMAAIABgAOAAYAAwAQABEABgADAOEAEQAEAAoAEgAaACIAewADABAAEwB6AAMAEAAVAHsAAwDhABMAegADAOEAFQACAAYADgB8AAMAEAAVAHwAAwDhABUAAgBcAAIAaQB4AAEAAQARAAEAAgAQAOEAAQABABIAAQABABMAAQABABUAAQABABQAAgABABEAGgAAAAEAAQBCAAEAAQBQAAEAAQAPAAEAAQBHAAEAAwARABIAFAABAAIAQgBQAQAEAgABAQEMVmFyZWxhUm91bmQAAQEBKvgQAPg7Afg7DAD4PAL4PAP4PQT7IPuy+nD6KgUcDCwPHA19EaAcQsgSACMCAAEACAANABQAGwAmADEAPQBJAFAAVwBfAGYAaABsAHEAfACBAIgAkQCYAKAAqACzALsAxADQANcA2gDdAOIA5wDqAVwBaAFudW5pMDBBMGxvbmdzQUVhY3V0ZWFlYWN1dGVPc2xhc2hhY3V0ZW9zbGFzaGFjdXRlU2NvbW1hYWNjZW50c2NvbW1hYWNjZW50dW5pMDIxQXVuaTAyMUJkb3RsZXNzanVuaTAzQTlwaUV1cm9PbWVnYXBhcnRpYWxkaWZmRGVsdGFwcm9kdWN0c3VtbWF0aW9ucmFkaWNhbGluZmluaXR5aW50ZWdyYWxhcHByb3hlcXVhbG5vdGVxdWFsbGVzc2VxdWFsZ3JlYXRlcmVxdWFsbG96ZW5nZWZfZmZfamZfZl9pZl9mX2xzX3RDb3B5cmlnaHQgKGMpIDIwMTEsIEpvZSBQcmluY2UsIEFkbWl4IERlc2lnbnMgKGh0dHA6Ly93d3cuYWRtaXhkZXNpZ25zLmNvbS8pIHdpdGggUmVzZXJ2ZWQgRm9udCBOYW1lIFZhcmVsYSBSb3VuZC5WYXJlbGEgUm91bmROb3JtYWwAjQIAAQApACwAVABcAF8ArgDKANABSwGQAaYB5wIJAkgCXQJiApACngKmAr8CyQLPAu0DAAMcA0QDTQNXA2ADdAO4A9sEHQQ1BHYEggSJBJsEowSwBMkEzgThBPsFAwUuBTMFNwVUBWYFcAWSBZcFnAXDBdkGAAYHBgwGEAYaBi4GMgY9BkIGWwZoBm4GjgafBqkGtAa5Br0GxAbNBugG9wcGBwoHEAcUBxkHJAcuBzgHTwdmB3MHeQeHB5MHnwemB6kHsAe7B8YH0QfcB+EH5wfxB/sIAwgHCAsIGggjCCoIMwg6CEgIVQhdCGUIaghuCHoIfQiDCIcIkgiWCJ8Iqgi1CLwIwwjGCNAI2gjkCOgI8Qj6CQAJBgkLCRAJFHqBg4CFH1gxBYmIhoODGnuWgJuVkY+SkR7Q3QWSk46TlBqhfJp1HgsgCg6PBlR1dm56HoGFhoOAGnuXfZySko6Njh6yo7a12xrAB5EHqnKkbB4LIgr3PRYiCg4VIx3lA/hp9wIVhIaKiIUfeGZlf08b+wBSxeWBH/fnBqedn6T3GTf3C/su+zpC+xb7G/s86yr3N2IdoAoe+0n34RXL2WEjkR/7uwbzkdi1yxsL96OJHSwdg/sNB/swQUctLddT4unFsrCvH3EHC6OenTMKC/dMi9n4r+YSwew53fh83TnsE+T4H/j9Ffct5vsP+xz7OC9BUGkffoOBe3sacqF2pB73TQY1HSYGE9jJvsrj9ywa9zb7DvdF+2D7YPsO+0X7NvssyjPJWB4mBhPoMgr3TQakoaCkm4GbfpMfUK0v1fc4Gvcc5vcP9y0eDgWJiImHhBqClISUj4+NjI0elJ2XjZkbn5uAd2hygGt6d5CXdR+MiYeNhxt+hYGBhJGEkIgfdq2thqEb0rOpybVrp14fDgP4sykK/CVbCvzzB3Kfd6Qe+CUoCguViJSFkh77NPc+9zT3PgWRko6UlRqiept1gICHhIUe+zj7SQWBgIN7exp7k3uVgB73OPtJBYSRloeWG6Gcm6IfC0RUe3dcH3qEgn16GnWce5+PkIyMjx6XsLOXwxvlt2gyHwsVkoiShpAeR9EFloGAlHgbZQZ4gIKAgR9HRQWGhoiEhBp8ipl8nBuRk46Pjx/i1eJBBYePk4iRG5yZmpqKHwv3FPiXWh38QQdyn3ekpU8d+EFbHQtNCk4dC2cd+zLwIPcv9y7x9vcy9zIl9vsuH/xTBD4zvfcZ9xjjvNjX5Fr7GPsZMlk/HwuXc22TahtEPF37Eh9RC4UHbKRyqh4LVWG6URtXa1RjfpaBl5iSlJSOH56TlpifC/khmx1jCh8xHQuhnJxDCgv7Oi33DPcu9y7p9wz3Ovc56vsM+y77Liz7DPs5Hwv7Fnb3PXb3CneEHRPwNAoT6CMKWR0T6Pe2NB1QBxPwMgoT6Mb8HAZyn3ekpU8dCxV1fHx1go6DkoMf0DkFhJGRh5Ubm5aWm5OGk4mOH1jlBZaFgZN6GwuPHffDxhUrHQtyn3ekpU8d+BwLdwHn5vgcKwoLFZeKg5V9G3yFgYCHH3qFgYF2GwsVkZCMjZAf+CP3RwWhlZmeohqTB6J9nnWVHvwj90cFjYaGjIUbdXl6dHuWfJuEH/f8+zT7/Ps0BXuEgHx7GnSdeqEeCxVZ97wGo3qecYSEiYiFHkNmBX+FhICAGnqZfpuRj42NkB4LqldLnUMb+5j7+xX3Lun3DPc6wLl+dbEe+878VQVVvW7V4Rr3mPumFVZdl6FlH/fP+FUFwFmoQDca+y4s+wz7OR4LZ/xWFTpysLbExKHpH/cBNwZkaVFnTRsLmn6YfH6BgoCHHm2AdnhkPjnWJhtTY2tMcB+Jh4qHiBp8mH6alpWSlo8eqZahoLPY3UDwG8O5qcyhH4yOjJCOGgtACvuwByDMMvcGHgsBmB0DMB0LVR0T6zIKE+dqHffD/BwHOx0LUQoTzYAuCgv3IkwK/P0lCvj9WgoL+kUpCvx8Bnh6gXyBH/wj/PEFhYKHg4AaC290dG8LW7nCb9Ebbh0ffvxRFWkKgB0fDvvKBvsQ7oO6q6aSlqMemZKUlpwaoHmaeR4ObwpydndyHgsV1tiy8MjBgHu5HowdoZ+jfZZ9kB+fVUiYPRv7PTEt+wMf+4r4Pd37KBoLp3SibwufcR0Lbb/KetOUCoj3CmDuP8uywxiPkY2QkRqACmNRBQuKCo37C7cn2EtkVBhlCrPEBQucmJecnH6Yeh8LFU4dHomJi4kbSR0fiIuLihpOCh6PjIuMG00KH4yLjYwaDqR2oHILMR1QBwv3Sgf3Xsz3CPX1SvcI+14fgvv6FftB96T3QQb3Ka9ESkpnRPspHw51e3l3epV9m4YfhZ2giKMb667H2B8LFSFUPCcnwjz19cLa7+9U2iEf+7kEUGu9y8urvcbGq1lLS2tZUB8Ljwr3I2IKCxVqCh8LXh0eC+abdvdM3vhNdwu4oQX7nU8Hen9+enqXf5wf90IGC3AKcQu/tlvGG72tv7YfC3WceqELcp93pB74JSgK/FL3RRX7kgb3effzBaQGC+K3nqS3H5mTl5ibGgvSq5y9Hgtyn3ekHvddBveD9wb3Sfc89z37BvdI+4MfgPz5FfskC4aUkIqTG6CcoJ6ag5d/kx8LZR2haVmlPI4dC/fEiR37LyYg+zILXR1SHQtZCh8LxvwcBjsdCxX8eV4K+HlXCm9WV3g9G/tFMPcK9y73Lub3CvdF2b94b8AfCxv7FkpHMR/7SvfAvjUaC/cN9w3q9z73PvsN6vsNC3AdAQubdvlYdwufpB4Ldvicdwv3FPiWWh38zXsKC3h7e3h4m3ueHwt5mX2dnZmZnR4LeWhvfVcb+whH1Pb2z9T3CL+nfXmuHwsGc/soi4mJGnecfJ2dmZmajh6k9zIFC/eSgRXkwrm5tR9iBwugd6SlHQtSHft3FvcT9zYF+zYHCx6JlpOTlokIgsOdCx6NgIODgI0IlFN5C/cb+XtJCgtSHQ4Gd3t7gwoL6tBN+wr7CkZNLAuXk5OXmhqeeqB2C15pcT5QYpmbZx4LglMfgImDk42WCAsS0IQKC8Lm+JzmC6uL4Pdy4Pdx4At1e3p1dZt7oR8Lkwqjnp6jHgv4nBULFiQKC/sN+w0s+z77PvcNLPcNC4mQkYmQG6SaC4+B31FyHQsb+yL7ESn7Owu0dvhqdwELmJKTlYyeCKCMe55yGwukgeBQdvhM4PdrdxIL+OB29y93AQv3YYHg+LjgC5t2+EkLmx0fC3WceaGhnZ2hHvm3CycdDrvm997mC/lYFQvg99b3DzbgErnmCxU7CgsGc3h3c5MKHws0P28oNUmgn14eCwaamJiamn6YfB8LErHm95jmC42B3vgA3gv3VQ6hmpugoHucdh8L+5r7JdH5kNESC/jfdvcfdwH35gukn58L+zdBdvnvdwEL9zz3Hvce9zwL+3G22LULhncS2uYL5vfW5gvfN/cKCx/7kwsBAAEGAGgAAAk3AHwAAEIdAYcAAGACAGcAAGQAAGYAAIMAAKoAAIsAAGoAAJcAAKUAAIAAAKEAAJwAAKQAAKkAAH0AAJgAAHMAAHIAAIUAAJYAAI8AAHgAAJ4AAJsAAKMAAHsAAK4AAKsBALAAAK0AAK8AAIoAALEAALUAALICALkAALYCAJoAALoAAL4AALsBAL8AAL0AAKgAAI0AAMQAAMECAMUAAJ0AAJUAAMsAAMgBAM0AAMoAAMwAAJAAAM4AANIAAM8CANYAANMCAKcAANcAANsAANgBANwAANoAAJ8AAJMAAOEAAN4CAOIAAKIAAOMAAYgAAGUAAYkIAH4AAIgAAIEBAIQAAIcAAH8AAIYAAZIBAG8AAIkAAEEAAAgAAHUAAGkAAHcAAHYAAHABAHQAAHkAAGsBAGMAAZQAAJkAAZUEAKYAAZoJAG0BAaQCAPkCAAEAZgBnAKMAvQELAcwCHgLJAssDGQNoBAcENgQ4BEsEUwSGBNEFGgV1BgwGZwblB2IHmwggCJkIqQjLCNgI/wkLCWoKQApICr4K8wsRCxgLQAvDC+wL9Aw5DIMMqg0DDUINRw1mDbEODg4jDjkOQg6IDv8Paw+2D/AQKhBbEIsQ3hEAEQoRGxE0EVMRjxGZEakSMRJqEnYSkhLlEwUTYBOWE5sT3RQbFE0UcRSRFKQU7hVhFcsV1hYaFoIWrRcUF18XYBetGEQZIRnVGlgbABsRG8ccRhxPHH0dMB1NHYYdwh3XHgceER5SHpEeoR65HtofKR84H3cfqCAFIHUghyCZIKsgySDSIOsg/iE6IUIhUSFZIWshcyGEIYwhpSH0If4iByITIhwiMiI8IqwivyLIItki4iL7IwQjLiOwI7cjzyPVJAIkCSQtJL4k7ST0JQUlCyUeJSYlLSU6JVEl8CX4JgAmDCYTJiomMiZSJtMm2yb1JvwnGicjJ0AnWCdiJ9sn9Sf/KBUoHihDKHEolyjOKOMo7CkxKXwpjSmhKesqCyobKh0qjCqeKrEqzSrPKtEq/CsSKygrWiuwK9Ar7ivzK/0sCizALVYtWC3VLhkuWS60Lr8vHy+aMAkwITCZML4w5DFGMYYx0zIPMkIyiDLYM1Uvi7346r0Bn734Cr0D+E2rCvwFBm50c24f/OUHbqJ0qB74BQaoo6KoH/jlB6hzo24ejvzuFfsy95H3MveRBWy5Ffsw+4/7MfePBW38vBX4jgf3MfuRBfsT+78V9zH3kPcw+5AFDg772Yf3C/jgdxLd9wsk4BPQ9yH3VRWglpecjB+d994F7geodaJubnR0bh4oB5373gV6jJd/oBs9BBPgfQr7V/iVdveTdwHH8eLxA8f5TRVYCvdRFlgKDpGbdvdP0fcs0fdOdwH4sPhuFT53CvsTdwozBnQd2AZz+ywFMwZ0Hdh3HfcTdx3jBnQKPwaKBqP3LAXjBnQK+0v7chX7Ewaj9ywF9xMGDpH7AvdONeH4ud0590sSweX3Jbj3JeUUDhOe9+L4FxX3ggfDir6AtnwIjB2gn6N9ln2QH1qdT5hGjQjYB5iBlX5+goF+HhNuPQf7LoM6MSEa+xj3Dmb3BW0e+3kHPI1OnWGeCI6Ejgp4dXmYfJqFH8B003bkhwg9BxOefpSCmJiVlJgeE17ZB/cjk+fa9wAa9yH7Dq37BaYe+1L3DxXNyLLfkx77dQc7n0qjzxr3UvxGFfdtB9p2zXRRGj1ObDeFHg73ZHnM93jMnMz3eMwBttH3StHf0fdK0QP3YPlfWB34KjlYHa75ChWefZZ3f4GFgYUe/Cv9HwWIhomFhRp4m32cmJaTlZEe+Cj5GwWQk42TkRoO9xKB2Pio9wE92RLS4WnfE6j41fcVFZ2knKiYpwiOkY2SkhqjeZxzenuAfYUeg3qBdXx1+2X3WRhDz2+mxxq5sLnRsKp/faUeE8iIkZGJkRufmpydmIKXgpAfo2ddn1gb+wlFOi1MpWOuYR8T0GRyQUskGijPIPdF3NGrucEezksFgpWTiJgbpZqfoJqFk4GUH/tKxRVsZVhyShs3SL7W0Lm5r6Mf93P7ZQUONwqjCr7mA/ed+wcVk4mSh5IeRvcHW/cd9yga9yi79x3Q9wcej5KNkpMaoAp6hISAgh4r+wZe+zb7Oxr7O7j7Nuv7Bh6AlJKEnBugnpuiHw6jCvc/5gO7+wcVdJ57oJySkpaUHuv3Brj3Nvc7Gvc7Xvc2K/cGHpaChJJ6G3Z4e3SDjYSPhB/Q+we7+x37KBr7KFv7HUb7Bx6HhImEgxoO+1H4KXb30ncB90bHA/fk+IwViYyJjCuw67CNjI2MmZSOnoSYg5h5kn2CiYqJijtKCJvxi42NGpx8l3x8fH96iYuJmyUeO8yJjImMfJR6hIN+hH6NeJqCjYqNiutmK2aJiomKfIOJeJJ+k36chJqTCI2MjYzbzAh7JYuJiRp6mn+ampqXnI2LjXvxHttKjYqNipmDnZKTmJKYiJ59kwgOX/cRdvdf2PdfdwH3htkD+Hf4FBX7N/c4nAr7OPs4B4cd9zj7OJoK9zj3NweGCg43Hfta94TcAfe+99UV+1FeCvdRVwqI9woB0DwKDqYd9/f5kBV3fX97hh/7nf2bBYqIiYSGGnSceaOfmZebkB73nfmbBYyOjZKQGqJ6nXMeDqGB3/i54AG25vf85gP3zpkd+0gw+yX7avtq5vsl90j3R+f3Jfdq92ov9yX7Rx/9DgT7Ck319z33PMn19wr3Cskh+zz7PU0h+wofDqGL4Pj5dxL3vOYw930T4Ph64BUo+MkGpXWhcR52BoGBiIeDH/scRAV5goN+eBpynXmklZGOjpIe8b0F/I/7CwdzCvfJBhPQlx2hi+D4hPcTNeES+GXjE9D4jOAV+/AGwfcJ9+vs92Ia9w4l3PsUL0F0b1MefIOEf3oadZt6oZOUj4yNHhOwn7jFm88b9wi1VkQf+zf8JEP7ZxpsoXaqHvgWBpcdoYHiNPcM92Df91D3DjbgEvhJ5knmE6z4K/f9FcSgy7jwGvcGNM37LjdIcXJcHn6EhH59GhO0dZx8n5OQjY2QHhOsnrS+mcob9r5hTTpAY/sXH4UGdHh4dHSeeKIfmwYTsvc5w1dBMyl0NEpVmJtjHxNyjYaDjYUbc3t2dniWfpqFH3e80nfkG/cm9wXN9xP3DzG1U5gfDqGbdvdJ3PhSdxL4GOYw92QT8Pi/95UVP/gYBqt0pWgedwZ3eIF9gB/7zvwlBYSChn1+GoIHa6Vyqx73xfscBnKfd6SkoHEd9xzXBxPoXAr8RRb3nvfrBfvrBw6hgeUx9x33eOL3P+AS+HTmE7j35vhOFUFVeHViH6v3aAX3tigK+9UGb3Z4bIcfXvueBYqFioCEGmeodbCblZKQlB6frMCizxvrxlc5+wA+avsKTFWeomAfE3iOhYSNgxtze3d0dpWDlYQfa73Rcegb91Lf7fcU9xY56/srHw6hgeD3ut73HPcMM+MSxuL36+YT3Pfz+FgV+wJNXWFqH+WQrPc690Abwrd+e60fE+yJkJGKkRukm5+gmoKaf5EfoGNVoTgb+3BF+2D7MPsdpvtx94v3Lenw9xL3Iy7n+xwfevwNFfsRX+LsfR+yoL3S9wob77xNMz5PSCwfDqGbdvj84gH4y/kZFalzomse/CycHff/Bvun/LcFh4OJg4MacZ54pZ2clZqTHvew+NkFkZiPmpsaDqGB2/eY3fds2xK65lHFUeb3suZRxVHmE+oA+Lj4ohXZUPP7Q/tDUCM9OcFayXYeE/CAMm1PUiUaMs8h91v3W8/15PFPxDKpHhPxAMmgwbzdGvt+/FwV+xph27jl37jn599eMV5hO/saHxPmAPsj+FYVxrm87Oy5WlBdaU37AfsBacm5Hg6hgeMz9wz3HN73uuASu+b36+ITvPep94oV9wLJubWsHzGGavs6+0AbVF+Ym2kfE3yNho4Kd3Z8lHyXhR92s8F13hv3cNH3YPcw9x1w93H7i/stLSb7Evsj6C/3HB+c+A0V9xG3NCqZH2R2WUT7ChsnWsnj2MfO6h8OiPcK96z3CgHQPAr4IgRHCvsWdvc9dvgi9wqEHRPwNAoT6CId+CIEgQYT8CYKlQYwCg5x2nb4cHcB+HrFPgoO9fdI2fcm2QH3BPgoFfh8BjUd/HwGMgr4fPsmFfx8BjIK+HwGNR0Ocdp2+HB3AenFPh0O+wGH9wv4kOAS9zT3CyXj7OUT2Pd3mR1JVX5oUx9+g3+AeBp1nXmhk5aPj5Eeoa67lrgb8LViRx8p+012+z4adp55pKKgnKEe9xT3T5H3NBr3CDLU+xweg/zlFRPofQr3uDi/9xG7W9D3q9KId/clwBK8v/cM2PiKwRPPgPht+UQV+3v7VftZ+3n7Sfcd+zj3au7XpKfDH5OPkZSVGpmAlX2Hh4qKiB5yTVN2MBv7ViL3Kfck9173Pvc/9173M/c8J/tV+wxeOzdnfaqto4+kjpsfrPdSBYyRi46NGqB7m3d5e355iB6IegUTt4CjcmGmThv7C/sKNPswJ8c/9wLJx6K/th9okqxk0xv3G773FvcJ92H7Q/cg+2KMH+H8FRX7BHhMb0sbTFeu3fXbw9/Br3Vzoh8OXB0B+S/HIQrii+D3ed33beAS7Ob32+JavFrjE/j4jPf/Fb6iurveGvcAPdT7Jh77gFsK/PMHcp93pB73hgYT8vdN09r3CedKv0OiHxP4lvcnFUpoWvsSHvs69233SwbmwGJNH/sg/D0V+0/3efdQBhP09wfJaDxHYlz7HR8O54HiNPce+E73HjTiEsPmE2j4/PcUFYaEioiFHxOYbB0TaGAK+3P3K/sc91vtz6auyR+QHQ73JIvg+KTgmAr4NuUD9+urCvtdWwr88wdkHfikegqGHZgKKh0Oj5t298zg93HgmAoD+Kf4+RUnHfwZWwr8+CUK95/3yAcnHfvI93EGDvcegeH3dd33RPcpM+MSwub4U9sT3PkF+BMV+1kGdHl5dHSdeaIf9zn7SQZyXVB4RRv7QCf3Cvcu90P3COz3K9jHdmjGHxPsiJGSiZMbpZufoJ2AmIKQH7NMQqv7BRv7Vvsu+yP7bftl9yH7Kfdm4teirM0fopaaoqca93cHpnagcB4O9ymbdvfL4PfMd5gK+A/mA/j4TAr7nvwP9552Cvee+A/7niUK+P1aCg771YwKA0cdDvsggeE19wT47XcS967mE7D320wK/EUH+xJOdU9obJSYcB4TcI6FhIyGG3R8d3Z4lYCXhB92sLh+vhvx87z3Ux/4P1oKDsuMCgP5Cc8V+5334vd793qSko6VjJYZo413nnMbfH+Dg4Qf++r78AX30nYK908H9wb3B/eW+90FgJOYhJobpR2jih+Wh5SElB4ObYvm+Ph3mAoD+JfmFfvb+MoGQQr85gdop2+uHvf3BqSgn6RUHR8O9/yMCvji5gP5uPlTFWoGcHN5c4Ef+3f8yvt3+MoFo4FznXAbagZnbm1nH/zpJQr4zAf3e/zPBXKWo3qoG6ijnKSWH/d7+M8F/MwHcnkdpB746QevbqlnHg73WYwK+D/mA/koTAr8sAf8FfjABZ19eJd1G34GZ25tZx/86SUK+LEH+Bf8wwV7l56AoRuXBq+pqK8f+OlaCg6THTUKDsqbdveX4fek4ZgK9/rmA/gGqwr7eFsK/PglCvdqVh33Yvss93c24Pi44J8KE3j5iffxFW4KSAqgn4yOnh/3AfsWBRO4gZOWhZgbo5+fooofloaWhJIeM+z3FMDX9w+O9zAZ+/P7phU2HQ71m3b3qeH3kuGYCvgE5gP5FeEVw333I/sDqB7jqbbV2Br3Bznj+1Ie+31bCvz4JQr3fPdjB/crj/scSR9tB3CdeaekTx37pPfSFftJ95L3RAb3KLdZQTZAXvsEHw6VgZkK9+LlE7j3KfiSTR2dHRN4VgqQm3b4/uAB95jmA/i+qwr8hgZzCmQK9yyB3vkKPB0O428d9wT5NBWeg3qXeRtvenhwhoyEjYYf94v86wVumKB6pxuhBqegnKiYH/eL+OsFjZCMkpAapnqeb3l6f3iDHvt//N4FDvglbx34jPlTFXN2e3WEH/s9/Lr7PPi8BaCFepp1G3F3eHKNH4aMho2EHvdY/O4FbJaifaQbpqOepZMf9zX4kvc1/JIFcZOjeKYbpKKZqpYf91j47gWNkoyQkBqkjXeecRt1enx2hR/7PPy8+z34ugWhhHabcxsOym8d+P3NFft797D3e/exBZCSjpSUGqN3nnN9f4WBhB77Z/ui+2f3oAWWg32SfBtyeHhygI6CkYMf93n7rvt7+7AFhYOIgYEadJ54opqWkpaUHvdn96L3avuhBYCTmIOaG6ecoKOViJSFkh8Osm8d96nmA/fX+AwV+2X3xAWagX6TehtxeHZyjB+BjoKQgx73g/vjBfuTB3J5HaQe95MH94T34wWQk46UlRqkjHigcRt6foN8gR8Oq4vg+KLiAfi64BX8HAb4MfiTBZWWkZuYGqx0qGUe/EacHfgVBvw2/JgFg4GHfn0aa6Vxqx74UQaXHaIK4to892MT4PeWThUv+WXnBhPQn5ubn597m3cf+xMGc3d3cx/9nAdzn3ejHvcTBp+bnJ6ee5t3Hw6mHeP5kBVzenl0ho2EjIgf9539mwV7kJl/nxujnJ2ikImSio4f+535mwWbhn2XdxsOogqn92M82hPgy04Vd3t7eHibep8f9xMGo5+fox/5nAejd59zHvsTfx0T0Of9ZQYOOfhIdvezdwH3hvlSFXF+fHiBHyL7WwWIhYiGhBp4mnqglpSPkpEejY2Pk/cD90j3BftKjYWNiQiEkZSHlhugmpyekoiQiJEfIvdbBZ6BfppxGw7E+yfNAfjWOhX8gQZ5fHx5eZp8nR/4gQadmpqdnXyaeR8O+/ySHfX5ZjkdDmYKnx0TvCYdE3xLChO8QR0OkR3aqh0TfHIK/R0Hcp93pKVPHaUHE7xKHUWBmh0TsPhe9wUVqQofdh0T0GYd+zv3ESn3IoUKHg6RHbuqHRO897aJHYsd0cKnu7kfcQcTfHKfd6WkTx35HXAKcnF3d3Ee+4kHu11Up0UbE7yY/FEVnQqJCg6HCgG85/e7JR0O+3Y4Hfgc9xEHNR37EWsKDqT7hOE19xT3BN739t6GdxK7qh0TrviO+JcVRQpyBxO2t2JUq0Ab+wP7Fzj7RftF9xc49wPWwqu3tB9IB/sAWFQlR1ScoGEeE26NhoWNhBt0enZ3eJOBlYUfcLrhctwb9yrg6fc8H/hTWgpe+/oVZWZdZ0YbLEDE9wwfE7b3DNbE6tC5Z2WwHg6Om3b4Td/3a3cB2qoKA5YK95kHpXafcqgK/R0lCvfAB72zv7nTG9mrXT8f+6YlCvewB/ZK5PsGHg54CvcL9TEKwvcuUx2mCvcM9RJd93Aw5hPocx0T8Fcd+M9bHcL3L1MdT5t2+Jp394Z3AdrmA/iKzRX7SfeE9yT3FQWZmY6XkxqfgaNpf4GFhIMe+4L7cAX4LQdBCv0dJQr3FQfi2vdA+34FgJSZg5kbpp6cppWHlIWTHw776Zt2+Xh3AeLmA/cY+XNaHf0dB3Kfd6SlTx35HVsdDvfNmwr3iub3iuYUHBPc+TmJHfsCWEpldB+/dle+OxssXFZkbx+0BxO8eQr3wAcT3LimtL7XG9elYTcf+6IlCvfAB7imtL7XG9elYTcf+6IlCve0B+Ra8vsKHg6Omwr3puYT2JYKtAcTuKV2n3KoCvxBJQr3wAcT2L2zv7nTG9mrXT8f+6YlCvewB/ZK5PsGHg6gHUQdDoIKqR331uYT7PfpgRVuHUVUb1tdH6UHE9ykd59xcnd3ch79Jwdxn3ekpZ+fpR73kwdbucJv0RsT7H74URWAHWkKDoIKhncSu6odE9z3toEV0cKnu7msHQdxn3elpR2lHvknbwpxd3dyHnEHE+y7XVSnRRuLHR+Y+FEViQqdCh8O+2+UHeOpHRPQ9+CJHYYGRlddW2cftgcTsHkK98QHE9C/rsGvzRuQBqWfnKWkeJ9yHw77EoGrHffJ8jjeEr/i92njE5z3H/gDFX8KE6xdCoIdE2w9Cg77coHb9/7Z73cS9wTmMPeHE/D33NoVaAoT6DUdE/BGCo0dEtaqChO4eB0TeE8KE7hDHQ4/dQoB+F/4lxV5eoB8hR/7LfwY+y34GAWahXqWeRs/CoONhY6EH/dC/DQFd5SgeqQblQakoJyflB/3Qvg0BY6SjZGTGqR3oHIeDvdHdQoB+WD4lxV5eYF6hh/7CfwV+wj4DAWghXeadBt0d3x2hR/7CPwM+wn4FQWchnmVeRtyd3dyhYyGjYUf9yL8NAV0k6J4phumop6jlB/199/1+98Fc5SieKYbpqKeopMf9yL4NAWNkYyQkRqkd59yHg5LdQoB99j3lhX3MvdOBZGTj5WVGqN4nnB9foWAgx77H/tB+yD3QQWVhH6Sextyd3pvgI+CkoIf9y/7Ufsv+0sFhIKIgoEab5x5pZuZk5eUHvca9zz3Ivs+BYCTmISZG6qaoqKTiJeDlB8OQvtqdvmCdwE5Cg4gi+D36OAB+F21FaN4nnMe+5UG96z33AWUlpCYmxqtc6JpHvvDBnMK95EG+7T73wWBgIV9expop3muHvfMBqOenaMfDqMdjvdgPdk9908TyPet+yUVdAp8BhPgUomknB/3cgfHa7BRoB7FoKuwxxr3cgecjaTEHpoGE8h0Cn8GO091KR/7ZwdqiGoyfB4T4HSHgHt3GneWe6KHHhPQ5HyOamoa+2cHKcd12x4O+/X7Q3b6PXcB4dwD9xL5eRV0enl0H/3sB3SceqKinZyiHvnsB6J5nXQeDqMdp/dPPdk992AT4Nb7JRXbx6HtH/dnB6yOrOSaHhPIoo+Wm58an4CbdI8eE+AymoisrBr3ZwftT6E7Hn8GdB2aBhPQxI1yeh/7cgdPq2bFdh5RdmtmTxr7cgd6iXJSHnwGE+B0HQ6r92LgguCKdxIToPiz+AIVf4OEg4cfZ3eLc1gbE0BCSNcgG0ZRRkx9l3+Zl5STlo4fq5SgobMbE6DUzj/1G8i9teKbH6GPfJR+Gw4O++/7QHb44PcLEtL3CyTgE9D3FvfRFXZ/f3qKH3n73gUoB26idKiooaKoHu4HeffeBZyKgJd2G9kEE+CspqarrHCmamtwcGprpnCrHw5UJXb3BeA29w/31uDvdxK35hO8+Df5ABV/gIOAhx9uNgWNe3qNeI4d+wrIOOFkH2oqBYqJiYSHGnyXfpuXlpGXjx6u8gWGoKGIohuFCqkKHhPceWhvfVcbenyMjn0f9wr37LZ3BWUdfJV4lnWTptsYjI6Mj44amoCZeh77sPwBFfbP1PcIkJGLipAe+wf75AVUqG3D0xoOiYHjM/I8drW2YN/3ULj3ifcDM+MS9xHmYuUTRoD4oOgVhoOIiogfEzaAhHd4h3MbEy5AQ1y0PYKDioMboKygvMgam4qaiJoe9zsGmJWUmJiBlX4f+0UGE4WAfL93vb8awavH9xC1rIOArR4ThoCKjpWIkRuknJ6in36YepIfnGJdl1Ib+yQoP/sWUJ1dmV4fKwZ+goF+fpSCmB/3AAYTNkCPeo16eRo5WkJgYh6Cg4aBfhp4nHuflJKOkJIenqevmrcbE0aA4Kle3xuyr5Wcqh+Zk5SYmhqieZx0Hg7J8Xaq3PfM3Kp3Aezc98zcA/LcFZaSj5KTH83MBW+yu3q/G7+7nKeyH81KBYSTkoeWG6GanJ+Wh5OEkh9KzAWns5y7vxq/ertvsx7MzAWSko+TlhqffJx1gISHhIMeSUoFp2RbnFcbV1t6b2QfScwFkoOEj4AbdXx6d4CPg5KEH8xKBW9jeltXGlecW6djHkpKBYSEh4OAGneaeqEe93v4PBXh0UU1NUVFNTVF0eHh0dHhHw6/hfdhQNbm1vfvdxL3sOUTuPcw+UAVm4J/l3UbcXV4b4GOg5CDH/c8+6YFKQZ2e3p2dpp7oR/3ITD7IQZ2e3p2HxN4dpp7oR73ITYGE7hyoHejo6BxHRN44PchB6Id+yHm9yEGoh0pBvc896YFkJOOk5Uap3WecXV/f3uCHvtB+8MFDj4kqx349d8SxN9Z4fdK4Vm9Wd8TqfgQ9zkVv5y6r9X3SvvCee0auK+k2LixhH+rHomQkIqQG6CfnqCef5l8kR+dX1iUVBv7FEpIOlKmZrBwHxO0WHpcaEH7S/fCnikaXmdyPlJdlZ1nHhNyjoWDjoQbdXp5dX6RfZWFH2y8zn3UG/cUzM7cxHCwZaUfT6wVN68snc4awKyktJUe32freUgaVmpyYYEeDvti+NPxAcrxzvED9wb5OSQd92mCv/LITvcq9fcqTsjyvxK+v/cMzvg/vxO3gPgughX3Wvc09zX3WYwf91mK+zT3NftaG/ta+zX7NftZ+1n3Nfs191ofivksFaUK+zz7Hvse+z77PPse9x73PKcdH/dE/CgVjY+MkI8anX2ZeYGAh3mBHhPPgGR1aW9WGzdhztbWtc7fwK1vZKEfE9eAeZWWh5UbnZmZnY+KkImPH8xrUbM8G/sGPDv7D/sP2jv3BtrFs8yrHw77Dfd5w8HM6sHizwHc0/c50wP4DfexFfuvngr3r54d+xv3oBX7AVdiSUjBY8nIsqOjoB+CB3ebe5+fm5ufHvdTB9Bf0SVcY4B+aR5+hoF/fhp6mXydjo+MjI4elKSpkq8bw6hzTh+JByn7KRVYe6GlrrCXxx/PWwZydGd1ZBsOdjod92QWKx0OcPc892tD0xL4OdYTYPha+BMV++1/HffMIQYToHabe6CgnJugHvccB6J4nnQeDvdpgb/y92lQxvcYxfcAvxK+v/cyzvdK1PcavxPfgPgumR37Wvs1+zX7Wvta9zX7Nfda91r3Nfc191r3Wvs19zX7Wh+K/S4V+zz7Hvce9z6nHaUK+z77Hvse+z4f90L4FhXPXL/7Ah77DFsK+9gHeJl9np6amZ4eE7+A9w33AQfVikdpH3kHE9+AeJp8np6amp4epgfaZq5rlh6ymq6qvhr7NEUVLPcY6AbUonFlXmR0VB8O+7r44McB96T5HBX7fgaICvd+BpyYmJycfph6Hw77ePhGv/c+vwG/v/c+vwP3UZkdQE1OP0DJTdbXyMnW107IPx/7cgRcZbG6urGxurqxZVxcZWVcHw6Li9j3ndj3WXcB95zZA/iN2BX8KQaHHfgpBoYK/Cn3nRX3OPsymgr3Mvc3B4YK+zf3MpwK+zL7OAeHHQ77gPhXxveryAH3mMoD9734kpAKQgr7gPhRyfcGx/cAyBL1915NyVrKE+j3ivkiFaeWraXAGlIKE/CICpYGE+RUChPopwr8ApId9x/5ZiEdiftZdvdk31FyHRLfqgoT3PiD+JcVcnZ3ch/7wAdACv0XJQr3Ugd8oat/shvkvbm5tR9iBxO8cXkdpR74QW8KHg73Evtfdvnf2hL34Nr3BNo89zkT8Pkcqwr79Ab7IvsH+wf7Ivsi9wf7B/ciH6/8BAaWHfcE/bcHlh25BxPolwr3dvcKAdD3DgP3G/fsFUcK+7+oHdd3AfdSzgP3SI0KudsFYQZLJSkd+4D4V8b353cS2fcuS8tL9yQT4Peu+JI/HRPQXR0TyH4dL/d5w8HL94bKAdrT92jTA/eVmR37AEVB+wL7AtFA9wD3ANHW9wL3AkXV+wAf+8UEWlKt4+LErLy7xWo0M1FpWx/3M/sKFfvSngr30p4dDnaPHfeuxhUsCvtkFiwKDpUK9y/G9/d3EuD3LkvL+IbLS/cWE30A+dlVChOdAHUdE30A0K8HE5yAeh0TfQD8b/tHKgqm+B0/HRObAGgdDvfiiHajxvePxmzI99l3Etr3LkvL+MnKE+33r/gFPx0T62gdcPwdKgr4196QChPdQgqVCvcpyU3n38f3AMiadxL3GfdeTclayvgmy0v3FhNukPnnVQoTlpB1HRN2kNCvBxOWiHodE3VQ/G/7RyoKiPitFaeWraXAGhOWUFIKE5aQiAqWBhOWMFQKE5ZQpwr7Cvta4PiQ9wsSs+Xe9wsi4xPo9537WhXNwZiuwx+Yk5eWnhqheZ11g4CHh4UedWhbgF4bJmG0zx/t902g9z4aoHidcnR2enUe+xT7T4X7NBr7CORC9xwek/jlFRPwq6amq6xwpmtqcHBqa6ZwrB8OXB33Z3cB97r6Ejkd+An91iEKXB33Z3cB+Cf6EiAK95z91iEKXB33VncB+Hj5lC0d90v9WCEKXB33As9cdtB3EhPs+JT53D0dE/AzHV8d9y/9oCEK5vcr90DM91wOXB26uO24AfeTuO24A/fx+io6CvfS/V8hCosKEviH5hO8SB0TfHwKE7xhHQ7nqB284viB9x404hLD5veqzhPu+DONCqnA6ozOpciuGZAdhoSKiIUfbB0T9mAK+2X3GPsY90l7H1s+KR2r90v3QNChHYYd91h3mAoqHfsq+b0hHav3JvdA0KEKhh288ZgKmvHO8Sod+7X5kCQd+9V+90DUoR371XAd92d3mAoDRx2991MhHfvVTvdA1KEK+9VwHcvxEpLxf+Z/8RPoRx039yYVE/QjHfcri+D3es73e+ASnPdGMOYw94b3n+UT6vfyqwr7XVsK+6JVBxPyeH18eHiZfZ4fE+rB+6IGZB33evcJBhPmnpqZnp58mngfE/L7Cfd7egr3WfdS90DZ91gO92H3kfdA2qEdkx33Tnc1Crr5xyEd92H3X/dA2qEKkx2w0Hagds+Md58KE9cnCvc2+ZFECvdh92T3QNr3XA5gxHb4UHcB7Ph0FXV7eXeBkIGShB/3Mfsx+zH7MQWEhIaBgRp3m3mhlZWQkpIe9zH3Mfcx+zEFhJKVhpUboZudn5WGlYSSH/sx9zH3MfcxBZKSkJWVGp97nXWBgYaEhB77Mfsx+zH3MQWShIGQgRsOpAqed58KE2xRHROcUB0TrEAdDvcs93z3QOChHfcsgd75Cnf3Zzwd+1z3UyEd9yz3RPdA4KEK9yyB3vkKd8vxAefmyPHO8ccrCvvZ9yYkHbL3fvdA5PdWDsyG93014fek4TX3XxLs5vf65hOs+Ab43hX7StIGE5xBCvz9JQoTbPFWHY+B3DrpSHb5B+AS2ub3m+ZX5hM8+DL39BXAnMS08Rr3HPsJxyX7GC08+yMe/FElCvhGB/cL0KjM27xdQEtYXTmCHnWIe313GnWZfKMeE5rt1V09LT93ZW9yjpJ2HxNajYaGjIYbdHt6dXeZf52FH4GosYS3G+rqxvcR9wo0uE2aHw5Y9wyL7KEdZgr3XnefHRO+Jh0TfksKE75BHdv5ICEdWNGL7KEKZgrA0Hagds+Md58dE7nAJh0TecBLChO1wEEd91n46j0dE7LAMx0bE7nAXx0OWNeL7PdcDmYKqrjtuBKx5rm47bil5hO/wCYdE3/ASwoTv8BBHa35MToKDve+geA29wz3CNT3G+ESsOb3mOD3vuUTvvnx96EV9yQx9vspN1BqWGUevG1VrjQbLB2A+w0H+zBBSi0t5VP1z+aa07ofU7bQbOYbYh0TfqAKhIaKiIUeE754ZmV/Txv7CFjI5YEf9+wGp5ugoR/8bScVOkB5TTphsLbExJ7pHvcBBuDUFfOR2rPLG8vaYyORHw5GqB28mh33VM4T7vfTjQqpwNmMvKStoRmBHakKHnYdE/ZmHfss8S33EXsfWz0pHWf3IIvwoR2HCvdedwG85/e7JR2096shHWffi/ChCocKwvEBvOeW8c7xmCUdNvd+JB1QClr3YzkdDlAKvfdjIR14CvdmdzEK9xvcLR0OeArb8RKE8X/mf/ET6C4dN/c2FRP0Ix2Egdv3/dX3i3cBvOP31eMD9/75ERXDrAWTkI+TlBqZgJZ9hYeJiIYeR2JirGSkb5wZj4SEjYMbdHh5c32TfJeFH6V9pHqkekdjGIKGhYOBGn2WgJmRkY6OkB7fvLNpsWOoYBmbbGaXXhv7Kjf7EPsZ+y7tI/cq90fR9xb3LvcwMPcPLt8fSvzLFUE1vfcY9xbhvNXV4lr7FvsYNFlBHw6O6Yv3AvdYDo33KYv3A6EdoB33XndEHbz5HSEdjfCL9wOhCqAdwNB2oHbPjHcSmB0T1zAd9zf450QKjfWL9wP3XA716vHp3OjxAffF8QP3+PdZFSIK96AELx0vCh/3hi5rHY2BdqDe+ADenncSmB0TrGcdNalEv1wfbmIFZQqptgV2sbeAvhv3LvH29zLhbdJWuR+nswWPkY2QkRoTXIAKbmIFE2yfZV+XWRv7OfucFfcY47zYpqiEfaUe+2D7twVxqHq2xhr3OftLFW9vkZpxH/dg97cFpG6dYVEa+xkyWT8eDo/3KIv3CaEdjR33d3cS1qoKE7x4HRN8TwoTvEMd7flwIR2P74v3CaEKjR3b8RLW5o3xzvGM5hO/eB0Tf08KE79DHWj5QyQdQvdEi/cN91YOggr3a3cB2qodA3IK/gIHcZ93pKWfn6Ue95MHSh1C+2p2+YJ32/EB9xbxzvEDOQr73PdkJB370zgd+KEHYx0O+1/7MN74Ssn3gN4B+Dn5cRWVdnCObRtENWH7EnkfdvsrBTQGen19enqYfZ0f2QZa+/IFRIFpelkbhAZ0eXh0dJ15oh+dBtLgtfcSnR+99/UF9xEGnJmYnZt+mnkf+wkGoPcoBdKVrZy9o5qFlxuhnZyim4GZfpEfDosK91h3EviH5hO+SB0TfnwKE75hHdn3rSEd97739ov3hfdWDqQK9053nwoTfFEdE7xQHUAduvnHIR2N92qL9433Vg6WkgqZCvcB9wJTw/cH5RPOgPfSRh37PfjBTR0TroCdHROegFYK+xKSCqsd993eEr/ivvcCU8O/4xPOgPeORh37A/gyFX8KXQoTroCCHROegD0KDo77nXb3g7X4/uAS95fmXLoT6PfJUQouCveI+X0V/IYGcwoT8GQK+3OSCtv3/tnvdxL3A+Yw94f7bvcCU8MT2QD3WFEKE9iALgr3F/cSFRO8AGgKE9oANR0T3ABGCqYKEl33cDDmE9BzHRPgVx34z1sdDvtZpB346C0dDvtrpB35NxWajH2aehuFg4iHhx80QTTVBY+Hg46FG3p9fHyMH4SOhJCGHs9FBYCVloKeG7EGnpaUlpUfz9EFkJCOkpIaDvtx+NTFUfcSEhOA96j5PxVtfWx4ZBtkbJ6pfR8TQJiFgZF/G3h/fXqGjIaNhx9ZosBsyxvLwKq9oh+Nj4yQkBqcf5l4f4GFfoUeDvwO+NPxAcrxA/cG+TkVIgoO++T4u7jtuAG2uO24A/cd+Xc6Cg77k/tfw1P3XxLQ1BOg94H7HxWIiIqKiB+IgYCIfRtnfJ2oHxNgir3NrLqcCD0GVXVWaksaVrhsu7CnlZmgHpKQj5GSGpiClH4eDvtC+NHQWXa9oHbPjHcSE2j4DvkwPR0TUDMdGxOIXx0O+2OSHfcf+WYgCvcuFiAdDigdp5t2+EjaEpv3gjXh90ThNfdOE+j41PiSFfxCBllogH9zH3+Fgn59Gnidep6Rk46Mjh6SoqCNqxsT2KEGh/sXhvsLXfsOCIiEiYOFGnKgeaKfnJiekB6y9x+c9xSP9x0I90T8HQaIHfgdxwcT5JcK2feE3AH40vfVFfxlXgr4ZVcK97H3hNwB+aH31RX9NF4K+TRXCvvz+IZ29553Es3JTfcOE9D3GPhxFTAKE+A4Cg43Cjcd+z34cfcK9yh3Es3JTfcOxslN9w4T5PfN+HEVMAoT2DgK+z8WMAoT6DgKDvtO+IZ29yj3CoQdxoQKE+j3G/l7LQr7OPsWdvco9wqEHcaEChPo9xv3By0KJkN2+JjJ91B3Afd2wAP4Nfh5FTYKU24alvwGBXyMiWShG6GJspqMH5b4BgWogsNsCg5AQnb3UMn3oMn3UHcB933MA/hC9zAVZAaAeYqDHYuU7agaqILtbAo2CiluGm6UKYt8HYxhCouBCoJTinmAGmIHeZJnpaWSr50etAeWip2Cw3sdi3EKDvt596129553AfdR+KIVQVBQQUHGUNXUxsbV1VDGQh8O9/6I9woB0PcO9333Dvd6PAr394odlQYwCvf0FkcK+3k6HQ77eY8d1cYVLAoO/CqIdvmAdwEhcyoKDteB4fct1OnT9xj3ADXhEvcV5hPs+OjtFYWDiImGH4BtaYVeGyk0xulkH/eBBqGamqCfepx3H/uWBomaipubGpuMm42aHvfIBp+bnJ6fe5t3H/uzBuqy4sbtG7ithYCpHxP0iZCTiJEboZ6doZuCmH2SH6BgWpZVG/sz+wgm+x9fH0R/HcIGiXuJfHsae417jXweVAZ3e3qDCtIG+x639wgm9zMbwbyWoLYfmZKUmJsaoXiddR4O9+/35nb318WNdxLE91RMykz3VcLL98DLE7P4qPk2FZqFe5Z6G3oGc3l4dB/7yQd1HfeaB/cD+6EFfJGagZ0bnZqVmpEf9wP3oQX7mgd1HffJB6J5nnMeegZ6e4B8hR/7CPuzBRPT+773yxX7nAZ7fn57e5h+mx8Ty+/7uAZ5mH6dnZmYnR73uPAHE8ebmJibm36Yex8OKB3agdv3ydb3auEBteb4JeMD9/b5hhVTW4J8Yx98hYB9ehp0nXqhkJGMjI4ela6sjq4b9yK++w/7C3KKfIh0H7pdPbc1G/s7+wMg+x8qzPsN90T3dvcF9033lvc5M/cw+0gfS/1AFSFY09bx3Mf3Bd3PX1azHzJ3UvsP+yobDvcHi9L5B3cB+EP5GhWngHijYxtkd3NvgB/7a/ywBYeBh31/GmKsbrQe+EoGtKyotJeHmYeVH/yIaBX3a/iv92v8rwUO9xstdvlr4RKv91814feb4TX3XxPo+SqrCvzbBnN4eHOTCh8T2NX9QAaIHflA95v9QAeIHflA1QcT5KOenjMKDqQk4vkI4gH4tiQVo5+fo6N3nnMf/B0G94/3nQWXmJKcnhqehJx/mB77j/edBfgdBqOfnqOjd59zH/xOBmhvbmh5k3yWfh/3pPu3+6T7twWAfoN8eRpop26uHg7197bcAfjq+AdrHZmgdvkZwAH47KsKJAZyfHl1hB/7TPy8J/evBaGDgZJ5G4WFiYmGHzlqBXyFgoN9GnuYfZuPkY2Mjh7DofcG+8sFdpObe6IbjwagnpmfkR/3V/j3BeQGmpeWmpp/l3wfDvf5wNj3jtgBzNv5NdsD+VX4XRX7AEtBSVkfiAbNWknVIBv7K2H7DDk5tfsM9yv2zdTOvB+OBki9y0L3ABv3K7X3DN3dYfcM+ysfgfvbFS5V3bZsH7eqwdzoG9+yTE1NZEw3H/w/FjdkysnJssrf6MI6X6kfYG1UOS4bDvt/+yfW+azVEoz3YDXhTeBO4Db3XxPI9+T5qxWNgH+MfhsTxDBlU0KHHxPQW/09BViIcoZqgIaMhhsT4HV9enh6l3uciB+JmJmJmhvmsMTTkB8TxLr5PQW+j6SRrJaPipAbE8KenJyenX+ZdY8fDtD3EsyVzLjMlcwB+Of4NRVCHftNBEIdDt2m93s92fcm2T33dxIToO34KBX3kgYv+yYF+zYGXwofE2BgHR73BAZIIQWHhIqFgxoToH2Zf5uVlZCTkB4TYOP3IAX3xQY1HfuTBuf3JgX3NwY1HfsFBszxBY+SjJGTGhOQmX2Xe4GBhoOGHhOgNfscBfvEBjIKDqOL1PiYdwH4lfcFPgqPYxX8OwZ3e3qDCvg7Bp+cm5+fepx3Hw6ji9T4mHcB9wn3BT4dh2MVd3p6d3ece58f+DsGn5ubn597nHcfDp83dvm8dwH30SIVoZ6WnJUf92b37QWQlI6VlxqXiJWGlB77ZvftBZyBeJZ1G4MGdXiAeoEf+2b77QWGgoiBfxp/joGQgh73ZvvtBXqVnoChG4/XFftX99z3V/fc91f73AUO9zxZHffD5hP0+UA0HfvDwgdZCmMKH5dzbZNqGxPsRDxd+xIfUVAHE/QyChPsah33w/wcBzsd9xEHNR37EWsKDq77hNv3RG0K9xb3cDDmE+0A97b5IZUdE/UAYwoeE+sAVR0T9QAyChPygGod95f8qXsKE+0AVx34ywekeZ5yjR77x2sK96mbFRP1AEoKrpttCveX5hPW92T4khXCB2kdE+pjCh4T1lUdE+oyCmod95f8HAdyn3ekpU8d+DwHpHmeco0ev/czFUoKsVkd95bmE+z3tjQdUAcT9DIKE+xqHfcRBzUd+xFrCvdx3Vod/R0Hcp93pKVPHfkdWx0O+EGbbQr3w+b3l+YT2/oe+JIV+8TCBmkdE+tjCh4T2zEd+8PCB2kdE+tjCh4T10Ud95f8HAdyn3ekpU8d+DxbHcL3MxVKCvhEjwr3I92QdxKe91Ew5vfD5veW5hPr+h35c1od/R0Hcp93pKVPHfkdWx37cTmVHRPbYwoeMR37w8IHE+tpHRPXYwoeRR33EQc1HfsRawoO94CBqx333d6Bd/dtzhK/4vcyu5LjqfdTMOYw94cTr4D5ptoVaAoTnyA1HROfgPsF1QbvS+X7CvsJSkEoZ5Vum3QeE6+Aj3NyjnBtHYIdE29APQp/Cn4Kl4SZfpMfa59zq74a1L6zyOKlT1YeE59AN04HE6+AMgoTr0DISx2EkviSkvdJkgb7iZIH95gU+PIVoBMAjAIAAQAFAFcAXQBgAGUAbwB3AJAAlACnANQBBAFEAVIBegF/AYwBkwGZAaABpwGuAdgB6gINAlcCfgKIApICtgL5Av4DDgMUA0kDUANcA2ADgQOIA5UDmQOsA74DxAPJA84D2wPjA/IEHgQpBFMEfASfBKMEygTPBNME1wThBPEE/AUBBSMFNQU9BUMFVwVoBXQFeAWIBZgFnQWiBakFswW+BcQFyQXXBegF8gX8BgAGCAYfBiQGKwY+BkoGXgZwBnsGhgaRBpwGpwauBrMGvAbCBswG1gbmBu0G/AcBBwoHEQcVByIHJQctBzIHPgdKB1UHXwdjB24Hdwd/B4gHkweeB6IHpweqB7QHvgfIB9EH2gfhB+UH6wfwB/QVIB0LFfuT+O4FoIJ4n20bgQZteHd2gqwd/O4FiISJhIUacpx3p56blZ2THsz3MAX36AbM+zAFeZObgZ4bp5yfpJGJkoiSH/xZ914V9xv32fcb+9kFDi8KLx0fCyIdDoEGJgoLB3Kfd6SkoHEdC2xycmwfMh0L+Cr5WBVICvdp9xr3Kvdljx9uCv0NBDYdCwYnHQvgFfv393L30ygK+9P3cff3KAoLFZaWj5WRH/gy+T4FjpGNkZEan3uZeYCAh4GFHvwy/T4FiIWJhYUad5t9nR4L5gP5AEwK/CIH+xEpTikpKcj3ER74IgdBCvwfB/tQ9y039xr3Gvct3/dQHvgfWgoLdJx7oZaWj5KRHvc490kFlZaTm5sam4ObgZYe+zj3SQWShYCPgBt1ent0gY6CkYQf9zT7Pvs0+z4FhYSIgoEaC0kKE9giHfdJih0T5CMKjgZaeHhxfB6ChYaEgRp9ln6akZKOjY0erqCysdMaugeQB6d0onAeC0kdTgoLqqSkqh+RB6pypGweCwHe5gMuHQtfCmAdHwujo3iecx8L9xv3B0kKCwGFHQMnCgtkBoB5i4MdlMOMnZYatAedhK9xcYRneR5iB4CMeZRTfB2LYQqMgQqLggv8BPiGdveed4QdE+B9HRPQIwqHBsKhoKicHpWRkJOWGpt/mXqEhIiJiB5kc2BhOxpWBzIdC/iR+GkVpHegcnd9f3mDHvsx/BD7LvgSBZuEe5d4Gz8KhI2EjYYf91D8Xkr7OwWJhoqFhhpznnejoJiYnZMe96X5JAWNkIyRkRoLFVdhYVdXtWG/v7W1v79htVcf+yMEcHWhpqahoaamoXVwcHV1cB8LnpqFmxugm56eC/cOAzQKlQYwCguOhIaMhRt0e3d3fZJ/lYQfb77FetQb9xTMztwf91j7wUTzGgsVoZ2copuAmnuSH/v89zT3/Pc0BZuSlpqbGqJ5nHWFhoqJhh78I/tHBXWBfXh0GoMHdJl4oYEe+CP7RwWJkJCKkRsLcnd2cgtZY1ddQxs9a7nXH/emTB0LVB0/Ch4LzVS+PVRefXhtHoGFh4KBGnqXgJuQj4yNjx6XoauVtBvEoHBqHzv7cl37BBp3m3eiHvdwkQqhoXqcdR8LPR0TyzMdGxPnXx0OPwofC/sF2waWg5SAg4WFiIge+xz7GQWFhoiFhRqAk4OWHtJLHSQKlQYwCg5TCvtlj/cZ+yr3ahsLFSQKC04dHoUGSR0fhwdOCh6RBk0KHw5yn3ekpKBxHfevB+1M7vsmHgv5UxVFCgunoqKnC2+idKcLcXkdpR74QUwd+8AHC3gK93d3MQoLXBWCBkkdH4YHb6J1px4LxmS6KmFlfnprHn6EhYGCGnuZgJmPkIyNjx6VoKeUsBuvtYBkX1t9Uh+GBgv7avsZ+yr7ZYcfC9Syd2FmY3xXZW2VknQfjIeIjIcbfH1+e3+TgZSGH3uotILAG/aywsQfC/cvFWf3WwaieZ5zHoMGe4CBgIIf+zn7ZAWEgoeCgBp0nniiHvcwRgYLjoSOCnd1eZh6moUfcsXbdO8b9y/w3fcFH/ec/Dz7BPdBGg4GXAoOiFKbPJRfCH6OlX+bG5uVl5iOH5S3m9qIxAininShcBtwdHVvih8LYx07CgtnCh4LBkUKC6KdnKKieZ10Hwt+CpqBnHiRH5piWpVUbR0LBnR6eXR0nHqiHwt1enp1C4iRkoqQG6SbnqCKH4qeg5V+kgiuTUemKRv7W/sr+xz7cwuAG2QGb3GCdXWlgqcfsgaWnQviEp73UTDmC5uAmH+RC/dg/NEGcp93pKSgcR340fdfB5cdh4WJhoUafpWAmpOTjpKQHgtYgdtVdvd+1PcY4QsHVB0LeoCCaxtyY4zGH/fC9wUHC0pVq7ZkH/dmB7aywavMGwtyd3dxC8IGYx0Li3sdinEKC3b4Sdnz9UhiCgv3ZYf7Gvcq+2kbCwekd59yCweld58LlhuyBqellKGhcZRvHwv36YkdRVRvW10f94leHagKC3N5eHNznXmjHwuem5uennubeB8Lm3IdCwdBCvz9JQoLBqP3JIuPjhqffZp2eH1+fIkecvsyBQv78XUKC0EK/EElCgv3JAb3O/b7APsw+zAg+wD7Ox8OB1Vxhmgef4KOghsLcp93pZ2Zl5mUHvH3MgX3yPsaBgtrcHBraqZwq6ympqyrcKZqHw6Kj4+KkBuinJ6gC7O0qdW3sYOBqx4LmIGWfIODiISGHguUwx+WjZODiYAIC6T7anb3deD3/OALd3ebe58fC/cOTckL2r2loa0fgR0LoZybQwoLZ4Hg9yjV9ybYC3p+fnp6mH6cHwvMwWtgsh/7ZgdgZFVrShsL+CqZHVMKC/hGi+BGdvdM3rjg93HgC28d7OYLUBV/gYqIfx8LhYyFG3J7C5Qd2QsV+1IGsMH3R8T3BBoLBn4d+51294OwiwtznnijCxv3afca9yr3ZY8fC/fihvc0+zJ29wzGC/f4iR0yVF1dYR8LoZ2coaF5nXUfDgHs5gvhNfcX+IvfEsXmCwZgHaGcnKEeC5t2+E3fqR0LBqF6nHVfCh4LLEbJ9wr3CtDJ6gsGfH5+fHyYfpofCxKFHQuieJt2C/dXDvuw+xjS+WXTEgv7uvsZdvoudwEL92GB4Dd2+SHgC/c+9x77Hvs8C/vx+4Tb+TZ3C8ZjpmeWHg5qCh4Lg4aKhoIL5vem5gv5ThULAAAA") format("opentype"); font-weight: normal; font-style: normal; }</style>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; font-family: "Varela Round", sans-serif !important; }
    body { font-family: "Varela Round", sans-serif; direction: rtl; padding: 10px 20px; font-size: 13px; color: #1e293b; line-height: 1.5; background: #fff; }
    .hdr { text-align:center; margin-bottom:20px; border-bottom:2px solid #e2e8f0; padding-bottom:15px; }
    .logo { max-height:65px; max-width:180px; object-fit:contain; margin:0 auto 8px; display:block; }
    .company-name { margin:0 0 4px 0; font-size:24px; color:#0f172a; font-weight:800; font-family:"Varela Round",sans-serif; }
    .cd { font-size:13px; color:#64748b; margin-bottom:8px; font-family:"Varela Round",sans-serif; }
    .report-title { margin:8px 0 4px 0; font-size:20px; color:#0f172a; font-weight:700; font-family:"Varela Round",sans-serif; }
    .me { font-size:15px; color:#1e40af; font-weight:700; margin-bottom:4px; }
    .mi { font-size:13px; color:#475569; margin-bottom:3px; font-family:"Varela Round",sans-serif; }
    .mf { font-size:12px; color:#64748b; max-width:400px; line-height:1.3; margin:4px auto 0; }
    table { width:100%; border-collapse:collapse; margin-bottom:20px; font-family:"Varela Round",sans-serif; }
    th { background:#f8fafc; color:#334155; font-weight:700; padding:11px 7px; text-align:right; border-bottom:2px solid #cbd5e1; white-space:nowrap; font-size:13px; font-family:"Varela Round",sans-serif; }
    td { padding:9px 7px; border-bottom:1px solid #f1f5f9; vertical-align:middle; font-size:13px; font-family:"Varela Round",sans-serif; }
    tr:nth-child(even) td { background:#fdfdfd; }
    .c { text-align:center; } .l { text-align:left; }
    .text-muted { color:#94a3b8; }
    .route-cell { max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .profit-cell { color:#16a34a; font-weight:600; }
    tr.total td { background:#f1f5f9; font-weight:700; border-top:2px solid #94a3b8; border-bottom:none; padding:13px 7px; color:#0f172a; font-size:14px; }
    .ftr { margin-top:30px; text-align:center; font-size:12px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:15px; font-family:"Varela Round",sans-serif; }
    .fc { margin-top:5px; color:#64748b; font-family:"Varela Round",sans-serif; }
    @media print { body { padding:0; } }
  </style>
</head>
<body>
  <div class="hdr">
    ${logoHtml}
    ${settings.companyName ? `<div class="company-name">${escapeHtml(settings.companyName)}</div>` : ""}
    ${companyDetailsHtml}
    <div class="report-title">${reportTitle}${entityName ? ` עבור ${entityLabel} ${escapeHtml(entityName)}` : ""}${pdfCustomerName && !entityName ? ` - ${escapeHtml(pdfCustomerName)}` : ""}</div>
    ${dateRangeStr ? `<div class="mi">${dateRangeStr}</div>` : ""}
    <div class="mi">תאריך הפקה: ${genDate} | סה"כ רשומות: ${totalRec}</div>
  </div>
  <table>
    <thead><tr>${theadCells}</tr></thead>
    <tbody>${tableRows}${totalsRow}</tbody>
  </table>
  <div class="ftr">${footerLine2}<div style="font-weight:800;font-size:14px;color:#1e293b;margin-top:6px;font-family:'Varela Round',sans-serif;">הופק באמצעות מערכת לו&quot;ז - ניהול סידור עבודה</div></div>
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
  <style>@font-face { font-family: "Varela Round"; src: url("data:font/otf;base64,T1RUTwAMAIAAAwBAQ0ZGICGfHZYAAFuAAABL7UdQT1PjFKHQAAAocAAALvRHU1VC5oPgsQAAV2QAAAQcT1MvMoYueCcAAAEwAAAAYGNtYXBrh8MZAAAILAAAAmJoZWFk9s7sMgAAAMwAAAA2aGhlYQbpA18AAAEEAAAAJGhtdHgwpzJ5AAAKkAAAA+RrZXJuHeAaMQAADpQAABnabWF4cAD5UAAAAAEoAAAABm5hbWX5kXz+AAABkAAABplwb3N0/7gAMgAADnQAAAAgAAEAAAABAACl7ld2Xw889QADA+gAAAAAyjPUbQAAAADKM9Rt/3T+4gPcA5YAAAADAAIAAAAAAAAAAQAAA5b+4gAABBD/dP9zA9wAAQAAAAAAAAAAAAAAAAAAAPkAAFAAAPkAAAACAkABkAAFAAACvAKKAAAAjAK8AooAAAHdADIA+gAAAgAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAABweXJzAEAAIPsGA5b+4gAAA5YBHgAAAAEAAAAAAf4CugAAACAAAwAAABwBVgABAAAAAAAAAHIAAAABAAAAAAABAAwAcgABAAAAAAACAAcAfgABAAAAAAADABEAhQABAAAAAAAEAAwAcgABAAAAAAAFAA0AlgABAAAAAAAGAAsAowABAAAAAAAHAEMArgABAAAAAAAIAAoA8QABAAAAAAAJAAoA8QABAAAAAAAKAHIAAAABAAAAAAAMABwA+wABAAAAAAANAJABFwABAAAAAAAOABoBpwADAAEECQAAAOQBwQADAAEECQABABgCpQADAAEECQACAA4CvQADAAEECQADACICywADAAEECQAEABYC7QADAAEECQAFABoDAwADAAEECQAGABYC7QADAAEECQAHAIYDHQADAAEECQAIABQDowADAAEECQAJABQDowADAAEECQAKAOQBwQADAAEECQAMADgDtwADAAEECQANASAD7wADAAEECQAOADQFD0NvcHlyaWdodCAoYykgMjAxMSwgSm9lIFByaW5jZSwgQWRtaXggRGVzaWducyAoaHR0cDovL3d3dy5hZG1peGRlc2lnbnMuY29tLykgd2l0aCBSZXNlcnZlZCBGb250IE5hbWUgVmFyZWxhIFJvdW5kLlZhcmVsYSBSb3VuZFJlZ3VsYXIxLjAwMDtWYXJlbGFSb3VuZFZlcnNpb24gMS4wMDBWYXJlbGFSb3VuZFZhcmVsYSBSb3VuZCBpcyBhIHRyYWRlbWFyayBvZiBBZG1peCBEZXNpZ25zICh3d3cuYWRtaXhkZXNpZ25zLmNvbSlKb2UgUHJpbmNlaHR0cDovL3d3dy5hZG1peGRlc2lnbnMuY29tL1RoaXMgRm9udCBTb2Z0d2FyZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgU0lMIE9wZW4gRm9udCBMaWNlbnNlLCBWZXJzaW9uIDEuMS4gVGhpcyBsaWNlbnNlIGlzIGF2YWlsYWJsZSB3aXRoIGEgRkFRIGF0OiBodHRwOi8vc2NyaXB0cy5zaWwub3JnL09GTGh0dHA6Ly9zY3JpcHRzLnNpbC5vcmcvT0ZMAEMAbwBwAHkAcgBpAGcAaAB0ACAAKABjACkAIAAyADAAMQAxACwAIABKAG8AZQAgAFAAcgBpAG4AYwBlACwAIABBAGQAbQBpAHgAIABEAGUAcwBpAGcAbgBzACAAKABoAHQAdABwADoALwAvAHcAdwB3AC4AYQBkAG0AaQB4AGQAZQBzAGkAZwBuAHMALgBjAG8AbQAvACkAIAB3AGkAdABoACAAUgBlAHMAZQByAHYAZQBkACAARgBvAG4AdAAgAE4AYQBtAGUAIABWAGEAcgBlAGwAYQAgAFIAbwB1AG4AZAAuAFYAYQByAGUAbABhACAAUgBvAHUAbgBkAFIAZQBnAHUAbABhAHIAMQAuADAAMAAwADsAVgBhAHIAZQBsAGEAUgBvAHUAbgBkAFYAYQByAGUAbABhAFIAbwB1AG4AZABWAGUAcgBzAGkAbwBuACAAMQAuADAAMAAwAFYAYQByAGUAbABhACAAUgBvAHUAbgBkACAAaQBzACAAYQAgAHQAcgBhAGQAZQBtAGEAcgBrACAAbwBmACAAQQBkAG0AaQB4ACAARABlAHMAaQBnAG4AcwAgACgAdwB3AHcALgBhAGQAbQBpAHgAZABlAHMAaQBnAG4AcwAuAGMAbwBtACkASgBvAGUAIABQAHIAaQBuAGMAZQBoAHQAdABwADoALwAvAHcAdwB3AC4AYQBkAG0AaQB4AGQAZQBzAGkAZwBuAHMALgBjAG8AbQAvAFQAaABpAHMAIABGAG8AbgB0ACAAUwBvAGYAdAB3AGEAcgBlACAAaQBzACAAbABpAGMAZQBuAHMAZQBkACAAdQBuAGQAZQByACAAdABoAGUAIABTAEkATAAgAE8AcABlAG4AIABGAG8AbgB0ACAATABpAGMAZQBuAHMAZQAsACAAVgBlAHIAcwBpAG8AbgAgADEALgAxAC4AIABUAGgAaQBzACAAbABpAGMAZQBuAHMAZQAgAGkAcwAgAGEAdgBhAGkAbABhAGIAbABlACAAdwBpAHQAaAAgAGEAIABGAEEAUQAgAGEAdAA6ACAAaAB0AHQAcAA6AC8ALwBzAGMAcgBpAHAAdABzAC4AcwBpAGwALgBvAHIAZwAvAE8ARgBMAGgAdAB0AHAAOgAvAC8AcwBjAHIAaQBwAHQAcwAuAHMAaQBsAC4AbwByAGcALwBPAEYATAAAAAAAAAMAAAADAAABIgABAAAAAAAcAAMAAQAAASIAAAEGAAAAAAAAAAAAAAABAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fAIKDhYePlJqfnqCioaOlp6aoqauqrK2vsbCytLO4t7m6225iY2bddJ1saONyZ+6Elutv7/Blc+Xo59LsaXjRpLZ9YWvqv+3manneYH6BkwAA09TY2dXWtfG9AOHi3+D09dx119oAgIh/iYaLjI2KkZIAkJiZlwDJz23LzM120M7KAAQBQAAAAEwAQAAFAAwAfgClAKwA/wF/AZIB/wIbAjcCxwLdA6kDwCAUIBogHiAiICYgOiBEIKwhIiEmIgIiBiIPIhIiGiIeIisiSCJgImUlyvsA+wT7Bv//AAAAIACgAKcArgF/AZIB/AIYAjcCxgLYA6kDwCATIBggHCAgICYgOSBEIKwhIiEmIgIiBiIPIhEiGiIeIisiSCJgImQlyvsA+wH7Bv///+H/wP+//77/P/8t/sT+rP6R/gP98/0o/RLgwOC94Lzgu+C44KbgneA238Hfvt7j3uDe2N7X3tDezd7B3qXejt6L2ycF8gXzBfIAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAICABQBBAAAARkAUgGbADsCZAAkAmQALwMuACsC3ABHAO4APwE4ADMBOAAwAaEAQgIyACgBBAA/AZgARQEEAEUBuwAwAnQAKwJ0AIACdABBAnQAOwJ0ABkCdABAAnQAOwJ0ADwCdAAvAnQAMAEEAEUBBAA/AkQAIwLIAEkCRAA2AfEAGgOCADECuQAaArUAYQK6ADgC7gBhAn4AYQJiAGEC6AA3AvMAYQEdAGEB0gAMAp4AYQJAAGEDxgBhAyMAYQMrADcCnQBhAywANwLIAGECaAAzAmMADgL2AFwCtgAYA+8AGgKdACsChQAeAn4ALwFCAFcBuwAvAUIAHAIMAFIClwA0APYARQIrACYCdwBPAhgALgJ3ADACOgAxAXwAEwJ3ADACYQBPAQEASwEB/9ICIgBPAQkAVwOXAE8CYQBPAmAAMAJ3AE8CdwAwAYMATwHgADABgAAWAmIASwISABoDEQAZAh4AMwIVABgB8wAnAVgAAwD9AFYBWAAcAn4ASgEEAAABAwBHAicALAJcACcCnABCApIAQQIRAC8BkAA/AzMAMwHlAEICSQA2AkMASQMzADMBOAAIAXoANAJeAD4BcgAmAXIAJADwADACXABUAtwAJwEEAEUBMwAtAXIATgICAEYCSQBKA6wAVQOsAE8DrAA/AegAKAK5ABoCuQAaArkAGgK5ABoCuQAaArkAGgQQAAICugA4An4AYQJ+AGECfgBhAn4AYQEdADgBHQBhAR0ABwEdAAcC9QARAyMAYQMrADcDKwA3AysANwMrADcDKwA3AjMAOwMrADcC9gBcAvYAXAL2AFwC9gBcAoUAHgKfAGECYgBPAisAJgIrACYCKwAmAisAJgIrACYCKwAmA4gAJQIZAC4COgAxAjoAMQI6ADECOgAxAQEAKgEBAFMBAf/5AQH/+QJXADECYQBPAmAAMAJgADACYAAwAmAAMAJgADACyABJAmAAMAJiAEsCYgBLAmIASwJiAEsCFQAYAncATwIVABgBHwATAZP/ywQQAAIDiAAlAysANwJgADACaQAzAeAAMAJhAA0BfwAVAQH/0gGZAEQBhwBEAYEAMQDkAD8BDgArAV8ARQGwADcBjwAwAxYANgJ6ABACrABFA3sARQD/AEIA7gA/AQQAPwG1AEIBpAA/AboAPwH5ACMCEwAwAXkAOAPIAEUBeQA2AXkASgDI/3QCqgAqA7kAOQMWADYCrQAqAtEARALlACQCdwApAsgASQJsAAcDwwBBAXMAAQKjAFMCsAA7AnYAOgJ2AEwCcgAoAwYAEwKBABMCgQATAoQAEwQLABMEDgATA0oAMAADAAAAAAAA/7UAMgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAGdYAAQRMGAAACgHIAAMAD/9+AAMA2v93AAcACP/SAAcANf/QAAcANv/7AAcAN//SAAcAOP/lAAcAOv/IAAcAR//zAAcAVf/xAAcAV//oAAcAWP/xAAcAWv/rAAcAhAATAAgAD/+JAAgAEP/VAAgAIf/sAAgAIv/NAAgAK/++AAgAQv/yAAgAUP/kAAgAVP/wAAgAhP/AAAgA3//eAAkAMP/rAAkANv/0AAkAQv/tAAkAR//zAAkAT//uAAkAUP/lAAkAVP/tAAkAVf/qAAkAVv/pAAkAV//rAAkAWP/uAAkAWv/xAAkAW//2AAkAjAARAAsAIv/XAAsAK/+/AAsAQv/2AAsAUP/yAAsAhP/NAAsArAAUAAsArQALAA4AIv/yAA4AK//LAA4ANP/tAA4ANf/AAA4AN//fAA4AOP/uAA4AOf/hAA4AOv++AA4AO//hAA4AR//zAA4AVf/0AA4AV//4AA4AWf/qAA4AW//qAA8AA/+DAA8ACP+JAA8AMP/tAA8ANf/AAA8ANv/uAA8AN//AAA8AOP/WAA8AOv+1AA8AR//2AA8AVf/0AA8AV//hAA8AWP/rAA8AWv/kAA8A1f+EAA8A2f+DABAAEP9sABAAIv/gABAAK//gABAAQv/sABAAT//xABAAUP/qABAAVP/vABAAVv/yABAAhP/vABsANf/WABsAN//3ABsAOv/mACEANf/uACEAOv/oACIACP/TACIAC//XACIADv/yACIAIP/uACIAIgAqACIAKwAeACIAMP/yACIANf/CACIANv/tACIAN//UACIAOP/hACIAOQAYACIAOv/AACIAPf/gACIAPv/xACIAR//rACIASf/6ACIASv/5ACIATf/4ACIAT//6ACIAUP/0ACIAVf/pACIAVv/yACIAV//cACIAWP/jACIAWv/fACIAXv/0ACIAbP/2ACIA1f/TACIA4//UACMACv/wACMANf/WACMAN//0ACMAOP/7ACMAOf/vACMAOv/jACMAPv/yACMAR//1ACMASf/5ACMASv/4ACMATf/3ACMAT//5ACMAUP/7ACMAVP/3ACMAVf/yACMAVv/5ACMAV//zACMAWP/4ACMAWf/uACMAWv/2ACMAW//1ACMAXv/yACMAhP/4ACQAB//5ACQADv/qACQAMP/3ACQAR//5ACQAT//5ACQAUP/wACQAVP/2ACQAVf/sACQAVv/1ACQAV//OACQAWP/bACQAWv/SACUACv/rACUAD//tACUAEP/2ACUAIv/xACUAK//wACUANf/kACUAN//yACUAOP/6ACUAOf/kACUAOv/fACUAO//xACUAPv/uACUAQv/2ACUASf/3ACUASv/2ACUATf/1ACUAT//3ACUAUP/6ACUAVP/6ACUAVv/4ACUAWf/zACUAW//2ACUAXv/uACUAhP/RACUA4//4ACYAB//5ACYAMP/5ACYAQv/5ACYAR//1ACYAT//5ACYAUP/yACYAVP/6ACYAVf/vACYAVv/zACYAV//wACYAWP/0ACYAWv/yACcAB//pACcAD/+5ACcAEP/nACcAIv/MACcAK/+ZACcAQv+0ACcAR//uACcASf/5ACcASv/1ACcATf/2ACcAT//lACcAUP/sACcAVP/sACcAVf/lACcAVv/oACcAV//xACcAWP/0ACcAWf/VACcAWv/zACcAW/+1ACcAhP+xACcA4P/zACgAN//7ACgAOv/4ACgAQv/6ACgAR//3ACgASf/3ACgASv/2ACgATf/0ACgAT//3ACgAUP/5ACgAVP/6ACgAVf/zACgAVv/3ACgAV//3ACgAWP/6ACgAWf/2ACgAWv/5ACgAW//4ACoAOv/7ACoAQv/1ACoAR//4ACoASf/2ACoASv/2ACoATf/2ACoAT//2ACoAUP/yACoAVP/1ACoAVf/1ACoAVv/zACoAV//3ACoAWP/5ACoAWv/5ACoAW//2ACsACv/1ACsAD//0ACsAIv/zACsAK//5ACsAQv/yACsAR//4ACsASf/yACsASv/yACsATf/xACsAT//zACsAUP/yACsAVP/yACsAVf/1ACsAVv/vACsAV//4ACsAWP/6ACsAWf/4ACsAWv/6ACsAW//zACwAB//sACwADv/nACwAIgAiACwAKwAXACwAMP/kACwANP/3ACwANQAKACwANwAZACwAOAATACwAOQAYACwAOgAdACwAR//tACwAUP/gACwAVf/YACwAVv/qACwAV//aACwAWP/kACwAWv/eAC0AB//5AC0ACP+hAC0AC/+gAC0ADv+8AC0AIP/vAC0AMP/nAC0ANf+aAC0ANv/nAC0AN/+qAC0AOP+3AC0AOQAXAC0AOv+cAC0APf/aAC0APv/2AC0AR//JAC0ATf/7AC0AUP/1AC0AVf/HAC0AVv/1AC0AV/+pAC0AWP+2AC0AWv+tAC0AbP/vAC0Adf++AC0AhAAYAC0A1f+hAC0A3//zAC0A4/+fADAACv/rADAAD//tADAAIv/yADAAK//yADAANf/oADAAN//zADAAOP/7ADAAOf/mADAAOv/hADAAO//zADAAPv/uADAAQv/2ADAASf/3ADAASv/2ADAATf/0ADAAT//3ADAAUP/6ADAAVP/6ADAAVv/4ADAAWf/zADAAW//2ADAAXv/vADAAhP/UADAA4//4ADEAB//5ADEACv/zADEAD/+yADEAEP/pADEAIv/UADEAK/+0ADEAOf/sADEAOv/7ADEAO//5ADEAQv/mADEASf/6ADEASv/4ADEATf/4ADEAT//4ADEAUP/yADEAVP/5ADEAVv/5ADEAXv/2ADEAhP+xADEArP/+ADMANf/yADMAN//5ADMAOv/wADMAQv/5ADMAR//7ADMASf/5ADMASv/3ADMATf/3ADMAT//4ADMAUP/0ADMAVP/3ADMAVf/3ADMAVv/2ADMAV//6ADMAWf/4ADMAW//5ADQAC//0ADQANf/bADQAN//6ADQAOf/5ADQAOv/4ADQAR//mADQASf/4ADQASv/3ADQATf/1ADQAT//4ADQAVP/5ADQAVf/qADQAVv/3ADQAV//gADQAWP/qADQAWf/rADQAWv/jADQAW//0ADQA4//4ADUAB//XADUADv/AADUAD//AADUAEP/cADUAG//WADUAIf/iADUAIv/CADUAK/+3ADUAMP/oADUANwAlADUAOAAmADUAOQAjADUAOgArADUAQv+xADUAR//iADUASf/6ADUASv/2ADUATf/3ADUAT/+9ADUAUP+rADUAVP+0ADUAVf/BADUAVv++ADUAV/+5ADUAWP+/ADUAWf+8ADUAWv+7ADUAW/+yADUAbP/wADUAhP/LADUArAABADUArQAPADUA3//FADUA4P/NADYACv/1ADYAD//uADYAEP/yADYAIv/sADYAK//xADYAQv/vADYAR//4ADYASf/zADYASv/xADYATf/uADYAT//uADYAUP/xADYAVP/wADYAVf/2ADYAVv/uADYAV//4ADYAWP/7ADYAWf/2ADYAWv/6ADYAW//wADYAhP/2ADcAB//yADcADv/fADcAD//AADcAEP/dADcAG//3ADcAIf/vADcAIv/UADcAK//BADcAMP/zADcANP/7ADcANQAfADcANwAjADcAOAAkADcAOQAhADcAOgAwADcAQv/KADcAR//1ADcASf/4ADcASv/3ADcATf/1ADcAT//UADcAUP/LADcAVP/OADcAVf/oADcAVv/XADcAV//0ADcAWP/1ADcAWf/xADcAWv/2ADcAW//kADcAbP/2ADcAhP/QADcAqgADADcArAABADcArQASADcA3//hADcA4P/0ADcA4wAIADgAB//6ADgADv/uADgAD//WADgAEP/pADgAIv/hADgAK//WADgAMP/7ADgANQAhADgANwAjADgAOAAdADgAOQAcADgAOgAmADgAQv/YADgAR//6ADgASv/7ADgATf/5ADgAT//hADgAUP/XADgAVP/fADgAVf/yADgAVv/kADgAV//7ADgAWf/5ADgAW//uADgAhP/qADgArAADADgArQAOADgA3//vADkAB//vADkADv/hADkAIgAgADkAKwAaADkAMP/mADkANP/6ADkANQAgADkANwAgADkAOAAjADkAOQAcADkAOgAlADkAQv/2ADkAR//xADkAT//4ADkAUP/YADkAVP/3ADkAVf/UADkAVv/hADkAV//aADkAWP/dADkAWv/cADkA3//xADoAB//mADoADv++ADoAD/+1ADoAEP/UADoAG//mADoAIf/dADoAIv/AADoAKv/7ADoAK/+1ADoAMP/iADoANP/3ADoANQAqADoANwAtADoAOAAuADoAOQAtADoAOgAyADoAPgAKADoAQv+vADoAR//oADoASf/4ADoASv/3ADoATf/1ADoAT/+6ADoAUP+pADoAVP+rADoAVf/JADoAVv+8ADoAV//dADoAWP/aADoAWf/VADoAWv/eADoAW//JADoAXgAMADoAbP/pADoAhP+4ADoAqgAOADoArQAXADoA3//FADoA4P/gADoA4wAaADsAB//7ADsADv/UADsAMP/yADsAQv/3ADsAR//uADsASf/5ADsASv/3ADsATf/3ADsAT//wADsAUP/iADsAVP/0ADsAVf/hADsAVv/mADsAV//jADsAWP/mADsAWv/lADsAW//6ADsA3//rADwAIv/vADwAK//yADwAMP/vADwAOgAKADwAQv/sADwAT//sADwAUP/nADwAVP/sADwAVf/sADwAVv/pADwAV//rADwAWP/uADwAWf/1ADwAWv/xADwAW//vAD0ACP/YAD0AMP/2AD0ANf/cAD0ANv/yAD0AN//dAD0AOP/pAD0AOv/UAD0AVf/2AD0AV//tAD0AWP/zAD0AWv/zAD0AhAAIAEIAB//6AEIACP/yAEIACv/sAEIAC//yAEIAIP/tAEIAIv/7AEIAKv/yAEIAMP/2AEIANP/0AEIANf+lAEIANv/qAEIAN//LAEIAOP/dAEIAOf/6AEIAOv+qAEIAO//xAEIAPf/pAEIAPv/pAEIAR//6AEIAVf/7AEIAVv/8AEIAV//2AEIAWP/7AEIAWv/5AEIAXv/sAEIA1f/zAEIA4//nAEQAB//vAEQACv/2AEQADv/0AEQAMP/1AEQANP/1AEQANf+gAEQANv/3AEQAN//hAEQAOP/vAEQAOv+6AEQAPv/0AEQAUP/8AEQA4//0AEUAB//5AEUAIv/6AEUAKv/2AEUAMP/3AEUANP/5AEUANf/6AEUANv/zAEUAN//4AEUAOv/4AEUAO//1AEYAB//6AEYACP/0AEYACv/rAEYAC//1AEYAIP/vAEYAIv/7AEYAKv/1AEYAK//6AEYAMP/7AEYANP/1AEYANf+vAEYANv/zAEYAN//KAEYAOP/YAEYAOf/wAEYAOv+tAEYAO//wAEYAPf/tAEYAPv/rAEYAV//7AEYAWf/6AEYAXv/tAEYA1f/1AEYA4//rAEcAB//tAEcADv/hAEcAD//jAEcAEP/vAEcAIv/TAEcAK//TAEcANwAHAEcAOgATAEcAQv/wAEcAUP/3AEcAVQAVAEcAVwAgAEcAWAAjAEcAWQAPAEcAWgAgAEcA3//xAEoAB//4AEoAIv/5AEoAKv/2AEoAK//7AEoAMP/2AEoANP/3AEoANf/2AEoANv/xAEoAN//3AEoAOP/7AEoAOv/4AEoAO//zAEwAB//nAEwADv/nAEwAIP/2AEwAMP/oAEwANP/4AEwANf+8AEwANv/zAEwAN//WAEwAOP/qAEwAOv/GAEwAQv/7AEwAUP/rAEwAVP/8AEwAVf/4AEwAVwAGAEwAWAAIAEwAWQANAEwAWgAPAEwA3//2AEwA4//wAE0AB//3AE0AIv/4AE0AKv/2AE0AK//7AE0AMP/1AE0ANP/3AE0ANf/3AE0ANv/uAE0AN//1AE0AOP/5AE0AOv/1AE0AO//yAE0Adf/EAE8AB//6AE8ACP/yAE8ACv/sAE8AC//zAE8AIP/uAE8AIv/7AE8AKv/yAE8AMP/2AE8ANP/1AE8ANf+mAE8ANv/rAE8AN//MAE8AOP/eAE8AOf/6AE8AOv+vAE8AO//xAE8APf/qAE8APv/pAE8AR//7AE8AVf/8AE8AV//3AE8AWP/7AE8AWv/6AE8AXv/sAE8A1f/1AE8A4//oAFAACP/wAFAACv/lAFAAC//yAFAAIP/sAFAAIv/0AFAAKv/yAFAAK//5AFAAMP/6AFAANP/yAFAANf+qAFAANv/xAFAAN//LAFAAOP/WAFAAOf/XAFAAOv+pAFAAO//lAFAAPf/qAFAAPv/nAFAAR//7AFAAVf/8AFAAV//5AFAAWf/xAFAAWv/7AFAAW//6AFAAXv/pAFAA1f/xAFAA4//pAFMAB//gAFMACv/tAFMADv/NAFMAD//LAFMAEP/pAFMAIv/NAFMAKv/2AFMAK/+2AFMANf/AAFMANv/4AFMAN//2AFMAOf/aAFMAOv/hAFMAO/+5AFMAPv/rAFMAQv/hAFMARwARAFMAUP/wAFMAVQAOAFMAVwAXAFMAWAAVAFMAWQAOAFMAWgAcAFMAXv/wAFMA3//qAFQACv/tAFQAIP/vAFQAKv/1AFQAMP/3AFQANP/6AFQANf+yAFQANv/wAFQAN//LAFQAOP/eAFQAOf/0AFQAOv+wAFQAO//3AFQAPf/vAFQAPv/sAFQAVf/8AFQAV//8AFQAXv/vAFQA4//qAFUAB//1AFUANf+3AFUANv/5AFUAN//uAFUAOP/4AFUAOv/TAFUAPv/1AFUAVQAHAFUAVwARAFUAWAAOAFUAWgAPAFUA4//4AFYAB//5AFYACv/uAFYAIv/6AFYAKv/2AFYAMP/3AFYANP/4AFYANf+9AFYANv/uAFYAN//UAFYAOP/hAFYAOf/4AFYAOv+6AFYAO//wAFYAPf/xAFYAPv/sAFYAXv/uAFYA4//uAFcAB//yAFcACv/sAFcADv/4AFcAD//hAFcAEP/tAFcAIv/cAFcAKv/3AFcAK//RAFcANf/PAFcANv/4AFcAN//0AFcAOP/7AFcAOf/aAFcAOv/dAFcAO//RAFcAPv/rAFcAQv/6AFcARwAcAFcAUP/5AFcAVQAVAFcAVwAUAFcAWAAVAFcAWQASAFcAWgAbAFcAXv/vAFgAB//2AFgACv/uAFgAD//rAFgAEP/zAFgAIv/jAFgAKv/5AFgAK//TAFgANf/NAFgANv/7AFgAN//1AFgAOf/dAFgAOv/aAFgAO//WAFgAPv/uAFgARwAhAFgAVQAQAFgAVwAVAFgAWAAVAFgAWQAOAFgAWgAXAFgAXv/xAFkAB//tAFkADv/pAFkAKv/7AFkAMP/zAFkANf+8AFkANv/2AFkAN//xAFkAOP/6AFkAOv/VAFkAPv/1AFkARwAVAFkAUP/xAFkAVwAQAFkAWAARAFkAWQAOAFkAWgAPAFkA3//zAFkA4//4AFoAB//0AFoACv/vAFoAD//kAFoAEP/xAFoAIv/eAFoAKv/5AFoAK//TAFoANf/QAFoANv/6AFoAN//2AFoAOf/cAFoAOv/fAFoAO//TAFoAPv/uAFoAQv/8AFoAUP/7AFoAVQAWAFoAVwAfAFoAWAAhAFoAWQAcAFoAWgAdAFoAXv/zAFsAB//zAFsACv/1AFsADv/uAFsAKv/2AFsAMP/3AFsANf+yAFsANv/xAFsAN//lAFsAOP/wAFsAOv/JAFsAO//4AFsAPv/vAFsAUP/7AFsAXv/zAFsA4//xAFwAIv/zAFwAK//2AFwAMP/vAFwAOgAMAFwAQv/vAFwAT//uAFwAUP/qAFwAVP/uAFwAVf/vAFwAVv/sAFwAV//vAFwAWP/xAFwAWv/1AFwAW//zAFwAjAAMAGEANf/QAGEAN//wAGEAOv/gAGwAIv/1AGwAK//2AGwANf/vAGwAN//2AGwAOv/nAHUATf/EAH0AIv/xAH0AKv/wAH0AK//qAH0AMP/qAH0ANP/wAH0ANf+7AH0ANv/nAH0AN//ZAH0AOP/kAH0AOv/JAH0AO//sAH0AQv/rAH0AR//vAH0ASf/uAH0ASv/uAH0ASwASAH0ATf/tAH0AT//uAH0AUP/nAH0AVP/tAH0AVf/sAH0AVv/pAH0AV//rAH0AWP/u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/+0A4//rAAUAB//tABD/7wA3AAcAVwAgAFkADwAIAAf/+QAK/+4AN//UADn/+AA9//EAPv/sAF7/7gDj/+4ACwAH//oACv/sAAv/8wAg/+4AN//MADn/+gA9/+oAPv/pAFf/9wBe/+wA4//oAAIAB//4ADf/9wACAAf/+AA3//cAAwAH//cAN//1AHX/xAALAAf/+gAK/+wAC//zACD/7gA3/8wAOf/6AD3/6gA+/+kAV//3AF7/7ADj/+gACwAH//oACv/sAAv/8wAg/+4AN//MADn/+gA9/+oAPv/pAFf/9wBe/+wA4//oAAsACv/lAAv/8gAg/+wAN//LADn/1wA9/+oAPv/nAFf/+QBZ//EAXv/pAOP/6QALAAr/5QAL//IAIP/sADf/ywA5/9cAPf/qAD7/5wBX//kAWf/xAF7/6QDj/+kACAAH//kACv/uADf/1AA5//gAPf/xAD7/7ABe/+4A4//uAAEAPv/rAAkACv/tACD/7wA3/8sAOf/0AD3/7wA+/+wAV//8AF7/7wDj/+oABQAH//UAN//uAD7/9QBXABEA4//4AAgAB//5AAr/7gA3/9QAOf/4AD3/8QA+/+wAXv/uAOP/7gAJAAf/8gAK/+wAEP/tADf/9AA5/9oAPv/rAFcAFABZABIAXv/vAAYAB//tADf/8QA+//UAVwAQAFkADgDj//gACQAH//QACv/vABD/8QA3//YAOf/cAD7/7gBXAB8AWQAcAF7/8wACAFf/7wCMAAwAAQA3//AAAQA3//QAAQA3//YAAwA3/+EAOf/xAFn/8wAEADf/2QBLABIAV//rAFn/9QAKAAv/1wAg/+4AN//UADkAGAA9/+AAPv/xAFf/3ABe//QAbP/2AOP/1AAKAAv/1wAg/+4AN//UADkAGAA9/+AAPv/xAFf/3ABe//QAbP/2AOP/1AAKAAv/1wAg/+4AN//UADkAGAA9/+AAPv/xAFf/3ABe//QAbP/2AOP/1AAKAAv/1wAg/+4AN//UADkAGAA9/+AAPv/xAFf/3ABe//QAbP/2AOP/1AAKAAv/1wAg/+4AN//UADkAGAA9/+AAPv/xAFf/3ABe//QAbP/2AOP/1AAKAAv/1wAg/+4AN//UADkAGAA9/+AAPv/xAFf/3ABe//QAbP/2AOP/1AACAAf/+QBX//AAAgAH//kAV//OAAIAB//5AFf/8AACAAf/+QBX//AAAgAH//kAV//wAAIAB//5AFf/8AABAFf/9wABAFf/9wADAAoAEQBX//cAXgALAAEAV//3AAgACv/rABD/9gA3//IAOf/kAD7/7gBZ//MAXv/uAOP/+AABAFf/9wAHAAr/6wA3//MAOf/mAD7/7gBZ//MAXv/vAOP/+AAHAAr/6wA3//MAOf/mAD7/7gBZ//MAXv/vAOP/+AAHAAr/6wA3//MAOf/mAD7/7gBZ//MAXv/vAOP/+AAHAAr/6wA3//MAOf/mAD7/7gBZ//MAXv/vAOP/+AAHAAr/6wA3//MAOf/mAD7/7gBZ//MAXv/vAOP/+AAHAAr/6wA3//MAOf/mAD7/7gBZ//MAXv/vAOP/+AAEAAr/9QAQ//IAV//4AFn/9gAEAAr/9QAQ//IAV//4AFn/9gAEAAr/9QAQ//IAV//4AFn/9gAEAAr/9QAQ//IAV//4AFn/9gANAAf/5gAQ/9QAIf/dADcALQA5AC0APgAKAFf/3QBZ/9UAXgAMAGz/6QCqAA4ArQAXAOMAGgAHAAr/7AAQ//YAN//1ADn/1AA+/+8AWf/2AF7/8QAGAAr/7wA+//MAV//6AFn/+gBe//MA4//3AAsAB//6AAr/7AAL//IAIP/tADf/ywA5//oAPf/pAD7/6QBX//YAXv/sAOP/5wALAAf/+gAK/+wAC//yACD/7QA3/8sAOf/6AD3/6QA+/+kAV//2AF7/7ADj/+cACwAH//oACv/sAAv/8gAg/+0AN//LADn/+gA9/+kAPv/pAFf/9gBe/+wA4//nAAsAB//6AAr/7AAL//IAIP/tADf/ywA5//oAPf/pAD7/6QBX//YAXv/sAOP/5wALAAf/+gAK/+wAC//yACD/7QA3/8sAOf/6AD3/6QA+/+kAV//2AF7/7ADj/+cACwAH//oACv/sAAv/8gAg/+0AN//LADn/+gA9/+kAPv/pAFf/9gBe/+wA4//nAAwAB//6AAr/6wAL//UAIP/vADf/ygA5//AAPf/tAD7/6wBX//sAWf/6AF7/7QDj/+sABQAH/+8ACv/2ADf/4QA+//QA4//0AAwAB//6AAr/6wAL//UAIP/vADf/ygA5//AAPf/tAD7/6wBX//sAWf/6AF7/7QDj/+sADAAH//oACv/rAAv/9QAg/+8AN//KADn/8AA9/+0APv/rAFf/+wBZ//oAXv/tAOP/6wAMAAf/+gAK/+sAC//1ACD/7wA3/8oAOf/wAD3/7QA+/+sAV//7AFn/+gBe/+0A4//rAAwAB//6AAr/6wAL//UAIP/vADf/ygA5//AAPf/tAD7/6wBX//sAWf/6AF7/7QDj/+sAAgAH//gAN//3AAIAB//4ADf/9wAEAAf/+AALABMAIAAOADf/9wAEAAf/+AALAAoAN//3AOMABgAKAAf/+wAK/+sAC//2ACD/9AA9//QAPv/tAFf//ABZ//UAXv/uAOP/7wALAAf/+gAK/+wAC//zACD/7gA3/8wAOf/6AD3/6gA+/+kAV//3AF7/7ADj/+gACwAK/+UAC//yACD/7AA3/8sAOf/XAD3/6gA+/+cAV//5AFn/8QBe/+kA4//pAAsACv/lAAv/8gAg/+wAN//LADn/1wA9/+oAPv/nAFf/+QBZ//EAXv/pAOP/6QALAAr/5QAL//IAIP/sADf/ywA5/9cAPf/qAD7/5wBX//kAWf/xAF7/6QDj/+kACwAK/+UAC//yACD/7AA3/8sAOf/XAD3/6gA+/+cAV//5AFn/8QBe/+kA4//pAAsACv/lAAv/8gAg/+wAN//LADn/1wA9/+oAPv/nAFf/+QBZ//EAXv/pAOP/6QALAAr/5QAL//IAIP/sADf/ywA5/9cAPf/qAD7/5wBX//kAWf/xAF7/6QDj/+kACAAH//kACv/uADf/1AA5//gAPf/xAD7/7ABe/+4A4//uAAgAB//5AAr/7gA3/9QAOf/4AD3/8QA+/+wAXv/uAOP/7gAIAAf/+QAK/+4AN//UADn/+AA9//EAPv/sAF7/7gDj/+4ACAAH//kACv/uADf/1AA5//gAPf/xAD7/7ABe/+4A4//uAAkAB//0AAr/7wAQ//EAN//2ADn/3AA+/+4AVwAfAFkAHABe//MACwAK/+UAC//yACD/7AA3/8sAOf/XAD3/6gA+/+cAV//5AFn/8QBe/+kA4//pAAkAB//0AAr/7wAQ//EAN//2ADn/3AA+/+4AVwAfAFkAHABe//MABQCqAFIAqwABAKwAPQCtAGAAyAABAAIAB//5AFf/8AAMAAf/+gAK/+sAC//1ACD/7wA3/8oAOf/wAD3/7QA+/+sAV//7AFn/+gBe/+0A4//rAAcACv/rADf/8wA5/+YAPv/uAFn/8wBe/+8A4//4AAsACv/lAAv/8gAg/+wAN//LADn/1wA9/+oAPv/nAFf/+QBZ//EAXv/pAOP/6QAGAAv/9AA3//oAOf/5AFf/4ABZ/+sA4//4AAkACv/tACD/7wA3/8sAOf/0AD3/7wA+/+wAV//8AF7/7wDj/+oACgAH/9cAEP/cACH/4gA3ACUAOQAjAFf/uQBZ/7wAbP/wAKwAAQCtAA8ABQAH//UAN//uAD7/9QBXABEA4//4AAIAB//4ADf/9wAEADf/3wA5/+EAV//4AFn/6gAEADf/3wA5/+EAV//4AFn/6gACABD/1QAh/+wABAAD/4MAN//AAFf/4QDZ/4MAAgAQ/9UAIf/sAAQAA/+DADf/wABX/+EA2f+DAAEAN//0AAMAN//hADn/8QBZ//MABQAH/+0AEP/vADcABwBXACAAWQAPAAIAB//4ADf/9wACAAf/+AA3//cAAwAH//cAN//1AHX/xAACAAf/+AA3//cAAwAH//cAN//1AHX/xAAFAAf/9QA3/+4APv/1AFcAEQDj//gAARjSAAQAAAAEABIAJACaAbwABAAN/34AD/9+ANf/fgDe/34AHQAD/9IACP/SADX/0AA2//sAOv/IAEf/8wBV//EAWv/rAIQAEwCX//sAmP/7AJn/+wCa//sAm//IAJ3/8wC7/+sAvf/rAL7/8wDAABMAxv/QAMf/8QDW/9IA2f/SAPL/8wDz//MA9P/zAPX/8wD2//MA9//zAEgAJP/rACj/6wAw/+sAMv/rADb/9ABC/+0ARP/lAEX/5QBG/+UAR//zAEj/5QBO/+4AT//uAFD/5QBR/+4AUv/lAFP/7gBU/+0AVf/qAFb/6QBa//EAhf/rAJD/6wCR/+sAkv/rAJP/6wCU/+sAlv/rAJf/9ACY//QAmf/0AJr/9ACd//MAnv/tAJ//7QCg/+0Aof/tAKL/7QCj/+0ApP/tAKX/5QCm/+UAp//lAKj/5QCp/+UArv/lAK//7gCw/+UAsf/lALL/5QCz/+UAtP/lALb/5QC3/+kAuP/pALn/6QC6/+kAu//xAL3/8QC+//MAwf/tAML/6wDD/+UAxf/tAMf/6gDy//MA8//zAPT/8wD1//MA9v/zAPf/8wD4/+0AEwBE//IARf/yAEb/8gBI//IAUP/yAFL/8gCl//IApv/yAKf/8gCo//IAqf/yAK7/8gCw//IAsf/yALL/8gCz//IAtP/yALb/8gDD//IAARbUAAQAAAAWADYAgAFKAVwCWgOkBLIGVAeqCLgJOgqgC+IM8A0CDTAPCg+4D8IP3A/mD/wAEgAi/9cAQv/2AH7/1wB//9cAgP/XAIH/1wCC/9cAg//XAIT/zQCe//YAn//2AKD/9gCh//YAov/2AKP/9gCk//YAwP/NAMH/9gAyACL/4ABC/+wARP/qAEX/6gBG/+oASP/qAE7/8QBP//EAUP/qAFH/8QBS/+oAU//xAFT/7wBW//IAfv/gAH//4ACA/+AAgf/gAIL/4ACD/+AAhP/vAJ7/7ACf/+wAoP/sAKH/7ACi/+wAo//sAKT/7ACl/+oApv/qAKf/6gCo/+oAqf/qAK7/6gCv//EAsP/qALH/6gCy/+oAs//qALT/6gC2/+oAt//yALj/8gC5//IAuv/yAMD/7wDB/+wAw//qAMX/7wD4/+8ABAA1/+4AOv/oAJv/6ADG/+4APwA1/9YAOv/jAEP/+QBE//sARf/7AEb/+wBH//UASP/7AEn/+QBK//gAS//4AEz/+QBO//kAT//5AFD/+wBR//kAUv/7AFP/+QBU//cAVf/yAFb/+QBa//YAhP/4AJv/4wCd//UApf/7AKb/+wCn//sAqP/7AKn/+wCq//gAq//4AKz/+ACt//gArv/7AK//+QCw//sAsf/7ALL/+wCz//sAtP/7ALb/+wC3//kAuP/5ALn/+QC6//kAu//2ALz/+QC9//YAvv/1AMD/+ADD//sAxf/3AMb/1gDH//IAyP/4APL/9QDz//UA9P/1APX/9QD2//UA9//1APj/9wBSAA3/uQAP/7kAIv/MAEL/tABD//kARP/sAEX/7ABG/+wAR//uAEj/7ABJ//kASv/1AEv/9QBM//kATv/lAE//5QBQ/+wAUf/lAFL/7ABT/+UAVP/sAFX/5QBW/+gAWv/zAHn/8wB+/8wAf//MAID/zACB/8wAgv/MAIP/zACE/7EAnf/uAJ7/tACf/7QAoP+0AKH/tACi/7QAo/+0AKT/tACl/+wApv/sAKf/7ACo/+wAqf/sAKr/9QCr//UArP/1AK3/9QCu/+wAr//lALD/7ACx/+wAsv/sALP/7AC0/+wAtv/sALf/6AC4/+gAuf/oALr/6AC7//MAvP/5AL3/8wC+/+4AwP+xAMH/tADD/+wAxf/sAMf/5QDI//UA1/+5ANr/uQDe/7kA4P/zAPL/7gDz/+4A9P/uAPX/7gD2/+4A9//uAPj/7ABDAA3/sgAP/7IAIv/UADr/+wBC/+YAQ//6AET/8gBF//IARv/yAEj/8gBJ//oASv/4AEv/+ABM//oATv/4AE//+ABQ//IAUf/4AFL/8gBT//gAVP/5AFb/+QB+/9QAf//UAID/1ACB/9QAgv/UAIP/1ACE/7EAm//7AJ7/5gCf/+YAoP/mAKH/5gCi/+YAo//mAKT/5gCl//IApv/yAKf/8gCo//IAqf/yAKr/+ACr//gArf/4AK7/8gCv//gAsP/yALH/8gCy//IAs//yALT/8gC2//IAt//5ALj/+QC5//kAuv/5ALz/+gDA/7EAwf/mAMP/8gDF//kAyP/4ANf/sgDa/7IA3v+yAPj/+QBoAA3/wAAO/98AD//AABv/9wAc//cAIv/UACT/8wAo//MAMP/zADL/8wA0//sANQAfADoAMABC/8oAQ//4AET/ywBF/8sARv/LAEf/9QBI/8sASf/4AEr/9wBL//cATP/4AE7/1ABP/9QAUP/LAFH/1ABS/8sAU//UAFT/zgBV/+gAVv/XAFr/9gBq/+EAef/0AH7/1AB//9QAgP/UAIH/1ACC/9QAg//UAIT/0ACF//MAkP/zAJH/8wCS//MAk//zAJT/8wCW//MAmwAwAJ3/9QCe/8oAn//KAKD/ygCh/8oAov/KAKP/ygCk/8oApf/LAKb/ywCn/8sAqP/LAKn/ywCr//cArv/LAK//1ACw/8sAsf/LALL/ywCz/8sAtP/LALb/ywC3/9cAuP/XALn/1wC6/9cAu//2ALz/+AC9//YAvv/1AMD/0ADB/8oAwv/zAMP/ywDE//sAxf/OAMYAHwDH/+gAyP/3ANP/3wDU/98A1//AANr/wADe/8AA3//hAOD/9ADy//UA8//1APT/9QD1//UA9v/1APf/9QD4/84AVQAO/+EAIgAgACT/5gAo/+YAMP/mADL/5gA0//oANQAgADoAJQBC//YARP/YAEX/2ABG/9gAR//xAEj/2ABO//gAT//4AFD/2ABR//gAUv/YAFP/+ABU//cAVf/UAFb/4QBa/9wAav/xAH4AIAB/ACAAgAAgAIEAIACCACAAgwAgAIX/5gCQ/+YAkf/mAJL/5gCT/+YAlP/mAJb/5gCbACUAnf/xAJ7/9gCf//YAoP/2AKH/9gCi//YAo//2AKT/9gCl/9gApv/YAKf/2ACo/9gAqf/YAK7/2ACv//gAsP/YALH/2ACy/9gAs//YALT/2AC2/9gAt//hALj/4QC5/+EAuv/hALv/3AC9/9wAvv/xAMH/9gDC/+YAw//YAMT/+gDF//cAxgAgAMf/1ADT/+EA1P/hAN//8QDy//EA8//xAPT/8QD1//EA9v/xAPf/8QD4//cAQwAi/+8AJP/vACj/7wAw/+8AMv/vADoACgBC/+wARP/nAEX/5wBG/+cASP/nAE7/7ABP/+wAUP/nAFH/7ABS/+cAU//sAFT/7ABV/+wAVv/pAFr/8QB+/+8Af//vAID/7wCB/+8Agv/vAIP/7wCF/+8AkP/vAJH/7wCS/+8Ak//vAJT/7wCW/+8AmwAKAJ7/7ACf/+wAoP/sAKH/7ACi/+wAo//sAKT/7ACl/+cApv/nAKf/5wCo/+cAqf/nAK7/5wCv/+wAsP/nALH/5wCy/+cAs//nALT/5wC2/+cAt//pALj/6QC5/+kAuv/pALv/8QC9//EAwf/sAML/7wDD/+cAxf/sAMf/7AD4/+wAIAAD/9gACP/YACT/9gAo//YAMP/2ADL/9gA1/9wANv/yADr/1ABV//YAWv/zAIQACACF//YAkP/2AJH/9gCS//YAk//2AJT/9gCW//YAl//yAJj/8gCZ//IAmv/yAJv/1AC7//MAvf/zAMAACADC//YAxv/cAMf/9gDW/9gA2f/YAFkADf/hAA7/+AAP/+EAIv/cACP/9wAl//cAJv/3ACf/9wAp//cAKv/3ACz/9wAt//cALv/3AC//9wAx//cAM//3ADX/zwA2//gAOv/dAEL/+gBE//kARf/5AEb/+QBHABwASP/5AFD/+QBS//kAVQAVAFoAGwB+/9wAf//cAID/3ACB/9wAgv/cAIP/3ACG//cAh//3AIj/9wCJ//cAiv/3AIv/9wCM//cAjf/3AI7/9wCP//cAl//4AJj/+ACZ//gAmv/4AJv/3QCc//cAnQAcAJ7/+gCf//oAoP/6AKH/+gCi//oAo//6AKT/+gCl//kApv/5AKf/+QCo//kAqf/5AK7/+QCw//kAsf/5ALL/+QCz//kAtP/5ALb/+QC7ABsAvQAbAL4AHADB//oAw//5AMb/zwDHABUA0//4ANT/+ADX/+EA2v/hAN7/4QDyABwA8wAcAPQAHAD1ABwA9gAcAPcAHABQAA7/6QAj//sAJP/zACX/+wAm//sAJ//7ACj/8wAp//sAKv/7ACz/+wAt//sALv/7AC//+wAw//MAMf/7ADL/8wAz//sANf+8ADb/9gA6/9UARP/xAEX/8QBG//EARwAVAEj/8QBQ//EAUv/xAFoADwBq//MAhf/zAIb/+wCH//sAiP/7AIn/+wCK//sAi//7AIz/+wCN//sAjv/7AI//+wCQ//MAkf/zAJL/8wCT//MAlP/zAJb/8wCX//YAmP/2AJn/9gCa//YAm//VAJz/+wCdABUApf/xAKb/8QCn//EAqP/xAKn/8QCu//EAsP/xALH/8QCy//EAs//xALT/8QC2//EAuwAPAL0ADwC+ABUAwv/zAMP/8QDG/7wA0//pANT/6QDf//MA8gAVAPMAFQD0ABUA9QAVAPYAFQD3ABUAQwAi//MAJP/vACj/7wAw/+8AMv/vADoADABC/+8ARP/qAEX/6gBG/+oASP/qAE7/7gBP/+4AUP/qAFH/7gBS/+oAU//uAFT/7gBV/+8AVv/sAFr/9QB+//MAf//zAID/8wCB//MAgv/zAIP/8wCF/+8AkP/vAJH/7wCS/+8Ak//vAJT/7wCW/+8AmwAMAJ7/7wCf/+8AoP/vAKH/7wCi/+8Ao//vAKT/7wCl/+oApv/qAKf/6gCo/+oAqf/qAK7/6gCv/+4AsP/qALH/6gCy/+oAs//qALT/6gC2/+oAt//sALj/7AC5/+wAuv/sALv/9QC9//UAwf/vAML/7wDD/+oAxf/uAMf/7wD4/+4ABAA1/9AAOv/gAJv/4ADG/9AACwAi//UANf/vADr/5wB+//UAf//1AID/9QCB//UAgv/1AIP/9QCb/+cAxv/vAHYAIv/xACP/8AAk/+oAJf/wACb/8AAn//AAKP/qACn/8AAq//AALP/wAC3/8AAu//AAL//wADD/6gAx//AAMv/qADP/8AA0//AANf+7ADb/5wA6/8kAQv/rAEP/7gBE/+cARf/nAEb/5wBH/+8ASP/nAEn/7gBK/+4ATP/uAE7/7gBP/+4AUP/nAFH/7gBS/+cAU//uAFT/7QBV/+wAVv/pAFr/8wB+//EAf//xAID/8QCB//EAgv/xAIP/8QCF/+oAhv/w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") format("opentype"); font-weight: normal; font-style: normal; }</style>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; font-family: "Varela Round", sans-serif !important; }
    body { font-family: "Varela Round", sans-serif; direction: rtl; padding: 5px 10px; font-size: 11px; color: #1e293b; line-height: 1.4; background: #fff; }
    .hdr { text-align:center; margin-bottom:10px; border-bottom:2px solid #e2e8f0; padding-bottom:8px; }
    .logo { max-height:50px; max-width:140px; object-fit:contain; margin:0 auto 5px; display:block; }
    .company-name { margin:0 0 2px 0; font-size:20px; color:#0f172a; font-weight:800; font-family:"Varela Round",sans-serif; }
    .cd { font-size:11px; color:#64748b; margin-bottom:5px; font-family:"Varela Round",sans-serif; }
    .report-title { margin:5px 0 3px 0; font-size:15px; color:#0f172a; font-weight:700; font-family:"Varela Round",sans-serif; }
    .mi { font-size:11px; color:#475569; margin-bottom:2px; font-family:"Varela Round",sans-serif; }
    table { width:100%; border-collapse:collapse; margin-bottom:10px; font-family:"Varela Round",sans-serif; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 3px; text-align: center; vertical-align: middle; font-family:"Varela Round",sans-serif; }
    th { background:#f1f5f9; color:#334155; font-weight:700; font-size:11px; white-space:nowrap; }
    .day-col { width: 24px; min-width: 24px; max-width: 24px; font-size: 11px; }
    .x-mark { font-weight: 800; color: #000000; font-size: 12px; }
    .route-name { text-align: right; padding: 4px 7px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; font-size: 11px; font-weight: 500; }
    .idx { width: 24px; color: #94a3b8; font-size: 10px; }
    .summary-col { font-weight: 600; font-size: 11px; background: #f8fafc; min-width: 60px; }
    .total-col { color: #0f172a; }
    tr.totals-row td { background: #e2e8f0; font-weight: 800; border-top: 2px solid #94a3b8; font-size: 11px; }
    .total-day { font-size: 10px; color: #475569; }
    .ftr { margin-top:15px; text-align:center; font-size:11px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:8px; font-family:"Varela Round",sans-serif; }
    .fc { margin-top:3px; color:#64748b; font-family:"Varela Round",sans-serif; }
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
  <div class="ftr">${footerLine2}<div style="font-weight:800;font-size:14px;color:#1e293b;margin-top:6px;font-family:'Varela Round',sans-serif;">הופק באמצעות מערכת לו&quot;ז - ניהול סידור עבודה</div></div>
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
        <DialogContent className="sm:max-w-[480px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>{reportTitles[reportType]}</DialogTitle>
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

            <div className="space-y-2">
              <Label className="font-bold">תיאור מסלול</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="חפש מסלול..." value={tempFilters.description}
                  onChange={(e) => setTempFilters(p => ({ ...p, description: e.target.value }))}
                  className="pr-9 h-10" />
                {tempFilters.description && (
                  <button className="absolute left-3 top-1/2 transform -translate-y-1/2" onClick={() => setTempFilters(p => ({ ...p, description: "" }))}>
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-bold">סטטוס חשבונית</Label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={tempFilters.withInvoice} onCheckedChange={(c) => setTempFilters(p => ({ ...p, withInvoice: !!c }))} />
                  מס' חשבונית קיים
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={tempFilters.withoutInvoice} onCheckedChange={(c) => setTempFilters(p => ({ ...p, withoutInvoice: !!c }))} />
                  ללא מס' חשבונית
                </label>
              </div>
            </div>

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

            <Button onClick={applyFilters} disabled={isLoading} className="h-10 mt-2">
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
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowInvoiceDialog(false)} disabled={isUpdatingInvoice}>ביטול</Button>
            <Button onClick={handleBulkUpdateInvoice} disabled={isUpdatingInvoice}>
              {isUpdatingInvoice && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              שמור
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
                  {tableColumns.map(col => (
                    <TableHead key={col.id} className="relative text-right border-l select-none overflow-visible" style={{ width: col.width }}>
                      <div className="flex items-center justify-between gap-1 cursor-pointer" onClick={() => handleSortCol(col.id)}>
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
                        {tableColumns.map(col => (
                          <TableCell key={col.id} className={`text-right border-l truncate ${col.cls || ""}`}>
                            {col.render(record)}
                          </TableCell>
                        ))}
                      </TableRow>
                    </ContextMenuTrigger>
                    <ContextMenuContent dir="rtl" className="w-48">
                      <ContextMenuItem onSelect={() => setEditingRecord(record)} className="cursor-pointer">
                        עריכת נסיעה
                      </ContextMenuItem>
                      <ContextMenuItem 
                        onSelect={() => {
                          if (!selectedRowIds.has(record.id)) {
                            setSelectedRowIds(new Set([record.id]))
                          }
                          setShowInvoiceDialog(true)
                        }}
                        className="cursor-pointer"
                      >
                        עדכון מס' חשבונית
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

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
