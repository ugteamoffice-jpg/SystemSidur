// תור בקשות מרכזי - מגביל ל-5 בקשות בו זמנית לTeable
class RequestQueue {
  private queue: (() => Promise<any>)[] = []
  private running = 0
  private maxConcurrent: number

  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent
  }

  add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try { resolve(await fn()) } catch (e) { reject(e) }
      })
      this.run()
    })
  }

  private async run() {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift()!
      this.running++
      task().finally(() => { this.running--; this.run() })
    }
  }
}

// singleton - תור אחד לכל האפליקציה
export const requestQueue = new RequestQueue(5)
