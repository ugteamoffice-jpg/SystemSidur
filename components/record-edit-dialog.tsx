"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { he } from "date-fns/locale"
import { cn } from "@/lib/utils"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { WorkScheduleRecord, TableSchema } from "@/types/work-schedule"

interface RecordEditDialogProps {
  record: WorkScheduleRecord | null
  schema: TableSchema
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (record: WorkScheduleRecord) => void
}

export function RecordEditDialog({ record, schema, open, onOpenChange, onSave }: RecordEditDialogProps) {
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [previousDriver, setPreviousDriver] = useState<any>(null)

  useEffect(() => {
    if (record) {
      const updatedFields = { ...record.fields }
      schema.fields.forEach((field) => {
        if (field.type === "date" && !updatedFields[field.id]) {
          updatedFields[field.id] = format(new Date(), "yyyy-MM-dd")
        }
      })
      setFormData(updatedFields)
      setPreviousDriver(updatedFields["fldGTTvqQ8lii1wfiS5"])
    }
  }, [record, schema.fields])

  const handleSave = async () => {
    if (!record) return

    try {
      setSaving(true)

      const currentDriver = formData["fldGTTvqQ8lii1wfiS5"]
      const driverChanged = JSON.stringify(previousDriver) !== JSON.stringify(currentDriver)

      const fieldsToSave = { ...formData }
      if (driverChanged) {
        fieldsToSave["fldjMfOvWEu7HtjSQmv"] = false // Reset שלח
      }

      const response = await fetch(`/api/work-schedule/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: fieldsToSave }),
      })

      if (response.ok) {
        const updatedRecord = await response.json()
        onSave({ ...record, fields: fieldsToSave })
        toast.success("הרשומה עודכנה בהצלחה")
        onOpenChange(false)
      } else {
        toast.error("שגיאה בעדכון הרשומה")
      }
    } catch (error) {
      console.error("Error saving record:", error)
      toast.error("שגיאה בעדכון הרשומה")
    } finally {
      setSaving(false)
    }
  }

  const renderField = (field: any) => {
    const value = formData[field.id]

    if (field.name === "שלח" || field.name === "מאושר" || field.name === 'מע"מ') {
      return null
    }

    if (field.isComputed) {
      return (
        <div className="space-y-2">
          <Label>{field.name}</Label>
          <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
            {typeof value === "number" ? value.toFixed(2) : value || "—"}
          </div>
        </div>
      )
    }

    if (field.type === "checkbox") {
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={field.id}
            checked={value || false}
            onCheckedChange={(checked) => setFormData({ ...formData, [field.id]: checked })}
          />
          <Label htmlFor={field.id} className="cursor-pointer">
            {field.name}
          </Label>
        </div>
      )
    }

    if (field.type === "link") {
      return (
        <div className="space-y-2">
          <Label>{field.name}</Label>
          <div className="text-sm text-primary bg-muted p-2 rounded">
            {Array.isArray(value) ? value.map((v) => v.title).join(", ") : value?.title || "—"}
          </div>
        </div>
      )
    }

    if (field.type === "singleLineText" && field.name.includes("הערות")) {
      return (
        <div className="space-y-2">
          <Label htmlFor={field.id}>{field.name}</Label>
          <Textarea
            id={field.id}
            value={value || ""}
            onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
            rows={3}
          />
        </div>
      )
    }

    if (field.type === "date") {
      const dateValue = value ? new Date(value) : undefined
      return (
        <div className="space-y-2">
          <Label htmlFor={field.id}>{field.name}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-right font-normal", !dateValue && "text-muted-foreground")}
              >
                <CalendarIcon className="ml-2 h-4 w-4" />
                {dateValue ? format(dateValue, "PPP", { locale: he }) : ""}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateValue}
                onSelect={(date) => {
                  if (date) {
                    setFormData({ ...formData, [field.id]: format(date, "yyyy-MM-dd") })
                  }
                }}
                locale={he}
                dir="rtl"
              />
            </PopoverContent>
          </Popover>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <Label htmlFor={field.id}>{field.name}</Label>
        <Input
          id={field.id}
          type={field.type === "number" ? "number" : "text"}
          value={value || ""}
          onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
        />
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" dir="rtl">
        <div className="space-y-4 py-4">
          {schema.fields.map((field) => (
            <div key={field.id}>{renderField(field)}</div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            ביטול
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            שמירה
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
