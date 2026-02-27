"use client"

import * as React from "react"
import { Plus, Pencil, Trash2, Copy, ToggleLeft, ToggleRight } from "lucide-react"
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
  RecurringRide, DayPrices, loadRecurringRides, addRecurringRide,
  updateRecurringRide, deleteRecurringRide, DAY_NAMES_HE, DAY_LETTERS_HE
} from "@/lib/recurring-rides"

interface ListItem { id: string; title: string }

function AutoComplete({ options, value, onChange, onSelect, placeholder }: any) {
  const [show, setShow] = React.useState(false)
  const safeValue = String(value || "").toLowerCase()
  const filtered = options.filter((o: any) => String(o.title || "").toLowerCase().includes(safeValue))
  return (
    <div className="relative w-full">
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setShow(true) }}
        onBlur={() => setTimeout(() => setShow(false), 200)}
        onFocus={() => setShow(true)}
        className="text-right"
        placeholder={placeholder}
      />
      {show && filtered.length > 0 && (
        <div className="absolute z-50 w-full bg-white border shadow-md max-h-40 overflow-auto rounded-md mt-1 text-black">
          {filtered.map((o: any) => (
            <div key={o.id} className="p-2 hover:bg-gray-100 cursor-pointer text-right text-sm"
              onMouseDown={() => { onChange(o.title); if (onSelect) onSelect(o) }}>
              {o.title}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const emptyPrices: DayPrices = { clientExcl: "", clientIncl: "", driverExcl: "", driverIncl: "" }

const emptyForm = {
  customerName: "", customerId: "",
  description: "",
  pickupTime: "", dropoffTime: "",
  driverName: "", driverId: "",
  vehicleTypeName: "", vehicleTypeId: "",
  vehicleNum: "",
  managerNotes: "", driverNotes: "",
  orderName: "", mobile: "", idNum: "",
  activeDays: [0, 1, 2, 3, 4] as number[],
  defaultPrices: { ...emptyPrices },
  dayPrices: {} as { [day: number]: DayPrices },
  useDayPrices: false,
  active: true,
}

export function RecurringRidesPage() {
  const { tenantId } = useTenant()
  const tenantFields = useTenantFields()
  const { toast } = useToast()

  const [rides, setRides] = React.useState<RecurringRide[]>([])
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState({ ...emptyForm })
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null)

  const [lists, setLists] = React.useState<{ customers: ListItem[], drivers: ListItem[], vehicles: ListItem[] }>({
    customers: [], drivers: [], vehicles: []
  })

  // Load rides
  React.useEffect(() => {
    setRides(loadRecurringRides(tenantId))
  }, [tenantId])

  // Load autocomplete lists
  React.useEffect(() => {
    const load = async (url: string) => {
      try {
        const r = await fetch(url)
        const d = await r.json()
        return d.records ? d.records.map((x: any) => ({
          id: x.id,
          title: x.fields && Object.values(x.fields)[0] ? String(Object.values(x.fields)[0]) : ""
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
    setForm({ ...emptyForm, dayPrices: {}, defaultPrices: { ...emptyPrices } })
    setDialogOpen(true)
  }

  const openEdit = (ride: RecurringRide) => {
    setEditingId(ride.id)
    const hasDayPrices = Object.keys(ride.dayPrices).length > 0
    setForm({
      customerName: ride.customerName, customerId: ride.customerId,
      description: ride.description,
      pickupTime: ride.pickupTime, dropoffTime: ride.dropoffTime,
      driverName: ride.driverName, driverId: ride.driverId,
      vehicleTypeName: ride.vehicleTypeName, vehicleTypeId: ride.vehicleTypeId,
      vehicleNum: ride.vehicleNum,
      managerNotes: ride.managerNotes, driverNotes: ride.driverNotes,
      orderName: ride.orderName, mobile: ride.mobile, idNum: ride.idNum,
      activeDays: [...ride.activeDays],
      defaultPrices: { ...ride.defaultPrices },
      dayPrices: JSON.parse(JSON.stringify(ride.dayPrices)),
      useDayPrices: hasDayPrices,
      active: ride.active,
    })
    setDialogOpen(true)
  }

  const handleDuplicate = (ride: RecurringRide) => {
    addRecurringRide(tenantId, {
      ...ride,
      active: true,
    })
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
    if (!form.customerName || !form.description || !form.pickupTime) {
      toast({ title: "שגיאה", description: "יש למלא לקוח, מסלול ושעת התייצבות", variant: "destructive" })
      return
    }
    if (form.activeDays.length === 0) {
      toast({ title: "שגיאה", description: "יש לבחור לפחות יום אחד", variant: "destructive" })
      return
    }

    const data = {
      customerName: form.customerName, customerId: form.customerId,
      description: form.description,
      pickupTime: form.pickupTime, dropoffTime: form.dropoffTime,
      driverName: form.driverName, driverId: form.driverId,
      vehicleTypeName: form.vehicleTypeName, vehicleTypeId: form.vehicleTypeId,
      vehicleNum: form.vehicleNum,
      managerNotes: form.managerNotes, driverNotes: form.driverNotes,
      orderName: form.orderName, mobile: form.mobile, idNum: form.idNum,
      activeDays: form.activeDays,
      defaultPrices: form.defaultPrices,
      dayPrices: form.useDayPrices ? form.dayPrices : {},
      active: form.active,
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

  const calcVat = (value: string, type: "excl" | "incl", side: "client" | "driver", target: DayPrices): DayPrices => {
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

  const updateDefaultPrice = (value: string, type: "excl" | "incl", side: "client" | "driver") => {
    setForm(prev => ({ ...prev, defaultPrices: calcVat(value, type, side, prev.defaultPrices) }))
  }

  const updateDayPrice = (day: number, value: string, type: "excl" | "incl", side: "client" | "driver") => {
    setForm(prev => {
      const current = prev.dayPrices[day] || { ...emptyPrices }
      return { ...prev, dayPrices: { ...prev.dayPrices, [day]: calcVat(value, type, side, current) } }
    })
  }

  const renderPriceRow = (label: string, prices: DayPrices, onChange: (v: string, t: "excl" | "incl", s: "client" | "driver") => void) => (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="grid grid-cols-4 gap-2">
        <div>
          <Label className="text-[10px]">לקוח לפני מע״מ</Label>
          <Input type="number" value={prices.clientExcl} onChange={e => onChange(e.target.value, "excl", "client")} className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-[10px]">לקוח כולל מע״מ</Label>
          <Input type="number" value={prices.clientIncl} onChange={e => onChange(e.target.value, "incl", "client")} className="h-8 text-sm font-bold" />
        </div>
        <div>
          <Label className="text-[10px]">נהג לפני מע״מ</Label>
          <Input type="number" value={prices.driverExcl} onChange={e => onChange(e.target.value, "excl", "driver")} className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-[10px]">נהג כולל מע״מ</Label>
          <Input type="number" value={prices.driverIncl} onChange={e => onChange(e.target.value, "incl", "driver")} className="h-8 text-sm font-bold" />
        </div>
      </div>
    </div>
  )

  const activeCount = rides.filter(r => r.active).length

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold">נסיעות קבועות</h2>
          <p className="text-sm text-muted-foreground">{rides.length} תבניות ({activeCount} פעילות)</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          תבנית חדשה
        </Button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right w-10">מצב</TableHead>
              <TableHead className="text-right">לקוח</TableHead>
              <TableHead className="text-right">מסלול</TableHead>
              <TableHead className="text-right w-20">שעה</TableHead>
              <TableHead className="text-right">נהג</TableHead>
              <TableHead className="text-right w-32">ימים</TableHead>
              <TableHead className="text-right w-24">מחיר לקוח</TableHead>
              <TableHead className="text-right w-24">מחיר נהג</TableHead>
              <TableHead className="text-right w-28">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rides.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  אין תבניות. לחץ "תבנית חדשה" כדי להוסיף.
                </TableCell>
              </TableRow>
            ) : (
              rides.map(ride => (
                <TableRow key={ride.id} className={!ride.active ? "opacity-40" : ""}>
                  <TableCell>
                    <button onClick={() => handleToggle(ride)} title={ride.active ? "פעיל" : "מושבת"}>
                      {ride.active
                        ? <ToggleRight className="h-5 w-5 text-green-600" />
                        : <ToggleLeft className="h-5 w-5 text-gray-400" />
                      }
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">{ride.customerName}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={ride.description}>{ride.description}</TableCell>
                  <TableCell>{ride.pickupTime}</TableCell>
                  <TableCell>{ride.driverName || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-0.5">
                      {[0, 1, 2, 3, 4, 5, 6].map(d => (
                        <span key={d} className={`text-[10px] w-5 h-5 flex items-center justify-center rounded ${
                          ride.activeDays.includes(d) ? "bg-blue-100 text-blue-700 font-bold" : "text-gray-300"
                        }`}>
                          {DAY_LETTERS_HE[d]}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {ride.defaultPrices.clientIncl ? `₪${ride.defaultPrices.clientIncl}` : "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {ride.defaultPrices.driverIncl ? `₪${ride.defaultPrices.driverIncl}` : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(ride)} className="p-1 hover:bg-muted rounded" title="ערוך">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDuplicate(ride)} className="p-1 hover:bg-muted rounded" title="שכפל">
                        <Copy className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteConfirm(ride.id)} className="p-1 hover:bg-red-50 rounded text-red-500" title="מחק">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
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
            <DialogTitle>{editingId ? "עריכת תבנית" : "תבנית חדשה"}</DialogTitle>
            <DialogDescription>נסיעה קבועה שתשובץ אוטומטית בימים הנבחרים</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">פרטים</TabsTrigger>
              <TabsTrigger value="days">ימים</TabsTrigger>
              <TabsTrigger value="prices">מחירים</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto p-1 mt-2">
              {/* Tab: Details */}
              <TabsContent value="details" className="space-y-3 mt-0">
                <div className="space-y-1">
                  <Label>שם לקוח *</Label>
                  <AutoComplete
                    options={lists.customers} value={form.customerName}
                    onChange={(v: string) => setForm(p => ({ ...p, customerName: v, customerId: "" }))}
                    onSelect={(o: ListItem) => setForm(p => ({ ...p, customerName: o.title, customerId: o.id }))}
                    placeholder=""
                  />
                </div>
                <div className="space-y-1">
                  <Label>תיאור (מסלול) *</Label>
                  <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="text-right" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>שעת התייצבות *</Label>
                    <Input type="time" value={form.pickupTime} onChange={e => setForm(p => ({ ...p, pickupTime: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>שעת חזור</Label>
                    <Input type="time" value={form.dropoffTime} onChange={e => setForm(p => ({ ...p, dropoffTime: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>נהג</Label>
                  <AutoComplete
                    options={lists.drivers} value={form.driverName}
                    onChange={(v: string) => setForm(p => ({ ...p, driverName: v, driverId: "" }))}
                    onSelect={(o: ListItem) => setForm(p => ({ ...p, driverName: o.title, driverId: o.id }))}
                    placeholder=""
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>סוג רכב</Label>
                    <AutoComplete
                      options={lists.vehicles} value={form.vehicleTypeName}
                      onChange={(v: string) => setForm(p => ({ ...p, vehicleTypeName: v, vehicleTypeId: "" }))}
                      onSelect={(o: ListItem) => setForm(p => ({ ...p, vehicleTypeName: o.title, vehicleTypeId: o.id }))}
                      placeholder=""
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>מס׳ רכב</Label>
                    <Input value={form.vehicleNum} onChange={e => setForm(p => ({ ...p, vehicleNum: e.target.value }))} className="text-right" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>הערות מנהל</Label>
                  <Textarea value={form.managerNotes} onChange={e => setForm(p => ({ ...p, managerNotes: e.target.value }))} className="text-right" rows={2} />
                </div>
                <div className="space-y-1">
                  <Label>הערות נהג</Label>
                  <Textarea value={form.driverNotes} onChange={e => setForm(p => ({ ...p, driverNotes: e.target.value }))} className="text-right" rows={2} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label>שם מזמין</Label>
                    <Input value={form.orderName} onChange={e => setForm(p => ({ ...p, orderName: e.target.value }))} className="text-right" />
                  </div>
                  <div className="space-y-1">
                    <Label>נייד</Label>
                    <Input value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} className="text-right" />
                  </div>
                  <div className="space-y-1">
                    <Label>ת.ז</Label>
                    <Input value={form.idNum} onChange={e => setForm(p => ({ ...p, idNum: e.target.value }))} className="text-right" />
                  </div>
                </div>
              </TabsContent>

              {/* Tab: Days */}
              <TabsContent value="days" className="space-y-4 mt-0">
                <p className="text-sm text-muted-foreground">בחר את הימים בשבוע שהנסיעה תשובץ:</p>
                <div className="grid grid-cols-7 gap-2">
                  {[0, 1, 2, 3, 4, 5, 6].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                        form.activeDays.includes(d)
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-400 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-lg font-bold">{DAY_LETTERS_HE[d]}</span>
                      <span className="text-[10px]">{DAY_NAMES_HE[d]}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, activeDays: [0, 1, 2, 3, 4] }))}>
                    א׳-ה׳
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, activeDays: [0, 1, 2, 3, 4, 5] }))}>
                    א׳-ו׳
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, activeDays: [0, 1, 2, 3, 4, 5, 6] }))}>
                    כל השבוע
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm(p => ({ ...p, activeDays: [] }))}>
                    נקה הכל
                  </Button>
                </div>
              </TabsContent>

              {/* Tab: Prices */}
              <TabsContent value="prices" className="space-y-4 mt-0">
                {renderPriceRow("מחיר ברירת מחדל", form.defaultPrices, updateDefaultPrice)}

                <div className="border-t pt-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={form.useDayPrices}
                      onChange={e => setForm(p => ({ ...p, useDayPrices: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="font-medium">מחירים שונים לפי יום</span>
                  </label>
                </div>

                {form.useDayPrices && (
                  <div className="space-y-3">
                    {form.activeDays.map(d => (
                      <div key={d} className="p-3 border rounded-lg bg-muted/30">
                        {renderPriceRow(
                          `יום ${DAY_NAMES_HE[d]}`,
                          form.dayPrices[d] || { ...emptyPrices },
                          (v, t, s) => updateDayPrice(d, v, t, s)
                        )}
                      </div>
                    ))}
                    {form.activeDays.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">בחר ימים בטאב "ימים" כדי להגדיר מחירים</p>
                    )}
                  </div>
                )}
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
