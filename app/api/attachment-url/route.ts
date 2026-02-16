import { type NextRequest, NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;

    const token = request.nextUrl.searchParams.get("token")
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 })

    const response = await fetch(`${config.apiUrl}/api/attachments/${token}/presignedUrl`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!response.ok) throw new Error("Failed to get presigned URL")
    const data = await response.json()
    return NextResponse.json({ url: data.presignedUrl })
  } catch (error) {
    console.error("Error getting attachment URL:", error)
    return NextResponse.json({ error: "Failed to get URL" }, { status: 500 })
  }
}
