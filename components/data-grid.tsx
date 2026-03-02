"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  ColumnSizingState,
  ColumnOrderState,
  VisibilityState,
} from "@tanstack/react-table"
import { Calendar as CalendarIcon, LayoutDashboard, AlertCircle, CheckCircle2, UserMinus, Trash2, Loader2, ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { requestQueue } from "@/lib/request-queue"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Label } from "@/components/ui/label"

import { RideDialog } from "@/components/new-ride-dialog"
import { SplitRideDialog } from "@/components/split-ride-dialog"
import { ExportDriverPdfDialog } from "@/components/export-driver-pdf-dialog"
import { SendWhatsappDialog } from "@/components/send-whatsapp-dialog"

import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { useTenantFields, useTenant } from "@/lib/tenant-context"
import { AutoAssignDialog } from "@/components/auto-assign-dialog"

// --- ממשקים ---
export interface WorkScheduleRecord {
  id: string
  fields: {
    [key: string]: any
  }
}

const renderLinkField = (value: any) => {
  if (!value) return <span className="text-muted-foreground">-</span>
  if (Array.isArray(value) && value.length > 0) {
    return value[0]?.title || <span className="text-muted-foreground">-</span>
  }
  if (typeof value === 'object' && value.title) {
    return value.title
  }
  return String(value)
}

// הגדרת העמודות - מקבל fields mapping מ-tenant config
function createColumns(WS: any): ColumnDef<WorkScheduleRecord>[] {
  return [
  {
    id: "select",
    header: ({ table }) => (
      <div className="pr-4" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
          className="translate-y-[2px] h-6 w-6" 
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="pr-4" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-[2px] h-6 w-6" 
        />
      </div>
    ),
    enableSorting: false,
    size: 60,
    minSize: 60,
    enableResizing: false,
  },
  {
    accessorKey: `fields.${WS.SENT}`,
    id: "sent",
    header: "שלח",
    cell: ({ row, table }) => {
      const updateField = (table.options.meta as any)?.updateRecordField;
      const isDriverEmpty = !row.original.fields[WS.DRIVER] || 
                           (Array.isArray(row.original.fields[WS.DRIVER]) && row.original.fields[WS.DRIVER].length === 0);
      
      return (
        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
          <Checkbox 
            checked={!!row.original.fields[WS.SENT]} 
            disabled={isDriverEmpty}
            className={cn("h-6 w-6", isDriverEmpty && "opacity-50 cursor-not-allowed")} 
            onCheckedChange={(checked) => {
              if (updateField && !isDriverEmpty) {
                updateField(row.original.id, WS.SENT, !!checked);
              }
            }}
          />
        </div>
      );
    },
    size: 70,
    minSize: 70,
  },
  {
    accessorKey: `fields.${WS.APPROVED}`,
    id: "approved",
    header: "מאושר",
    cell: ({ row, table }) => {
      const updateField = (table.options.meta as any)?.updateRecordField;
      const isDriverEmpty = !row.original.fields[WS.DRIVER] || 
                           (Array.isArray(row.original.fields[WS.DRIVER]) && row.original.fields[WS.DRIVER].length === 0);

      return (
        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
          <Checkbox 
            checked={!!row.original.fields[WS.APPROVED]} 
            disabled={isDriverEmpty}
            className={cn("h-6 w-6", isDriverEmpty && "opacity-50 cursor-not-allowed")} 
            onCheckedChange={(checked) => {
              if (updateField && !isDriverEmpty) {
                updateField(row.original.id, WS.APPROVED, !!checked);
              }
            }}
          />
        </div>
      );
    },
    size: 80,
    minSize: 80,
  },
  {
    accessorFn: (row: any) => renderLinkField(row.fields[WS.CUSTOMER]),
    id: "customer",
    header: "שם לקוח",
    cell: ({ row }) => <div className="text-right truncate px-2">{renderLinkField(row.original.fields[WS.CUSTOMER])}</div>,
    size: 150,
    minSize: 120,
  },
  {
    accessorKey: `fields.${WS.PICKUP_TIME}`,
    id: "pickup",
    header: "התייצבות",
    cell: ({ row }) => <div className="text-right truncate px-2">{row.original.fields[WS.PICKUP_TIME] || ""}</div>,
    size: 110,
    minSize: 100,
  },
  {
    accessorKey: `fields.${WS.DESCRIPTION}`,
    id: "route",
    header: "מסלול",
    cell: ({ row }) => (
      <div className="text-right truncate px-2" title={row.original.fields[WS.DESCRIPTION]}>
        {row.original.fields[WS.DESCRIPTION] || ""}
      </div>
    ),
    size: 200,
    minSize: 150,
  },
  {
    accessorKey: `fields.${WS.DROPOFF_TIME}`,
    id: "destination",
    header: "חזור",
    cell: ({ row }) => <div className="text-right truncate px-2">{row.original.fields[WS.DROPOFF_TIME] || ""}</div>,
    size: 150,
    minSize: 100,
  },
  {
    accessorFn: (row: any) => renderLinkField(row.fields[WS.VEHICLE_TYPE]),
    id: "vehicleType",
    header: "סוג רכב",
    cell: ({ row }) => <div className="text-right truncate px-2">{renderLinkField(row.original.fields[WS.VEHICLE_TYPE])}</div>,
    size: 120,
    minSize: 100,
  },
  {
    accessorFn: (row: any) => row.fields._driverFullName || renderLinkField(row.fields[WS.DRIVER]),
    id: "driver",
    header: "שם נהג",
    cell: ({ row }) => <div className="text-right truncate px-2">{row.original.fields._driverFullName || renderLinkField(row.original.fields[WS.DRIVER])}</div>,
    size: 120,
    minSize: 100,
  },
  {
    accessorKey: `fields.${WS.VEHICLE_NUM}`,
    id: "vehicleNumber",
    header: "מספר רכב",
    cell: ({ row }) => <div className="text-right truncate px-2">{row.original.fields[WS.VEHICLE_NUM] || ""}</div>,
    size: 110,
    minSize: 100,
  },
  {
    accessorKey: `fields.${WS.PRICE_CLIENT_EXCL}`,
    id: "price1",
    header: "מחיר לקוח+ מע״מ",
    cell: ({ row }) => <div className="text-right px-2">{row.original.fields[WS.PRICE_CLIENT_EXCL] || 0}</div>,
    size: 140,
    minSize: 120,
  },
  {
    accessorKey: `fields.${WS.PRICE_CLIENT_INCL}`,
    id: "price2",
    header: "מחיר לקוח כולל מע״מ",
    cell: ({ row }) => <div className="text-right px-2">{row.original.fields[WS.PRICE_CLIENT_INCL] || 0}</div>,
    size: 170,
    minSize: 150,
  },
  {
    accessorKey: `fields.${WS.PRICE_DRIVER_EXCL}`,
    id: "price3",
    header: "מחיר נהג+ מע״מ",
    cell: ({ row }) => <div className="text-right px-2">{row.original.fields[WS.PRICE_DRIVER_EXCL] || 0}</div>,
    size: 140,
    minSize: 120,
  },
  {
    accessorKey: `fields.${WS.PRICE_DRIVER_INCL}`,
    id: "price4",
    header: "מחיר נהג כולל מע״מ",
    cell: ({ row }) => <div className="text-right px-2">{row.original.fields[WS.PRICE_DRIVER_INCL] || 0}</div>,
    size: 170,
    minSize: 150,
  },
]
}

function DataGrid({ schema }: { schema?: any }) {
  const fields = useTenantFields()
  const { tenantId } = useTenant()
  const COLUMN_SIZING_KEY = `workScheduleColumnSizing_${tenantId}`
  const COLUMN_ORDER_KEY  = `workScheduleColumnOrder_${tenantId}`
  const COLUMN_VISIBILITY_KEY = `workScheduleColumnVisibility_${tenantId}`
  const WS = fields?.workSchedule || {} as any
  const driverNamesRef = React.useRef<Map<string, string>>(new Map())
  const columns = React.useMemo(() => createColumns(WS), [WS])
  const [data, setData] = React.useState<WorkScheduleRecord[]>([])
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState("")
  const tableScrollRef = React.useRef<HTMLDivElement>(null)
  const [dateFilter, setDateFilter] = React.useState<Date>(new Date())
  const dateFilterRef = React.useRef<Date>(new Date())
  const [currentMonth, setCurrentMonth] = React.useState<Date>(new Date())
  
  // טעינת רוחב עמודות מ-localStorage
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(COLUMN_SIZING_KEY)
        if (saved) {
          return JSON.parse(saved)
        }
      } catch (error) {
        console.error('Failed to load column sizing from localStorage:', error)
      }
    }
    return {}
  })

  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(COLUMN_ORDER_KEY)
        if (saved) return JSON.parse(saved)
      } catch {}
    }
    return []
  })
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(COLUMN_VISIBILITY_KEY)
        if (saved) return JSON.parse(saved)
      } catch {}
    }
    return {}
  })
  const [draggingColId, setDraggingColId] = React.useState<string | null>(null)
  
  const { toast } = useToast()
  const [editingRecord, setEditingRecord] = React.useState<WorkScheduleRecord | null>(null)
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false)
  const [isResizing, setIsResizing] = React.useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  const [showDriverAssignDialog, setShowDriverAssignDialog] = React.useState(false)
  const [driversList, setDriversList] = React.useState<{id: string, title: string}[]>([])
  const [selectedDriverId, setSelectedDriverId] = React.useState("")
  const [driverSearch, setDriverSearch] = React.useState("")
  
  // Context Menu states
  const [contextRecord, setContextRecord] = React.useState<WorkScheduleRecord | null>(null)
  const [showDuplicateDialog, setShowDuplicateDialog] = React.useState(false)
  const [bulkDuplicateRecords, setBulkDuplicateRecords] = React.useState<WorkScheduleRecord[]>([])
  const [mobileLongPressRecord, setMobileLongPressRecord] = React.useState<WorkScheduleRecord | null>(null)
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [duplicateCount, setDuplicateCount] = React.useState("1")
  const [copyDriver, setCopyDriver] = React.useState(false)
  const [isDuplicating, setIsDuplicating] = React.useState(false)
  const [duplicateProgress, setDuplicateProgress] = React.useState({ current: 0, total: 0 })
  const [showSplitDialog, setShowSplitDialog] = React.useState(false)
  const [showExportPdfDialog, setShowExportPdfDialog] = React.useState(false)
  const [exportDriverName, setExportDriverName] = React.useState("")
  const [showWhatsappDialog, setShowWhatsappDialog] = React.useState(false)
  const [whatsappDriverName, setWhatsappDriverName] = React.useState("")
  const [selectedRecordsForExport, setSelectedRecordsForExport] = React.useState<any[]>([])
  const [showAutoAssignDialog, setShowAutoAssignDialog] = React.useState(false)

  // Mobile detection - conditional render instead of CSS hiding
  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // State variables לטווח תאריכים
  const [dateRangeMode, setDateRangeMode] = React.useState(false)
  const [newDateMode, setNewDateMode] = React.useState(false)
  const [newDate, setNewDate] = React.useState<Date | undefined>(undefined)
  const [newDateMonth, setNewDateMonth] = React.useState<Date>(new Date())
  const [startDate, setStartDate] = React.useState<Date | undefined>(dateFilter)
  const [startDateMonth, setStartDateMonth] = React.useState<Date>(new Date())
  const [endDate, setEndDate] = React.useState<Date | undefined>(undefined)
  const [endDateMonth, setEndDateMonth] = React.useState<Date>(new Date())
  const [calendarModal, setCalendarModal] = React.useState<{
    open: boolean, selected?: Date, month?: Date,
    onSelect: (date: Date | undefined) => void, onMonthChange: (month: Date) => void
  }>({ open: false, onSelect: () => {}, onMonthChange: () => {} })
  const [selectedDays, setSelectedDays] = React.useState<boolean[]>([
    false, false, false, false, false, false, false
  ])

  // שמירת רוחב עמודות ב-localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined' && Object.keys(columnSizing).length > 0) {
      try {
        localStorage.setItem(COLUMN_SIZING_KEY, JSON.stringify(columnSizing))
      } catch (error) {
        console.error('Failed to save column sizing to localStorage:', error)
      }
    }
  }, [columnSizing])

  // שמירת סדר עמודות ב-localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined' && columnOrder.length > 0) {
      try { localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(columnOrder)) } catch {}
    }
  }, [columnOrder])

  // שמירת נראות עמודות ב-localStorage
  React.useEffect(() => {
    if (typeof window !== 'undefined' && Object.keys(columnVisibility).length > 0) {
      try { localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility)) } catch {}
    }
  }, [columnVisibility])

  // סנכרון נראות עמודות מהכותרת
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      setColumnVisibility(detail || {})
    }
    window.addEventListener("columnVisibilityChange", handler)
    return () => window.removeEventListener("columnVisibilityChange", handler)
  }, [])

  const enrichDriverNames = (records: any[]) => {
    const map = driverNamesRef.current
    if (map.size === 0) return records
    return records.map(record => {
      const v = record.fields[WS.DRIVER]
      if (Array.isArray(v) && v[0]?.id && map.has(v[0].id)) {
        return { ...record, fields: { ...record.fields, _driverFullName: map.get(v[0].id) } }
      }
      return record
    })
  }

  const loadDriversIfNeeded = async () => {
    if (driverNamesRef.current.size > 0) return
    const DRV = fields?.drivers
    if (!DRV?.FIRST_NAME) return
    try {
      const res = await fetch(`/api/drivers?tenant=${tenantId}`)
      const json = await res.json()
      if (!json.records) return
      const items = json.records.map((x: any) => {
        const name = x.fields?.[DRV.FIRST_NAME] || ""
        return { id: x.id, title: name.trim() }
      }).filter((d: any) => d.title)
      setDriversList(items)
      const map = new Map<string, string>()
      items.forEach((d: any) => map.set(d.id, d.title))
      driverNamesRef.current = map
    } catch {}
  }

  const fetchData = async () => {
    try {
      // Ensure drivers are loaded first for full name display
      await loadDriversIfNeeded()
      const dateStr = format(dateFilterRef.current, "yyyy-MM-dd")
      const url = `/api/work-schedule?tenant=${tenantId}&date=${dateStr}&_t=${Date.now()}`
      const response = await fetch(url, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      }) 
      const json = await response.json()
      if (json.records) {
        const records = json.records.map((record: any) => ({ ...record, fields: { ...record.fields } }))
        setData(enrichDriverNames(records))
      }
    } catch (error) { console.error("[fetchData] Exception:", error) }
  }

  const updateRecordField = async (recordId: string, fieldKey: string, value: any) => {
    try {
      const response = await fetch(`/api/work-schedule?tenant=${tenantId}`, {
        method: "PATCH",
        body: JSON.stringify({ recordId, fields: { [fieldKey]: value } })
      });
      if (!response.ok) throw new Error("Update failed");
      setData(prev => prev.map(rec => rec.id === recordId ? { ...rec, fields: { ...rec.fields, [fieldKey]: value } } : rec));
    } catch (error) { toast({ title: "שגיאה בעדכון", variant: "destructive" }); fetchData(); }
  }

  // עדכון אופטימיסטי + תור: מעדכן UI מיד, שולח דרך התור ברקע
  const bulkUpdateField = (records: any[], fieldKey: string, value: any) => {
    const ids = records.map(r => r.original.id)
    // עדכון UI מיידי
    setData(prev => prev.map(rec => ids.includes(rec.id) ? { ...rec, fields: { ...rec.fields, [fieldKey]: value } } : rec))
    setRowSelection({})
    // שרת ברקע דרך התור
    Promise.all(ids.map(id =>
      requestQueue.add(async () => {
        const res = await fetch(`/api/work-schedule?tenant=${tenantId}`, {
          method: "PATCH",
          body: JSON.stringify({ recordId: id, fields: { [fieldKey]: value } })
        })
        if (!res.ok) throw new Error(`PATCH failed: ${res.status}`)
        return true
      }).catch(() => false)
    )).then(results => {
      const failCount = results.filter(ok => !ok).length
      if (failCount > 0) {
        toast({ title: `${failCount} רשומות נכשלו בעדכון`, variant: "destructive" })
        fetchData()
      }
    })
  }

  const fetchDriversList = async () => {
    driverNamesRef.current = new Map() // force reload
    await loadDriversIfNeeded()
  }

  const handleBulkAssignDriver = () => {
    if (!selectedDriverId) return
    const driver = driversList.find(d => d.id === selectedDriverId)
    if (!driver) return
    const selectedRows = table.getFilteredSelectedRowModel().rows
    const ids = selectedRows.map(r => r.original.id)
    // עדכון UI מיידי
    setData(prev => prev.map(rec => ids.includes(rec.id) ? { ...rec, fields: { ...rec.fields, [WS.DRIVER]: [{ id: driver.id, title: driver.title }], _driverFullName: driver.title } } : rec))
    setRowSelection({})
    setShowDriverAssignDialog(false)
    setSelectedDriverId("")
    setDriverSearch("")
    // שרת ברקע
    Promise.all(ids.map(id =>
      requestQueue.add(async () => {
        const res = await fetch(`/api/work-schedule?tenant=${tenantId}`, {
          method: "PATCH",
          body: JSON.stringify({ recordId: id, fields: { [WS.DRIVER]: [driver.id] } })
        })
        if (!res.ok) throw new Error(`PATCH failed: ${res.status}`)
        return true
      }).catch(() => false)
    )).then(results => {
      const failCount = results.filter(ok => !ok).length
      if (failCount > 0) {
        toast({ title: `${failCount} נסיעות נכשלו בשיבוץ נהג`, variant: "destructive" })
        fetchData()
      } else {
        toast({ title: "הצלחה", description: `נהג ${driver.title} שובץ ל-${ids.length} נסיעות` })
      }
    })
  }

  const handleDeleteSelected = async () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) return;
    
    const idsToDelete = selectedRows.map(row => row.original.id)
    
    setData(prev => prev.filter(rec => !idsToDelete.includes(rec.id)))
    setRowSelection({})
    setShowDeleteDialog(false)
    
    // מחיקה בקבוצות של 10 (batch delete)
    const chunkSize = 10
    let failCount = 0
    for (let i = 0; i < idsToDelete.length; i += chunkSize) {
      const chunk = idsToDelete.slice(i, i + chunkSize)
      try {
        const ok = await requestQueue.add(async () => {
          const params = new URLSearchParams()
          params.set('tenant', tenantId)
          chunk.forEach(id => params.append('id', id))
          const res = await fetch(`/api/work-schedule?${params.toString()}`, { method: "DELETE" })
          if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
          return true
        })
        if (!ok) failCount += chunk.length
      } catch { failCount += chunk.length }
    }
    
    if (failCount > 0) {
      toast({ title: `${failCount} נסיעות נכשלו במחיקה`, variant: "destructive" })
      fetchData()
    }
  }

  const handleDuplicate = async () => {
    const recordsToDuplicate = bulkDuplicateRecords.length > 0 ? bulkDuplicateRecords : (contextRecord ? [contextRecord] : [])
    if (recordsToDuplicate.length === 0 || isDuplicating) return
    
    const count = parseInt(duplicateCount) || 1
    if (count < 1) {
      toast({ title: "שגיאה", description: "מספר השכפולים חייב להיות לפחות 1", variant: "destructive" })
      return
    }

    if (dateRangeMode) {
      if (!startDate || !endDate) {
        toast({ title: "שגיאה", description: "יש לבחור תאריך התחלה וסיום", variant: "destructive" })
        return
      }
      if (startDate > endDate) {
        toast({ title: "שגיאה", description: "תאריך ההתחלה חייב להיות לפני תאריך הסיום", variant: "destructive" })
        return
      }
      if (!selectedDays.some(d => d)) {
        toast({ title: "שגיאה", description: "יש לבחור לפחות יום אחד בשבוע", variant: "destructive" })
        return
      }
    }

    if (newDateMode && !dateRangeMode && !newDate) {
      toast({ title: "שגיאה", description: "יש לבחור תאריך חדש", variant: "destructive" })
      return
    }

    setIsDuplicating(true)

    try {
      let datesToDuplicate: Date[] = []

      if (dateRangeMode && startDate && endDate) {
        const currentDate = new Date(startDate)
        while (currentDate <= endDate) {
          const dayOfWeek = currentDate.getDay()
          if (selectedDays[dayOfWeek]) {
            datesToDuplicate.push(new Date(currentDate))
          }
          currentDate.setDate(currentDate.getDate() + 1)
        }
      } else if (newDateMode && newDate) {
        datesToDuplicate = [newDate]
      }

      if (dateRangeMode && datesToDuplicate.length === 0) {
        toast({ title: "שגיאה", description: "לא נמצאו תאריכים מתאימים בטווח שנבחר", variant: "destructive" })
        setIsDuplicating(false)
        return
      }

      let firstNewRecord = null
      let totalCreated = 0
      const useDatesPerRecord = datesToDuplicate.length === 0
      
      // שלב 1: אוסף את כל הפיילודים קודם
      const allPayloads: any[] = []
      
      for (const record of recordsToDuplicate) {
        const dates = useDatesPerRecord 
          ? [record.fields[WS.DATE] ? new Date(record.fields[WS.DATE]) : new Date()]
          : datesToDuplicate

        for (const date of dates) {
          for (let i = 0; i < count; i++) {
            const newFields = { ...record.fields }
            
            newFields[WS.DATE] = format(date, "yyyy-MM-dd")
            newFields[WS.SENT] = false
            newFields[WS.APPROVED] = false
            
            if (!copyDriver) {
              newFields[WS.DRIVER] = null
            }
            
            allPayloads.push(newFields)
          }
        }
      }

      // שלב 2: מגדיר את הסה"כ לפני ההרצה
      const totalOperations = allPayloads.length
      setDuplicateProgress({ current: 0, total: totalOperations })

      // שלב 3: מריץ את הבקשות עם מעקב אחוזים
      const allRequests = allPayloads.map(fields =>
        requestQueue.add(() =>
          fetch(`/api/work-schedule?tenant=${tenantId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fields })
          }).then(r => {
            if (!r.ok) throw new Error('Duplicate failed')
            return r.json()
          }).then(res => {
            setDuplicateProgress(prev => ({ ...prev, current: prev.current + 1 }))
            return res
          })
        )
      )
      
      const results = await Promise.all(allRequests)
      totalCreated = results.length
      
      if (results.length > 0 && recordsToDuplicate.length === 1) {
        const rec = results[0]?.records?.[0] || results[0]?.record
        if (rec) firstNewRecord = rec
      }
      
      setDuplicateProgress({ current: totalCreated, total: totalOperations })
      
      toast({ 
        title: "הצלחה", 
        description: `${totalCreated} נסיעות שוכפלו בהצלחה` 
      })
      
      setShowDuplicateDialog(false)
      setDuplicateCount("1")
      setCopyDriver(false)
      setDateRangeMode(false)
      setNewDateMode(false)
      setNewDate(undefined)
      setStartDate(undefined)
      setEndDate(undefined)
      setSelectedDays([false, false, false, false, false, false, false])
      setBulkDuplicateRecords([])
      setRowSelection({})
      
      const scrollTop = tableScrollRef.current?.scrollTop || 0;
      await fetchDataAfterSave()
      requestAnimationFrame(() => { if (tableScrollRef.current) tableScrollRef.current.scrollTop = scrollTop; });
      
      if (firstNewRecord && recordsToDuplicate.length === 1) {
        setEditingRecord(firstNewRecord)
      }
    } catch (error) {
      console.error('Error duplicating record:', error)
      toast({ title: "שגיאה", description: "לא הצלחנו לשכפל את הנסיעות", variant: "destructive" })
    } finally {
      setIsDuplicating(false)
    }
  }

  const handleSplit = () => {
    setShowSplitDialog(true)
  }

  // Delayed fetch to allow Teable to commit changes before re-reading
  const fetchDataAfterSave = React.useCallback(async () => {
    const scrollTop = tableScrollRef.current?.scrollTop || 0
    console.log('[fetchDataAfterSave] Waiting 800ms for Teable commit...')
    await new Promise(r => setTimeout(r, 800))
    console.log('[fetchDataAfterSave] First fetch attempt...')
    await fetchData()
    requestAnimationFrame(() => { if (tableScrollRef.current) tableScrollRef.current.scrollTop = scrollTop })
    // Retry after 2 seconds in case of eventual consistency
    setTimeout(async () => {
      console.log('[fetchDataAfterSave] Retry fetch...')
      await fetchData()
      requestAnimationFrame(() => { if (tableScrollRef.current) tableScrollRef.current.scrollTop = scrollTop })
    }, 2000)
  }, [])


  // Sync ref and fetch when date changes
  React.useEffect(() => {
    dateFilterRef.current = dateFilter
    fetchData()
  }, [dateFilter])

  // Auto-refresh every 30 seconds so all users see the latest data
  React.useEffect(() => {
    const interval = setInterval(() => {
      fetchData()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setDateFilter(date)
      setCurrentMonth(date)
      setIsCalendarOpen(false)
    }
  }

  const handleTodayClick = () => {
    const today = new Date()
    setDateFilter(today)
    setCurrentMonth(today)
    setIsCalendarOpen(false)
  }

  const filteredData = React.useMemo(() => {
    let filtered = data
    if (dateFilter) {
      const dateStr = format(dateFilter, "yyyy-MM-dd")
      filtered = filtered.filter(item => (item.fields[WS.DATE] || "").startsWith(dateStr))
    }
    if (globalFilter) {
      const lowerFilter = globalFilter.toLowerCase()
      filtered = filtered.filter((item) => Object.values(item.fields).some((val) => {
           if (val == null) return false
           if (Array.isArray(val)) return val.some((v: any) => v?.title && String(v.title).toLowerCase().includes(lowerFilter))
           if (typeof val === 'object' && val.title) return String(val.title).toLowerCase().includes(lowerFilter)
           return String(val).toLowerCase().includes(lowerFilter)
      }))
    }
    return filtered
  }, [data, dateFilter, globalFilter])

  const [sorting, setSorting] = React.useState<SortingState>([{ id: "pickup", desc: false }])

  const table = useReactTable({
    data: filteredData, columns, columnResizeMode: "onChange", getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection, onColumnSizingChange: setColumnSizing, onSortingChange: setSorting,
    onColumnOrderChange: setColumnOrder, onColumnVisibilityChange: setColumnVisibility,
    enableSortingRemoval: false,
    meta: { updateRecordField }, state: { rowSelection, columnSizing, sorting, columnOrder, columnVisibility },
  })

  const totals = React.useMemo(() => {
    const rows = table.getFilteredRowModel().rows
    const totalRows = rows.length;
    const noDriver = rows.filter(r => {
        const driver = r.original.fields[WS.DRIVER];
        return !driver || (Array.isArray(driver) && driver.length === 0);
    }).length;
    const notSent = rows.filter(r => !r.original.fields[WS.SENT]).length;
    const approved = rows.filter(r => !!r.original.fields[WS.APPROVED]).length;

    return {
      totalRows, noDriver, notSent, approved,
      p1: rows.reduce((sum, row) => sum + (Number(row.original.fields[WS.PRICE_CLIENT_EXCL]) || 0), 0),
      p2: rows.reduce((sum, row) => sum + (Number(row.original.fields[WS.PRICE_CLIENT_INCL]) || 0), 0),
      p3: rows.reduce((sum, row) => sum + (Number(row.original.fields[WS.PRICE_DRIVER_EXCL]) || 0), 0),
      p4: rows.reduce((sum, row) => sum + (Number(row.original.fields[WS.PRICE_DRIVER_INCL]) || 0), 0),
      p5: rows.reduce((sum, row) => sum + (Number(row.original.fields[WS.PROFIT]) || 0), 0),
      p6: rows.reduce((sum, row) => sum + ((Number(row.original.fields[WS.PRICE_CLIENT_INCL]) || 0) - (Number(row.original.fields[WS.PRICE_DRIVER_INCL]) || 0)), 0),
    }
  }, [table.getFilteredRowModel().rows])

  const selectedCount = table.getFilteredSelectedRowModel().rows.length;

  // Mobile long press context menu
  const MobileLongPressMenu = () => {
    const rec = mobileLongPressRecord
    if (!rec) return null
    const f = rec.fields
    const driver = f[WS.DRIVER]
    const hasDriver = driver && (!Array.isArray(driver) || driver.length > 0)
    const driverName = Array.isArray(driver) && driver.length > 0 ? driver[0]?.title : (typeof driver === 'object' && driver?.title ? driver.title : String(driver || ""))
    const isSent = !!f[WS.SENT]
    const isApproved = !!f[WS.APPROVED]

    // Safe customer name extraction
    const customerRaw = f[WS.CUSTOMER]
    const customerName = Array.isArray(customerRaw) ? (customerRaw[0]?.title || "—") : (typeof customerRaw === 'object' && customerRaw !== null ? (customerRaw.title || "—") : String(customerRaw || "—"))

    const close = () => setMobileLongPressRecord(null)

    const menuItems: { label: string; action: () => void; danger?: boolean; disabled?: boolean }[] = [
      { label: "שכפול", action: () => { setBulkDuplicateRecords([]); setContextRecord(rec); setShowDuplicateDialog(true); close() } },
      { label: "פיצול", action: () => { setContextRecord(rec); handleSplit(); close() } },
      ...(hasDriver ? [
        { label: "ייצוא דוח לנהג", action: () => { setSelectedRecordsForExport([rec]); setExportDriverName(driverName); setShowExportPdfDialog(true); close() } },
        { label: "שלח בוואטסאפ", action: () => { setSelectedRecordsForExport([rec]); setWhatsappDriverName(driverName); setShowWhatsappDialog(true); close() } },
      ] : []),
      { label: isSent ? "בטל שלח" : "סמן שלח", action: () => { bulkUpdateField([{ original: rec } as any], WS.SENT, !isSent); close() } },
      { label: isApproved ? "בטל מאושר" : "סמן מאושר", action: () => { bulkUpdateField([{ original: rec } as any], WS.APPROVED, !isApproved); close() } },
      { label: "שיבוץ נהג", action: () => { fetchDriversList(); setShowDriverAssignDialog(true); close() } },
      ...(hasDriver ? [{ label: "מחק נהג", action: () => { bulkUpdateField([{ original: rec } as any], WS.DRIVER, null); close() }, danger: true }] : []),
    ]

    return (
      <Dialog open={true} onOpenChange={close}>
        <DialogContent dir="rtl" className="max-w-xs p-0 overflow-hidden" aria-describedby={undefined}>
          <DialogTitle className="sr-only">תפריט נסיעה</DialogTitle>
          <div className="p-3 border-b bg-muted/30">
            <div className="font-bold text-sm truncate">{customerName}</div>
            <div className="text-xs text-muted-foreground truncate">{f[WS.DESCRIPTION] || ""}</div>
          </div>
          <div className="flex flex-col py-1">
            {menuItems.map((item, i) => (
              <button key={i} onClick={item.action} disabled={item.disabled}
                className={`text-right px-4 py-3 text-sm hover:bg-accent active:bg-accent transition-colors border-b last:border-b-0 ${item.danger ? "text-red-500" : ""} ${item.disabled ? "opacity-40" : ""}`}>
                {item.label}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="w-full h-[calc(100vh-2rem)] flex flex-col space-y-1 md:space-y-2 p-1.5 md:p-4 overflow-hidden" dir="rtl">
      {mobileLongPressRecord && <MobileLongPressMenu />}
      <div className="flex flex-col gap-1 md:gap-2 flex-none">
        {/* Toolbar */}
        <div className="flex items-center gap-1 md:gap-2 overflow-x-auto no-scrollbar">
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className="w-[140px] md:w-[240px] justify-start text-right font-normal shrink-0 text-[11px] md:text-sm h-8 md:h-9 px-2 md:px-3">
                <CalendarIcon className="ml-1 md:ml-2 h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
                <span className="truncate">
                  <span className="hidden md:inline">{format(dateFilter, "EEEE '|' PPP", { locale: he })}</span>
                  <span className="md:hidden">{format(dateFilter, "dd/MM/yy", { locale: he })}</span>
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end" side="bottom">
              <Calendar 
                mode="single" 
                selected={dateFilter} 
                onSelect={handleDateSelect} 
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                required 
                locale={he} 
                dir="rtl" 
                initialFocus 
                showOutsideDays={true} 
                fixedWeeks 
              />
              <div className="border-t p-2"><Button variant="ghost" className="w-full justify-center text-sm" onClick={handleTodayClick}>חזור להיום</Button></div>
            </PopoverContent>
          </Popover>

          {/* חצי ניווט בין תאריכים - רק בדסקטופ */}
          <Button
            variant="outline"
            size="icon"
            className="hidden md:flex shrink-0 h-8 w-8 md:h-9 md:w-9"
            title="יום קודם"
            onClick={() => {
              const prev = new Date(dateFilter)
              prev.setDate(prev.getDate() - 1)
              setDateFilter(prev)
              setCurrentMonth(prev)
            }}
          >
            <ChevronRight className="h-3.5 w-3.5 md:h-4 md:w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="hidden md:flex shrink-0 h-8 w-8 md:h-9 md:w-9"
            title="יום הבא"
            onClick={() => {
              const next = new Date(dateFilter)
              next.setDate(next.getDate() + 1)
              setDateFilter(next)
              setCurrentMonth(next)
            }}
          >
            <ChevronLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
          </Button>

          <RideDialog 
            onRideSaved={fetchDataAfterSave} 
            defaultDate={format(dateFilter, "yyyy-MM-dd")}
            key={`new-ride-${format(dateFilter, "yyyy-MM-dd")}`}
          />

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0 h-8 md:h-9 text-xs md:text-sm"
            onClick={() => setShowAutoAssignDialog(true)}
            title="שיבוץ נסיעות קבועות"
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            <span className="hidden md:inline">שיבוץ אוטומטי</span>
          </Button>

          <Button 
            variant="outline" 
            size="icon" 
            className={cn(
                "hidden md:flex shrink-0 h-8 w-8 md:h-9 md:w-9 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors",
                selectedCount === 0 && "opacity-50"
            )}
            onClick={() => setShowDeleteDialog(true)}
            disabled={selectedCount === 0}
            title="מחק נסיעות מסומנות"
          >
            <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
          </Button>

          <div className="w-[100px] md:w-[150px] shrink-0">
            <Input 
                placeholder="חיפוש..." 
                value={globalFilter} 
                onChange={(e) => setGlobalFilter(e.target.value)} 
                className="w-full h-8 md:h-9 text-xs md:text-sm" 
            />
          </div>

          {/* חלון סיכום סה"כ שורות */}
          <div className="hidden md:flex bg-card p-1.5 lg:p-2 px-2 lg:px-4 rounded-md border shadow-sm items-center gap-2 lg:gap-4 whitespace-nowrap min-w-[200px]">
              <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 lg:gap-2">
                      <LayoutDashboard className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground text-[10px] lg:text-xs font-medium">סה"כ שורות: <span className="font-bold text-foreground text-xs lg:text-sm">{totals.totalRows}</span></span>
                  </div>
                  <div className="flex items-center gap-1 lg:gap-2 text-orange-500 dark:text-orange-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="text-[10px] lg:text-xs font-medium">נסיעות מאושרות: <span className="font-bold text-xs lg:text-sm">{totals.approved}</span></span>
                  </div>
              </div>

              <div className="w-px bg-border self-stretch my-1"></div>

              <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1 lg:gap-2 text-red-600 dark:text-red-400">
                      <UserMinus className="w-3.5 h-3.5" />
                      <span className="text-[10px] lg:text-xs font-medium">ללא נהג: <span className="font-bold text-xs lg:text-sm">{totals.noDriver}</span></span>
                  </div>
                  <div className="flex items-center gap-1 lg:gap-2 text-orange-500 dark:text-orange-400">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span className="text-[10px] lg:text-xs font-medium">לא נשלחו: <span className="font-bold text-xs lg:text-sm">{totals.notSent}</span></span>
                  </div>
              </div>
          </div>

          {/* חלון סיכום מחירים */}
          <div className="hidden lg:flex gap-2 xl:gap-3 text-[10px] xl:text-sm bg-muted/20 p-1.5 xl:p-2 px-2 xl:px-4 rounded-md border shadow-sm items-center">
             <div className="flex flex-col gap-0.5 items-start justify-center whitespace-nowrap">
               <span>לקוח+ מע"מ: <span className="font-bold">{totals.p1.toLocaleString()} ₪</span></span>
               <span>לקוח כולל: <span className="font-bold">{totals.p2.toLocaleString()} ₪</span></span>
             </div>
             <div className="w-px bg-border self-stretch my-1"></div>
             <div className="flex flex-col gap-0.5 items-start justify-center whitespace-nowrap">
               <span>נהג+ מע"מ: <span className="font-bold">{totals.p3.toLocaleString()} ₪</span></span>
               <span>נהג כולל: <span className="font-bold">{totals.p4.toLocaleString()} ₪</span></span>
             </div>
             <div className="w-px bg-border self-stretch my-1"></div>
             <div className="flex flex-col gap-0.5 items-start justify-center text-orange-500 dark:text-orange-400 font-medium whitespace-nowrap">
               <span>רווח+ מע"מ: <span className="font-bold">{totals.p5.toLocaleString()} ₪</span></span>
               <span>רווח כולל: <span className="font-bold">{totals.p6.toLocaleString()} ₪</span></span>
             </div>
          </div>
        </div>
      </div>
      
      {/* Mobile card view - only rendered on mobile */}
      {isMobile && (
        <div className="flex-1 overflow-auto min-h-0 space-y-2 pb-2">
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => {
              const f = row.original.fields || {}
              const safeStr = (v: any): string => {
                if (!v) return ""
                if (typeof v === "string") return v
                if (typeof v === "number") return String(v)
                if (Array.isArray(v)) return safeStr(v[0])
                if (typeof v === "object" && v.title) return String(v.title)
                if (typeof v === "object" && v.name) return String(v.name)
                return ""
              }
              const customerText = safeStr(f[WS.CUSTOMER])
              const driverText = String(f._driverFullName || "") || safeStr(f[WS.DRIVER])
              const pickupTime = safeStr(f[WS.PICKUP_TIME])
              const dropoffTime = safeStr(f[WS.DROPOFF_TIME])
              const description = safeStr(f[WS.DESCRIPTION])
              const price = safeStr(f[WS.PRICE_CLIENT_INCL])
              const isSent = !!(f[WS.SENT])
              const isApproved = !!(f[WS.APPROVED])
              return (
                <div
                  key={row.id}
                  className="border rounded-lg p-3 bg-card shadow-sm active:bg-muted/50 select-none"
                  onClick={() => setEditingRecord(row.original)}
                  onTouchStart={() => {
                    longPressTimer.current = setTimeout(() => {
                      setMobileLongPressRecord(row.original)
                    }, 500)
                  }}
                  onTouchEnd={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null } }}
                  onTouchMove={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null } }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm">{customerText || "—"}</span>
                    <div className="flex items-center gap-2">
                      {isApproved && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">מאושר</span>}
                      {isSent && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">נשלח</span>}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div className="flex gap-4">
                      {pickupTime ? <span>🕐 {pickupTime}</span> : null}
                      {dropoffTime ? <span>🔄 {dropoffTime}</span> : null}
                    </div>
                    {description ? <div className="truncate">📍 {description}</div> : null}
                    <div className="flex gap-4">
                      <span>🚗 {driverText || "ללא נהג"}</span>
                      {price ? <span>💰 ₪{price}</span> : null}
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-center text-muted-foreground py-8">אין תוצאות.</div>
          )}
        </div>
      )}

      {/* Desktop table view - only rendered on desktop */}
      {!isMobile && (
        <div className="rounded-md border flex-1 overflow-auto min-h-0" ref={tableScrollRef}>
        <Table className="relative w-full" style={{ tableLayout: 'fixed' }}>
          <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={`text-right relative border-l select-none group hover:bg-muted/30 transition-colors ${draggingColId && draggingColId !== header.column.id ? 'border-l-2 border-l-primary/30' : ''}`}
                    style={{ width: header.getSize(), cursor: header.column.id === 'select' ? 'default' : 'grab' }}
                    draggable={header.column.id !== 'select'}
                    onDragStart={(e) => {
                      if (header.column.id === 'select') { e.preventDefault(); return }
                      setDraggingColId(header.column.id)
                      e.dataTransfer.effectAllowed = "move"
                      e.dataTransfer.setData("text/plain", header.column.id)
                    }}
                    onDragOver={(e) => {
                      if (header.column.id === 'select' || !draggingColId) return
                      e.preventDefault()
                      e.dataTransfer.dropEffect = "move"
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const sourceId = e.dataTransfer.getData("text/plain")
                      if (!sourceId || sourceId === header.column.id || header.column.id === 'select') {
                        setDraggingColId(null)
                        return
                      }
                      const currentOrder = table.getAllLeafColumns().map(c => c.id)
                      const fromIdx = currentOrder.indexOf(sourceId)
                      const toIdx = currentOrder.indexOf(header.column.id)
                      if (fromIdx === -1 || toIdx === -1) { setDraggingColId(null); return }
                      const newOrder = [...currentOrder]
                      newOrder.splice(fromIdx, 1)
                      newOrder.splice(toIdx, 0, sourceId)
                      table.setColumnOrder(newOrder)
                      setDraggingColId(null)
                    }}
                    onDragEnd={() => setDraggingColId(null)}
                  >
                    <div className={`flex items-center gap-1 ${header.column.getCanSort() ? 'cursor-pointer' : ''}`} onClick={header.column.getToggleSortingHandler()}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && <span className="text-xs">▲</span>}
                      {header.column.getIsSorted() === "desc" && <span className="text-xs">▼</span>}
                    </div>
                    {header.column.getCanResize() && (
                      <div onMouseDown={(e) => {
                          e.stopPropagation(); e.preventDefault(); setIsResizing(true);
                          const startX = e.clientX; const startWidth = header.getSize();
                          const onMouseMove = (me: MouseEvent) => {
                            const newWidth = Math.max(header.column.columnDef.minSize || 50, startWidth + (startX - me.clientX)); 
                            setColumnSizing(old => ({ ...old, [header.id]: newWidth }))
                          };
                          const onMouseUp = () => { setIsResizing(false); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
                          document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
                        }} className="absolute left-0 top-0 h-full w-1 cursor-col-resize touch-none select-none z-20 hover:bg-primary transition-colors duration-200" />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <ContextMenu key={row.id}>
                  <ContextMenuTrigger asChild>
                    <TableRow data-state={row.getIsSelected() && "selected"} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditingRecord(row.original)}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="text-right truncate border-l">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-48" dir="rtl">
                    <ContextMenuItem 
                      onSelect={() => {
                        setEditingRecord(row.original)
                      }}
                      className="cursor-pointer text-right"
                    >
                      עריכה
                    </ContextMenuItem>
                    <ContextMenuItem 
                      onSelect={() => {
                        const selectedRows = table.getFilteredSelectedRowModel().rows
                        if (selectedRows.length > 1) {
                          setBulkDuplicateRecords(selectedRows.map(r => r.original))
                          setContextRecord(null)
                        } else {
                          setBulkDuplicateRecords([])
                          setContextRecord(row.original)
                        }
                        setShowDuplicateDialog(true)
                      }}
                      className="cursor-pointer text-right"
                    >
                      {table.getFilteredSelectedRowModel().rows.length > 1 
                        ? `שכפול ${table.getFilteredSelectedRowModel().rows.length} נסיעות`
                        : "שכפול"
                      }
                    </ContextMenuItem>
                    <ContextMenuItem 
                      onSelect={() => {
                        setContextRecord(row.original)
                        handleSplit()
                      }}
                      className="cursor-pointer text-right"
                    >
                      פיצול
                    </ContextMenuItem>
                    <ContextMenuItem 
                      onSelect={() => {
                        const driver = row.original.fields[WS.DRIVER]
                        const driverName = Array.isArray(driver) && driver.length > 0 
                          ? driver[0]?.title 
                          : (typeof driver === 'object' && driver?.title ? driver.title : String(driver || ""))
                        if (!driverName) return
                        // If rows are selected via checkbox, use those; otherwise just this row
                        const selected = table.getFilteredSelectedRowModel().rows
                        setSelectedRecordsForExport(selected.length > 0 ? selected.map(r => r.original) : [row.original])
                        setExportDriverName(driverName)
                        setShowExportPdfDialog(true)
                      }}
                      className="cursor-pointer text-right"
                      disabled={!row.original.fields[WS.DRIVER] || (Array.isArray(row.original.fields[WS.DRIVER]) && row.original.fields[WS.DRIVER].length === 0)}
                    >
                      ייצוא דוח לנהג
                    </ContextMenuItem>
                    <ContextMenuItem 
                      onSelect={() => {
                        const driver = row.original.fields[WS.DRIVER]
                        const driverName = Array.isArray(driver) && driver.length > 0 
                          ? driver[0]?.title 
                          : (typeof driver === 'object' && driver?.title ? driver.title : String(driver || ""))
                        if (!driverName) return
                        // If rows are selected via checkbox, use those; otherwise just this row
                        const selected = table.getFilteredSelectedRowModel().rows
                        setSelectedRecordsForExport(selected.length > 0 ? selected.map(r => r.original) : [row.original])
                        setWhatsappDriverName(driverName)
                        setShowWhatsappDialog(true)
                      }}
                      className="cursor-pointer text-right"
                      disabled={!row.original.fields[WS.DRIVER] || (Array.isArray(row.original.fields[WS.DRIVER]) && row.original.fields[WS.DRIVER].length === 0)}
                    >
                      שלח בוואטסאפ
                    </ContextMenuItem>
                    {table.getFilteredSelectedRowModel().rows.length > 0 && (() => {
                      const selectedRows = table.getFilteredSelectedRowModel().rows;
                      const count = selectedRows.length;
                      const notSentRows = selectedRows.filter(r => !r.original.fields[WS.SENT]);
                      const sentRows = selectedRows.filter(r => !!r.original.fields[WS.SENT]);
                      const notApprovedRows = selectedRows.filter(r => !r.original.fields[WS.APPROVED]);
                      const approvedRows = selectedRows.filter(r => !!r.original.fields[WS.APPROVED]);
                      const someHaveDriver = selectedRows.some(r => {
                        const d = r.original.fields[WS.DRIVER];
                        return d && (!Array.isArray(d) || d.length > 0);
                      });
                      return (
                        <>
                          <div className="h-px bg-border my-1" />
                          <ContextMenuItem onSelect={() => { fetchDriversList(); setShowDriverAssignDialog(true); }} className="cursor-pointer text-right">
                            שיבוץ נהג ל-{count} נסיעות
                          </ContextMenuItem>
                          {someHaveDriver && (
                            <ContextMenuItem onSelect={() => { bulkUpdateField(selectedRows, WS.DRIVER, null); }} className="cursor-pointer text-right text-red-500">
                              מחק נהג מ-{count} נסיעות
                            </ContextMenuItem>
                          )}
                          <div className="h-px bg-border my-1" />
                          {notSentRows.length > 0 && (
                            <ContextMenuItem onSelect={() => { bulkUpdateField(notSentRows, WS.SENT, true); }} className="cursor-pointer text-right">
                              סמן שלח ל-{notSentRows.length} נסיעות
                            </ContextMenuItem>
                          )}
                          {sentRows.length > 0 && (
                            <ContextMenuItem onSelect={() => { bulkUpdateField(sentRows, WS.SENT, false); }} className="cursor-pointer text-right">
                              בטל שלח ל-{sentRows.length} נסיעות
                            </ContextMenuItem>
                          )}
                          {notApprovedRows.length > 0 && (
                            <ContextMenuItem onSelect={() => { bulkUpdateField(notApprovedRows, WS.APPROVED, true); }} className="cursor-pointer text-right">
                              סמן מאושר ל-{notApprovedRows.length} נסיעות
                            </ContextMenuItem>
                          )}
                          {approvedRows.length > 0 && (
                            <ContextMenuItem onSelect={() => { bulkUpdateField(approvedRows, WS.APPROVED, false); }} className="cursor-pointer text-right">
                              בטל מאושר ל-{approvedRows.length} נסיעות
                            </ContextMenuItem>
                          )}
                        </>
                      );
                    })()}
                  </ContextMenuContent>
                </ContextMenu>
              ))
            ) : (
              <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">אין תוצאות.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      )}

      {/* Dialog למחיקה */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">האם אתה בטוח?</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              פעולה זו תמחק לצמיתות {selectedCount} נסיעות שנבחרו.
              לא ניתן לבטל פעולה זו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel className="mt-0">ביטול</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSelected}
              className="bg-red-600 hover:bg-red-700"
            >
              מחק
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog לשיבוץ נהג */}
      <Dialog open={showDriverAssignDialog} onOpenChange={(open) => { setShowDriverAssignDialog(open); if (!open) { setSelectedDriverId(""); setDriverSearch(""); } }}>
        <DialogContent className="sm:max-w-[400px] sm:w-[400px] h-[420px] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">שיבוץ נהג ל-{selectedCount} נסיעות</DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex flex-col min-h-0 py-2">
            <Input
              placeholder="חיפוש נהג..."
              value={driverSearch}
              onChange={(e) => setDriverSearch(e.target.value)}
              className="mb-2 text-right flex-none"
            />
            <div className="flex-1 overflow-auto border rounded-md min-h-0">
              {driversList
                .filter(d => d.title.includes(driverSearch))
                .map(d => (
                  <button
                    key={d.id}
                    className={cn(
                      "w-full text-right px-3 py-2 text-sm hover:bg-accent transition-colors",
                      selectedDriverId === d.id && "bg-accent font-bold"
                    )}
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
            <Button onClick={handleBulkAssignDriver} disabled={!selectedDriverId}>שבץ נהג</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog לשכפול */}
      <Dialog open={showDuplicateDialog} onOpenChange={(open) => { setShowDuplicateDialog(open); if (!open) setBulkDuplicateRecords([]); }}>
        <DialogContent dir="rtl" className="w-full h-full md:max-w-2xl md:h-[85vh] flex flex-col max-w-full max-h-full md:rounded-lg rounded-none">
          <DialogHeader>
            <DialogTitle className="text-right">
              {bulkDuplicateRecords.length > 1 ? `שכפול ${bulkDuplicateRecords.length} נסיעות` : "שכפול נסיעה"}
            </DialogTitle>
            <DialogDescription className="text-right">
              {bulkDuplicateRecords.length > 1 
                ? "ההגדרות יחולו על כל הנסיעות המסומנות"
                : "בחר כמה פעמים לשכפל את הנסיעה, איזה תאריך/ים, והאם להעתיק את הנהג"
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* הגדרות בסיסיות */}
            <div className="space-y-4 p-4 border rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2 mb-3">
                <LayoutDashboard className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <h3 className="font-bold text-orange-700 dark:text-orange-300">הגדרות בסיסיות</h3>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="count" className="text-right">כמה פעמים לשכפל את הנסיעה?</Label>
                <Input 
                  id="count"
                  type="number"
                  min="1"
                  value={duplicateCount}
                  onChange={(e) => setDuplicateCount(e.target.value)}
                  className="text-right"
                  disabled={isDuplicating}
                />
              </div>

              <div className="space-y-3">
                <Label className="text-right block">בחר אופן קביעת תאריך:</Label>
                
                <div className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    id="keep-original" 
                    name="dateMode"
                    checked={!dateRangeMode && !newDateMode}
                    onChange={() => {
                      setDateRangeMode(false)
                      setNewDateMode(false)
                    }}
                    disabled={isDuplicating}
                  />
                  <Label htmlFor="keep-original" className="cursor-pointer">שמור תאריך מקורי</Label>
                </div>

                <div className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    id="new-date" 
                    name="dateMode"
                    checked={newDateMode && !dateRangeMode}
                    onChange={() => {
                      setDateRangeMode(false)
                      setNewDateMode(true)
                    }}
                    disabled={isDuplicating}
                  />
                  <Label htmlFor="new-date" className="cursor-pointer">בחר תאריך חדש</Label>
                </div>

                {newDateMode && !dateRangeMode && (
                  <div className="mr-6">
                    <Button 
                      variant={"outline"} 
                      className="w-full justify-start text-right"
                      onClick={() => setCalendarModal({ 
                        open: true, 
                        selected: newDate, 
                        month: newDateMonth,
                        onSelect: (date) => { setNewDate(date); if (date) setNewDateMonth(date) },
                        onMonthChange: setNewDateMonth
                      })}
                    >
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {newDate ? format(newDate, "EEEE '|' PPP", { locale: he }) : "בחר תאריך"}
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input 
                    type="radio" 
                    id="date-range" 
                    name="dateMode"
                    checked={dateRangeMode}
                    onChange={() => {
                      setDateRangeMode(true)
                      setNewDateMode(false)
                    }}
                    disabled={isDuplicating}
                  />
                  <Label htmlFor="date-range" className="cursor-pointer">טווח תאריכים (מתקדם)</Label>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox 
                  id="copyDriver"
                  checked={copyDriver}
                  onCheckedChange={(checked) => setCopyDriver(!!checked)}
                  disabled={isDuplicating}
                />
                <Label htmlFor="copyDriver" className="cursor-pointer">
                  העתק נהג
                </Label>
              </div>
            </div>

            {/* טווח תאריכים מתקדם */}
            {dateRangeMode && (
              <div className="space-y-4 p-4 border rounded-lg bg-orange-50/50 dark:bg-orange-950/50">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  <h3 className="font-bold text-orange-700 dark:text-orange-300">שכפול מתקדם (טווח תאריכים)</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>מתאריך:</Label>
                    <Button 
                      variant={"outline"} 
                      className="w-full justify-start text-right"
                      onClick={() => setCalendarModal({ 
                        open: true, 
                        selected: startDate, 
                        month: startDateMonth,
                        onSelect: (date) => { setStartDate(date); if (date) setStartDateMonth(date) },
                        onMonthChange: setStartDateMonth
                      })}
                    >
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {startDate ? format(startDate, "EEEE '|' PPP", { locale: he }) : "בחר תאריך"}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label>עד תאריך:</Label>
                    <Button 
                      variant={"outline"} 
                      className="w-full justify-start text-right"
                      onClick={() => setCalendarModal({ 
                        open: true, 
                        selected: endDate, 
                        month: endDateMonth,
                        onSelect: (date) => { setEndDate(date); if (date) setEndDateMonth(date) },
                        onMonthChange: setEndDateMonth
                      })}
                    >
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {endDate ? format(endDate, "EEEE '|' PPP", { locale: he }) : "בחר תאריך"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="block">ימים בשבוע:</Label>
                  <div className="flex gap-2 justify-between">
                    {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map((day, index) => (
                      <button
                        key={index}
                        type="button"
                        disabled={isDuplicating}
                        onClick={() => {
                          const newDays = [...selectedDays]
                          newDays[index] = !newDays[index]
                          setSelectedDays(newDays)
                        }}
                        className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all text-center ${
                          selectedDays[index]
                            ? "border-orange-500 bg-orange-50 text-orange-700"
                            : "border-gray-200 text-gray-400 hover:border-gray-300"
                        } ${isDuplicating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {isDuplicating && duplicateProgress.total > 0 && (
            <div className="space-y-2 px-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{duplicateProgress.current} / {duplicateProgress.total}</span>
                <span>{Math.round((duplicateProgress.current / duplicateProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-primary h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(duplicateProgress.current / duplicateProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-row-reverse gap-2 flex-shrink-0">
            <Button onClick={() => setShowDuplicateDialog(false)} variant="outline" disabled={isDuplicating}>
              ביטול
            </Button>
            <Button onClick={handleDuplicate} disabled={isDuplicating}>
              {isDuplicating ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  משכפל... {duplicateProgress.current}/{duplicateProgress.total}
                </>
              ) : (
                "שכפל"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RideDialog 
        open={!!editingRecord} 
        onOpenChange={(isOpen: boolean) => { if (!isOpen) { setEditingRecord(null); fetchDataAfterSave(); } }}
        initialData={editingRecord} 
        onRideSaved={() => { 
          setEditingRecord(null); 
          fetchDataAfterSave(); 
        }} 
        triggerChild={<span />}
        defaultDate={format(dateFilter, "yyyy-MM-dd")}
        allRides={table.getRowModel().rows.map(r => r.original)}
        onNavigate={(record: any) => setEditingRecord(record)}
      />
      
      <SplitRideDialog 
        open={showSplitDialog} 
        onOpenChange={setShowSplitDialog} 
        record={contextRecord} 
        onSplit={fetchDataAfterSave} 
      />

      <ExportDriverPdfDialog
        open={showExportPdfDialog}
        onOpenChange={setShowExportPdfDialog}
        currentDate={dateFilter}
        allRecords={data}
        initialDriverName={exportDriverName}
        selectedRecords={selectedRecordsForExport}
      />

      <SendWhatsappDialog
        open={showWhatsappDialog}
        onOpenChange={setShowWhatsappDialog}
        currentDate={dateFilter}
        allRecords={data}
        initialDriverName={whatsappDriverName}
        selectedRecords={selectedRecordsForExport}
      />

      <AutoAssignDialog
        open={showAutoAssignDialog}
        onOpenChange={setShowAutoAssignDialog}
        currentDate={dateFilter}
        existingRecords={data}
        onComplete={fetchDataAfterSave}
      />

      {/* Calendar Modal */}
      <Dialog open={calendarModal.open} onOpenChange={(open) => { if (!open) setCalendarModal(prev => ({ ...prev, open: false })) }}>
        <DialogContent dir="rtl" className="w-auto max-w-[320px] p-4 flex items-center justify-center [&>button]:hidden" aria-describedby={undefined}>
          <DialogTitle className="sr-only">בחר תאריך</DialogTitle>
          <Calendar 
            mode="single" 
            selected={calendarModal.selected} 
            onSelect={(date) => {
              calendarModal.onSelect(date)
              if (date) {
                calendarModal.onMonthChange(date)
                setCalendarModal(prev => ({ ...prev, open: false }))
              }
            }}
            month={calendarModal.month}
            onMonthChange={(month) => {
              calendarModal.onMonthChange(month)
              setCalendarModal(prev => ({ ...prev, month }))
            }}
            locale={he} 
            dir="rtl"
            fixedWeeks
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { DataGrid }
