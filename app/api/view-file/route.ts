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
    if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 })

    const urlResponse = await fetch(`${config.apiUrl}/api/attachments/${token}/presignedUrl`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!urlResponse.ok) throw new Error("Failed to get presigned URL")

    const { presignedUrl } = await urlResponse.json()
    const fileResponse = await fetch(presignedUrl)
    if (!fileResponse.ok) throw new Error("Failed to fetch file")

    const fileBuffer = await fileResponse.arrayBuffer()
    const fileName = fileResponse.headers.get("content-disposition")?.match(/filename="?([^"]+)"?/)?.[1] || "file"
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
    return NextResponse.json({ error: "Failed to load file" }, { status: 500 })
  }
}
