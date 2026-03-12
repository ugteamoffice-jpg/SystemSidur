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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useTenant, useTenantFields } from "@/lib/tenant-context"
import { Loader2, Calendar as CalendarIcon, SlidersHorizontal, ChevronRight, ChevronLeft } from "lucide-react"

interface SalaryConfig {
  type: "hourly" | "flat_hourly" | "daily_fixed"
  grossOrNet: "gross" | "net"
  baseRate: number
  baseHours: number
  minimumHours: number
  tiers: { upToHours: number | null; percentage?: number; ratePerHour?: number; label: string }[]
  dailyFixedRate: number
  shabbatMultiplier: number
  travelAllowance: number
}
interface DriverRecord { id: string; name: string; salaryConfig: SalaryConfig | null }
interface RideRecord { id: string; pickupTime: string; description: string; dropoffTime: string; vehicleType: string }
interface HoursRecord { id: string; date: string; startTime: string; endTime: string; notes: string; rides: RideRecord[]; hoursWorked: number; pay: number; isShabbat: boolean }

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
    pay = hours * baseRate
  } else {
    let remaining = effectiveHours
    for (const tier of (config.tiers || [])) {
      if (remaining <= 0) break
      const h = tier.upToHours !== null ? Math.min(remaining, tier.upToHours) : remaining
      const rate = baseRate * ((tier.percentage ?? ((tier.ratePerHour || 0) / (baseRate || 1) * 100)) / 100)
      pay += h * rate
      remaining -= h
    }
  }
  if (isShabbat && config.shabbatMultiplier > 1) pay *= config.shabbatMultiplier
  pay += (config.travelAllowance || 0)
  return Math.round(pay * 100) / 100
}

function calcTierBreakdown(hours: number, config: any): { label: string; hours: number; rate: number; pay: number }[] {
  if (!config || config.type !== "hourly") return []
  const baseRate = config.baseRate || 0
  const result = []
  let remaining = hours
  for (const tier of (config.tiers || [])) {
    if (remaining <= 0) break
    const h = tier.upToHours !== null ? Math.min(remaining, tier.upToHours) : remaining
    if (h <= 0) continue
    const pct = tier.percentage ?? ((tier.ratePerHour || 0) / (baseRate || 1) * 100)
    const rate = baseRate * pct / 100
    result.push({ label: tier.label || `${pct}%`, hours: h, rate, pay: h * rate })
    remaining -= h
  }
  return result
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
  const [tempDriverId, setTempDriverId] = React.useState("")
  const [tempDateFrom, setTempDateFrom] = React.useState<Date | undefined>(undefined)
  const [tempDateTo, setTempDateTo] = React.useState<Date | undefined>(undefined)
  const [startCalOpen, setStartCalOpen] = React.useState(false)
  const [endCalOpen, setEndCalOpen] = React.useState(false)
  const [appliedDriverId, setAppliedDriverId] = React.useState("")
  const [appliedDateFrom, setAppliedDateFrom] = React.useState("")
  const [appliedDateTo, setAppliedDateTo] = React.useState("")
  const [hoursData, setHoursData] = React.useState<HoursRecord[]>([])
  const [loading, setLoading] = React.useState(false)

  // Day dialog
  const [dayDialog, setDayDialog] = React.useState(false)
  const [dayIndex, setDayIndex] = React.useState(0)
  const [editStart, setEditStart] = React.useState("")
  const [editEnd, setEditEnd] = React.useState("")
  const [editNotes, setEditNotes] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const selectedDriver = drivers.find(d => d.id === appliedDriverId) || null
  const config = selectedDriver?.salaryConfig
  const currentRow = hoursData[dayIndex] || null

  React.useEffect(() => {
    const d = new Date(); d.setDate(1)
    setTempDateFrom(d)
    setTempDateTo(new Date())
    setShowFilterDialog(true)
  }, [])

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
      const hoursRes = await fetch(`/api/driver-hours?tenant=${tenantId}&driverId=${driverId}`)
      const hoursJson = await hoursRes.json()

      const TAKE = 500
      let allRides: any[] = []
      let skip = 0
      while (true) {
        const res = await fetch(`/api/work-schedule?tenant=${tenantId}&take=${TAKE}&skip=${skip}`)
        if (!res.ok) break
        const json = await res.json()
        const records = json.records || []
        allRides = allRides.concat(records)
        if (records.length < TAKE) break
        skip += TAKE
      }

      const hoursMap = new Map<string, any>()
      ;(hoursJson.records || []).forEach((r: any) => {
        const date = r.fields?.[DH.DATE]?.substring(0, 10)
        if (!date || date < dateFrom || date > dateTo) return
        // Filter by driver client-side (link field)
        const drvs = r.fields?.[DH.DRIVER]
        // If Teable doesn't return the link field (undefined), trust server-side filter and include
        const match = !drvs || (Array.isArray(drvs)
          ? drvs.some((x: any) => x.id === driverId || x === driverId)
          : (typeof drvs === "string" ? drvs === driverId : drvs?.id === driverId))
        if (match) hoursMap.set(date, r)
      })

      const ridesMap = new Map<string, RideRecord[]>()
      allRides
        .filter((r: any) => {
          const d = r.fields?.[WS.DATE]?.substring(0, 10)
          const drvs = r.fields?.[WS.DRIVER]
          const match = Array.isArray(drvs)
            ? drvs.some((x: any) => x.id === driverId || x === driverId)
            : (typeof drvs === "string" ? drvs === driverId : drvs?.id === driverId)
          return d && d >= dateFrom && d <= dateTo && match
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

      const allDates = new Set<string>([...hoursMap.keys(), ...ridesMap.keys()])
      const driver = drivers.find(d => d.id === driverId) || null
      const cfg = driver?.salaryConfig

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
          rides: (ridesMap.get(date) || []).sort((a, b) => a.pickupTime.localeCompare(b.pickupTime)),
          hoursWorked: worked,
          pay: cfg ? calcPay(worked, cfg, shabbat) : 0,
          isShabbat: shabbat
        }
      })
      setHoursData(result)
      return result
    } catch {
      toast({ title: "שגיאה בטעינת נתונים", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const openDayDialog = (index: number) => {
    const row = hoursData[index]
    if (!row) return
    setDayIndex(index)
    setEditStart(row.startTime)
    setEditEnd(row.endTime)
    setEditNotes(row.notes)
    setDayDialog(true)
  }

  const handleSave = async (nextIndex?: number) => {
    if (!tenantId || !tenantFields || !appliedDriverId || !currentRow) return
    setSaving(true)
    try {
      const DH = (tenantFields as any).driverHours
      const row = hoursData[dayIndex]
      console.log('handleSave: row.id=', row.id, 'editStart=', editStart, 'editEnd=', editEnd)
      const fields: any = {
        [DH.DATE]: row.date ? `${row.date}T00:00:00.000Z` : undefined,
        [DH.START_TIME]: editStart || undefined,
        [DH.END_TIME]: editEnd || undefined,
        [DH.NOTES]: editNotes || undefined,
        [DH.DRIVER]: [appliedDriverId]
      }
      Object.keys(fields).forEach(k => { if (fields[k] === undefined) delete fields[k] })

      if (row.id) {
        const res = await fetch(`/api/driver-hours?tenant=${tenantId}&id=${row.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields })
        })
        if (!res.ok) { const err = await res.text(); throw new Error(`PATCH failed: ${res.status} ${err}`) }
      } else {
        const res = await fetch(`/api/driver-hours?tenant=${tenantId}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields })
        })
        if (!res.ok) { const err = await res.text(); throw new Error(`POST failed: ${res.status} ${err}`) }
      }

      // Update local state directly — no re-fetch (Teable link field filter unreliable)
      setHoursData(prev => {
        const updated = [...prev]
        const idx = updated.findIndex(r => r.date === row.date)
        if (idx !== -1) {
          const worked = calcHours(editStart, editEnd)
          const driver = drivers.find(d => d.id === appliedDriverId) || null
          const cfg = driver?.salaryConfig
          const shabbat = updated[idx].isShabbat
          updated[idx] = {
            ...updated[idx],
            startTime: editStart,
            endTime: editEnd,
            notes: editNotes,
            hoursWorked: worked,
            pay: cfg ? calcPay(worked, cfg, shabbat) : 0
          }
        }
        return updated
      })
      toast({ title: "נשמר" })

      if (nextIndex !== undefined) {
        const nextRow = hoursData[nextIndex]
        if (nextRow) {
          setDayIndex(nextIndex)
          setEditStart(nextRow.startTime)
          setEditEnd(nextRow.endTime)
          setEditNotes(nextRow.notes)
        }
      } else {
        setDayDialog(false)
      }
    } catch {
      toast({ title: "שגיאה בשמירה", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const navigateDay = (dir: 1 | -1) => {
    const next = dayIndex + dir
    if (next < 0 || next >= hoursData.length) return
    handleSave(next)
  }

  const totalHours = hoursData.reduce((s, r) => s + r.hoursWorked, 0)
  const totalPay = hoursData.reduce((s, r) => s + r.pay, 0)

  return (
    <div className="flex flex-col h-full" dir="rtl">

      {/* Filter Dialog */}
      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent className="sm:max-w-[420px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>חישוב שעות נהג</DialogTitle>
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
          <div className="flex gap-2 justify-end pt-2">
            <Button onClick={applyFilter} disabled={!tempDriverId || !tempDateFrom || !tempDateTo}>הצג דוח</Button>
            {hoursData.length > 0 && <Button variant="outline" onClick={() => setShowFilterDialog(false)}>ביטול</Button>}
          </div>
        </DialogContent>
      </Dialog>

      {/* Top bar */}
      <div className="border-b bg-background px-3 py-2 flex items-center gap-3">
        <Button variant="outline" size="sm" className="h-8" onClick={() => setShowFilterDialog(true)}>
          <SlidersHorizontal className="h-4 w-4 ml-1" />
          {appliedDriverId
            ? `${selectedDriver?.name || ""} • ${appliedDateFrom && format(parseISO(appliedDateFrom), "dd/MM/yy")} - ${appliedDateTo && format(parseISO(appliedDateTo), "dd/MM/yy")}`
            : "סינון"}
        </Button>
      </div>

      {/* Config banner */}
      {appliedDriverId && !config && !loading && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800">
          ⚠️ לנהג זה לא הוגדרו הגדרות שכר — לחישוב שכר יש להגדיר בדף נהגים
        </div>
      )}
      {config && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-800 flex gap-3 flex-wrap items-center">
          <span>מודל: <b>{config.type === "daily_fixed" ? "יומית" : config.type === "flat_hourly" ? "שעתי קבוע" : "שעתי בסיס"}</b></span>
          <span className="text-blue-300">|</span>
          {config.type === "daily_fixed" && (
            <span><b>₪{config.dailyFixedRate}</b>/יום</span>
          )}
          {config.type === "flat_hourly" && (
            <span><b>₪{config.baseRate}</b>/שעה</span>
          )}
          {config.type === "hourly" && config.tiers && config.tiers.length > 0 && (() => {
            const baseRate = config.baseRate || 0
            let remaining = 99
            return config.tiers.map((tier, i) => {
              const h = tier.upToHours !== null ? Math.min(remaining, tier.upToHours) : remaining
              remaining = Math.max(0, remaining - h)
              const pct = tier.percentage ?? Math.round((tier.ratePerHour || 0) / (baseRate || 1) * 100)
              const rate = Math.round(baseRate * pct / 100 * 100) / 100
              const hoursLabel = tier.upToHours !== null ? `${h} שעות` : `מעל ${config.tiers[i-1]?.upToHours || 0} שעות`
              return (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-blue-300 mx-1">|</span>}
                  <b>{hoursLabel}</b> × <b>₪{rate}</b>
                  <span className="text-blue-500 text-xs">({pct}%)</span>
                </span>
              )
            })
          })()}
          <span className="text-blue-300">|</span>
          {config.shabbatMultiplier > 1 && <><span>שבת/חג: <b>×{config.shabbatMultiplier}</b></span><span className="text-blue-300">|</span></>}
          {config.travelAllowance > 0 && <><span>נסיעות: <b>₪{config.travelAllowance}/יום</b></span><span className="text-blue-300">|</span></>}
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
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b-2 border-border">
                <th className="text-right px-3 py-2 font-semibold border-l border-border w-28">תאריך</th>
                <th className="text-right px-3 py-2 font-semibold border-l border-border w-32 whitespace-nowrap">סה״כ נסיעות</th>
                <th className="text-right px-3 py-2 font-semibold border-l border-border w-20">התחלה</th>
                <th className="text-right px-3 py-2 font-semibold border-l border-border w-20">סיום</th>
                <th className="text-right px-3 py-2 font-semibold border-l border-border w-32 whitespace-nowrap">סה״כ שעות</th>
                {config && <th className="text-right px-3 py-2 font-semibold border-l border-border w-32 whitespace-nowrap">סה״כ שכר</th>}
                <th className="text-right px-3 py-2 font-semibold">הערות</th>
              </tr>
            </thead>
            <tbody>
              {hoursData.map((row, idx) => (
                <tr
                  key={row.date}
                  className={`cursor-pointer hover:bg-muted/60 transition-colors border-b border-border ${row.isShabbat ? "bg-amber-50 hover:bg-amber-100" : ""}`}
                  onClick={() => openDayDialog(idx)}
                >
                  <td className="px-3 py-2 font-medium border-l border-border">
                    {format(parseISO(row.date), "dd/MM/yyyy")}
                    {row.isShabbat && <span className="mr-2 text-xs text-amber-600">שבת</span>}
                  </td>
                  <td className="px-3 py-2 text-right border-l border-border">
                    {row.rides.length > 0
                      ? <span className="font-medium">{row.rides.length}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 border-l border-border">{row.startTime || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2 border-l border-border">{row.endTime || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2 font-medium border-l border-border">{row.hoursWorked > 0 ? row.hoursWorked.toFixed(2) : <span className="text-muted-foreground">—</span>}</td>
                  {config && <td className="px-3 py-2 font-medium text-green-700 border-l border-border">{row.pay > 0 ? `₪${row.pay.toFixed(2)}` : <span className="text-muted-foreground">—</span>}</td>}
                  <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary footer */}
      {hoursData.length > 0 && (() => {
        const workedDays = hoursData.filter(r => r.hoursWorked > 0).length
        return (
          <div className="border-t bg-muted/30 px-4 py-2 flex gap-4 text-sm font-medium flex-wrap items-center">
            <span>סה״כ ימים: <b>{workedDays}</b></span>
            {config?.type === "hourly" && (() => {
              // Aggregate tier hours+pay across all days
              const tierTotals = new Map<string, { hours: number; rate: number; pay: number }>()
              hoursData.forEach(r => {
                if (r.hoursWorked <= 0) return
                calcTierBreakdown(r.hoursWorked, config).forEach(t => {
                  const key = t.label
                  const existing = tierTotals.get(key) || { hours: 0, rate: t.rate, pay: 0 }
                  tierTotals.set(key, { hours: existing.hours + t.hours, rate: t.rate, pay: existing.pay + t.pay })
                })
              })
              return Array.from(tierTotals.entries()).map(([label, t]) => (
                <span key={label} className="text-blue-800">
                  <b>{label}</b>: {t.hours.toFixed(1)}ש × ₪{t.rate.toFixed(0)} = <b>₪{t.pay.toFixed(0)}</b>
                </span>
              ))
            })()}
            {config?.type === "flat_hourly" && (
              <span>סה״כ שעות: <b>{totalHours.toFixed(2)}</b></span>
            )}
            {config && <span className="text-green-800 font-bold">סה״כ לתשלום: ₪{totalPay.toFixed(2)}</span>}
            {config && <span className="text-muted-foreground text-xs">{config.grossOrNet === "net" ? "נטו" : "ברוטו"}</span>}
          </div>
        )
      })()}

      {/* Day Dialog */}
      {currentRow && (
        <Dialog open={dayDialog} onOpenChange={setDayDialog}>
          <DialogContent style={{maxWidth:"96vw",width:"96vw",height:"88vh",display:"flex",flexDirection:"column",overflow:"hidden",fontFamily:'"Varela Round", ui-rounded, system-ui, sans-serif'}} dir="rtl">
            {/* Navigation header */}
            <div className="flex items-center justify-between border-b pb-3 mb-2">
              <Button variant="ghost" size="icon" onClick={() => navigateDay(-1)} disabled={dayIndex === 0 || saving}>
                <ChevronRight className="h-5 w-5" />
              </Button>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {format(parseISO(currentRow.date), "EEEE, dd/MM/yyyy", { locale: he })}
                  {currentRow.isShabbat && <span className="mr-2 text-sm text-amber-600 font-normal">שבת</span>}
                </div>

              </div>
              <Button variant="ghost" size="icon" onClick={() => navigateDay(1)} disabled={dayIndex === hoursData.length - 1 || saving}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid grid-cols-5 gap-6 flex-1 overflow-hidden">
              {/* Right - rides (3 cols) */}
              <div className="col-span-3 space-y-2 flex flex-col overflow-hidden">
                <div className="text-base font-bold text-muted-foreground">נסיעות ({currentRow.rides.length})</div>
                {currentRow.rides.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg">אין נסיעות ביום זה</div>
                ) : (
                  <div className="border rounded-lg overflow-hidden flex-1 overflow-y-auto">
                    <table style={{width:"100%",fontSize:"15px",borderCollapse:"collapse",fontFamily:'"Varela Round", ui-rounded, system-ui, sans-serif'}}>
                      <thead style={{background:"#f4f4f5",position:"sticky",top:0}}>
                        <tr>
                          <th style={{textAlign:"right",padding:"10px 14px",fontWeight:600,fontSize:"15px",borderBottom:"1px solid #e2e8f0",borderLeft:"1px solid #e2e8f0"}}>תאריך</th>
                          <th style={{textAlign:"right",padding:"10px 14px",fontWeight:600,fontSize:"15px",borderBottom:"1px solid #e2e8f0",borderLeft:"1px solid #e2e8f0"}}>הלוך</th>
                          <th style={{textAlign:"right",padding:"10px 14px",fontWeight:600,fontSize:"15px",borderBottom:"1px solid #e2e8f0",borderLeft:"1px solid #e2e8f0"}}>מסלול</th>
                          <th style={{textAlign:"right",padding:"10px 14px",fontWeight:600,fontSize:"15px",borderBottom:"1px solid #e2e8f0"}}>חזור</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentRow.rides.map((ride, i) => (
                          <tr key={ride.id} style={{background: i % 2 === 0 ? "#ffffff" : "#f9fafb", borderBottom:"1px solid #e2e8f0"}}>
                            <td style={{padding:"10px 14px",color:"#64748b",fontSize:"15px",whiteSpace:"nowrap",borderLeft:"1px solid #e2e8f0"}}>{format(parseISO(currentRow.date), "dd/MM/yy")}</td>
                            <td style={{padding:"10px 14px",color:"#64748b",fontSize:"15px",whiteSpace:"nowrap",borderLeft:"1px solid #e2e8f0"}}>{ride.pickupTime || "—"}</td>
                            <td style={{padding:"10px 14px",fontWeight:500,fontSize:"15px",borderLeft:"1px solid #e2e8f0"}}>{ride.description}</td>
                            <td style={{padding:"10px 14px",color:"#64748b",fontSize:"15px",whiteSpace:"nowrap"}}>{ride.dropoffTime || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Left - time inputs (2 cols) */}
              <div className="col-span-2 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-base font-bold">שעת התחלה</Label>
                    <Input type="time" value={editStart} onChange={e => setEditStart(e.target.value)} className="h-12 text-lg" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-base font-bold">שעת סיום</Label>
                    <Input type="time" value={editEnd} onChange={e => setEditEnd(e.target.value)} className="h-12 text-lg" />
                  </div>
                </div>

                {editStart && editEnd && (() => {
                  const hrs = calcHours(editStart, editEnd)
                  const breakdown = config ? calcTierBreakdown(hrs, config) : []
                  const totalPayAmt = config ? calcPay(hrs, config, currentRow.isShabbat) : 0
                  return (
                    <div className="bg-muted/40 rounded-lg p-4 space-y-3 border">
                      <div className="flex justify-between text-lg font-medium">
                        <span className="text-muted-foreground">סה״כ שעות</span>
                        <b>{hrs.toFixed(2)}</b>
                      </div>
                      {breakdown.length > 0 && (
                        <div className="border-t pt-3 space-y-2">
                          {breakdown.map((t, i) => (
                            <div key={i} className="flex justify-between text-base">
                              <span className="text-muted-foreground">{t.label} ({t.hours.toFixed(2)}ש׳ × ₪{t.rate.toFixed(2)})</span>
                              <span className="font-medium">₪{t.pay.toFixed(2)}</span>
                            </div>
                          ))}
                          {currentRow.isShabbat && config?.shabbatMultiplier > 1 && (
                            <div className="text-base text-amber-600">× {config.shabbatMultiplier} שבת/חג</div>
                          )}
                          {config?.travelAllowance > 0 && (
                            <div className="flex justify-between text-base">
                              <span className="text-muted-foreground">דמי נסיעה</span>
                              <span className="font-medium">₪{config.travelAllowance}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {config && (
                        <div className="flex justify-between border-t pt-3 font-bold text-lg">
                          <span>סה״כ שכר</span>
                          <span className="text-green-700">₪{totalPayAmt.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )
                })()}

                <div className="space-y-1">
                  <Label className="text-base font-bold">הערות</Label>
                  <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} className="h-24 resize-none text-base" placeholder="הערות..." />
                </div>

                <Button onClick={() => handleSave()} disabled={saving} className="w-full h-10">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "שמור"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
