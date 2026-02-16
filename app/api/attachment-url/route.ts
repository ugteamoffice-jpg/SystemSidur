import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 })
    }

    const TEABLE_API_URL = process.env.TEABLE_API_URL
    const TEABLE_APP_TOKEN = process.env.TEABLE_APP_TOKEN

    // Get presigned URL from Teable
    const response = await fetch(`${TEABLE_API_URL}/api/attachments/${token}/presignedUrl`, {
      headers: {
        Authorization: `Bearer ${TEABLE_APP_TOKEN}`,
      },
    })

    if (!response.ok) {
      throw new Error("Failed to get presigned URL")
    }

    const data = await response.json()
    return NextResponse.json({ url: data.presignedUrl })
  } catch (error) {
    console.error("[v0] Error getting attachment URL:", error)
    return NextResponse.json({ error: "Failed to get URL" }, { status: 500 })
  }
}
