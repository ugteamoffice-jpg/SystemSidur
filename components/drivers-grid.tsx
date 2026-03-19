"use client"

import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Plus, Search, Loader2, Trash2, Car, ChevronDown, X, Settings2, Upload, FileText, Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useTenantFields, useTenant, useTenantTables } from "@/lib/tenant-context"
import { format } from "date-fns"

interface Driver {
  id: string
  fields: { [key: string]: any }
}

interface CompanyVehicle {
  id: string
  fields: { [key: string]: any }
}

export default function DriversGrid() {
  const tenantFields = useTenantFields()
  const { tenantId } = useTenant()
  const tenantTables = useTenantTables()
  const STATUS_FIELD_ID = tenantFields?.drivers.STATUS || ""
  const FIRST_NAME_ID = tenantFields?.drivers.FIRST_NAME || ""
  const PHONE_ID = tenantFields?.drivers.PHONE || ""
  const DRIVER_TYPE_ID = tenantFields?.drivers.DRIVER_TYPE || ""
  const CAR_NUMBER_ID = tenantFields?.drivers.CAR_NUMBER || ""
  const SALARY_CONFIG_ID = (tenantFields?.drivers as any)?.SALARY_CONFIG || ""

  // Salary config state
  const [salaryConfig, setSalaryConfig] = useState<any>(null)

  const defaultSalaryConfig = () => ({
    type: "hourly",
    grossOrNet: "gross",
    baseRate: 45,
    baseHours: 8,
    minimumHours: 0,
    tiers: [
      { upToHours: 8,   percentage: 100, label: "שעות בסיס" },
      { upToHours: 2,   percentage: 125, label: "שעות נוספות" },
      { upToHours: null, percentage: 150, label: "מעל הכל" }
    ],
    dailyFixedRate: 0,
    shabbatMultiplier: 150,
    travelAllowance: 0
  })
  const CV_CAR_NUMBER = tenantFields?.companyVehicles?.CAR_NUMBER || ""
  const CV_MAKE_MODEL = tenantFields?.companyVehicles?.MAKE_MODEL || ""

  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"פעיל" | "לא פעיל">("פעיל")
  const [phoneError, setPhoneError] = useState("")
  const [carNumberError, setCarNumberError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const { toast } = useToast()

  // רכבי חברה
  const [companyVehicles, setCompanyVehicles] = useState<CompanyVehicle[]>([])
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false)

  // דיאלוג עדכון נסיעות עתידיות
  const [futureRidesDialog, setFutureRidesDialog] = useState(false)
  const [futureRidesCount, setFutureRidesCount] = useState(0)
  const [futureRidesList, setFutureRidesList] = useState<any[]>([])
  const [pendingSaveFields, setPendingSaveFields] = useState<any>(null)
  const [isUpdatingFuture, setIsUpdatingFuture] = useState(false)
  const [contractFile, setContractFile] = useState<File | null>(null)
  const contractFileRef = useRef<HTMLInputElement>(null)

  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)
  const tableContainerRef = useRef<HTMLDivElement>(null)

  const ROW_HEIGHT = 53
  const BUFFER_SIZE = 10

  const DRIVERS_COL_SIZING_KEY = `driversColumnSizing_${tenantId}`
  const DRIVERS_COL_ORDER_KEY = `driversColumnOrder_${tenantId}`
  const getDriverStatus = (driver: Driver) => driver.fields[STATUS_FIELD_ID] || "פעיל"
  const driverColumns = [
    { key: 'firstName', header: 'שם מלא / שם חברה', fieldKey: FIRST_NAME_ID, defaultWidth: 200, minWidth: 100, render: (d: Driver) => <span className="font-medium">{d.fields[FIRST_NAME_ID] || "-"}</span> },
    { key: 'phone', header: 'טלפון נייד', fieldKey: PHONE_ID, defaultWidth: 140, minWidth: 80, render: (d: Driver) => d.fields[PHONE_ID] || "-" },
    { key: 'type', header: 'סוג נהג', fieldKey: DRIVER_TYPE_ID, defaultWidth: 120, minWidth: 80, render: (d: Driver) => d.fields[DRIVER_TYPE_ID] || "-" },
    { key: 'carNumber', header: 'מספר רכב', fieldKey: CAR_NUMBER_ID, defaultWidth: 140, minWidth: 80, render: (d: Driver) => d.fields[CAR_NUMBER_ID] || "-" },
    { key: 'status', header: 'סטטוס', fieldKey: STATUS_FIELD_ID, defaultWidth: 100, minWidth: 70, render: (d: Driver) => <span className={`px-2 py-1 rounded-full text-xs ${getDriverStatus(d) === 'פעיל' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{getDriverStatus(d)}</span> },
  ]

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(DRIVERS_COL_SIZING_KEY)
        if (saved) return JSON.parse(saved)
      } catch (e) {}
    }
    return {}
  })

  useEffect(() => {
    if (typeof window !== 'undefined' && Object.keys(columnWidths).length > 0) {
      try { localStorage.setItem(DRIVERS_COL_SIZING_KEY, JSON.stringify(columnWidths)) } catch (e) {}
    }
  }, [columnWidths])

  const getColWidth = (col: typeof driverColumns[0]) => columnWidths[col.key] || col.defaultWidth

  const handleResizeStart = (colKey: string, minWidth: number, e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    const startX = e.clientX
    const startWidth = columnWidths[colKey] || driverColumns.find(c => c.key === colKey)!.defaultWidth
    const onMouseMove = (me: MouseEvent) => {
      const newWidth = Math.max(minWidth, startWidth + (startX - me.clientX))
      setColumnWidths(old => ({ ...old, [colKey]: newWidth }))
    }
    const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp) }
    document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp)
  }

  // Sort
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      return { key, direction: 'asc' }
    })
  }

  // Column order
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try { const s = localStorage.getItem(DRIVERS_COL_ORDER_KEY); if (s) return JSON.parse(s) } catch {}
    }
    return driverColumns.map(c => c.key)
  })
  useEffect(() => {
    if (typeof window !== 'undefined' && columnOrder.length > 0) {
      try { localStorage.setItem(DRIVERS_COL_ORDER_KEY, JSON.stringify(columnOrder)) } catch {}
    }
  }, [columnOrder])
  const [draggingColId, setDraggingColId] = useState<string | null>(null)

  const displayColumns = columnOrder.map(k => driverColumns.find(c => c.key === k)!).filter(Boolean)

  useEffect(() => {
    fetchDrivers()
    fetchCompanyVehicles()
  }, [])

  const fetchDrivers = async () => {
    setIsLoading(true)
    setDrivers([])
    try {
      const response = await fetch(`/api/drivers?tenant=${tenantId}`);
      if (!response.ok) throw new Error("Fetch failed");
      const data = await response.json();
      setDrivers(data.records || []);
    } catch (error) {
      console.error("Error fetching drivers:", error)
      toast({ title: "שגיאה בטעינה", description: "חלק מהנתונים אולי לא נטענו", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCompanyVehicles = async () => {
    try {
      const res = await fetch(`/api/company-vehicles?tenant=${tenantId}`)
      const data = await res.json()
      if (!data.notConfigured) setCompanyVehicles(data.records || [])
    } catch { /* שגיאה שקטה */ }
  }

  // שליפת נסיעות עתידיות של הנהג (מהיום והלאה)
  const fetchFutureRidesForDriver = async (driverId: string): Promise<any[]> => {
    try {
      const WS_DRIVER = tenantFields?.workSchedule?.DRIVER || ""
      const WS_DATE = tenantFields?.workSchedule?.DATE || ""
      const today = format(new Date(), "yyyy-MM-dd")
      // שולפים נסיעות של היום ואחריו — מסננים לפי נהג בצד הלקוח
      const res = await fetch(`/api/work-schedule?tenant=${tenantId}&take=2000`)
      if (!res.ok) return []
      const data = await res.json()
      const records: any[] = data.records || []
      return records.filter(r => {
        const d = r.fields[WS_DRIVER]
        const driverMatch = Array.isArray(d) ? d.some((x: any) => x?.id === driverId) : false
        const dateStr = r.fields[WS_DATE]
        const rideDate = dateStr ? dateStr.split("T")[0] : ""
        return driverMatch && rideDate >= today
      })
    } catch { return [] }
  }

  const uploadContractFile = async (recordId: string) => {
    const DRV = (tenantFields as any)?.drivers
    if (!contractFile || !DRV?.CONTRACT) return
    const fd = new FormData()
    fd.append("file", contractFile)
    fd.append("tableId", (tenantTables as any)?.DRIVERS || "")
    fd.append("recordId", recordId)
    fd.append("fieldId", DRV.CONTRACT)
    await fetch(`/api/upload-to-record?tenant=${tenantId}`, { method: "POST", body: fd })
  }

  const handleCreateDriver = async () => {
    try {
      const filteredFields = Object.entries(newDriver).reduce((acc, [key, value]) => {
        if (value !== "" && value !== undefined && value !== null) acc[key] = value
        return acc
      }, {} as any)
      filteredFields[STATUS_FIELD_ID] = "פעיל"
      const response = await fetch(`/api/drivers?tenant=${tenantId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: filteredFields }) })
      if (!response.ok) throw new Error("Failed")
      const created = await response.json()
      const newId = created?.records?.[0]?.id || created?.id
      if (newId) await uploadContractFile(newId)
      toast({ title: "הצלחה", description: "נוצר בהצלחה" })
      setIsDialogOpen(false); setContractFile(null); resetForm(); fetchDrivers();
    } catch (error) { toast({ title: "שגיאה", description: "נכשל", variant: "destructive" }) }
  }

  const handleUpdateDriver = async () => {
    if (!editingDriverId) return
    try {
      const filteredFields = Object.entries(newDriver).reduce((acc, [key, value]) => {
        if (value !== "" && value !== undefined && value !== null) acc[key] = value
        return acc
      }, {} as any)

      // האם מספר הרכב השתנה?
      const currentDriver = drivers.find(d => d.id === editingDriverId)
      const oldCarNumber = currentDriver?.fields[CAR_NUMBER_ID] || ""
      const newCarNumber = filteredFields[CAR_NUMBER_ID] || ""
      const carChanged = newCarNumber && newCarNumber !== oldCarNumber

      if (carChanged) {
        // בדוק נסיעות עתידיות
        const futureRides = await fetchFutureRidesForDriver(editingDriverId)
        if (futureRides.length > 0) {
          setFutureRidesList(futureRides)
          setFutureRidesCount(futureRides.length)
          setPendingSaveFields(filteredFields)
          setFutureRidesDialog(true)
          return // עצור — ממתין לתשובת המשתמש
        }
      }

      // שמור הגדרות שכר אם שכיר
      if (filteredFields[DRIVER_TYPE_ID] === "שכיר" && salaryConfig) {
        filteredFields[SALARY_CONFIG_ID] = JSON.stringify(salaryConfig)
      } else if (filteredFields[DRIVER_TYPE_ID] !== "שכיר") {
        filteredFields[SALARY_CONFIG_ID] = ""
      }

      // שמור ישירות
      await saveDriverAndOptionalRides(filteredFields, [])
    } catch (error) { toast({ title: "שגיאה", description: "נכשל", variant: "destructive" }) }
  }

  const saveDriverAndOptionalRides = async (fields: any, ridesToUpdate: any[]) => {
    try {
      // 1. עדכן נהג
      const res = await fetch(`/api/drivers?tenant=${tenantId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: editingDriverId, fields })
      })
      if (!res.ok) throw new Error("Failed")

      // 2. עדכן נסיעות עתידיות אם נבחר
      if (ridesToUpdate.length > 0) {
        setIsUpdatingFuture(true)
        const WS_VEHICLE_NUM = tenantFields?.workSchedule?.VEHICLE_NUM || ""
        const newCarNumber = fields[CAR_NUMBER_ID] || ""
        // Batch PATCH — 50 נסיעות בכל קריאה
        const chunks = []
        for (let i = 0; i < ridesToUpdate.length; i += 50) chunks.push(ridesToUpdate.slice(i, i + 50))
        for (const chunk of chunks) {
          const records = chunk.map((r: any) => ({ id: r.id, fields: { [WS_VEHICLE_NUM]: newCarNumber } }))
          await fetch(`/api/work-schedule?tenant=${tenantId}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ records })
          })
        }
        setIsUpdatingFuture(false)
        toast({ title: "הצלחה", description: `הנהג ו-${ridesToUpdate.length} נסיעות עתידיות עודכנו` })
      } else {
        toast({ title: "הצלחה", description: "עודכן בהצלחה" })
      }

      if (editingDriverId) await uploadContractFile(editingDriverId)
      setContractFile(null)
      setIsDialogOpen(false); setEditingDriverId(null); resetForm(); setFutureRidesDialog(false); setPendingSaveFields(null)
      fetchDrivers()
    } catch { toast({ title: "שגיאה", description: "נכשל", variant: "destructive" }) }
  }

  const handlePermanentDelete = async () => {
    if (!editingDriverId) return
    try {
      const response = await fetch(`/api/drivers?tenant=${tenantId}&recordId=${editingDriverId}`, { method: "DELETE" })
      if (!response.ok) throw new Error("Failed")
      toast({ title: "הצלחה", description: "הנהג נמחק לצמיתות" })
      setDeleteConfirmOpen(false)
      setIsDialogOpen(false)
      setEditingDriverId(null)
      resetForm()
      setDrivers(prev => prev.filter(d => d.id !== editingDriverId))
    } catch (error) { toast({ title: "שגיאה", description: "המחיקה נכשלה", variant: "destructive" }) }
  }

  const handleDeleteDriver = async () => {
    if (!editingDriverId) return
    try {
      const newStatus = (newDriver[STATUS_FIELD_ID] || "פעיל") === "לא פעיל" ? "פעיל" : "לא פעיל"
      const response = await fetch(`/api/drivers?tenant=${tenantId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recordId: editingDriverId, fields: { [STATUS_FIELD_ID]: newStatus } }) })
      if (!response.ok) throw new Error("Failed")
      setIsDialogOpen(false); setEditingDriverId(null); resetForm(); 
      setDrivers(prev => prev.map(d => d.id === editingDriverId ? { ...d, fields: { ...d.fields, [STATUS_FIELD_ID]: newStatus } } : d));
      toast({ title: "הצלחה", description: "סטטוס עודכן" })
    } catch (error) { toast({ title: "שגיאה", description: "נכשל", variant: "destructive" }) }
  }

  const handleRowClick = (driver: Driver) => { 
    setEditingDriverId(driver.id); 
    setNewDriver({ 
      [FIRST_NAME_ID]: driver.fields[FIRST_NAME_ID] || "",
      [PHONE_ID]: driver.fields[PHONE_ID] || "",
      [DRIVER_TYPE_ID]: driver.fields[DRIVER_TYPE_ID] || "",
      [CAR_NUMBER_ID]: driver.fields[CAR_NUMBER_ID] || "",
      [STATUS_FIELD_ID]: driver.fields[STATUS_FIELD_ID] || "פעיל"
    } as any)
    // Load salary config
    try {
      const raw = driver.fields[SALARY_CONFIG_ID]
      setSalaryConfig(raw ? JSON.parse(raw) : null)
    } catch { setSalaryConfig(null) }
    setIsDialogOpen(true) 
  }

  const resetForm = () => { 
    setNewDriver({ 
      [FIRST_NAME_ID]: "",
      [PHONE_ID]: "",
      [DRIVER_TYPE_ID]: "",
      [CAR_NUMBER_ID]: ""
    }); 
    setPhoneError("");
    setCarNumberError("");
    setSalaryConfig(null)
  }

  const [newDriver, setNewDriver] = useState<any>({ 
    [FIRST_NAME_ID]: "",
    [PHONE_ID]: "",
    [DRIVER_TYPE_ID]: "",
    [CAR_NUMBER_ID]: ""
  })

  const filteredDrivers = drivers.filter((driver) => {
    const status = driver.fields[STATUS_FIELD_ID] || "פעיל"
    const matchesStatus = status === statusFilter
    if (!searchQuery) return matchesStatus
    const searchLower = searchQuery.toLowerCase()
    return matchesStatus && Object.values(driver.fields).some((value) => String(value).toLowerCase().includes(searchLower))
  })
  
  const sortedDrivers = React.useMemo(() => {
    if (!sortConfig) return filteredDrivers
    const col = driverColumns.find(c => c.key === sortConfig.key)
    if (!col) return filteredDrivers
    return [...filteredDrivers].sort((a, b) => {
      const aVal = a.fields[col.fieldKey] ?? ''
      const bVal = b.fields[col.fieldKey] ?? ''
      const cmp = String(aVal).localeCompare(String(bVal), 'he', { numeric: true })
      return sortConfig.direction === 'asc' ? cmp : -cmp
    })
  }, [filteredDrivers, sortConfig])

  const isEditMode = !!editingDriverId
  
  const validatePhone = (phone: string) => {
    if (!phone) { setPhoneError(""); return true };
    if (!/^\d+$/.test(phone)) { setPhoneError("מספרים בלבד"); return false };
    if (phone.length < 9 || phone.length > 10) { setPhoneError("9-10 ספרות"); return false };
    // בדיקת כפילות — כל נהג אחר (לא הנהג הנערך כרגע)
    const duplicate = drivers.find(d => d.id !== editingDriverId && d.fields[PHONE_ID] === phone)
    if (duplicate) { setPhoneError(`מספר קיים כבר אצל: ${duplicate.fields[FIRST_NAME_ID] || "נהג אחר"}`); return false };
    setPhoneError("");
    return true;
  }

  const validateCarNumber = (carNumber: string) => {
    if (!carNumber) { setCarNumberError(""); return true };
    if (!/^\d+$/.test(carNumber)) { setCarNumberError("מספרים בלבד"); return false };
    setCarNumberError("");
    return true;
  }

  const handlePhoneChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    setNewDriver({...newDriver, [PHONE_ID]: numericValue});
    validatePhone(numericValue);
  }

  const handleCarNumberChange = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    setNewDriver({...newDriver, [CAR_NUMBER_ID]: numericValue});
    validateCarNumber(numericValue);
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => { setScrollTop(e.currentTarget.scrollTop) }
  useEffect(() => { if (tableContainerRef.current) setContainerHeight(tableContainerRef.current.clientHeight) }, [])

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_SIZE)
  const endIndex = Math.min(sortedDrivers.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + BUFFER_SIZE)
  const visibleDrivers = sortedDrivers.slice(startIndex, endIndex)
  const totalHeight = sortedDrivers.length * ROW_HEIGHT
  const offsetY = startIndex * ROW_HEIGHT

  return (
    <div className="w-full h-[calc(100vh-2rem)] flex flex-col space-y-2 p-4 overflow-hidden" dir="rtl">
      <div className="flex items-center gap-3 flex-none flex-wrap">
        <Select value={statusFilter} onValueChange={(value: "פעיל" | "לא פעיל") => setStatusFilter(value)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="פעיל">פעיל</SelectItem><SelectItem value="לא פעיל">לא פעיל</SelectItem></SelectContent>
        </Select>
        <Button onClick={() => setIsDialogOpen(true)}><Plus className="h-4 w-4 ml-2" /> נהג חדש</Button>
        <div className="relative w-[300px]">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="חיפוש..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-10" />
        </div>
        <div className="mr-auto text-sm text-muted-foreground whitespace-nowrap flex items-center gap-2">
            {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            סה"כ {filteredDrivers.length.toLocaleString("he-IL")} נהגים
        </div>
      </div>

      <div className="border rounded-lg flex-1 overflow-auto bg-background shadow-sm relative" ref={tableContainerRef} onScroll={handleScroll}>
        <Table style={{ tableLayout: 'fixed' }}>
          <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
            <TableRow>
              {displayColumns.map(col => (
                <TableHead
                  key={col.key}
                  className={`text-right relative border-l select-none group hover:bg-muted/30 transition-colors ${draggingColId && draggingColId !== col.key ? 'border-l-2 border-l-primary/30' : ''}`}
                  style={{ width: getColWidth(col), cursor: 'grab' }}
                  draggable
                  onDragStart={(e) => { setDraggingColId(col.key); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", col.key) }}
                  onDragOver={(e) => { if (!draggingColId) return; e.preventDefault(); e.dataTransfer.dropEffect = "move" }}
                  onDrop={(e) => {
                    e.preventDefault(); const src = e.dataTransfer.getData("text/plain")
                    if (!src || src === col.key) { setDraggingColId(null); return }
                    const order = [...columnOrder]; const fi = order.indexOf(src); const ti = order.indexOf(col.key)
                    if (fi === -1 || ti === -1) { setDraggingColId(null); return }
                    order.splice(fi, 1); order.splice(ti, 0, src); setColumnOrder(order); setDraggingColId(null)
                  }}
                  onDragEnd={() => setDraggingColId(null)}
                >
                  <div className="flex items-center gap-1 cursor-pointer" onClick={() => handleSort(col.key)}>
                    {col.header}
                    <span className="text-[10px] opacity-60 shrink-0">{sortConfig?.key === col.key ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}</span>
                  </div>
                  <div
                    onMouseDown={(e) => handleResizeStart(col.key, col.minWidth, e)}
                    className="absolute left-0 top-0 h-full w-1 cursor-col-resize touch-none select-none z-20 hover:bg-primary transition-colors duration-200"
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && sortedDrivers.length === 0 ? (
              <TableRow><TableCell colSpan={displayColumns.length} className="text-center py-8"><div className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /><span>טוען נתונים...</span></div></TableCell></TableRow>
            ) : sortedDrivers.length === 0 ? (
              <TableRow><TableCell colSpan={displayColumns.length} className="text-center py-8 text-muted-foreground">לא נמצאו נהגים</TableCell></TableRow>
            ) : (
              <>
                {startIndex > 0 && <tr style={{ height: `${offsetY}px` }}><td colSpan={displayColumns.length} /></tr>}
                {visibleDrivers.map((driver) => (
                  <TableRow key={driver.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleRowClick(driver)} style={{ height: `${ROW_HEIGHT}px` }}>
                    {displayColumns.map(col => (
                      <TableCell key={col.key} className="truncate">{col.render(driver)}</TableCell>
                    ))}
                  </TableRow>
                ))}
                {endIndex < sortedDrivers.length && <tr style={{ height: `${totalHeight - endIndex * ROW_HEIGHT}px` }}><td colSpan={displayColumns.length} /></tr>}
              </>
            )}
          </TableBody>
        </Table>
      </div>
      
      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setEditingDriverId(null); resetForm(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader><DialogTitle>{isEditMode ? "עריכת נהג" : "נהג חדש"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>שם מלא / שם חברה {!isEditMode && <span className="text-red-500">*</span>}</Label>
                  <Input value={newDriver[FIRST_NAME_ID]} onChange={(e) => setNewDriver({...newDriver, [FIRST_NAME_ID]: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>טלפון נייד</Label>
                  <Input 
                    value={newDriver[PHONE_ID] || ""} 
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className={phoneError ? "border-red-500" : ""}
                  />
                  {phoneError && <p className="text-sm text-red-500">{phoneError}</p>}
                </div>
                <div className="space-y-2">
                  <Label>סוג נהג {!isEditMode && <span className="text-red-500">*</span>}</Label>
                  <Select value={newDriver[DRIVER_TYPE_ID]} onValueChange={(val) => setNewDriver({...newDriver, [DRIVER_TYPE_ID]: val})}>
                    <SelectTrigger><SelectValue placeholder="בחר" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="שכיר">שכיר</SelectItem>
                      <SelectItem value="קבלן">קבלן</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>מספר רכב</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={newDriver[CAR_NUMBER_ID] || ""} 
                      onChange={(e) => handleCarNumberChange(e.target.value)}
                      className={carNumberError ? "border-red-500" : ""}
                    />
                    {companyVehicles.length > 0 && (
                      <Popover open={vehiclePickerOpen} onOpenChange={setVehiclePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="icon" title="בחר מרכבי חברה" className="shrink-0">
                            <Car className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-1" dir="rtl" align="end">
                          <div className="text-xs text-muted-foreground px-2 py-1 font-medium">רכבי חברה</div>
                          {companyVehicles.map(v => {
                            const num = v.fields[CV_CAR_NUMBER] || ""
                            const model = v.fields[CV_MAKE_MODEL] || ""
                            return (
                              <button key={v.id} onClick={() => {
                                setNewDriver((p: any) => ({ ...p, [CAR_NUMBER_ID]: num }))
                                setCarNumberError("")
                                setVehiclePickerOpen(false)
                              }} className="w-full text-right px-2 py-1.5 text-sm hover:bg-accent rounded flex items-center justify-between gap-2">
                                <span className="font-mono font-medium">{num}</span>
                                {model && <span className="text-muted-foreground text-xs truncate">{model}</span>}
                              </button>
                            )
                          })}
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                  {carNumberError && <p className="text-sm text-red-500">{carNumberError}</p>}
                </div>
            </div>
            {/* Salary Config Section — only for שכיר */}
            {newDriver[DRIVER_TYPE_ID] === "שכיר" && (
              <div className="border rounded-lg p-4 space-y-4 mt-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm flex items-center gap-2"><Settings2 className="h-4 w-4" />הגדרות שכר</h3>
                  {!salaryConfig && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSalaryConfig(defaultSalaryConfig())}>הגדר שכר</Button>
                  )}
                </div>

                {salaryConfig && (
                  <div className="space-y-4">
                    {/* Type + gross/net */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">מודל תשלום</Label>
                        <Select value={salaryConfig.type} onValueChange={v => setSalaryConfig((p: any) => ({...p, type: v}))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly">שעתי בסיס</SelectItem>
                            <SelectItem value="flat_hourly">שעתי קבוע</SelectItem>
                            <SelectItem value="daily_fixed">יומית</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">ברוטו / נטו</Label>
                        <Select value={salaryConfig.grossOrNet} onValueChange={v => setSalaryConfig((p: any) => ({...p, grossOrNet: v}))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gross">ברוטו</SelectItem>
                            <SelectItem value="net">נטו</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* daily_fixed */}
                    {salaryConfig.type === "daily_fixed" && (
                      <div className="space-y-1">
                        <Label className="text-xs">תשלום קבוע ליום (₪)</Label>
                        <Input type="number" className="h-8 text-xs" value={salaryConfig.dailyFixedRate}
                          onChange={e => setSalaryConfig((p: any) => ({...p, dailyFixedRate: +e.target.value}))} />
                      </div>
                    )}

                    {/* hourly fields */}
                    {salaryConfig.type !== "daily_fixed" && (
                      <>
                        {salaryConfig.type === "hourly" && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">שעות בסיס ביום</Label>
                              <Input type="number" className="h-8 text-xs" value={salaryConfig.baseHours}
                                onChange={e => setSalaryConfig((p: any) => ({...p, baseHours: +e.target.value}))} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">מינימום שעות לתשלום</Label>
                              <Input type="number" className="h-8 text-xs" value={salaryConfig.minimumHours}
                                onChange={e => setSalaryConfig((p: any) => ({...p, minimumHours: +e.target.value}))} />
                            </div>
                          </div>
                        )}

                        {/* Tiers */}
                        {/* Base rate - for both hourly types */}
                        <div className="space-y-1">
                          <Label className="text-xs">תעריף בסיס לשעה (₪)</Label>
                          <Input type="number" className="h-8 text-xs"
                            value={salaryConfig.baseRate || 0}
                            onChange={e => setSalaryConfig((p: any) => ({...p, baseRate: +e.target.value}))} />
                        </div>

                        {salaryConfig.type === "hourly" && (
                          <div className="space-y-2">
                            <Label className="text-xs font-bold">שכבות תשלום</Label>
                            {/* Header */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                              <span className="flex-1">תיאור</span>
                              <span className="w-16 text-center">שעות</span>
                              <span className="w-16 text-center">אחוז</span>
                              <span className="w-16 text-center">₪/שעה</span>
                              <span className="w-4"></span>
                            </div>
                            {salaryConfig.tiers.map((tier: any, i: number) => {
                              const rate = Math.round((salaryConfig.baseRate || 0) * (tier.percentage || 100) / 100 * 100) / 100
                              return (
                              <div key={i} className="flex items-center gap-2">
                                <Input placeholder="תיאור" className="h-7 text-xs flex-1" value={tier.label}
                                  onChange={e => setSalaryConfig((p: any) => { const t = [...p.tiers]; t[i] = {...t[i], label: e.target.value}; return {...p, tiers: t} })} />
                                <Input type="number" placeholder="∞" className="h-7 text-xs w-16 text-center"
                                  value={tier.upToHours ?? ""}
                                  onChange={e => setSalaryConfig((p: any) => { const t = [...p.tiers]; t[i] = {...t[i], upToHours: e.target.value === "" ? null : +e.target.value}; return {...p, tiers: t} })} />
                                <Input type="number" placeholder="%" className="h-7 text-xs w-16 text-center" value={tier.percentage ?? 100}
                                  onChange={e => setSalaryConfig((p: any) => { const t = [...p.tiers]; t[i] = {...t[i], percentage: +e.target.value}; return {...p, tiers: t} })} />
                                <div className="h-7 w-16 flex items-center justify-center text-xs text-muted-foreground bg-muted/40 rounded border">
                                  ₪{rate}
                                </div>
                                <button onClick={() => setSalaryConfig((p: any) => ({...p, tiers: p.tiers.filter((_: any, j: number) => j !== i)}))}
                                  className="text-red-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
                              </div>
                            )})}
                            <Button size="sm" variant="outline" className="h-7 text-xs w-full"
                              onClick={() => setSalaryConfig((p: any) => ({...p, tiers: [...p.tiers, {upToHours: null, percentage: 100, label: ""}]}))}>
                              <Plus className="h-3 w-3 ml-1" /> הוסף שכבה
                            </Button>
                          </div>
                        )}
                      </>
                    )}

                    {/* Extras */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">שבת/חג (%)</Label>
                        <Input type="number" step="1" className="h-8 text-xs" value={salaryConfig.shabbatMultiplier}
                          onChange={e => setSalaryConfig((p: any) => ({...p, shabbatMultiplier: +e.target.value}))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">דמי נסיעה יומי (₪)</Label>
                        <Input type="number" className="h-8 text-xs" value={salaryConfig.travelAllowance}
                          onChange={e => setSalaryConfig((p: any) => ({...p, travelAllowance: +e.target.value}))} />
                      </div>
                    </div>

                    <button className="text-xs text-red-400 hover:text-red-600"
                      onClick={() => setSalaryConfig(null)}>הסר הגדרות שכר</button>
                  </div>
                )}
              </div>
            )}

            {/* Contract Upload */}
            <div className="space-y-1">
              <Label className="text-sm block mb-1"><Upload className="w-3 h-3 inline ml-1" />חוזה העסקה</Label>
              <div className="flex flex-col gap-1">
                {isEditMode && (() => {
                  const DRV = (tenantFields as any)?.drivers
                  const existingContracts: any[] = drivers.find(d => d.id === editingDriverId)?.fields?.[DRV?.CONTRACT] || []
                  return existingContracts.map((a: any, i: number) => (
                    <div key={i} className="flex items-center gap-1 h-8 px-2 border rounded bg-green-50 text-sm">
                      <FileText className="w-3 h-3 text-green-600 shrink-0" />
                      <span className="truncate flex-1">{a.name || 'קובץ'}</span>
                      <Button type="button" variant="ghost" size="sm" className="h-5 px-1 text-orange-600 shrink-0" onClick={() => {
                        const params = new URLSearchParams({ tenant: tenantId })
                        if (a.presignedUrl || a.url) params.set("url", a.presignedUrl || a.url)
                        else if (a.token) params.set("token", a.token)
                        if (a.name) params.set("name", a.name)
                        window.open(`/api/view-file?${params.toString()}`, "_blank")
                      }}><Eye className="w-3 h-3" /></Button>
                      <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-red-500 shrink-0" onClick={async () => {
                        const DRV2 = (tenantFields as any)?.drivers
                        if (!editingDriverId || !DRV2?.CONTRACT) return
                        const updated = existingContracts.filter((_: any, j: number) => j !== i)
                        await fetch(`/api/drivers?tenant=${tenantId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recordId: editingDriverId, fields: { [DRV2.CONTRACT]: updated.length > 0 ? updated : null } }) })
                        setDrivers(prev => prev.map(d => d.id === editingDriverId ? { ...d, fields: { ...d.fields, [DRV2.CONTRACT]: updated } } : d))
                      }}><X className="w-3 h-3" /></Button>

                    </div>
                  ))
                })()}
                {contractFile && (
                  <div className="flex items-center gap-1 h-8 px-2 border rounded bg-orange-50 text-sm">
                    <FileText className="w-3 h-3 text-orange-600 shrink-0" />
                    <span className="truncate flex-1">{contractFile.name}</span>
                    <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-red-500 shrink-0" onClick={() => { setContractFile(null); if (contractFileRef.current) contractFileRef.current.value = "" }}><X className="w-3 h-3" /></Button>
                  </div>
                )}
                <input ref={contractFileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={e => setContractFile(e.target.files?.[0] || null)} />
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1 mt-1" onClick={() => contractFileRef.current?.click()} type="button">
                  <Upload className="h-3 w-3" />
                  {contractFile || (isEditMode && (drivers.find(d => d.id === editingDriverId)?.fields?.[(tenantFields as any)?.drivers?.CONTRACT] || []).length > 0) ? "החלף חוזה" : "העלה חוזה"}
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
                {isEditMode && (
                    <>
                    <Button 
                        variant="ghost"
                        size="icon"
                        className="mr-auto text-red-500 hover:text-red-700 hover:bg-red-50"
                        title="מחק נהג לצמיתות"
                        onClick={() => setDeleteConfirmOpen(true)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant={(newDriver[STATUS_FIELD_ID] || "פעיל") === "לא פעיל" ? "default" : "destructive"} 
                        onClick={handleDeleteDriver} 
                        className={`${(newDriver[STATUS_FIELD_ID] || "פעיל") === "לא פעיל" ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-rose-400 hover:bg-rose-500 text-white"}`}
                    >
                        {(newDriver[STATUS_FIELD_ID] || "פעיל") === "לא פעיל" ? "הפוך לפעיל" : "הפוך ללא פעיל"}
                    </Button>
                    </>
                )}
                <Button 
                  onClick={isEditMode ? handleUpdateDriver : handleCreateDriver} 
                  disabled={(!isEditMode && (!newDriver[FIRST_NAME_ID] || !newDriver[DRIVER_TYPE_ID])) || !!phoneError || !!carNumberError}
                >
                  {isEditMode ? "שמור שינויים" : "צור נהג"}
                </Button>
            </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקה לצמיתות</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק את הנהג <strong>{newDriver[FIRST_NAME_ID]}</strong> לצמיתות?
              <br />
              פעולה זו אינה ניתנת לביטול.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handlePermanentDelete}
            >
              כן, מחק לצמיתות
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* דיאלוג עדכון נסיעות עתידיות */}
      <AlertDialog open={futureRidesDialog} onOpenChange={open => { if (!open) { setFutureRidesDialog(false); setPendingSaveFields(null) } }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>עדכון נסיעות עתידיות</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  שינית את מספר הרכב לנהג זה.<br />
                  נמצאו <strong className="text-foreground">{futureRidesCount} נסיעות עתידיות</strong> המשובצות לנהג זה.
                </p>
                <p>האם לעדכן גם את מספר הרכב בנסיעות אלו?</p>
                <p className="text-xs text-muted-foreground/70">⚠️ נסיעות שכבר בוצעו לא ישתנו.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel onClick={() => {
              // שמור נהג בלבד, ללא עדכון נסיעות
              if (pendingSaveFields) saveDriverAndOptionalRides(pendingSaveFields, [])
            }}>
              שמור נהג בלבד
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingSaveFields) saveDriverAndOptionalRides(pendingSaveFields, futureRidesList)
              }}
              disabled={isUpdatingFuture}
            >
              {isUpdatingFuture ? <><Loader2 className="h-4 w-4 animate-spin ml-2" />מעדכן...</> : `כן, עדכן ${futureRidesCount} נסיעות`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
