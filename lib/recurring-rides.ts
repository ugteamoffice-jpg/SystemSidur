// ניהול נסיעות קבועות (תבניות) ב-localStorage

export interface DayPrices {
  clientExcl: string
  clientIncl: string
  driverExcl: string
  driverIncl: string
}

export interface RecurringRide {
  id: string
  // פרטי נסיעה
  customerId: string
  customerName: string
  description: string
  pickupTime: string
  dropoffTime: string
  driverId: string
  driverName: string
  vehicleTypeId: string
  vehicleTypeName: string
  vehicleNum: string
  managerNotes: string
  driverNotes: string
  orderName: string
  mobile: string
  idNum: string
  // ימים פעילים (0=ראשון, 1=שני, ..., 6=שבת)
  activeDays: number[]
  // מחירים לפי יום בשבוע
  dayPrices: { [day: number]: DayPrices }
  // מחיר ברירת מחדל (לימים ללא מחיר ספציפי)
  defaultPrices: DayPrices
  // מצב
  active: boolean
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = (tenantId: string) => `recurring-rides-${tenantId}`

export function loadRecurringRides(tenantId: string): RecurringRide[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY(tenantId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveRecurringRides(tenantId: string, rides: RecurringRide[]): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY(tenantId), JSON.stringify(rides))
}

export function addRecurringRide(tenantId: string, ride: Omit<RecurringRide, "id" | "createdAt" | "updatedAt">): RecurringRide {
  const rides = loadRecurringRides(tenantId)
  const newRide: RecurringRide = {
    ...ride,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  rides.push(newRide)
  saveRecurringRides(tenantId, rides)
  return newRide
}

export function updateRecurringRide(tenantId: string, id: string, updates: Partial<RecurringRide>): void {
  const rides = loadRecurringRides(tenantId)
  const idx = rides.findIndex(r => r.id === id)
  if (idx === -1) return
  rides[idx] = { ...rides[idx], ...updates, updatedAt: new Date().toISOString() }
  saveRecurringRides(tenantId, rides)
}

export function deleteRecurringRide(tenantId: string, id: string): void {
  const rides = loadRecurringRides(tenantId).filter(r => r.id !== id)
  saveRecurringRides(tenantId, rides)
}

export function getActiveRidesForDay(tenantId: string, dayOfWeek: number): RecurringRide[] {
  return loadRecurringRides(tenantId).filter(r => r.active && r.activeDays.includes(dayOfWeek))
}

export function getPricesForDay(ride: RecurringRide, dayOfWeek: number): DayPrices {
  return ride.dayPrices[dayOfWeek] || ride.defaultPrices
}

export const DAY_NAMES_HE = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"]
export const DAY_LETTERS_HE = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"]
