/**
 * ולידציה על קבצים מועלים — משותף לכל routes של העלאה
 */

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
])

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { valid: false, error: `סוג קובץ לא מורשה: ${file.type}` }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: "הקובץ גדול מדי (מקסימום 10MB)" }
  }
  if (file.size === 0) {
    return { valid: false, error: "הקובץ ריק" }
  }
  return { valid: true }
}
