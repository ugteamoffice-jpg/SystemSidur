// תור בקשות מרכזי - מגביל בקשות בו זמנית לTeable עם retry ודיליי
class RequestQueue {
  private queue: { fn: () => Promise<any>; resolve: (v: any) => void; reject: (e: any) => void }[] = []
  private running = 0
  private maxConcurrent: number
  private delayMs: number
  private maxRetries: number
  private lastRequestTime = 0

  constructor(maxConcurrent = 2, delayMs = 150, maxRetries = 3) {
    this.maxConcurrent = maxConcurrent
    this.delayMs = delayMs
    this.maxRetries = maxRetries
  }

  add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn: fn as () => Promise<any>, resolve, reject })
      this.processNext()
    })
  }

  private async processNext() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) return

    const task = this.queue.shift()!
    this.running++

    try {
      // דיליי מינימלי בין בקשות
      const now = Date.now()
      const timeSinceLast = now - this.lastRequestTime
      if (timeSinceLast < this.delayMs) {
        await new Promise(r => setTimeout(r, this.delayMs - timeSinceLast))
      }
      this.lastRequestTime = Date.now()

      // ניסיונות חוזרים עם backoff
      let lastError: any
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          const result = await task.fn()
          task.resolve(result)
          return
        } catch (e: any) {
          lastError = e
          if (attempt < this.maxRetries) {
            const backoff = Math.min(500 * Math.pow(2, attempt) + Math.random() * 500, 5000)
            console.warn(`Request failed (attempt ${attempt + 1}/${this.maxRetries + 1}), retrying in ${Math.round(backoff)}ms...`)
            await new Promise(r => setTimeout(r, backoff))
          }
        }
      }
      task.reject(lastError)
    } catch (e) {
      task.reject(e)
    } finally {
      this.running--
      this.processNext()
    }
  }

  get pending() {
    return this.queue.length + this.running
  }
}

// singleton - תור אחד לכל האפליקציה
// 2 בקשות בו זמנית, 150ms דיליי, 3 ניסיונות חוזרים
export const requestQueue = new RequestQueue(2, 150, 3)
