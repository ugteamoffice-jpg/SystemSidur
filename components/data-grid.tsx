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
} from "@tanstack/react-table"
import { Calendar as CalendarIcon, LayoutDashboard, AlertCircle, CheckCircle2, UserMinus, Trash2, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { he } from "date-fns/locale"

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

import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

// --- ממשקים ---
export interface WorkScheduleRecord {
  id: string
  fields: {
    [key: string]: any
    fldvNsQbfzMWTc7jakp?: string 
    fldLbXMREYfC8XVIghj?: string 
    fldA6e7ul57abYgAZDh?: string 
    fld56G8M1LyHRRROWiL?: string 
    fldMv14lt0W7ZBkq1PH?: boolean 
    fldDOBGATSaTi5TxyHB?: boolean 
    fldxXnfHHQWwXY8dlEV?: number 
    fldT7QLSKmSrjIHarDb?: number 
    fldSNuxbM8oJfrQ3a9x?: number 
    fldyQIhjdUeQwtHMldD?: number 
    fldT9IZTYlT4gCEnOK3?: number 
    fldhNoiFEkEgrkxff02?: string 
    flddNPbrzOCdgS36kx5?: any 
    fldx4hl8FwbxfkqXf0B?: any 
    fldVy6L2DCboXUTkjBX?: any 
    fldqStJV3KKIutTY9hW?: string 
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

// הגדרת העמודות
export const columns: ColumnDef<WorkScheduleRecord>[] = [
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
    accessorKey: "fields.fldMv14lt0W7ZBkq1PH",
    id: "sent",
    header: "שלח",
    cell: ({ row, table }) => {
      const updateField = (table.options.meta as any)?.updateRecordField;
      const isDriverEmpty = !row.original.fields.flddNPbrzOCdgS36kx5 || 
                           (Array.isArray(row.original.fields.flddNPbrzOCdgS36kx5) && row.original.fields.flddNPbrzOCdgS36kx5.length === 0);
      
      return (
        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
          <Checkbox 
            checked={!!row.original.fields.fldMv14lt0W7ZBkq1PH} 
            disabled={isDriverEmpty}
            className={cn("h-6 w-6", isDriverEmpty && "opacity-50 cursor-not-allowed")} 
            onCheckedChange={(checked) => {
              if (updateField && !isDriverEmpty) {
                updateField(row.original.id, 'fldMv14lt0W7ZBkq1PH', !!checked);
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
    accessorKey: "fields.fldDOBGATSaTi5TxyHB",
    id: "approved",
    header: "מאושר",
    cell: ({ row, table }) => {
      const updateField = (table.options.meta as any)?.updateRecordField;
      const isDriverEmpty = !row.original.fields.flddNPbrzOCdgS36kx5 || 
                           (Array.isArray(row.original.fields.flddNPbrzOCdgS36kx5) && row.original.fields.flddNPbrzOCdgS36kx5.length === 0);

      return (
        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
          <Checkbox 
            checked={!!row.original.fields.fldDOBGATSaTi5TxyHB} 
            disabled={isDriverEmpty}
            className={cn("h-6 w-6", isDriverEmpty && "opacity-50 cursor-not-allowed")} 
            onCheckedChange={(checked) => {
              if (updateField && !isDriverEmpty) {
                updateField(row.original.id, 'fldDOBGATSaTi5TxyHB', !!checked);
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
    accessorKey: "fields.fldVy6L2DCboXUTkjBX",
    id: "customer",
    header: "שם לקוח",
    cell: ({ row }) => <div className="text-right truncate px-2">{renderLinkField(row.original.fields.fldVy6L2DCboXUTkjBX)}</div>,
    size: 150,
    minSize: 120,
  },
  {
    accessorKey: "fields.fldLbXMREYfC8XVIghj",
    id: "pickup",
    header: "התייצבות",
    cell: ({ row }) => <div className="text-right truncate px-2">{row.original.fields.fldLbXMREYfC8XVIghj || ""}</div>,
    size: 110,
    minSize: 100,
  },
  {
    accessorKey: "fields.fldA6e7ul57abYgAZDh",
    id: "route",
    header: "מסלול",
    cell: ({ row }) => (
      <div className="text-right truncate px-2" title={row.original.fields.fldA6e7ul57abYgAZDh}>
        {row.original.fields.fldA6e7ul57abYgAZDh || ""}
      </div>
    ),
    size: 200,
    minSize: 150,
  },
  {
    accessorKey: "fields.fld56G8M1LyHRRROWiL",
    id: "destination",
    header: "חזור",
    cell: ({ row }) => <div className="text-right truncate px-2">{row.original.fields.fld56G8M1LyHRRROWiL || ""}</div>,
    size: 150,
    minSize: 100,
  },
  {
    accessorKey: "fields.fldx4hl8FwbxfkqXf0B",
    id: "vehicleType",
    header: "סוג רכב",
    cell: ({ row }) => <div className="text-right truncate px-2">{renderLinkField(row.original.fields.fldx4hl8FwbxfkqXf0B)}</div>,
    size: 120,
    minSize: 100,
  },
  {
    accessorKey: "fields.flddNPbrzOCdgS36kx5",
    id: "driver",
    header: "שם נהג",
    cell: ({ row }) => <div className="text-right truncate px-2">{renderLinkField(row.original.fields.flddNPbrzOCdgS36kx5)}</div>,
    size: 120,
    minSize: 100,
  },
  {
    accessorKey: "fields.fldqStJV3KKIutTY9hW",
    id: "vehicleNumber",
    header: "מספר רכב",
    cell: ({ row }) => <div className="text-right truncate px-2">{row.original.fields.fldqStJV3KKIutTY9hW || ""}</div>,
    size: 110,
    minSize: 100,
  },
  {
    accessorKey: "fields.fldxXnfHHQWwXY8dlEV",
    id: "price1",
    header: "מחיר לקוח+ מע״מ",
    cell: ({ row }) => <div className="text-right px-2">{row.original.fields.fldxXnfHHQWwXY8dlEV || 0}</div>,
    size: 140,
    minSize: 120,
  },
  {
    accessorKey: "fields.fldT7QLSKmSrjIHarDb",
    id: "price2",
    header: "מחיר לקוח כולל מע״מ",
    cell: ({ row }) => <div className="text-right px-2">{row.original.fields.fldT7QLSKmSrjIHarDb || 0}</div>,
    size: 170,
    minSize: 150,
  },
  {
    accessorKey: "fields.fldSNuxbM8oJfrQ3a9x",
    id: "price3",
    header: "מחיר נהג+ מע״מ",
    cell: ({ row }) => <div className="text-right px-2">{row.original.fields.fldSNuxbM8oJfrQ3a9x || 0}</div>,
    size: 140,
    minSize: 120,
  },
  {
    accessorKey: "fields.fldyQIhjdUeQwtHMldD",
    id: "price4",
    header: "מחיר נהג כולל מע״מ",
    cell: ({ row }) => <div className="text-right px-2">{row.original.fields.fldyQIhjdUeQwtHMldD || 0}</div>,
    size: 170,
    minSize: 150,
  },
]

const COLUMN_SIZING_KEY = 'workScheduleColumnSizing'

function DataGrid({ schema }: { schema: any }) {
  const [data, setData] = React.useState<WorkScheduleRecord[]>([])
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [dateFilter, setDateFilter] = React.useState<Date>(new Date())
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
  
  const { toast } = useToast()
  const [editingRecord, setEditingRecord] = React.useState<WorkScheduleRecord | null>(null)
  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false)
  const [isResizing, setIsResizing] = React.useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false)
  
  // Context Menu states
  const [contextRecord, setContextRecord] = React.useState<WorkScheduleRecord | null>(null)
  const [showDuplicateDialog, setShowDuplicateDialog] = React.useState(false)
  const [bulkDuplicateRecords, setBulkDuplicateRecords] = React.useState<WorkScheduleRecord[]>([])
  const [duplicateCount, setDuplicateCount] = React.useState("1")
  const [copyDriver, setCopyDriver] = React.useState(false)
  const [isDuplicating, setIsDuplicating] = React.useState(false)
  const [duplicateProgress, setDuplicateProgress] = React.useState({ current: 0, total: 0 })
  const [showSplitDialog, setShowSplitDialog] = React.useState(false)

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

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/work-schedule?take=1000&_t=${Date.now()}`) 
      const json = await response.json()
      if (json.records) {
        setData(json.records.map((record: any) => ({ ...record, fields: { ...record.fields } })))
        setRefreshKey(prev => prev + 1)
      }
    } catch (error) { console.error("Failed to fetch data:", error) }
  }

  const updateRecordField = async (recordId: string, fieldKey: string, value: any) => {
    try {
      const response = await fetch("/api/work-schedule", {
        method: "PATCH",
        body: JSON.stringify({ recordId, fields: { [fieldKey]: value } })
      });
      if (!response.ok) throw new Error("Update failed");
      setData(prev => prev.map(rec => rec.id === recordId ? { ...rec, fields: { ...rec.fields, [fieldKey]: value } } : rec));
    } catch (error) { toast({ title: "שגיאה בעדכון", variant: "destructive" }); fetchData(); }
  }

  const handleDeleteSelected = async () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) return;
    
    const idsToDelete = selectedRows.map(row => row.original.id)
    
    setData(prev => prev.filter(rec => !idsToDelete.includes(rec.id)))
    setRowSelection({})
    setShowDeleteDialog(false)
    
    let failCount = 0
    for (const id of idsToDelete) {
      try {
        const response = await fetch(`/api/work-schedule?id=${id}`, { method: "DELETE" })
        if (!response.ok) failCount++
      } catch { failCount++ }
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
      const totalOperations = recordsToDuplicate.length * (useDatesPerRecord ? count : datesToDuplicate.length * count)
      setDuplicateProgress({ current: 0, total: totalOperations })
      
      for (const record of recordsToDuplicate) {
        const dates = useDatesPerRecord 
          ? [record.fields.fldvNsQbfzMWTc7jakp ? new Date(record.fields.fldvNsQbfzMWTc7jakp) : new Date()]
          : datesToDuplicate

        for (const date of dates) {
          for (let i = 0; i < count; i++) {
            const newFields = { ...record.fields }
            
            newFields.fldvNsQbfzMWTc7jakp = format(date, "yyyy-MM-dd")
            newFields.fldMv14lt0W7ZBkq1PH = false
            newFields.fldDOBGATSaTi5TxyHB = false
            
            if (!copyDriver) {
              newFields.flddNPbrzOCdgS36kx5 = null
            }
            
            const response = await fetch('/api/work-schedule', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fields: newFields })
            })
            
            if (!response.ok) throw new Error('Duplicate failed')
            
            const result = await response.json()
            
            if (totalCreated === 0 && result.record) {
              firstNewRecord = result.record
            }
            
            totalCreated++
            setDuplicateProgress({ current: totalCreated, total: totalOperations })
          }
        }
      }
      
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
      
      await fetchData()
      
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

  React.useEffect(() => { fetchData() }, [])

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
      filtered = filtered.filter(item => (item.fields.fldvNsQbfzMWTc7jakp || "").startsWith(dateStr))
    }
    if (globalFilter) {
      const lowerFilter = globalFilter.toLowerCase()
      filtered = filtered.filter((item) => Object.values(item.fields).some((val) => {
           if (val == null) return false
           if (typeof val === 'object' && val.title) return String(val.title).toLowerCase().includes(lowerFilter)
           return String(val).toLowerCase().includes(lowerFilter)
      }))
    }
    return filtered
  }, [data, dateFilter, globalFilter])

  const table = useReactTable({
    data: filteredData, columns, columnResizeMode: "onChange", getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection, onColumnSizingChange: setColumnSizing,
    meta: { updateRecordField }, state: { rowSelection, columnSizing },
  })

  const totals = React.useMemo(() => {
    const rows = table.getFilteredRowModel().rows
    const totalRows = rows.length;
    const noDriver = rows.filter(r => {
        const driver = r.original.fields.flddNPbrzOCdgS36kx5;
        return !driver || (Array.isArray(driver) && driver.length === 0);
    }).length;
    const notSent = rows.filter(r => !r.original.fields.fldMv14lt0W7ZBkq1PH).length;
    const approved = rows.filter(r => !!r.original.fields.fldDOBGATSaTi5TxyHB).length;

    return {
      totalRows, noDriver, notSent, approved,
      p1: rows.reduce((sum, row) => sum + (Number(row.original.fields.fldxXnfHHQWwXY8dlEV) || 0), 0),
      p2: rows.reduce((sum, row) => sum + (Number(row.original.fields.fldT7QLSKmSrjIHarDb) || 0), 0),
      p3: rows.reduce((sum, row) => sum + (Number(row.original.fields.fldSNuxbM8oJfrQ3a9x) || 0), 0),
      p4: rows.reduce((sum, row) => sum + (Number(row.original.fields.fldyQIhjdUeQwtHMldD) || 0), 0),
      p5: rows.reduce((sum, row) => sum + (Number(row.original.fields.fldT9IZTYlT4gCEnOK3) || 0), 0),
      p6: rows.reduce((sum, row) => sum + ((Number(row.original.fields.fldT7QLSKmSrjIHarDb) || 0) - (Number(row.original.fields.fldyQIhjdUeQwtHMldD) || 0)), 0),
    }
  }, [table.getFilteredRowModel().rows])

  const selectedCount = table.getFilteredSelectedRowModel().rows.length;

  return (
    <div className="w-full h-[calc(100vh-2rem)] flex flex-col space-y-4 p-4 overflow-hidden" dir="rtl">
      <div className="flex flex-col gap-4 flex-none">
        {/* שורה אחת - הכל */}
        <div className="flex items-center gap-2">
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className="w-[200px] justify-start text-right font-normal shrink-0">
                <CalendarIcon className="ml-2 h-4 w-4" />
                {format(dateFilter, "PPP", { locale: he })}
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

          <RideDialog 
            onRideSaved={fetchData} 
            defaultDate={format(dateFilter, "yyyy-MM-dd")}
            key={`new-ride-${format(dateFilter, "yyyy-MM-dd")}`}
          />

          <Button 
            variant="outline" 
            size="icon" 
            className={cn(
                "shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors",
                selectedCount === 0 && "opacity-50"
            )}
            onClick={() => setShowDeleteDialog(true)}
            disabled={selectedCount === 0}
            title="מחק נסיעות מסומנות"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          
          <div className="flex-1 min-w-[120px]">
            <Input 
                placeholder="חיפוש..." 
                value={globalFilter} 
                onChange={(e) => setGlobalFilter(e.target.value)} 
                className="w-full h-10" 
            />
          </div>

          {/* חלון סיכום סה"כ שורות */}
          <div className="flex bg-card p-2 px-4 rounded-md border shadow-sm items-center gap-6 whitespace-nowrap">
              <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground text-xs font-medium">סה"כ שורות: <span className="font-bold text-foreground text-sm">{totals.totalRows}</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-medium">נסיעות מאושרות: <span className="font-bold text-sm">{totals.approved}</span></span>
                  </div>
              </div>

              <div className="w-px bg-border self-stretch my-1"></div>

              <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <UserMinus className="w-4 h-4" />
                      <span className="text-xs font-medium">נסיעות ללא נהג: <span className="font-bold text-sm">{totals.noDriver}</span></span>
                  </div>
                  <div className="flex items-center gap-2 text-orange-500 dark:text-orange-400">
                      <AlertCircle className="w-4 w-4" />
                      <span className="text-xs font-medium">לא נשלחו: <span className="font-bold text-sm">{totals.notSent}</span></span>
                  </div>
              </div>
          </div>

          {/* חלון סיכום מחירים */}
          <div className="flex gap-6 text-xs bg-muted/20 p-2 px-4 rounded-md border shadow-sm items-center whitespace-nowrap">
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
        </div>
      </div>
      
      <div className="rounded-md border flex-1 overflow-auto min-h-0" key={refreshKey}>
        <Table className="relative w-full" style={{ tableLayout: 'fixed' }}>
          <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan} className="text-right relative border-l select-none group hover:bg-muted/30" style={{ width: header.getSize() }}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                  </ContextMenuContent>
                </ContextMenu>
              ))
            ) : (
              <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">אין תוצאות.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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

      {/* Dialog לשכפול */}
      <Dialog open={showDuplicateDialog} onOpenChange={(open) => { setShowDuplicateDialog(open); if (!open) setBulkDuplicateRecords([]); }}>
        <DialogContent dir="rtl" className="max-w-2xl h-[85vh] flex flex-col">
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
                <LayoutDashboard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-blue-700 dark:text-blue-300">הגדרות בסיסיות</h3>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="count" className="text-right">כמה פעמים לשכפל כל תאריך?</Label>
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
                      {newDate ? format(newDate, "PPP", { locale: he }) : "בחר תאריך"}
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
              <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/50">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-bold text-blue-700 dark:text-blue-300">שכפול מתקדם (טווח תאריכים)</h3>
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
                      {startDate ? format(startDate, "PPP", { locale: he }) : "בחר תאריך"}
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
                      {endDate ? format(endDate, "PPP", { locale: he }) : "בחר תאריך"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="block">ימים בשבוע:</Label>
                  <div className="grid grid-cols-7 gap-3">
                    {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map((day, index) => (
                      <div key={index} className="flex items-center gap-1 justify-center">
                        <Label htmlFor={`day-${index}`} className="cursor-pointer text-sm">
                          {day}
                        </Label>
                        <Checkbox 
                          id={`day-${index}`}
                          checked={selectedDays[index]}
                          onCheckedChange={(checked) => {
                            const newDays = [...selectedDays]
                            newDays[index] = !!checked
                            setSelectedDays(newDays)
                          }}
                          disabled={isDuplicating}
                        />
                      </div>
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
        onOpenChange={(isOpen: boolean) => !isOpen && setEditingRecord(null)} 
        initialData={editingRecord} 
        onRideSaved={() => { setEditingRecord(null); fetchData(); }} 
        triggerChild={<span />}
        defaultDate={format(dateFilter, "yyyy-MM-dd")}
      />
      
      <SplitRideDialog 
        open={showSplitDialog} 
        onOpenChange={setShowSplitDialog} 
        record={contextRecord} 
        onSplit={fetchData} 
      />

      {/* Calendar Modal */}
      <Dialog open={calendarModal.open} onOpenChange={(open) => { if (!open) setCalendarModal(prev => ({ ...prev, open: false })) }}>
        <DialogContent dir="rtl" className="w-auto max-w-[320px] p-4 flex items-center justify-center [&>button]:hidden">
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
