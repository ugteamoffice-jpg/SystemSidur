"use client"

import * as React from "react"
import { Loader2, Calendar as CalendarIcon, ArrowLeft, ArrowRight } from "lucide-react"
import { format } from "date-fns"
import { he } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const FIELDS = {
  DATE: 'fldvNsQbfzMWTc7jakp',
  CUSTOMER: 'fldVy6L2DCboXUTkjBX',
  DESCRIPTION: 'fldA6e7ul57abYgAZDh',
  PICKUP_TIME: 'fldLbXMREYfC8XVIghj',
  DROPOFF_TIME: 'fld56G8M1LyHRRROWiL',
  VEHICLE_TYPE: 'fldx4hl8FwbxfkqXf0B',
  DRIVER: 'flddNPbrzOCdgS36kx5',
  VEHICLE_NUM: 'fldqStJV3KKIutTY9hW',
  MANAGER_NOTES: 'fldelKu7PLIBmCFfFPJ',
  DRIVER_NOTES: 'fldhNoiFEkEgrkxff02',
  PRICE_CLIENT_EXCL: 'fldxXnfHHQWwXY8dlEV',
  PRICE_CLIENT_INCL: 'fldT7QLSKmSrjIHarDb',
  PRICE_DRIVER_EXCL: 'fldSNuxbM8oJfrQ3a9x',
  PRICE_DRIVER_INCL: 'fldyQIhjdUeQwtHMldD',
  ORDER_NAME: 'fldkvTaql1bPbifVKLt',
  MOBILE: 'fld6NJPsiW8CtRIfnaY',
  ID_NUM: 'fldAJPcCFUcDPlSCK1a',
}

interface ListItem { id: string; title: string }

function AutoComplete({ options, value, onChange, placeholder }: any) {
  const [show, setShow] = React.useState(false)
  const safeValue = String(value || "").toLowerCase();
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
            <div key={o.id} className="p-2 hover:bg-gray-100 cursor-pointer text-right text-sm" onMouseDown={() => onChange(o.title)}>{o.title}</div>
          ))}
        </div>
      )}
    </div>
  )
}

export function SplitRideDialog({ open, onOpenChange, record, onSplit }: any) {
  const [loading, setLoading] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("outbound")
  const { toast } = useToast()

  const [lists, setLists] = React.useState<{customers: ListItem[], drivers: ListItem[], vehicles: ListItem[]}>({ customers: [], drivers: [], vehicles: [] })

  // VAT rates
  const [vatClientOutbound, setVatClientOutbound] = React.useState("18")
  const [vatDriverOutbound, setVatDriverOutbound] = React.useState("18")
  const [vatClientReturn, setVatClientReturn] = React.useState("18")
  const [vatDriverReturn, setVatDriverReturn] = React.useState("18")

  // State for outbound trip
  const [outbound, setOutbound] = React.useState({
    date: new Date(),
    customer: "",
    description: "",
    pickup: "",
    vehicleType: "",
    driver: "",
    vehicleNum: "",
    managerNotes: "",
    notes: "",
    orderName: "",
    mobile: "",
    idNum: "",
    priceClientExcl: "",
    priceClientIncl: "",
    priceDriverExcl: "",
    priceDriverIncl: "",
  })

  // State for return trip
  const [returnTrip, setReturnTrip] = React.useState({
    date: new Date(),
    customer: "",
    description: "",
    pickup: "",
    vehicleType: "",
    driver: "",
    vehicleNum: "",
    managerNotes: "",
    notes: "",
    orderName: "",
    mobile: "",
    idNum: "",
    priceClientExcl: "",
    priceClientIncl: "",
    priceDriverExcl: "",
    priceDriverIncl: "",
  })

  React.useEffect(() => {
    if (open && lists.customers.length === 0) {
      const load = async (url: string) => {
        try { 
            const r = await fetch(url); 
            const d = await r.json(); 
            return d.records ? d.records.map((x: any) => ({ 
                id: x.id, 
                title: x.fields && Object.values(x.fields)[0] ? String(Object.values(x.fields)[0]) : "" 
            })) : [] 
        } catch { return [] }
      }
      Promise.all([load('/api/customers'), load('/api/drivers'), load('/api/vehicles')])
        .then(([c, d, v]) => setLists({ customers: c, drivers: d, vehicles: v }))
    }
  }, [open])

  const getValFromRecord = (v: any) => {
      if (!v) return "";
      if (Array.isArray(v)) return v[0]?.title || "";
      return typeof v === 'object' ? v.title : String(v);
  }

  React.useEffect(() => {
    if (open && record) {
      const f = record.fields
      const date = f[FIELDS.DATE] ? new Date(f[FIELDS.DATE]) : new Date()
      
      // חלוקת מחירים
      const priceClientExcl = ((Number(f[FIELDS.PRICE_CLIENT_EXCL]) || 0) / 2).toFixed(2)
      const priceClientIncl = ((Number(f[FIELDS.PRICE_CLIENT_INCL]) || 0) / 2).toFixed(2)
      const priceDriverExcl = ((Number(f[FIELDS.PRICE_DRIVER_EXCL]) || 0) / 2).toFixed(2)
      const priceDriverIncl = ((Number(f[FIELDS.PRICE_DRIVER_INCL]) || 0) / 2).toFixed(2)
      
      const baseData = {
        date,
        customer: getValFromRecord(f[FIELDS.CUSTOMER]),
        vehicleType: getValFromRecord(f[FIELDS.VEHICLE_TYPE]),
        vehicleNum: f[FIELDS.VEHICLE_NUM] || "",
        managerNotes: f[FIELDS.MANAGER_NOTES] || "",
        orderName: f[FIELDS.ORDER_NAME] || "",
        mobile: f[FIELDS.MOBILE] || "",
        idNum: f[FIELDS.ID_NUM] || "",
        priceClientExcl,
        priceClientIncl,
        priceDriverExcl,
        priceDriverIncl,
      }

      // הלוך
      setOutbound({
        ...baseData,
        description: f[FIELDS.DESCRIPTION] || "",
        pickup: f[FIELDS.PICKUP_TIME] || "",
        driver: "",
        notes: "",
      })

      // חזור - השעה של החזור מהנסיעה המקורית היא ההלוך
      setReturnTrip({
        ...baseData,
        description: f[FIELDS.DESCRIPTION] || "",
        pickup: f[FIELDS.DROPOFF_TIME] || "",
        driver: "",
        notes: "",
      })
    }
  }, [open, record])

  const findId = (val: string, list: ListItem[]) => { 
      if (!val || val.trim() === "") return []; 
      const item = list.find(x => x.title.trim() === val.trim()); 
      return item ? [item.id] : null; 
  }

  // Calculate VAT for outbound
  const calculateVatOutbound = (value: string, type: 'excl' | 'incl', field: 'client' | 'driver') => {
    const numVal = parseFloat(value)
    const rate = 1 + (parseFloat(field === 'client' ? vatClientOutbound : vatDriverOutbound) / 100)
    if (isNaN(numVal)) {
      if (field === 'client') setOutbound(p => ({ ...p, priceClientExcl: "", priceClientIncl: "" }))
      else setOutbound(p => ({ ...p, priceDriverExcl: "", priceDriverIncl: "" }))
      return
    }
    if (type === 'excl') {
      const incl = (numVal * rate).toFixed(2)
      if (field === 'client') setOutbound(p => ({ ...p, priceClientExcl: value, priceClientIncl: incl }))
      else setOutbound(p => ({ ...p, priceDriverExcl: value, priceDriverIncl: incl }))
    } else {
      const excl = (numVal / rate).toFixed(2)
      if (field === 'client') setOutbound(p => ({ ...p, priceClientIncl: value, priceClientExcl: excl }))
      else setOutbound(p => ({ ...p, priceDriverIncl: value, priceDriverExcl: excl }))
    }
  }

  // Calculate VAT for return
  const calculateVatReturn = (value: string, type: 'excl' | 'incl', field: 'client' | 'driver') => {
    const numVal = parseFloat(value)
    const rate = 1 + (parseFloat(field === 'client' ? vatClientReturn : vatDriverReturn) / 100)
    if (isNaN(numVal)) {
      if (field === 'client') setReturnTrip(p => ({ ...p, priceClientExcl: "", priceClientIncl: "" }))
      else setReturnTrip(p => ({ ...p, priceDriverExcl: "", priceDriverIncl: "" }))
      return
    }
    if (type === 'excl') {
      const incl = (numVal * rate).toFixed(2)
      if (field === 'client') setReturnTrip(p => ({ ...p, priceClientExcl: value, priceClientIncl: incl }))
      else setReturnTrip(p => ({ ...p, priceDriverExcl: value, priceDriverIncl: incl }))
    } else {
      const excl = (numVal / rate).toFixed(2)
      if (field === 'client') setReturnTrip(p => ({ ...p, priceClientIncl: value, priceClientExcl: excl }))
      else setReturnTrip(p => ({ ...p, priceDriverIncl: value, priceDriverExcl: excl }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    if (!outbound.customer.trim() || !outbound.description.trim() || !outbound.pickup.trim()) {
      toast({ title: "שגיאה", description: "נא למלא את כל שדות החובה בנסיעת ההלוך", variant: "destructive" })
      return
    }

    if (!returnTrip.customer.trim() || !returnTrip.description.trim() || !returnTrip.pickup.trim()) {
      toast({ title: "שגיאה", description: "נא למלא את כל שדות החובה בנסיעת החזור", variant: "destructive" })
      return
    }

    setLoading(true)

    try {
      // Create outbound trip
      const outboundPayload: any = {
        [FIELDS.DATE]: format(outbound.date, "yyyy-MM-dd"),
        [FIELDS.DESCRIPTION]: outbound.description,
        [FIELDS.PICKUP_TIME]: outbound.pickup,
        [FIELDS.DROPOFF_TIME]: "",
        [FIELDS.VEHICLE_NUM]: outbound.vehicleNum,
        [FIELDS.MANAGER_NOTES]: outbound.managerNotes,
        [FIELDS.DRIVER_NOTES]: outbound.notes,
        [FIELDS.ORDER_NAME]: outbound.orderName,
        [FIELDS.MOBILE]: outbound.mobile,
        [FIELDS.ID_NUM]: outbound.idNum,
        [FIELDS.PRICE_CLIENT_EXCL]: Number(outbound.priceClientExcl) || 0,
        [FIELDS.PRICE_CLIENT_INCL]: Number(outbound.priceClientIncl) || 0,
        [FIELDS.PRICE_DRIVER_EXCL]: Number(outbound.priceDriverExcl) || 0,
        [FIELDS.PRICE_DRIVER_INCL]: Number(outbound.priceDriverIncl) || 0,
        [FIELDS.CUSTOMER]: findId(outbound.customer, lists.customers),
        [FIELDS.DRIVER]: findId(outbound.driver, lists.drivers) || [],
        [FIELDS.VEHICLE_TYPE]: findId(outbound.vehicleType, lists.vehicles),
      }

      // Create return trip
      const returnPayload: any = {
        [FIELDS.DATE]: format(returnTrip.date, "yyyy-MM-dd"),
        [FIELDS.DESCRIPTION]: returnTrip.description,
        [FIELDS.PICKUP_TIME]: returnTrip.pickup,
        [FIELDS.DROPOFF_TIME]: "",
        [FIELDS.VEHICLE_NUM]: returnTrip.vehicleNum,
        [FIELDS.MANAGER_NOTES]: returnTrip.managerNotes,
        [FIELDS.DRIVER_NOTES]: returnTrip.notes,
        [FIELDS.ORDER_NAME]: returnTrip.orderName,
        [FIELDS.MOBILE]: returnTrip.mobile,
        [FIELDS.ID_NUM]: returnTrip.idNum,
        [FIELDS.PRICE_CLIENT_EXCL]: Number(returnTrip.priceClientExcl) || 0,
        [FIELDS.PRICE_CLIENT_INCL]: Number(returnTrip.priceClientIncl) || 0,
        [FIELDS.PRICE_DRIVER_EXCL]: Number(returnTrip.priceDriverExcl) || 0,
        [FIELDS.PRICE_DRIVER_INCL]: Number(returnTrip.priceDriverIncl) || 0,
        [FIELDS.CUSTOMER]: findId(returnTrip.customer, lists.customers),
        [FIELDS.DRIVER]: findId(returnTrip.driver, lists.drivers) || [],
        [FIELDS.VEHICLE_TYPE]: findId(returnTrip.vehicleType, lists.vehicles),
      }

      await fetch('/api/work-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: outboundPayload })
      })

      await fetch('/api/work-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: returnPayload })
      })

      // Delete original
      await fetch(`/api/work-schedule?id=${record.id}`, { method: 'DELETE' })

      toast({ title: "הצלחה", description: "הנסיעה פוצלה בהצלחה להלוך וחזור" })
      onOpenChange(false)
      if (onSplit) onSplit()
    } catch (error) {
      console.error('Error splitting record:', error)
      toast({ title: "שגיאה", description: "לא הצלחנו לפצל את הנסיעה", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const renderTripForm = (trip: any, setTrip: any, isOutbound: boolean) => {
    const vatClient = isOutbound ? vatClientOutbound : vatClientReturn
    const setVatClient = isOutbound ? setVatClientOutbound : setVatClientReturn
    const vatDriver = isOutbound ? vatDriverOutbound : vatDriverReturn
    const setVatDriver = isOutbound ? setVatDriverOutbound : setVatDriverReturn
    const calculateVat = isOutbound ? calculateVatOutbound : calculateVatReturn

    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <Label>תאריך</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={"outline"} className="w-full justify-start text-right">
                <CalendarIcon className="ml-2 h-4 w-4" />
                {trip.date ? format(trip.date, "PPP", { locale: he }) : "בחר תאריך"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar mode="single" selected={trip.date} onSelect={(d) => setTrip((p: any) => ({...p, date: d}))} initialFocus locale={he} dir="rtl" />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1">
          <Label>שם לקוח *</Label>
          <AutoComplete 
            options={lists.customers} value={trip.customer} 
            onChange={(v: string) => setTrip((p: any) => ({...p, customer: v}))} 
            placeholder="" 
          />
        </div>

        <div className="space-y-1">
          <Label>תיאור (מסלול) *</Label>
          <Textarea 
            value={trip.description} 
            onChange={e => setTrip((p: any) => ({...p, description: e.target.value}))} 
            className="text-right" 
            placeholder=""
          />
        </div>

        <div className="space-y-1">
          <Label>שעת התייצבות *</Label>
          <Input type="time" value={trip.pickup} onChange={e => setTrip((p: any) => ({...p, pickup: e.target.value}))} />
        </div>

        <div className="space-y-1">
          <Label>נהג</Label>
          <AutoComplete 
            options={lists.drivers} value={trip.driver} 
            onChange={(v: string) => setTrip((p: any) => ({...p, driver: v}))} 
            placeholder="" 
          />
        </div>

        <div className="space-y-1">
          <Label>סוג רכב</Label>
          <AutoComplete 
            options={lists.vehicles} value={trip.vehicleType} 
            onChange={(v: string) => setTrip((p: any) => ({...p, vehicleType: v}))} 
            placeholder=""
          />
        </div>

        <div className="space-y-1">
          <Label>מס' רכב</Label>
          <Input value={trip.vehicleNum} onChange={e => setTrip((p: any) => ({...p, vehicleNum: e.target.value}))} className="text-right"/>
        </div>

        {/* מחיר לקוח */}
        <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-blue-700">מחיר לקוח</h3>
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">מע"מ %</Label>
              <Input type="number" value={vatClient} onChange={(e) => setVatClient(e.target.value)} className="w-16 h-8 bg-white text-center" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">לפני מע"מ</Label>
              <Input type="number" value={trip.priceClientExcl} onChange={(e) => calculateVat(e.target.value, 'excl', 'client')} className="bg-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold">כולל מע"מ</Label>
              <Input type="number" value={trip.priceClientIncl} onChange={(e) => calculateVat(e.target.value, 'incl', 'client')} className="bg-white font-bold" />
            </div>
          </div>
        </div>

        {/* מחיר נהג */}
        <div className="space-y-4 p-4 border rounded-lg bg-orange-50/50">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-orange-700">מחיר נהג</h3>
            <div className="flex items-center gap-2">
              <Label className="text-xs whitespace-nowrap">מע"מ %</Label>
              <Input type="number" value={vatDriver} onChange={(e) => setVatDriver(e.target.value)} className="w-16 h-8 bg-white text-center" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">לפני מע"מ</Label>
              <Input type="number" value={trip.priceDriverExcl} onChange={(e) => calculateVat(e.target.value, 'excl', 'driver')} className="bg-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold">כולל מע"מ</Label>
              <Input type="number" value={trip.priceDriverIncl} onChange={(e) => calculateVat(e.target.value, 'incl', 'driver')} className="bg-white font-bold" />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <Label>הערות מנהל</Label>
          <Textarea value={trip.managerNotes} onChange={e => setTrip((p: any) => ({...p, managerNotes: e.target.value}))} className="text-right border-blue-200 bg-blue-50/30" />
        </div>

        <div className="space-y-1">
          <Label>הערות נהג</Label>
          <Textarea value={trip.notes} onChange={e => setTrip((p: any) => ({...p, notes: e.target.value}))} className="text-right" />
        </div>

        <div className="space-y-1">
          <Label>שם מזמין</Label>
          <Input value={trip.orderName} onChange={e => setTrip((p: any) => ({...p, orderName: e.target.value}))} className="text-right"/>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>נייד</Label>
            <Input value={trip.mobile} onChange={e => setTrip((p: any) => ({...p, mobile: e.target.value}))} className="text-right"/>
          </div>
          <div className="space-y-1">
            <Label>ת.ז</Label>
            <Input value={trip.idNum} onChange={e => setTrip((p: any) => ({...p, idNum: e.target.value}))} className="text-right"/>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle>פיצול נסיעה להלוך וחזור</DialogTitle>
          <DialogDescription>ערוך את פרטי נסיעת ההלוך והחזור. שדות המסומנים ב-* הם חובה.</DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="outbound" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> נסיעת הלוך
              </TabsTrigger>
              <TabsTrigger value="return" className="gap-2">
                <ArrowRight className="w-4 h-4" /> נסיעת חזור
              </TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-y-auto p-4 border rounded mt-2">
              <TabsContent value="outbound">
                {renderTripForm(outbound, setOutbound, true)}
              </TabsContent>
              
              <TabsContent value="return">
                {renderTripForm(returnTrip, setReturnTrip, false)}
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="mt-4 flex-row-reverse gap-2">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)} disabled={loading}>
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin ml-2 h-4 w-4" />
                  מפצל...
                </>
              ) : (
                "שמור ופצל"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
