"use client"

import * as React from "react"
import { CalendarCheck, Calendar as CalendarIcon, Loader2, Search, CheckSquare, Square } from "lucide-react"
import { format, addDays, eachDayOfInterval } from "date-fns"
import { he } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import {
  Popover, PopoverContent, PopoverTrigger
} from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { useTenant, useTenantFields } from "@/lib/tenant-context"
import {
  RecurringRide, loadRecurringRides, getSettingsForDay, DAY_NAMES_HE, DAY_LETTERS_HE
} from "@/lib/recurring-rides"

interface AutoAssignDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentDate: Date
  existingRecords: any[]
  onComplete: () => void
}

export function AutoAssignDialog({ open, onOpenChange, currentDate, existingRecords, onComplete }: AutoAssignDialogProps) {
  const { tenantId } = useTenant()
  const tenantFields = useTenantFields()
  const WS = tenantFields?.workSchedule || {} as any
  const { toast } = useToast()

  const [startDate, setStartDate] = React.useState<Date>(currentDate)
  const [endDate, setEndDate] = React.useState<Date>(currentDate)
  const [startMonth, setStartMonth] = React.useState<Date>(currentDate)
  const [endMonth, setEndMonth] = React.useState<Date>(currentDate)
  const [searchFilter, setSearchFilter] = React.useState("")
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [templates, setTemplates] = React.useState<RecurringRide[]>([])
  const [loading, setLoading] = React.useState(false)
  const [startCalOpen, setStartCalOpen] = React.useState(false)
  const [endCalOpen, setEndCalOpen] = React.useState(false)
  const [progress, setProgress] = React.useState({ current: 0, total: 0 })

  // Load templates when dialog opens
  React.useEffect(() => {
    if (open) {
      const rides = loadRecurringRides(tenantId).filter(r => r.active)
      setTemplates(rides)
      setSelectedIds(new Set(rides.map(r => r.id)))
      setStartDate(currentDate)
      setEndDate(currentDate)
      setStartMonth(currentDate)
      setEndMonth(currentDate)
      setSearchFilter("")
    }
  }, [open, tenantId, currentDate])

  const filtered = templates.filter(t => {
    if (!searchFilter) return true
    const q = searchFilter.toLowerCase()
    return t.customerName.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.defaults.driverName.toLowerCase().includes(q)
  })

  const toggleTemplate = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedIds(new Set(filtered.map(t => t.id)))
  const deselectAll = () => {
    const filteredIds = new Set(filtered.map(t => t.id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      filteredIds.forEach(id => next.delete(id))
      return next
    })
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every(t => selectedIds.has(t.id))

  const handleAssign = async () => {
    const selected = templates.filter(t => selectedIds.has(t.id))
    if (selected.length === 0) {
      toast({ title: "שגיאה", description: "לא נבחרו תבניות", variant: "destructive" })
      return
    }

    if (startDate > endDate) {
      toast({ title: "שגיאה", description: "תאריך ההתחלה חייב להיות לפני תאריך הסיום", variant: "destructive" })
      return
    }

    setLoading(true)
    let created = 0
    let skipped = 0

    try {
      const days = eachDayOfInterval({ start: startDate, end: endDate })

      // חישוב סה"כ פריטים
      let totalItems = 0
      for (const day of days) {
        totalItems += selected.filter(t => t.activeDays.includes(day.getDay())).length
      }
      setProgress({ current: 0, total: totalItems })
      let processed = 0

      for (const day of days) {
        const dayOfWeek = day.getDay()
        const dateStr = format(day, "yyyy-MM-dd")

        const dayTemplates = selected.filter(t => t.activeDays.includes(dayOfWeek))

        for (const t of dayTemplates) {
          const settings = getSettingsForDay(t, dayOfWeek)

          const isDuplicate = existingRecords.some(r =>
            r.fields[WS.DATE] === dateStr &&
            r.fields[WS.DESCRIPTION] === t.description &&
            r.fields[WS.PICKUP_TIME] === settings.pickupTime
          )

          if (isDuplicate) {
            skipped++
            processed++
            setProgress({ current: processed, total: totalItems })
            continue
          }

          const payload: any = {
            fields: {
              [WS.DATE]: dateStr,
              [WS.DESCRIPTION]: t.description,
              [WS.PICKUP_TIME]: settings.pickupTime || null,
              [WS.DROPOFF_TIME]: settings.dropoffTime || null,
              [WS.VEHICLE_NUM]: settings.vehicleNum || null,
              [WS.MANAGER_NOTES]: settings.managerNotes || null,
              [WS.DRIVER_NOTES]: settings.driverNotes || null,
              [WS.ORDER_NAME]: t.orderName || null,
              [WS.MOBILE]: t.mobile || null,
              [WS.ID_NUM]: t.idNum ? Number(t.idNum) : null,
              [WS.PRICE_CLIENT_EXCL]: settings.clientExcl ? parseFloat(settings.clientExcl) : null,
              [WS.PRICE_CLIENT_INCL]: settings.clientIncl ? parseFloat(settings.clientIncl) : null,
              [WS.PRICE_DRIVER_EXCL]: settings.driverExcl ? parseFloat(settings.driverExcl) : null,
              [WS.PRICE_DRIVER_INCL]: settings.driverIncl ? parseFloat(settings.driverIncl) : null,
              [WS.CUSTOMER]: t.customerId ? [t.customerId] : null,
              [WS.DRIVER]: settings.driverId ? [settings.driverId] : null,
              [WS.VEHICLE_TYPE]: settings.vehicleTypeId ? [settings.vehicleTypeId] : null,
            }
          }
          Object.keys(payload.fields).forEach(k => payload.fields[k] === undefined && delete payload.fields[k])

          let res: Response | null = null
          for (let attempt = 0; attempt < 3; attempt++) {
            res = await fetch(`/api/work-schedule?tenant=${tenantId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            })
            if (res.ok) { created++; break }
            // נכשל — חכה וננסה שוב
            await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
          }
          if (res && !res.ok) { const errText = await res.text().catch(() => ""); console.warn(`Auto-assign POST failed after retries ${res.status}:`, errText) }
          processed++
          setProgress({ current: processed, total: totalItems })
          // השהיה קצרה למניעת עומס על השרת
          await new Promise(r => setTimeout(r, 250))
        }
      }

      const failed = processed - created - skipped
      const parts = [`נוצרו ${created} נסיעות`]
      if (skipped > 0) parts.push(`${skipped} דולגו (כפילויות)`)
      if (failed > 0) parts.push(`${failed} נכשלו`)
      toast({ title: "שיבוץ הושלם", description: parts.join(", ") })
      onOpenChange(false)
      onComplete()
    } catch (err) {
      console.error("Auto-assign error:", err)
      toast({ title: "שגיאה", description: "לא הצלחנו ליצור חלק מהנסיעות", variant: "destructive" })
    } finally {
      setLoading(false)
      setProgress({ current: 0, total: 0 })
    }
  }

  // Count how many rides will be created
  const getEstimate = () => {
    if (startDate > endDate) return 0
    const selected = templates.filter(t => selectedIds.has(t.id))
    const days = eachDayOfInterval({ start: startDate, end: endDate })
    let count = 0
    for (const day of days) {
      const dow = day.getDay()
      count += selected.filter(t => t.activeDays.includes(dow)).length
    }
    return count
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" /> שיבוץ אוטומטי
          </DialogTitle>
          <DialogDescription>בחר טווח תאריכים ותבניות לשיבוץ</DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden space-y-3">
          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">מתאריך</Label>
              <Popover open={startCalOpen} onOpenChange={setStartCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-right text-sm h-9">
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {format(startDate, "EEEE '|' d.M", { locale: he })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate}
                    onSelect={(d) => { if (d) { setStartDate(d); setStartCalOpen(false) } }}
                    month={startMonth} onMonthChange={setStartMonth}
                    locale={he} dir="rtl" fixedWeeks />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-sm">עד תאריך</Label>
              <Popover open={endCalOpen} onOpenChange={setEndCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-right text-sm h-9">
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {format(endDate, "EEEE '|' d.M", { locale: he })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate}
                    onSelect={(d) => { if (d) { setEndDate(d); setEndCalOpen(false) } }}
                    month={endMonth} onMonthChange={setEndMonth}
                    locale={he} dir="rtl" fixedWeeks />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
              placeholder="חיפוש לקוח, מסלול, נהג..." className="pr-9 text-right h-9" />
          </div>

          {/* Select All / None */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{selectedIds.size} מתוך {templates.length} נבחרו</span>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-orange-600 hover:underline text-xs">סמן הכל</button>
              <button onClick={deselectAll} className="text-orange-600 hover:underline text-xs">בטל הכל</button>
            </div>
          </div>

          {/* Template List */}
          <div className="flex-1 overflow-auto border rounded-lg">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                {templates.length === 0 ? "אין תבניות פעילות" : "לא נמצאו תוצאות"}
              </div>
            ) : (
              filtered.map(t => (
                <div key={t.id}
                  onClick={() => toggleTemplate(t.id)}
                  className={`flex items-center gap-3 p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedIds.has(t.id) ? "" : "opacity-40"
                  }`}>
                  {selectedIds.has(t.id)
                    ? <CheckSquare className="h-5 w-5 text-orange-600 shrink-0" />
                    : <Square className="h-5 w-5 text-gray-300 shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{t.customerName}</span>
                      <span className="text-xs text-muted-foreground">|</span>
                      <span className="text-xs text-muted-foreground truncate">{t.description}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      {t.defaults.pickupTime && <span>{t.defaults.pickupTime}</span>}
                      {t.defaults.driverName && <span>נהג: {t.defaults.driverName}</span>}
                      <div className="flex gap-0.5">
                        {[0, 1, 2, 3, 4, 5, 6].map(d => (
                          <span key={d} className={`text-[9px] ${t.activeDays.includes(d) ? "text-orange-600 font-bold" : "text-gray-300"}`}>
                            {DAY_LETTERS_HE[d]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Estimate */}
          <div className="text-sm text-center text-muted-foreground bg-muted/50 rounded p-2">
            יוצר כ-<span className="font-bold text-foreground">{getEstimate()}</span> נסיעות (כפילויות ידולגו)
          </div>
        </div>

        <DialogFooter className="flex-row-reverse gap-2 mt-2">
          {loading && progress.total > 0 && (
            <div className="w-full space-y-1 mb-2">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-orange-500 h-2.5 rounded-full transition-all duration-200" style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground text-center">משבץ... {progress.current}/{progress.total}</p>
            </div>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>ביטול</Button>
          <Button onClick={handleAssign} disabled={loading || selectedIds.size === 0}>
            {loading ? <><Loader2 className="ml-2 h-4 w-4 animate-spin" /> משבץ...</> : <>
              <CalendarCheck className="ml-2 h-4 w-4" /> שבץ נסיעות
            </>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
