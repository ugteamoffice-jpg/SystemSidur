"use client"
import * as React from "react"
import { format, parseISO, differenceInMinutes, isWeekend } from "date-fns"
import { he } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useTenant, useTenantFields } from "@/lib/tenant-context"
import { Loader2, Clock, ChevronDown, ChevronUp, Pencil, Trash2, Plus } from "lucide-react"

interface SalaryTier {
  upToHours: number | null
  ratePerHour: number
  label: string
}

interface SalaryConfig {
  type: "hourly" | "flat_hourly" | "daily_fixed"
  grossOrNet: "gross" | "net"
  baseHours: number
  minimumHours: number
  tiers: SalaryTier[]
  dailyFixedRate: number
  shabbatMultiplier: number
  travelAllowance: number
}

interface DriverRecord {
  id: string
  name: string
  salaryConfig: SalaryConfig | null
}

interface HoursRecord {
  id: string
  date: string
  startTime: string
  endTime: string
  notes: string
  rides: RideRecord[]
  hoursWorked: number
  pay: number
  isShabbat: boolean
}

interface RideRecord {
  id: string
  date: string
  pickupTime: string
  description: string
  dropoffTime: string
  vehicleType: string
}

const defaultSalaryConfig: SalaryConfig = {
  type: "hourly",
  grossOrNet: "gross",
  baseHours: 8,
  minimumHours: 0,
  tiers: [
    { upToHours: 8, ratePerHour: 45, label: "עד 8 שעות" },
    { upToHours: 2, ratePerHour: 56.25, label: "2 שעות נוספות" },
    { upToHours: null, ratePerHour: 67.5, label: "מעל 10 שעות" }
  ],
  dailyFixedRate: 0,
  shabbatMultiplier: 1.5,
  travelAllowance: 0
}

function calcHours(start: string, end: string): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60 // overnight
  return Math.round(mins / 60 * 100) / 100
}

function calcPay(hours: number, config: SalaryConfig, isShabbat: boolean): number {
  if (!config) return 0
  const effectiveHours = config.minimumHours > 0 ? Math.max(hours, config.minimumHours) : hours

  let pay = 0

  if (config.type === "daily_fixed") {
    pay = config.dailyFixedRate
  } else if (config.type === "flat_hourly") {
    const rate = config.tiers[0]?.ratePerHour || 0
    pay = effectiveHours * rate
  } else {
    // hourly with tiers
    let remaining = effectiveHours
    for (const tier of config.tiers) {
      if (remaining <= 0) break
      const hoursInTier = tier.upToHours !== null ? Math.min(remaining, tier.upToHours) : remaining
      pay += hoursInTier * tier.ratePerHour
      remaining -= hoursInTier
    }
  }

  if (isShabbat && config.shabbatMultiplier > 1) {
    pay *= config.shabbatMultiplier
  }

  pay += config.travelAllowance

  return Math.round(pay * 100) / 100
}

function isShabbatDay(dateStr: string): boolean {
  try {
    const d = parseISO(dateStr)
    return d.getDay() === 6 // Saturday
  } catch { return false }
}

export function DriverHoursPage() {
  const { tenantId } = useTenant()
  const tenantFields = useTenantFields()
  const { toast } = useToast()

  const [drivers, setDrivers] = React.useState<DriverRecord[]>([])
  const [selectedDriverId, setSelectedDriverId] = React.useState<string>("")
  const [dateFrom, setDateFrom] = React.useState(() => {
    const d = new Date(); d.setDate(1)
    return format(d, "yyyy-MM-dd")
  })
  const [dateTo, setDateTo] = React.useState(() => format(new Date(), "yyyy-MM-dd"))
  const [hoursData, setHoursData] = React.useState<HoursRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set())

  // Edit dialog
  const [editDialog, setEditDialog] = React.useState(false)
  const [editRecord, setEditRecord] = React.useState<HoursRecord | null>(null)
  const [editStart, setEditStart] = React.useState("")
  const [editEnd, setEditEnd] = React.useState("")
  const [editNotes, setEditNotes] = React.useState("")
  const [editDate, setEditDate] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const selectedDriver = drivers.find(d => d.id === selectedDriverId) || null

  // Fetch drivers
  React.useEffect(() => {
    if (!tenantId || !tenantFields?.drivers) return
    const DRV = tenantFields.drivers
    fetch(`/api/drivers?tenant=${tenantId}`)
      .then(r => r.json())
      .then(json => {
        const list = (json.records || [])
          .filter((r: any) => r.fields?.[DRV.DRIVER_TYPE] === "שכיר" || r.fields?.[DRV.DRIVER_TYPE] === "employee")
          .map((r: any) => ({
            id: r.id,
            name: `${r.fields?.[DRV.FIRST_NAME] || ""} ${r.fields?.[DRV.LAST_NAME] || ""}`.trim(),
            salaryConfig: (() => {
              try { return r.fields?.[(DRV as any).SALARY_CONFIG] ? JSON.parse(r.fields[(DRV as any).SALARY_CONFIG]) : null } catch { return null }
            })()
          }))
        setDrivers(list)
      })
      .catch(() => {})
  }, [tenantId, tenantFields])

  const fetchData = async () => {
    if (!selectedDriverId || !tenantId || !tenantFields) return
    setLoading(true)
    try {
      const DH = (tenantFields as any).driverHours
      const WS = tenantFields.workSchedule

      // Fetch hours records
      const hoursRes = await fetch(`/api/driver-hours?tenant=${tenantId}&driverId=${selectedDriverId}&dateFrom=${dateFrom}&dateTo=${dateTo}`)
      const hoursJson = await hoursRes.json()
      const hoursRecords = hoursJson.records || []

      // Fetch rides for the period
      const ridesRes = await fetch(`/api/work-schedule?tenant=${tenantId}&take=2000`)
      const ridesJson = await ridesRes.json()
      const allRides = (ridesJson.records || []).filter((r: any) => {
        const d = r.fields?.[WS.DATE]?.substring(0, 10)
        if (!d) return false
        const drivers = r.fields?.[WS.DRIVER]
        const hasDriver = Array.isArray(drivers) ? drivers.some((x: any) => x.id === selectedDriverId) : false
        return hasDriver && d >= dateFrom && d <= dateTo
      })

      // Build date map from hours records
      const hoursMap = new Map<string, any>()
      hoursRecords.forEach((r: any) => {
        const date = r.fields?.[DH.DATE]?.substring(0, 10)
        if (date) hoursMap.set(date, r)
      })

      // Build rides map by date
      const ridesMap = new Map<string, RideRecord[]>()
      allRides.forEach((r: any) => {
        const date = r.fields?.[WS.DATE]?.substring(0, 10)
        if (!date) return
        if (!ridesMap.has(date)) ridesMap.set(date, [])
        const vt = r.fields?.[WS.VEHICLE_TYPE]
        ridesMap.get(date)!.push({
          id: r.id,
          date,
          pickupTime: r.fields?.[WS.PICKUP_TIME] || "",
          description: r.fields?.[WS.DESCRIPTION] || "",
          dropoffTime: r.fields?.[WS.DROPOFF_TIME] || "",
          vehicleType: Array.isArray(vt) ? vt[0]?.title || "" : vt || ""
        })
      })

      // Collect all dates that have either hours or rides
      const allDates = new Set<string>([...hoursMap.keys(), ...ridesMap.keys()])
      const config = selectedDriver?.salaryConfig

      const result: HoursRecord[] = Array.from(allDates).sort().map(date => {
        const hr = hoursMap.get(date)
        const start = hr?.fields?.[DH.START_TIME] || ""
        const end = hr?.fields?.[DH.END_TIME] || ""
        const notes = hr?.fields?.[DH.NOTES] || ""
        const worked = calcHours(start, end)
        const shabbat = isShabbatDay(date)
        const pay = config ? calcPay(worked, config, shabbat) : 0
        return {
          id: hr?.id || "",
          date,
          startTime: start,
          endTime: end,
          notes,
          rides: ridesMap.get(date) || [],
          hoursWorked: worked,
          pay,
          isShabbat: shabbat
        }
      })

      setHoursData(result)
    } catch (e) {
      toast({ title: "שגיאה בטעינת נתונים", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (row: HoursRecord) => {
    setEditRecord(row)
    setEditDate(row.date)
    setEditStart(row.startTime)
    setEditEnd(row.endTime)
    setEditNotes(row.notes)
    setEditDialog(true)
  }

  const openNew = () => {
    setEditRecord(null)
    setEditDate(format(new Date(), "yyyy-MM-dd"))
    setEditStart("")
    setEditEnd("")
    setEditNotes("")
    setEditDialog(true)
  }

  const handleSave = async () => {
    if (!tenantId || !tenantFields || !selectedDriverId) return
    setSaving(true)
    try {
      const DH = (tenantFields as any).driverHours
      const fields: any = {
        [DH.DATE]: editDate ? `${editDate}T00:00:00.000Z` : undefined,
        [DH.START_TIME]: editStart,
        [DH.END_TIME]: editEnd,
        [DH.NOTES]: editNotes,
        [DH.DRIVER]: [selectedDriverId]
      }

      if (editRecord?.id) {
        await fetch(`/api/driver-hours?tenant=${tenantId}&id=${editRecord.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields })
        })
      } else {
        await fetch(`/api/driver-hours?tenant=${tenantId}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields })
        })
      }
      setEditDialog(false)
      await fetchData()
      toast({ title: "נשמר בהצלחה" })
    } catch {
      toast({ title: "שגיאה בשמירה", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row: HoursRecord) => {
    if (!row.id || !tenantId) return
    if (!confirm("למחוק את שורת השעות הזו?")) return
    await fetch(`/api/driver-hours?tenant=${tenantId}&id=${row.id}`, { method: "DELETE" })
    await fetchData()
  }

  const totalHours = hoursData.reduce((s, r) => s + r.hoursWorked, 0)
  const totalPay = hoursData.reduce((s, r) => s + r.pay, 0)
  const totalTravel = selectedDriver?.salaryConfig?.travelAllowance
    ? hoursData.filter(r => r.hoursWorked > 0).length * (selectedDriver.salaryConfig?.travelAllowance || 0)
    : 0

  const config = selectedDriver?.salaryConfig

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Filters */}
      <div className="border-b bg-background p-3 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">נהג</Label>
          <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
            <SelectTrigger className="w-48 h-8 text-sm">
              <SelectValue placeholder="בחר נהג..." />
            </SelectTrigger>
            <SelectContent>
              {drivers.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">מתאריך</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-sm w-36" />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">עד תאריך</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-sm w-36" />
        </div>
        <Button onClick={fetchData} disabled={!selectedDriverId || loading} size="sm" className="h-8">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "טען"}
        </Button>
        {hoursData.length > 0 && (
          <Button onClick={openNew} size="sm" variant="outline" className="h-8 mr-auto">
            <Plus className="h-4 w-4 ml-1" /> הוסף יום
          </Button>
        )}
      </div>

      {/* Salary config summary */}
      {selectedDriver && !config && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800">
          ⚠️ לנהג זה לא הוגדרו הגדרות שכר — לחישוב שכר יש להגדיר בדף נהגים
        </div>
      )}
      {config && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-800 flex gap-4 flex-wrap">
          <span>מודל: <b>{config.type === "daily_fixed" ? "יום קבוע" : config.type === "flat_hourly" ? "שעתי שטוח" : "שעתי עם שכבות"}</b></span>
          {config.type !== "daily_fixed" && <span>בסיס: <b>{config.baseHours} שעות</b></span>}
          {config.minimumHours > 0 && <span>מינימום: <b>{config.minimumHours} שעות</b></span>}
          {config.shabbatMultiplier > 1 && <span>שבת/חג: <b>×{config.shabbatMultiplier}</b></span>}
          {config.travelAllowance > 0 && <span>דמי נסיעה: <b>₪{config.travelAllowance}/יום</b></span>}
          <span className="font-medium">{config.grossOrNet === "gross" ? "ברוטו" : "נטו"}</span>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {hoursData.length === 0 && !loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {selectedDriverId ? "אין נתונים לתקופה הנבחרת" : "בחר נהג ולחץ טען"}
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="text-right w-8"></TableHead>
                <TableHead className="text-right">תאריך</TableHead>
                <TableHead className="text-right">התחלה</TableHead>
                <TableHead className="text-right">סיום</TableHead>
                <TableHead className="text-right">שעות</TableHead>
                <TableHead className="text-right">שכר</TableHead>
                <TableHead className="text-right">נסיעות</TableHead>
                <TableHead className="text-right">הערות</TableHead>
                <TableHead className="text-right w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hoursData.map(row => (
                <React.Fragment key={row.date}>
                  <TableRow className={row.isShabbat ? "bg-amber-50" : undefined}>
                    <TableCell className="p-1">
                      {row.rides.length > 0 && (
                        <button onClick={() => setExpandedRows(prev => {
                          const n = new Set(prev)
                          n.has(row.date) ? n.delete(row.date) : n.add(row.date)
                          return n
                        })} className="p-1 hover:bg-muted rounded">
                          {expandedRows.has(row.date) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {format(parseISO(row.date), "dd/MM/yyyy")}
                      {row.isShabbat && <span className="mr-1 text-xs text-amber-600">שבת</span>}
                    </TableCell>
                    <TableCell className="text-sm">{row.startTime || <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                    <TableCell className="text-sm">{row.endTime || <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {row.hoursWorked > 0 ? `${row.hoursWorked.toFixed(2)}ש׳` : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-green-700">
                      {row.pay > 0 ? `₪${row.pay.toFixed(2)}` : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.rides.length > 0 ? `${row.rides.length} נסיעות` : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{row.notes || ""}</TableCell>
                    <TableCell className="p-1">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(row)} className="p-1 hover:bg-muted rounded"><Pencil className="h-3 w-3" /></button>
                        {row.id && <button onClick={() => handleDelete(row)} className="p-1 hover:bg-muted rounded text-red-500"><Trash2 className="h-3 w-3" /></button>}
                      </div>
                    </TableCell>
                  </TableRow>
                  {/* Expanded rides */}
                  {expandedRows.has(row.date) && row.rides.map(ride => (
                    <TableRow key={ride.id} className="bg-muted/40">
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-xs text-muted-foreground">{ride.pickupTime}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{ride.dropoffTime}</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-xs" colSpan={2}>{ride.description} {ride.vehicleType && <span className="text-muted-foreground">• {ride.vehicleType}</span>}</TableCell>
                      <TableCell />
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Summary footer */}
      {hoursData.length > 0 && (
        <div className="border-t bg-muted/30 px-4 py-2 flex gap-6 text-sm font-medium">
          <span>סה״כ ימים: <b>{hoursData.length}</b></span>
          <span>סה״כ שעות: <b>{totalHours.toFixed(2)}</b></span>
          {config && <span className="text-green-700">סה״כ שכר: <b>₪{totalPay.toFixed(2)}</b></span>}
          {config && totalTravel > 0 && <span className="text-blue-700">+ דמי נסיעה: <b>₪{totalTravel.toFixed(2)}</b></span>}
          {config && <span className="text-green-800 font-bold">סה״כ לתשלום: ₪{(totalPay).toFixed(2)}</span>}
          <span className="text-muted-foreground text-xs mr-auto">{config?.grossOrNet === "net" ? "נטו" : "ברוטו"}</span>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editRecord?.id ? "עריכת שעות" : "הוספת יום עבודה"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs">תאריך</Label>
              <Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="h-8" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">שעת התחלה</Label>
                <Input type="time" value={editStart} onChange={e => setEditStart(e.target.value)} className="h-8" />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">שעת סיום</Label>
                <Input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)} className="h-8" />
              </div>
            </div>
            {editStart && editEnd && (
              <div className="text-sm text-muted-foreground">
                שעות: <b>{calcHours(editStart, editEnd).toFixed(2)}</b>
                {config && <span className="mr-2">שכר: <b className="text-green-700">₪{calcPay(calcHours(editStart, editEnd), config, isShabbatDay(editDate)).toFixed(2)}</b></span>}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Label className="text-xs">הערות</Label>
              <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} className="h-16 text-sm resize-none" />
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "שמור"}
            </Button>
            <Button variant="outline" onClick={() => setEditDialog(false)} size="sm">ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
