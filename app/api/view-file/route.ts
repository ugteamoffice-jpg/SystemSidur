import { type NextRequest, NextResponse } from "next/server"
import { getTenantFromRequest, isTenantError } from "@/lib/api-tenant-helper"

function getMimeTypeByExtension(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop()
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    txt: "text/plain", html: "text/html", mp4: "video/mp4", mp3: "audio/mpeg",
  }
  return mimeTypes[ext || ""] || "application/octet-stream"
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantFromRequest(request);
    if (isTenantError(ctx)) return ctx;
    const { config, apiKey } = ctx;

    const token = request.nextUrl.searchParams.get("token")
    const directUrl = request.nextUrl.searchParams.get("url")
    const fileName = request.nextUrl.searchParams.get("name") || "file"

    // Option 1: Direct URL provided
    if (directUrl) {
      const fileResponse = await fetch(directUrl)
      if (!fileResponse.ok) throw new Error(`Failed to fetch direct URL: ${fileResponse.status}`)
      const fileBuffer = await fileResponse.arrayBuffer()
      let contentType = fileResponse.headers.get("content-type") || getMimeTypeByExtension(fileName)
      return new NextResponse(fileBuffer, {
        headers: { "Content-Type": contentType, "Content-Disposition": "inline", "Cache-Control": "public, max-age=3600" }
      })
    }

    // Option 2: Token-based
    if (!token) return NextResponse.json({ error: "Missing token or url" }, { status: 400 })

    // Try presigned URL endpoint
    const urlResponse = await fetch(`${config.apiUrl}/api/attachments/${token}/presignedUrl`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    
    if (!urlResponse.ok) {
      console.error("Presigned URL failed:", urlResponse.status, await urlResponse.text())
      // Try direct token URL as fallback
      const directFetch = await fetch(`${config.apiUrl}/api/attachments/${token}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!directFetch.ok) {
        console.error("Direct attachment fetch also failed:", directFetch.status)
        return NextResponse.json({ error: "Failed to load file", details: "Could not get file URL from Teable" }, { status: 500 })
      }
      const fileBuffer = await directFetch.arrayBuffer()
      return new NextResponse(fileBuffer, {
        headers: { "Content-Type": getMimeTypeByExtension(fileName), "Content-Disposition": "inline", "Cache-Control": "public, max-age=3600" }
      })
    }

    const urlData = await urlResponse.json()
    const presignedUrl = urlData.presignedUrl || urlData.url
    if (!presignedUrl) {
      console.error("No presignedUrl in response:", JSON.stringify(urlData))
      return NextResponse.json({ error: "No URL in response" }, { status: 500 })
    }

    const fileResponse = await fetch(presignedUrl)
    if (!fileResponse.ok) throw new Error(`Failed to fetch file: ${fileResponse.status}`)

    const fileBuffer = await fileResponse.arrayBuffer()
    let contentType = fileResponse.headers.get("content-type") || ""
    if (!contentType || contentType === "application/octet-stream") {
      contentType = getMimeTypeByExtension(fileName)
    }

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=3600",
      }
    })
  } catch (error) {
    console.error("Error proxying file:", error)
    return NextResponse.json({ error: "Failed to load file", details: String(error) }, { status: 500 })
  }
}
