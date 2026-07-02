// lib/operation-queue.ts
// תור שאוסף את כל הפעולות (עדכון, מחיקה, יצירה) ושולח אותן בבקשה אחת כל כמה שניות

type Operation = {
  type: "update" | "delete" | "create"
  recordId?: string
  fields?: any
  table?: string // default: work-schedule
}

type QueuedOp = Operation & {
  resolve: (ok: boolean) => void
}

class OperationQueue {
  private queue: QueuedOp[] = []
  private timer: NodeJS.Timeout | null = null
  private flushIntervalMs: number
  private tenantId: string = ""

  constructor(flushIntervalMs = 3000) {
    this.flushIntervalMs = flushIntervalMs
  }

  setTenant(tenantId: string) {
    this.tenantId = tenantId
  }

  add(op: Operation): Promise<boolean> {
    return new Promise((resolve) => {
      this.queue.push({ ...op, resolve })
      this.scheduleFlush()
    })
  }

  private scheduleFlush() {
    if (this.timer) return // כבר מתוזמן
    this.timer = setTimeout(() => {
      this.flush()
    }, this.flushIntervalMs)
  }

  // שליחה מיידית — למקרים שרוצים לשלוח עכשיו
  async flushNow() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    await this.flush()
  }

  private async flush() {
    this.timer = null
    if (this.queue.length === 0) return

    // שלוף את כל הפעולות שבתור
    const ops = [...this.queue]
    this.queue = []

    if (!this.tenantId) {
      ops.forEach(op => op.resolve(false))
      return
    }

    try {
      const res = await fetch(`/api/bulk-update?tenant=${this.tenantId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operations: ops.map(({ resolve, ...rest }) => rest)
        })
      })

      if (res.ok) {
        const result = await res.json()
        // אם הכל הצליח
        if (result.failed === 0) {
          ops.forEach(op => op.resolve(true))
        } else {
          // חלק נכשל — לא יודעים מי, אז מחזירים הכל כהצלחה
          // (הנתונים כבר עודכנו אופטימיסטית)
          ops.forEach(op => op.resolve(true))
          console.warn(`Operation queue: ${result.failed}/${result.total} failed`)
        }
      } else {
        ops.forEach(op => op.resolve(false))
      }
    } catch {
      ops.forEach(op => op.resolve(false))
    }
  }

  get pending() {
    return this.queue.length
  }
}

export const operationQueue = new OperationQueue(3000)
