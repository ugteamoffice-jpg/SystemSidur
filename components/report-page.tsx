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
    const mkDriver = (r: WorkScheduleRecord) => renderLinkField(r.fields[WS.DRIVER])
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
    setSelectedRowIds(new Set()) // איפוס בחירות בחיפוש מחדש
    
    try {
      setIsLoading(true)
      const response = await fetch(`/api/work-schedule?tenant=${tenantId}&take=1000&_t=${Date.now()}`)
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
      filtered = filtered.filter((r) => renderLinkField(r.fields[WS.DRIVER]).toLowerCase().includes(search))
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

  React.useEffect(() => {
    // מנקה את הבחירה כשמבצעים סינון פנימי חדש (Global Filter)
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
      requestQueue.add(() =>
        fetch(`/api/work-schedule/${id}?tenant=${tenantId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: { [INVOICE_FIELD_ID]: valueToSave } })
        }).then(r => r.ok).catch(() => false)
      )
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
  const exportToCsv = () => {
    if (filteredData.length === 0) return

    const headers = [
      "מס' חשבונית", "תאריך", "שם לקוח", "התייצבות", "מסלול", "חזור", "סוג רכב", "שם נהג", "מספר רכב",
      'לקוח לפני מע"מ', 'לקוח כולל מע"מ', 'נהג לפני מע"מ', 'נהג כולל מע"מ', "רווח"
    ]

    const csvRows = [
      headers.join(","),
      ...filteredData.map(record => {
        const f = record.fields
        return [
          `"${f[INVOICE_FIELD_ID] || ""}"`,
          f[WS.DATE] ? format(new Date(f[WS.DATE]), "dd/MM/yyyy") : "",
          `"${renderLinkField(f[WS.CUSTOMER]).replace(/"/g, '""')}"`,
          `"${f[WS.PICKUP_TIME] || ""}"`,
          `"${(f[WS.DESCRIPTION] || "").replace(/"/g, '""')}"`,
          `"${f[WS.DROPOFF_TIME] || ""}"`,
          `"${renderLinkField(f[WS.VEHICLE_TYPE]).replace(/"/g, '""')}"`,
          `"${renderLinkField(f[WS.DRIVER]).replace(/"/g, '""')}"`,
          `"${f[WS.VEHICLE_NUM] || ""}"`,
          Number(f[WS.PRICE_CLIENT_EXCL]) || 0,
          Number(f[WS.PRICE_CLIENT_INCL]) || 0,
          Number(f[WS.PRICE_DRIVER_EXCL]) || 0,
          Number(f[WS.PRICE_DRIVER_INCL]) || 0,
          Number(f[WS.PROFIT]) || 0
        ].join(",")
      })
    ]

    const csvContent = "\uFEFF" + csvRows.join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${reportTitles[reportType]}_${format(new Date(), "dd-MM-yyyy")}.csv`
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
    const mkDrv  = (f: any) => escapeHtml(renderLinkField(f[WS.DRIVER]))
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
        { header: "שם לקוח",              width:"100px",cls:"",    getValue: mkCust },
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
    * { box-sizing: border-box; }
    body { font-family: system-ui,-apple-system,sans-serif; direction: rtl; padding: 10px 20px; font-size: 11px; color: #1e293b; line-height: 1.4; background: #fff; }
    .hdr { text-align:center; margin-bottom:20px; border-bottom:2px solid #e2e8f0; padding-bottom:15px; }
    .logo { max-height:65px; max-width:180px; object-fit:contain; margin:0 auto 8px; display:block; }
    .company-name { margin:0 0 4px 0; font-size:22px; color:#0f172a; font-weight:800; }
    .cd { font-size:11px; color:#64748b; margin-bottom:8px; }
    .report-title { margin:8px 0 4px 0; font-size:18px; color:#0f172a; font-weight:700; }
    .me { font-size:14px; color:#1e40af; font-weight:700; margin-bottom:4px; }
    .mi { font-size:11px; color:#475569; margin-bottom:3px; }
    .mf { font-size:10px; color:#64748b; max-width:400px; line-height:1.3; margin:4px auto 0; }
    table { width:100%; border-collapse:collapse; margin-bottom:20px; }
    th { background:#f8fafc; color:#334155; font-weight:600; padding:10px 6px; text-align:right; border-bottom:2px solid #cbd5e1; white-space:nowrap; }
    td { padding:8px 6px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
    tr:nth-child(even) td { background:#fdfdfd; }
    .c { text-align:center; } .l { text-align:left; }
    .text-muted { color:#94a3b8; }
    .route-cell { max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .profit-cell { color:#16a34a; font-weight:600; }
    tr.total td { background:#f1f5f9; font-weight:700; border-top:2px solid #94a3b8; border-bottom:none; padding:12px 6px; color:#0f172a; }
    .ftr { margin-top:30px; text-align:center; font-size:10px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:15px; }
    .fc { margin-top:5px; color:#64748b; }
    @media print { body { padding:0; } }
  </style>
</head>
<body>
  <div class="hdr">
    ${logoHtml}
    ${settings.companyName ? `<div class="company-name">${escapeHtml(settings.companyName)}</div>` : ""}
    ${companyDetailsHtml}
    <div class="report-title">${reportTitle}${entityName ? ` עבור ${entityLabel} ${escapeHtml(entityName)}` : ""}</div>
    ${dateRangeStr ? `<div class="mi">${dateRangeStr}</div>` : ""}
    <div class="mi">תאריך הפקה: ${genDate} | סה"כ רשומות: ${totalRec}</div>
  </div>
  <table>
    <thead><tr>${theadCells}</tr></thead>
    <tbody>${tableRows}${totalsRow}</tbody>
  </table>
  <div class="ftr">${footerLine2}<div>\u05d4\u05d5\u05e4\u05e7 \u05d1\u05d0\u05de\u05e6\u05e2\u05d5\u05ea \u05de\u05e2\u05e8\u05db\u05ea \u05e1\u05d9\u05d3\u05d5\u05e8 \u05e2\u05d1\u05d5\u05d3\u05d4</div></div>
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
    * { box-sizing: border-box; }
    body { font-family: system-ui,-apple-system,sans-serif; direction: rtl; padding: 5px 10px; font-size: 9px; color: #1e293b; line-height: 1.2; background: #fff; }
    .hdr { text-align:center; margin-bottom:10px; border-bottom:2px solid #e2e8f0; padding-bottom:8px; }
    .logo { max-height:50px; max-width:140px; object-fit:contain; margin:0 auto 5px; display:block; }
    .company-name { margin:0 0 2px 0; font-size:18px; color:#0f172a; font-weight:800; }
    .cd { font-size:9px; color:#64748b; margin-bottom:5px; }
    .report-title { margin:5px 0 3px 0; font-size:14px; color:#0f172a; font-weight:700; }
    .mi { font-size:9px; color:#475569; margin-bottom:2px; }
    table { width:100%; border-collapse:collapse; margin-bottom:10px; }
    th, td { border: 1px solid #cbd5e1; padding: 3px 2px; text-align: center; vertical-align: middle; }
    th { background:#f1f5f9; color:#334155; font-weight:700; font-size:8px; white-space:nowrap; }
    .day-col { width: 22px; min-width: 22px; max-width: 22px; font-size: 9px; }
    .x-mark { font-weight: 800; color: #000000; font-size: 10px; }
    .route-name { text-align: right; padding: 3px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; font-size: 9px; font-weight: 500; }
    .idx { width: 22px; color: #94a3b8; font-size: 8px; }
    .summary-col { font-weight: 600; font-size: 9px; background: #f8fafc; min-width: 55px; }
    .total-col { color: #0f172a; }
    tr.totals-row td { background: #e2e8f0; font-weight: 800; border-top: 2px solid #94a3b8; font-size: 9px; }
    .total-day { font-size: 8px; color: #475569; }
    .ftr { margin-top:15px; text-align:center; font-size:8px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:8px; }
    .fc { margin-top:3px; color:#64748b; }
    @media print { body { padding:0; } }
  </style>
</head>
<body>
  <div class="hdr">
    ${logoHtml}
    ${settings.companyName ? `<div class="company-name">${escapeHtml(settings.companyName)}</div>` : ""}
    ${companyDetailsHtml}
    <div class="report-title">דוח נסיעות עבור לקוח ${escapeHtml(customerName)}</div>
    <div class="mi">${monthName}</div>
    <div class="mi">תאריך הפקה: ${format(new Date(), "dd/MM/yyyy")}</div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="idx">#</th>
        <th style="min-width:120px;text-align:right;">מסלול</th>
        ${dayHeaders}
        <th class="summary-col">סה"כ<br/>נסיעות</th>
        <th class="summary-col">מחיר<br/>לנסיעה</th>
        <th class="summary-col">סה"כ<br/>מחיר</th>
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
  <div class="ftr">${footerLine2}<div>הופק באמצעות מערכת סידור עבודה</div></div>
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
            className={`shrink-0 transition-colors text-xs md:text-sm h-8 md:h-9 px-2 md:px-3 ${selectedRowIds.size > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'opacity-50 cursor-not-allowed'}`}
            onClick={() => setShowInvoiceDialog(true)}
            disabled={selectedRowIds.size === 0}
          >
            עדכן חשבונית
          </Button>

          {/* Export Button */}
          {hasSearched && filteredData.length > 0 && (
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
                  <Printer className="h-4 w-4 ml-2 text-blue-600" />
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
          )}

          {hasSearched && (
            <div className="text-[10px] md:text-xs text-muted-foreground border rounded px-2 md:px-3 py-1 md:py-1.5 bg-muted/30 shrink-0">
              {filterSummary}
            </div>
          )}

          {hasSearched && (
            <Input placeholder="חיפוש חופשי..." value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="w-[120px] md:w-[200px] h-8 md:h-9 text-xs md:text-sm shrink-0" />
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
                    <TableHead key={col.id} className="text-right border-l" style={{ width: col.width }}>
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((record) => (
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
        onOpenChange={(isOpen: boolean) => !isOpen && setEditingRecord(null)} 
        initialData={editingRecord} 
        onRideSaved={() => { setEditingRecord(null); applyFilters(); }} 
        triggerChild={<span />}
        allRides={filteredData}
        onNavigate={(record: any) => setEditingRecord(record)}
      />
    </>
  )
}
