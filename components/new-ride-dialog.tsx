"use client"

import * as React from "react"
import { Plus, Loader2, Pencil, Upload, Calendar as CalendarIcon, X, FileText, Eye, ChevronUp, ChevronDown } from "lucide-react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
// הורדתי את ה-Checkbox מה-UI אבל השארתי את הלוגיקה
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import { useTenantFields, useTenantTables } from "@/lib/tenant-context"

interface ListItem {
  id: string;
  title: string
}

function AutoComplete({ options, value, onChange, onItemSelect, placeholder, isError }: any) {
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
        className={cn("text-right", isError && "border-red-500 bg-red-50 focus-visible:ring-red-500")}
        placeholder={placeholder}
      />
      {show && filtered.length > 0 && (
        <div className="absolute z-50 w-full bg-white border shadow-md max-h-40 overflow-auto rounded-md mt-1 text-black">
          {filtered.map((o: any) => (
            <div
              key={o.id}
              className="p-2 hover:bg-gray-100 cursor-pointer text-right text-sm"
              onMouseDown={(e) => {
                e.preventDefault();
                if (onItemSelect) {
                  onItemSelect(o);
                } else {
                  onChange(o.title);
                }
                setShow(false);
              }}
            >
              {o.title}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function RideDialog({ onRideSaved, initialData, triggerChild, open: controlledOpen, onOpenChange: setControlledOpen, defaultDate, allRides, onNavigate }: any) {
  const tenantFields = useTenantFields()
  const tenantTables = useTenantTables()
  const FIELDS = tenantFields?.workSchedule || {} as any
  const WS_TABLE_ID = tenantTables?.WORK_SCHEDULE || ""

  const [internalOpen, setInternalOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [isReady, setIsReady] = React.useState(false)
  const [calendarModal, setCalendarModal] = React.useState<{
    open: boolean, selected?: Date, onSelect: (date: Date | undefined) => void
  }>({ open: false, onSelect: () => {} })
  const [showErrors, setShowErrors] = React.useState(false)
  const { toast } = useToast()

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen : setInternalOpen;

  const isEdit = !!initialData

  const [date, setDate] = React.useState<Date | undefined>(() => {
    if (defaultDate) {
      const parsed = new Date(defaultDate);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return new Date();
  })

  // משתנה לשמירת המצב המקורי של השדות הקריטיים
  const initialSnapshotRef = React.useRef<any>(null);

  const [vatClient, setVatClient] = React.useState("18")
  const [vatDriver, setVatDriver] = React.useState("18")

  const [lists, setLists] = React.useState<{ customers: ListItem[], drivers: ListItem[], vehicles: ListItem[] }>({
    customers: [],
    drivers: [],
    vehicles: []
  })

  const [form, setForm] = React.useState({
    customer: "",
    description: "",
    pickup: "",
    dropoff: "",
    vehicleType: "",
    driver: "",
    vehicleNum: "",
    managerNotes: "",
    notes: "",
    orderName: "",
    mobile: "",
    idNum: ""
  })

  const [selectedIds, setSelectedIds] = React.useState({
    customerId: "",
    driverId: "",
    vehicleTypeId: ""
  })

  const [prices, setPrices] = React.useState({
    ce: "", ci: "", de: "", di: ""
  })

  const [status, setStatus] = React.useState({ sent: false, approved: false })
  const [orderFormFile, setOrderFormFile] = React.useState<File | null>(null)
  const [newFileName, setNewFileName] = React.useState("")
  const [existingAttachment, setExistingAttachment] = React.useState<any[]>([])
  const [attachmentDate, setAttachmentDate] = React.useState<string>("")
  const [isUploading, setIsUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open && lists.customers.length === 0) {
      const load = async (url: string, isDrivers = false) => {
        try {
          const r = await fetch(url);
          if (!r.ok) {
            console.error(`Failed to load ${url}: ${r.status}`);
            return [];
          }
          const d = await r.json();
          const items = d.records ? d.records.map((x: any) => {
            let title = "";
            if (isDrivers && tenantFields?.drivers) {
              const first = x.fields?.[tenantFields.drivers.FIRST_NAME] || ""
              const last = x.fields?.[tenantFields.drivers.LAST_NAME] || ""
              title = `${first} ${last}`.trim()
            } else {
              const firstVal = x.fields && Object.values(x.fields)[0];
              if (Array.isArray(firstVal)) {
                title = firstVal[0]?.title || firstVal[0]?.text || String(firstVal[0] || "");
              } else if (typeof firstVal === 'object' && firstVal !== null) {
                title = firstVal.title || firstVal.text || String(firstVal);
              } else {
                title = String(firstVal || "");
              }
            }
            return { id: x.id, title };
          }) : [];
          return items;
        } catch (err) {
          console.error(`Error loading ${url}:`, err);
          return [];
        }
      }
      Promise.all([load('/api/customers'), load('/api/drivers', true), load('/api/vehicles')])
        .then(([c, d, v]) => setLists({ customers: c, drivers: d, vehicles: v }))
    }
  }, [open])

  const getValFromRecord = (v: any) => {
    if (!v) return "";
    if (Array.isArray(v)) return v[0]?.title || "";
    return typeof v === 'object' ? v.title : String(v);
  }

  const getIdFromRecord = (v: any) => {
    if (!v) return "";
    if (Array.isArray(v)) return v[0]?.id || "";
    return typeof v === 'object' ? v.id || "" : "";
  }

  // --- טעינת הנתונים ושמירת "תמונת המצב" (Snapshot) ---
  React.useEffect(() => {
    if (open) {
      setShowErrors(false);
      setIsReady(false);
      
      if (initialData) {
        const f = initialData.fields
        
        let initialDate: Date | undefined = undefined;
        if (f[FIELDS.DATE]) {
          const d = new Date(f[FIELDS.DATE]);
          initialDate = !isNaN(d.getTime()) ? d : undefined;
        }

        const loadedForm = {
          customer: getValFromRecord(f[FIELDS.CUSTOMER]),
          description: f[FIELDS.DESCRIPTION] || "",
          pickup: f[FIELDS.PICKUP_TIME] || "",
          dropoff: f[FIELDS.DROPOFF_TIME] || "",
          vehicleType: getValFromRecord(f[FIELDS.VEHICLE_TYPE]),
          driver: getValFromRecord(f[FIELDS.DRIVER]),
          vehicleNum: f[FIELDS.VEHICLE_NUM] || "",
          managerNotes: f[FIELDS.MANAGER_NOTES] || "",
          notes: f[FIELDS.DRIVER_NOTES] || "", // הערות נהג
          orderName: f[FIELDS.ORDER_NAME] || "",
          mobile: f[FIELDS.MOBILE] != null ? String(f[FIELDS.MOBILE]) : "",
          idNum: f[FIELDS.ID_NUM] != null ? String(f[FIELDS.ID_NUM]) : ""
        };

        setDate(initialDate);
        setForm(loadedForm);
        
        setSelectedIds({
          customerId: getIdFromRecord(f[FIELDS.CUSTOMER]),
          driverId: getIdFromRecord(f[FIELDS.DRIVER]),
          vehicleTypeId: getIdFromRecord(f[FIELDS.VEHICLE_TYPE]),
        })
        setPrices({
          ce: f[FIELDS.PRICE_CLIENT_EXCL] || "",
          ci: f[FIELDS.PRICE_CLIENT_INCL] || "",
          de: f[FIELDS.PRICE_DRIVER_EXCL] || "",
          di: f[FIELDS.PRICE_DRIVER_INCL] || ""
        })
        setStatus({ sent: !!f[FIELDS.SENT], approved: !!f[FIELDS.APPROVED] })
        setExistingAttachment(Array.isArray(f[FIELDS.ORDER_FORM]) ? f[FIELDS.ORDER_FORM] : [])
        setAttachmentDate(f[FIELDS.ORDER_FORM_DATE] || "")
        setOrderFormFile(null)
        setNewFileName("")

        // שמירת "תמונת המצב" המקורית
        initialSnapshotRef.current = {
            dateStr: initialDate ? format(initialDate, "yyyy-MM-dd") : "",
            driver: loadedForm.driver,
            description: loadedForm.description,
            pickup: loadedForm.pickup,
            dropoff: loadedForm.dropoff,
            vehicleType: loadedForm.vehicleType,
            notes: loadedForm.notes // הערות נהג
        };

        setTimeout(() => setIsReady(true), 300)
      } else {
        // מצב "נסיעה חדשה" (Reset)
        setForm({
          customer: "", description: "", pickup: "", dropoff: "", vehicleType: "", driver: "", vehicleNum: "", managerNotes: "", notes: "", orderName: "", mobile: "", idNum: ""
        })
        setSelectedIds({ customerId: "", driverId: "", vehicleTypeId: "" })
        setPrices({ ce: "", ci: "", de: "", di: "" })
        setStatus({ sent: false, approved: false })
        setExistingAttachment([])
        setAttachmentDate("")
        setOrderFormFile(null)
        setNewFileName("")
        
        const d = defaultDate ? new Date(defaultDate) : new Date();
        setDate(d);
        
        initialSnapshotRef.current = null;
        setIsReady(true)
      }
    }
  }, [open, initialData, defaultDate])

  // --- המנגנון שמאפס צ'קבוקסים (רץ ברקע) ---
  React.useEffect(() => {
    if (isEdit && isReady && initialSnapshotRef.current) {
        
        const currentDateStr = date ? format(date, "yyyy-MM-dd") : "";

        const isChanged = 
            currentDateStr !== initialSnapshotRef.current.dateStr ||
            form.driver !== initialSnapshotRef.current.driver ||
            form.description !== initialSnapshotRef.current.description ||
            form.pickup !== initialSnapshotRef.current.pickup ||
            form.dropoff !== initialSnapshotRef.current.dropoff ||
            form.vehicleType !== initialSnapshotRef.current.vehicleType ||
            form.notes !== initialSnapshotRef.current.notes;

        if (isChanged && (status.sent || status.approved)) {
            // הנה! כאן זה מתאפס ברקע, בלי שצריך לראות את הצ'קבוקסים
            setStatus({ sent: false, approved: false });
        }
    }
  }, [
    isEdit, isReady, date, 
    form.driver, form.description, form.pickup, form.dropoff, form.vehicleType, form.notes, 
    status.sent, status.approved
  ]);

  const calculateVat = (val: string, type: 'excl' | 'incl', side: 'client' | 'driver') => {
    const num = parseFloat(val) || 0
    const vat = parseFloat(side === 'client' ? vatClient : vatDriver) || 0
    if (type === 'excl') {
      const withVat = num * (1 + vat / 100)
      setPrices(p => side === 'client' ? { ...p, ce: val, ci: withVat.toFixed(2) } : { ...p, de: val, di: withVat.toFixed(2) })
    } else {
      const noVat = num / (1 + vat / 100)
      setPrices(p => side === 'client' ? { ...p, ci: val, ce: noVat.toFixed(2) } : { ...p, di: val, de: noVat.toFixed(2) })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!date || !form.customer || !form.description || !form.pickup) {
      setShowErrors(true);
      toast({ title: "שגיאה", description: "אנא מלא את כל השדות החובה", variant: "destructive" })
      return
    }

    setLoading(true)
    try {
      const findId = (list: ListItem[], text: string, currentId: string) => {
        if (currentId) return currentId;
        if (!text) return undefined;
        const cleanText = text.trim();
        return list.find(i => i.title.trim() === cleanText)?.id;
      };

      const customerId = findId(lists.customers, form.customer, selectedIds.customerId)
      const driverId = findId(lists.drivers, form.driver, selectedIds.driverId)
      const vehicleTypeId = findId(lists.vehicles, form.vehicleType, selectedIds.vehicleTypeId)

      const body: any = {
        fields: {
          [FIELDS.DATE]: format(date, "yyyy-MM-dd"),
          [FIELDS.CUSTOMER]: customerId ? [customerId] : null,
          [FIELDS.VEHICLE_TYPE]: vehicleTypeId ? [vehicleTypeId] : null,
          [FIELDS.DRIVER]: driverId ? [driverId] : null,
          [FIELDS.DESCRIPTION]: form.description,
          [FIELDS.PICKUP_TIME]: form.pickup,
          [FIELDS.DROPOFF_TIME]: form.dropoff || null,
          [FIELDS.VEHICLE_NUM]: form.vehicleNum || null,
          [FIELDS.MANAGER_NOTES]: form.managerNotes || null,
          [FIELDS.DRIVER_NOTES]: form.notes || null,
          [FIELDS.PRICE_CLIENT_EXCL]: prices.ce ? parseFloat(prices.ce) : null,
          [FIELDS.PRICE_CLIENT_INCL]: prices.ci ? parseFloat(prices.ci) : null,
          [FIELDS.PRICE_DRIVER_EXCL]: prices.de ? parseFloat(prices.de) : null,
          [FIELDS.PRICE_DRIVER_INCL]: prices.di ? parseFloat(prices.di) : null,
          [FIELDS.ORDER_NAME]: form.orderName || null,
          [FIELDS.MOBILE]: form.mobile || null,
          [FIELDS.ID_NUM]: form.idNum ? Number(form.idNum) : null,
          [FIELDS.SENT]: status.sent,
          [FIELDS.APPROVED]: status.approved,
        }
      }

      Object.keys(body.fields).forEach(k => body.fields[k] === undefined && delete body.fields[k])

      // Helper: upload file to record
      const uploadFileToRecord = async (recordId: string) => {
        if (!orderFormFile) return
        setIsUploading(true)
        const fd = new FormData()
        const fileName = newFileName || orderFormFile.name
        const renamedFile = new File([orderFormFile], fileName, { type: orderFormFile.type })
        fd.append('file', renamedFile)
        fd.append('tableId', WS_TABLE_ID)
        fd.append('recordId', recordId)
        fd.append('fieldId', FIELDS.ORDER_FORM)
        const uploadRes = await fetch('/api/upload-to-record', { method: 'POST', body: fd })
        if (!uploadRes.ok) {
          console.error('File upload failed:', await uploadRes.text())
          toast({ title: "הנסיעה נשמרה אבל העלאת הקובץ נכשלה", variant: "destructive" })
        }
        setIsUploading(false)
      }

      if (isEdit) {
        const res = await fetch(`/api/work-schedule/${initialData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (!res.ok) {
          throw new Error("Server rejected the data");
        }

        const result = await res.json();
        if (result.success || result.id || (result.fields && result.id)) {
          await uploadFileToRecord(initialData.id)
          // saved successfully - no toast needed
          
          setOpen(false);
          if (onRideSaved) onRideSaved();
          return;
        }
        throw new Error("Server rejected the data");
      }

      const res = await fetch('/api/work-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        throw new Error(await res.text());
      }

      // Get new record ID and upload file
      const result = await res.json()
      const newRecordId = result?.records?.[0]?.id || result?.id
      if (newRecordId && orderFormFile) {
        await uploadFileToRecord(newRecordId)
      }

      // saved successfully - no toast needed
      setOpen(false)
      if (onRideSaved) onRideSaved()

    } catch (err) {
      console.error(err);
      toast({ title: "שגיאה בשמירה", description: "אירעה שגיאה בעת השמירה", variant: "destructive" })
    } finally {
      setLoading(false)
      setIsUploading(false)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          {triggerChild || (
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> צור נסיעה
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[900px] h-[85vh] flex flex-col" dir="rtl">
        <DialogHeader className="pb-1">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">{isEdit ? "עריכת נסיעה" : "נסיעה חדשה"}</DialogTitle>
            {isEdit && allRides && onNavigate && (() => {
              const idx = allRides.findIndex((r: any) => r.id === initialData?.id);
              const hasPrev = idx > 0;
              const hasNext = idx >= 0 && idx < allRides.length - 1;
              return (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">{idx + 1}/{allRides.length}</span>
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={!hasPrev} onClick={() => onNavigate(allRides[idx - 1])} title="נסיעה קודמת">
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="outline" size="icon" className="h-7 w-7" disabled={!hasNext} onClick={() => onNavigate(allRides[idx + 1])} title="נסיעה הבאה">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              );
            })()}
          </div>
          <DialogDescription className="text-xs">מלא את פרטי הנסיעה. שדות * = חובה.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-3 h-8">
              <TabsTrigger value="details" className="text-xs py-1">פרטי נסיעה</TabsTrigger>
              <TabsTrigger value="prices" className="text-xs py-1">מחירים</TabsTrigger>
              <TabsTrigger value="extra" className="text-xs py-1">פרטים נוספים</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto p-2 border rounded mt-1">
              <TabsContent value="details" className="space-y-1 mt-0">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <div>
                    <Label className={cn("text-sm leading-none block", showErrors && !date && "text-red-500")}>תאריך *</Label>
                    <Button
                      variant={"outline"}
                      className={cn("w-full justify-start text-right h-8 text-sm", showErrors && !date && "border-red-500")}
                      onClick={() => setCalendarModal({
                        open: true,
                        selected: date,
                        onSelect: (d) => { if (d) setDate(d) }
                      })}
                      type="button"
                    >
                      <CalendarIcon className="ml-1 h-3.5 w-3.5" />
                      {date ? format(date, "PPP", { locale: he }) : "בחר תאריך"}
                    </Button>
                  </div>
                  <div>
                    <Label className={cn("text-sm leading-none block", showErrors && !form.customer && "text-red-500")}>שם לקוח *</Label>
                    <AutoComplete
                      options={lists.customers}
                      value={form.customer}
                      onChange={(v: string) => {
                        setForm(p => ({ ...p, customer: v }));
                        setSelectedIds(p => ({ ...p, customerId: "" }));
                      }}
                      onItemSelect={(item: ListItem) => {
                        setForm(p => ({ ...p, customer: item.title }));
                        setSelectedIds(p => ({ ...p, customerId: item.id }));
                      }}
                      placeholder=""
                      isError={showErrors && !form.customer}
                    />
                  </div>
                </div>

                <div>
                  <Label className={cn("text-sm leading-none block", showErrors && !form.description && "text-red-500")}>תיאור (מסלול) *</Label>
                  <Input
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    className={cn("text-right h-8 text-sm", showErrors && !form.description && "border-red-500")}
                    placeholder=""
                  />
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <div>
                    <Label className={cn("text-sm leading-none block", showErrors && !form.pickup && "text-red-500")}>התייצבות *</Label>
                    <Input type="time" value={form.pickup} onChange={e => setForm(p => ({ ...p, pickup: e.target.value }))} className={cn("h-8", showErrors && !form.pickup && "border-red-500")} />
                  </div>
                  <div>
                    <Label className="text-sm leading-none block">חזור</Label>
                    <Input type="time" value={form.dropoff} onChange={e => setForm(p => ({ ...p, dropoff: e.target.value }))} className="h-8" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <div>
                    <Label className="text-sm leading-none block">סוג רכב</Label>
                    <AutoComplete
                      options={lists.vehicles}
                      value={form.vehicleType}
                      onChange={(v: string) => {
                        setForm(p => ({ ...p, vehicleType: v }));
                        setSelectedIds(p => ({ ...p, vehicleTypeId: "" }));
                      }}
                      onItemSelect={(item: ListItem) => {
                        setForm(p => ({ ...p, vehicleType: item.title }));
                        setSelectedIds(p => ({ ...p, vehicleTypeId: item.id }));
                      }}
                      placeholder=""
                    />
                  </div>
                  <div>
                    <Label className="text-sm leading-none block">נהג</Label>
                    <AutoComplete
                      options={lists.drivers}
                      value={form.driver}
                      onChange={(v: string) => {
                        setForm(p => ({ ...p, driver: v }));
                        setSelectedIds(p => ({ ...p, driverId: "" }));
                      }}
                      onItemSelect={(item: ListItem) => {
                        setForm(p => ({ ...p, driver: item.title }));
                        setSelectedIds(p => ({ ...p, driverId: item.id }));
                      }}
                      placeholder=""
                    />
                  </div>
                </div>

                {/* --- כאן היו הצ'קבוקסים - מחקתי אותם! --- */}

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <div>
                    <Label className="text-sm leading-none block">מס' רכב</Label>
                    <Input value={form.vehicleNum} onChange={e => setForm(p => ({ ...p, vehicleNum: e.target.value }))} className="text-right h-8" />
                  </div>
                  <div>
                    <Label className="text-sm leading-none block"><Upload className="w-3 h-3 inline ml-1" />קובץ</Label>
                    <div className="flex items-center gap-1">
                      {existingAttachment.length > 0 ? (
                        <div className="flex items-center gap-1 flex-1 h-8 px-2 border rounded bg-green-50 text-sm">
                          <FileText className="w-3 h-3 text-green-600 shrink-0" />
                          <span className="truncate flex-1">{existingAttachment[0]?.name || 'קובץ'}</span>
                          {existingAttachment[0]?.token && (
                            <Button type="button" variant="ghost" size="sm" className="h-5 px-1 text-blue-600 shrink-0" onClick={() => {
                              const att = existingAttachment[0]
                              const tenant = window.location.pathname.split('/')[1] || 'UrbanTours'
                              const params = new URLSearchParams({ tenant })
                              if (att.presignedUrl || att.url) params.set('url', att.presignedUrl || att.url)
                              else params.set('token', att.token)
                              if (att.name) params.set('name', att.name)
                              window.open(`/api/view-file?${params.toString()}`, '_blank')
                            }}><Eye className="w-3 h-3" /></Button>
                          )}
                          {isEdit && (
                            <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-red-500 shrink-0" onClick={async () => {
                              setExistingAttachment([])
                              try { await fetch(`/api/work-schedule/${initialData.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { [FIELDS.ORDER_FORM]: null } }) }) } catch {}
                            }}><X className="w-3 h-3" /></Button>
                          )}
                        </div>
                      ) : orderFormFile ? (
                        <div className="flex items-center gap-1 flex-1 h-8 px-2 border rounded bg-blue-50 text-sm">
                          <FileText className="w-3 h-3 text-blue-600 shrink-0" />
                          <span className="truncate flex-1">{newFileName}</span>
                          <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-red-500" onClick={() => { setOrderFormFile(null); setNewFileName(''); if (fileInputRef.current) fileInputRef.current.value = '' }}><X className="w-3 h-3" /></Button>
                        </div>
                      ) : (
                        <Button type="button" variant="outline" size="sm" className="w-full h-8 text-sm" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="w-3 h-3 ml-1" /> בחר קובץ
                        </Button>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) { setOrderFormFile(e.target.files[0]); setNewFileName(e.target.files[0].name) } }} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <div>
                    <Label className="text-sm leading-none block">הערות מנהל</Label>
                    <Textarea value={form.managerNotes} onChange={e => setForm(p => ({ ...p, managerNotes: e.target.value }))} className="text-right border-blue-200 bg-blue-50/30 h-10 text-sm resize-none" />
                  </div>
                  <div>
                    <Label className="text-sm leading-none block">הערות נהג</Label>
                    <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="text-right h-10 text-sm resize-none" />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="prices" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3 p-3 border rounded-lg bg-blue-50/50">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-blue-700 text-sm">מחיר לקוח</h3>
                      <div className="flex items-center gap-1">
                        <Label className="text-sm whitespace-nowrap">מע"מ %</Label>
                        <Input type="number" value={vatClient} onChange={(e) => setVatClient(e.target.value)} className="w-14 h-7 bg-white text-center text-xs" />
                      </div>
                    </div>
                    <div className="space-y-1"><Label className="text-sm">לפני מע"מ</Label><Input type="number" value={prices.ce} onChange={(e) => calculateVat(e.target.value, 'excl', 'client')} className="bg-white h-9" /></div>
                    <div className="space-y-1"><Label className="text-sm">כולל מע"מ</Label><Input type="number" value={prices.ci} onChange={(e) => calculateVat(e.target.value, 'incl', 'client')} className="bg-white font-bold h-9" /></div>
                  </div>

                  <div className="space-y-3 p-3 border rounded-lg bg-orange-50/50">
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold text-orange-700 text-sm">מחיר נהג</h3>
                      <div className="flex items-center gap-1">
                        <Label className="text-sm whitespace-nowrap">מע"מ %</Label>
                        <Input type="number" value={vatDriver} onChange={(e) => setVatDriver(e.target.value)} className="w-14 h-7 bg-white text-center text-xs" />
                      </div>
                    </div>
                    <div className="space-y-1"><Label className="text-sm">לפני מע"מ</Label><Input type="number" value={prices.de} onChange={(e) => calculateVat(e.target.value, 'excl', 'driver')} className="bg-white h-9" /></div>
                    <div className="space-y-1"><Label className="text-sm">כולל מע"מ</Label><Input type="number" value={prices.di} onChange={(e) => calculateVat(e.target.value, 'incl', 'driver')} className="bg-white font-bold h-9" /></div>
                  </div>
                </div>

                {/* Profit summary */}
                <div className="p-3 border rounded-lg bg-green-50/50">
                  <h3 className="font-bold text-green-700 text-sm mb-2">רווח</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm">רווח לפני מע"מ</Label>
                      <div className="h-9 flex items-center px-3 border rounded bg-white font-bold text-green-700">
                        {((parseFloat(prices.ce) || 0) - (parseFloat(prices.de) || 0)).toLocaleString()} ₪
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">רווח כולל מע"מ</Label>
                      <div className="h-9 flex items-center px-3 border rounded bg-white font-bold text-green-700">
                        {((parseFloat(prices.ci) || 0) - (parseFloat(prices.di) || 0)).toLocaleString()} ₪
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="extra" className="space-y-4 mt-0">
                <div className="space-y-1"><Label>שם מזמין</Label><Input value={form.orderName} onChange={e => setForm(p => ({ ...p, orderName: e.target.value }))} className="text-right" /></div>
                <div className="space-y-1"><Label>נייד</Label><Input value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} className="text-right" /></div>
                <div className="space-y-1"><Label>ת.ז</Label><Input value={form.idNum} onChange={e => setForm(p => ({ ...p, idNum: e.target.value }))} className="text-right" /></div>
              </TabsContent>
            </div>
          </Tabs>

          <DialogFooter className="mt-2 pt-2 border-t">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>ביטול</Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="animate-spin ml-2" /> : <Pencil className="w-4 h-4 ml-2" />}
              {isUploading ? "מעלה קובץ..." : isEdit ? "שמור שינויים" : "צור נסיעה"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Calendar Modal */}
    <Dialog open={calendarModal.open} onOpenChange={(open) => { if (!open) setCalendarModal(prev => ({ ...prev, open: false })) }}>
      <DialogContent dir="rtl" className="w-auto max-w-[320px] p-4 flex items-center justify-center [&>button]:hidden" aria-describedby={undefined}>
        <DialogTitle className="sr-only">בחר תאריך</DialogTitle>
        <Calendar
          mode="single"
          selected={calendarModal.selected}
          onSelect={(date) => {
            calendarModal.onSelect(date)
            if (date) setCalendarModal(prev => ({ ...prev, open: false }))
          }}
          locale={he}
          dir="rtl"
        />
      </DialogContent>
    </Dialog>
    </>
  )
}
