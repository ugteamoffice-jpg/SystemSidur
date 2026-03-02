"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Plus, Search, Loader2, Trash2, Info } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useTenantFields, useTenant } from "@/lib/tenant-context"

interface CompanyVehicle {
  id: string
  fields: { [key: string]: any }
}

export default function CompanyVehiclesGrid() {
  const tenantFields = useTenantFields()
  const { tenantId } = useTenant()
  const CV = tenantFields?.companyVehicles

  // אם אין config לשדות — נגלה דינמית מהרשומה הראשונה
  const CAR_NUMBER_F = CV?.CAR_NUMBER || ""
  const MAKE_MODEL_F = CV?.MAKE_MODEL || ""
  const NOTES_F = CV?.NOTES || ""

  // Helper: שולף ערך מרשומה לפי field ID או לפי מיקום
  const getField = (v: CompanyVehicle, fieldId: string, fallbackIndex: number) => {
    if (fieldId && v.fields[fieldId] !== undefined) return v.fields[fieldId]
    const keys = Object.keys(v.fields)
    return keys[fallbackIndex] ? v.fields[keys[fallbackIndex]] : ""
  }

  const [vehicles, setVehicles] = useState<CompanyVehicle[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [notConfigured, setNotConfigured] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [form, setForm] = useState({ carNumber: "", makeModel: "", notes: "" })
  const { toast } = useToast()

  const tableContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { fetchVehicles() }, [])

  const fetchVehicles = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/company-vehicles?tenant=${tenantId}`)
      const data = await res.json()
      if (data.notConfigured) { setNotConfigured(true); return }
      setVehicles(data.records || [])
    } catch {
      toast({ title: "שגיאה", description: "לא ניתן לטעון רכבי חברה", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  const buildFields = () => {
    const f: any = {}
    if (CAR_NUMBER_F && form.carNumber) f[CAR_NUMBER_F] = form.carNumber
    if (MAKE_MODEL_F && form.makeModel) f[MAKE_MODEL_F] = form.makeModel
    if (NOTES_F && form.notes) f[NOTES_F] = form.notes
    return f
  }

  const handleCreate = async () => {
    try {
      const res = await fetch(`/api/company-vehicles?tenant=${tenantId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: buildFields() })
      })
      if (!res.ok) throw new Error()
      toast({ title: "הצלחה", description: "רכב נוסף בהצלחה" })
      closeDialog(); fetchVehicles()
    } catch { toast({ title: "שגיאה", description: "לא ניתן להוסיף רכב", variant: "destructive" }) }
  }

  const handleUpdate = async () => {
    if (!editingId) return
    try {
      const res = await fetch(`/api/company-vehicles/${editingId}?tenant=${tenantId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: buildFields() })
      })
      if (!res.ok) throw new Error()
      toast({ title: "הצלחה", description: "רכב עודכן בהצלחה" })
      closeDialog(); fetchVehicles()
    } catch { toast({ title: "שגיאה", description: "לא ניתן לעדכן רכב", variant: "destructive" }) }
  }

  const handleDelete = async () => {
    if (!editingId) return
    try {
      const res = await fetch(`/api/company-vehicles/${editingId}?tenant=${tenantId}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast({ title: "הצלחה", description: "רכב נמחק" })
      setDeleteConfirmOpen(false); closeDialog(); fetchVehicles()
    } catch { toast({ title: "שגיאה", description: "לא ניתן למחוק רכב", variant: "destructive" }) }
  }

  const openEdit = (v: CompanyVehicle) => {
    setEditingId(v.id)
    setForm({
      carNumber: getField(v, CAR_NUMBER_F, 0) || "",
      makeModel: getField(v, MAKE_MODEL_F, 1) || "",
      notes: getField(v, NOTES_F, 2) || "",
    })
    setIsDialogOpen(true)
  }

  const closeDialog = () => {
    setIsDialogOpen(false); setEditingId(null)
    setForm({ carNumber: "", makeModel: "", notes: "" })
  }

  const filtered = vehicles.filter(v => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return Object.values(v.fields).some(val => String(val).toLowerCase().includes(q))
  })

  if (notConfigured) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center" dir="rtl">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md">
          <Info className="h-8 w-8 text-blue-500 mx-auto mb-3" />
          <h3 className="font-bold text-lg mb-2">טבלת רכבי חברה לא מוגדרת</h3>
          <p className="text-muted-foreground text-sm mb-4">
            יש ליצור טבלה חדשה בטיאבל עם השדות:<br />
            <strong>מספר רכב</strong>, <strong>יצרן/דגם</strong>, <strong>הערות</strong><br />
            ולהוסיף את ה-Table ID לקובץ הקונפיגורציה.
          </p>
          <code className="text-xs bg-white border rounded px-2 py-1 block text-right">
            "COMPANY_VEHICLES": "tbl..."
          </code>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col p-6 pt-4 space-y-4 overflow-hidden" dir="rtl">
      <div className="flex items-center gap-4 flex-none flex-wrap">
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 ml-2" />
          הוסף רכב חברה
        </Button>
        <div className="relative w-[260px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="חיפוש..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pr-10" />
        </div>
        <div className="mr-auto text-sm text-muted-foreground">סה"כ {filtered.length} רכבים</div>
      </div>

      <div ref={tableContainerRef} className="border rounded-lg flex-1 overflow-auto bg-background shadow-sm">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
            <TableRow>
              <TableHead className="text-right pr-4">מספר רכב</TableHead>
              <TableHead className="text-right pr-4">יצרן / דגם</TableHead>
              <TableHead className="text-right pr-4">הערות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={3} className="text-center py-8">
                <div className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-muted-foreground">טוען...</span></div>
              </TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                {searchQuery ? "לא נמצאו תוצאות" : "אין רכבי חברה — הוסף את הראשון"}
              </TableCell></TableRow>
            )}
            {!isLoading && filtered.map(v => (
              <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(v)}>
                <TableCell className="font-mono font-medium pr-4">{getField(v, CAR_NUMBER_F, 0) || "—"}</TableCell>
                <TableCell className="pr-4">{getField(v, MAKE_MODEL_F, 1) || "—"}</TableCell>
                <TableCell className="pr-4 text-muted-foreground truncate max-w-[200px]">{getField(v, NOTES_F, 2) || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* דיאלוג הוספה/עריכה */}
      <Dialog open={isDialogOpen} onOpenChange={open => { if (!open) closeDialog() }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId ? "עריכת רכב חברה" : "רכב חברה חדש"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>מספר רכב <span className="text-red-500">*</span></Label>
              <Input value={form.carNumber} onChange={e => setForm(p => ({ ...p, carNumber: e.target.value }))} placeholder="12-345-67" className="text-right" />
            </div>
            <div className="space-y-1">
              <Label>יצרן / דגם</Label>
              <Input value={form.makeModel} onChange={e => setForm(p => ({ ...p, makeModel: e.target.value }))} placeholder="Toyota Corolla" className="text-right" />
            </div>
            <div className="space-y-1">
              <Label>הערות</Label>
              <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="text-right" />
            </div>
          </div>
          <div className="flex justify-between items-center mt-4">
            <div>
              {editingId && (
                <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => setDeleteConfirmOpen(true)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeDialog}>ביטול</Button>
              <Button onClick={editingId ? handleUpdate : handleCreate} disabled={!form.carNumber.trim()}>
                {editingId ? "שמור" : "הוסף רכב"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* אישור מחיקה */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת רכב</AlertDialogTitle>
            <AlertDialogDescription>
              האם למחוק את הרכב <strong>{form.carNumber}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete}>מחק</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
