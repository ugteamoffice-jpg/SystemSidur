import { type NextRequest, NextResponse } from "next/server"

function getMimeTypeByExtension(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop()
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    txt: "text/plain",
    html: "text/html",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
  }
  return mimeTypes[ext || ""] || "application/octet-stream"
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 })
    }

    const TEABLE_API_URL = process.env.TEABLE_API_URL
    const TEABLE_APP_TOKEN = process.env.TEABLE_APP_TOKEN

    const urlResponse = await fetch(`${TEABLE_API_URL}/api/attachments/${token}/presignedUrl`, {
      headers: {
        Authorization: `Bearer ${TEABLE_APP_TOKEN}`,
      },
    })

    if (!urlResponse.ok) {
      throw new Error("Failed to get presigned URL")
    }

    const { presignedUrl } = await urlResponse.json()

    const fileResponse = await fetch(presignedUrl)

    if (!fileResponse.ok) {
      throw new Error("Failed to fetch file")
    }

    const fileBuffer = await fileResponse.arrayBuffer()

    const fileName = fileResponse.headers.get("content-disposition")?.match(/filename="?([^"]+)"?/)?.[1] || "file"
    let contentType = fileResponse.headers.get("content-type") || ""

    // If Content-Type is generic or missing, use file extension
    if (!contentType || contentType === "application/octet-stream") {
      contentType = getMimeTypeByExtension(fileName)
    }

    const headers = {
      "Content-Type": contentType,
      "Content-Disposition": "inline", // Removed filename to force browser to render
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=3600",
    }

    console.log("[v0] View-file proxy headers:", {
      "Content-Type": contentType,
      "Content-Disposition": headers["Content-Disposition"],
      fileName: fileName,
    })

    return new NextResponse(fileBuffer, { headers })
  } catch (error) {
    console.error("Error proxying file for viewing:", error)
    return NextResponse.json({ error: "Failed to load file for viewing" }, { status: 500 })
  }
}
