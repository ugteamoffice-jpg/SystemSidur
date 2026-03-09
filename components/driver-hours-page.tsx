"use client"
import * as React from "react"
import { format, parseISO } from "date-fns"
import { he } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useTenant, useTenantFields } from "@/lib/tenant-context"
import { Loader2, ChevronDown, ChevronUp, Pencil, Trash2, Plus, Calendar as CalendarIcon, SlidersHorizontal } from "lucide-react"

interface SalaryTier { upToHours: number | null; ratePerHour: number; label: string }
interface SalaryConfig {
  type: "hourly" | "flat_hourly" | "daily_fixed"
  grossOrNet: "gross" | "net"
  baseRate: number
  baseHours: number
  minimumHours: number
  tiers: SalaryTier[]
  dailyFixedRate: number
  shabbatMultiplier: number
  travelAllowance: number
}
interface DriverRecord { id: string; name: string; salaryConfig: SalaryConfig | null }
interface HoursRecord { id: string; date: string; startTime: string; endTime: string; notes: string; rides: RideRecord[]; hoursWorked: number; pay: number; isShabbat: boolean }
interface RideRecord { id: string; pickupTime: string; description: string; dropoffTime: string; vehicleType: string }

function calcHours(start: string, end: string): number {
  if (!start || !end) return 0
  const [sh, sm] = start.split(":").map(Number)
  const [eh, em] = end.split(":").map(Number)
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60
  return Math.round(mins / 60 * 100) / 100
}

function calcPay(hours: number, config: any, isShabbat: boolean): number {
  if (!config) return 0
  const effectiveHours = config.minimumHours > 0 ? Math.max(hours, config.minimumHours) : hours
  const baseRate = config.baseRate || 0
  let pay = 0
  if (config.type === "daily_fixed") {
    pay = config.dailyFixedRate
  } else if (config.type === "flat_hourly") {
    pay = effectiveHours * baseRate
  } else {
    // hourly with tiers using percentage
    let remaining = effectiveHours
    for (const tier of (config.tiers || [])) {
      if (remaining <= 0) break
      const h = tier.upToHours !== null ? Math.min(remaining, tier.upToHours) : remaining
      const rate = baseRate * ((tier.percentage ?? tier.ratePerHour / baseRate * 100) / 100)
      pay += h * rate
      remaining -= h
    }
  }
  if (isShabbat && config.shabbatMultiplier > 1) pay *= config.shabbatMultiplier
  pay += (config.travelAllowance || 0)
  return Math.round(pay * 100) / 100
}

function isShabbatDay(dateStr: string): boolean {
  try { return parseISO(dateStr).getDay() === 6 } catch { return false }
}

export function DriverHoursPage() {
  const { tenantId } = useTenant()
  const tenantFields = useTenantFields()
  const { toast } = useToast()

  const [drivers, setDrivers] = React.useState<DriverRecord[]>([])
  const [showFilterDialog, setShowFilterDialog] = React.useState(false)

  // Temp filter state (inside dialog)
  const [tempDriverId, setTempDriverId] = React.useState("")
  const [tempDateFrom, setTempDateFrom] = React.useState<Date | undefined>(undefined)
  const [tempDateTo, setTempDateTo] = React.useState<Date | undefined>(undefined)
  React.useEffect(() => {
    const d = new Date(); d.setDate(1)
    setTempDateFrom(d)
    setTempDateTo(new Date())
  }, [])
  const [startCalOpen, setStartCalOpen] = React.useState(false)
  const [endCalOpen, setEndCalOpen] = React.useState(false)

  // Applied filter state
  const [appliedDriverId, setAppliedDriverId] = React.useState("")
  const [appliedDateFrom, setAppliedDateFrom] = React.useState("")
  const [appliedDateTo, setAppliedDateTo] = React.useState("")

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

  const selectedDriver = drivers.find(d => d.id === appliedDriverId) || null

  React.useEffect(() => {
    setShowFilterDialog(true)
  }, [])

  // Fetch drivers (שכיר only)
  React.useEffect(() => {
    if (!tenantId || !tenantFields?.drivers) return
    const DRV = tenantFields.drivers
    fetch(`/api/drivers?tenant=${tenantId}`)
      .then(r => r.json())
      .then(json => {
        const list = (json.records || [])
          .map((r: any) => ({
            id: r.id,
            name: `${r.fields?.[DRV.FIRST_NAME] || ""} ${r.fields?.[DRV.LAST_NAME] || ""}`.trim(),
            driverType: r.fields?.[DRV.DRIVER_TYPE] || "",
            salaryConfig: (() => {
              try { return r.fields?.[(DRV as any).SALARY_CONFIG] ? JSON.parse(r.fields[(DRV as any).SALARY_CONFIG]) : null } catch { return null }
            })()
          }))
          .filter((d: any) => d.driverType === "שכיר" || d.driverType === "employee")
        setDrivers(list)
      })
  }, [tenantId, tenantFields])

  const applyFilter = async () => {
    if (!tempDriverId || !tempDateFrom || !tempDateTo) return
    const from = format(tempDateFrom, "yyyy-MM-dd")
    const to = format(tempDateTo, "yyyy-MM-dd")
    setAppliedDriverId(tempDriverId)
    setAppliedDateFrom(from)
    setAppliedDateTo(to)
    setShowFilterDialog(false)
    await fetchData(tempDriverId, from, to)
  }

  const fetchData = async (driverId: string, dateFrom: string, dateTo: string) => {
    if (!tenantId || !tenantFields) return
    setLoading(true)
    try {
      const DH = (tenantFields as any).driverHours
      const WS = tenantFields.workSchedule

      // Fetch hours
      const hoursRes = await fetch(`/api/driver-hours?tenant=${tenantId}&driverId=${driverId}&dateFrom=${dateFrom}&dateTo=${dateTo}`)
      const hoursJson = await hoursRes.json()

      // Fetch rides with pagination - 500 per page to stay within Teable limits
      const TAKE = 500
      let allRides: any[] = []
      let skip = 0
      while (true) {
        const res = await fetch(`/api/work-schedule?tenant=${tenantId}&take=${TAKE}&skip=${skip}`)
        if (!res.ok) {
          console.error('work-schedule fetch failed:', res.status)
          break
        }
        const json = await res.json()
        const records = json.records || []
        allRides = allRides.concat(records)
        if (records.length < TAKE) break
        skip += TAKE
      }
      const ridesJson = { records: allRides }

      const hoursMap = new Map<string, any>()
      ;(hoursJson.records || []).forEach((r: any) => {
        const date = r.fields?.[DH.DATE]?.substring(0, 10)
        if (date && date >= dateFrom && date <= dateTo) hoursMap.set(date, r)
      })

      const ridesMap = new Map<string, RideRecord[]>()
      ;(ridesJson.records || [])
        .filter((r: any) => {
          const d = r.fields?.[WS.DATE]?.substring(0, 10)
          const drvs = r.fields?.[WS.DRIVER]
          const driverMatch = Array.isArray(drvs)
            ? drvs.some((x: any) => x.id === driverId || x === driverId)
            : (typeof drvs === 'string' ? drvs === driverId : drvs?.id === driverId)
          return d && d >= dateFrom && d <= dateTo && driverMatch
        })
        .forEach((r: any) => {
          const date = r.fields?.[WS.DATE]?.substring(0, 10)
          if (!ridesMap.has(date)) ridesMap.set(date, [])
          const vt = r.fields?.[WS.VEHICLE_TYPE]
          ridesMap.get(date)!.push({
            id: r.id,
            pickupTime: r.fields?.[WS.PICKUP_TIME] || "",
            description: r.fields?.[WS.DESCRIPTION] || "",
            dropoffTime: r.fields?.[WS.DROPOFF_TIME] || "",
            vehicleType: Array.isArray(vt) ? vt[0]?.title || "" : vt || ""
          })
        })

      // DEBUG
      console.log("DEBUG | sample ride fields:", JSON.stringify(Object.entries(allRides[0]?.fields || {}).slice(0,6)))
      console.log("DEBUG | WS field ids:", JSON.stringify({DRIVER: WS.DRIVER, DATE: WS.DATE, PICKUP_TIME: WS.PICKUP_TIME, DESCRIPTION: WS.DESCRIPTION}))

      const allDates = new Set<string>([...hoursMap.keys(), ...ridesMap.keys()])
      const driver = drivers.find(d => d.id === driverId)
      const config = driver?.salaryConfig

      const result: HoursRecord[] = Array.from(allDates).sort().map(date => {
        const hr = hoursMap.get(date)
        const start = hr?.fields?.[DH.START_TIME] || ""
        const end = hr?.fields?.[DH.END_TIME] || ""
        const worked = calcHours(start, end)
        const shabbat = isShabbatDay(date)
        return {
          id: hr?.id || "",
          date, startTime: start, endTime: end,
          notes: hr?.fields?.[DH.NOTES] || "",
          rides: ridesMap.get(date) || [],
          hoursWorked: worked,
          pay: config ? calcPay(worked, config, shabbat) : 0,
          isShabbat: shabbat
        }
      })
      setHoursData(result)
    } catch {
      toast({ title: "שגיאה בטעינת נתונים", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (row: HoursRecord) => {
    setEditRecord(row); setEditDate(row.date)
    setEditStart(row.startTime); setEditEnd(row.endTime); setEditNotes(row.notes)
    setEditDialog(true)
  }
  const openNew = () => {
    setEditRecord(null); setEditDate(format(new Date(), "yyyy-MM-dd"))
    setEditStart(""); setEditEnd(""); setEditNotes(""); setEditDialog(true)
  }

  const handleSave = async () => {
    if (!tenantId || !tenantFields || !appliedDriverId) return
    setSaving(true)
    try {
      const DH = (tenantFields as any).driverHours
      const fields: any = {
        [DH.DATE]: editDate ? `${editDate}T00:00:00.000Z` : null,
        [DH.START_TIME]: editStart || null,
        [DH.END_TIME]: editEnd || null,
        [DH.NOTES]: editNotes || null,
        [DH.DRIVER]: [{ id: appliedDriverId }]
      }
      // Remove null fields
      Object.keys(fields).forEach(k => { if (fields[k] === null) delete fields[k] })
      if (editRecord?.id) {
        await fetch(`/api/driver-hours?tenant=${tenantId}&id=${editRecord.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields })
        })
      } else {
        await fetch(`/api/driver-hours?tenant=${tenantId}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields })
        })
      }
      setEditDialog(false)
      await fetchData(appliedDriverId, appliedDateFrom, appliedDateTo)
      toast({ title: "נשמר בהצלחה" })
    } catch { toast({ title: "שגיאה בשמירה", variant: "destructive" }) }
    finally { setSaving(false) }
  }

  const handleDelete = async (row: HoursRecord) => {
    if (!row.id || !tenantId || !confirm("למחוק שורה זו?")) return
    await fetch(`/api/driver-hours?tenant=${tenantId}&id=${row.id}`, { method: "DELETE" })
    await fetchData(appliedDriverId, appliedDateFrom, appliedDateTo)
  }

  const totalHours = hoursData.reduce((s, r) => s + r.hoursWorked, 0)
  const totalPay = hoursData.reduce((s, r) => s + r.pay, 0)
  const config = selectedDriver?.salaryConfig


  return (
    <div className="flex flex-col h-full" dir="rtl">

      {/* Filter Dialog */}
      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent className="sm:max-w-[420px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>חישוב שעות נהג</DialogTitle>
            <DialogDescription>בחר נהג וטווח תאריכים</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">

            <div className="space-y-2">
              <Label className="font-bold">נהג</Label>
              <Select value={tempDriverId} onValueChange={setTempDriverId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="בחר נהג שכיר..." />
                </SelectTrigger>
                <SelectContent>
                  {drivers.length === 0
                    ? <SelectItem value="_none" disabled>אין נהגים שכירים</SelectItem>
                    : drivers.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-bold">טווח תאריכים</Label>
              <div className="flex items-center gap-3">
                <Popover open={startCalOpen} onOpenChange={setStartCalOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start font-normal h-10">
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {tempDateFrom ? format(tempDateFrom, "dd/MM/yyyy") : "מתאריך"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={tempDateFrom} onSelect={d => { setTempDateFrom(d); setStartCalOpen(false) }} locale={he} dir="rtl" initialFocus />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground text-sm">עד</span>
                <Popover open={endCalOpen} onOpenChange={setEndCalOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex-1 justify-start font-normal h-10">
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {tempDateTo ? format(tempDateTo, "dd/MM/yyyy") : "עד תאריך"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={tempDateTo} onSelect={d => { setTempDateTo(d); setEndCalOpen(false) }} locale={he} dir="rtl" initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row-reverse gap-2">
            <Button onClick={applyFilter} disabled={!tempDriverId || !tempDateFrom || !tempDateTo}>
              הצג דוח
            </Button>
            {hoursData.length > 0 && (
              <Button variant="outline" onClick={() => setShowFilterDialog(false)}>ביטול</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Top bar */}
      <div className="border-b bg-background px-3 py-2 flex items-center gap-3">
        <Button variant="outline" size="sm" className="h-8" onClick={() => setShowFilterDialog(true)}>
          <SlidersHorizontal className="h-4 w-4 ml-1" />
          {appliedDriverId ? `${selectedDriver?.name || ""} • ${appliedDateFrom && format(parseISO(appliedDateFrom), "dd/MM/yy")} - ${appliedDateTo && format(parseISO(appliedDateTo), "dd/MM/yy")}` : "סינון"}
        </Button>
        {hoursData.length > 0 && (
          <Button onClick={openNew} size="sm" variant="outline" className="h-8 mr-auto">
            <Plus className="h-4 w-4 ml-1" /> הוסף יום
          </Button>
        )}
      </div>

      {/* Config warning */}
      {appliedDriverId && !config && !loading && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800">
          ⚠️ לנהג זה לא הוגדרו הגדרות שכר — לחישוב שכר יש להגדיר בדף נהגים
        </div>
      )}
      {config && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-800 flex gap-4 flex-wrap">
          <span>מודל: <b>{config.type === "daily_fixed" ? "יומית" : config.type === "flat_hourly" ? "שעתי קבוע" : "שעתי בסיס"}</b></span>
          {config.type !== "daily_fixed" && <span>בסיס: <b>{config.baseHours} שעות</b></span>}
          {config.minimumHours > 0 && <span>מינימום: <b>{config.minimumHours} שעות</b></span>}
          {config.shabbatMultiplier > 1 && <span>שבת/חג: <b>×{config.shabbatMultiplier}</b></span>}
          {config.travelAllowance > 0 && <span>דמי נסיעה: <b>₪{config.travelAllowance}/יום</b></span>}
          <span className="font-medium">{config.grossOrNet === "gross" ? "ברוטו" : "נטו"}</span>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : hoursData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            {appliedDriverId ? "אין נתונים לתקופה הנבחרת" : "בחר נהג ותאריכים"}
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
                {config && <TableHead className="text-right">שכר</TableHead>}
                <TableHead className="text-right">נסיעות</TableHead>
                <TableHead className="text-right">הערות</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hoursData.map(row => (
                <React.Fragment key={row.date}>
                  <TableRow className={row.isShabbat ? "bg-amber-50" : undefined}>
                    <TableCell className="p-1">
                      {row.rides.length > 0 && (
                        <button onClick={() => setExpandedRows(prev => { const n = new Set(prev); n.has(row.date) ? n.delete(row.date) : n.add(row.date); return n })} className="p-1 hover:bg-muted rounded">
                          {expandedRows.has(row.date) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {format(parseISO(row.date), "dd/MM/yyyy")}
                      {row.isShabbat && <span className="mr-1 text-xs text-amber-600">שבת</span>}
                    </TableCell>
                    <TableCell className="text-sm">{row.startTime || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">{row.endTime || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm font-medium">{row.hoursWorked > 0 ? `${row.hoursWorked.toFixed(2)}` : <span className="text-muted-foreground">—</span>}</TableCell>
                    {config && <TableCell className="text-sm font-medium text-green-700">{row.pay > 0 ? `₪${row.pay.toFixed(2)}` : <span className="text-muted-foreground">—</span>}</TableCell>}
                    <TableCell className="text-sm text-muted-foreground">{row.rides.length > 0 ? `${row.rides.length}` : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate">{row.notes}</TableCell>
                    <TableCell className="p-1">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(row)} className="p-1 hover:bg-muted rounded"><Pencil className="h-3 w-3" /></button>
                        {row.id && <button onClick={() => handleDelete(row)} className="p-1 hover:bg-muted rounded text-red-500"><Trash2 className="h-3 w-3" /></button>}
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedRows.has(row.date) && row.rides.map(ride => (
                    <TableRow key={ride.id} className="bg-muted/40 text-xs">
                      <TableCell className="text-muted-foreground pr-6">
                        <div className="flex flex-col">
                          <span>{ride.description}</span>
                          {ride.vehicleType && <span className="text-muted-foreground/70">{ride.vehicleType}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{ride.pickupTime}</TableCell>
                      <TableCell className="text-muted-foreground">{ride.dropoffTime}</TableCell>
                      <TableCell colSpan={config ? 5 : 4} />
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
        <div className="border-t bg-muted/30 px-4 py-2 flex gap-6 text-sm font-medium flex-wrap">
          <span>סה״כ ימים: <b>{hoursData.length}</b></span>
          <span>סה״כ שעות: <b>{totalHours.toFixed(2)}</b></span>
          {config && <span className="text-green-800 font-bold">סה״כ לתשלום: ₪{totalPay.toFixed(2)}</span>}
          {config && <span className="text-muted-foreground text-xs">{config.grossOrNet === "net" ? "נטו" : "ברוטו"}</span>}
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
              <div className="text-sm text-muted-foreground bg-muted/40 rounded p-2">
                שעות: <b>{calcHours(editStart, editEnd).toFixed(2)}</b>
                {config && <span className="mr-3">שכר משוער: <b className="text-green-700">₪{calcPay(calcHours(editStart, editEnd), config, isShabbatDay(editDate)).toFixed(2)}</b></span>}
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
