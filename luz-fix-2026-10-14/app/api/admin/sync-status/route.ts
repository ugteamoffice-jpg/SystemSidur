import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { getSyncStatus } from "@/lib/sheets/store"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/sync-status
 * מצב הסנכרון של הזיכרון מול Google Sheets.
 * לבדוק לפני כל deploy: safeToDeploy חייב להיות true (אין כתיבות ממתינות ואין שגיאת flush).
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(getSyncStatus(), { headers: { "Cache-Control": "no-store" } })
}
