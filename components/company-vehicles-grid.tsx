"use client"

import React, { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Plus, Search, Loader2, Trash2, Info, Upload, Eye, X, FileText, Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { useToast } from "@/hooks/use-toast"
import { useTenantFields, useTenant } from "@/lib/tenant-context"

interface AttachmentEntry {
  id?: string
  name: string
  token?: string
  url?: string
  mimetype?: string
  size?: number
}

interface CompanyVehicle {
  id: string
  fields: { [key: string]: any }
}

function expiryStatus(dateStr: string | undefined): "valid" | "expiring" | "expired" | "none" {
  if (!dateStr) return "none"
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const expiry = new Date(dateStr); expiry.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((expiry.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0) return "expired"
  if (diffDays <= 30) return "expiring"
  return "valid"
}

function ExpiryBadge({ date }: { date: string | undefined }) {
  if (!date) return <span className="text-muted-foreground text-xs">—</span>
  const status = expiryStatus(date)
  const formatted = new Date(date).toLocaleDateString("he-IL")
  if (status === "expired")  return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 border border-red-200">{formatted} ⚠ פג</span>
  if (status === "expiring") return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 border border-orange-300">{formatted} ⚠ קרוב</span>
  return <span className="text-xs text-green-700 font-medium">{formatted}</span>
}

function FileCell({ attachments, onView }: { attachments: AttachmentEntry[] | undefined, onView: (a: AttachmentEntry) => void }) {
  if (!attachments || attachments.length === 0) return <span className="text-muted-foreground text-xs">אין קובץ</span>
  return (
    <div className="flex flex-col gap-1">
      {attachments.map((a, i) => (
        <button
          key={i}
          onClick={(e) => { e.stopPropagation(); onView(a) }}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs underline text-right"
        >
          <FileText className="h-3 w-3 flex-shrink-0" />
          <span className="truncate max-w-[120px]">{a.name}</span>
        </button>
      ))}
    </div>
  )
}

function FileUploadField({
  label, current, newFile, onNewFile, onViewCurrent, onRemoveCurrent,
}: {
  label: string
  current: AttachmentEntry[]
  newFile: File | null
  onNewFile: (f: File | null) => void
  onViewCurrent: (a: AttachmentEntry) => void
  onRemoveCurrent: (a: AttachmentEntry) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {current.length > 0 && (
        <div className="flex flex-col gap-1 mb-1">
          {current.map((a, i) => (
            <div key={i} className="flex items-center gap-2 bg-muted rounded px-2 py-1 text-xs">
              <FileText className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="flex-1 truncate">{a.name}</span>
              <button onClick={() => onViewCurrent(a)} className="text-blue-600 hover:text-blue-800"><Eye className="h-3 w-3" /></button>
              <button onClick={() => onRemoveCurrent(a)} className="text-red-500 hover:text-red-700"><X className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      )}
      {newFile && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded px-2 py-1 text-xs mb-1">
          <FileText className="h-3 w-3 text-blue-500 flex-shrink-0" />
          <span className="flex-1 truncate">{newFile.name}</span>
          <button onClick={() => { onNewFile(null); if (ref.current) ref.current.value = "" }} className="text-red-500 hover:text-red-700"><X className="h-3 w-3" /></button>
        </div>
      )}
      <input ref={ref} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        onChange={e => onNewFile(e.target.files?.[0] || null)} />
      <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => ref.current?.click()} type="button">
        <Upload className="h-3 w-3" />
        {current.length > 0 || newFile ? "החלף קובץ" : "העלה קובץ"}
      </Button>
    </div>
  )
}

export default function CompanyVehiclesGrid() {
  const tenantFields = useTenantFields()
  const { tenantId } = useTenant()
  const CV = tenantFields?.companyVehicles as any

  const F = {
    VEHICLE_TYPE:            CV?.VEHICLE_TYPE || "",
    YEAR:                    CV?.YEAR || "",
    CAR_NUMBER:              CV?.CAR_NUMBER || "",
    INSURANCE_FILE:          CV?.INSURANCE_FILE || "",
    INSURANCE_EXPIRY:        CV?.INSURANCE_EXPIRY || "",
    OPERATION_PERMIT_FILE:   CV?.OPERATION_PERMIT_FILE || "",
    OPERATION_PERMIT_EXPIRY: CV?.OPERATION_PERMIT_EXPIRY || "",
    VEHICLE_LICENSE_FILE:    CV?.VEHICLE_LICENSE_FILE || "",
    VEHICLE_LICENSE_EXPIRY:  CV?.VEHICLE_LICENSE_EXPIRY || "",
  }

  // TABLE_ID נדרש להעלאת קבצים — נשלוף מה-API response או מ-context
  const [tableId, setTableId] = useState("")

  const [vehicles, setVehicles] = useState<CompanyVehicle[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [notConfigured, setNotConfigured] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [calendarModal, setCalendarModal] = useState<{
    open: boolean
    selected: Date | undefined
    onSelect: (d: Date | undefined) => void
  }>({ open: false, selected: undefined, onSelect: () => {} })
  const [vehicleTypesList, setVehicleTypesList] = useState<{ id: string; name: string }[]>([])
  const { toast } = useToast()

  const emptyForm = () => ({ carNumber: "", vehicleTypeDisplay: "", vehicleTypeId: "", year: "" })
  const emptyDates = () => ({ insuranceExpiry: "", operationPermitExpiry: "", vehicleLicenseExpiry: "" })
  const emptyNewFiles = () => ({ insuranceFile: null as File | null, operationPermitFile: null as File | null, vehicleLicenseFile: null as File | null })
  const emptyExisting = () => ({ insuranceFile: [] as AttachmentEntry[], operationPermitFile: [] as AttachmentEntry[], vehicleLicenseFile: [] as AttachmentEntry[] })

  const [form, setForm] = useState(emptyForm())
  const [dates, setDates] = useState(emptyDates())
  const [newFiles, setNewFiles] = useState(emptyNewFiles())
  const [existingFiles, setExistingFiles] = useState(emptyExisting())

  const tableContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchVehicles()
    fetchVehicleTypes()
  }, [])

  // When vehicleTypesList loads and we have a vehicleTypeId, update the display
  useEffect(() => {
    if (form.vehicleTypeId && vehicleTypesList.length > 0) {
      const found = vehicleTypesList.find(t => t.id === form.vehicleTypeId)
      if (found && form.vehicleTypeDisplay !== found.name) {
        setForm(p => ({ ...p, vehicleTypeDisplay: found.name }))
      }
    }
  }, [vehicleTypesList, form.vehicleTypeId])

  const fetchVehicleTypes = async () => {
    try {
      const res = await fetch(`/api/vehicles?tenant=${tenantId}`)
      const data = await res.json()
      const records = data?.records || []
      setVehicleTypesList(records.map((r: any) => {
        const val = r.fields?.["סוג רכב"]
        let name = ""
        if (typeof val === "string") name = val
        else if (Array.isArray(val)) name = val.map((x: any) => x?.title || x?.value || x).filter(Boolean).join(", ")
        else if (val && typeof val === "object") name = val.title || val.value || ""
        return { id: r.id, name: name || r.name || r.id }
      }).filter((t: any) => t.name && t.name !== t.id))
    } catch {}
  }

  const fetchVehicles = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/company-vehicles?tenant=${tenantId}`)
      const data = await res.json()
      if (data.notConfigured) { setNotConfigured(true); return }
      setVehicles(data.records || [])
      // שמור table ID אם מוחזר
      if (data.tableId) setTableId(data.tableId)
    } catch {
      toast({ title: "שגיאה", description: "לא ניתן לטעון רכבי חברה", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const gf = (v: CompanyVehicle, fieldId: string) => fieldId ? v.fields[fieldId] : undefined

  const getLabel = (v: CompanyVehicle) => gf(v, F.CAR_NUMBER) || "—"

  const getAttachments = (v: CompanyVehicle, fieldId: string): AttachmentEntry[] => {
    const val = gf(v, fieldId)
    if (!val) return []
    if (Array.isArray(val)) return val
    return []
  }

  const getLinkTitle = (v: CompanyVehicle, fieldId: string): string => {
    const val = gf(v, fieldId)
    if (!val) return "—"
    if (Array.isArray(val)) return val.map((x: any) => x?.title || x?.value || "").filter(Boolean).join(", ") || "—"
    if (typeof val === "object") return (val as any).title || (val as any).value || "—"
    return String(val)
  }

  const viewAttachment = async (a: AttachmentEntry) => {
    try {
      let url = a.url || ""
      if (a.token && !url) {
        const res = await fetch(`/api/attachment-url?token=${a.token}&tenant=${tenantId}`)
        const data = await res.json()
        url = data.url
      }
      if (url) window.open(url, "_blank")
      else toast({ title: "שגיאה", description: "לא ניתן לפתוח קובץ", variant: "destructive" })
    } catch {
      toast({ title: "שגיאה", description: "שגיאה בפתיחת הקובץ", variant: "destructive" })
    }
  }

  const uploadFile = async (recordId: string, file: File, fieldId: string, tblId: string) => {
    const fd = new FormData()
    fd.append("file", file)
    fd.append("tableId", tblId)
    fd.append("recordId", recordId)
    fd.append("fieldId", fieldId)
    const res = await fetch(`/api/upload-to-record?tenant=${tenantId}`, { method: "POST", body: fd })
    if (!res.ok) throw new Error(await res.text())
  }

  const buildFields = () => {
    const f: any = {}
    if (F.CAR_NUMBER && form.carNumber) {
      const n = Number(form.carNumber)
      f[F.CAR_NUMBER] = isNaN(n) ? form.carNumber : n
    }
    if (F.VEHICLE_TYPE && form.vehicleTypeId) {
      f[F.VEHICLE_TYPE] = [form.vehicleTypeId]
    }
    if (F.YEAR && form.year) {
      f[F.YEAR] = Number(form.year)
    }
    if (F.INSURANCE_EXPIRY && dates.insuranceExpiry)              f[F.INSURANCE_EXPIRY] = dates.insuranceExpiry
    if (F.OPERATION_PERMIT_EXPIRY && dates.operationPermitExpiry) f[F.OPERATION_PERMIT_EXPIRY] = dates.operationPermitExpiry
    if (F.VEHICLE_LICENSE_EXPIRY && dates.vehicleLicenseExpiry)   f[F.VEHICLE_LICENSE_EXPIRY] = dates.vehicleLicenseExpiry
    return f
  }

  const uploadPendingFiles = async (recordId: string, tblId: string) => {
    const uploads: Promise<void>[] = []
    if (newFiles.insuranceFile && F.INSURANCE_FILE)
      uploads.push(uploadFile(recordId, newFiles.insuranceFile, F.INSURANCE_FILE, tblId))
    if (newFiles.operationPermitFile && F.OPERATION_PERMIT_FILE)
      uploads.push(uploadFile(recordId, newFiles.operationPermitFile, F.OPERATION_PERMIT_FILE, tblId))
    if (newFiles.vehicleLicenseFile && F.VEHICLE_LICENSE_FILE)
      uploads.push(uploadFile(recordId, newFiles.vehicleLicenseFile, F.VEHICLE_LICENSE_FILE, tblId))
    if (uploads.length > 0) await Promise.all(uploads)
  }

  const handleCreate = async () => {
    if (!form.carNumber.trim()) {
      toast({ title: "שגיאה", description: "יש למלא מספר רכב", variant: "destructive" })
      return
    }
    const fields = buildFields()
    const tempId = "temp_" + Date.now()
    setVehicles(prev => [{ id: tempId, fields: { ...fields } } as CompanyVehicle, ...prev])
    closeDialog()

    try {
      const res = await fetch(`/api/company-vehicles?tenant=${tenantId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields })
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const newId = data.records?.[0]?.id
      if (newId && tableId) await uploadPendingFiles(newId, tableId)
      toast({ title: "רכב נוסף בהצלחה" })
      fetchVehicles()
    } catch {
      setVehicles(prev => prev.filter(v => v.id !== tempId))
      toast({ title: "שגיאה", description: "לא ניתן להוסיף רכב", variant: "destructive" })
    }
  }

  const handleUpdate = async () => {
    if (!editingId) return
    const prevVehicles = [...vehicles]
    const fields = buildFields()
    const updatedId = editingId

    setVehicles(prev => prev.map(v => v.id === updatedId ? { ...v, fields: { ...v.fields, ...fields } } : v))
    closeDialog()
    toast({ title: "רכב עודכן בהצלחה" })

    try {
      const res = await fetch(`/api/company-vehicles/${updatedId}?tenant=${tenantId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields })
      })
      if (!res.ok) throw new Error()
      if (tableId) await uploadPendingFiles(updatedId, tableId)
      fetchVehicles() // refresh for file URLs
    } catch {
      setVehicles(prevVehicles)
      toast({ title: "שגיאה", description: "לא ניתן לעדכן רכב", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!editingId) return
    const prevVehicles = [...vehicles]
    const deletedId = editingId

    setVehicles(prev => prev.filter(v => v.id !== deletedId))
    setDeleteConfirmOpen(false); closeDialog()
    toast({ title: "רכב נמחק" })

    try {
      const res = await fetch(`/api/company-vehicles/${deletedId}?tenant=${tenantId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
    } catch {
      setVehicles(prevVehicles)
      toast({ title: "שגיאה", description: "לא ניתן למחוק רכב", variant: "destructive" })
    }
  }

  const openEdit = (v: CompanyVehicle) => {
    setEditingId(v.id)
    const carNum = gf(v, F.CAR_NUMBER)
    const vtVal = gf(v, F.VEHICLE_TYPE)
    console.log("VEHICLE_TYPE raw value:", JSON.stringify(vtVal))
    console.log("vehicleTypesList:", JSON.stringify(vehicleTypesList))
    let vehicleTypeId = ""
    if (vtVal) {
      if (typeof vtVal === "string") vehicleTypeId = vtVal
      else if (Array.isArray(vtVal) && vtVal.length > 0) {
        const first = vtVal[0]
        if (typeof first === "string") vehicleTypeId = first
        else if (first?.id) vehicleTypeId = first.id
      } else if (typeof vtVal === "object" && (vtVal as any).id) {
        vehicleTypeId = (vtVal as any).id
      }
    }
    console.log("parsed vehicleTypeId:", vehicleTypeId)
    setForm({
      carNumber: carNum !== undefined && carNum !== null ? String(carNum) : "",
      vehicleTypeDisplay: getLinkTitle(v, F.VEHICLE_TYPE) === "—" ? "" : getLinkTitle(v, F.VEHICLE_TYPE),
      vehicleTypeId,
      year: (() => { const y = gf(v, F.YEAR); return y ? String(y) : "" })(),
    })
    const toDate = (v: any) => v ? String(v).slice(0, 10) : ""
    setDates({
      insuranceExpiry: toDate(gf(v, F.INSURANCE_EXPIRY)),
      operationPermitExpiry: toDate(gf(v, F.OPERATION_PERMIT_EXPIRY)),
      vehicleLicenseExpiry: toDate(gf(v, F.VEHICLE_LICENSE_EXPIRY)),
    })
    setExistingFiles({
      insuranceFile: getAttachments(v, F.INSURANCE_FILE),
      operationPermitFile: getAttachments(v, F.OPERATION_PERMIT_FILE),
      vehicleLicenseFile: getAttachments(v, F.VEHICLE_LICENSE_FILE),
    })
    setNewFiles(emptyNewFiles())
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false); setEditingId(null)
    setForm(emptyForm()); setDates(emptyDates())
    setNewFiles(emptyNewFiles()); setExistingFiles(emptyExisting())
  }

  const openCalendar = (
    currentValue: string,
    onSelect: (dateStr: string) => void
  ) => {
    const current = currentValue ? new Date(currentValue) : undefined
    setCalendarModal({
      open: true,
      selected: current,
      onSelect: (d) => {
        if (d) onSelect(format(d, "yyyy-MM-dd"))
      }
    })
  }

  // Column definitions
  const CV_COL_SIZING_KEY = `companyVehiclesColumnSizing_${tenantId}`
  const CV_COL_ORDER_KEY = `companyVehiclesColumnOrder_${tenantId}`
  const cvColumns = [
    { key: 'alert', header: '', fieldKey: '', defaultWidth: 32, minWidth: 32, sortable: false },
    { key: 'carNumber', header: 'מספר רכב', fieldKey: F.CAR_NUMBER, defaultWidth: 120, minWidth: 80, sortable: true },
    { key: 'vehicleType', header: 'סוג רכב', fieldKey: F.VEHICLE_TYPE, defaultWidth: 120, minWidth: 80, sortable: true },
    { key: 'year', header: 'שנה', fieldKey: F.YEAR, defaultWidth: 80, minWidth: 60, sortable: true },
    { key: 'insurance', header: 'ביטוח', fieldKey: F.INSURANCE_FILE, defaultWidth: 80, minWidth: 60, sortable: false },
    { key: 'insuranceExp', header: 'תוקף ביטוח', fieldKey: F.INSURANCE_EXPIRY, defaultWidth: 120, minWidth: 80, sortable: true },
    { key: 'permit', header: 'היתר הפעלה', fieldKey: F.OPERATION_PERMIT_FILE, defaultWidth: 80, minWidth: 60, sortable: false },
    { key: 'permitExp', header: 'תוקף היתר', fieldKey: F.OPERATION_PERMIT_EXPIRY, defaultWidth: 120, minWidth: 80, sortable: true },
    { key: 'license', header: 'רישיון רכב', fieldKey: F.VEHICLE_LICENSE_FILE, defaultWidth: 80, minWidth: 60, sortable: false },
    { key: 'licenseExp', header: 'תוקף רישיון', fieldKey: F.VEHICLE_LICENSE_EXPIRY, defaultWidth: 120, minWidth: 80, sortable: true },
  ]

  const [cvColumnWidths, setCvColumnWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') { try { const s = localStorage.getItem(CV_COL_SIZING_KEY); if (s) return JSON.parse(s) } catch {} }
    return {}
  })
  useEffect(() => { if (typeof window !== 'undefined' && Object.keys(cvColumnWidths).length > 0) { try { localStorage.setItem(CV_COL_SIZING_KEY, JSON.stringify(cvColumnWidths)) } catch {} } }, [cvColumnWidths])
  const getCvColWidth = (col: typeof cvColumns[0]) => cvColumnWidths[col.key] || col.defaultWidth
  const handleCvResizeStart = (colKey: string, minWidth: number, e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    const startX = e.clientX; const startWidth = cvColumnWidths[colKey] || cvColumns.find(c => c.key === colKey)!.defaultWidth
    const onMouseMove = (me: MouseEvent) => { setCvColumnWidths(old => ({ ...old, [colKey]: Math.max(minWidth, startWidth + (startX - me.clientX)) })) }
    const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp) }
    document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp)
  }

  const [cvSortConfig, setCvSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const handleCvSort = (key: string) => {
    const col = cvColumns.find(c => c.key === key)
    if (!col?.sortable) return
    setCvSortConfig(prev => prev?.key === key ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' })
  }

  const [cvColumnOrder, setCvColumnOrder] = useState<string[]>(() => {
    if (typeof window !== 'undefined') { try { const s = localStorage.getItem(CV_COL_ORDER_KEY); if (s) return JSON.parse(s) } catch {} }
    return cvColumns.map(c => c.key)
  })
  useEffect(() => { if (typeof window !== 'undefined' && cvColumnOrder.length > 0) { try { localStorage.setItem(CV_COL_ORDER_KEY, JSON.stringify(cvColumnOrder)) } catch {} } }, [cvColumnOrder])
  const [cvDraggingColId, setCvDraggingColId] = useState<string | null>(null)
  const cvDisplayColumns = cvColumnOrder.map(k => cvColumns.find(c => c.key === k)!).filter(Boolean)

  const filtered = vehicles.filter(v => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return Object.values(v.fields).some(val => String(val).toLowerCase().includes(q))
  })

  const sortedFiltered = React.useMemo(() => {
    if (!cvSortConfig) return filtered
    const col = cvColumns.find(c => c.key === cvSortConfig.key)
    if (!col || !col.fieldKey) return filtered
    return [...filtered].sort((a, b) => {
      let aVal = gf(a, col.fieldKey) ?? ''
      let bVal = gf(b, col.fieldKey) ?? ''
      // Handle link fields
      if (Array.isArray(aVal)) aVal = aVal.map((x: any) => x?.title || '').join('')
      if (Array.isArray(bVal)) bVal = bVal.map((x: any) => x?.title || '').join('')
      const cmp = String(aVal).localeCompare(String(bVal), 'he', { numeric: true })
      return cvSortConfig.direction === 'asc' ? cmp : -cmp
    })
  }, [filtered, cvSortConfig])

  const rowExpiryAlert = (v: CompanyVehicle) => {
    const statuses = [
      expiryStatus(gf(v, F.INSURANCE_EXPIRY)),
      expiryStatus(gf(v, F.OPERATION_PERMIT_EXPIRY)),
      expiryStatus(gf(v, F.VEHICLE_LICENSE_EXPIRY)),
    ]
    if (statuses.includes("expired")) return "expired"
    if (statuses.includes("expiring")) return "expiring"
    return "ok"
  }

  if (notConfigured) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center" dir="rtl">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md">
          <Info className="h-8 w-8 text-blue-500 mx-auto mb-3" />
          <h3 className="font-bold text-lg mb-2">טבלת רכבי חברה לא מוגדרת</h3>
          <p className="text-muted-foreground text-sm mb-4">יש להוסיף את ה-Table ID לקובץ הקונפיגורציה:</p>
          <code className="text-xs bg-white border rounded px-2 py-1 block text-right">{`"COMPANY_VEHICLES": "tbl..."`}</code>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col p-6 pt-4 space-y-4 overflow-hidden" dir="rtl">
      {/* סרגל עליון */}
      <div className="flex items-center gap-4 flex-none flex-wrap">
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 ml-2" />הוסף רכב חברה
        </Button>
        <div className="relative w-[260px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="חיפוש..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-10" />
        </div>
        <div className="mr-auto text-sm text-muted-foreground">סה&quot;כ {filtered.length} רכבים</div>
      </div>

      {/* טבלה */}
      <div ref={tableContainerRef} className="border rounded-lg flex-1 overflow-auto bg-background shadow-sm">
        <Table style={{ tableLayout: 'fixed' }}>
          <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
            <TableRow>
              {cvDisplayColumns.map(col => (
                <TableHead
                  key={col.key}
                  className={`text-right relative border-l select-none group hover:bg-muted/30 pr-4 transition-colors ${cvDraggingColId && cvDraggingColId !== col.key ? 'border-l-2 border-l-primary/30' : ''}`}
                  style={{ width: getCvColWidth(col), cursor: col.key === 'alert' ? 'default' : 'grab' }}
                  draggable={col.key !== 'alert'}
                  onDragStart={(e) => { if (col.key === 'alert') { e.preventDefault(); return }; setCvDraggingColId(col.key); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", col.key) }}
                  onDragOver={(e) => { if (!cvDraggingColId || col.key === 'alert') return; e.preventDefault(); e.dataTransfer.dropEffect = "move" }}
                  onDrop={(e) => {
                    e.preventDefault(); const src = e.dataTransfer.getData("text/plain")
                    if (!src || src === col.key || col.key === 'alert') { setCvDraggingColId(null); return }
                    const order = [...cvColumnOrder]; const fi = order.indexOf(src); const ti = order.indexOf(col.key)
                    if (fi === -1 || ti === -1) { setCvDraggingColId(null); return }
                    order.splice(fi, 1); order.splice(ti, 0, src); setCvColumnOrder(order); setCvDraggingColId(null)
                  }}
                  onDragEnd={() => setCvDraggingColId(null)}
                >
                  <div className={`flex items-center justify-between ${col.sortable ? 'cursor-pointer' : ''}`} onClick={() => handleCvSort(col.key)}>
                    {col.header}
                    {col.sortable && <span className="text-[10px] opacity-60 shrink-0">{cvSortConfig?.key === col.key ? (cvSortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}</span>}
                  </div>
                  {col.key !== 'alert' && (
                    <div onMouseDown={(e) => handleCvResizeStart(col.key, col.minWidth, e)} className="absolute left-0 top-0 h-full w-1 cursor-col-resize touch-none select-none z-20 hover:bg-primary transition-colors duration-200" />
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={cvDisplayColumns.length} className="text-center py-8">
                <div className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-muted-foreground">טוען...</span></div>
              </TableCell></TableRow>
            )}
            {!isLoading && sortedFiltered.length === 0 && (
              <TableRow><TableCell colSpan={cvDisplayColumns.length} className="text-center py-8 text-muted-foreground">
                {searchQuery ? "לא נמצאו תוצאות" : "אין רכבי חברה — הוסף את הראשון"}
              </TableCell></TableRow>
            )}
            {!isLoading && sortedFiltered.map(v => {
              const alert = rowExpiryAlert(v)
              const cellMap: Record<string, React.ReactNode> = {
                alert: <>
                  {alert === "expired"  && <span className="inline-block w-2 h-2 rounded-full bg-red-500" title="תוקף פג" />}
                  {alert === "expiring" && <span className="inline-block w-2 h-2 rounded-full bg-orange-400" title="קרוב לפקיעה" />}
                </>,
                carNumber: <span className="font-mono">{String(gf(v, F.CAR_NUMBER) ?? "—")}</span>,
                vehicleType: <span className="text-muted-foreground">{getLinkTitle(v, F.VEHICLE_TYPE)}</span>,
                year: <span className="text-muted-foreground">{gf(v, F.YEAR) ? String(gf(v, F.YEAR)) : "—"}</span>,
                insurance: <span onClick={e => e.stopPropagation()}><FileCell attachments={getAttachments(v, F.INSURANCE_FILE)} onView={viewAttachment} /></span>,
                insuranceExp: <ExpiryBadge date={gf(v, F.INSURANCE_EXPIRY)} />,
                permit: <span onClick={e => e.stopPropagation()}><FileCell attachments={getAttachments(v, F.OPERATION_PERMIT_FILE)} onView={viewAttachment} /></span>,
                permitExp: <ExpiryBadge date={gf(v, F.OPERATION_PERMIT_EXPIRY)} />,
                license: <span onClick={e => e.stopPropagation()}><FileCell attachments={getAttachments(v, F.VEHICLE_LICENSE_FILE)} onView={viewAttachment} /></span>,
                licenseExp: <ExpiryBadge date={gf(v, F.VEHICLE_LICENSE_EXPIRY)} />,
              }
              return (
                <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50 border-b" onClick={() => openEdit(v)}>
                  {cvDisplayColumns.map(col => (
                    <TableCell key={col.key} className="pr-4 truncate">{cellMap[col.key]}</TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* ─── דיאלוג הוספה/עריכה ─── */}
      <Dialog open={isDialogOpen} onOpenChange={open => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId ? "עריכת רכב חברה" : "רכב חברה חדש"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 mt-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>מספר רכב <span className="text-red-500">*</span></Label>
                <Input
                  value={form.carNumber}
                  onChange={e => {
                    const val = e.target.value
                    if (/^[0-9\-]*$/.test(val)) setForm(p => ({ ...p, carNumber: val }))
                  }}
                  placeholder="12-345-67"
                  className="text-right"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1">
                <Label>סוג רכב</Label>
                <Select
                  value={form.vehicleTypeId}
                  onValueChange={(val) => {
                    const found = vehicleTypesList.find(t => t.id === val)
                    setForm(p => ({ ...p, vehicleTypeId: val, vehicleTypeDisplay: found?.name || "" }))
                  }}
                  dir="rtl"
                >
                  <SelectTrigger className="text-right">
                    <SelectValue placeholder="בחר סוג רכב" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleTypesList.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>שנה</Label>
                <Input
                  value={form.year}
                  onChange={e => {
                    const val = e.target.value
                    if (/^[0-9]{0,4}$/.test(val)) setForm(p => ({ ...p, year: val }))
                  }}
                  placeholder="2024"
                  className="text-right"
                  inputMode="numeric"
                  maxLength={4}
                />
                {form.year && (form.year.length !== 4 || Number(form.year) < 1900 || Number(form.year) > 2100) && (
                  <p className="text-xs text-red-500">שנה לא תקינה</p>
                )}
              </div>
            </div>
            <hr />
            {/* ביטוח */}
            <div className="grid grid-cols-2 gap-4 items-start">
              <FileUploadField label="ביטוח"
                current={existingFiles.insuranceFile} newFile={newFiles.insuranceFile}
                onNewFile={f => setNewFiles(p => ({ ...p, insuranceFile: f }))}
                onViewCurrent={viewAttachment}
                onRemoveCurrent={a => setExistingFiles(p => ({ ...p, insuranceFile: p.insuranceFile.filter(x => x !== a) }))}
              />
              <div className="space-y-1">
                <Label>תוקף ביטוח</Label>
                <Button variant="outline" className="w-full justify-start text-right h-9 text-sm" type="button"
                  onClick={() => openCalendar(dates.insuranceExpiry, (d) => setDates(p => ({ ...p, insuranceExpiry: d })))}>
                  <CalendarIcon className="ml-2 h-4 w-4 shrink-0" />
                  {dates.insuranceExpiry ? format(new Date(dates.insuranceExpiry), "dd/MM/yyyy", { locale: he }) : "בחר תאריך"}
                </Button>
                {dates.insuranceExpiry && <ExpiryBadge date={dates.insuranceExpiry} />}
              </div>
            </div>
            {/* היתר הפעלה */}
            <div className="grid grid-cols-2 gap-4 items-start">
              <FileUploadField label="היתר הפעלה"
                current={existingFiles.operationPermitFile} newFile={newFiles.operationPermitFile}
                onNewFile={f => setNewFiles(p => ({ ...p, operationPermitFile: f }))}
                onViewCurrent={viewAttachment}
                onRemoveCurrent={a => setExistingFiles(p => ({ ...p, operationPermitFile: p.operationPermitFile.filter(x => x !== a) }))}
              />
              <div className="space-y-1">
                <Label>תוקף היתר הפעלה</Label>
                <Button variant="outline" className="w-full justify-start text-right h-9 text-sm" type="button"
                  onClick={() => openCalendar(dates.operationPermitExpiry, (d) => setDates(p => ({ ...p, operationPermitExpiry: d })))}>
                  <CalendarIcon className="ml-2 h-4 w-4 shrink-0" />
                  {dates.operationPermitExpiry ? format(new Date(dates.operationPermitExpiry), "dd/MM/yyyy", { locale: he }) : "בחר תאריך"}
                </Button>
                {dates.operationPermitExpiry && <ExpiryBadge date={dates.operationPermitExpiry} />}
              </div>
            </div>
            {/* רישיון רכב */}
            <div className="grid grid-cols-2 gap-4 items-start">
              <FileUploadField label="רישיון רכב"
                current={existingFiles.vehicleLicenseFile} newFile={newFiles.vehicleLicenseFile}
                onNewFile={f => setNewFiles(p => ({ ...p, vehicleLicenseFile: f }))}
                onViewCurrent={viewAttachment}
                onRemoveCurrent={a => setExistingFiles(p => ({ ...p, vehicleLicenseFile: p.vehicleLicenseFile.filter(x => x !== a) }))}
              />
              <div className="space-y-1">
                <Label>תוקף רישיון רכב</Label>
                <Button variant="outline" className="w-full justify-start text-right h-9 text-sm" type="button"
                  onClick={() => openCalendar(dates.vehicleLicenseExpiry, (d) => setDates(p => ({ ...p, vehicleLicenseExpiry: d })))}>
                  <CalendarIcon className="ml-2 h-4 w-4 shrink-0" />
                  {dates.vehicleLicenseExpiry ? format(new Date(dates.vehicleLicenseExpiry), "dd/MM/yyyy", { locale: he }) : "בחר תאריך"}
                </Button>
                {dates.vehicleLicenseExpiry && <ExpiryBadge date={dates.vehicleLicenseExpiry} />}
              </div>
            </div>
          </div>
          {/* כפתורים */}
          <div className="flex justify-between items-center mt-6 pt-4 border-t">
            <div>
              {editingId && (
                <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => setDeleteConfirmOpen(true)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeDialog} disabled={isSaving}>ביטול</Button>
              <Button onClick={editingId ? handleUpdate : handleCreate} disabled={isSaving || !form.carNumber.trim()}>
                {isSaving ? <><Loader2 className="h-4 w-4 animate-spin ml-2" />שומר...</> : editingId ? "שמור" : "הוסף רכב"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── אישור מחיקה ─── */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת רכב חברה</AlertDialogTitle>
            <AlertDialogDescription>האם למחוק את הרכב <strong>{form.carNumber}</strong>? פעולה זו אינה הפיכה.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Calendar Modal ─── */}
      <Dialog open={calendarModal.open} onOpenChange={(open) => setCalendarModal(p => ({ ...p, open }))}>
        <DialogContent dir="rtl" className="w-auto max-w-[320px] p-4 flex items-center justify-center [&>button]:hidden" aria-describedby={undefined}>
          <DialogTitle className="sr-only">בחר תאריך</DialogTitle>
          <Calendar
            mode="single"
            selected={calendarModal.selected}
            onSelect={(date) => {
              calendarModal.onSelect(date)
              if (date) setCalendarModal(p => ({ ...p, open: false }))
            }}
            locale={he}
            dir="rtl"
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
