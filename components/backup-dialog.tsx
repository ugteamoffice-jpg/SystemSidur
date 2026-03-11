"use client"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useTenant } from "@/lib/tenant-context"
import { useToast } from "@/hooks/use-toast"
import { Download, Upload, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { format } from "date-fns"

interface BackupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TABLES = [
  { key: "work-schedule",    label: "נסיעות" },
  { key: "drivers",          label: "נהגים" },
  { key: "customers",        label: "לקוחות" },
  { key: "vehicles",         label: "סוגי רכב (טמפלייט)" },
  { key: "vehicle-types",    label: "סוגי רכב" },
  { key: "company-vehicles", label: "רכבי חברה" },
  { key: "driver-hours",     label: "שעות נהג" },
]

async function fetchAllRecords(endpoint: string, tenantId: string): Promise<any[]> {
  const all: any[] = []
  const take = 200
  let skip = 0
  while (true) {
    const res = await fetch(`/api/${endpoint}?tenant=${tenantId}&take=${take}&skip=${skip}`)
    if (!res.ok) break
    const json = await res.json()
    const batch = json.records || []
    if (batch.length === 0) break
    all.push(...batch)
    skip += take
    if (batch.length < take) break
  }
  return all
}

export function BackupDialog({ open, onOpenChange }: BackupDialogProps) {
  const { tenantId } = useTenant()
  const { toast } = useToast()

  const [isBackingUp, setIsBackingUp] = React.useState(false)
  const [isRestoring, setIsRestoring] = React.useState(false)
  const [backupStatus, setBackupStatus] = React.useState("")
  const [restoreProgress, setRestoreProgress] = React.useState(0)
  const [restoreStats, setRestoreStats] = React.useState<{ table: string; created: number; skipped: number; errors: number }[] | null>(null)
  const [restoreFile, setRestoreFile] = React.useState<File | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleBackup = async () => {
    setIsBackingUp(true)
    setBackupStatus("")
    try {
      const tableData: Record<string, any[]> = {}
      let totalRecords = 0

      for (const table of TABLES) {
        setBackupStatus(`מגבה ${table.label}...`)
        try {
          const records = await fetchAllRecords(table.key, tenantId)
          tableData[table.key] = records
          totalRecords += records.length
        } catch {
          tableData[table.key] = []
        }
      }

      setBackupStatus("מוריד קובץ...")

      const backup = {
        version: 2,
        tenant: tenantId,
        exportedAt: new Date().toISOString(),
        totalRecords,
        tables: tableData
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `backup_${tenantId}_${format(new Date(), "dd-MM-yyyy_HH-mm")}.json`
      a.click()
      URL.revokeObjectURL(url)

      setBackupStatus(`✓ ${totalRecords} רשומות גובו בהצלחה`)
      toast({ title: "גיבוי הצליח", description: `${totalRecords} רשומות מ-${TABLES.length} טבלאות` })
    } catch (e) {
      toast({ title: "שגיאה בגיבוי", variant: "destructive" })
      setBackupStatus("")
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) { setRestoreFile(file); setRestoreStats(null) }
  }

  const handleRestore = async () => {
    if (!restoreFile) return
    setIsRestoring(true)
    setRestoreProgress(0)
    setRestoreStats(null)

    try {
      const text = await restoreFile.text()
      const backup = JSON.parse(text)

      // Support both v1 (records only) and v2 (multi-table)
      const isV1 = backup.version === 1 && Array.isArray(backup.records)
      const tableData: Record<string, any[]> = isV1
        ? { "work-schedule": backup.records }
        : (backup.tables || {})

      const tablesToRestore = TABLES.filter(t => Array.isArray(tableData[t.key]) && tableData[t.key].length > 0)
      const stats: { table: string; created: number; skipped: number; errors: number }[] = []

      for (let ti = 0; ti < tablesToRestore.length; ti++) {
        const table = tablesToRestore[ti]
        const records: any[] = tableData[table.key]
        let created = 0, skipped = 0, errors = 0

        // Fetch existing IDs to skip duplicates
        const existingIds = new Set<string>()
        try {
          const existing = await fetchAllRecords(table.key, tenantId)
          existing.forEach((r: any) => existingIds.add(r.id))
        } catch {}

        const toCreate = records.filter((r: any) => !existingIds.has(r.id))
        skipped = records.length - toCreate.length

        const BATCH = 5
        for (let i = 0; i < toCreate.length; i += BATCH) {
          const batch = toCreate.slice(i, i + BATCH)
          await Promise.all(batch.map(async (record: any) => {
            try {
              const res = await fetch(`/api/${table.key}?tenant=${tenantId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fields: record.fields })
              })
              if (res.ok) created++
              else errors++
            } catch { errors++ }
          }))
          setRestoreProgress(Math.round(((ti / tablesToRestore.length) + ((i + BATCH) / toCreate.length / tablesToRestore.length)) * 100))
        }

        stats.push({ table: table.label, created, skipped, errors })
      }

      setRestoreStats(stats)
      setRestoreProgress(100)
      const totalCreated = stats.reduce((s, r) => s + r.created, 0)
      toast({ title: "שחזור הושלם", description: `נוצרו ${totalCreated} רשומות` })
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
          <DialogTitle className="text-right">גיבוי ושחזור המערכת</DialogTitle>
          <DialogDescription className="text-right">
            גבה את כל הנתונים — נסיעות, נהגים, לקוחות, רכבים ועוד
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">

          {/* Backup Section */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold text-base">גיבוי — הורדת כל הנתונים</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              מוריד קובץ JSON עם כל הטבלאות: נסיעות, נהגים, לקוחות, רכבים, שעות נהג
            </p>
            {isBackingUp && (
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{backupStatus}</span>
              </div>
            )}
            {!isBackingUp && backupStatus && (
              <p className="text-sm text-green-700">{backupStatus}</p>
            )}
            <Button onClick={handleBackup} disabled={isBackingUp} className="w-full">
              {isBackingUp ? <><Loader2 className="h-4 w-4 animate-spin ml-2" />מגבה...</> : <><Download className="h-4 w-4 ml-2" />הורד גיבוי מלא</>}
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
              <span>רשומות שכבר קיימות במערכת לא ייכפלו. רק רשומות חסרות ייווצרו.</span>
            </div>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
              {restoreFile ? `✓ ${restoreFile.name}` : "בחר קובץ גיבוי..."}
            </Button>
            {isRestoring && (
              <div className="space-y-1">
                <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-green-600 h-2 rounded-full transition-all" style={{width: `${restoreProgress}%`}} /></div>
                <p className="text-xs text-muted-foreground text-center">משחזר... {restoreProgress}%</p>
              </div>
            )}
            {restoreStats && (
              <div className="space-y-1">
                {restoreStats.map(r => (
                  <div key={r.table} className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span><b>{r.table}</b>: נוצרו {r.created} • דולגו {r.skipped}{r.errors > 0 ? ` • ${r.errors} שגיאות` : ""}</span>
                  </div>
                ))}
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
