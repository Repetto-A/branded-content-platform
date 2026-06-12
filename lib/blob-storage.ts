import { getSupabaseServerClient } from "@/lib/supabase/server"

const DEFAULT_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "branded-content"

function normalizeFilename(filename: string) {
  return filename.toLowerCase().replace(/[^a-z0-9._-]/g, "-")
}

function extensionFromContentType(contentType: string) {
  if (contentType.includes("jpeg")) return "jpg"
  if (contentType.includes("png")) return "png"
  if (contentType.includes("webp")) return "webp"
  if (contentType.includes("gif")) return "gif"
  return "png"
}

/**
 * Uploads a base64 image to Supabase Storage.
 * @param base64Image - Base64 encoded image string (with or without data URI prefix)
 * @param filename - Name for the file (e.g., 'image-123.png')
 * @returns The public CDN URL of the uploaded image
 */
export async function uploadImageToSupabase(base64Image: string, filename: string): Promise<string> {
  // Remove data URI prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "")

  // Extract content type from data URI or default to PNG
  const contentTypeMatch = base64Image.match(/^data:(image\/\w+);base64,/)
  const contentType = contentTypeMatch ? contentTypeMatch[1] : "image/png"

  const binary = Buffer.from(base64Data, "base64")
  const safeFilename = normalizeFilename(filename)
  const hasExtension = /\.[a-z0-9]+$/i.test(safeFilename)
  const finalFilename = hasExtension ? safeFilename : `${safeFilename}.${extensionFromContentType(contentType)}`
  const objectPath = `generated-images/${Date.now()}-${finalFilename}`

  const supabase = getSupabaseServerClient()
  const bucket = DEFAULT_STORAGE_BUCKET

  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, binary, {
    contentType,
    upsert: false,
    cacheControl: "3600",
  })
  if (uploadError) {
    throw new Error(`Failed to upload generated image to Supabase Storage: ${uploadError.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath)
  return data.publicUrl
}

// Backward-compatible export while callers are migrated.
export const uploadImageToBlob = uploadImageToSupabase
