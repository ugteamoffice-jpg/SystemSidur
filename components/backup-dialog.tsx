"use client"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useTenant, useTenantFields } from "@/lib/tenant-context"
import { useToast } from "@/hooks/use-toast"
import { Download, Upload, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { format } from "date-fns"

interface BackupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BackupDialog({ open, onOpenChange }: BackupDialogProps) {
  const { tenantId } = useTenant()
  const tenantFields = useTenantFields()
  const { toast } = useToast()

  const [isBackingUp, setIsBackingUp] = React.useState(false)
  const [isRestoring, setIsRestoring] = React.useState(false)
  const [backupProgress, setBackupProgress] = React.useState(0)
  const [restoreProgress, setRestoreProgress] = React.useState(0)
  const [restoreStats, setRestoreStats] = React.useState<{ created: number; skipped: number; errors: number } | null>(null)
  const [restoreFile, setRestoreFile] = React.useState<File | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleBackup = async () => {
    setIsBackingUp(true)
    setBackupProgress(0)
    try {
      // Fetch all records in batches
      const allRecords: any[] = []
      const take = 200
      let skip = 0

      // Fetch all pages until we get an empty batch
      while (true) {
        const res = await fetch(`/api/work-schedule?tenant=${tenantId}&take=${take}&skip=${skip}`)
        const json = await res.json()
        const batch = json.records || []
        if (batch.length === 0) break
        allRecords.push(...batch)
        skip += take
        setBackupProgress(Math.min(90, skip))
        if (batch.length < take) break // last page
      }

      setBackupProgress(95)

      const backup = {
        version: 1,
        tenant: tenantId,
        exportedAt: new Date().toISOString(),
        totalRecords: allRecords.length,
        records: allRecords
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `backup_${tenantId}_${format(new Date(), "dd-MM-yyyy_HH-mm")}.json`
      a.click()
      URL.revokeObjectURL(url)

      setBackupProgress(100)
      toast({ title: "גיבוי הצליח", description: `${allRecords.length} נסיעות גובו בהצלחה` })
    } catch (e) {
      toast({ title: "שגיאה בגיבוי", variant: "destructive" })
    } finally {
      setIsBackingUp(false)
      setTimeout(() => setBackupProgress(0), 2000)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setRestoreFile(file)
  }

  const handleRestore = async () => {
    if (!restoreFile) return
    setIsRestoring(true)
    setRestoreProgress(0)
    setRestoreStats(null)

    try {
      const text = await restoreFile.text()
      const backup = JSON.parse(text)

      if (!backup.records || !Array.isArray(backup.records)) {
        toast({ title: "קובץ לא תקין", description: "הקובץ אינו קובץ גיבוי תקני", variant: "destructive" })
        return
      }

      const records = backup.records
      const total = records.length

      const WS = tenantFields?.workSchedule || ({} as any)
      const hasWS = !!(WS.DATE && WS.DESCRIPTION)

      let created = 0
      let skipped = 0
      let errors = 0
      let toCreate = records

      // Only do duplicate detection if we have field mappings
      if (hasWS) {
        const existingKeys = new Set<string>()
        let skip = 0
        const take = 200
        while (true) {
          const res = await fetch(`/api/work-schedule?tenant=${tenantId}&take=${take}&skip=${skip}`)
          const json = await res.json()
          const batch = json.records || []
          if (batch.length === 0) break
          batch.forEach((r: any) => {
            const date = r.fields?.[WS.DATE] || ""
            const route = r.fields?.[WS.DESCRIPTION] || ""
            const pickup = r.fields?.[WS.PICKUP_TIME] || ""
            existingKeys.add(`${date}||${route}||${pickup}`)
          })
          skip += take
          if (batch.length < take) break
        }
        toCreate = records.filter((r: any) => {
          const date = r.fields?.[WS.DATE] || ""
          const route = r.fields?.[WS.DESCRIPTION] || ""
          const pickup = r.fields?.[WS.PICKUP_TIME] || ""
          return !existingKeys.has(`${date}||${route}||${pickup}`)
        })
      }

      if (toCreate.length === 0) {
        setRestoreStats({ created: 0, skipped: records.length, errors: 0 })
        toast({ title: "אין נסיעות לשחזור", description: "כל הנסיעות בגיבוי כבר קיימות במערכת" })
        setIsRestoring(false)
        setRestoreProgress(100)
        return
      }

      // Create in batches of 10
      const BATCH = 10
      for (let i = 0; i < toCreate.length; i += BATCH) {
        const batch = toCreate.slice(i, i + BATCH)
        await Promise.all(batch.map(async (record: any) => {
          try {
            const res = await fetch(`/api/work-schedule?tenant=${tenantId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fields: record.fields })
            })
            if (res.ok) created++
            else errors++
          } catch { errors++ }
        }))
        setRestoreProgress(Math.round(((i + BATCH) / toCreate.length) * 100))
      }

      skipped = records.length - toCreate.length
      setRestoreStats({ created, skipped, errors })
      setRestoreProgress(100)
      toast({
        title: "שחזור הושלם",
        description: `נוצרו ${created} נסיעות, דולגו ${skipped} קיימות${errors > 0 ? `, ${errors} שגיאות` : ""}`
      })
    } catch (e) {
      toast({ title: "שגיאה בשחזור", description: "לא ניתן לקרוא את הקובץ", variant: "destructive" })
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right">גיבוי ושחזור נסיעות</DialogTitle>
          <DialogDescription className="text-right">
            גבה את כל הנסיעות למחשב שלך, או שחזר מקובץ גיבוי קיים
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">

          {/* Backup Section */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold text-base">גיבוי — הורדת נסיעות</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              מוריד קובץ JSON עם כל הנסיעות שמורות במערכת
            </p>
            {isBackingUp && (
              <div className="space-y-1">
                <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full transition-all" style={{width: `${backupProgress}%`}} /></div>
                <p className="text-xs text-muted-foreground text-center">{backupProgress}%</p>
              </div>
            )}
            <Button onClick={handleBackup} disabled={isBackingUp} className="w-full">
              {isBackingUp ? <><Loader2 className="h-4 w-4 animate-spin ml-2" />מגבה...</> : <><Download className="h-4 w-4 ml-2" />הורד גיבוי</>}
            </Button>
          </div>

          {/* Restore Section */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-green-600" />
              <h3 className="font-bold text-base">שחזור — העלאת גיבוי</h3>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded p-2 flex gap-2 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>נסיעות שכבר קיימות במערכת לא יידרשו שוב. רק נסיעות חסרות ייווצרו.</span>
            </div>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
              {restoreFile ? `✓ ${restoreFile.name}` : "בחר קובץ גיבוי..."}
            </Button>
            {isRestoring && (
              <div className="space-y-1">
                <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-green-600 h-2 rounded-full transition-all" style={{width: `${restoreProgress}%`}} /></div>
                <p className="text-xs text-muted-foreground text-center">מעלה נסיעות... {restoreProgress}%</p>
              </div>
            )}
            {restoreStats && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>נוצרו <b>{restoreStats.created}</b> נסיעות • דולגו <b>{restoreStats.skipped}</b> קיימות{restoreStats.errors > 0 ? ` • ${restoreStats.errors} שגיאות` : ""}</span>
              </div>
            )}
            <Button onClick={handleRestore} disabled={!restoreFile || isRestoring} variant="default" className="w-full bg-green-600 hover:bg-green-700">
              {isRestoring ? <><Loader2 className="h-4 w-4 animate-spin ml-2" />משחזר...</> : <><Upload className="h-4 w-4 ml-2" />שחזר מגיבוי</>}
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  )
}
