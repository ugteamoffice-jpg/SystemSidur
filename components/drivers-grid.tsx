"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useTenantFields, useTenant } from "@/lib/tenant-context"

interface Driver {
  id: string
  fields: {
    [key: string]: any
  }
}

export default function DriversGrid() {
  const tenantFields = useTenantFields()
  const { tenantId } = useTenant()
  const STATUS_FIELD_ID = tenantFields?.drivers.STATUS || ""
  const FIRST_NAME_ID = tenantFields?.drivers.FIRST_NAME || ""
  const PHONE_ID = tenantFields?.drivers.PHONE || ""
  const DRIVER_TYPE_ID = tenantFields?.drivers.DRIVER_TYPE || ""
  const CAR_NUMBER_ID = tenantFields?.drivers.CAR_NUMBER || ""

  const [drivers, setDrivers] = useState<Driver[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"פעיל" | "לא פעיל">("פעיל")
  const [phoneError, setPhoneError] = useState("")
  const [carNumberError, setCarNumberError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)
  const tableContainerRef = useRef<HTMLDivElement>(null)

  const ROW_HEIGHT = 53
  const BUFFER_SIZE = 10 

  const DRIVERS_COL_SIZING_KEY = `driversColumnSizing_${tenantId}`
  const driverColumns = [
    { key: 'firstName', header: 'שם מלא / שם חברה', defaultWidth: 200, minWidth: 100 },
    { key: 'phone', header: 'טלפון נייד', defaultWidth: 140, minWidth: 80 },
    { key: 'type', header: 'סוג נהג', defaultWidth: 120, minWidth: 80 },
    { key: 'carNumber', header: 'מספר רכב', defaultWidth: 140, minWidth: 80 },
    { key: 'status', header: 'סטטוס', defaultWidth: 100, minWidth: 70 },
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

  useEffect(() => {
    fetchDrivers()
  }, [])

  const fetchDrivers = async () => {
    setIsLoading(true)
    setDrivers([])
    
    try {
      const response = await fetch(`/api/drivers?tenant=${tenantId}`);
      if (!response.ok) throw new Error("Fetch failed");
      
      const data = await response.json();
      const records = data.records || [];
      
      setDrivers(records);
      console.log(`✅ Loaded ${records.length} drivers`);
    } catch (error) {
      console.error("Error fetching drivers:", error)
      toast({ title: "שגיאה בטעינה", description: "חלק מהנתונים אולי לא נטענו", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
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
      toast({ title: "הצלחה", description: "נוצר בהצלחה" })
      setIsDialogOpen(false); resetForm(); fetchDrivers();
    } catch (error) { toast({ title: "שגיאה", description: "נכשל", variant: "destructive" }) }
  }

  const handleUpdateDriver = async () => {
    if (!editingDriverId) return
    try {
      const filteredFields = Object.entries(newDriver).reduce((acc, [key, value]) => {
        if (value !== "" && value !== undefined && value !== null) acc[key] = value
        return acc
      }, {} as any)
      const response = await fetch(`/api/drivers?tenant=${tenantId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recordId: editingDriverId, fields: filteredFields }) })
      if (!response.ok) throw new Error("Failed")
      toast({ title: "הצלחה", description: "עודכן בהצלחה" })
      setIsDialogOpen(false); setEditingDriverId(null); resetForm();
      setDrivers(prev => prev.map(d => d.id === editingDriverId ? { ...d, fields: { ...d.fields, ...filteredFields } } : d));
    } catch (error) { toast({ title: "שגיאה", description: "נכשל", variant: "destructive" }) }
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
    } as any); 
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
  
  const isEditMode = !!editingDriverId
  const getDriverStatus = (driver: Driver) => driver.fields[STATUS_FIELD_ID] || "פעיל"
  
  const validatePhone = (phone: string) => {
    if (!phone) { setPhoneError(""); return true };
    if (!/^\d+$/.test(phone)) { setPhoneError("מספרים בלבד"); return false };
    if (phone.length < 9 || phone.length > 10) { setPhoneError("9-10 ספרות"); return false };
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
  const endIndex = Math.min(filteredDrivers.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + BUFFER_SIZE)
  const visibleDrivers = filteredDrivers.slice(startIndex, endIndex)
  const totalHeight = filteredDrivers.length * ROW_HEIGHT
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
              {driverColumns.map(col => (
                <TableHead key={col.key} className="text-right relative border-l select-none group hover:bg-muted/30" style={{ width: getColWidth(col) }}>
                  {col.header}
                  <div
                    onMouseDown={(e) => handleResizeStart(col.key, col.minWidth, e)}
                    className="absolute left-0 top-0 h-full w-1 cursor-col-resize touch-none select-none z-20 hover:bg-primary transition-colors duration-200"
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && filteredDrivers.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8"><div className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /><span>טוען נתונים...</span></div></TableCell></TableRow>
            ) : filteredDrivers.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">לא נמצאו נהגים</TableCell></TableRow>
            ) : (
              <>
                {startIndex > 0 && <tr style={{ height: `${offsetY}px` }}><td colSpan={5} /></tr>}
                {visibleDrivers.map((driver) => (
                  <TableRow key={driver.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleRowClick(driver)} style={{ height: `${ROW_HEIGHT}px` }}>
                    <TableCell className="font-medium truncate">{driver.fields[FIRST_NAME_ID] || "-"}</TableCell>
                    <TableCell className="truncate">{driver.fields[PHONE_ID] || "-"}</TableCell>
                    <TableCell className="truncate">{driver.fields[DRIVER_TYPE_ID] || "-"}</TableCell>
                    <TableCell className="truncate">{driver.fields[CAR_NUMBER_ID] || "-"}</TableCell>
                    <TableCell><span className={`px-2 py-1 rounded-full text-xs ${getDriverStatus(driver) === 'פעיל' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{getDriverStatus(driver)}</span></TableCell>
                  </TableRow>
                ))}
                {endIndex < filteredDrivers.length && <tr style={{ height: `${totalHeight - endIndex * ROW_HEIGHT}px` }}><td colSpan={5} /></tr>}
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
                  <Input 
                    value={newDriver[CAR_NUMBER_ID] || ""} 
                    onChange={(e) => handleCarNumberChange(e.target.value)}
                    className={carNumberError ? "border-red-500" : ""}
                  />
                  {carNumberError && <p className="text-sm text-red-500">{carNumberError}</p>}
                </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
                {isEditMode && (
                    <Button 
                        variant={(newDriver[STATUS_FIELD_ID] || "פעיל") === "לא פעיל" ? "default" : "destructive"} 
                        onClick={handleDeleteDriver} 
                        className={`mr-auto ${(newDriver[STATUS_FIELD_ID] || "פעיל") === "לא פעיל" ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-rose-400 hover:bg-rose-500 text-white"}`}
                    >
                        {(newDriver[STATUS_FIELD_ID] || "פעיל") === "לא פעיל" ? "הפוך לפעיל" : "הפוך ללא פעיל"}
                    </Button>
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
    </div>
  )
}
