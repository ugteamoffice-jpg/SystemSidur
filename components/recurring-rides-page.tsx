"use client"

import * as React from "react"
import { Plus, Pencil, Trash2, Copy, ToggleLeft, ToggleRight, Search, Filter } from "lucide-react"
import {
  ColumnDef, ColumnSizingState, ColumnOrderState,
  flexRender, getCoreRowModel, useReactTable,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useTenant, useTenantFields } from "@/lib/tenant-context"
import {
  RecurringRide, DaySettings, loadRecurringRides, addRecurringRide,
  updateRecurringRide, deleteRecurringRide, DAY_NAMES_HE, DAY_LETTERS_HE,
  EMPTY_DAY_SETTINGS
} from "@/lib/recurring-rides"

interface ListItem { id: string; title: string }

function AutoComplete({ options, value, onChange, onSelect, placeholder }: any) {
  const [show, setShow] = React.useState(false)
  const safeValue = String(value || "").toLowerCase()
  const filtered = options.filter((o: any) => String(o.title || "").toLowerCase().includes(safeValue))
  return (
    <div className="relative w-full">
      <Input value={value} onChange={e => { onChange(e.target.value); setShow(true) }}
        onBlur={() => setTimeout(() => setShow(false), 200)} onFocus={() => setShow(true)}
        className="text-right h-8 text-sm" placeholder={placeholder} />
      {show && filtered.length > 0 && (
        <div className="absolute z-50 w-full bg-white border shadow-md max-h-40 overflow-auto rounded-md mt-1 text-black">
          {filtered.map((o: any) => (
            <div key={o.id} className="p-2 hover:bg-gray-100 cursor-pointer text-right text-sm"
              onMouseDown={() => { onChange(o.title); if (onSelect) onSelect(o) }}>{o.title}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ===== Form types =====
interface FormState {
  customerName: string; customerId: string
  description: string; orderName: string; mobile: string; idNum: string
  activeDays: number[]
  defaults: DaySettings
  dayOverrides: { [day: number]: Partial<DaySettings> }
  active: boolean
}

const emptyForm: FormState = {
  customerName: "", customerId: "",
  description: "", orderName: "", mobile: "", idNum: "",
  activeDays: [0, 1, 2, 3, 4],
  defaults: { ...EMPTY_DAY_SETTINGS },
  dayOverrides: {},
  active: true,
}

export function RecurringRidesPage() {
  const { tenantId } = useTenant()
  const { toast } = useToast()

  const [rides, setRides] = React.useState<RecurringRide[]>([])
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<FormState>({ ...emptyForm })
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null)
  const [searchFilter, setSearchFilter] = React.useState("")
  const [activeFilter, setActiveFilter] = React.useState<"all" | "active" | "inactive">("all")
  const [isResizing, setIsResizing] = React.useState(false)

  const COL_SIZE_KEY = `recurringRidesColSize_${tenantId}`
  const COL_ORDER_KEY = `recurringRidesColOrder_${tenantId}`

  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(() => {
    try { const s = localStorage.getItem(COL_SIZE_KEY); return s ? JSON.parse(s) : {} } catch { return {} }
  })
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(() => {
    try {
      const s = localStorage.getItem(COL_ORDER_KEY)
      if (s) {
        const saved = JSON.parse(s)
        // Reset if old column IDs detected
        if (saved.includes("time") || saved.includes("price") || !saved.includes("pickup")) {
          localStorage.removeItem(COL_ORDER_KEY)
          return []
        }
        return saved
      }
      return []
    } catch { return [] }
  })

  React.useEffect(() => {
    if (Object.keys(columnSizing).length > 0) {
      try { localStorage.setItem(COL_SIZE_KEY, JSON.stringify(columnSizing)) } catch {}
    }
  }, [columnSizing])

  React.useEffect(() => {
    if (columnOrder.length > 0) {
      try { localStorage.setItem(COL_ORDER_KEY, JSON.stringify(columnOrder)) } catch {}
    }
  }, [columnOrder])

  const [lists, setLists] = React.useState<{ customers: ListItem[], drivers: ListItem[], vehicles: ListItem[] }>({
    customers: [], drivers: [], vehicles: []
  })

  React.useEffect(() => { setRides(loadRecurringRides(tenantId)) }, [tenantId])

  React.useEffect(() => {
    const load = async (url: string) => {
      try {
        const r = await fetch(url); const d = await r.json()
        return d.records ? d.records.map((x: any) => ({
          id: x.id, title: x.fields && Object.values(x.fields)[0] ? String(Object.values(x.fields)[0]) : ""
        })) : []
      } catch { return [] }
    }
    Promise.all([
      load(`/api/customers?tenant=${tenantId}`),
      load(`/api/drivers?tenant=${tenantId}`),
      load(`/api/vehicles?tenant=${tenantId}`)
    ]).then(([c, d, v]) => setLists({ customers: c, drivers: d, vehicles: v }))
  }, [tenantId])

  const reload = () => setRides(loadRecurringRides(tenantId))

  const openNew = () => {
    setEditingId(null)
    setForm({ ...emptyForm, defaults: { ...EMPTY_DAY_SETTINGS }, dayOverrides: {} })
    setDialogOpen(true)
  }

  const openEdit = (ride: RecurringRide) => {
    setEditingId(ride.id)
    setForm({
      customerName: ride.customerName, customerId: ride.customerId,
      description: ride.description, orderName: ride.orderName,
      mobile: ride.mobile, idNum: ride.idNum,
      activeDays: [...ride.activeDays],
      defaults: { ...ride.defaults },
      dayOverrides: JSON.parse(JSON.stringify(ride.dayOverrides)),
      active: ride.active,
    })
    setDialogOpen(true)
  }

  const handleDuplicate = (ride: RecurringRide) => {
    const { id, createdAt, updatedAt, ...rest } = ride
    addRecurringRide(tenantId, { ...rest, active: true })
    reload()
    toast({ title: "שוכפל בהצלחה" })
  }

  const handleDelete = (id: string) => {
    deleteRecurringRide(tenantId, id)
    reload()
    setDeleteConfirm(null)
    toast({ title: "נמחק בהצלחה" })
  }

  const handleToggle = (ride: RecurringRide) => {
    updateRecurringRide(tenantId, ride.id, { active: !ride.active })
    reload()
  }

  const handleSave = () => {
    if (!form.customerName || !form.description) {
      toast({ title: "שגיאה", description: "יש למלא לקוח ומסלול", variant: "destructive" })
      return
    }
    if (!form.defaults.pickupTime) {
      toast({ title: "שגיאה", description: "יש למלא שעת התייצבות", variant: "destructive" })
      return
    }
    if (form.activeDays.length === 0) {
      toast({ title: "שגיאה", description: "יש לבחור לפחות יום אחד", variant: "destructive" })
      return
    }

    const data: Omit<RecurringRide, "id" | "createdAt" | "updatedAt"> = {
      customerName: form.customerName, customerId: form.customerId,
      description: form.description, orderName: form.orderName,
      mobile: form.mobile, idNum: form.idNum,
      activeDays: form.activeDays, defaults: form.defaults,
      dayOverrides: form.dayOverrides, active: form.active,
    }

    if (editingId) {
      updateRecurringRide(tenantId, editingId, data)
      toast({ title: "עודכן בהצלחה" })
    } else {
      addRecurringRide(tenantId, data)
      toast({ title: "נוסף בהצלחה" })
    }
    setDialogOpen(false)
    reload()
  }

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      activeDays: prev.activeDays.includes(day)
        ? prev.activeDays.filter(d => d !== day)
        : [...prev.activeDays, day].sort()
    }))
  }

  const calcVat = (value: string, type: "excl" | "incl", side: "client" | "driver", target: any) => {
    const numVal = parseFloat(value)
    const rate = 1.18
    const updated = { ...target }
    if (isNaN(numVal)) {
      if (side === "client") { updated.clientExcl = ""; updated.clientIncl = "" }
      else { updated.driverExcl = ""; updated.driverIncl = "" }
      return updated
    }
    if (type === "excl") {
      const incl = (numVal * rate).toFixed(2)
      if (side === "client") { updated.clientExcl = value; updated.clientIncl = incl }
      else { updated.driverExcl = value; updated.driverIncl = incl }
    } else {
      const excl = (numVal / rate).toFixed(2)
      if (side === "client") { updated.clientIncl = value; updated.clientExcl = excl }
      else { updated.driverIncl = value; updated.driverExcl = excl }
    }
    return updated
  }

  // Get effective value for a day field (override or default)
  const getDayVal = (day: number, field: keyof DaySettings): string => {
    const override = form.dayOverrides[day]
    if (override && override[field] !== undefined && override[field] !== "") return override[field] as string
    return form.defaults[field]
  }

  const setDayOverride = (day: number, field: string, value: string) => {
    setForm(prev => {
      const current = prev.dayOverrides[day] || {}
      return { ...prev, dayOverrides: { ...prev.dayOverrides, [day]: { ...current, [field]: value } } }
    })
  }

  const setDayVat = (day: number, value: string, type: "excl" | "incl", side: "client" | "driver") => {
    setForm(prev => {
      const current = prev.dayOverrides[day] || {}
      const updated = calcVat(value, type, side, {
        clientExcl: current.clientExcl ?? prev.defaults.clientExcl,
        clientIncl: current.clientIncl ?? prev.defaults.clientIncl,
        driverExcl: current.driverExcl ?? prev.defaults.driverExcl,
        driverIncl: current.driverIncl ?? prev.defaults.driverIncl,
      })
      return { ...prev, dayOverrides: { ...prev.dayOverrides, [day]: { ...current, ...updated } } }
    })
  }

  const clearDayOverride = (day: number) => {
    setForm(prev => {
      const newOverrides = { ...prev.dayOverrides }
      delete newOverrides[day]
      return { ...prev, dayOverrides: newOverrides }
    })
  }

  // Render per-day settings section
  const renderDaySettings = (day: number) => {
    const hasOverride = form.dayOverrides[day] && Object.keys(form.dayOverrides[day]).length > 0
    return (
      <div key={day} className="border rounded-lg p-3 space-y-3 bg-white">
        <div className="flex items-center justify-between">
          <span className="font-bold">יום {DAY_NAMES_HE[day]}</span>
          {hasOverride && (
            <button onClick={() => clearDayOverride(day)}
              className="text-xs text-red-500 hover:underline">
              אפס לברירת מחדל
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">שעת התייצבות</Label>
            <Input type="time" value={getDayVal(day, "pickupTime")}
              onChange={e => setDayOverride(day, "pickupTime", e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">שעת חזור</Label>
            <Input type="time" value={getDayVal(day, "dropoffTime")}
              onChange={e => setDayOverride(day, "dropoffTime", e.target.value)} className="h-9" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">סוג רכב</Label>
            <AutoComplete options={lists.vehicles} value={getDayVal(day, "vehicleTypeName")}
              onChange={(v: string) => setDayOverride(day, "vehicleTypeName", v)}
              onSelect={(o: ListItem) => { setDayOverride(day, "vehicleTypeName", o.title); setDayOverride(day, "vehicleTypeId", o.id) }}
              placeholder="" />
          </div>
          <div>
            <Label className="text-xs">נהג</Label>
            <AutoComplete options={lists.drivers} value={getDayVal(day, "driverName")}
              onChange={(v: string) => setDayOverride(day, "driverName", v)}
              onSelect={(o: ListItem) => { setDayOverride(day, "driverName", o.title); setDayOverride(day, "driverId", o.id) }}
              placeholder="" />
          </div>
          <div>
            <Label className="text-xs">מס׳ רכב</Label>
            <Input value={getDayVal(day, "vehicleNum")}
              onChange={e => setDayOverride(day, "vehicleNum", e.target.value)} className="h-8 text-sm text-right" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div>
            <Label className="text-xs">מחיר לקוח לפני מע״מ</Label>
            <Input type="number" value={getDayVal(day, "clientExcl")}
              onChange={e => setDayVat(day, e.target.value, "excl", "client")} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">מחיר לקוח כולל מע״מ</Label>
            <Input type="number" value={getDayVal(day, "clientIncl")}
              onChange={e => setDayVat(day, e.target.value, "incl", "client")} className="h-9 font-bold" />
          </div>
          <div>
            <Label className="text-xs">מחיר נהג לפני מע״מ</Label>
            <Input type="number" value={getDayVal(day, "driverExcl")}
              onChange={e => setDayVat(day, e.target.value, "excl", "driver")} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">מחיר נהג כולל מע״מ</Label>
            <Input type="number" value={getDayVal(day, "driverIncl")}
              onChange={e => setDayVat(day, e.target.value, "incl", "driver")} className="h-9 font-bold" />
          </div>
        </div>
      </div>
    )
  }

  const filteredRides = React.useMemo(() => rides.filter(r => {
    if (activeFilter === "active" && !r.active) return false
    if (activeFilter === "inactive" && r.active) return false
    if (!searchFilter) return true
    const q = searchFilter.toLowerCase()
    return r.customerName.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.defaults.driverName.toLowerCase().includes(q)
  }), [rides, searchFilter, activeFilter])

  const activeCount = rides.filter(r => r.active).length

  // Tanstack columns
  const columns = React.useMemo<ColumnDef<RecurringRide, any>[]>(() => [
    {
      id: "status", header: "סטטוס", size: 65, minSize: 50, enableResizing: true,
      cell: ({ row }) => (
        <button onClick={(e) => { e.stopPropagation(); handleToggle(row.original) }} title={row.original.active ? "פעיל" : "מושבת"}>
          {row.original.active ? <ToggleRight className="h-6 w-6 text-green-600" /> : <ToggleLeft className="h-6 w-6 text-gray-400" />}
        </button>
      ),
    },
    {
      id: "customer", header: "שם לקוח", size: 130, minSize: 60, enableResizing: true,
      cell: ({ row }) => <span className="font-medium">{row.original.customerName}</span>,
    },
    {
      id: "pickup", header: "התייצבות", size: 80, minSize: 55, enableResizing: true,
      cell: ({ row }) => row.original.defaults.pickupTime || "-",
    },
    {
      id: "description", header: "מסלול", size: 400, minSize: 100, enableResizing: true,
      cell: ({ row }) => <span className="truncate block" title={row.original.description}>{row.original.description}</span>,
    },
    {
      id: "dropoff", header: "חזור", size: 70, minSize: 50, enableResizing: true,
      cell: ({ row }) => row.original.defaults.dropoffTime || "-",
    },
    {
      id: "vehicle", header: "סוג רכב", size: 100, minSize: 60, enableResizing: true,
      cell: ({ row }) => row.original.defaults.vehicleTypeName || "-",
    },
    {
      id: "driver", header: "שם נהג", size: 110, minSize: 60, enableResizing: true,
      cell: ({ row }) => row.original.defaults.driverName || "-",
    },
    {
      id: "clientExcl", header: 'מחיר לקוח + מע"מ', size: 120, minSize: 70, enableResizing: true,
      cell: ({ row }) => row.original.defaults.clientExcl ? `₪${row.original.defaults.clientExcl}` : "-",
    },
    {
      id: "clientIncl", header: 'מחיר לקוח כולל מע"מ', size: 130, minSize: 70, enableResizing: true,
      cell: ({ row }) => row.original.defaults.clientIncl ? `₪${row.original.defaults.clientIncl}` : "-",
    },
    {
      id: "driverExcl", header: 'מחיר נהג + מע"מ', size: 120, minSize: 70, enableResizing: true,
      cell: ({ row }) => row.original.defaults.driverExcl ? `₪${row.original.defaults.driverExcl}` : "-",
    },
    {
      id: "driverIncl", header: 'מחיר נהג כולל מע"מ', size: 130, minSize: 70, enableResizing: true,
      cell: ({ row }) => row.original.defaults.driverIncl ? `₪${row.original.defaults.driverIncl}` : "-",
    },
    {
      id: "days", header: "ימים", size: 120, minSize: 80, enableResizing: true,
      cell: ({ row }) => (
        <div className="flex gap-0.5">
          {[0, 1, 2, 3, 4, 5, 6].map(d => (
            <span key={d} className={`text-[10px] w-5 h-5 flex items-center justify-center rounded ${
              row.original.activeDays.includes(d) ? "bg-blue-100 text-blue-700 font-bold" : "text-gray-300"
            }`}>{DAY_LETTERS_HE[d]}</span>
          ))}
        </div>
      ),
    },
    {
      id: "actions", header: "פעולות", size: 100, minSize: 80, enableResizing: false,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEdit(row.original) }} className="p-1 hover:bg-muted rounded" title="ערוך"><Pencil className="h-4 w-4" /></button>
          <button onClick={(e) => { e.stopPropagation(); handleDuplicate(row.original) }} className="p-1 hover:bg-muted rounded" title="שכפל"><Copy className="h-4 w-4" /></button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(row.original.id) }} className="p-1 hover:bg-red-50 rounded text-red-500" title="מחק"><Trash2 className="h-4 w-4" /></button>
        </div>
      ),
    },
  ], [])

  const table = useReactTable({
    data: filteredRides, columns, columnResizeMode: "onChange", getCoreRowModel: getCoreRowModel(),
    onColumnSizingChange: setColumnSizing, onColumnOrderChange: setColumnOrder,
    state: { columnSizing, columnOrder },
  })

  // Drag to reorder columns
  const [draggedCol, setDraggedCol] = React.useState<string | null>(null)

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4" dir="rtl">
      {/* Header row */}
      <div className="flex items-center gap-3 mb-3">
        <Button onClick={openNew} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" /> צור נסיעה קבועה
        </Button>

        <div className="flex gap-1 shrink-0">
          {(["active", "inactive"] as const).map(f => (
            <Button key={f} variant={activeFilter === f ? "default" : "outline"} size="sm"
              className="text-xs h-9 px-3" onClick={() => setActiveFilter(prev => prev === f ? "all" : f)}>
              {f === "active" ? "פעילות" : "לא פעילות"}
            </Button>
          ))}
        </div>

        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
            placeholder="חיפוש לקוח, מסלול, נהג..." className="pr-9 text-right h-9" />
        </div>

        <span className="text-sm text-muted-foreground shrink-0">סה״כ {rides.length} מסלולים ({activeCount} פעילים)</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto border rounded-lg">
        <Table style={{ width: "100%", minWidth: table.getCenterTotalSize() }}>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id}
                    className="text-right relative border-l select-none"
                    style={{ width: header.getSize() }}
                    draggable={header.column.id !== "actions"}
                    onDragStart={() => setDraggedCol(header.column.id)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => {
                      if (draggedCol && draggedCol !== header.column.id) {
                        const currentOrder = table.getState().columnOrder.length
                          ? [...table.getState().columnOrder]
                          : columns.map(c => c.id!)
                        const fromIdx = currentOrder.indexOf(draggedCol)
                        const toIdx = currentOrder.indexOf(header.column.id)
                        if (fromIdx !== -1 && toIdx !== -1) {
                          currentOrder.splice(fromIdx, 1)
                          currentOrder.splice(toIdx, 0, draggedCol)
                          setColumnOrder(currentOrder)
                        }
                      }
                      setDraggedCol(null)
                    }}
                  >
                    <div className="flex items-center gap-1 cursor-grab">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </div>
                    {header.column.getCanResize() && (
                      <div onMouseDown={(e) => {
                        e.stopPropagation(); e.preventDefault(); setIsResizing(true)
                        const startX = e.clientX; const startWidth = header.getSize()
                        const onMouseMove = (me: MouseEvent) => {
                          const newWidth = Math.max(header.column.columnDef.minSize || 50, startWidth + (startX - me.clientX))
                          setColumnSizing(old => ({ ...old, [header.id]: newWidth }))
                        }
                        const onMouseUp = () => { setIsResizing(false); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp) }
                        document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp)
                      }} className="absolute left-0 top-0 h-full w-1 cursor-col-resize touch-none select-none z-20 hover:bg-primary transition-colors duration-200" />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {rides.length === 0 ? "אין נסיעות קבועות. לחץ \"צור נסיעה קבועה\" כדי להוסיף." : "לא נמצאו תוצאות"}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id} className={`cursor-pointer hover:bg-muted/50 ${!row.original.active ? "opacity-40" : ""}`}
                  onClick={() => openEdit(row.original)}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className="text-right truncate border-l text-sm"
                      style={{ width: cell.column.getSize() }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[700px] h-[85vh] flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId ? "עריכת נסיעה קבועה" : "נסיעה קבועה חדשה"}</DialogTitle>
            <DialogDescription>נסיעה קבועה שתשובץ אוטומטית</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">פרטים</TabsTrigger>
              <TabsTrigger value="schedule">שיבוץ לפי יום</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto p-1 mt-2">
              {/* Tab: פרטים */}
              <TabsContent value="details" className="space-y-3 mt-0">
                <div className="space-y-1">
                  <Label>שם לקוח *</Label>
                  <AutoComplete options={lists.customers} value={form.customerName}
                    onChange={(v: string) => setForm(p => ({ ...p, customerName: v, customerId: "" }))}
                    onSelect={(o: ListItem) => setForm(p => ({ ...p, customerName: o.title, customerId: o.id }))}
                    placeholder="" />
                </div>
                <div className="space-y-1">
                  <Label>תיאור (מסלול) *</Label>
                  <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="text-right" />
                </div>

                {/* ברירת מחדל */}
                <div className="border-t pt-3 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">ברירת מחדל (לכל הימים)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>שעת התייצבות</Label>
                      <Input type="time" value={form.defaults.pickupTime}
                        onChange={e => setForm(p => ({ ...p, defaults: { ...p.defaults, pickupTime: e.target.value } }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>שעת חזור</Label>
                      <Input type="time" value={form.defaults.dropoffTime}
                        onChange={e => setForm(p => ({ ...p, defaults: { ...p.defaults, dropoffTime: e.target.value } }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label>סוג רכב</Label>
                      <AutoComplete options={lists.vehicles} value={form.defaults.vehicleTypeName}
                        onChange={(v: string) => setForm(p => ({ ...p, defaults: { ...p.defaults, vehicleTypeName: v, vehicleTypeId: "" } }))}
                        onSelect={(o: ListItem) => setForm(p => ({ ...p, defaults: { ...p.defaults, vehicleTypeName: o.title, vehicleTypeId: o.id } }))}
                        placeholder="" />
                    </div>
                    <div className="space-y-1">
                      <Label>נהג</Label>
                      <AutoComplete options={lists.drivers} value={form.defaults.driverName}
                        onChange={(v: string) => setForm(p => ({ ...p, defaults: { ...p.defaults, driverName: v, driverId: "" } }))}
                        onSelect={(o: ListItem) => setForm(p => ({ ...p, defaults: { ...p.defaults, driverName: o.title, driverId: o.id } }))}
                        placeholder="" />
                    </div>
                    <div className="space-y-1">
                      <Label>מס׳ רכב</Label>
                      <Input value={form.defaults.vehicleNum}
                        onChange={e => setForm(p => ({ ...p, defaults: { ...p.defaults, vehicleNum: e.target.value } }))} className="text-right" />
                    </div>
                  </div>
                  {/* מחירים ברירת מחדל */}
                  <div className="grid grid-cols-4 gap-2">
                    <div><Label className="text-xs">מחיר לקוח לפני מע״מ</Label><Input type="number" value={form.defaults.clientExcl}
                      onChange={e => setForm(p => ({ ...p, defaults: calcVat(e.target.value, "excl", "client", p.defaults) }))} className="h-8 text-sm" /></div>
                    <div><Label className="text-xs">מחיר לקוח כולל מע״מ</Label><Input type="number" value={form.defaults.clientIncl}
                      onChange={e => setForm(p => ({ ...p, defaults: calcVat(e.target.value, "incl", "client", p.defaults) }))} className="h-8 text-sm font-bold" /></div>
                    <div><Label className="text-xs">מחיר נהג לפני מע״מ</Label><Input type="number" value={form.defaults.driverExcl}
                      onChange={e => setForm(p => ({ ...p, defaults: calcVat(e.target.value, "excl", "driver", p.defaults) }))} className="h-8 text-sm" /></div>
                    <div><Label className="text-xs">מחיר נהג כולל מע״מ</Label><Input type="number" value={form.defaults.driverIncl}
                      onChange={e => setForm(p => ({ ...p, defaults: calcVat(e.target.value, "incl", "driver", p.defaults) }))} className="h-8 text-sm font-bold" /></div>
                  </div>
                  <div className="space-y-1">
                    <Label>הערות מנהל</Label>
                    <Textarea value={form.defaults.managerNotes}
                      onChange={e => setForm(p => ({ ...p, defaults: { ...p.defaults, managerNotes: e.target.value } }))} className="text-right" rows={2} />
                  </div>
                  <div className="space-y-1">
                    <Label>הערות נהג</Label>
                    <Textarea value={form.defaults.driverNotes}
                      onChange={e => setForm(p => ({ ...p, defaults: { ...p.defaults, driverNotes: e.target.value } }))} className="text-right" rows={2} />
                  </div>
                </div>

                {/* פרטי מזמין */}
                <div className="border-t pt-3 grid grid-cols-3 gap-3">
                  <div className="space-y-1"><Label>שם מזמין</Label><Input value={form.orderName}
                    onChange={e => setForm(p => ({ ...p, orderName: e.target.value }))} className="text-right" /></div>
                  <div className="space-y-1"><Label>נייד</Label><Input value={form.mobile}
                    onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} className="text-right" /></div>
                  <div className="space-y-1"><Label>ת.ז</Label><Input value={form.idNum}
                    onChange={e => setForm(p => ({ ...p, idNum: e.target.value }))} className="text-right" /></div>
                </div>
              </TabsContent>

              {/* Tab: שיבוץ לפי יום */}
              <TabsContent value="schedule" className="space-y-3 mt-0">
                {/* Day Selection */}
                <div>
                  <p className="text-sm font-medium mb-2">ימים פעילים</p>
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3, 4, 5, 6].map(d => (
                      <button key={d} type="button" onClick={() => toggleDay(d)}
                        className={`flex flex-col items-center py-2 px-3 rounded-lg border-2 transition-all text-xs ${
                          form.activeDays.includes(d) ? "border-blue-500 bg-blue-50 text-blue-700 font-bold" : "border-gray-200 text-gray-400 hover:border-gray-300"
                        }`}>
                        <span>{DAY_LETTERS_HE[d]}</span>
                      </button>
                    ))}
                    <div className="flex gap-1 mr-2 items-center">
                      <Button type="button" variant="ghost" size="sm" className="text-[10px] h-6 px-2"
                        onClick={() => setForm(p => ({ ...p, activeDays: [0, 1, 2, 3, 4] }))}>א-ה</Button>
                      <Button type="button" variant="ghost" size="sm" className="text-[10px] h-6 px-2"
                        onClick={() => setForm(p => ({ ...p, activeDays: [0, 1, 2, 3, 4, 5, 6] }))}>הכל</Button>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3" />
                <p className="text-xs text-muted-foreground">שנה ערכים ליום ספציפי. שדות ריקים ישתמשו בברירת מחדל מטאב "פרטים".</p>

                {/* Per-day settings */}
                <div className="space-y-2">
                  {form.activeDays.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">בחר ימים למעלה</p>
                  ) : (
                    form.activeDays.map(d => renderDaySettings(d))
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="flex-row-reverse gap-2 mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ביטול</Button>
            <Button onClick={handleSave}>{editingId ? "עדכן" : "הוסף"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent dir="rtl" className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>מחיקת תבנית</DialogTitle>
            <DialogDescription>האם אתה בטוח שברצונך למחוק את התבנית הזו?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>ביטול</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>מחק</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
